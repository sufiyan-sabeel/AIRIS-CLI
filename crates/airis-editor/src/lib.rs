//! Editor module for AIRIS-CLI.
//!
//! Provides file editing capabilities with undo support,
//! unified diff generation, fuzzy text matching, and workspace-aware
//! operations. All file I/O is constrained to the workspace root
//! when one is configured.

use airis_core::prelude::*;
use async_trait::async_trait;
use parking_lot::RwLock;
use similar::{ChangeTag, TextDiff};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tracing::debug;

/// Maximum undo history entries.
const UNDO_LIMIT: usize = 100;

// ─── Patch Application Types ───────────────────────────────────────────────

/// A single line in a unified diff hunk.
#[derive(Debug, Clone)]
enum PatchLine {
    /// Context line (prefixed with ` `).
    Context(String),
    /// Deletion line (prefixed with `-`).
    Delete(String),
    /// Insertion line (prefixed with `+`).
    Insert(String),
}

/// A parsed hunk from a unified diff.
#[derive(Debug, Clone)]
struct PatchHunk {
    /// Starting line number in the original file (1-based).
    old_start: usize,
    /// Number of lines in the original hunk.
    old_count: usize,
    /// Starting line number in the new file (1-based).
    new_start: usize,
    /// Number of lines in the new hunk.
    new_count: usize,
    /// Lines comprising this hunk.
    lines: Vec<PatchLine>,
}

/// Error from patch application.
#[derive(Debug)]
struct PatchError {
    line: usize,
    msg: String,
}

// ─── Editor Implementation ────────────────────────────────────────────────

/// File editor with undo history, diff generation, and workspace safety.
///
/// All operations verify that paths reside within the configured workspace
/// root. Relative paths are resolved against the workspace root when set.
///
/// # Examples
///
/// ```no_run
/// use airis_editor::EditorImpl;
/// use airis_core::prelude::*;
/// use std::path::Path;
///
/// # #[tokio::main]
/// # async fn main() -> AirisResult<()> {
/// let editor = EditorImpl::new();
/// let content = editor.read(Path::new("Cargo.toml")).await?;
/// # Ok(())
/// # }
/// ```
pub struct EditorImpl {
    /// Optional workspace root for path resolution and safety checks.
    workspace_root: Option<PathBuf>,
    /// Undo history stack (bounded at `UNDO_LIMIT`).
    undo_stack: Arc<RwLock<Vec<UndoEntry>>>,
    /// Snapshots of original file content for diff generation.
    snapshots: Arc<RwLock<HashMap<PathBuf, String>>>,
}

impl EditorImpl {
    /// Create a new editor with no workspace root configured.
    ///
    /// Paths are used as-is; relative paths are resolved against the
    /// process current directory.
    pub fn new() -> Self {
        Self {
            workspace_root: None,
            undo_stack: Arc::new(RwLock::new(Vec::new())),
            snapshots: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new editor scoped to the given workspace root.
    ///
    /// Relative paths are resolved against `root`, and operations on
    /// paths outside the root are rejected.
    pub fn with_workspace(root: PathBuf) -> Self {
        Self {
            workspace_root: Some(root),
            undo_stack: Arc::new(RwLock::new(Vec::new())),
            snapshots: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Set or update the workspace root.
    pub fn set_workspace(&mut self, root: PathBuf) {
        self.workspace_root = Some(root);
    }

    /// Clear the workspace root, allowing all paths.
    pub fn clear_workspace(&mut self) {
        self.workspace_root = None;
    }

    /// Resolve a path against the workspace root if one is set.
    ///
    /// Relative paths are joined with the workspace root. Absolute paths
    /// and paths when no root is set are returned unchanged.
    fn resolve_path(&self, path: &Path) -> PathBuf {
        match &self.workspace_root {
            Some(root) if path.is_relative() => root.join(path),
            _ => path.to_path_buf(),
        }
    }

    /// Verify that a path (already resolved) lies within the workspace.
    ///
    /// Returns `Ok(())` when no root is configured or the path is under
    /// the root. Returns an `AirisError::Edit` otherwise.
    fn check_workspace_safe(&self, resolved: &Path) -> AirisResult<()> {
        if let Some(root) = &self.workspace_root {
            if !resolved.starts_with(root) {
                return Err(AirisError::Edit(format!(
                    "Path '{}' is outside workspace root '{}'",
                    resolved.display(),
                    root.display()
                )));
            }
        }
        Ok(())
    }

    /// Read the current content of a file, or return an empty string if
    /// it does not exist yet.
    fn read_current(&self, resolved: &Path) -> String {
        std::fs::read_to_string(resolved).unwrap_or_default()
    }

    /// Store a snapshot of the file's original content before modification.
    ///
    /// Only stores the snapshot on the first call; subsequent calls for the
    /// same path are no-ops so the earliest version is preserved.
    fn store_snapshot(&self, resolved: &Path) {
        if !self.snapshots.read().contains_key(resolved) {
            if let Ok(content) = std::fs::read_to_string(resolved) {
                self.snapshots.write().insert(resolved.to_path_buf(), content);
            }
        }
    }

    /// Retrieve a stored snapshot, if one exists.
    fn get_snapshot(&self, resolved: &Path) -> Option<String> {
        self.snapshots.read().get(resolved).cloned()
    }

    /// Push an entry onto the undo stack, respecting the size bound.
    fn push_undo(&self, entry: UndoEntry) {
        let mut stack = self.undo_stack.write();
        stack.push(entry);
        if stack.len() > UNDO_LIMIT {
            stack.remove(0);
        }
    }

    /// Read a file's complete content for internal use (non-async).
    fn read_internal(&self, resolved: &Path) -> AirisResult<String> {
        self.check_workspace_safe(resolved)?;
        std::fs::read_to_string(resolved).map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => {
                AirisError::FileNotFound(resolved.display().to_string())
            }
            _ => AirisError::Io(e),
        })
    }

    /// Write content to a file for internal use (non-async), creating
    /// parent directories as needed.
    fn write_internal(&self, resolved: &Path, content: &str) -> AirisResult<()> {
        self.check_workspace_safe(resolved)?;
        if let Some(parent) = resolved.parent() {
            std::fs::create_dir_all(parent).map_err(AirisError::Io)?;
        }
        std::fs::write(resolved, content).map_err(AirisError::Io)?;
        Ok(())
    }
}

impl Default for EditorImpl {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Editor for EditorImpl {
    async fn read(&self, path: &Path) -> AirisResult<String> {
        let resolved = self.resolve_path(path);
        debug!("Reading file: {}", resolved.display());
        self.read_internal(&resolved)
    }

    async fn write(&self, path: &Path, content: &str) -> AirisResult<()> {
        let resolved = self.resolve_path(path);
        debug!("Writing file: {} ({} bytes)", resolved.display(), content.len());

        // Validate workspace safety before any I/O.
        self.check_workspace_safe(&resolved)?;

        // Capture original before overwriting
        let original = self.read_current(&resolved);
        self.store_snapshot(&resolved);

        self.write_internal(&resolved, content)?;

        let entry = UndoEntry {
            id: uuid::Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            file_path: resolved,
            original_content: original,
            edit_description: format!("Write {} bytes", content.len()),
        };
        self.push_undo(entry);

        Ok(())
    }

    async fn edit(&self, edit: &FileEdit) -> AirisResult<()> {
        let resolved = self.resolve_path(&edit.file_path);
        debug!(
            "Editing file: {} (replace '{}' -> '{}')",
            resolved.display(),
            truncate(&edit.old_text, 40),
            truncate(&edit.new_text, 40),
        );

        let content = self.read_internal(&resolved)?;
        self.store_snapshot(&resolved);

        // Try fuzzy replacement
        let new_content = find_and_replace_fuzzy(&content, &edit.old_text, &edit.new_text)
            .ok_or_else(|| {
                AirisError::Edit(format!(
                    "Could not find '{}' in {}",
                    truncate(&edit.old_text, 80),
                    resolved.display()
                ))
            })?;

        self.write_internal(&resolved, &new_content)?;

        let entry = UndoEntry {
            id: uuid::Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            file_path: resolved,
            original_content: content,
            edit_description: format!(
                "Replace '{}' with '{}'",
                truncate(&edit.old_text, 40),
                truncate(&edit.new_text, 40),
            ),
        };
        self.push_undo(entry);

        Ok(())
    }

    async fn apply_patch(&self, path: &Path, patch: &str) -> AirisResult<()> {
        let resolved = self.resolve_path(path);
        debug!("Applying patch to: {}", resolved.display());

        let content = self.read_internal(&resolved)?;
        self.store_snapshot(&resolved);

        // Parse hunks from unified diff format
        let hunks = parse_unified_diff(patch)?;
        let new_content = apply_hunks(&content, &hunks).map_err(|e| AirisError::PatchFailed {
            line: e.line,
            message: e.msg,
        })?;

        self.write_internal(&resolved, &new_content)?;

        let entry = UndoEntry {
            id: uuid::Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            file_path: resolved,
            original_content: content,
            edit_description: format!("Applied patch ({} hunks)", hunks.len()),
        };
        self.push_undo(entry);

        Ok(())
    }

    async fn diff(&self, path: &Path) -> AirisResult<String> {
        let resolved = self.resolve_path(path);
        debug!("Generating diff for: {}", resolved.display());

        let current = self.read_internal(&resolved)?;
        let original = self.get_snapshot(&resolved).unwrap_or_default();

        if original.is_empty() {
            return Ok(String::new());
        }

        let diff = TextDiff::from_lines(&original, &current);

        // Build unified diff output
        let mut output = String::new();
        output.push_str(&format!(
            "--- a/{}\n+++ b/{}\n",
            resolved.display(),
            resolved.display()
        ));

        // Group changes with 3 lines of context
        for group in diff.grouped_ops(3) {
            if group.is_empty() {
                continue;
            }

            let first = &group[0];
            let last = &group[group.len() - 1];
            let old_start = first.old_range().start + 1;
            let old_end = last.old_range().end;
            let new_start = first.new_range().start + 1;
            let new_end = last.new_range().end;

            let old_count = old_end - first.old_range().start;
            let new_count = new_end - first.new_range().start;

            output.push_str(&format!(
                "@@ -{},{} +{},{} @@\n",
                old_start, old_count, new_start, new_count
            ));

            for change in diff.iter_changes(&group) {
                let sign = match change.tag() {
                    ChangeTag::Delete => "-",
                    ChangeTag::Insert => "+",
                    ChangeTag::Equal => " ",
                };
                output.push_str(&format!("{}{}", sign, change.value()));
                if !change.value().ends_with('\n') {
                    output.push('\n');
                }
            }
        }

        Ok(output)
    }

    async fn undo(&self) -> AirisResult<UndoEntry> {
        let entry = {
            let mut stack = self.undo_stack.write();
            stack.pop().ok_or(AirisError::UndoEmpty)?
        };

        debug!("Undoing edit to: {}", entry.file_path.display());

        // Restore original content (even if file was deleted, this recreates it)
        if let Some(parent) = entry.file_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(AirisError::Io)?;
        }
        tokio::fs::write(&entry.file_path, &entry.original_content)
            .await
            .map_err(AirisError::Io)?;

        Ok(entry)
    }

    async fn undo_history(&self) -> AirisResult<Vec<UndoEntry>> {
        Ok(self.undo_stack.read().clone())
    }

    async fn read_range(&self, path: &Path, start: usize, end: usize) -> AirisResult<String> {
        let resolved = self.resolve_path(path);
        debug!(
            "Reading lines {}-{} from: {}",
            start, end, resolved.display()
        );

        let content = self.read_internal(&resolved)?;
        let lines: Vec<&str> = content.lines().collect();

        if start == 0 || end == 0 {
            return Err(AirisError::Edit(format!(
                "Line numbers are 1-based; got start={start}, end={end}"
            )));
        }
        if start > end {
            return Err(AirisError::Edit(format!(
                "Start line {start} is after end line {end}"
            )));
        }

        let total = lines.len();
        if start > total {
            return Err(AirisError::Edit(format!(
                "Start line {start} exceeds file length {total}"
            )));
        }

        let start_idx = start.saturating_sub(1); // convert to 0-based
        let end_idx = end.min(total);
        let selected = &lines[start_idx..end_idx];

        Ok(selected.join("\n"))
    }

    async fn create_file(&self, path: &Path, content: &str) -> AirisResult<()> {
        let resolved = self.resolve_path(path);
        debug!("Creating file: {}", resolved.display());
        self.check_workspace_safe(&resolved)?;

        if resolved.exists() {
            return Err(AirisError::Edit(format!(
                "File already exists: {}",
                resolved.display()
            )));
        }

        if let Some(parent) = resolved.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(AirisError::Io)?;
        }

        tokio::fs::write(&resolved, content)
            .await
            .map_err(AirisError::Io)?;

        // No undo entry for create; the file didn't exist before.
        debug!("Created file: {}", resolved.display());
        Ok(())
    }

    async fn delete_file(&self, path: &Path) -> AirisResult<()> {
        let resolved = self.resolve_path(path);
        debug!("Deleting file: {}", resolved.display());
        self.check_workspace_safe(&resolved)?;

        // Capture content before deletion so undo can restore it.
        let content = match self.read_internal(&resolved) {
            Ok(c) => c,
            Err(AirisError::FileNotFound(_)) => {
                return Err(AirisError::FileNotFound(resolved.display().to_string()));
            }
            Err(e) => return Err(e),
        };

        tokio::fs::remove_file(&resolved)
            .await
            .map_err(|e| match e.kind() {
                std::io::ErrorKind::NotFound => {
                    AirisError::FileNotFound(resolved.display().to_string())
                }
                _ => AirisError::Io(e),
            })?;

        let entry = UndoEntry {
            id: uuid::Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            file_path: resolved,
            original_content: content,
            edit_description: "Deleted file".to_string(),
        };
        self.push_undo(entry);

        Ok(())
    }
}

// ─── Fuzzy Find & Replace ─────────────────────────────────────────────────

/// Find `old_text` in `content` and replace it with `new_text`.
///
/// Matching strategy (in order):
/// 1. **Exact match** – byte-for-byte identity.
/// 2. **Whitespace-normalized match** – runs of ASCII whitespace are
///    collapsed to single spaces before comparing.
///
/// Returns `None` when neither strategy finds a match.
fn find_and_replace_fuzzy(content: &str, old_text: &str, new_text: &str) -> Option<String> {
    // 1. Exact match
    if let Some(pos) = content.find(old_text) {
        let mut result = String::with_capacity(
            content.len() + new_text.len().saturating_sub(old_text.len()),
        );
        result.push_str(&content[..pos]);
        result.push_str(new_text);
        result.push_str(&content[pos + old_text.len()..]);
        return Some(result);
    }

    // 2. Whitespace-normalized match
    let norm_content = normalize_whitespace(content);
    let norm_old = normalize_whitespace(old_text);

    // Find the normalized position
    if let Some(norm_pos) = norm_content.find(&norm_old) {
        // Map back to a position in the original content.
        // We search forward from a range centered on the estimated position.
        let estimate = (norm_pos as f64 * content.len() as f64 / norm_content.len().max(1) as f64)
            as usize;
        let search_start = estimate.saturating_sub(old_text.len());
        let search_end = (estimate + old_text.len() + norm_old.len()).min(content.len());

        if let Some(pos) = content[search_start..search_end].find(old_text) {
            let actual_pos = search_start + pos;
            let mut result = String::with_capacity(
                content.len() + new_text.len().saturating_sub(old_text.len()),
            );
            result.push_str(&content[..actual_pos]);
            result.push_str(new_text);
            result.push_str(&content[actual_pos + old_text.len()..]);
            return Some(result);
        }

        // Fallback: try to locate by matching a prefix of the search text
        let prefix: String = old_text
            .chars()
            .take(20)
            .filter(|c| !c.is_ascii_whitespace())
            .collect();
        if !prefix.is_empty() {
            let norm_prefix = normalize_whitespace(&prefix);
            // Walk through original content to find prefix match
            let mut i = 0;
            let content_bytes = content.as_bytes();
            while i < content_bytes.len() {
                // Skip whitespace in original
                while i < content_bytes.len() && content_bytes[i].is_ascii_whitespace() {
                    i += 1;
                }
                if i + prefix.len() <= content_bytes.len()
                    && content[i..].starts_with(&prefix)
                {
                    // Check if old_text follows from here
                    if content[i..].starts_with(old_text) {
                        let mut result = String::with_capacity(
                            content.len() + new_text.len().saturating_sub(old_text.len()),
                        );
                        result.push_str(&content[..i]);
                        result.push_str(new_text);
                        result.push_str(&content[i + old_text.len()..]);
                        return Some(result);
                    }
                }
                i += 1;
            }
        }
    }

    None
}

/// Collapse runs of ASCII whitespace to single spaces.
///
/// Leading and trailing whitespace is stripped. Non-ASCII whitespace
/// (Unicode) is preserved as-is.
fn normalize_whitespace(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut in_space = false;
    let mut started = false;

    for ch in s.chars() {
        if ch.is_ascii_whitespace() {
            if started && !in_space {
                result.push(' ');
                in_space = true;
            }
        } else {
            result.push(ch);
            in_space = false;
            started = true;
        }
    }

    // Trim trailing space
    if result.ends_with(' ') {
        result.pop();
    }

    result
}

/// Truncate a string for display in edit descriptions.
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        let mut t = s[..max_len].to_string();
        t.push_str("...");
        t
    }
}

// ─── Unified Diff Parsing ─────────────────────────────────────────────────

/// Parse a unified-diff string into a list of hunks.
///
/// Handles the standard unified diff format:
/// ```text
/// --- a/file
/// +++ b/file
/// @@ -start,count +start,count @@
///  context
/// -deleted
/// +inserted
/// ```
fn parse_unified_diff(input: &str) -> AirisResult<Vec<PatchHunk>> {
    let mut hunks = Vec::new();
    let mut current_hunk: Option<PatchHunk> = None;

    for (line_num, line) in input.lines().enumerate() {
        if line.starts_with("--- ") || line.starts_with("+++ ") || line.is_empty() {
            continue;
        }

        if let Some(hdr) = line.strip_prefix("@@ ") {
            // Parse: @@ -old_start[,old_count] +new_start[,new_count] @@ [optional context]
            if let Some(rest) = hdr.split(" @@").next() {
                let parts: Vec<&str> = rest.split(' ').collect();
                if parts.len() >= 2 {
                    let old_part = parts[0].strip_prefix('-').unwrap_or(parts[0]);
                    let new_part = parts[1].strip_prefix('+').unwrap_or(parts[1]);

                    let (old_start, old_count) = parse_hunk_header(old_part);
                    let (new_start, new_count) = parse_hunk_header(new_part);

                    // Finalize previous hunk
                    if let Some(hunk) = current_hunk.take() {
                        hunks.push(hunk);
                    }

                    current_hunk = Some(PatchHunk {
                        old_start,
                        old_count,
                        new_start,
                        new_count,
                        lines: Vec::new(),
                    });
                    continue;
                }
            }
            // Invalid hunk header
            return Err(AirisError::PatchFailed {
                line: line_num + 1,
                message: format!("Malformed hunk header: {line}"),
            });
        }

        // Add line to current hunk
        if let Some(ref mut hunk) = current_hunk {
            if let Some(text) = line.strip_prefix(' ') {
                hunk.lines.push(PatchLine::Context(text.to_string()));
            } else if let Some(text) = line.strip_prefix('-') {
                hunk.lines.push(PatchLine::Delete(text.to_string()));
            } else if let Some(text) = line.strip_prefix('+') {
                hunk.lines.push(PatchLine::Insert(text.to_string()));
            } else if line.starts_with("\\ ") {
                // No newline at end of file marker — ignore
                continue;
            } else {
                // Treat as context (lenient)
                hunk.lines.push(PatchLine::Context(line.to_string()));
            }
        } else {
            return Err(AirisError::PatchFailed {
                line: line_num + 1,
                message: format!("Line outside of any hunk: {line}"),
            });
        }
    }

    // Finalize last hunk
    if let Some(hunk) = current_hunk.take() {
        hunks.push(hunk);
    }

    Ok(hunks)
}

/// Parse an old/new hunk header part like `3` or `3,7`.
/// Returns `(start, count)` with count defaulting to 1.
fn parse_hunk_header(s: &str) -> (usize, usize) {
    if let Some((start, count)) = s.split_once(',') {
        (start.parse().unwrap_or(1), count.parse().unwrap_or(1))
    } else {
        (s.parse().unwrap_or(1), 1)
    }
}

// ─── Hunk Application ─────────────────────────────────────────────────────

/// Apply a sequence of parsed hunks to the file content.
///
/// Each hunk is applied sequentially, with positions shifting as
/// earlier hunks insert/remove lines.
fn apply_hunks(content: &str, hunks: &[PatchHunk]) -> Result<String, PatchError> {
    if hunks.is_empty() {
        return Ok(content.to_string());
    }

    // Work with an owned Vec<String> so we can freely mutate.
    let mut buf: Vec<String> = content.lines().map(String::from).collect();
    // Offset tracks the line-number shift from processed hunks.
    // Applied to `hunk.old_start` to compute position in the current buffer.
    let mut offset: isize = 0;

    for hunk in hunks {
        // Compute 0-based position in the current buffer.
        // `old_start` is 1-based; old_start=0 means "insert before line 1".
        let pos = if hunk.old_start == 0 {
            0usize
        } else if hunk.old_start == 1 && offset < 0 && buf.is_empty() {
            // File was empty and we're inserting the first content
            0usize
        } else {
            let raw = hunk.old_start as isize + offset - 1;
            if raw < 0 {
                return Err(PatchError {
                    line: hunk.old_start,
                    msg: format!(
                        "Hunk position overflow: old_start={}, offset={}",
                        hunk.old_start, offset
                    ),
                });
            }
            raw as usize
        };

        // Validate or discover the actual position via context matching.
        let actual_start = find_hunk_position(&buf, hunk, pos)?;

        // Build the post-hunk buffer.
        let mut next: Vec<String> = Vec::with_capacity(buf.len() + hunk.lines.len());
        // Copy lines before the hunk (drain removes them from `buf`).
        // After this, `buf` starts at what was `actual_start`.
        next.extend(buf.drain(..actual_start));

        // Process hunk lines. `buf` now begins at the hunk location.
        let mut file_idx = 0usize;
        for hl in &hunk.lines {
            match hl {
                PatchLine::Context(text) => {
                    // Consume one file line (should match; already validated).
                    if file_idx < buf.len() {
                        next.push(buf[file_idx].clone());
                        file_idx += 1;
                    } else {
                        // File shorter than expected — still keep context.
                        next.push(text.clone());
                    }
                }
                PatchLine::Delete(_) => {
                    // Skip one file line.
                    file_idx += 1;
                }
                PatchLine::Insert(text) => {
                    next.push(text.clone());
                }
            }
        }

        // Append remaining lines after the hunk.
        next.extend(buf.drain(file_idx..));

        // Update offset for subsequent hunks.
        let old_len = hunk.old_count;
        let new_len = compute_new_count(hunk);
        offset += new_len as isize - old_len as isize;

        buf = next;
    }

    Ok(buf.join("\n"))
}

/// Count the number of lines produced by the hunk (context + insert).
fn compute_new_count(hunk: &PatchHunk) -> usize {
    let mut count = 0;
    for line in &hunk.lines {
        match line {
            PatchLine::Context(_) | PatchLine::Insert(_) => count += 1,
            PatchLine::Delete(_) => {}
        }
    }
    count
}

/// Find the position in `buf` where `hunk` starts.
///
/// `expected` is a 0-based position estimate from the hunk header
/// (adjusted for offset from previous hunks). If the context lines
/// match at `expected`, it is used directly. Otherwise a bounded
/// forward/backward scan is performed.
///
/// For insertion-only hunks (old_count = 0), `expected` is returned
/// directly because there is no context to anchor against.
fn find_hunk_position(
    buf: &[String],
    hunk: &PatchHunk,
    expected: usize,
) -> Result<usize, PatchError> {
    // Insertion-only hunks (e.g. @@ -0,0 +1,N @@) — no context to match.
    if hunk.old_count == 0 {
        return Ok(expected.min(buf.len()));
    }

    // Locate the first context or deletion line to anchor matching.
    let anchor_idx = hunk
        .lines
        .iter()
        .position(|l| !matches!(l, PatchLine::Insert(_)))
        .ok_or_else(|| PatchError {
            line: hunk.old_start,
            msg: "Hunk has no context or deletion line".to_string(),
        })?;

    let anchor_text = match &hunk.lines[anchor_idx] {
        PatchLine::Context(t) | PatchLine::Delete(t) => t.as_str(),
        _ => unreachable!(),
    };

    // Try the expected position first (fast path).
    if expected < buf.len() && buf[expected] == anchor_text {
        if verify_hunk_at(buf, hunk, expected) {
            return Ok(expected);
        }
    }

    // Bounded forward scan.
    let limit = (expected + 50).min(buf.len());
    for pos in expected..limit {
        if buf[pos] == anchor_text && verify_hunk_at(buf, hunk, pos) {
            return Ok(pos);
        }
    }

    // Bounded backward scan.
    let lower = expected.saturating_sub(50);
    for pos in (lower..expected).rev() {
        if pos < buf.len() && buf[pos] == anchor_text && verify_hunk_at(buf, hunk, pos) {
            return Ok(pos);
        }
    }

    Err(PatchError {
        line: hunk.old_start,
        msg: format!(
            "Could not find hunk context starting at line {}",
            hunk.old_start
        ),
    })
}

/// Verify that the hunk's context/deletion lines match the buffer at `pos`.
fn verify_hunk_at(buf: &[String], hunk: &PatchHunk, pos: usize) -> bool {
    let mut file_pos = pos;
    for hl in &hunk.lines {
        match hl {
            PatchLine::Context(text) | PatchLine::Delete(text) => {
                if file_pos >= buf.len() || buf[file_pos] != *text {
                    return false;
                }
                file_pos += 1;
            }
            PatchLine::Insert(_) => {
                // Insertions do not consume file lines.
            }
        }
    }
    true
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    // ─── Fuzzy Matching ───────────────────────────────────────────────────

    #[test]
    fn test_exact_match() {
        let content = "Hello, world!";
        let result = find_and_replace_fuzzy(content, "world", "Rust").unwrap();
        assert_eq!(result, "Hello, Rust!");
    }

    #[test]
    fn test_no_match() {
        let content = "Hello, world!";
        assert!(find_and_replace_fuzzy(content, "foo", "bar").is_none());
    }

    #[test]
    fn test_whitespace_normalized_match() {
        let content = "fn  hello(x:   i32)   ->   bool";
        let result = find_and_replace_fuzzy(content, "fn hello(x: i32) -> bool", "fn goodbye()")
            .unwrap();
        assert_eq!(result, "fn goodbye()");
    }

    #[test]
    fn test_multiline_fuzzy_match() {
        let content = "line1\n\nline2\n  \nline3";
        let result = find_and_replace_fuzzy(content, "line2\nline3", "replaced").unwrap();
        assert_eq!(result, "line1\n\nreplaced");
    }

    #[test]
    fn test_normalize_whitespace() {
        assert_eq!(normalize_whitespace("  hello   world  "), "hello world");
        assert_eq!(normalize_whitespace("\n\t\rhello"), "hello");
        assert_eq!(normalize_whitespace(""), "");
        assert_eq!(normalize_whitespace("   "), "");
    }

    #[test]
    fn test_multiple_occurrences() {
        let content = "a b a b a";
        // Should match first occurrence
        let result = find_and_replace_fuzzy(content, "a b", "X").unwrap();
        assert_eq!(result, "X a b a");
    }

    // ─── Unified Diff Parsing ─────────────────────────────────────────────

    #[test]
    fn test_parse_simple_unified_diff() {
        let diff = "\
--- a/old.txt
+++ b/new.txt
@@ -1,3 +1,4 @@
 a
-b
+c
 d
";
        let hunks = parse_unified_diff(diff).unwrap();
        assert_eq!(hunks.len(), 1);
        assert_eq!(hunks[0].old_start, 1);
        assert_eq!(hunks[0].old_count, 3);
        assert_eq!(hunks[0].new_start, 1);
        assert_eq!(hunks[0].new_count, 4);
        assert_eq!(hunks[0].lines.len(), 4);
    }

    #[test]
    fn test_parse_multi_hunk_diff() {
        let diff = "\
--- a/file
+++ b/file
@@ -1,2 +1,2 @@
 a
-b
+c
@@ -5,2 +5,2 @@
 d
-e
+f
";
        let hunks = parse_unified_diff(diff).unwrap();
        assert_eq!(hunks.len(), 2);
    }

    #[test]
    fn test_parse_diff_without_counts() {
        let diff = "\
@@ -1 +1 @@
-old
+new
";
        let hunks = parse_unified_diff(diff).unwrap();
        assert_eq!(hunks.len(), 1);
        assert_eq!(hunks[0].old_count, 1);
        assert_eq!(hunks[0].new_count, 1);
    }

    #[test]
    fn test_parse_empty_diff() {
        let hunks = parse_unified_diff("").unwrap();
        assert!(hunks.is_empty());
    }

    #[test]
    fn test_parse_malformed_header() {
        let diff = "\
@@ -bad @@
";
        assert!(parse_unified_diff(diff).is_err());
    }

    // ─── Hunk Application ─────────────────────────────────────────────────

    #[test]
    fn test_apply_simple_patch() {
        let content = "a\nb\nc\nd\ne\n";
        let hunks = vec![PatchHunk {
            old_start: 2,
            old_count: 2,
            new_start: 2,
            new_count: 2,
            lines: vec![
                PatchLine::Context("a".to_string()),
                PatchLine::Delete("b".to_string()),
                PatchLine::Insert("x".to_string()),
                PatchLine::Context("c".to_string()),
            ],
        }];
        let result = apply_hunks(content, &hunks).unwrap();
        assert_eq!(result, "a\nx\nc\nd\ne\n");
    }

    #[test]
    fn test_apply_insertion_patch() {
        let content = "a\nb\n";
        let hunks = vec![PatchHunk {
            old_start: 2,
            old_count: 1,
            new_start: 2,
            new_count: 2,
            lines: vec![
                PatchLine::Context("a".to_string()),
                PatchLine::Context("b".to_string()),
                PatchLine::Insert("c".to_string()),
            ],
        }];
        let result = apply_hunks(content, &hunks).unwrap();
        assert_eq!(result, "a\nb\nc\n");
    }

    #[test]
    fn test_apply_deletion_patch() {
        let content = "a\nb\nc\n";
        let hunks = vec![PatchHunk {
            old_start: 2,
            old_count: 2,
            new_start: 2,
            new_count: 1,
            lines: vec![
                PatchLine::Context("a".to_string()),
                PatchLine::Delete("b".to_string()),
                PatchLine::Context("c".to_string()),
            ],
        }];
        let result = apply_hunks(content, &hunks).unwrap();
        assert_eq!(result, "a\nc\n");
    }

    #[test]
    fn test_apply_empty_content() {
        let content = "";
        let hunks = vec![PatchHunk {
            old_start: 1,
            old_count: 1,
            new_start: 1,
            new_count: 1,
            lines: vec![PatchLine::Insert("new line".to_string())],
        }];
        let result = apply_hunks(content, &hunks).unwrap();
        assert_eq!(result, "new line\n");
    }

    #[test]
    fn test_apply_multiple_hunks() {
        let content = "a\nb\nc\nd\ne\nf\n";
        let hunks = vec![
            PatchHunk {
                old_start: 1,
                old_count: 2,
                new_start: 1,
                new_count: 2,
                lines: vec![
                    PatchLine::Delete("a".to_string()),
                    PatchLine::Insert("x".to_string()),
                    PatchLine::Context("b".to_string()),
                ],
            },
            PatchHunk {
                old_start: 5,
                old_count: 2,
                new_start: 5,
                new_count: 2,
                lines: vec![
                    PatchLine::Context("e".to_string()),
                    PatchLine::Delete("f".to_string()),
                    PatchLine::Insert("z".to_string()),
                ],
            },
        ];
        let result = apply_hunks(content, &hunks).unwrap();
        assert_eq!(result, "x\nb\nc\nd\ne\nz\n");
    }

    #[test]
    fn test_verify_hunk_at() {
        let lines = vec!["a", "b", "c"];
        let hunk = PatchHunk {
            old_start: 1,
            old_count: 3,
            new_start: 1,
            new_count: 3,
            lines: vec![
                PatchLine::Context("a".to_string()),
                PatchLine::Delete("b".to_string()),
                PatchLine::Context("c".to_string()),
            ],
        };
        assert!(verify_hunk_at(&lines, &hunk, 0));
        assert!(!verify_hunk_at(&lines, &hunk, 1));
    }

    #[test]
    fn test_compute_new_count() {
        let hunk = PatchHunk {
            old_start: 1,
            old_count: 3,
            new_start: 1,
            new_count: 4,
            lines: vec![
                PatchLine::Context("a".to_string()),
                PatchLine::Delete("b".to_string()),
                PatchLine::Insert("x".to_string()),
                PatchLine::Insert("y".to_string()),
                PatchLine::Context("c".to_string()),
            ],
        };
        assert_eq!(compute_new_count(&hunk), 4);
    }

    #[test]
    fn test_parse_hunk_header() {
        assert_eq!(parse_hunk_header("3"), (3, 1));
        assert_eq!(parse_hunk_header("3,7"), (3, 7));
        assert_eq!(parse_hunk_header("0,0"), (0, 0));
        assert_eq!(parse_hunk_header("abc"), (1, 1));
    }

    // ─── Editor File Operations ──────────────────────────────────────────

    fn temp_dir() -> PathBuf {
        std::env::temp_dir().join(format!("airis_editor_test_{}", uuid::Uuid::new_v4()))
    }

    #[tokio::test]
    async fn test_create_and_read_file() {
        let dir = temp_dir();
        let path = dir.join("test.txt");
        let editor = EditorImpl::new();

        editor.create_file(&path, "hello").await.unwrap();
        let content = editor.read(&path).await.unwrap();
        assert_eq!(content, "hello");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_write_and_read_file() {
        let dir = temp_dir();
        let path = dir.join("test.txt");
        let editor = EditorImpl::new();

        editor.write(&path, "hello").await.unwrap();
        let content = editor.read(&path).await.unwrap();
        assert_eq!(content, "hello");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_edit_file() {
        let dir = temp_dir();
        let path = dir.join("edit_test.txt");
        std::fs::write(&path, "Hello, world!").unwrap();

        let editor = EditorImpl::new();
        let file_edit = FileEdit {
            file_path: path.clone(),
            old_text: "world".to_string(),
            new_text: "Rust".to_string(),
            start_line: 0,
            end_line: 0,
        };

        editor.edit(&file_edit).await.unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content, "Hello, Rust!");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_edit_not_found() {
        let dir = temp_dir();
        let path = dir.join("edit_test.txt");
        std::fs::write(&path, "Hello, world!").unwrap();

        let editor = EditorImpl::new();
        let file_edit = FileEdit {
            file_path: path.clone(),
            old_text: "nonexistent".to_string(),
            new_text: "replacement".to_string(),
            start_line: 0,
            end_line: 0,
        };

        assert!(editor.edit(&file_edit).await.is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_undo_restores_content() {
        let dir = temp_dir();
        let path = dir.join("undo_test.txt");
        std::fs::write(&path, "original").unwrap();

        let editor = EditorImpl::new();
        editor.write(&path, "modified").await.unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "modified");

        let entry = editor.undo().await.unwrap();
        assert_eq!(entry.original_content, "original");
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "original");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_undo_empty() {
        let editor = EditorImpl::new();
        assert!(editor.undo().await.is_err());
    }

    #[tokio::test]
    async fn test_undo_history() {
        let dir = temp_dir();
        let path = dir.join("history_test.txt");
        let editor = EditorImpl::new();

        editor.write(&path, "v1").await.unwrap();
        editor.write(&path, "v2").await.unwrap();

        let history = editor.undo_history().await.unwrap();
        assert_eq!(history.len(), 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_undo_history_bounded() {
        let dir = temp_dir();
        let path = dir.join("bounded_test.txt");
        let editor = EditorImpl::new();

        // Push more than UNDO_LIMIT entries
        for i in 0..UNDO_LIMIT + 10 {
            editor.write(&path, format!("v{i}")).await.unwrap();
        }

        let history = editor.undo_history().await.unwrap();
        assert_eq!(history.len(), UNDO_LIMIT);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_read_range() {
        let dir = temp_dir();
        let path = dir.join("range_test.txt");
        std::fs::write(&path, "a\nb\nc\nd\ne\n").unwrap();

        let editor = EditorImpl::new();
        let result = editor.read_range(&path, 2, 4).await.unwrap();
        assert_eq!(result, "b\nc\nd");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_read_range_invalid() {
        let dir = temp_dir();
        let path = dir.join("range_invalid.txt");
        std::fs::write(&path, "a\nb\nc\n").unwrap();

        let editor = EditorImpl::new();
        assert!(editor.read_range(&path, 0, 3).await.is_err());
        assert!(editor.read_range(&path, 5, 10).await.is_err());
        assert!(editor.read_range(&path, 3, 1).await.is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_create_existing_file_fails() {
        let dir = temp_dir();
        let path = dir.join("existing.txt");
        std::fs::write(&path, "existing").unwrap();

        let editor = EditorImpl::new();
        assert!(editor.create_file(&path, "new content").await.is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_delete_file() {
        let dir = temp_dir();
        let path = dir.join("delete_test.txt");
        std::fs::write(&path, "to be deleted").unwrap();

        let editor = EditorImpl::new();
        editor.delete_file(&path).await.unwrap();
        assert!(!path.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_delete_nonexistent_file() {
        let dir = temp_dir();
        let path = dir.join("nonexistent.txt");

        let editor = EditorImpl::new();
        assert!(editor.delete_file(&path).await.is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_workspace_rejects_outside_paths() {
        let dir = temp_dir();
        let workspace = dir.join("workspace");
        let outside = dir.join("outside");
        std::fs::create_dir_all(&workspace).unwrap();

        let editor = EditorImpl::with_workspace(workspace.clone());
        assert!(editor.read(&outside).await.is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_workspace_allows_inside_paths() {
        let dir = temp_dir();
        let workspace = dir.join("workspace");
        std::fs::create_dir_all(&workspace).unwrap();
        let inside = workspace.join("inside.txt");
        std::fs::write(&inside, "hello").unwrap();

        let editor = EditorImpl::with_workspace(workspace.clone());
        let content = editor.read(&inside).await.unwrap();
        assert_eq!(content, "hello");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_diff_generation() {
        let dir = temp_dir();
        let path = dir.join("diff_test.txt");
        std::fs::write(&path, "a\nb\nc\n").unwrap();

        let editor = EditorImpl::new();
        editor.write(&path, "a\nx\nc\n").await.unwrap();

        let diff = editor.diff(&path).await.unwrap();
        assert!(diff.contains("-b"));
        assert!(diff.contains("+x"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_diff_no_changes() {
        let dir = temp_dir();
        let path = dir.join("nodiff.txt");
        let editor = EditorImpl::new();

        editor.write(&path, "unchanged").await.unwrap();
        // Overwrite with same content (snapshot is only stored once)
        editor.write(&path, "unchanged").await.unwrap();

        let diff = editor.diff(&path).await.unwrap();
        assert_eq!(diff, "");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_delete_undo_restores_file() {
        let dir = temp_dir();
        let path = dir.join("delete_undo.txt");
        std::fs::write(&path, "content to restore").unwrap();

        let editor = EditorImpl::new();
        editor.delete_file(&path).await.unwrap();
        assert!(!path.exists());

        let entry = editor.undo().await.unwrap();
        assert!(path.exists());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "content to restore");
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ─── Patch Application ────────────────────────────────────────────────

    #[tokio::test]
    async fn test_apply_unified_diff() {
        let dir = temp_dir();
        let path = dir.join("patch_test.txt");
        std::fs::write(&path, "a\nb\nc\n").unwrap();

        let patch = "\
--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 a
-b
+x
 c
";
        let editor = EditorImpl::new();
        editor.apply_patch(&path, patch).await.unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content, "a\nx\nc\n");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_apply_patch_with_multiple_hunks() {
        let dir = temp_dir();
        let path = dir.join("multi_patch.txt");
        std::fs::write(&path, "a\nb\nc\nd\ne\nf\n").unwrap();

        let patch = "\
--- a/file
+++ b/file
@@ -1,2 +1,2 @@
 a
-b
+x
@@ -5,2 +5,2 @@
 e
-f
+y
";
        let editor = EditorImpl::new();
        editor.apply_patch(&path, patch).await.unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content, "a\nx\nc\nd\ne\ny\n");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_apply_patch_inserts_content() {
        let dir = temp_dir();
        let path = dir.join("insert_patch.txt");
        std::fs::write(&path, "a\nc\n").unwrap();

        let patch = "\
--- a/file
+++ b/file
@@ -1,2 +1,3 @@
 a
+b
 c
";
        let editor = EditorImpl::new();
        editor.apply_patch(&path, patch).await.unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content, "a\nb\nc\n");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_apply_patch_deletes_content() {
        let dir = temp_dir();
        let path = dir.join("delete_patch.txt");
        std::fs::write(&path, "a\nb\nc\n").unwrap();

        let patch = "\
--- a/file
+++ b/file
@@ -1,3 +1,2 @@
 a
-b
 c
";
        let editor = EditorImpl::new();
        editor.apply_patch(&path, patch).await.unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content, "a\nc\n");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_apply_invalid_patch() {
        let dir = temp_dir();
        let path = dir.join("invalid_patch.txt");
        std::fs::write(&path, "a\nb\nc\n").unwrap();

        let editor = EditorImpl::new();
        let result = editor.apply_patch(&path, "not a patch at all").await;
        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ─── Default ──────────────────────────────────────────────────────────

    #[test]
    fn test_default_impl() {
        let editor = EditorImpl::default();
        assert!(editor.workspace_root.is_none());
    }

    #[test]
    fn test_with_workspace() {
        let root = PathBuf::from("/tmp/test_workspace");
        let editor = EditorImpl::with_workspace(root.clone());
        assert_eq!(editor.workspace_root, Some(root));
    }

    #[test]
    fn test_set_clear_workspace() {
        let mut editor = EditorImpl::new();
        assert!(editor.workspace_root.is_none());

        editor.set_workspace(PathBuf::from("/tmp/ws"));
        assert_eq!(editor.workspace_root, Some(PathBuf::from("/tmp/ws")));

        editor.clear_workspace();
        assert!(editor.workspace_root.is_none());
    }

    #[test]
    fn test_resolve_path() {
        let editor = EditorImpl::new();
        assert_eq!(
            editor.resolve_path(Path::new("relative.txt")),
            PathBuf::from("relative.txt")
        );

        let ws_editor = EditorImpl::with_workspace(PathBuf::from("/workspace"));
        assert_eq!(
            ws_editor.resolve_path(Path::new("relative.txt")),
            PathBuf::from("/workspace/relative.txt")
        );

        assert_eq!(
            ws_editor.resolve_path(Path::new("/absolute/path.txt")),
            PathBuf::from("/absolute/path.txt")
        );
    }
}
