//! Doctor / diagnostic system for AIRIS-CLI.
//!
//! Provides self-diagnosis checks, auto-repair capabilities, and
//! human-readable health reports. The doctor can validate configuration,
//! dependencies, plugins, permissions, network connectivity, cache
//! integrity, git state, and environment variables.

use crate::error::{AirisError, AirisResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tracing::{debug, info, warn};

// ─── Severity ──────────────────────────────────────────────────────────────

/// How severe a check failure is.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum DoctorSeverity {
    /// System cannot function without this being fixed.
    Critical,
    /// Major functionality is affected.
    High,
    /// Some features may not work optimally.
    Medium,
    /// Informational or cosmetic issue.
    Low,
}

impl std::fmt::Display for DoctorSeverity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Critical => write!(f, "CRITICAL"),
            Self::High => write!(f, "HIGH"),
            Self::Medium => write!(f, "MEDIUM"),
            Self::Low => write!(f, "LOW"),
        }
    }
}

// ─── Fix Kind ──────────────────────────────────────────────────────────────

/// Describes an actionable fix that can be applied automatically.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FixKind {
    /// Create a directory (and any missing parents).
    CreateDir { path: PathBuf },
    /// Create a file with initial content.
    CreateFile { path: PathBuf, content: String },
    /// Set Unix file permissions (octal mode, e.g. `0o600`).
    SetPermissions { path: PathBuf, mode: u32 },
    /// Run a shell command to fix the issue.
    RunCommand(String),
    /// Suggest setting an environment variable (process-local apply).
    SetEnvVar { key: String, value: String },
    /// Ensure a file exists (create empty or touch existing).
    TouchFile(PathBuf),
}

// ─── DoctorFix ─────────────────────────────────────────────────────────────

/// A single fix that can be applied to resolve a check failure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorFix {
    /// Human-readable description of what this fix does.
    pub description: String,
    /// The concrete action to take.
    pub kind: FixKind,
}

impl DoctorFix {
    /// Apply this fix, returning a description of what was done.
    ///
    /// # Errors
    ///
    /// Returns an error if the fix could not be applied.
    pub fn apply(&self) -> AirisResult<String> {
        match &self.kind {
            FixKind::CreateDir { path } => {
                std::fs::create_dir_all(path).map_err(AirisError::Io)?;
                Ok(format!("Created directory: {}", path.display()))
            }
            FixKind::CreateFile { path, content } => {
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent).map_err(AirisError::Io)?;
                }
                std::fs::write(path, content).map_err(AirisError::Io)?;
                Ok(format!("Created file: {}", path.display()))
            }
            FixKind::SetPermissions { path, mode } => {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    std::fs::set_permissions(path, std::fs::Permissions::from_mode(*mode))
                        .map_err(AirisError::Io)?;
                    Ok(format!(
                        "Set permissions on {} to {:o}",
                        path.display(),
                        mode
                    ))
                }
                #[cfg(not(unix))]
                {
                    let _ = (path, mode);
                    Err(AirisError::UnsupportedPlatform(
                        "File permissions are not supported on this platform".into(),
                    ))
                }
            }
            FixKind::RunCommand(cmd) => {
                let status = std::process::Command::new("sh")
                    .arg("-c")
                    .arg(cmd)
                    .status()
                    .map_err(|e| AirisError::CommandFailed {
                        code: -1,
                        stderr: format!("Failed to execute command: {}", e),
                    })?;
                if status.success() {
                    Ok(format!("Ran: {}", cmd))
                } else {
                    Err(AirisError::CommandFailed {
                        code: status.code().unwrap_or(-1),
                        stderr: "Command exited with non-zero status".into(),
                    })
                }
            }
            FixKind::SetEnvVar { key, value } => {
                std::env::set_var(key, value);
                Ok(format!(
                    "Set environment variable {}={} (process-local only; persists only in shell rc)",
                    key, value
                ))
            }
            FixKind::TouchFile(path) => {
                if path.exists() {
                    // best-effort timestamp update
                    let _ = std::fs::File::open(path).and_then(|f| {
                        let now = std::time::SystemTime::now();
                        f.set_modified(now)
                    });
                } else {
                    if let Some(parent) = path.parent() {
                        std::fs::create_dir_all(parent).map_err(AirisError::Io)?;
                    }
                    std::fs::write(path, "").map_err(AirisError::Io)?;
                }
                Ok(format!("Touched file: {}", path.display()))
            }
        }
    }
}

// ─── DoctorResult ──────────────────────────────────────────────────────────

/// The result of running a single doctor check.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorResult {
    /// Unique identifier of the check that produced this result.
    pub check_id: String,
    /// Whether the check passed.
    pub passed: bool,
    /// Human-readable message describing the result.
    pub message: String,
    /// An optional fix that can be applied to resolve the issue.
    pub fix: Option<DoctorFix>,
    /// Severity of this check.
    pub severity: DoctorSeverity,
}

// ─── DoctorCheck Trait ─────────────────────────────────────────────────────

/// A single diagnostic check that can be run by the doctor.
#[async_trait::async_trait]
pub trait DoctorCheck: Send + Sync {
    /// Unique identifier for this check (kebab-case).
    fn id(&self) -> &'static str;
    /// Human-readable name.
    fn name(&self) -> &'static str;
    /// Description of what this check validates.
    fn description(&self) -> &'static str;
    /// Severity level if this check fails.
    fn severity(&self) -> DoctorSeverity;
    /// Run the check and return a result. Receives a reference to the
    /// [`DoctorRunner`] so checks can depend on results from other checks.
    async fn run(&self, runner: &DoctorRunner) -> DoctorResult;
}

// ─── Individual Checks ─────────────────────────────────────────────────────

/// Check that the AIRIS config file exists and is valid TOML.
pub struct ConfigCheck;

#[async_trait::async_trait]
impl DoctorCheck for ConfigCheck {
    fn id(&self) -> &'static str {
        "config"
    }

    fn name(&self) -> &'static str {
        "Configuration"
    }

    fn description(&self) -> &'static str {
        "Validates that the AIRIS configuration file exists and is valid TOML"
    }

    fn severity(&self) -> DoctorSeverity {
        DoctorSeverity::Critical
    }

    async fn run(&self, _runner: &DoctorRunner) -> DoctorResult {
        let config_paths = Self::config_paths();
        let mut last_error = String::new();

        for path in &config_paths {
            if !path.exists() {
                last_error = format!("Config file not found at {}", path.display());
                continue;
            }

            match std::fs::read_to_string(path) {
                Ok(content) => match content.parse::<toml::Value>() {
                    Ok(_) => {
                        return DoctorResult {
                            check_id: self.id().to_string(),
                            passed: true,
                            message: format!("Config file is valid at {}", path.display()),
                            fix: None,
                            severity: self.severity(),
                        };
                    }
                    Err(e) => {
                        last_error = format!(
                            "Config file at {} is not valid TOML: {}",
                            path.display(),
                            e
                        );
                        return DoctorResult {
                            check_id: self.id().to_string(),
                            passed: false,
                            message: last_error,
                            fix: Some(DoctorFix {
                                description: format!(
                                    "Fix syntax errors in {}",
                                    path.display()
                                ),
                                kind: FixKind::RunCommand(format!(
                                    "toml-lint {} 2>/dev/null || echo 'Install toml-lint to validate'",
                                    path.display()
                                )),
                            }),
                            severity: self.severity(),
                        };
                    }
                },
                Err(e) => {
                    last_error = format!(
                        "Cannot read config file at {}: {}",
                        path.display(),
                        e
                    );
                }
            }
        }

        // No valid config found — offer to create one
        let (default_path, default_content) = if !config_paths.is_empty() {
            let p = config_paths[0].clone();
            let d = Self::default_config_content();
            (p, d)
        } else {
            let cwd = std::env::current_dir().unwrap_or_default();
            (cwd.join(".airis").join("config.toml"), Self::default_config_content())
        };

        DoctorResult {
            check_id: self.id().to_string(),
            passed: false,
            message: if last_error.is_empty() {
                "No AIRIS configuration file found".into()
            } else {
                last_error
            },
            fix: Some(DoctorFix {
                description: format!("Create default config at {}", default_path.display()),
                kind: FixKind::CreateFile {
                    path: default_path,
                    content: default_content,
                },
            }),
            severity: self.severity(),
        }
    }
}

impl ConfigCheck {
    /// Get the list of candidate config file paths, in priority order.
    fn config_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();

        // Workspace-level config (highest priority)
        if let Ok(cwd) = std::env::current_dir() {
            paths.push(cwd.join(".airis").join("config.toml"));
        }

        // Global config
        if let Ok(home) = std::env::var("HOME") {
            paths.push(PathBuf::from(home).join(".config").join("airis").join("config.toml"));
            paths.push(PathBuf::from(home).join(".airis").join("config.toml"));
        }

        paths
    }

    /// Generate default config TOML content.
    fn default_config_content() -> String {
        r#"# AIRIS-CLI Workspace Configuration
[core]
max_tokens = 4096
temperature = 0.7
theme = "kageos-dark"

[workspace]
auto_index = true
max_context_files = 50

[workspace.indexing]
max_file_size = 1048576
exclude_patterns = ["node_modules/**", "target/**", ".git/**"]
"#
        .to_string()
    }
}

/// Check that required system binaries are available.
pub struct DepsCheck {
    /// List of required binary names.
    pub required_binaries: Vec<&'static str>,
}

impl Default for DepsCheck {
    fn default() -> Self {
        Self {
            required_binaries: vec!["git", "curl", "sh"],
        }
    }
}

#[async_trait::async_trait]
impl DoctorCheck for DepsCheck {
    fn id(&self) -> &'static str {
        "deps"
    }

    fn name(&self) -> &'static str {
        "System Dependencies"
    }

    fn description(&self) -> &'static str {
        "Verifies that required system binaries are installed and accessible"
    }

    fn severity(&self) -> DoctorSeverity {
        DoctorSeverity::High
    }

    async fn run(&self, _runner: &DoctorRunner) -> DoctorResult {
        let mut missing: Vec<&str> = Vec::new();
        let mut found: Vec<&str> = Vec::new();

        for bin in &self.required_binaries {
            let check = std::process::Command::new(bin)
                .arg("--version")
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status();

            match check {
                Ok(status) if status.success() => found.push(bin),
                _ => missing.push(bin),
            }
        }

        if missing.is_empty() {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: true,
                message: format!(
                    "All required binaries are available: {}",
                    found.join(", ")
                ),
                fix: None,
                severity: self.severity(),
            }
        } else {
            let missing_name = missing[0];
            let desc = match missing_name {
                "git" => format!("Install git: apt install git / brew install git / winget install Git.Git"),
                "curl" => format!("Install curl: apt install curl / brew install curl"),
                "sh" => format!("A POSIX shell is required for the system to function"),
                other => format!("Install '{}' using your system package manager", other),
            };

            DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: format!(
                    "Missing required binaries: {}. Found: {}",
                    missing.join(", "),
                    found.join(", ")
                ),
                fix: Some(DoctorFix {
                    description: format!("Install missing binary: {} — {}", missing_name, desc),
                    kind: FixKind::RunCommand(format!(
                        "command -v {} >/dev/null 2>&1 && echo 'Found' || echo 'Please install {}'",
                        missing_name, missing_name
                    )),
                }),
                severity: self.severity(),
            }
        }
    }
}

/// Check that the model registry / configuration is accessible.
pub struct ModelsCheck;

#[async_trait::async_trait]
impl DoctorCheck for ModelsCheck {
    fn id(&self) -> &'static str {
        "models"
    }

    fn name(&self) -> &'static str {
        "Model Registry"
    }

    fn description(&self) -> &'static str {
        "Checks that the model registry configuration is accessible and valid"
    }

    fn severity(&self) -> DoctorSeverity {
        DoctorSeverity::High
    }

    async fn run(&self, runner: &DoctorRunner) -> DoctorResult {
        // If config check failed, defer
        if let Some(cr) = runner.get_check_result("config") {
            if !cr.passed {
                return DoctorResult {
                    check_id: self.id().to_string(),
                    passed: false,
                    message: "Cannot check models: configuration is invalid or missing".into(),
                    fix: Some(DoctorFix {
                        description: "Fix the configuration issue first, then re-run model check".into(),
                        kind: FixKind::RunCommand("airis doctor --check config".into()),
                    }),
                    severity: self.severity(),
                };
            }
        }

        // Look at config paths for model/provider entries
        let config_paths = Self::config_paths();
        let mut has_models = false;
        let mut detail = String::new();

        for path in &config_paths {
            if path.exists() {
                if let Ok(content) = std::fs::read_to_string(path) {
                    if let Ok(table) = content.parse::<toml::Value>() {
                        let models = table.get("models");
                        let providers = table.get("providers");
                        if models.is_some() || providers.is_some() {
                            has_models = true;
                            if let Some(m) = models.and_then(|v| v.as_table()) {
                                let keys: Vec<&str> = m.keys().map(String::as_str).collect();
                                detail = format!(" models=[{}]", keys.join(", "));
                            }
                            if let Some(p) = providers.and_then(|v| v.as_table()) {
                                let keys: Vec<&str> = p.keys().map(String::as_str).collect();
                                detail = format!("{} providers=[{}]", detail, keys.join(", "));
                            }
                            break;
                        }
                    }
                }
            }
        }

        if has_models {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: true,
                message: format!("Model registry configuration is present{}", detail),
                fix: None,
                severity: self.severity(),
            }
        } else {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: "No models or providers configured in the config file. Without a provider, AI features will not work."
                    .into(),
                fix: Some(DoctorFix {
                    description: "Add a provider configuration. See https://kageos.dev/airis/docs/providers".into(),
                    kind: FixKind::CreateFile {
                        path: PathBuf::from(".airis").join("providers.example.toml"),
                        content: r#"# Example provider configuration
# Uncomment and set your API key, or set it via environment variable.
# [models]
# default_provider = "openai"
#
# [providers.openai]
# api_key = "${OPENAI_API_KEY}"
# model = "gpt-4"
"#
                        .into(),
                    },
                }),
                severity: self.severity(),
            }
        }
    }
}

impl ModelsCheck {
    fn config_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();
        if let Ok(cwd) = std::env::current_dir() {
            paths.push(cwd.join(".airis").join("config.toml"));
        }
        if let Ok(home) = std::env::var("HOME") {
            paths.push(PathBuf::from(home).join(".config").join("airis").join("config.toml"));
        }
        paths
    }
}

/// Check plugin directory and manifest integrity.
pub struct PluginsCheck;

#[async_trait::async_trait]
impl DoctorCheck for PluginsCheck {
    fn id(&self) -> &'static str {
        "plugins"
    }

    fn name(&self) -> &'static str {
        "Plugin Integrity"
    }

    fn description(&self) -> &'static str {
        "Validates that the plugin directory exists and plugin manifests are well-formed"
    }

    fn severity(&self) -> DoctorSeverity {
        DoctorSeverity::Medium
    }

    async fn run(&self, _runner: &DoctorRunner) -> DoctorResult {
        let plugin_dirs = Self::plugin_dirs();
        let mut issues: Vec<String> = Vec::new();
        let mut valid_count = 0_usize;

        for dir in &plugin_dirs {
            if !dir.exists() {
                issues.push(format!("Plugin directory not found: {}", dir.display()));
                continue;
            }

            if !dir.is_dir() {
                issues.push(format!("Plugin path is not a directory: {}", dir.display()));
                continue;
            }

            let entries = match std::fs::read_dir(dir) {
                Ok(e) => e,
                Err(e) => {
                    issues.push(format!("Cannot read plugin directory {}: {}", dir.display(), e));
                    continue;
                }
            };

            for entry in entries.flatten() {
                let entry_path = entry.path();
                if !entry_path.is_dir() {
                    continue;
                }

                let manifest_path = entry_path.join("plugin.toml");
                if !manifest_path.exists() {
                    continue;
                }

                match std::fs::read_to_string(&manifest_path) {
                    Ok(content) => match content.parse::<toml::Value>() {
                        Ok(val) => {
                            let has_name = val.get("name").and_then(|v| v.as_str()).is_some();
                            let has_version =
                                val.get("version").and_then(|v| v.as_str()).is_some();
                            if has_name && has_version {
                                valid_count += 1;
                            } else {
                                issues.push(format!(
                                    "Plugin manifest {} is missing required fields (name, version)",
                                    manifest_path.display()
                                ));
                            }
                        }
                        Err(e) => {
                            issues.push(format!(
                                "Plugin manifest {} is not valid TOML: {}",
                                manifest_path.display(),
                                e
                            ));
                        }
                    },
                    Err(e) => {
                        issues.push(format!(
                            "Cannot read plugin manifest {}: {}",
                            manifest_path.display(),
                            e
                        ));
                    }
                }
            }
        }

        if plugin_dirs.is_empty() {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: "No plugin directories configured".into(),
                fix: Some(DoctorFix {
                    description: "Create a plugins directory in your AIRIS workspace".into(),
                    kind: FixKind::CreateDir {
                        path: PathBuf::from(".airis").join("plugins"),
                    },
                }),
                severity: self.severity(),
            }
        } else if issues.is_empty() {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: true,
                message: format!(
                    "Plugin integrity check passed. {} valid plugin(s) found in {} directory(ies).",
                    valid_count,
                    plugin_dirs.len()
                ),
                fix: None,
                severity: self.severity(),
            }
        } else {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: format!(
                    "Plugin issues found ({}): {}",
                    issues.len(),
                    issues.join("; ")
                ),
                fix: Some(DoctorFix {
                    description: format!("Fix {} plugin issue(s)", issues.len()),
                    kind: FixKind::RunCommand(
                        "airis plugins list 2>/dev/null || echo 'Run airis plugins validate for details'"
                            .into(),
                    ),
                }),
                severity: self.severity(),
            }
        }
    }
}

impl PluginsCheck {
    fn plugin_dirs() -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        if let Ok(cwd) = std::env::current_dir() {
            dirs.push(cwd.join(".airis").join("plugins"));
        }
        dirs
    }
}

/// Check file permissions on sensitive files.
pub struct PermissionsCheck;

#[async_trait::async_trait]
impl DoctorCheck for PermissionsCheck {
    fn id(&self) -> &'static str {
        "permissions"
    }

    fn name(&self) -> &'static str {
        "File Permissions"
    }

    fn description(&self) -> &'static str {
        "Checks that sensitive files (config, session data) have safe permissions"
    }

    fn severity(&self) -> DoctorSeverity {
        DoctorSeverity::Medium
    }

    #[cfg(unix)]
    async fn run(&self, _runner: &DoctorRunner) -> DoctorResult {
        use std::os::unix::fs::PermissionsExt;

        let paths_to_check = Self::sensitive_paths();
        let mut issues: Vec<String> = Vec::new();

        for path in &paths_to_check {
            if !path.exists() {
                continue;
            }

            match std::fs::metadata(path) {
                Ok(meta) => {
                    let mode = meta.permissions().mode();
                    // Check if file is world-writable (unsafe)
                    if mode & 0o002 != 0 {
                        issues.push(format!(
                            "{} is world-writable (mode {:o})",
                            path.display(),
                            mode & 0o777
                        ));
                    }
                    // Check if config file is group-writable
                    if mode & 0o020 != 0
                        && path.extension().map_or(false, |e| e == "toml")
                    {
                        issues.push(format!(
                            "Config file {} is group-writable",
                            path.display()
                        ));
                    }
                }
                Err(e) => {
                    issues.push(format!(
                        "Cannot check permissions for {}: {}",
                        path.display(),
                        e
                    ));
                }
            }
        }

        if issues.is_empty() {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: true,
                message: "All file permissions are safe".into(),
                fix: None,
                severity: self.severity(),
            }
        } else {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: format!("Permission issues found: {}", issues.join("; ")),
                fix: Some(DoctorFix {
                    description: "Restrict permissions on sensitive files".into(),
                    kind: FixKind::RunCommand(
                        "chmod -R o-w .airis/ 2>/dev/null; chmod 600 .airis/config.toml 2>/dev/null"
                            .into(),
                    ),
                }),
                severity: self.severity(),
            }
        }
    }

    #[cfg(not(unix))]
    async fn run(&self, _runner: &DoctorRunner) -> DoctorResult {
        DoctorResult {
            check_id: self.id().to_string(),
            passed: true,
            message: "Permission check skipped: not supported on this platform".into(),
            fix: None,
            severity: DoctorSeverity::Low,
        }
    }
}

impl PermissionsCheck {
    fn sensitive_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();
        if let Ok(cwd) = std::env::current_dir() {
            paths.push(cwd.join(".airis").join("config.toml"));
        }
        if let Ok(home) = std::env::var("HOME") {
            paths.push(PathBuf::from(home).join(".config").join("airis").join("config.toml"));
        }
        paths
    }
}

/// Check network connectivity to API endpoints.
pub struct NetworkCheck {
    /// Hosts to check connectivity to (in `host:port` or URL form).
    pub endpoints: Vec<&'static str>,
    /// Connection timeout in seconds.
    pub timeout_secs: u64,
}

impl Default for NetworkCheck {
    fn default() -> Self {
        Self {
            endpoints: vec![
                "api.openai.com:443",
                "api.anthropic.com:443",
            ],
            timeout_secs: 5,
        }
    }
}

#[async_trait::async_trait]
impl DoctorCheck for NetworkCheck {
    fn id(&self) -> &'static str {
        "network"
    }

    fn name(&self) -> &'static str {
        "Network Connectivity"
    }

    fn description(&self) -> &'static str {
        "Tests connectivity to configured API endpoints"
    }

    fn severity(&self) -> DoctorSeverity {
        DoctorSeverity::High
    }

    async fn run(&self, _runner: &DoctorRunner) -> DoctorResult {
        let mut reachable: Vec<&str> = Vec::new();
        let mut unreachable: Vec<&str> = Vec::new();

        for endpoint in &self.endpoints {
            let (host, port) = match Self::parse_endpoint(endpoint) {
                Some(pair) => pair,
                None => {
                    unreachable.push(endpoint);
                    continue;
                }
            };

            match Self::check_host(host, port, self.timeout_secs).await {
                true => reachable.push(endpoint),
                false => unreachable.push(endpoint),
            }
        }

        if unreachable.is_empty() {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: true,
                message: format!(
                    "All endpoints are reachable ({} checked)",
                    reachable.len()
                ),
                fix: None,
                severity: self.severity(),
            }
        } else if reachable.is_empty() {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: format!(
                    "No endpoints reachable. Checked: {}",
                    unreachable.join(", ")
                ),
                fix: Some(DoctorFix {
                    description: "Check your internet connection and firewall settings".into(),
                    kind: FixKind::RunCommand(
                        "curl -s --max-time 5 https://api.openai.com >/dev/null 2>&1 && echo 'Connected' || echo 'No connection'".into()
                    ),
                }),
                severity: self.severity(),
            }
        } else {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: format!(
                    "Some endpoints unreachable: {}. Reachable: {}",
                    unreachable.join(", "),
                    reachable.join(", ")
                ),
                fix: None,
                severity: DoctorSeverity::Medium,
            }
        }
    }
}

impl NetworkCheck {
    /// Parse an endpoint string into `(host, port)`. Accepts `host:port`
    /// or `scheme://host/path` forms.
    fn parse_endpoint(s: &str) -> Option<(&str, u16)> {
        // Scheme-based: extract host and default port
        if s.contains("://") {
            let after_scheme = s.split("://").nth(1)?;
            let host = after_scheme.split(['/', ':']).next().filter(|h| !h.is_empty())?;
            let default_port = if s.starts_with("https") { 443 } else { 80 };
            // Check if port is specified after host
            let rest = &after_scheme[host.len()..];
            if let Some(port_str) = rest.strip_prefix(':') {
                let port_str = port_str.split('/').next()?;
                let port: u16 = port_str.parse().ok()?;
                Some((host, port))
            } else {
                Some((host, default_port))
            }
        } else {
            // Plain host:port
            let mut parts = s.splitn(2, ':');
            let host = parts.next()?;
            let port: u16 = parts.next()?.parse().ok()?;
            Some((host, port))
        }
    }

    /// Check if a TCP host:port is reachable.
    async fn check_host(host: &str, port: u16, timeout_secs: u64) -> bool {
        let addr = format!("{}:{}", host, port);
        let timeout = Duration::from_secs(timeout_secs);
        tokio::time::timeout(timeout, tokio::net::TcpStream::connect(&addr))
            .await
            .ok()
            .and_then(|r| r.ok())
            .is_some()
    }
}

/// Check cache directory integrity.
pub struct CacheCheck;

#[async_trait::async_trait]
impl DoctorCheck for CacheCheck {
    fn id(&self) -> &'static str {
        "cache"
    }

    fn name(&self) -> &'static str {
        "Cache Integrity"
    }

    fn description(&self) -> &'static str {
        "Validates that the cache directory exists and is functional"
    }

    fn severity(&self) -> DoctorSeverity {
        DoctorSeverity::Low
    }

    async fn run(&self, _runner: &DoctorRunner) -> DoctorResult {
        let cache_dirs = Self::cache_dirs();
        let mut issues: Vec<String> = Vec::new();
        let mut ok_count = 0_usize;

        for dir in &cache_dirs {
            if !dir.exists() {
                issues.push(format!("Cache directory not found: {}", dir.display()));
                continue;
            }

            if !dir.is_dir() {
                issues.push(format!("Cache path is not a directory: {}", dir.display()));
                continue;
            }

            // Check write access by creating a temp file
            let test_file = dir.join(".airis_doctor_test");
            match std::fs::write(&test_file, b"test") {
                Ok(_) => {
                    let _ = std::fs::remove_file(&test_file);
                }
                Err(e) => {
                    issues.push(format!(
                        "Cache directory {} is not writable: {}",
                        dir.display(),
                        e
                    ));
                    continue;
                }
            }

            ok_count += 1;
        }

        if cache_dirs.is_empty() {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: "No cache directories configured".into(),
                fix: Some(DoctorFix {
                    description: "Create a cache directory in your AIRIS workspace".into(),
                    kind: FixKind::CreateDir {
                        path: PathBuf::from(".airis").join("cache"),
                    },
                }),
                severity: self.severity(),
            }
        } else if issues.is_empty() {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: true,
                message: format!(
                    "Cache integrity check passed ({} director{})",
                    ok_count,
                    if ok_count == 1 { "y" } else { "ies" }
                ),
                fix: None,
                severity: self.severity(),
            }
        } else {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: format!(
                    "Cache issues ({}): {}",
                    issues.len(),
                    issues.join("; ")
                ),
                fix: Some(DoctorFix {
                    description: "Recreate the cache directories to resolve issues".into(),
                    kind: FixKind::RunCommand(
                        "mkdir -p .airis/cache/ && chmod 700 .airis/cache/".into(),
                    ),
                }),
                severity: self.severity(),
            }
        }
    }
}

impl CacheCheck {
    fn cache_dirs() -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        if let Ok(cwd) = std::env::current_dir() {
            dirs.push(cwd.join(".airis").join("cache"));
        }
        dirs
    }
}

/// Check the state of the git repository.
pub struct GitCheck;

#[async_trait::async_trait]
impl DoctorCheck for GitCheck {
    fn id(&self) -> &'static str {
        "git"
    }

    fn name(&self) -> &'static str {
        "Git Repository"
    }

    fn description(&self) -> &'static str {
        "Checks that the current directory is a valid git repository and is in a healthy state"
    }

    fn severity(&self) -> DoctorSeverity {
        DoctorSeverity::Low
    }

    async fn run(&self, _runner: &DoctorRunner) -> DoctorResult {
        let cwd = match std::env::current_dir() {
            Ok(d) => d,
            Err(e) => {
                return DoctorResult {
                    check_id: self.id().to_string(),
                    passed: false,
                    message: format!("Cannot determine current directory: {}", e),
                    fix: None,
                    severity: self.severity(),
                };
            }
        };

        let git_dir = cwd.join(".git");
        if !git_dir.exists() {
            return DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: format!(
                    "Not a git repository (no .git found in {})",
                    cwd.display()
                ),
                fix: Some(DoctorFix {
                    description: "Initialize a git repository".into(),
                    kind: FixKind::RunCommand("git init".into()),
                }),
                severity: DoctorSeverity::Low,
            };
        }

        // Use git binary to check repo state
        let output = std::process::Command::new("git")
            .arg("status")
            .arg("--porcelain")
            .current_dir(&cwd)
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);

                if !out.status.success() {
                    return DoctorResult {
                        check_id: self.id().to_string(),
                        passed: false,
                        message: format!("Git error: {}", stderr.trim()),
                        fix: Some(DoctorFix {
                            description: "Check git repository integrity".into(),
                            kind: FixKind::RunCommand("git fsck".into()),
                        }),
                        severity: self.severity(),
                    };
                }

                let dirty_count = stdout.lines().count();

                if dirty_count == 0 {
                    DoctorResult {
                        check_id: self.id().to_string(),
                        passed: true,
                        message: "Git repository is clean".into(),
                        fix: None,
                        severity: self.severity(),
                    }
                } else {
                    // Dirty is informational, not a failure
                    DoctorResult {
                        check_id: self.id().to_string(),
                        passed: true,
                        message: format!(
                            "Git repository has {} uncommitted change(s)",
                            dirty_count
                        ),
                        fix: None,
                        severity: DoctorSeverity::Low,
                    }
                }
            }
            Err(e) => DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: format!("Cannot run git: {}", e),
                fix: Some(DoctorFix {
                    description: "Ensure git is installed and accessible".into(),
                    kind: FixKind::RunCommand(
                        "which git || echo 'git not found'".into(),
                    ),
                }),
                severity: self.severity(),
            },
        }
    }
}

/// Check that the environment is properly configured.
pub struct EnvCheck;

#[async_trait::async_trait]
impl DoctorCheck for EnvCheck {
    fn id(&self) -> &'static str {
        "env"
    }

    fn name(&self) -> &'static str {
        "Environment"
    }

    fn description(&self) -> &'static str {
        "Validates that required environment variables and paths are correctly set"
    }

    fn severity(&self) -> DoctorSeverity {
        DoctorSeverity::Medium
    }

    async fn run(&self, _runner: &DoctorRunner) -> DoctorResult {
        let checks: &[(&str, Option<&str>, &str)] = &[
            ("HOME", None, "Home directory"),
            ("PATH", None, "Executable search path"),
            ("SHELL", None, "Default shell"),
            ("TERM", Some("xterm-256color"), "Terminal type"),
            ("OPENAI_API_KEY", Some("sk-..."), "OpenAI API key (optional)"),
            (
                "ANTHROPIC_API_KEY",
                Some("sk-ant-..."),
                "Anthropic API key (optional)",
            ),
        ];

        let mut present: Vec<&str> = Vec::new();
        let mut missing: Vec<(&str, &str)> = Vec::new();
        let mut suggestions: Vec<String> = Vec::new();

        for (var, hint, label) in checks {
            match std::env::var(var) {
                Ok(val) if !val.is_empty() => {
                    present.push(var);
                }
                _ => {
                    if hint.is_some() && var.contains("API_KEY") {
                        suggestions.push(format!(
                            "{} ({}) not set — configure in .airis/config.toml instead",
                            label, var
                        ));
                    } else {
                        missing.push((var, label));
                    }
                }
            }
        }

        // Check PATH for common tool directories
        if let Ok(path) = std::env::var("PATH") {
            let paths: Vec<&str> = std::env::split_paths(&path)
                .filter_map(|p| p.to_str())
                .collect();

            let home = std::env::var("HOME").unwrap_or_default();
            for dir_template in &["/usr/local/bin", "$HOME/.local/bin", "$HOME/.cargo/bin"] {
                let dir = dir_template.replace("$HOME", &home);
                if !paths.iter().any(|p| *p == dir.as_str()) && std::path::Path::new(&dir).exists()
                {
                    suggestions.push(format!("'{}' exists but is not in PATH", dir));
                }
            }
        }

        if missing.is_empty() && suggestions.is_empty() {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: true,
                message: format!(
                    "Environment is properly configured ({} variable(s) checked)",
                    present.len()
                ),
                fix: None,
                severity: self.severity(),
            }
        } else if !missing.is_empty() {
            let missing_str: Vec<String> = missing
                .iter()
                .map(|(var, label)| format!("{} ({})", label, var))
                .collect();

            DoctorResult {
                check_id: self.id().to_string(),
                passed: false,
                message: format!(
                    "Missing required environment variables: {}",
                    missing_str.join(", ")
                ),
                fix: Some(DoctorFix {
                    description: format!(
                        "Set the following environment variables: {}",
                        missing.iter().map(|(v, _)| *v).collect::<Vec<&str>>().join(", ")
                    ),
                    kind: FixKind::RunCommand(
                        "echo 'Add to your shell rc file: export VAR=value'".into(),
                    ),
                }),
                severity: self.severity(),
            }
        } else {
            DoctorResult {
                check_id: self.id().to_string(),
                passed: true,
                message: format!(
                    "Environment is configured. Tips: {}",
                    suggestions.join("; ")
                ),
                fix: None,
                severity: DoctorSeverity::Low,
            }
        }
    }
}

// ─── DoctorSummary ─────────────────────────────────────────────────────────

/// Summary statistics for a diagnostic run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorSummary {
    /// Total checks run.
    pub total: usize,
    /// Number of passed checks.
    pub passed: usize,
    /// Number of failed checks.
    pub failed: usize,
    /// Number of critical failures.
    pub critical: usize,
    /// Number of high-severity failures.
    pub high: usize,
    /// Number of medium-severity failures.
    pub medium: usize,
    /// Number of low-severity failures.
    pub low: usize,
    /// When the diagnostic run started.
    pub started_at: Option<DateTime<Utc>>,
    /// When the diagnostic run finished.
    pub finished_at: Option<DateTime<Utc>>,
    /// How long the diagnostic took (wall-clock).
    pub duration_ms: Option<i64>,
}

impl std::fmt::Display for DoctorSummary {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} total | {} passed | {} failed | {} critical | {} high | {} medium | {} low",
            self.total, self.passed, self.failed, self.critical, self.high, self.medium, self.low
        )
    }
}

// ─── DoctorRunner ──────────────────────────────────────────────────────────

/// Runs all registered diagnostic checks and provides a health summary.
///
/// # Example
///
/// ```ignore
/// use airis_core::doctor::DoctorRunner;
///
/// let mut runner = DoctorRunner::new();
/// let results = runner.run_all().await;
/// println!("{}", runner.report());
/// ```
pub struct DoctorRunner {
    checks: Vec<Box<dyn DoctorCheck>>,
    results: Vec<DoctorResult>,
    started_at: Option<DateTime<Utc>>,
    finished_at: Option<DateTime<Utc>>,
}

impl DoctorRunner {
    /// Create a new `DoctorRunner` with the default set of checks.
    pub fn new() -> Self {
        let checks: Vec<Box<dyn DoctorCheck>> = vec![
            Box::new(ConfigCheck),
            Box::new(DepsCheck::default()),
            Box::new(ModelsCheck),
            Box::new(PluginsCheck),
            Box::new(PermissionsCheck),
            Box::new(NetworkCheck::default()),
            Box::new(CacheCheck),
            Box::new(GitCheck),
            Box::new(EnvCheck),
        ];

        Self {
            checks,
            results: Vec::new(),
            started_at: None,
            finished_at: None,
        }
    }

    /// Register an additional custom check.
    pub fn register(&mut self, check: Box<dyn DoctorCheck>) {
        self.checks.push(check);
    }

    /// Run all registered checks and store results.
    ///
    /// Returns a reference to the collected results.
    pub async fn run_all(&mut self) -> &[DoctorResult] {
        self.started_at = Some(Utc::now());
        let mut results = Vec::with_capacity(self.checks.len());

        for check in &self.checks {
            let result = check.run(self).await;
            if result.passed {
                debug!(
                    "[doctor] {} ({}) — PASSED: {}",
                    check.name(),
                    check.id(),
                    result.message
                );
            } else {
                warn!(
                    "[doctor] {} ({}) — FAILED: {}",
                    check.name(),
                    check.id(),
                    result.message
                );
            }
            results.push(result);
        }

        self.results = results;
        self.finished_at = Some(Utc::now());
        &self.results
    }

    /// Get the result of a previously run check by its ID.
    pub fn get_check_result(&self, check_id: &str) -> Option<&DoctorResult> {
        self.results.iter().find(|r| r.check_id == check_id)
    }

    /// Apply all available fixes for failed checks.
    ///
    /// Returns a list of results for each fix attempt.
    pub fn apply_fixes(&self) -> Vec<AirisResult<String>> {
        let mut fix_results = Vec::new();

        for result in &self.results {
            if result.passed {
                continue;
            }
            if let Some(fix) = &result.fix {
                info!(
                    "[doctor] Applying fix for {}: {}",
                    result.check_id, fix.description
                );
                let res = fix.apply();
                match &res {
                    Ok(msg) => info!("[doctor] Fix applied: {}", msg),
                    Err(e) => warn!("[doctor] Fix failed: {}", e),
                }
                fix_results.push(res);
            }
        }

        fix_results
    }

    /// Auto-repair: run all checks, apply fixes, then re-run checks.
    ///
    /// Returns the results from the final diagnostic pass.
    pub async fn auto_repair(&mut self) -> &[DoctorResult] {
        info!("[doctor] Running full diagnostic...");
        self.run_all().await;

        let failed_count = self.results.iter().filter(|r| !r.passed).count();
        if failed_count == 0 {
            info!("[doctor] All checks passed, no repair needed.");
            return &self.results;
        }

        info!(
            "[doctor] {} check(s) failed. Attempting auto-repair...",
            failed_count
        );
        let fix_results = self.apply_fixes();

        let fixed_count = fix_results.iter().filter(|r| r.is_ok()).count();
        info!(
            "[doctor] Applied {} fix(es) ({} successful, {} failed). Re-running checks...",
            fix_results.len(),
            fixed_count,
            fix_results.len() - fixed_count,
        );

        // Re-run checks after applying fixes
        self.run_all().await;
        &self.results
    }

    /// Get a summary of all check results.
    ///
    /// Requires [`run_all`](Self::run_all) or [`auto_repair`](Self::auto_repair)
    /// to have been called first.
    pub fn summary(&self) -> DoctorSummary {
        let total = self.results.len();
        let passed = self.results.iter().filter(|r| r.passed).count();
        let failed = total - passed;
        let critical = self
            .results
            .iter()
            .filter(|r| !r.passed && r.severity == DoctorSeverity::Critical)
            .count();
        let high = self
            .results
            .iter()
            .filter(|r| !r.passed && r.severity == DoctorSeverity::High)
            .count();
        let medium = self
            .results
            .iter()
            .filter(|r| !r.passed && r.severity == DoctorSeverity::Medium)
            .count();
        let low = self
            .results
            .iter()
            .filter(|r| !r.passed && r.severity == DoctorSeverity::Low)
            .count();

        let duration_ms = match (self.started_at, self.finished_at) {
            (Some(start), Some(end)) => {
                let dur = end - start;
                Some(dur.num_milliseconds())
            }
            _ => None,
        };

        DoctorSummary {
            total,
            passed,
            failed,
            critical,
            high,
            medium,
            low,
            started_at: self.started_at,
            finished_at: self.finished_at,
            duration_ms,
        }
    }

    /// Generate a human-readable report of all check results.
    ///
    /// Requires [`run_all`](Self::run_all) or [`auto_repair`](Self::auto_repair)
    /// to have been called first.
    pub fn report(&self) -> String {
        let summary = self.summary();
        let mut output = String::new();

        // Header
        output.push_str("╭─────────────────────────────────────────────╮\n");
        output.push_str("│        AIRIS-CLI Doctor Report              │\n");
        output.push_str("╰─────────────────────────────────────────────╯\n");

        if let (Some(start), Some(finish)) = (self.started_at, self.finished_at) {
            output.push_str(&format!(
                "  Started:  {}\n",
                start.format("%Y-%m-%d %H:%M:%S UTC")
            ));
            output.push_str(&format!(
                "  Finished: {}\n",
                finish.format("%Y-%m-%d %H:%M:%S UTC")
            ));
            let dur = finish - start;
            output.push_str(&format!(
                "  Duration: {}.{:03}s\n",
                dur.num_seconds(),
                dur.subsec_millis()
            ));
        }
        output.push('\n');

        // Summary bar
        output.push_str("  ─── Summary ───\n");
        output.push_str(&format!("  {}  {}  {}  {}  {}  {}  {}\n\n",
            colored("PASSED", summary.passed, ConsoleStyle::Passed),
            colored("FAILED", summary.failed, ConsoleStyle::Failed),
            colored("CRITICAL", summary.critical, ConsoleStyle::Critical),
            colored("HIGH", summary.high, ConsoleStyle::High),
            colored("MEDIUM", summary.medium, ConsoleStyle::Medium),
            colored("LOW", summary.low, ConsoleStyle::Low),
        ));

        // Individual results
        output.push_str("  ─── Results ───\n\n");
        for result in &self.results {
            let icon = if result.passed { "✓" } else { "✗" };
            let severity_label = format!("{}", result.severity);

            output.push_str(&format!("  [{icon}] {} — {}\n", result.check_id, result.message));
            output.push_str(&format!("        Severity: {severity_label}\n"));

            if !result.passed {
                if let Some(fix) = &result.fix {
                    output.push_str(&format!("        Fix: {}\n", fix.description));
                }
            }

            output.push('\n');
        }

        output
    }

    /// Get the list of registered check descriptors.
    pub fn check_descriptors(&self) -> Vec<CheckDescriptor> {
        self.checks
            .iter()
            .map(|c| CheckDescriptor {
                id: c.id().to_string(),
                name: c.name().to_string(),
                description: c.description().to_string(),
                severity: c.severity(),
            })
            .collect()
    }

    /// Get the raw results from the last run.
    pub fn results(&self) -> &[DoctorResult] {
        &self.results
    }
}

impl Default for DoctorRunner {
    fn default() -> Self {
        Self::new()
    }
}

// ─── CheckDescriptor ───────────────────────────────────────────────────────

/// Metadata about a registered check, without running it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckDescriptor {
    /// Unique identifier.
    pub id: String,
    /// Human-readable name.
    pub name: String,
    /// Description of what this check validates.
    pub description: String,
    /// Severity level.
    pub severity: DoctorSeverity,
}

// ─── Report Styling Helpers ────────────────────────────────────────────────

/// Terminal color/style constants for the doctor report.
#[allow(dead_code)]
enum ConsoleStyle {
    Passed,
    Failed,
    Critical,
    High,
    Medium,
    Low,
}

/// Produce a styled count string for the report summary line.
fn colored(label: &str, count: usize, _style: ConsoleStyle) -> String {
    // In plain text we just show the count; color codes are for terminal output.
    if count == 0 {
        format!("{}:0", label)
    } else {
        format!("{}:{}", label, count)
    }
}
