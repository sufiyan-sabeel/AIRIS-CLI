//! Tool implementations for the AIRIS-CLI agent system.
//!
//! This crate provides concrete [`Tool`] implementations for agent-accessible
//! operations (read, write, edit, bash, glob, grep, web_search) and the
//! [`ToolRegistryImpl`] for managing them.

use airis_core::prelude::*;
use async_trait::async_trait;
use globset::{Glob, GlobSetBuilder};
use ignore::WalkBuilder;
use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use parking_lot::RwLock;
use std::time::Instant;
use tokio::process::Command;
use tokio::time::{timeout, Duration};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Helper: ArcTool wrapper — lets ToolRegistryImpl clone an Arc<dyn Tool>
// into a Box<dyn Tool> without requiring `Clone` on the trait object.
// ---------------------------------------------------------------------------

struct ArcTool(Arc<dyn Tool>);

#[async_trait]
impl Tool for ArcTool {
    fn name(&self) -> &str {
        self.0.name()
    }

    fn description(&self) -> &str {
        self.0.description()
    }

    fn parameters(&self) -> Value {
        self.0.parameters()
    }

    async fn execute(&self, args: Value) -> AirisResult<ToolResult> {
        self.0.execute(args).await
    }
}

// ---------------------------------------------------------------------------
// ToolRegistryImpl
// ---------------------------------------------------------------------------

/// In-memory [`ToolRegistry`] that stores tools behind `Arc<dyn Tool>`.
///
/// Thread‑safe interior mutability via `RwLock`.
pub struct ToolRegistryImpl {
    tools: RwLock<HashMap<String, Arc<dyn Tool>>>,
}

impl ToolRegistryImpl {
    /// Create an empty registry.
    pub fn new() -> Self {
        Self {
            tools: RwLock::new(HashMap::new()),
        }
    }
}

impl Default for ToolRegistryImpl {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ToolRegistry for ToolRegistryImpl {
    fn register(&self, tool: Box<dyn Tool>) {
        let name = tool.name().to_string();
        self.tools.write().insert(name, Arc::from(tool));
    }

    fn get(&self, name: &str) -> Option<Box<dyn Tool>> {
        self.tools
            .read()
            .get(name)
            .map(|arc| Box::new(ArcTool(arc.clone())) as Box<dyn Tool>)
    }

    fn definitions(&self) -> Vec<ToolDefinition> {
        self.tools
            .read()
            .values()
            .map(|t| {
                let params = t.parameters();
                ToolDefinition {
                    name: t.name().to_string(),
                    description: t.description().to_string(),
                    parameters: params.clone(),
                    required: params
                        .get("required")
                        .and_then(|v| v.as_array())
                        .map(|a| {
                            a.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default(),
                }
            })
            .collect()
    }

    fn names(&self) -> Vec<String> {
        self.tools.read().keys().cloned().collect()
    }
}

// ---------------------------------------------------------------------------
// Helper: extract a required string parameter
// ---------------------------------------------------------------------------

fn req_str(args: &Value, key: &str) -> AirisResult<String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            AirisError::ToolExecution(format!("missing required argument '{}'", key))
        })
}

fn opt_str<'a>(args: &'a Value, key: &'a str) -> Option<&'a str> {
    args.get(key).and_then(|v| v.as_str())
}

fn opt_u64(args: &Value, key: &str) -> Option<u64> {
    args.get(key).and_then(|v| {
        v.as_u64()
            .or_else(|| v.as_i64().and_then(|i| u64::try_from(i).ok()))
    })
}

fn opt_bool(args: &Value, key: &str, default: bool) -> bool {
    args.get(key)
        .and_then(|v| v.as_bool())
        .unwrap_or(default)
}

// ---------------------------------------------------------------------------
// Helper: build a ToolResult
// ---------------------------------------------------------------------------

fn ok_result(tool_name: &str, output: String, duration: Duration) -> ToolResult {
    ToolResult {
        tool_name: tool_name.to_string(),
        call_id: Uuid::new_v4().to_string(),
        success: true,
        output,
        error: None,
        duration_ms: duration.as_millis() as u64,
    }
}

fn err_result(tool_name: &str, error: String, duration: Duration) -> ToolResult {
    ToolResult {
        tool_name: tool_name.to_string(),
        call_id: Uuid::new_v4().to_string(),
        success: false,
        output: String::new(),
        error: Some(error),
        duration_ms: duration.as_millis() as u64,
    }
}

// ===========================================================================
// ReadTool
// ===========================================================================

/// Read the contents of a file at the given path.
///
/// Optionally accepts `offset` (1‑based start line) and `limit` (max lines)
/// to read a range of the file.
pub struct ReadTool;

#[async_trait]
impl Tool for ReadTool {
    fn name(&self) -> &str {
        "read"
    }

    fn description(&self) -> &str {
        "Read the contents of a file. Supports optional line range with `offset` and `limit`."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file to read"
                },
                "offset": {
                    "type": "integer",
                    "description": "Starting line number (1-indexed)",
                    "minimum": 1
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of lines to return",
                    "minimum": 1
                }
            },
            "required": ["path"]
        })
    }

    async fn execute(&self, args: Value) -> AirisResult<ToolResult> {
        let start = Instant::now();
        let path = req_str(&args, "path")?;

        let content = match tokio::fs::read_to_string(&path).await {
            Ok(c) => c,
            Err(e) => {
                return Ok(err_result(
                    self.name(),
                    format!("failed to read '{}': {}", path, e),
                    start.elapsed(),
                ));
            }
        };

        let offset = opt_u64(&args, "offset").unwrap_or(1).max(1) as usize;
        let limit = opt_u64(&args, "limit").map(|l| l as usize);

        let output = if let Some(max_lines) = limit {
            let lines: Vec<&str> = content.lines().skip(offset.saturating_sub(1)).take(max_lines).collect();
            if lines.is_empty() {
                format!("(no lines in range {}..{})", offset, offset + max_lines)
            } else {
                let mut out = String::new();
                for (i, line) in lines.iter().enumerate() {
                    out.push_str(&format!("{:>6} | {}\n", offset + i, line));
                }
                out
            }
        } else {
            content
        };

        Ok(ok_result(self.name(), output, start.elapsed()))
    }
}

// ===========================================================================
// WriteTool
// ===========================================================================

/// Write content to a file, creating parent directories if needed.
///
/// If the file already exists it will be **overwritten**.
pub struct WriteTool;

#[async_trait]
impl Tool for WriteTool {
    fn name(&self) -> &str {
        "write"
    }

    fn description(&self) -> &str {
        "Write content to a file, creating parent directories if necessary. Overwrites existing files."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file to write"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write to the file"
                }
            },
            "required": ["path", "content"]
        })
    }

    async fn execute(&self, args: Value) -> AirisResult<ToolResult> {
        let start = Instant::now();
        let path = req_str(&args, "path")?;
        let content = req_str(&args, "content")?;

        // Create parent directories
        if let Some(parent) = Path::new(&path).parent() {
            if !parent.as_os_str().is_empty() {
                if let Err(e) = tokio::fs::create_dir_all(parent).await {
                    return Ok(err_result(
                        self.name(),
                        format!("failed to create parent directories for '{}': {}", path, e),
                        start.elapsed(),
                    ));
                }
            }
        }

        match tokio::fs::write(&path, &content).await {
            Ok(_) => {
                let byte_count = content.len();
                Ok(ok_result(
                    self.name(),
                    format!("wrote {} bytes to '{}'", byte_count, path),
                    start.elapsed(),
                ))
            }
            Err(e) => Ok(err_result(
                self.name(),
                format!("failed to write '{}': {}", path, e),
                start.elapsed(),
            )),
        }
    }
}

// ===========================================================================
// EditTool
// ===========================================================================

/// Perform a find‑and‑replace edit on a file.
///
/// Requires `path`, `old_text` (text to find) and `new_text` (replacement).
/// Set `all` to `true` to replace every occurrence (default: first only).
pub struct EditTool;

#[async_trait]
impl Tool for EditTool {
    fn name(&self) -> &str {
        "edit"
    }

    fn description(&self) -> &str {
        "Apply a find-and-replace edit to a file. Replaces the first occurrence of `old_text` with `new_text`. Use `all: true` to replace every occurrence."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file to edit"
                },
                "old_text": {
                    "type": "string",
                    "description": "Text to find (must match exactly)"
                },
                "new_text": {
                    "type": "string",
                    "description": "Replacement text"
                },
                "all": {
                    "type": "boolean",
                    "description": "Replace all occurrences instead of just the first",
                    "default": false
                }
            },
            "required": ["path", "old_text", "new_text"]
        })
    }

    async fn execute(&self, args: Value) -> AirisResult<ToolResult> {
        let start = Instant::now();
        let path = req_str(&args, "path")?;
        let old_text = req_str(&args, "old_text")?;
        let new_text = req_str(&args, "new_text")?;
        let replace_all = opt_bool(&args, "all", false);

        let content = match tokio::fs::read_to_string(&path).await {
            Ok(c) => c,
            Err(e) => {
                return Ok(err_result(
                    self.name(),
                    format!("failed to read '{}': {}", path, e),
                    start.elapsed(),
                ));
            }
        };

        if !content.contains(&old_text) {
            return Ok(err_result(
                self.name(),
                format!("'old_text' not found in '{}'", path),
                start.elapsed(),
            ));
        }

        let new_content = if replace_all {
            content.replace(&old_text, &new_text)
        } else {
            content.replacen(&old_text, &new_text, 1)
        };

        match tokio::fs::write(&path, &new_content).await {
            Ok(_) => {
                let occurrences = if replace_all {
                    content.matches(&old_text).count()
                } else {
                    1
                };
                let msg = format!(
                    "applied {} replacement{} to '{}'",
                    occurrences,
                    if occurrences == 1 { "" } else { "s" },
                    path
                );
                Ok(ok_result(self.name(), msg, start.elapsed()))
            }
            Err(e) => Ok(err_result(
                self.name(),
                format!("failed to write '{}': {}", path, e),
                start.elapsed(),
            )),
        }
    }
}

// ===========================================================================
// BashTool
// ===========================================================================

/// Execute a shell command and capture its output.
///
/// Accepts an optional `cwd` (working directory) and `timeout` (seconds).
pub struct BashTool;

#[async_trait]
impl Tool for BashTool {
    fn name(&self) -> &str {
        "bash"
    }

    fn description(&self) -> &str {
        "Execute a shell command and return its output. Use `cwd` to set the working directory and `timeout` (seconds) to limit execution time."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Shell command to execute"
                },
                "cwd": {
                    "type": "string",
                    "description": "Working directory for the command (default: current directory)"
                },
                "timeout": {
                    "type": "integer",
                    "description": "Maximum execution time in seconds",
                    "minimum": 1,
                    "default": 30
                }
            },
            "required": ["command"]
        })
    }

    async fn execute(&self, args: Value) -> AirisResult<ToolResult> {
        let start = Instant::now();
        let command_str = req_str(&args, "command")?;
        let cwd = opt_str(&args, "cwd").map(PathBuf::from);
        let timeout_secs = opt_u64(&args, "timeout").unwrap_or(30);

        let (shell, flag) = if cfg!(target_family = "unix") {
            ("sh", "-c")
        } else {
            ("cmd", "/C")
        };

        let mut cmd = Command::new(shell);
        cmd.arg(flag).arg(&command_str);
        if let Some(ref dir) = cwd {
            cmd.current_dir(dir);
        }

        let output = match timeout(Duration::from_secs(timeout_secs), cmd.output()).await {
            Ok(Ok(out)) => out,
            Ok(Err(e)) => {
                return Ok(err_result(
                    self.name(),
                    format!("failed to spawn command: {}", e),
                    start.elapsed(),
                ));
            }
            Err(_) => {
                return Ok(err_result(
                    self.name(),
                    format!("command timed out after {}s", timeout_secs),
                    start.elapsed(),
                ));
            }
        };

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);

        if exit_code == 0 {
            let output_text = if stderr.is_empty() {
                stdout
            } else {
                let mut combined = stdout;
                if !combined.is_empty() && !combined.ends_with('\n') {
                    combined.push('\n');
                }
                combined.push_str(&stderr);
                combined
            };
            Ok(ok_result(self.name(), output_text, start.elapsed()))
        } else {
            let error_msg = format!(
                "exit code {}\nstderr:\n{}",
                exit_code,
                if stderr.is_empty() { "(none)" } else { &stderr }
            );
            let out = if stdout.is_empty() {
                String::new()
            } else {
                stdout
            };
            Ok(ToolResult {
                tool_name: self.name().to_string(),
                call_id: Uuid::new_v4().to_string(),
                success: false,
                output: out,
                error: Some(error_msg),
                duration_ms: start.elapsed().as_millis() as u64,
            })
        }
    }
}

// ===========================================================================
// GlobTool
// ===========================================================================

/// List files matching a glob pattern.
///
/// Patterns follow git‑ignore / `.gitignore` syntax (e.g. `**/*.rs`,
/// `src/**/mod.rs`).  Use `gitignore` and `hidden` flags to control
/// which files are considered.
pub struct GlobTool;

#[async_trait]
impl Tool for GlobTool {
    fn name(&self) -> &str {
        "glob"
    }

    fn description(&self) -> &str {
        "List files matching a glob pattern. Respects .gitignore by default. Use `hidden: true` to include dotfiles."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern (e.g. '**/*.rs', 'src/**/mod.rs')"
                },
                "gitignore": {
                    "type": "boolean",
                    "description": "Respect .gitignore rules",
                    "default": true
                },
                "hidden": {
                    "type": "boolean",
                    "description": "Include hidden/dot files",
                    "default": false
                }
            },
            "required": ["pattern"]
        })
    }

    async fn execute(&self, args: Value) -> AirisResult<ToolResult> {
        let start = Instant::now();
        let pattern_str = req_str(&args, "pattern")?;
        let use_gitignore = opt_bool(&args, "gitignore", true);
        let include_hidden = opt_bool(&args, "hidden", false);

        // Compile the glob pattern
        let glob_pattern = match Glob::new(&pattern_str) {
            Ok(g) => g,
            Err(e) => {
                return Ok(err_result(
                    self.name(),
                    format!("invalid glob pattern '{}': {}", pattern_str, e),
                    start.elapsed(),
                ));
            }
        };

        let mut builder = GlobSetBuilder::new();
        builder.add(glob_pattern);
        let glob_set = match builder.build() {
            Ok(g) => g,
            Err(e) => {
                return Ok(err_result(
                    self.name(),
                    format!("failed to build glob set: {}", e),
                    start.elapsed(),
                ));
            }
        };

        // Determine root — use the pattern's prefix before the first glob meta char
        let root = root_dir(&pattern_str).unwrap_or_else(|| PathBuf::from("."));

        // Walk the directory tree in a blocking task (file I/O should not
        // block the async runtime).
        let root_clone = root.clone();
        let matches_result: Result<Vec<String>, String> = tokio::task::spawn_blocking(move || {
            let mut results = Vec::new();
            let walker = WalkBuilder::new(&root_clone)
                .hidden(!include_hidden)
                .git_ignore(use_gitignore)
                .git_exclude(use_gitignore)
                .git_global(use_gitignore)
                .build();

            for entry in walker {
                let entry = match entry {
                    Ok(e) => e,
                    Err(_) => continue,
                };

                if !entry.file_type().map_or(false, |t| t.is_file()) {
                    continue;
                }

                let path = entry.path();
                if glob_set.is_match(path) {
                    // Produce a nice relative path from root
                    if let Ok(rel) = path.strip_prefix(&root_clone) {
                        results.push(rel.display().to_string());
                    } else {
                        results.push(path.display().to_string());
                    }
                }
            }

            results.sort();
            Ok(results)
        })
        .await;

        let all_matches = match matches_result {
            Ok(Ok(m)) => m,
            Ok(Err(e)) => {
                return Ok(err_result(self.name(), e, start.elapsed()));
            }
            Err(e) => {
                return Ok(err_result(
                    self.name(),
                    format!("glob walk failed: {}", e),
                    start.elapsed(),
                ));
            }
        };

        let output = if all_matches.is_empty() {
            format!("(no files matching '{}')", pattern_str)
        } else {
            all_matches.join("\n")
        };

        Ok(ok_result(self.name(), output, start.elapsed()))
    }
}

/// Heuristic: extract the longest non‑glob prefix from a pattern to use
/// as the walk root.  Falls back to `"."`.
fn root_dir(pattern: &str) -> Option<PathBuf> {
    // Walk pattern chars; stop at the first glob metacharacter.
    let mut end = 0;
    for (i, ch) in pattern.char_indices() {
        if ch == '*' || ch == '?' || ch == '[' || ch == '{' {
            break;
        }
        if ch == '/' {
            end = i + 1; // keep the slash so the path is a directory
        }
    }
    if end == 0 {
        return None;
    }
    let prefix = &pattern[..end];
    if prefix.is_empty() || prefix == "/" {
        None
    } else {
        Some(PathBuf::from(prefix))
    }
}

// ===========================================================================
// GrepTool
// ===========================================================================

/// Search file contents using a regular expression.
///
/// Returns matching lines in `file:line_number:content` format.
/// By default searches from the current directory and is case‑sensitive.
pub struct GrepTool;

#[async_trait]
impl Tool for GrepTool {
    fn name(&self) -> &str {
        "grep"
    }

    fn description(&self) -> &str {
        "Search file contents with a regular expression. Returns matches as 'file:line:content'. Supports case-insensitive search with `case_sensitive: false`."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Regular expression pattern"
                },
                "path": {
                    "type": "string",
                    "description": "Directory or file to search (default: current directory)",
                    "default": "."
                },
                "case_sensitive": {
                    "type": "boolean",
                    "description": "Whether the search is case-sensitive",
                    "default": true
                }
            },
            "required": ["pattern"]
        })
    }

    async fn execute(&self, args: Value) -> AirisResult<ToolResult> {
        let start = Instant::now();
        let pattern_str = req_str(&args, "pattern")?;
        let search_path = opt_str(&args, "path").unwrap_or(".").to_string();
        let case_sensitive = opt_bool(&args, "case_sensitive", true);

        // Compile regex
        let regex = if case_sensitive {
            match Regex::new(&pattern_str) {
                Ok(r) => r,
                Err(e) => {
                    return Ok(err_result(
                        self.name(),
                        format!("invalid regex '{}': {}", pattern_str, e),
                        start.elapsed(),
                    ));
                }
            }
        } else {
            match Regex::new(&format!("(?i){}", pattern_str)) {
                Ok(r) => r,
                Err(e) => {
                    return Ok(err_result(
                        self.name(),
                        format!("invalid regex '{}': {}", pattern_str, e),
                        start.elapsed(),
                    ));
                }
            }
        };

        let search_root = PathBuf::from(&search_path);
        let results: Vec<String> = if search_root.is_file() {
            search_file(&search_root, &regex, &search_root)
        } else {
            // Collect file paths first (sync walk, not Send-friendly for async),
            // then read each file asynchronously.
            let root_for_blocking = search_root.clone();
            let paths: Vec<PathBuf> = tokio::task::spawn_blocking(move || {
                let mut file_paths = Vec::new();
                let walker = WalkBuilder::new(&root_for_blocking)
                    .hidden(true)
                    .git_ignore(true)
                    .git_exclude(true)
                    .build();
                for entry in walker {
                    let entry = match entry {
                        Ok(e) => e,
                        Err(_) => continue,
                    };
                    if entry.file_type().map_or(false, |t| t.is_file()) {
                        file_paths.push(entry.path().to_path_buf());
                    }
                }
                file_paths
            })
            .await
            .unwrap_or_default();

            let mut all = Vec::new();
            for path in &paths {
                let content = match tokio::fs::read_to_string(path).await {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                let rel = path.strip_prefix(&search_root).unwrap_or(path);
                all.extend(search_content(rel, &regex, &content));
            }
            all
        };

        let output = if results.is_empty() {
            format!("(no matches for '{}')", pattern_str)
        } else {
            results.join("\n")
        };

        Ok(ok_result(self.name(), output, start.elapsed()))
    }
}

/// Search a single file for regex matches, returning `file:line:content` lines.
fn search_file(path: &Path, regex: &Regex, root: &Path) -> Vec<String> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let rel = path.strip_prefix(root).unwrap_or(path);
    search_content(rel, regex, &content)
}

/// Search a string for regex matches with file prefix.
fn search_content(rel_path: &Path, regex: &Regex, content: &str) -> Vec<String> {
    let path_str = rel_path.display().to_string();
    let mut results = Vec::new();
    for (line_no, line) in content.lines().enumerate() {
        if regex.is_match(line) {
            results.push(format!("{}:{}:{}", path_str, line_no + 1, line));
        }
    }
    results
}

// ===========================================================================
// WebSearchTool
// ===========================================================================

/// Search the web for information.
///
/// Uses DuckDuckGo's instant‑answer API by default. Returns a summary
/// of results when available.
pub struct WebSearchTool;

#[async_trait]
impl Tool for WebSearchTool {
    fn name(&self) -> &str {
        "web_search"
    }

    fn description(&self) -> &str {
        "Search the web for up-to-date information. Returns relevant snippets and URLs."
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results",
                    "minimum": 1,
                    "maximum": 20,
                    "default": 5
                }
            },
            "required": ["query"]
        })
    }

    async fn execute(&self, args: Value) -> AirisResult<ToolResult> {
        let start = Instant::now();
        let query = req_str(&args, "query")?;
        let limit = opt_u64(&args, "limit").unwrap_or(5).min(20) as usize;

        // Use DuckDuckGo Instant Answer API (no API key required)
        let url = format!(
            "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
            urlencoding(&query)
        );

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("AIRIS-CLI/0.1.0")
            .build();

        let client = match client {
            Ok(c) => c,
            Err(e) => {
                return Ok(err_result(
                    self.name(),
                    format!("failed to create HTTP client: {}", e),
                    start.elapsed(),
                ));
            }
        };

        let resp = match client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                return Ok(err_result(
                    self.name(),
                    format!("search request failed: {}", e),
                    start.elapsed(),
                ));
            }
        };

        let body: Value = match resp.json().await {
            Ok(v) => v,
            Err(e) => {
                return Ok(err_result(
                    self.name(),
                    format!("failed to parse search response: {}", e),
                    start.elapsed(),
                ));
            }
        };

        // Parse DuckDuckGo response
        let mut output_parts: Vec<String> = Vec::new();

        // Abstract
        if let Some(abstract_text) = body.get("AbstractText").and_then(|v| v.as_str()) {
            if !abstract_text.is_empty() {
                if let Some(source) = body.get("AbstractSource").and_then(|v| v.as_str()) {
                    output_parts.push(format!("## {}\n{}\nSource: {}\n", source, abstract_text, source));
                } else {
                    output_parts.push(format!("## Summary\n{}\n", abstract_text));
                }
            }
        }

        if let Some(abstract_url) = body.get("AbstractURL").and_then(|v| v.as_str()) {
            if !abstract_url.is_empty() {
                output_parts.push(format!("URL: {}", abstract_url));
            }
        }

        // Answer
        if let Some(answer) = body.get("Answer").and_then(|v| v.as_str()) {
            if !answer.is_empty() {
                output_parts.push(format!("**Answer:** {}", answer));
                if let Some(answer_type) = body.get("AnswerType").and_then(|v| v.as_str()) {
                    output_parts.push(format!("Type: {}", answer_type));
                }
            }
        }

        // Definition
        if let Some(def) = body.get("Definition").and_then(|v| v.as_str()) {
            if !def.is_empty() {
                output_parts.push(format!("**Definition:** {}", def));
            }
        }

        // Related topics / results
        if let Some(results) = body.get("Results").and_then(|v| v.as_array()) {
            if !results.is_empty() {
                output_parts.push("\n## Results".to_string());
                for (i, result) in results.iter().enumerate() {
                    let title = result
                        .get("Text")
                        .and_then(|v| v.as_str())
                        .unwrap_or("(no title)");
                    let result_url = result
                        .get("FirstURL")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    output_parts.push(format!(
                        "{}. {}  \n   {}",
                        i + 1,
                        title,
                        result_url
                    ));
                }
            }
        }

        // Related topics
        if let Some(topics) = body.get("RelatedTopics").and_then(|v| v.as_array()) {
            if !topics.is_empty() {
                output_parts.push("\n## Related".to_string());
                for (i, topic) in topics.iter().enumerate() {
                    if let Some(text) = topic.get("Text").and_then(|v| v.as_str()) {
                        let topic_url = topic
                            .get("FirstURL")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        output_parts.push(format!("{}. {}  \n   {}", i + 1, text, topic_url));
                    }
                    if i >= limit.saturating_sub(1) {
                        break;
                    }
                }
            }
        }

        if output_parts.is_empty() {
            output_parts.push(format!(
                "(no results found for '{}' on DuckDuckGo)",
                query
            ));
        }

        Ok(ok_result(self.name(), output_parts.join("\n\n"), start.elapsed()))
    }
}

/// Simple URL‑encoding for query strings.
fn urlencoding(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            b' ' => result.push_str("%20"),
            _ => {
                result.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    result
}

// ===========================================================================
// Default tool set
// ===========================================================================

/// Register all built‑in tools into the given registry.
pub fn register_default_tools(registry: &dyn ToolRegistry) {
    let tools: Vec<Box<dyn Tool>> = vec![
        Box::new(ReadTool),
        Box::new(WriteTool),
        Box::new(EditTool),
        Box::new(BashTool),
        Box::new(GlobTool),
        Box::new(GrepTool),
        Box::new(WebSearchTool),
    ];
    for tool in tools {
        registry.register(tool);
    }
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // -- Registry tests -----------------------------------------------------

    #[test]
    fn test_registry_register_and_get() {
        let registry = ToolRegistryImpl::new();
        registry.register(Box::new(ReadTool));

        assert!(registry.names().contains(&"read".to_string()));
        let tool = registry.get("read");
        assert!(tool.is_some());
        assert_eq!(tool.unwrap().name(), "read");
    }

    #[test]
    fn test_registry_definitions() {
        let registry = ToolRegistryImpl::new();
        registry.register(Box::new(ReadTool));
        registry.register(Box::new(BashTool));

        let defs = registry.definitions();
        assert_eq!(defs.len(), 2);

        let read_def = defs.iter().find(|d| d.name == "read").unwrap();
        assert_eq!(read_def.description, ReadTool.description());
        assert!(read_def.required.contains(&"path".to_string()));
    }

    #[test]
    fn test_registry_get_unknown() {
        let registry = ToolRegistryImpl::new();
        assert!(registry.get("nonexistent").is_none());
    }

    // -- ReadTool tests -----------------------------------------------------

    #[tokio::test]
    async fn test_read_missing_arg() {
        let tool = ReadTool;
        let result = tool.execute(json!({})).await;
        assert!(result.is_err()); // missing "path" -> Err(ToolExecution)
    }

    #[tokio::test]
    async fn test_read_file_not_found() {
        let tool = ReadTool;
        let result = tool
            .execute(json!({"path": "/tmp/__airis_test_nonexistent__"}))
            .await
            .unwrap();
        assert!(!result.success);
        assert!(result.error.unwrap().contains("failed to read"));
    }

    #[tokio::test]
    async fn test_read_file_success() {
        let path = "/tmp/__airis_test_read_file__";
        tokio::fs::write(path, b"hello\nworld\nthird line\n").await.unwrap();

        let tool = ReadTool;
        let result = tool
            .execute(json!({"path": path}))
            .await
            .unwrap();
        assert!(result.success);
        assert!(result.output.contains("hello"));
        assert!(result.output.contains("third line"));

        let _ = tokio::fs::remove_file(path).await;
    }

    #[tokio::test]
    async fn test_read_with_offset_limit() {
        let path = "/tmp/__airis_test_read_range__";
        tokio::fs::write(path, b"line1\nline2\nline3\nline4\nline5\n")
            .await
            .unwrap();

        let tool = ReadTool;
        let result = tool
            .execute(json!({"path": path, "offset": 2, "limit": 2}))
            .await
            .unwrap();
        assert!(result.success);
        assert!(result.output.contains("line2"));
        assert!(result.output.contains("line3"));
        assert!(!result.output.contains("line1"));

        let _ = tokio::fs::remove_file(path).await;
    }

    // -- WriteTool tests ----------------------------------------------------

    #[tokio::test]
    async fn test_write_and_read_back() {
        let path = "/tmp/__airis_test_write__";
        let tool = WriteTool;
        let result = tool
            .execute(json!({"path": path, "content": "test content"}))
            .await
            .unwrap();
        assert!(result.success);
        assert!(result.output.contains("wrote"));

        let content = tokio::fs::read_to_string(path).await.unwrap();
        assert_eq!(content, "test content");

        let _ = tokio::fs::remove_file(path).await;
    }

    // -- EditTool tests -----------------------------------------------------

    #[tokio::test]
    async fn test_edit_single() {
        let path = "/tmp/__airis_test_edit_single__";
        tokio::fs::write(path, b"foo bar baz").await.unwrap();

        let tool = EditTool;
        let result = tool
            .execute(json!({"path": path, "old_text": "bar", "new_text": "HELLO"}))
            .await
            .unwrap();
        assert!(result.success);

        let content = tokio::fs::read_to_string(path).await.unwrap();
        assert_eq!(content, "foo HELLO baz");

        let _ = tokio::fs::remove_file(path).await;
    }

    #[tokio::test]
    async fn test_edit_all() {
        let path = "/tmp/__airis_test_edit_all__";
        tokio::fs::write(path, b"a b a b a").await.unwrap();

        let tool = EditTool;
        let result = tool
            .execute(json!({"path": path, "old_text": "a", "new_text": "X", "all": true}))
            .await
            .unwrap();
        assert!(result.success);

        let content = tokio::fs::read_to_string(path).await.unwrap();
        assert_eq!(content, "X b X b X");

        let _ = tokio::fs::remove_file(path).await;
    }

    // -- BashTool tests -----------------------------------------------------

    #[tokio::test]
    async fn test_bash_echo() {
        let tool = BashTool;
        let result = tool
            .execute(json!({"command": "echo hello world"}))
            .await
            .unwrap();
        assert!(result.success);
        assert!(result.output.trim().contains("hello world"));
    }

    #[tokio::test]
    async fn test_bash_nonzero_exit() {
        let tool = BashTool;
        let result = tool
            .execute(json!({"command": "exit 42"}))
            .await
            .unwrap();
        assert!(!result.success);
        assert!(result.error.unwrap().contains("exit code 42"));
    }

    // -- GlobTool tests -----------------------------------------------------

    #[tokio::test]
    async fn test_glob_no_matches() {
        let tool = GlobTool;
        let result = tool
            .execute(json!({"pattern": "zzz_nonexistent_*.xyz"}))
            .await
            .unwrap();
        assert!(result.success);
        assert!(result.output.contains("no files matching"));
    }

    // -- GrepTool tests -----------------------------------------------------

    #[tokio::test]
    async fn test_grep_invalid_regex() {
        let tool = GrepTool;
        let result = tool
            .execute(json!({"pattern": "[invalid"}))
            .await
            .unwrap();
        assert!(!result.success);
        assert!(result.error.unwrap().contains("invalid regex"));
    }

    #[tokio::test]
    async fn test_grep_file_matches() {
        let path = "/tmp/__airis_test_grep__";
        tokio::fs::write(path, b"apple\nbanana\ncherry\nbanana split\n")
            .await
            .unwrap();

        let tool = GrepTool;
        let result = tool
            .execute(json!({"pattern": "banana", "path": path}))
            .await
            .unwrap();
        assert!(result.success);
        assert!(result.output.contains("banana"));
        assert!(!result.output.contains("apple"));

        let _ = tokio::fs::remove_file(path).await;
    }

    // -- WebSearchTool tests ------------------------------------------------

    #[tokio::test]
    async fn test_web_search_missing_query() {
        let tool = WebSearchTool;
        let result = tool.execute(json!({})).await;
        assert!(result.is_err());
    }

    // -- helpers ------------------------------------------------------------

    #[test]
    fn test_root_dir() {
        assert_eq!(
            root_dir("src/**/*.rs"),
            Some(PathBuf::from("src/"))
        );
        assert_eq!(
            root_dir("*.rs"),
            None // no directory prefix
        );
        assert_eq!(
            root_dir("foo/bar/baz/*.txt"),
            Some(PathBuf::from("foo/bar/baz/"))
        );
    }

    #[test]
    fn test_urlencoding() {
        assert_eq!(urlencoding("hello world"), "hello%20world");
        assert_eq!(urlencoding("a+b"), "a%2Bb");
        assert_eq!(urlencoding("foo"), "foo");
    }
}
