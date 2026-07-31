//! Terminal command execution for AIRIS-CLI.
//!
//! Provides a cross-platform [`Terminal`] trait implementation using
//! `tokio::process::Command` for async subprocess management.
//!
//! # Platform support
//! - **Linux / macOS / Android Termux**: uses `sh -c`
//! - **Windows**: uses `cmd.exe /C`
//!
//! Command availability checking uses `command -v` on POSIX systems
//! and `where` on Windows.

use airis_core::prelude::*;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncReadExt};
use tokio::process::Command;

/// Default implementation of the [`Terminal`] trait.
///
/// Executes shell commands asynchronously with:
/// - Optional timeout with automatic child process kill
/// - Configurable working directory
/// - Captured or streaming stdout/stderr
/// - Cross-platform shell selection
#[derive(Debug, Clone)]
pub struct TerminalImpl {
    /// Default working directory for command execution.
    cwd: Option<PathBuf>,
}

impl TerminalImpl {
    /// Create a new terminal with an optional default working directory.
    ///
    /// When `cwd` is `Some`, commands will run relative to this directory
    /// unless a per-command `cwd` override is provided.
    pub fn new(cwd: Option<PathBuf>) -> Self {
        Self { cwd }
    }

    /// Return the (shell, flag) tuple for the current platform.
    #[inline]
    fn shell_info() -> (&'static str, &'static str) {
        if cfg!(target_os = "windows") {
            ("cmd.exe", "/C")
        } else {
            ("sh", "-c")
        }
    }

    /// Build a [`Command`] for the given command string, resolving
    /// the working directory from the per-command `cwd` first, falling
    /// back to the default `cwd` configured on `self`.
    fn build_command(command: &str, cwd: Option<&Path>, default_cwd: Option<&Path>) -> Command {
        let (shell, flag) = Self::shell_info();
        let mut cmd = Command::new(shell);
        cmd.arg(flag).arg(command);
        if let Some(dir) = cwd.or(default_cwd) {
            cmd.current_dir(dir);
        }
        cmd
    }
}

impl Default for TerminalImpl {
    fn default() -> Self {
        Self::new(None)
    }
}

#[async_trait]
impl Terminal for TerminalImpl {
    async fn execute(
        &self,
        command: &str,
        cwd: Option<&Path>,
        timeout_secs: Option<u64>,
    ) -> AirisResult<TerminalOutput> {
        let start = Instant::now();

        let mut cmd = Self::build_command(command, cwd, self.cwd.as_deref());
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            AirisError::Terminal(format!("Failed to spawn command: {e}"))
        })?;

        // Read stdout and stderr concurrently in background tasks.
        // We use read_to_end + from_utf8_lossy to gracefully handle
        // non-UTF-8 output (e.g. binary data in terminal responses).
        let stdout_task = child.stdout.take().map(|out| {
            tokio::spawn(async move {
                let mut buf = Vec::new();
                let _ = AsyncReadExt::read_to_end(out, &mut buf).await;
                String::from_utf8_lossy(&buf).into_owned()
            })
        });

        let stderr_task = child.stderr.take().map(|err| {
            tokio::spawn(async move {
                let mut buf = Vec::new();
                let _ = AsyncReadExt::read_to_end(err, &mut buf).await;
                String::from_utf8_lossy(&buf).into_owned()
            })
        });

        let exit_code = if let Some(secs) = timeout_secs {
            let dur = Duration::from_secs(secs);
            match tokio::time::timeout(dur, child.wait()).await {
                Ok(Ok(status)) => status.code().unwrap_or(-1),
                Ok(Err(e)) => {
                    return Err(AirisError::Terminal(format!(
                        "Command execution error: {e}"
                    )));
                }
                Err(_elapsed) => {
                    // Timed out — kill the child process and reap it
                    // so we don't leave zombies.
                    let _ = child.kill().await;
                    let _ = child.wait().await;

                    let stdout = stdout_task
                        .map(|h| h.await.unwrap_or_default())
                        .unwrap_or_default();
                    let stderr = stderr_task
                        .map(|h| h.await.unwrap_or_default())
                        .unwrap_or_default();

                    return Ok(TerminalOutput {
                        exit_code: -1,
                        stdout,
                        stderr,
                        duration_ms: start.elapsed().as_millis() as u64,
                        timed_out: true,
                    });
                }
            }
        } else {
            child
                .wait()
                .await
                .map_err(|e| AirisError::Terminal(format!("Command execution error: {e}")))?
                .code()
                .unwrap_or(-1)
        };

        let stdout = stdout_task
            .map(|h| h.await.unwrap_or_default())
            .unwrap_or_default();
        let stderr = stderr_task
            .map(|h| h.await.unwrap_or_default())
            .unwrap_or_default();

        Ok(TerminalOutput {
            exit_code,
            stdout,
            stderr,
            duration_ms: start.elapsed().as_millis() as u64,
            timed_out: false,
        })
    }

    async fn execute_stream(
        &self,
        command: &str,
        cwd: Option<&Path>,
        on_stdout: Box<dyn Fn(&str) + Send>,
        on_stderr: Box<dyn Fn(&str) + Send>,
    ) -> AirisResult<i32> {
        let mut cmd = Self::build_command(command, cwd, self.cwd.as_deref());
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            AirisError::Terminal(format!("Failed to spawn command: {e}"))
        })?;

        // Stream stdout line by line.
        let stdout_task = if let Some(out) = child.stdout.take() {
            tokio::spawn(async move {
                let reader = tokio::io::BufReader::new(out);
                let mut lines = AsyncBufReadExt::lines(reader);
                while let Ok(Some(line)) = lines.next_line().await {
                    on_stdout(&line);
                }
            })
        } else {
            tokio::spawn(async {})
        };

        // Stream stderr line by line.
        let stderr_task = if let Some(err) = child.stderr.take() {
            tokio::spawn(async move {
                let reader = tokio::io::BufReader::new(err);
                let mut lines = AsyncBufReadExt::lines(reader);
                while let Ok(Some(line)) = lines.next_line().await {
                    on_stderr(&line);
                }
            })
        } else {
            tokio::spawn(async {})
        };

        let status = child
            .wait()
            .await
            .map_err(|e| AirisError::Terminal(format!("Command execution error: {e}")))?;

        // Wait for readers to finish draining any buffered output.
        let _ = stdout_task.await;
        let _ = stderr_task.await;

        Ok(status.code().unwrap_or(-1))
    }

    async fn which(&self, command: &str) -> AirisResult<bool> {
        let (shell, flag) = Self::shell_info();

        let check_cmd = if cfg!(target_os = "windows") {
            // `where` is the Windows equivalent of `which`
            format!("where {command}")
        } else {
            // POSIX `command -v` is more portable than the `which` binary
            // because it's built into the shell itself.
            format!("command -v {command}")
        };

        let status = Command::new(shell)
            .arg(flag)
            .arg(&check_cmd)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .await
            .map_err(|e| {
                AirisError::Terminal(format!("Failed to check command availability: {e}"))
            })?;

        Ok(status.success())
    }

    async fn cwd(&self) -> AirisResult<String> {
        let path = std::env::current_dir()?;
        Ok(path.to_string_lossy().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
        use std::sync::Arc;
    use parking_lot::Mutex;

    #[tokio::test]
    async fn test_execute_simple() {
        let term = TerminalImpl::default();
        let result = term.execute("echo hello", None, None).await.unwrap();
        assert_eq!(result.exit_code, 0);
        assert_eq!(result.stdout.trim(), "hello");
        assert!(!result.timed_out);
    }

    #[tokio::test]
    async fn test_execute_with_cwd() {
        let term = TerminalImpl::default();
        let result = term.execute("pwd", Some(Path::new("/")), None).await.unwrap();
        assert_eq!(result.exit_code, 0);
        assert_eq!(result.stdout.trim(), "/");
    }

    #[tokio::test]
    async fn test_execute_stderr() {
        let term = TerminalImpl::default();
        let result = term.execute("echo stderr_msg >&2", None, None)
            .await
            .unwrap();
        assert_eq!(result.exit_code, 0);
        assert!(result.stderr.contains("stderr_msg"));
    }

    #[tokio::test]
    async fn test_execute_timeout() {
        let term = TerminalImpl::default();
        let result = term.execute("sleep 10", None, Some(1)).await.unwrap();
        assert!(result.timed_out);
        assert_eq!(result.exit_code, -1);
    }

    #[tokio::test]
    async fn test_execute_non_zero_exit() {
        let term = TerminalImpl::default();
        let result = term.execute("exit 42", None, None).await.unwrap();
        assert_eq!(result.exit_code, 42);
        assert!(!result.timed_out);
    }

    #[tokio::test]
    async fn test_which_found() {
        let term = TerminalImpl::default();
        assert!(term.which("echo").await.unwrap());
        assert!(term.which("sh").await.unwrap());
    }

    #[tokio::test]
    async fn test_which_not_found() {
        let term = TerminalImpl::default();
        assert!(
            !term
                .which("this_command_does_not_exist_xyz_12345")
                .await
                .unwrap()
        );
    }

    #[tokio::test]
    async fn test_cwd() {
        let term = TerminalImpl::default();
        let cwd = term.cwd().await.unwrap();
        assert!(!cwd.is_empty());
        let actual = std::env::current_dir().unwrap();
        assert_eq!(cwd, actual.to_string_lossy().to_string());
    }

    #[tokio::test]
    async fn test_execute_stream() {
        let term = TerminalImpl::default();
        let stdout_output: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
        let stderr_output: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));

        let so = stdout_output.clone();
        let se = stderr_output.clone();

        let exit_code = term
            .execute_stream(
                "echo hello_stream",
                None,
                Box::new(move |line| {
                    let mut s = so.lock();
                    s.push_str(line);
                    s.push('\n');
                }),
                Box::new(move |line| {
                    let mut s = se.lock();
                    s.push_str(line);
                    s.push('\n');
                }),
            )
            .await
            .unwrap();

        assert_eq!(exit_code, 0);
        let stdout = stdout_output.lock();
        assert!(stdout.contains("hello_stream"));
    }

    #[tokio::test]
    async fn test_utf8_lossy_handling() {
        let term = TerminalImpl::default();
        // Commands that produce valid text should still work.
        let result = term
            .execute("printf 'hello\\nworld'", None, None)
            .await
            .unwrap();
        assert_eq!(result.exit_code, 0);
        assert!(result.stdout.contains("hello"));
    }
}
