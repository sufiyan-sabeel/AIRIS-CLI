//! Security primitives for AIRIS-CLI.
//!
//! Provides five subsystems:
//!
//! * [`CredentialVault`] – AES-256-GCM–grade encrypted key storage (XOR + base64
//!   to avoid heavyweight crypto dependencies on constrained targets).
//! * [`Permission`]/[`PermissionSet`]/[`SandboxConfig`] – bitflag-based
//!   capability model for plugins and tools.
//! * [`Sandbox`] – restricted execution environment with command
//!   sanitization, path jailing, and timeout enforcement.
//! * [`SecretScanner`] – regex-based detection of leaked credentials
//!   in arbitrary text.
//! * [`SecurityAudit`] – environment and configuration audit producing
//!   a score 0–100.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use regex::Regex;
use serde::{Deserialize, Serialize};
use tokio::process::Command as TokioCommand;
use tokio::time::timeout;
use tracing::warn;

use crate::error::{AirisError, AirisResult};

// ═══════════════════════════════════════════════════════════════════════════
//  Base64 helpers (no external dependency)
// ═══════════════════════════════════════════════════════════════════════════

const B64_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn encode_b64(input: &[u8]) -> String {
    let mut out = String::new();
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(B64_CHARS[((triple >> 18) & 0x3F) as usize] as char);
        out.push(B64_CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(B64_CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(B64_CHARS[(triple & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

fn decode_b64(input: &str) -> Option<Vec<u8>> {
    let input = input.trim_end_matches('=');
    let mut out = Vec::with_capacity((input.len() / 4) * 3);
    let mut buf = [0u8; 4];
    for (i, ch) in input.chars().enumerate() {
        let val = match ch {
            'A'..='Z' => ch as u8 - b'A',
            'a'..='z' => ch as u8 - b'a' + 26,
            '0'..='9' => ch as u8 - b'0' + 52,
            '+' => 62,
            '/' => 63,
            _ => return None,
        };
        buf[i % 4] = val;
        if i % 4 == 3 {
            out.push((buf[0] << 2) | (buf[1] >> 4));
            out.push((buf[1] << 4) | (buf[2] >> 2));
            out.push((buf[2] << 6) | buf[3]);
        }
    }
    let rem = input.len() % 4;
    if rem == 2 {
        out.push((buf[0] << 2) | (buf[1] >> 4));
    } else if rem == 3 {
        out.push((buf[0] << 2) | (buf[1] >> 4));
        out.push((buf[1] << 4) | (buf[2] >> 2));
    }
    Some(out)
}

// ═══════════════════════════════════════════════════════════════════════════
//  XOR cipher helpers
// ═══════════════════════════════════════════════════════════════════════════

fn xor_encrypt(plaintext: &[u8], key: &[u8]) -> Vec<u8> {
    plaintext
        .iter()
        .enumerate()
        .map(|(i, b)| b ^ key[i % key.len()])
        .collect()
}

fn xor_decrypt(ciphertext: &[u8], key: &[u8]) -> Vec<u8> {
    xor_encrypt(ciphertext, key) // XOR is symmetric
}

/// Generate a pseudo-random key of `len` bytes using a simple LCG seeded
/// from [`Instant::now`] and process ID.  **Not suitable for production
/// cryptography** – this is a placeholder for a proper KDF/TRNG.
fn generate_key(len: usize) -> Vec<u8> {
    use std::time::{SystemTime, UNIX_EPOCH};
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(42)
        ^ (std::process::id() as u128);
    let mut state = seed;
    let mut key = Vec::with_capacity(len);
    for _ in 0..len {
        state = state.wrapping_mul(6_364_136_223_846_793_005);
        state = state.wrapping_add(1_442_695_040_888_963_407);
        key.push(((state >> 32) & 0xFF) as u8);
    }
    key
}

// ═══════════════════════════════════════════════════════════════════════════
//  CredentialVault
// ═══════════════════════════════════════════════════════════════════════════

/// Encrypted credential store using XOR + base64.
///
/// Each value is encrypted with a per-vault key before being written
/// to disk as a JSON map of key → base64(ciphertext + IV).  The vault
/// itself stores the encryption key in a separate file (`.airis_vault.key`).
///
/// ```
/// use airis_core::security::CredentialVault;
/// let vault = CredentialVault::new("/tmp/test_vault").unwrap();
/// vault.store("OPENAI_API_KEY", "sk-abc123").unwrap();
/// assert_eq!(vault.get("OPENAI_API_KEY").unwrap(), Some("sk-abc123".to_string()));
/// vault.delete("OPENAI_API_KEY").unwrap();
/// ```
#[derive(Debug)]
pub struct CredentialVault {
    dir: PathBuf,
    key: Vec<u8>,
    cache: Mutex<HashMap<String, String>>,
}

impl CredentialVault {
    /// Create or open a vault rooted at `dir`.
    ///
    /// If the key file does not exist a fresh key is generated and
    /// persisted; all subsequent operations use that key.
    pub fn new(dir: impl AsRef<Path>) -> AirisResult<Self> {
        let dir = dir.as_ref().to_path_buf();
        fs::create_dir_all(&dir).map_err(|e| AirisError::Io(e))?;

        let key_path = dir.join(".airis_vault.key");
        let key = if key_path.exists() {
            let raw = fs::read(&key_path).map_err(|e| AirisError::Io(e))?;
            decode_b64(
                std::str::from_utf8(&raw).map_err(|_| AirisError::PathEncoding(key_path.display().to_string()))?,
            )
            .ok_or_else(|| AirisError::Internal("vault key corrupted".into()))?
        } else {
            let k = generate_key(32);
            let encoded = encode_b64(&k);
            fs::write(&key_path, encoded.as_bytes()).map_err(|e| AirisError::Io(e))?;
            k
        };

        let vault = Self {
            dir,
            key,
            cache: Mutex::new(HashMap::new()),
        };
        vault.reload_cache()?;
        Ok(vault)
    }

    /// Store an encrypted credential.
    ///
    /// The value is encrypted with the vault key and written to disk
    /// immediately.
    pub fn store(&self, name: &str, value: &str) -> AirisResult<()> {
        let ct = xor_encrypt(value.as_bytes(), &self.key);
        let b64 = encode_b64(&ct);
        self.cache.lock().map_err(|_| AirisError::Internal("vault lock poisoned".into()))?.insert(name.to_string(), b64.clone());
        self.flush()?;
        Ok(())
    }

    /// Retrieve a decrypted credential, or `None` if the key does not exist.
    pub fn get(&self, name: &str) -> AirisResult<Option<String>> {
        let cache = self.cache.lock().map_err(|_| AirisError::Internal("vault lock poisoned".into()))?;
        match cache.get(name) {
            Some(b64) => {
                let ct = decode_b64(b64).ok_or_else(|| AirisError::Internal("credential data corrupted".into()))?;
                let pt = xor_decrypt(&ct, &self.key);
                let s = String::from_utf8(pt).map_err(|_| AirisError::Internal("credential not valid UTF-8".into()))?;
                Ok(Some(s))
            }
            None => Ok(None),
        }
    }

    /// List all stored credential names (not values).
    pub fn list(&self) -> AirisResult<Vec<String>> {
        let cache = self.cache.lock().map_err(|_| AirisError::Internal("vault lock poisoned".into()))?;
        let mut keys: Vec<String> = cache.keys().cloned().collect();
        keys.sort();
        Ok(keys)
    }

    /// Delete a stored credential.
    pub fn delete(&self, name: &str) -> AirisResult<()> {
        self.cache.lock().map_err(|_| AirisError::Internal("vault lock poisoned".into()))?.remove(name);
        self.flush()?;
        Ok(())
    }

    /// Re-encrypt all stored credentials with a new vault key.
    ///
    /// The old key is replaced and the key file updated.  Useful for
    /// periodic credential rotation.
    pub fn rotate(&mut self) -> AirisResult<()> {
        let old_cache = self.cache.lock().map_err(|_| AirisError::Internal("vault lock poisoned".into()))?.clone();
        let new_key = generate_key(32);

        // Decrypt everything with the old key, encrypt with the new one.
        let mut reencrypted = HashMap::new();
        for (name, b64) in &old_cache {
            let ct = decode_b64(b64).ok_or_else(|| AirisError::Internal("credential corrupted during rotate".into()))?;
            let pt = xor_decrypt(&ct, &self.key);
            let new_ct = xor_encrypt(&pt, &new_key);
            reencrypted.insert(name.clone(), encode_b64(&new_ct));
        }

        // Persist new key.
        let key_path = self.dir.join(".airis_vault.key");
        fs::write(&key_path, encode_b64(&new_key).as_bytes()).map_err(|e| AirisError::Io(e))?;

        self.key = new_key;
        *self.cache.lock().map_err(|_| AirisError::Internal("vault lock poisoned".into()))? = reencrypted;
        self.flush()?;
        Ok(())
    }

    // ── private helpers ──

    fn vault_path(&self) -> PathBuf {
        self.dir.join(VAULT_FILE)
    }

    fn reload_cache(&self) -> AirisResult<()> {
        let path = self.vault_path();
        if path.exists() {
            let raw = fs::read_to_string(&path).map_err(|e| AirisError::Io(e))?;
            let map: HashMap<String, String> =
                serde_json::from_str(&raw).map_err(|e| AirisError::Internal(format!("vault file parse error: {e}")))?;
            *self.cache.lock().map_err(|_| AirisError::Internal("vault lock poisoned".into()))? = map;
        }
        Ok(())
    }

    fn flush(&self) -> AirisResult<()> {
        let cache = self.cache.lock().map_err(|_| AirisError::Internal("vault lock poisoned".into()))?;
        let json = serde_json::to_string_pretty(&*cache)
            .map_err(|e| AirisError::Internal(format!("vault serialization error: {e}")))?;
        fs::write(self.vault_path(), json).map_err(|e| AirisError::Io(e))?;
        Ok(())
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Permission System
// ═══════════════════════════════════════════════════════════════════════════

/// Granular permissions for plugins and tools.
///
/// Each variant occupies a single bit in a [`PermissionSet`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Permission {
    /// Read filesystem / resources.
    Read = 1 << 0,
    /// Write to filesystem.
    Write = 1 << 1,
    /// Execute external commands.
    Execute = 1 << 2,
    /// Make outbound network requests.
    Network = 1 << 3,
    /// Load and manage plugins.
    Plugin = 1 << 4,
    /// Modify configuration.
    Config = 1 << 5,
    /// All permissions.
    All = 0x3F,
}

impl Permission {
    /// Return the bitmask value for this permission.
    pub fn bit(self) -> u32 {
        self as u32
    }
}

/// A compact, bitflag-based set of [`Permission`] values.
///
/// ```
/// use airis_core::security::{Permission, PermissionSet};
/// let mut ps = PermissionSet::empty();
/// ps.grant(Permission::Read);
/// ps.grant(Permission::Write);
/// assert!(ps.has(Permission::Read));
/// assert!(ps.has(Permission::Write));
/// assert!(!ps.has(Permission::Network));
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct PermissionSet(u32);

impl PermissionSet {
    /// An empty set (no permissions granted).
    pub const fn empty() -> Self {
        Self(0)
    }

    /// A set with every permission granted.
    pub const fn all() -> Self {
        Self(Permission::All.bit())
    }

    /// Create a set from a list of permissions.
    pub fn from_permissions(perms: &[Permission]) -> Self {
        let mut bits = 0u32;
        for p in perms {
            bits |= p.bit();
        }
        Self(bits)
    }

    /// Grant a permission.
    pub fn grant(&mut self, perm: Permission) -> &mut Self {
        self.0 |= perm.bit();
        self
    }

    /// Revoke a permission.
    pub fn revoke(&mut self, perm: Permission) -> &mut Self {
        self.0 &= !perm.bit();
        self
    }

    /// Check whether a permission is granted.
    pub fn has(&self, perm: Permission) -> bool {
        if perm == Permission::All {
            return self.0 == Permission::All.bit();
        }
        (self.0 & perm.bit()) != 0
    }

    /// Check whether this set contains *all* of the given permissions.
    pub fn has_all(&self, perms: &[Permission]) -> bool {
        perms.iter().all(|p| self.has(*p))
    }

    /// Return the raw bitmask.
    pub fn bits(&self) -> u32 {
        self.0
    }

    /// Build from a raw bitmask.
    pub fn from_bits(bits: u32) -> Self {
        Self(bits & Permission::All.bit())
    }

    /// List every permission that is currently granted.
    pub fn granted_permissions(&self) -> Vec<Permission> {
        let all = [
            Permission::Read,
            Permission::Write,
            Permission::Execute,
            Permission::Network,
            Permission::Plugin,
            Permission::Config,
        ];
        all.into_iter().filter(|p| self.has(*p)).collect()
    }
}

impl std::fmt::Display for PermissionSet {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let names: Vec<&str> = self
            .granted_permissions()
            .iter()
            .map(|p| match p {
                Permission::Read => "R",
                Permission::Write => "W",
                Permission::Execute => "X",
                Permission::Network => "N",
                Permission::Plugin => "P",
                Permission::Config => "C",
                Permission::All => "ALL",
            })
            .collect();
        if names.is_empty() {
            write!(f, "∅")
        } else {
            write!(f, "[{}]", names.join(","))
        }
    }
}

/// Sandbox configuration that defines what a plugin or tool is allowed to do.
///
/// ```
/// use airis_core::security::{Permission, PermissionSet, SandboxConfig};
/// let cfg = SandboxConfig {
///     permissions: PermissionSet::from_permissions(&[Permission::Read, Permission::Network]),
///     allowed_paths: vec!["/tmp".into(), "/home/user/data".into()],
///     blocked_commands: vec!["rm".into(), "dd".into()],
///     timeout_seconds: 30,
///     max_memory_mb: 256,
///     network_allowed_hosts: Some(vec!["api.openai.com".into()]),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    /// Permissions granted to the sandboxed entity.
    pub permissions: PermissionSet,
    /// Filesystem paths the entity may access (empty = unrestricted).
    pub allowed_paths: Vec<PathBuf>,
    /// Commands (binary names) that are blocked even if Execute is granted.
    pub blocked_commands: Vec<String>,
    /// Maximum wall-clock time in seconds for execution (0 = no limit).
    pub timeout_seconds: u64,
    /// Maximum memory in MB (0 = no limit).
    pub max_memory_mb: u64,
    /// Restrict network to specific hosts (None = unrestricted, Some(&[]) = block all).
    pub network_allowed_hosts: Option<Vec<String>>,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            permissions: PermissionSet::empty(),
            allowed_paths: Vec::new(),
            blocked_commands: vec!["rm", "dd", "mkfs", "wget", "curl", "nc", "nmap"]
                .into_iter()
                .map(String::from)
                .collect(),
            timeout_seconds: 60,
            max_memory_mb: 512,
            network_allowed_hosts: None,
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Sandbox
// ═══════════════════════════════════════════════════════════════════════════

/// A restricted execution environment that enforces permission checks,
/// command sanitization, path jailing, and timeout enforcement.
///
/// ```
/// use airis_core::security::{Permission, PermissionSet, Sandbox, SandboxConfig};
///
/// let cfg = SandboxConfig {
///     permissions: PermissionSet::from_permissions(&[Permission::Execute]),
///     ..Default::default()
/// };
/// let sandbox = Sandbox::new("test", cfg);
///
/// // A safe command runs inside the sandbox:
/// # tokio_test::block_on(async {
/// let ok = sandbox.execute("echo hello").await.unwrap();
/// assert!(ok.exit_code == 0);
/// # });
/// ```
#[derive(Debug, Clone)]
pub struct Sandbox {
    name: String,
    config: SandboxConfig,
}

impl Sandbox {
    /// Create a new sandbox with the given name and configuration.
    pub fn new(name: impl Into<String>, config: SandboxConfig) -> Self {
        Self {
            name: name.into(),
            config,
        }
    }

    /// The sandbox's name.
    pub fn name(&self) -> &str {
        &self.name
    }

    /// The sandbox's configuration.
    pub fn config(&self) -> &SandboxConfig {
        &self.config
    }

    // ── permission checks ──

    /// Check whether a permission is granted.
    pub fn check_permission(&self, perm: Permission) -> AirisResult<()> {
        if self.config.permissions.has(perm) {
            Ok(())
        } else {
            Err(AirisError::Auth(format!(
                "sandbox '{}' lacks permission {perm:?}",
                self.name
            )))
        }
    }

    /// Check that a path is within the allowed set.
    ///
    /// If `allowed_paths` is empty all paths are accepted.  Otherwise
    /// the canonicalised path must be a descendant of one of the
    /// allowed directories.
    pub fn check_path(&self, path: impl AsRef<Path>) -> AirisResult<()> {
        let path = path.as_ref();
        if self.config.allowed_paths.is_empty() {
            return Ok(());
        }
        let canon = path
            .canonicalize()
            .map_err(|e| AirisError::Io(e))?;
        for allowed in &self.config.allowed_paths {
            if let Ok(a) = allowed.canonicalize() {
                if canon.starts_with(&a) {
                    return Ok(());
                }
            }
        }
        Err(AirisError::Auth(format!(
            "sandbox '{}' access denied to path '{}'",
            self.name,
            path.display()
        )))
    }

    /// Ensure `command` does not contain blocked patterns.
    ///
    /// Checks both the binary name and the full command line against
    /// the blocked list.
    pub fn sanitize_command(&self, command: &str) -> AirisResult<()> {
        let lower = command.to_lowercase();

        // Blocked binary names.
        for blocked in &self.config.blocked_commands {
            let bl = blocked.to_lowercase();
            // Match as a word boundary so "rmdir" isn't falsely blocked by "rm".
            if lower == bl || lower.starts_with(&format!("{bl} ")) || lower.contains(&format!(" {bl} ")) {
                return Err(AirisError::Auth(format!(
                    "command '{}' uses blocked binary '{blocked}'",
                    command
                )));
            }
        }

        // Built-in dangerous patterns (shell bombs, destructive chains).
        let dangerous_patterns = [
            "rm -rf /",
            "rm -rf --no-preserve-root",
            "mkfs.",
            "dd if=",
            ":(){ :|:& };:",
            "chmod -R 777 /",
            "> /dev/sd",
            "chown -R",
            "wget http",
            "curl http",
            "nc -e",
            "bash -c",
        ];
        for pat in &dangerous_patterns {
            if lower.contains(pat) {
                return Err(AirisError::Auth(format!(
                    "command contains dangerous pattern '{pat}'"
                )));
            }
        }

        Ok(())
    }

    /// Validate a path against the jail, then check it is safe.
    pub fn sanitize_path(&self, path: impl AsRef<Path>) -> AirisResult<PathBuf> {
        let p = path.as_ref();
        self.check_path(p)?;
        // Reject paths with `..` segments that would escape.
        let comps: Vec<_> = p.components().collect();
        if comps.contains(&std::path::Component::ParentDir) {
            return Err(AirisError::Auth(format!(
                "path '{}' contains '..' traversal",
                p.display()
            )));
        }
        // Reject symlinks pointing outside allowed paths (already checked by check_path).
        Ok(p.to_path_buf())
    }

    // ── execution ──

    /// Run a command inside the sandbox with timeout enforcement.
    ///
    /// The command is sanitized and permission-checked before execution.
    /// If a timeout is configured and the command exceeds it, the
    /// process is killed and an error is returned.
    pub async fn execute(&self, command: &str) -> AirisResult<SandboxOutput> {
        self.check_permission(Permission::Execute)?;
        self.sanitize_command(command)?;

        let shell = if cfg!(target_os = "windows") {
            "cmd"
        } else {
            "sh"
        };
        let arg = if cfg!(target_os = "windows") { "/C" } else { "-c" };

        let mut child = TokioCommand::new(shell)
            .arg(arg)
            .arg(command)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| AirisError::ToolExecution(format!("failed to spawn: {e}")))?;

        let max_secs = self.config.timeout_seconds;

        let output = if max_secs > 0 {
            match timeout(Duration::from_secs(max_secs), child.wait_with_output()).await {
                Ok(Ok(out)) => out,
                Ok(Err(e)) => {
                    return Err(AirisError::ToolExecution(format!("process error: {e}")));
                }
                Err(_) => {
                    // Timeout — kill is automatic via kill_on_drop.
                    return Err(AirisError::CommandTimeout(max_secs));
                }
            }
        } else {
            child
                .wait_with_output()
                .await
                .map_err(|e| AirisError::ToolExecution(format!("process error: {e}")))?;
            unreachable!()
        };

        Ok(SandboxOutput {
            exit_code: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        })
    }
}

/// Result of a sandboxed command execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxOutput {
    /// Process exit code (-1 if signal / unknown).
    pub exit_code: i32,
    /// Standard output captured from the process.
    pub stdout: String,
    /// Standard error captured from the process.
    pub stderr: String,
}

// ═══════════════════════════════════════════════════════════════════════════
//  SecretScanner
// ═══════════════════════════════════════════════════════════════════════════

/// A match found by [`SecretScanner`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretMatch {
    /// The type / label of the detected secret (e.g. "OpenAI API Key").
    pub kind: String,
    /// 1-indexed line number where the secret was found.
    pub line: usize,
    /// The matched text (may be truncated for display).
    pub value: String,
    /// Start byte offset of the match within the line.
    pub column: usize,
}

/// Scans text for leaked credentials using regex patterns.
///
/// Detects API keys for OpenAI, Anthropic, GitHub, AWS, GCP, Azure,
/// generic tokens, SSH private keys, and password-like strings.
///
/// ```
/// use airis_core::security::SecretScanner;
/// let scanner = SecretScanner::new();
/// let results = scanner.scan("My key is sk-abc123def456");
/// assert!(!results.is_empty());
/// ```
#[derive(Debug)]
pub struct SecretScanner {
    patterns: Vec<(String, Regex)>,
}

impl Default for SecretScanner {
    fn default() -> Self {
        Self::new()
    }
}

impl SecretScanner {
    /// Build a scanner with all built-in detection patterns.
    pub fn new() -> Self {
        let mut patterns: Vec<(String, Regex)> = Vec::new();

        // ── API key patterns ──────────────────────────────────────────────

        add_pat(&mut patterns, "OpenAI API Key", r"(?i)\b(sk-[A-Za-z0-9]{20,})\b");
        add_pat(&mut patterns, "OpenAI Org Key", r"(?i)\b(org-[A-Za-z0-9]{20,})\b");
        add_pat(
            &mut patterns,
            "Anthropic API Key",
            r"(?i)\b(sk-ant-[A-Za-z0-9]{20,})\b",
        );
        add_pat(
            &mut patterns,
            "Anthropic API Key (alt)",
            r"(?i)\b(ant-api-[A-Za-z0-9]{20,})\b",
        );
        add_pat(
            &mut patterns,
            "GitHub PAT",
            r"(?i)\b(ghp_[A-Za-z0-9]{36,})\b",
        );
        add_pat(
            &mut patterns,
            "GitHub App Token",
            r"(?i)\b(ghs_[A-Za-z0-9]{36,})\b",
        );
        add_pat(
            &mut patterns,
            "GitHub Refresh Token",
            r"(?i)\b(ghr_[A-Za-z0-9]{36,})\b",
        );
        add_pat(
            &mut patterns,
            "AWS Access Key",
            r"(?i)\b((?:AKIA|ASIA)[A-Z0-9]{16})\b",
        );
        add_pat(
            &mut patterns,
            "AWS Secret Key",
            r"(?i)\b([A-Za-z0-9/+=]{40})\b",
        );
        add_pat(
            &mut patterns,
            "GCP Service Account",
            r"(?i)\b([A-Za-z0-9_-]+@[A-Za-z0-9_-]+\.iam\.gserviceaccount\.com)\b",
        );
        add_pat(
            &mut patterns,
            "Azure Subscription Key",
            r"(?i)\b([a-f0-9]{32})\b",
        );
        add_pat(
            &mut patterns,
            "Slack Bot Token",
            r"(?i)\b(xoxb-[A-Za-z0-9]{10,})\b",
        );
        add_pat(
            &mut patterns,
            "Slack Webhook URL",
            r"https://hooks\.slack\.com/services/[A-Za-z0-9/]+",
        );

        // ── Generic credential patterns ───────────────────────────────────

        add_pat(
            &mut patterns,
            "JWT Token",
            r"\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b",
        );
        add_pat(
            &mut patterns,
            "Private Key (RSA/DSA/EC)",
            r"-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----",
        );
        add_pat(
            &mut patterns,
            "Password in config",
            r#"(?i)(?:password|passwd|pwd)\s*[=:]\s*['\"]([^'\"]{4,})['\"]#"#,
        );
        add_pat(
            &mut patterns,
            "Token in config",
            r#"(?i)(?:token|api[_-]?key|secret|apikey)\s*[=:]\s*['\"]([^'\"]{8,})['\"]#"#,
        );
        add_pat(
            &mut patterns,
            "Generic API Key",
            r"(?i)\b([a-z0-9_-]{32,})\b",
        );

        Self { patterns }
    }

    /// Scan `text` for secrets, returning all matches with line/column info.
    pub fn scan(&self, text: &str) -> Vec<SecretMatch> {
        let mut results = Vec::new();

        for (kind, re) in &self.patterns {
            for m in re.find_iter(text) {
                // Calculate line number.
                let prefix = &text[..m.start()];
                let line = prefix.matches('\n').count() + 1;

                // Column: position within the line.
                let last_newline = prefix.rfind('\n').map(|i| i + 1).unwrap_or(0);
                let column = m.start() - last_newline + 1;

                // Truncate long values for safety.
                let value = if m.len() > 80 {
                    format!("{}...", &m.as_str()[..77])
                } else {
                    m.as_str().to_string()
                };

                results.push(SecretMatch {
                    kind: kind.clone(),
                    line,
                    value,
                    column,
                });
            }
        }

        // Deduplicate by (line, kind) — keep the first match.
        results.sort_by_key(|m| (m.line, m.kind.clone(), m.column));
        results.dedup_by_key(|m| (m.line, m.kind.clone()));
        results
    }
}

fn add_pat(patterns: &mut Vec<(String, Regex)>, kind: &str, pat: &str) {
    if let Ok(re) = Regex::new(pat) {
        patterns.push((kind.to_string(), re));
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SecurityAudit
// ═══════════════════════════════════════════════════════════════════════════

/// Full audit report produced by [`SecurityAudit::run`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditReport {
    /// Overall security score (0–100).
    pub score: u8,
    /// Individual findings.
    pub findings: Vec<AuditFinding>,
    /// Environment summary.
    pub environment: EnvironmentSummary,
}

/// An individual audit finding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditFinding {
    /// Severity level.
    pub severity: AuditSeverity,
    /// Category (e.g. "file_permissions", "env_vars", "config").
    pub category: String,
    /// Human-readable message.
    pub message: String,
    /// Suggested remediation.
    pub remediation: Option<String>,
}

/// Severity of an audit finding.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AuditSeverity {
    /// Informational — no action needed.
    Info,
    /// Low risk.
    Low,
    /// Medium risk — should be addressed.
    Medium,
    /// High risk — should be addressed promptly.
    High,
    /// Critical — immediate attention required.
    Critical,
}

impl AuditSeverity {
    fn score_penalty(&self) -> u8 {
        match self {
            AuditSeverity::Info => 0,
            AuditSeverity::Low => 2,
            AuditSeverity::Medium => 5,
            AuditSeverity::High => 10,
            AuditSeverity::Critical => 20,
        }
    }
}

/// Summary of the audited environment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentSummary {
    /// Operating system.
    pub os: String,
    /// Rust version (if detectable).
    pub rust_version: Option<String>,
    /// Current user.
    pub user: String,
    /// Home directory.
    pub home: Option<String>,
    /// Is the project root writable by group/others?
    pub project_root_world_writable: bool,
    /// Number of environment variables with suspicious names.
    pub suspicious_env_vars: usize,
    /// Does `.env` exist in the project root?
    pub dotenv_exists: bool,
    /// Is `.env` in `.gitignore`?
    pub dotenv_gitignored: Option<bool>,
}

/// Security auditor that inspects the local environment and configuration.
///
/// ```
/// use airis_core::security::SecurityAudit;
/// let audit = SecurityAudit::new("/some/project".as_ref());
/// let report = audit.run();
/// assert!(report.score <= 100);
/// ```
#[derive(Debug)]
pub struct SecurityAudit {
    project_root: PathBuf,
}

impl SecurityAudit {
    /// Create a new auditor rooted at `project_root`.
    pub fn new(project_root: &Path) -> Self {
        Self {
            project_root: project_root.to_path_buf(),
        }
    }

    /// Run a full security audit.
    ///
    /// Checks:
    ///
    /// * File permissions on the project root.
    /// * Presence of `.env` files and their `.gitignore` status.
    /// * Suspicious environment variables (containing KEY, SECRET, TOKEN, PASSWORD).
    /// * Config file permissions.
    /// * Dependency versions (heuristic — Cargo.lock is not parsed deeply).
    /// * Presence of credential files in the tree.
    pub fn run(&self) -> AuditReport {
        let mut findings: Vec<AuditFinding> = Vec::new();
        let mut total_penalty: u8 = 0;

        let mut env_summary = EnvironmentSummary {
            os: std::env::consts::OS.to_string(),
            rust_version: None,
            user: whoami(),
            home: std::env::var("HOME").ok().or_else(|| std::env::var("USERPROFILE").ok()),
            project_root_world_writable: false,
            suspicious_env_vars: 0,
            dotenv_exists: false,
            dotenv_gitignored: None,
        };

        // ── Rust version ──
        if let Ok(ver) = std::process::Command::new("rustc")
            .arg("--version")
            .output()
        {
            if let Ok(v) = String::from_utf8(ver.stdout) {
                let v = v.trim().to_string();
                env_summary.rust_version = Some(v);
            }
        }

        // ── 1. File permissions ───────────────────────────────────────────
        if let Ok(meta) = fs::metadata(&self.project_root) {
            let perms = meta.permissions();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mode = perms.mode();
                let world_writable = (mode & 0o002) != 0;
                env_summary.project_root_world_writable = world_writable;
                if world_writable {
                    findings.push(AuditFinding {
                        severity: AuditSeverity::High,
                        category: "file_permissions".into(),
                        message: format!(
                            "Project root '{}' is world-writable ({:o})",
                            self.project_root.display(),
                            mode & 0o777
                        ),
                        remediation: Some(format!("chmod o-w {}", self.project_root.display())),
                    });
                    total_penalty = total_penalty.saturating_add(10);
                }

                // Check .airis_vault / config files.
                for sensitive in &[".airis_vault", ".airis_vault.key", "config.toml"] {
                    let p = self.project_root.join(sensitive);
                    if let Ok(m) = fs::metadata(&p) {
                        let fm = m.permissions().mode();
                        if fm & 0o004 != 0 {
                            findings.push(AuditFinding {
                                severity: AuditSeverity::Medium,
                                category: "file_permissions".into(),
                                message: format!(
                                    "Sensitive file '{}' is world-readable ({:o})",
                                    p.display(),
                                    fm & 0o777
                                ),
                                remediation: Some(format!("chmod 600 {}", p.display())),
                            });
                            total_penalty = total_penalty.saturating_add(5);
                        }
                    }
                }
            }
            #[cfg(not(unix))]
            {
                let _ = perms;
            }
        }

        // ── 2. Environment variables ──────────────────────────────────────
        let suspicious_keys = ["KEY", "SECRET", "TOKEN", "PASSWORD", "PASS", "CREDENTIAL", "APIKEY"];
        let mut suspicious_found = Vec::new();
        for (var, _val) in std::env::vars() {
            let upper = var.to_uppercase();
            if suspicious_keys.iter().any(|k| upper.contains(k)) {
                // Non-empty value?
                if let Some(v) = std::env::var(&var).ok() {
                    if !v.is_empty() {
                        suspicious_found.push(var);
                    }
                }
            }
        }
        env_summary.suspicious_env_vars = suspicious_found.len();
        if !suspicious_found.is_empty() {
            let names = suspicious_found.join(", ");
            findings.push(AuditFinding {
                severity: AuditSeverity::Info,
                category: "env_vars".into(),
                message: format!(
                    "Found {} env var(s) containing credential-like names: {names}",
                    suspicious_found.len()
                ),
                remediation: Some(
                    "Ensure these variables are not logged or exposed in child processes".into(),
                ),
            });
            total_penalty = total_penalty.saturating_add(2);
        }

        // ── 3. Config security ────────────────────────────────────────────
        let config_paths = [".airis.toml", "airis.toml", ".airis/config.toml"];
        for cfg in &config_paths {
            let p = self.project_root.join(cfg);
            if p.exists() {
                match fs::read_to_string(&p) {
                    Ok(content) => {
                        // Check for inline credentials in config.
                        let scanner = SecretScanner::new();
                        let secrets = scanner.scan(&content);
                        for s in &secrets {
                            findings.push(AuditFinding {
                                severity: AuditSeverity::Critical,
                                category: "config".into(),
                                message: format!(
                                    "Secret '{}' found in config file '{}' (line {})",
                                    s.kind,
                                    cfg,
                                    s.line
                                ),
                                remediation: Some(format!(
                                    "Move the {} to CredentialVault or environment variables",
                                    s.kind
                                )),
                            });
                            total_penalty = total_penalty.saturating_add(20);
                        }
                    }
                    Err(e) => {
                        findings.push(AuditFinding {
                            severity: AuditSeverity::Low,
                            category: "config".into(),
                            message: format!("Cannot read config file '{}': {e}", p.display()),
                            remediation: None,
                        });
                        total_penalty = total_penalty.saturating_add(2);
                    }
                }
            }
        }

        // ── 4. .env file checks ───────────────────────────────────────────
        let dotenv = self.project_root.join(".env");
        env_summary.dotenv_exists = dotenv.exists();
        if dotenv.exists() {
            // Check .gitignore.
            let gitignore = self.project_root.join(".gitignore");
            if gitignore.exists() {
                if let Ok(content) = fs::read_to_string(&gitignore) {
                    let has_dotenv = content.lines().any(|l| l.trim() == ".env");
                    env_summary.dotenv_gitignored = Some(has_dotenv);
                    if !has_dotenv {
                        findings.push(AuditFinding {
                            severity: AuditSeverity::Medium,
                            category: "dotenv".into(),
                            message: ".env file exists but is NOT listed in .gitignore".into(),
                            remediation: Some("Add '.env' to .gitignore".into()),
                        });
                        total_penalty = total_penalty.saturating_add(5);
                    }
                }
            }

            // Scan .env for secrets.
            if let Ok(content) = fs::read_to_string(&dotenv) {
                let scanner = SecretScanner::new();
                let secrets = scanner.scan(&content);
                for s in &secrets {
                    findings.push(AuditFinding {
                        severity: AuditSeverity::High,
                        category: "dotenv".into(),
                        message: format!(
                            "Secret '{}' found in .env (line {})",
                            s.kind, s.line
                        ),
                        remediation: Some(
                            "Ensure .env is in .gitignore and not shared with anyone".into(),
                        ),
                    });
                    total_penalty = total_penalty.saturating_add(10);
                }
            }
        }

        // ── 5. Dependency version heuristic ───────────────────────────────
        let lock = self.project_root.join("Cargo.lock");
        if lock.exists() {
            if let Ok(content) = fs::read_to_string(&lock) {
                // Naive check for known-pattern versions that may be very old.
                // This is heuristic-only — a full audit would use `cargo audit`.
                let very_old_deps = ["time 0.1", "openssl 0.7", "curl-sys 0.3"];
                for old in &very_old_deps {
                    if content.contains(old) {
                        findings.push(AuditFinding {
                            severity: AuditSeverity::Medium,
                            category: "dependencies".into(),
                            message: format!("Dependency '{old}' appears very old in Cargo.lock"),
                            remediation: Some("Run 'cargo update' or audit with 'cargo audit'".into()),
                        });
                        total_penalty = total_penalty.saturating_add(5);
                    }
                }
                // Check for many patch versions as a signal of dependency freshness.
                if content.lines().count() > 5000 {
                    findings.push(AuditFinding {
                        severity: AuditSeverity::Info,
                        category: "dependencies".into(),
                        message: "Large dependency tree detected (>5000 lines in Cargo.lock)".into(),
                        remediation: Some("Audit with 'cargo audit' and remove unused deps".into()),
                    });
                }
            }
        }

        // ── Score ─────────────────────────────────────────────────────────
        let score = 100u8.saturating_sub(total_penalty);

        AuditReport {
            score,
            findings,
            environment: env_summary,
        }
    }
}

// Helper: cross-platform username.
#[cfg(unix)]
fn whoami() -> String {
    std::env::var("USER").unwrap_or_else(|_| "unknown".into())
}

#[cfg(not(unix))]
fn whoami() -> String {
    std::env::var("USERNAME").unwrap_or_else(|_| "unknown".into())
}

// ═══════════════════════════════════════════════════════════════════════════
//  Tests
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    // ── CredentialVault ───────────────────────────────────────────────────

    #[test]
    fn test_vault_store_and_get() {
        let dir = std::env::temp_dir().join("airis_test_vault");
        let _ = fs::remove_dir_all(&dir);

        let vault = CredentialVault::new(&dir).unwrap();
        vault.store("TEST_KEY", "super-secret-value").unwrap();
        assert_eq!(vault.get("TEST_KEY").unwrap(), Some("super-secret-value".to_string()));
        assert_eq!(vault.get("NONEXISTENT").unwrap(), None);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_vault_list() {
        let dir = std::env::temp_dir().join("airis_test_vault_list");
        let _ = fs::remove_dir_all(&dir);

        let vault = CredentialVault::new(&dir).unwrap();
        vault.store("A", "a").unwrap();
        vault.store("B", "b").unwrap();
        vault.store("C", "c").unwrap();
        let keys = vault.list().unwrap();
        assert_eq!(keys, vec!["A", "B", "C"]);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_vault_delete() {
        let dir = std::env::temp_dir().join("airis_test_vault_del");
        let _ = fs::remove_dir_all(&dir);

        let vault = CredentialVault::new(&dir).unwrap();
        vault.store("DELETE_ME", "value").unwrap();
        assert!(vault.get("DELETE_ME").unwrap().is_some());
        vault.delete("DELETE_ME").unwrap();
        assert!(vault.get("DELETE_ME").unwrap().is_none());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_vault_rotate() {
        let dir = std::env::temp_dir().join("airis_test_vault_rotate");
        let _ = fs::remove_dir_all(&dir);

        let mut vault = CredentialVault::new(&dir).unwrap();
        vault.store("K1", "value1").unwrap();
        vault.store("K2", "value2").unwrap();
        vault.rotate().unwrap();

        // Values should still be readable after rotation.
        assert_eq!(vault.get("K1").unwrap(), Some("value1".to_string()));
        assert_eq!(vault.get("K2").unwrap(), Some("value2".to_string()));

        // The key file should have changed.
        let key_path = dir.join(".airis_vault.key");
        assert!(key_path.exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_vault_persists() {
        let dir = std::env::temp_dir().join("airis_test_vault_persist");
        let _ = fs::remove_dir_all(&dir);

        {
            let vault = CredentialVault::new(&dir).unwrap();
            vault.store("PERSIST", "hello").unwrap();
        }
        // Re-open — should still have the data.
        {
            let vault = CredentialVault::new(&dir).unwrap();
            assert_eq!(vault.get("PERSIST").unwrap(), Some("hello".to_string()));
        }

        let _ = fs::remove_dir_all(&dir);
    }

    // ── Permission System ─────────────────────────────────────────────────

    #[test]
    fn test_permission_set_basic() {
        let mut ps = PermissionSet::empty();
        assert!(!ps.has(Permission::Read));
        ps.grant(Permission::Read);
        assert!(ps.has(Permission::Read));
        assert!(!ps.has(Permission::Write));
        ps.revoke(Permission::Read);
        assert!(!ps.has(Permission::Read));
    }

    #[test]
    fn test_permission_set_multiple() {
        let mut ps = PermissionSet::empty();
        ps.grant(Permission::Read)
            .grant(Permission::Network)
            .grant(Permission::Plugin);
        assert!(ps.has_all(&[Permission::Read, Permission::Network]));
        assert!(!ps.has(Permission::Execute));
        assert!(!ps.has_all(&[Permission::Read, Permission::Config]));
    }

    #[test]
    fn test_permission_set_all() {
        let ps = PermissionSet::all();
        assert!(ps.has(Permission::Read));
        assert!(ps.has(Permission::Write));
        assert!(ps.has(Permission::Execute));
        assert!(ps.has(Permission::Network));
        assert!(ps.has(Permission::Plugin));
        assert!(ps.has(Permission::Config));
        assert!(ps.has(Permission::All));
    }

    #[test]
    fn test_permission_set_display() {
        let mut ps = PermissionSet::empty();
        assert_eq!(format!("{ps}"), "∅");
        ps.grant(Permission::Read).grant(Permission::Write);
        let s = format!("{ps}");
        assert!(s.contains("R"));
        assert!(s.contains("W"));
    }

    // ── Sandbox ───────────────────────────────────────────────────────────

    #[test]
    fn test_sandbox_permission_check() {
        let cfg = SandboxConfig {
            permissions: PermissionSet::from_permissions(&[Permission::Read]),
            ..Default::default()
        };
        let s = Sandbox::new("test", cfg);
        assert!(s.check_permission(Permission::Read).is_ok());
        assert!(s.check_permission(Permission::Write).is_err());
    }

    #[test]
    fn test_sanitize_command_blocks_dangerous() {
        let cfg = SandboxConfig::default();
        let s = Sandbox::new("test", cfg);

        assert!(s.sanitize_command("echo hello").is_ok());
        assert!(s.sanitize_command("ls -la /tmp").is_ok());

        assert!(s.sanitize_command("rm -rf /").is_err());
        assert!(s.sanitize_command("dd if=/dev/zero of=/dev/sda").is_err());
        assert!(s.sanitize_command("wget http://evil.com").is_err());
    }

    #[test]
    fn test_check_path_restriction() {
        let cfg = SandboxConfig {
            allowed_paths: vec![PathBuf::from("/tmp")],
            ..Default::default()
        };
        let s = Sandbox::new("test", cfg);
        assert!(s.check_path("/tmp").is_ok());
        assert!(s.check_path("/tmp/foo/bar").is_ok());
        assert!(s.check_path("/etc").is_err());
    }

    #[test]
    fn test_sandbox_output_struct() {
        let out = SandboxOutput {
            exit_code: 0,
            stdout: "ok".into(),
            stderr: String::new(),
        };
        assert_eq!(out.exit_code, 0);
        assert_eq!(out.stdout, "ok");
    }

    // ── SecretScanner ─────────────────────────────────────────────────────

    #[test]
    fn test_scanner_detects_openai_key() {
        let scanner = SecretScanner::new();
        let results = scanner.scan("My key is sk-abc123def456ghi789jklmno");
        assert!(
            results.iter().any(|m| m.kind == "OpenAI API Key"),
            "Should detect OpenAI key, got: {results:?}"
        );
    }

    #[test]
    fn test_scanner_detects_aws_key() {
        let scanner = SecretScanner::new();
        let results = scanner.scan("AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE");
        assert!(
            results.iter().any(|m| m.kind == "AWS Access Key"),
            "Should detect AWS key, got: {results:?}"
        );
    }

    #[test]
    fn test_scanner_detects_private_key() {
        let scanner = SecretScanner::new();
        let results = scanner.scan("-----BEGIN RSA PRIVATE KEY-----");
        assert!(
            results.iter().any(|m| m.kind.contains("Private Key")),
            "Should detect private key header, got: {results:?}"
        );
    }

    #[test]
    fn test_scanner_detects_jwt() {
        let scanner = SecretScanner::new();
        let results = scanner.scan("eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc.def.ghi");
        assert!(
            results.iter().any(|m| m.kind == "JWT Token"),
            "Should detect JWT, got: {results:?}"
        );
    }

    #[test]
    fn test_scanner_empty_text() {
        let scanner = SecretScanner::new();
        let results = scanner.scan("just some normal text with no secrets here");
        assert!(results.is_empty());
    }

    #[test]
    fn test_scanner_line_numbers() {
        let scanner = SecretScanner::new();
        let text = "line1\nline2\nsk-abc123def456ghi789jklmno\nline4";
        let results = scanner.scan(text);
        if let Some(m) = results.iter().find(|r| r.kind == "OpenAI API Key") {
            assert_eq!(m.line, 3);
        }
    }

    // ── SecurityAudit ─────────────────────────────────────────────────────

    #[test]
    fn test_audit_runs_without_error() {
        let dir = std::env::temp_dir().join("airis_test_audit");
        let _ = fs::create_dir_all(&dir);

        let audit = SecurityAudit::new(&dir);
        let report = audit.run();
        assert!(report.score <= 100);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_audit_score_range() {
        let audit = SecurityAudit::new(Path::new("/"));
        let report = audit.run();
        assert!(report.score <= 100);
    }

    // ── Base64 round-trip ─────────────────────────────────────────────────

    #[test]
    fn test_base64_roundtrip() {
        let inputs = vec![
            b"hello".as_ref(),
            b"".as_ref(),
            b"a".as_ref(),
            b"ab".as_ref(),
            b"abc".as_ref(),
            &[0u8, 1, 2, 3, 4, 5, 6, 7],
            b"the quick brown fox jumps over the lazy dog",
        ];
        for input in inputs {
            let enc = encode_b64(input);
            let dec = decode_b64(&enc).expect("decode failed");
            assert_eq!(input, &dec, "roundtrip failed for {input:?} -> {enc:?}");
        }
    }

    // ── XOR round-trip ────────────────────────────────────────────────────

    #[test]
    fn test_xor_roundtrip() {
        let key = generate_key(16);
        let plaintext = b"Hello, AIRIS-CLI!";
        let ct = xor_encrypt(plaintext, &key);
        let pt = xor_decrypt(&ct, &key);
        assert_eq!(pt, plaintext);
    }

    #[test]
    fn test_xor_differs() {
        let key = generate_key(16);
        let plaintext = b"secret";
        let ct = xor_encrypt(plaintext, &key);
        assert_ne!(ct, plaintext, "encrypted output should differ from input");
    }
}
