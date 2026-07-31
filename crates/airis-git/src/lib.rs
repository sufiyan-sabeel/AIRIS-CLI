//! Git integration for AIRIS-CLI using gitoxide (gix).
//!
//! Provides a [`GitImpl`] that implements the [`GitOps`] trait,
//! enabling repository operations such as status, staging, diffs,
//! commits, and log retrieval — all backed by the high-performance
//! `gix` library.

#![forbid(unsafe_code)]
#![deny(missing_docs)]

use std::path::{Path, PathBuf};

use airis_core::prelude::*;
use async_trait::async_trait;
use gix::Repository;
use tracing::instrument;

// ─── Configuration ─────────────────────────────────────────────────────────

/// Configuration for git operations.
#[derive(Debug, Clone)]
pub struct GitConfig {
    /// Author name for commits.
    pub author_name: String,
    /// Author email for commits.
    pub author_email: String,
}

impl Default for GitConfig {
    fn default() -> Self {
        Self {
            author_name: "AIRIS-CLI".to_string(),
            author_email: "airis@kageos.dev".to_string(),
        }
    }
}

// ─── Core Implementation ───────────────────────────────────────────────────

/// High-performance git integration via the gitoxide (`gix`) library.
///
/// All methods accept a repository root `path`.  The implementation
/// opens the repository on each call so callers do not need to manage
/// a long-lived handle; this is negligible overhead for the typical
/// interactive workflow.
#[derive(Debug)]
pub struct GitImpl {
    config: GitConfig,
}

impl GitImpl {
    /// Create a new `GitImpl` with default configuration.
    pub fn new() -> Self {
        Self::with_config(GitConfig::default())
    }

    /// Create a new `GitImpl` with the given configuration.
    pub fn with_config(config: GitConfig) -> Self {
        Self { config }
    }

    // ── helpers ────────────────────────────────────────────────────────

    /// Open a `gix::Repository` at the given path.
    ///
    /// Converts the library error into the appropriate [`AirisError`]
    /// variant (`NotGitRepo` vs `Git`).
    fn open_repo(path: &Path) -> AirisResult<Repository> {
        gix::open(path).map_err(|e| match &e {
            gix::open::Error::NotARepository { .. } => AirisError::NotGitRepo,
            _ => AirisError::Git(format!("Failed to open repository: {e}")),
        })
    }

    /// Resolve the tree of the current HEAD, or `None` when the
    /// repository has no commits yet (orphan / unborn HEAD).
    fn head_tree(repo: &Repository) -> AirisResult<Option<gix::Tree<'_>>> {
        let head = repo.head().map_err(|e| {
            AirisError::Git(format!("Failed to resolve HEAD: {e}"))
        })?;
        // An unborn branch (no commits) will not have a peeled object id.
        match head.peel_to_tree() {
            Ok(tree) => Ok(Some(tree)),
            Err(e) => {
                // When there are no commits, gix returns a specific error.
                // We treat this as "no tree available" rather than failing.
                if repo.is_empty().unwrap_or(true) {
                    Ok(None)
                } else {
                    Err(AirisError::Git(format!(
                        "Failed to peel HEAD to tree: {e}"
                    )))
                }
            }
        }
    }

    /// Format a single diff entry (add/delete/modify/rename) as a line.
    fn format_diff_entry(
        event: &gix::diff::entry::Event<'_>,
        resources: &gix::diff::entry::Resources<'_>,
    ) -> String {
        let mut line = String::new();
        match event {
            gix::diff::entry::Event::Creation { source_location, .. } => {
                line.push_str("--- /dev/null\n");
                if let Some(loc) = source_location {
                    let _ = std::fmt::write(
                        &mut line,
                        format_args!("+++ b/{loc}\n"),
                    );
                }
            }
            gix::diff::entry::Event::Deletion { source_location, .. } => {
                if let Some(loc) = source_location {
                    let _ = std::fmt::write(
                        &mut line,
                        format_args!("--- a/{loc}\n+++ /dev/null\n"),
                    );
                }
            }
            gix::diff::entry::Event::Modification {
                source_location,
                destination_location,
                ..
            } => {
                let src = source_location
                    .as_deref()
                    .unwrap_or(gix::bstr::BStr::new("unknown"));
                let dst = destination_location
                    .as_deref()
                    .unwrap_or(gix::bstr::BStr::new("unknown"));
                let _ = std::fmt::write(
                    &mut line,
                    format_args!(
                        "--- a/{src}\n+++ b/{dst}\n",
                        src = src,
                        dst = dst,
                    ),
                );
            }
            gix::diff::entry::Event::Rewrite { source_location, .. } => {
                if let Some(loc) = source_location {
                    let _ = std::fmt::write(
                        &mut line,
                        format_args!("--- a/{loc}\n+++ b/{loc}\n"),
                    );
                }
            }
            gix::diff::entry::Event::Copy { source_location, .. } => {
                if let Some(loc) = source_location {
                    let _ = std::fmt::write(
                        &mut line,
                        format_args!("--- a/{loc}\n+++ b/{loc}\n"),
                    );
                }
            }
        }
        // Append the text diff if available.
        if let Some(diff) = resources.diff() {
            if let Ok(text) = std::str::from_utf8(diff) {
                line.push_str(text);
            }
        }
        line
    }
}

impl Default for GitImpl {
    fn default() -> Self {
        Self::new()
    }
}

// ─── GitOps Trait Implementation ───────────────────────────────────────────

#[async_trait]
impl GitOps for GitImpl {
    #[instrument(skip(self))]
    async fn is_repo(&self, path: &Path) -> AirisResult<bool> {
        // `open_repo` converts NotARepository to an error, but we want
        // to return false without error for non-repo paths.
        match gix::open(path) {
            Ok(_) => Ok(true),
            Err(e) => {
                // Return false for any "not a repository" style error,
                // propagate genuine I/O or permission errors.
                match &e {
                    gix::open::Error::NotARepository { .. }
                    | gix::open::Error::MissingObject { .. } => Ok(false),
                    _ => Err(AirisError::Git(format!(
                        "Failed to probe repository: {e}"
                    ))),
                }
            }
        }
    }

    #[instrument(skip(self))]
    async fn current_branch(&self, path: &Path) -> AirisResult<String> {
        let repo = Self::open_repo(path)?;
        let head = repo
            .head()
            .map_err(|e| AirisError::Git(format!("Failed to read HEAD: {e}")))?;

        // Try the shorthand of the reference name first.
        if let Some(name) = head.reference().and_then(|r| r.name().shorthand()) {
            return Ok(name.to_string());
        }

        // Fall back to the peeled commit hash for detached HEAD.
        if let Some(id) = head.peeled_object_id() {
            return Ok(id.to_string());
        }

        Ok("HEAD".to_string())
    }

    #[instrument(skip(self))]
    async fn status(&self, path: &Path) -> AirisResult<String> {
        let repo = Self::open_repo(path)?;

        // Guard: empty repo has no status to report.
        if repo.is_empty().map_err(|e| {
            AirisError::Git(format!("Failed to check empty state: {e}"))
        })? {
            return Ok("(empty repository — no commits yet)".to_string());
        }

        let mut output = Vec::new();

        // ── staged changes (HEAD vs index) ──
        if let Some(tree) = Self::head_tree(&repo)? {
            let index = repo.index().map_err(|e| {
                AirisError::Git(format!("Failed to read index: {e}"))
            })?;

            let diff = repo
                .diff(tree, index)
                .map_err(|e| AirisError::Git(format!("Diff error: {e}")))?;

            diff.for_each(|delta, _num| {
                let status_char = match delta.raw().status() {
                    gix::diff::blob::pipeline::Mode::Added => "A ",
                    gix::diff::blob::pipeline::Mode::Deleted => "D ",
                    gix::diff::blob::pipeline::Mode::Modified => "M ",
                    gix::diff::blob::pipeline::Mode::Renamed { .. } => "R ",
                    gix::diff::blob::pipeline::Mode::Copied { .. } => "C ",
                    gix::diff::blob::pipeline::Mode::ModeChanged => "T ",
                };

                let path = delta
                    .destination_location()
                    .unwrap_or_else(|| delta.source_location().unwrap_or_default());

                output.push(format!("{status_char}{path}"));
                Ok::<_, gix::diff::error::Error>(())
            })?;
        }

        // ── unstaged changes (index vs worktree) ──
        {
            let index = repo.index().map_err(|e| {
                AirisError::Git(format!("Failed to read index: {e}"))
            })?;

            let worktree_changes = repo
                .diff(index, repo.worktree().ok_or_else(|| {
                    AirisError::Git(
                        "Repository has no worktree".to_string(),
                    )
                })?)
                .map_err(|e| AirisError::Git(format!("Diff error: {e}")))?;

            worktree_changes.for_each(|delta, _num| {
                let status_char = match delta.raw().status() {
                    gix::diff::blob::pipeline::Mode::Added => "?A",
                    gix::diff::blob::pipeline::Mode::Deleted => " D",
                    gix::diff::blob::pipeline::Mode::Modified => " M",
                    gix::diff::blob::pipeline::Mode::Renamed { .. } => " R",
                    gix::diff::blob::pipeline::Mode::Copied { .. } => " C",
                    gix::diff::blob::pipeline::Mode::ModeChanged => " T",
                };

                let path = delta
                    .destination_location()
                    .unwrap_or_else(|| delta.source_location().unwrap_or_default());

                output.push(format!("{status_char}{path}"));
                Ok::<_, gix::diff::error::Error>(())
            })?;
        }

        // ── untracked files ──
        let worktree = repo.worktree().ok_or_else(|| {
            AirisError::Git("Repository has no worktree".to_string())
        })?;
        let mut untracked = Vec::new();
        let entries = std::fs::read_dir(worktree.join("."))
            .map_err(|e| AirisError::Io(e))?;

        // Simple untracked detection: check if index tracks the file.
        let index = repo.index().map_err(|e| {
            AirisError::Git(format!("Failed to read index: {e}"))
        })?;

        // We can't easily scan all files with gix for untracked in 0.69
        // without the glob/fs-iterator features, so we do a lightweight
        // check on common source paths from the worktree root.
        if let Ok(mut read_dir) = tokio::task::spawn_blocking(move || {
            std::fs::read_dir(worktree)
        })
        .await
        .map_err(|e| AirisError::Internal(e.to_string()))?
        {
            let repo_ref = Self::open_repo(path)?;
            while let Ok(Some(entry)) = read_dir.next_entry() {
                let entry_path = entry.path();
                if entry_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map_or(true, |n| n.starts_with('.'))
                {
                    continue;
                }
                // Check if tracked in index
                if repo_ref
                    .index()
                    .ok()
                    .and_then(|idx| {
                        idx.entry_by_path(entry_path.strip_prefix(path).ok()?)
                    })
                    .is_none()
                {
                    if let Some(name) =
                        entry_path.strip_prefix(path).ok().and_then(|p| {
                            p.to_str().map(|s| s.to_string())
                        })
                    {
                        untracked.push(format!("?? {name}"));
                    }
                }
            }
        }

        output.extend(untracked);

        if output.is_empty() {
            Ok("(clean)".to_string())
        } else {
            Ok(output.join("\n"))
        }
    }

    #[instrument(skip(self))]
    async fn staged_diff(&self, path: &Path) -> AirisResult<String> {
        let repo = Self::open_repo(path)?;

        if repo.is_empty().map_err(|e| {
            AirisError::Git(format!("Failed to check empty state: {e}"))
        })? {
            return Err(AirisError::NotGitRepo);
        }

        let tree = Self::head_tree(&repo)?.ok_or_else(|| {
            AirisError::Git("No commits yet — nothing to diff against".to_string())
        })?;

        let index = repo.index().map_err(|e| {
            AirisError::Git(format!("Failed to read index: {e}"))
        })?;

        let diff = repo
            .diff(tree, index)
            .map_err(|e| AirisError::Git(format!("Diff error: {e}")))?;

        let mut output = String::new();
        diff.for_each(|delta, _num| {
            if let Some(resources) = delta.resources() {
                let entry =
                    Self::format_diff_entry(delta.event(), &resources);
                output.push_str(&entry);
            }
            Ok::<_, gix::diff::error::Error>(())
        })?;

        Ok(output)
    }

    #[instrument(skip(self))]
    async fn unstaged_diff(&self, path: &Path) -> AirisResult<String> {
        let repo = Self::open_repo(path)?;

        if repo.is_empty().map_err(|e| {
            AirisError::Git(format!("Failed to check empty state: {e}"))
        })? {
            return Err(AirisError::NotGitRepo);
        }

        let index = repo.index().map_err(|e| {
            AirisError::Git(format!("Failed to read index: {e}"))
        })?;

        let worktree = repo.worktree().ok_or_else(|| {
            AirisError::Git("Repository has no worktree".to_string())
        })?;

        let diff = repo
            .diff(index, worktree)
            .map_err(|e| AirisError::Git(format!("Diff error: {e}")))?;

        let mut output = String::new();
        diff.for_each(|delta, _num| {
            if let Some(resources) = delta.resources() {
                let entry =
                    Self::format_diff_entry(delta.event(), &resources);
                output.push_str(&entry);
            }
            Ok::<_, gix::diff::error::Error>(())
        })?;

        Ok(output)
    }

    #[instrument(skip(self))]
    async fn add(&self, path: &Path, files: &[PathBuf]) -> AirisResult<()> {
        let repo = Self::open_repo(path)?;
        let mut index = repo.index().map_err(|e| {
            AirisError::Git(format!("Failed to read index: {e}"))
        })?;

        for file in files {
            let repo_relative = if file.is_absolute() {
                file.strip_prefix(path).unwrap_or(file)
            } else {
                file.as_path()
            };

            // `index.add_entry` or `index.add_from_path` – gix 0.69
            // supports `add_path` on the index.
            index
                .add_path(repo_relative)
                .map_err(|e| {
                    AirisError::Git(format!(
                        "Failed to stage '{}': {e}",
                        repo_relative.display()
                    ))
                })?;
        }

        index.write().map_err(|e| {
            AirisError::Git(format!("Failed to write index: {e}"))
        })?;

        Ok(())
    }

    #[instrument(skip(self))]
    async fn commit(&self, path: &Path, message: &str) -> AirisResult<()> {
        let repo = Self::open_repo(path)?;

        // Write the current index as a tree.
        let mut index = repo.index().map_err(|e| {
            AirisError::Git(format!("Failed to read index: {e}"))
        })?;

        let tree_id = index.write_tree().map_err(|e| {
            AirisError::Git(format!("Failed to write tree: {e}"))
        })?;

        // Resolve parent commit(s).
        let mut parents = Vec::new();
        if let Ok(head) = repo.head() {
            if let Some(id) = head.peeled_object_id() {
                parents.push(id);
            }
        }

        // Determine author and committer.
        let (name, email) = self.get_author(&repo);

        let author =
            gix::actor::Signature::new(name, email, gix::actor::Time::now_local().unwrap_or_else(|_| {
                gix::actor::Time::now_utc()
            }));

        let committer = author.clone();

        // Perform the commit.
        let reference = gix::refs::Reference::try_from("HEAD")
            .map_err(|e| AirisError::Git(format!("Invalid reference: {e}")))?;

        repo.commit(
            reference,
            author,
            committer,
            message,
            tree_id,
            parents.iter().copied(),
        )
        .map_err(|e| AirisError::Git(format!("Commit failed: {e}")))?;

        Ok(())
    }

    #[instrument(skip(self))]
    async fn log(&self, path: &Path, max_count: usize) -> AirisResult<Vec<String>> {
        let repo = Self::open_repo(path)?;

        if repo.is_empty().map_err(|e| {
            AirisError::Git(format!("Failed to check empty state: {e}"))
        })? {
            return Ok(Vec::new());
        }

        let head = repo.head().map_err(|e| {
            AirisError::Git(format!("Failed to resolve HEAD: {e}"))
        })?;

        let head_id = head.peeled_object_id().ok_or_else(|| {
            AirisError::Git("HEAD has no object (unborn branch)".to_string())
        })?;

        let mut walk = repo
            .rev_walk::<gix::revision::walk::Platform>(vec![head_id])
            .map_err(|e| AirisError::Git(format!("Rev walk error: {e}")))?;

        walk.set_sorting(
            gix::revision::walk::Sorting::ByCommitTimeNewestFirst,
        )
        .map_err(|e| {
            AirisError::Git(format!("Failed to set sorting: {e}"))
        })?;

        let mut entries = Vec::new();
        for commit_result in walk.take(max_count) {
            let commit_id = commit_result.map_err(|e| {
                AirisError::Git(format!("Rev walk entry error: {e}"))
            })?;

            let commit = repo.find_object(commit_id).map_err(|e| {
                AirisError::Git(format!("Failed to find commit: {e}"))
            })?;

            let commit_ref = commit
                .peel_to_commit()
                .map_err(|e| {
                    AirisError::Git(format!(
                        "Failed to decode commit: {e}"
                    ))
                })?;

            let summary = commit_ref
                .message_raw_sloppy()
                .map(|m| {
                    let s = m.to_string_lossy();
                    // Take the first line only for a compact log.
                    s.lines().next().unwrap_or(&s).to_string()
                })
                .unwrap_or_else(|| "(no message)".to_string());

            entries.push(format!(
                "{} {}",
                commit_id,
                summary
            ));
        }

        Ok(entries)
    }

    #[instrument(skip(self))]
    async fn file_history(
        &self,
        path: &Path,
        file: &Path,
    ) -> AirisResult<Vec<String>> {
        let repo = Self::open_repo(path)?;

        if repo.is_empty().map_err(|e| {
            AirisError::Git(format!("Failed to check empty state: {e}"))
        })? {
            return Ok(Vec::new());
        }

        let head = repo.head().map_err(|e| {
            AirisError::Git(format!("Failed to resolve HEAD: {e}"))
        })?;

        let head_id = head.peeled_object_id().ok_or_else(|| {
            AirisError::Git("HEAD has no object (unborn branch)".to_string())
        })?;

        // Build a simplified rev walk, keeping only commits that
        // touch the requested file.
        let pathspec = if file.is_absolute() {
            file.strip_prefix(path).unwrap_or(file).to_path_buf()
        } else {
            file.to_path_buf()
        };

        let mut walk = repo
            .rev_walk::<gix::revision::walk::Platform>(vec![head_id])
            .map_err(|e| AirisError::Git(format!("Rev walk error: {e}")))?;

        walk.set_sorting(
            gix::revision::walk::Sorting::ByCommitTimeNewestFirst,
        )
        .map_err(|e| {
            AirisError::Git(format!("Failed to set sorting: {e}"))
        })?;

        let mut entries = Vec::new();

        // We use a simple external process for file-history since gix
        // 0.69 does not have a first-class "path-filtered rev-list"
        // in the high-level API.
        //
        // Instead, we shell out to `git log --oneline <path>` which is
        // fast and reliable for this specific operation.
        let output = tokio::process::Command::new("git")
            .args([
                "-C",
                path.to_str().ok_or_else(|| {
                    AirisError::PathEncoding(
                        path.to_string_lossy().to_string(),
                    )
                })?,
                "log",
                "--oneline",
                "--max-count",
                &max_count.to_string(),
                "--",
                pathspec.to_str().ok_or_else(|| {
                    AirisError::PathEncoding(
                        pathspec.to_string_lossy().to_string(),
                    )
                })?,
            ])
            .output()
            .await
            .map_err(|e| AirisError::Git(format!("git log failed: {e}")))?;

        if !output.status.success() {
            return Err(AirisError::Git(format!(
                "git log exited with code {}",
                output.status.code().unwrap_or(-1)
            )));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if !line.trim().is_empty() {
                entries.push(line.to_string());
            }
        }

        Ok(entries)
    }

    #[instrument(skip(self))]
    async fn generate_commit_message(&self, path: &Path) -> AirisResult<String> {
        let repo = Self::open_repo(path)?;

        // Collect the staged diff as context.
        let diff = if let Ok(tree) = Self::head_tree(&repo)? {
            let index = repo.index().map_err(|e| {
                AirisError::Git(format!("Failed to read index: {e}"))
            })?;
            let d = repo
                .diff(tree, index)
                .map_err(|e| AirisError::Git(format!("Diff error: {e}")))?;
            let mut text = String::new();
            d.for_each(|delta, _num| {
                if let Some(resources) = delta.resources() {
                    text.push_str(&Self::format_diff_entry(
                        delta.event(),
                        &resources,
                    ));
                }
                Ok::<_, gix::diff::error::Error>(())
            })?;
            text
        } else {
            // No commits yet — use full index content.
            String::new()
        };

        // If the diff is empty, check for unstaged changes.
        let context = if diff.trim().is_empty() {
            self.unstaged_diff(path).await.unwrap_or_default()
        } else {
            diff
        };

        // Build a heuristic commit message from changed file paths.
        let lines: Vec<&str> = context.lines().collect();
        let mut files_changed = Vec::new();

        for line in &lines {
            // Match unified-diff header lines (+++ b/... or --- a/...)
            if let Some(path_str) = line
                .strip_prefix("+++ b/")
                .or_else(|| line.strip_prefix("--- a/"))
            {
                let file_name = path_str.trim();
                if !files_changed.contains(&file_name) {
                    files_changed.push(file_name);
                }
            }
        }

        if files_changed.is_empty() {
            // Fallback: try to detect from line additions/removals.
            let added = lines.iter().filter(|l| l.starts_with('+')).count();
            let removed = lines.iter().filter(|l| l.starts_with('-')).count();
            return Ok(format!(
                "Update codebase\n\n{added} additions, {removed} deletions"
            ));
        }

        let file_count = files_changed.len();
        let summary = if file_count <= 3 {
            format!("Update {}", files_changed.join(", "))
        } else {
            format!(
                "Update {} files ({} others)",
                files_changed[0],
                file_count - 1
            )
        };

        // Provide a more detailed body.
        let detail: Vec<String> = files_changed
            .iter()
            .enumerate()
            .map(|(i, f)| format!("  - modified: {f}"))
            .collect();

        Ok(format!("{summary}\n\n{}", detail.join("\n")))
    }
}

impl GitImpl {
    /// Read author identity from repository config, falling back to the
    /// configured default.
    fn get_author(
        &self,
        repo: &Repository,
    ) -> (gix::bstr::BString, gix::bstr::BString) {
        let name = repo
            .config()
            .ok()
            .and_then(|c| c.string("user.name").map(|s| s.to_owned()))
            .unwrap_or_else(|| {
                gix::bstr::BString::from(self.config.author_name.as_str())
            });

        let email = repo
            .config()
            .ok()
            .and_then(|c| c.string("user.email").map(|s| s.to_owned()))
            .unwrap_or_else(|| {
                gix::bstr::BString::from(self.config.author_email.as_str())
            });

        (name, email)
    }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn init_test_repo() -> tempfile::TempDir {
        let dir = tempfile::tempdir().expect("failed to create temp dir");
        let output = std::process::Command::new("git")
            .args(["init"])
            .current_dir(dir.path())
            .output()
            .expect("git init failed");
        assert!(output.status.success());

        // Set a known user for deterministic test output.
        std::process::Command::new("git")
            .args(["config", "user.name", "Test User"])
            .current_dir(dir.path())
            .output()
            .expect("git config failed");
        std::process::Command::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(dir.path())
            .output()
            .expect("git config failed");

        dir
    }

    #[tokio::test]
    async fn test_is_repo() {
        let dir = init_test_repo();
        let git = GitImpl::new();

        assert!(git.is_repo(dir.path()).await.unwrap());
        assert!(!git.is_repo(Path::new("/tmp")).await.unwrap());
    }

    #[tokio::test]
    async fn test_not_repo_error() {
        let git = GitImpl::new();
        let result = git.current_branch(Path::new("/tmp")).await;
        assert!(matches!(result, Err(AirisError::NotGitRepo)));
    }

    #[tokio::test]
    async fn test_empty_repo_branch() {
        let dir = init_test_repo();
        let git = GitImpl::new();

        // An empty repo on git init is on "master" (or "main" depending
        // on Git version), but there are no commits yet.
        let branch = git.current_branch(dir.path()).await.unwrap();
        // Accept either "master" or "main".
        assert!(
            branch == "master" || branch == "main",
            "Expected master or main, got {branch}"
        );
    }

    #[tokio::test]
    async fn test_commit_and_log() {
        let dir = init_test_repo();
        let git = GitImpl::new();

        // Create a file and commit it via the real git binary so the
        // test repo has content to work with.
        fs::write(dir.path().join("hello.txt"), b"Hello, world!")
            .unwrap();

        std::process::Command::new("git")
            .args(["add", "hello.txt"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        std::process::Command::new("git")
            .args(["commit", "-m", "Initial commit"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        let log = git.log(dir.path(), 10).await.unwrap();
        assert_eq!(log.len(), 1);
        assert!(log[0].contains("Initial commit"));
    }

    #[tokio::test]
    async fn test_stage_and_unstage_diff() {
        let dir = init_test_repo();
        let git = GitImpl::new();

        fs::write(dir.path().join("hello.txt"), b"Hello, world!")
            .unwrap();

        std::process::Command::new("git")
            .args(["add", "hello.txt"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        std::process::Command::new("git")
            .args(["commit", "-m", "Initial"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        // Modify the file.
        fs::write(dir.path().join("hello.txt"), b"Hello, Rust!").unwrap();

        // Stage it.
        git.add(dir.path(), &[PathBuf::from("hello.txt")])
            .await
            .unwrap();

        // Staged diff should show the change.
        let staged = git.staged_diff(dir.path()).await.unwrap();
        assert!(!staged.is_empty());

        // Modify again after staging.
        fs::write(dir.path().join("hello.txt"), b"Modified again").unwrap();

        let unstaged = git.unstaged_diff(dir.path()).await.unwrap();
        assert!(!unstaged.is_empty());
    }

    #[tokio::test]
    async fn test_generate_commit_message() {
        let dir = init_test_repo();
        let git = GitImpl::new();

        fs::write(dir.path().join("hello.txt"), b"Hello, world!")
            .unwrap();

        std::process::Command::new("git")
            .args(["add", "hello.txt"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        std::process::Command::new("git")
            .args(["commit", "-m", "Initial"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        // Make changes and stage them.
        fs::write(dir.path().join("hello.txt"), b"Hello, Rust!").unwrap();
        git.add(dir.path(), &[PathBuf::from("hello.txt")])
            .await
            .unwrap();

        let msg = git.generate_commit_message(dir.path()).await.unwrap();
        assert!(!msg.is_empty());
    }

    #[tokio::test]
    async fn test_status() {
        let dir = init_test_repo();
        let git = GitImpl::new();

        fs::write(dir.path().join("hello.txt"), b"Hello, world!")
            .unwrap();

        std::process::Command::new("git")
            .args(["add", "hello.txt"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        std::process::Command::new("git")
            .args(["commit", "-m", "Initial"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        // Status after a clean commit should indicate clean.
        let status = git.status(dir.path()).await.unwrap();
        assert!(
            status.contains("(clean)"),
            "Expected clean status, got: {status}"
        );

        // Modify file to produce dirty status.
        fs::write(dir.path().join("hello.txt"), b"Modified").unwrap();
        let status = git.status(dir.path()).await.unwrap();
        assert!(!status.contains("(clean)"));
    }
}
