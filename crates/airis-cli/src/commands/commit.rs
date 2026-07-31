//! `airis commit` — Generate commit messages and commit.

use airis_core::prelude::*;
use tracing::info;

/// Execute the commit command.
pub async fn execute(
    message: &Option<String>,
    files: &[String],
    auto_yes: bool,
    config: &airis_config::ConfigManager,
    agent: &airis_agent::AgentImpl,
    git: &airis_git::GitImpl,
) -> AirisResult<()> {
    let cwd = std::env::current_dir().map_err(AirisError::Io)?;

    // Check if in a git repo
    if !git.is_repo(&cwd).await? {
        return Err(AirisError::NotGitRepo);
    }

    // Stage files if specified
    if !files.is_empty() {
        let paths: Vec<PathBuf> = files.iter().map(PathBuf::from).collect();
        git.add(&cwd, &paths).await?;
        info!("Staged {} files", files.len());
    }

    let commit_message = match message {
        Some(msg) => msg.clone(),
        None => {
            // Generate commit message from diff
            let diff = git.staged_diff(&cwd).await?;
            if diff.is_empty() {
                // Try unstaged if nothing staged
                let unstaged = git.unstaged_diff(&cwd).await?;
                if unstaged.is_empty() {
                    return Err(AirisError::Git("No changes to commit".into()));
                }
            }

            let result = agent
                .run(
                    &format!(
                        "Generate a concise, conventional git commit message for:\n\n```diff\n{}\n```\n\nRespond with ONLY the commit message, no explanation.",
                        diff
                    ),
                    AgentContext::default(),
                )
                .await?;

            result.output.trim().to_string()
        }
    };

    println!("Commit message:");
    println!("---\n{}\n---", commit_message);

    if auto_yes || confirm("Proceed with commit?") {
        git.commit(&cwd, &commit_message).await?;
        println!("Committed successfully.");
    } else {
        println!("Commit aborted.");
    }

    Ok(())
}

fn confirm(prompt: &str) -> bool {
    println!("{} (y/N)", prompt);
    let mut input = String::new();
    std::io::stdin()
        .read_line(&mut input)
        .ok();
    input.trim().eq_ignore_ascii_case("y") || input.trim().eq_ignore_ascii_case("yes")
}
