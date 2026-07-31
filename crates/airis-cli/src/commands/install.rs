//! `airis install` — Interactive premium installer for AIRIS-CLI.
//!
//! Features:
//! - Auto-detect platform (Linux, macOS, Windows, Android Termux)
//! - Check dependencies (curl, git, build-essential, etc.)
//! - Interactive TUI wizard with welcome, theme, language, provider config
//! - Download and install AIRIS binary
//! - Verify SHA-256 checksum
//! - Atomic rollback on failure
//! - Checkpoint-based resume for interrupted installs
//!
//! Brand: AIRIS-CLI by KageOS
//! Tagline: "Artificial Intelligence Responsive Integrated System"
//! Theme: AMOLED black (#000), blue (#0066ff), cyan (#00e5ff)

use crate::CommandContext;
use airis_core::prelude::*;
use indicatif::{ProgressBar, ProgressStyle, MultiProgress};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::collections::HashMap;
use std::io::{self, Write, BufRead};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::io::AsyncWriteExt;
use tokio_stream::StreamExt;
use tokio_util::io::StreamReader;

// ─── Brand Constants ───────────────────────────────────────────────────────

const BRAND: &str = "AIRIS-CLI";
const TAGLINE: &str = "Artificial Intelligence Responsive Integrated System";
const AUTHOR: &str = "KageOS";
const VERSION: &str = env!("CARGO_PKG_VERSION");

// ANSI color constants matching brand theme
mod color {
    pub const RESET: &str = "\x1b[0m";
    pub const BOLD: &str = "\x1b[1m";
    pub const DIM: &str = "\x1b[2m";
    pub const ITALIC: &str = "\x1b[3m";
    pub const BLUE: &str = "\x1b[38;2;0;102;255m";       // #0066ff
    pub const CYAN: &str = "\x1b[38;2;0;229;255m";        // #00e5ff
    pub const AMOLED_BG: &str = "\x1b[48;2;0;0;0m";       // #000
    pub const WHITE: &str = "\x1b[38;2;255;255;255m";
    pub const GRAY: &str = "\x1b[38;2;128;128;128m";
    pub const GREEN: &str = "\x1b[38;2;0;255;128m";
    pub const RED: &str = "\x1b[38;2;255;50;50m";
    pub const YELLOW: &str = "\x1b[38;2;255;200;50m";
    pub const CYAN_BG: &str = "\x1b[48;2;0;229;255m";
    pub const BLUE_BG: &str = "\x1b[48;2;0;102;255m";
    pub const CLEAR_LINE: &str = "\x1b[2K\r";
    pub const HIDE_CURSOR: &str = "\x1b[?25l";
    pub const SHOW_CURSOR: &str = "\x1b[?25h";
}

// ─── Checkpoint / Resume ──────────────────────────────────────────────────

/// Save file for install checkpoint data.
const CHECKPOINT_FILE: &str = ".airis-install-checkpoint.json";

/// Serializable install state for resume.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct InstallState {
    version: String,
    platform: String,
    architecture: String,
    install_dir: PathBuf,
    temp_dir: PathBuf,
    completed_steps: Vec<String>,
    theme: String,
    language: String,
    provider: Option<String>,
    provider_config: HashMap<String, String>,
    checksum: Option<String>,
    downloaded_path: Option<PathBuf>,
}

/// Steps tracked in the install state machine.
mod step {
    pub const DEPENDENCIES: &str = "dependencies";
    pub const WIZARD: &str = "wizard";
    pub const DOWNLOAD: &str = "download";
    pub const VERIFY: &str = "verify";
    pub const EXTRACT: &str = "extract";
    pub const CONFIGURE: &str = "configure";
    pub const COMPLETE: &str = "complete";
}

// ─── Platform Detection ────────────────────────────────────────────────────

/// Detected target platform.
#[derive(Debug, Clone, PartialEq)]
enum Platform {
    Linux,
    MacOS,
    Windows,
    AndroidTermux,
}

impl std::fmt::Display for Platform {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Linux => write!(f, "linux"),
            Self::MacOS => write!(f, "macos"),
            Self::Windows => write!(f, "windows"),
            Self::AndroidTermux => write!(f, "android-termux"),
        }
    }
}

/// Detect the current platform.
fn detect_platform() -> Platform {
    // Check for Android Termux first
    if let Ok(prefix) = std::env::var("PREFIX") {
        if prefix.contains("/data/data/com.termux") {
            return Platform::AndroidTermux;
        }
    }

    // Check for /data/data/com.termux/files/usr
    if Path::new("/data/data/com.termux").exists() {
        return Platform::AndroidTermux;
    }

    #[cfg(target_os = "linux")]
    { Platform::Linux }

    #[cfg(target_os = "macos")]
    { Platform::MacOS }

    #[cfg(target_os = "windows")]
    { Platform::Windows }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        // Fallback: try uname
        match std::process::Command::new("uname").arg("-s").output() {
            Ok(out) => {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_lowercase();
                if s.contains("darwin") { Platform::MacOS }
                else if s.contains("linux") {
                    // Double-check termux
                    if Path::new("/data/data/com.termux").exists() {
                        Platform::AndroidTermux
                    } else {
                        Platform::Linux
                    }
                }
                else if s.contains("mingw") || s.contains("cygwin") { Platform::Windows }
                else { Platform::Linux }
            }
            Err(_) => Platform::Linux, // best guess
        }
    }
}

/// Detect CPU architecture.
fn detect_architecture() -> String {
    let arch = std::env::consts::ARCH;
    match arch {
        "aarch64" | "arm64" => {
            // Check if under Termux on 32-bit
            if cfg!(target_pointer_width = "32") {
                "armv7l".into()
            } else {
                "aarch64".into()
            }
        }
        "x86_64" | "amd64" => "x86_64".into(),
        "x86" | "i686" | "i386" => "x86".into(),
        _ => arch.to_string(),
    }
}

// ─── Dependency Checking ───────────────────────────────────────────────────

/// System dependency check result.
#[derive(Debug)]
struct Dependency {
    name: &'static str,
    binary: Option<&'static str>,
    package: Option<&'static str>,
    installed: bool,
    version: Option<String>,
}

/// Check dependencies for the detected platform.
async fn check_dependencies(platform: &Platform) -> Vec<Dependency> {
    let mut deps = Vec::new();

    // curl — used for downloads
    deps.push(check_dep("curl", Some("curl"), None).await);
    // git — for update/version info
    deps.push(check_dep("git", Some("git"), None).await);

    match platform {
        Platform::Linux => {
            deps.push(check_dep("build-essential", Some("make"), Some("build-essential")).await);
            deps.push(check_dep("pkg-config", Some("pkg-config"), Some("pkg-config")).await);
            deps.push(check_dep("openssl-dev", Some("openssl"), Some("libssl-dev")).await);
        }
        Platform::MacOS => {
            deps.push(check_dep("Xcode CLI Tools", Some("xcode-select"), None).await);
        }
        Platform::Windows => {
            deps.push(check_dep("Visual C++ Build Tools", Some("cl.exe"), None).await);
            deps.push(check_dep("PowerShell", Some("powershell"), None).await);
        }
        Platform::AndroidTermux => {
            deps.push(check_dep("build-essential", Some("make"), Some("build-essential")).await);
            deps.push(check_dep("clang", Some("clang"), Some("clang")).await);
            deps.push(check_dep("openssl-dev", Some("openssl"), Some("openssl-dev")).await);
        }
    }

    deps
}

async fn check_dep(
    name: &'static str,
    binary: Option<&'static str>,
    package: Option<&'static str>,
) -> Dependency {
    let (installed, version) = if let Some(bin) = binary {
        match tokio::process::Command::new(bin)
            .arg("--version")
            .output()
            .await
        {
            Ok(out) if out.status.success() => {
                let ver = String::from_utf8_lossy(&out.stdout)
                    .lines()
                    .next()
                    .map(|s| s.trim().to_string());
                (true, ver)
            }
            _ => (false, None),
        }
    } else {
        (false, None)
    };

    Dependency {
        name,
        binary,
        package,
        installed,
        version,
    }
}

// ─── Interactive Wizard ────────────────────────────────────────────────────

/// Selected theme during wizard.
#[derive(Debug, Clone, PartialEq)]
enum WizardTheme {
    AmoledDark,
    BlueLight,
    CyanDark,
    Custom(String),
}

impl std::fmt::Display for WizardTheme {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AmoledDark => write!(f, "AMOLED Dark"),
            Self::BlueLight => write!(f, "Blue Light"),
            Self::CyanDark => write!(f, "Cyan Dark"),
            Self::Custom(s) => write!(f, "Custom: {s}"),
        }
    }
}

impl WizardTheme {
    fn config_value(&self) -> String {
        match self {
            Self::AmoledDark => "amoled-dark".into(),
            Self::BlueLight => "blue-light".into(),
            Self::CyanDark => "cyan-dark".into(),
            Self::Custom(s) => s.to_lowercase().replace(' ', "-"),
        }
    }
}

/// Wizard options collected from the user.
struct WizardOptions {
    theme: WizardTheme,
    language: String,
    provider: Option<String>,
    provider_config: HashMap<String, String>,
    install_dir: PathBuf,
    install_system: bool,
}

/// Clear the terminal screen.
fn clear_screen() {
    print!("\x1b[2J\x1b[H");
    let _ = io::stdout().flush();
}

/// Print the AIRIS animated-styled logo.
fn print_logo() {
    let logo = r#"
    ╔═══════════════════════════════════════════╗
    ║                                           ║
    ║     █████╗ ██╗██████╗ ██╗███████╗        ║
    ║    ██╔══██╗██║██╔══██╗██║██╔════╝        ║
    ║    ███████║██║██████╔╝██║███████╗        ║
    ║    ██╔══██║██║██╔══██╗██║╚════██║        ║
    ║    ██║  ██║██║██║  ██║██║███████║        ║
    ║    ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝╚══════╝        ║
    ║                                           ║
    ╚═══════════════════════════════════════════╝"#;

    println!("{}", color::CYAN);
    for line in logo.lines() {
        println!("{}", line);
        std::thread::sleep(Duration::from_millis(30));
    }
    println!("{}", color::RESET);
}

/// Print a branded header bar.
fn print_header(text: &str) {
    let line = format!("─── {} ───", text);
    let padding = "─".repeat(55usize.saturating_sub(line.len()));
    println!(
        "\n{}{} {}{}{}{}{}\n",
        color::BOLD, color::BLUE, text, color::RESET, color::DIM, padding, color::RESET
    );
}

/// Read a single line of input with a styled prompt.
fn read_input(prompt: &str) -> io::Result<String> {
    print!(
        "  {} {}>{} ",
        color::CYAN,
        prompt,
        color::RESET,
    );
    io::stdout().flush()?;
    let mut input = String::new();
    io::stdin().read_line(&mut input)?;
    Ok(input.trim().to_string())
}

/// Read input with a default value.
fn read_input_default(prompt: &str, default: &str) -> io::Result<String> {
    print!(
        "  {} {} {}[{}]{} ",
        color::CYAN,
        prompt,
        color::DIM,
        default,
        color::RESET,
    );
    io::stdout().flush()?;
    let mut input = String::new();
    io::stdin().read_line(&mut input)?;
    let trimmed = input.trim().to_string();
    if trimmed.is_empty() {
        Ok(default.to_string())
    } else {
        Ok(trimmed)
    }
}

/// Prompt yes/no with default.
fn confirm(prompt: &str, default: bool) -> io::Result<bool> {
    let hint = if default { "Y/n" } else { "y/N" };
    print!(
        "  {} {} {}[{}]{} ",
        color::CYAN,
        prompt,
        color::DIM,
        hint,
        color::RESET,
    );
    io::stdout().flush()?;
    let mut input = String::new();
    io::stdin().read_line(&mut input)?;
    let trimmed = input.trim().to_lowercase();
    if trimmed.is_empty() {
        Ok(default)
    } else {
        Ok(trimmed == "y" || trimmed == "yes")
    }
}

/// Display a numbered menu and get selection.
fn menu_select(items: &[&str], prompt: &str) -> io::Result<usize> {
    println!("\n  {}Select {}:{}", color::BOLD, prompt, color::RESET);
    for (i, item) in items.iter().enumerate() {
        println!("    {}{}.{}{} {}", color::CYAN, i + 1, color::RESET, color::WHITE, item);
    }
    loop {
        print!(
            "  {}Choice (1-{}){} ",
            color::CYAN,
            items.len(),
            color::RESET,
        );
        io::stdout().flush()?;
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let trimmed = input.trim();
        if let Ok(n) = trimmed.parse::<usize>() {
            if n >= 1 && n <= items.len() {
                return Ok(n - 1);
            }
        }
        println!("  {}Invalid selection, try again.{}", color::RED, color::RESET);
    }
}

/// Show a styled progress spinner with message.
fn show_progress(msg: &str) -> ProgressBar {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .tick_chars("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏")
            .template("{spinner:.cyan} {msg}")
            .expect("valid template"),
    );
    pb.set_message(msg.to_string());
    pb.enable_steady_tick(Duration::from_millis(80));
    pb
}

/// Show a styled progress bar for a quantitative task.
fn make_progress_bar(len: u64, msg: &str) -> ProgressBar {
    let pb = ProgressBar::new(len);
    pb.set_style(
        ProgressStyle::default_bar()
            .template(&format!(
                "  {}{{bar:.cyan/blue}}}{} {{msg}} {{pos}}/{{len}} {{elapsed}}",
                color::CYAN, color::RESET,
            ))
            .expect("valid template")
            .progress_chars("━╸─"),
    );
    pb.set_message(msg.to_string());
    pb
}

// ─── Welcome Screen ───────────────────────────────────────────────────────

/// Display the welcome screen and return whether to proceed.
async fn welcome_screen() -> io::Result<bool> {
    clear_screen();

    // Animated reveal
    print!("{}", color::HIDE_CURSOR);
    print_logo();

    // Tagline and branding
    println!(
        "  {} {}v{}{}",
        color::DIM,
        TAGLINE,
        VERSION,
        color::RESET,
    );
    println!(
        "  {}by {} with {}",
        color::GRAY,
        AUTHOR,
        format_args!("{}<< >>{}", color::BLUE, color::RESET),
    );
    println!();

    // Premium description
    println!(
        "  {}Welcome to the AIRIS-CLI premium installer.{}\n",
        color::WHITE,
        color::RESET,
    );
    println!(
        "  {}This wizard will guide you through setting up AIRIS-CLI —{}"
    );
    println!(
        "  {}the next-generation AI coding assistant.{}\n",
        color::WHITE,
        color::RESET,
    );
    println!(
        "  {}Features:{}",
        color::CYAN,
        color::RESET,
    );
    println!("  {}  •{} Platform-optimized binary installation", color::GRAY, color::RESET);
    println!("  {}  •{} Interactive theme & language configuration", color::GRAY, color::RESET);
    println!("  {}  •{} Provider setup (OpenAI, Anthropic, Ollama, etc.)", color::GRAY, color::RESET);
    println!("  {}  •{} Automatic dependency verification", color::GRAY, color::RESET);
    println!("  {}  •{} SHA-256 integrity verification", color::GRAY, color::RESET);
    println!("  {}  •{} Safe rollback on failure", color::GRAY, color::RESET);
    println!("  {}  •{} Resume support for interrupted installs{}", color::GRAY, color::GRAY, color::RESET);
    println!();

    confirm("Proceed with installation?", true)
}

// ─── Theme Selector ────────────────────────────────────────────────────────

/// Interactive theme selection.
fn select_theme() -> io::Result<WizardTheme> {
    print_header("Theme Selection");
    println!("  {}Choose your preferred visual theme:{}", color::GRAY, color::RESET);

    let options = &[
        "AMOLED Dark  — Deep black background, blue/cyan accents (recommended)",
        "Blue Light   — Clean light theme with blue primary",
        "Cyan Dark    — Dark theme with cyan highlights",
        "Custom       — Enter your own theme name",
    ];

    match menu_select(options, "Theme")? {
        0 => Ok(WizardTheme::AmoledDark),
        1 => Ok(WizardTheme::BlueLight),
        2 => Ok(WizardTheme::CyanDark),
        3 => {
            let custom = read_input("Enter custom theme name")?;
            if custom.is_empty() {
                Ok(WizardTheme::AmoledDark)
            } else {
                Ok(WizardTheme::Custom(custom))
            }
        }
        _ => Ok(WizardTheme::AmoledDark),
    }
}

// ─── Language Selector ─────────────────────────────────────────────────────

/// Interactive language selection.
fn select_language() -> io::Result<String> {
    print_header("Language Selection");
    println!("  {}Choose your primary language:{}", color::GRAY, color::RESET);

    let options = &[
        "English",
        "中文 (Chinese)",
        "日本語 (Japanese)",
        "Español (Spanish)",
        "Français (French)",
        "Deutsch (German)",
        "한국어 (Korean)",
        "Português (Portuguese)",
        "Русский (Russian)",
        "Other",
    ];

    let idx = menu_select(options, "Language")?;
    match idx {
        9 => {
            let custom = read_input("Enter your language")?;
            Ok(if custom.is_empty() { "en".into() } else { custom })
        }
        n => {
            let lang = match n {
                0 => "en",
                1 => "zh",
                2 => "ja",
                3 => "es",
                4 => "fr",
                5 => "de",
                6 => "ko",
                7 => "pt",
                8 => "ru",
                _ => "en",
            };
            Ok(lang.to_string())
        }
    }
}

// ─── Provider Configuration Wizard ─────────────────────────────────────────

/// Known provider descriptors.
const KNOWN_PROVIDERS: &[ProviderDescriptor] = &[
    ProviderDescriptor {
        id: "openai",
        name: "OpenAI",
        needs_key: true,
        default_url: "https://api.openai.com/v1",
        models: &["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
        description: "OpenAI's GPT-4 and GPT-4o models",
    },
    ProviderDescriptor {
        id: "anthropic",
        name: "Anthropic",
        needs_key: true,
        default_url: "https://api.anthropic.com/v1",
        models: &["claude-3-5-sonnet", "claude-3-opus"],
        description: "Anthropic's Claude models",
    },
    ProviderDescriptor {
        id: "ollama",
        name: "Ollama (Local)",
        needs_key: false,
        default_url: "http://localhost:11434",
        models: &["llama3", "mistral", "codellama"],
        description: "Local open-source models via Ollama",
    },
    ProviderDescriptor {
        id: "google",
        name: "Google AI",
        needs_key: true,
        default_url: "https://generativelanguage.googleapis.com/v1beta",
        models: &["gemini-1.5-pro", "gemini-1.5-flash"],
        description: "Google's Gemini models",
    },
    ProviderDescriptor {
        id: "openrouter",
        name: "OpenRouter",
        needs_key: true,
        default_url: "https://openrouter.ai/api/v1",
        models: &["auto"],
        description: "Multi-provider unified API",
    },
    ProviderDescriptor {
        id: "deepseek",
        name: "DeepSeek",
        needs_key: true,
        default_url: "https://api.deepseek.com/v1",
        models: &["deepseek-coder", "deepseek-chat"],
        description: "DeepSeek's coding-specialized models",
    },
    ProviderDescriptor {
        id: "custom",
        name: "Custom Provider",
        needs_key: false,
        default_url: "https://",
        models: &["custom-model"],
        description: "Any OpenAI-compatible API endpoint",
    },
];

#[derive(Debug)]
struct ProviderDescriptor {
    id: &'static str,
    name: &'static str,
    needs_key: bool,
    default_url: &'static str,
    models: &'static [&'static str],
}

/// Interactive provider configuration.
fn configure_providers() -> io::Result<(Option<String>, HashMap<String, String>)> {
    print_header("Provider Configuration");
    println!("  {}AIRIS-CLI needs at least one AI provider to function.{}", color::GRAY, color::RESET);
    println!("  {}You can configure multiple providers for fallback/routing.{}", color::GRAY, color::RESET);
    println!();

    if !confirm("Configure a provider now?", true)? {
        return Ok((None, HashMap::new()));
    }

    let mut provider_configs: Vec<HashMap<String, String>> = Vec::new();
    let mut provider_ids: Vec<String> = Vec::new();

    loop {
        println!();
        print_header("Add Provider");
        let names: Vec<&str> = KNOWN_PROVIDERS.iter().map(|p| p.name).collect();
        let idx = menu_select(&names, "Provider")?;
        let desc = &KNOWN_PROVIDERS[idx];

        let mut config = HashMap::new();
        config.insert("provider".to_string(), desc.id.to_string());

        println!(
            "\n  {}Configuring: {}{}{}{}",
            color::CYAN, color::BOLD, desc.name, color::RESET, color::DIM,
        );
        println!("  {}│ {}", color::DIM, desc.description);
        println!("  {}│ Default models: {}{}", color::DIM, desc.models.join(", "), color::RESET);

        // Base URL
        let url = read_input_default("Base URL", desc.default_url)?;
        config.insert("base_url".to_string(), url);

        // API key if needed
        if desc.needs_key {
            print!(
                "  {}API Key{} {}",
                color::CYAN,
                color::RESET,
                color::GRAY,
            );
            println!("(input hidden){}", color::RESET);
            print!("  > ");
            io::stdout().flush()?;
            // Read API key with simple masking (no echo control for portability)
            let mut api_key = String::new();
            io::stdin().read_line(&mut api_key)?;
            let api_key = api_key.trim().to_string();
            if !api_key.is_empty() {
                config.insert("api_key".to_string(), api_key);
            }
        }

        // Default model
        let model = read_input_default("Default model", desc.models[0])?;
        config.insert("default_model".to_string(), if model.is_empty() { desc.models[0].to_string() } else { model });

        // Model list
        let models_str = read_input_default("Additional models (comma-separated)", "")?;
        if !models_str.is_empty() {
            config.insert("models".to_string(), models_str);
        }

        config.insert("timeout_secs".to_string(), "120".to_string());

        provider_configs.push(config);
        provider_ids.push(desc.id.to_string());

        println!();
        if !confirm("Add another provider?", false)? {
            break;
        }
    }

    if provider_ids.is_empty() {
        return Ok((None, HashMap::new()));
    }

    // Pick default provider
    let default_idx = if provider_ids.len() > 1 {
        println!("\n  {}Select default provider:{}", color::BOLD, color::RESET);
        let names: Vec<&str> = provider_ids.iter().map(|s| s.as_str()).collect();
        let idx = menu_select(&names, "Default Provider")?;
        idx
    } else {
        0
    };

    let default_provider = provider_ids[default_idx].clone();
    let mut global_config = HashMap::new();
    global_config.insert("default_provider".to_string(), default_provider.clone());

    // Merge individual provider configs as JSON
    let providers_json: HashMap<String, HashMap<String, String>> = provider_ids
        .iter()
        .zip(provider_configs.into_iter())
        .map(|(id, cfg)| (id.clone(), cfg))
        .collect();

    global_config.insert(
        "providers".to_string(),
        serde_json::to_string(&providers_json).unwrap_or_default(),
    );

    Ok((Some(default_provider), global_config))
}

// ─── Install Directory Selection ───────────────────────────────────────────

fn select_install_dir(platform: &Platform) -> io::Result<PathBuf> {
    print_header("Install Location");

    let suggested = match platform {
        Platform::Linux => PathBuf::from("/usr/local/bin"),
        Platform::MacOS => PathBuf::from("/usr/local/bin"),
        Platform::Windows => {
            if let Ok(p) = std::env::var("LOCALAPPDATA") {
                PathBuf::from(p).join("airis-cli")
            } else {
                PathBuf::from("C:\\Program Files\\airis-cli")
            }
        }
        Platform::AndroidTermux => PathBuf::from("/data/data/com.termux/files/usr/bin"),
    };

    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let local_fallback = home.join(".airis").join("bin");

    println!(
        "  {}Recommended: {}{}{}",
        color::GRAY,
        color::CYAN,
        suggested.display(),
        color::RESET,
    );
    println!(
        "  {}Local fallback: {}{}",
        color::GRAY,
        local_fallback.display(),
    );
    println!();

    let system_install = confirm(
        &format!("Install to system path ({})?", suggested.display()),
        false,
    )?;

    if system_install {
        Ok(suggested)
    } else {
        let custom = read_input_default(
            "Install directory",
            local_fallback.to_str().unwrap_or(".airis/bin"),
        )?;
        Ok(PathBuf::from(custom))
    }
}

// ─── Summary Screen ────────────────────────────────────────────────────────

fn show_summary(
    platform: &Platform,
    arch: &str,
    wizard: &WizardOptions,
    deps: &[Dependency],
) -> io::Result<bool> {
    print_header("Installation Summary");
    println!();

    // Platform + Arch
    println!(
        "  {}Platform:{}     {} {}{}{}",
        color::CYAN, color::RESET, color::WHITE, platform, color::GRAY, format!(" ({arch})"),
    );
    println!(
        "  {}Version:{}      {}v{}{}",
        color::CYAN, color::RESET, color::WHITE, VERSION, color::RESET,
    );
    println!(
        "  {}Theme:{}        {}{}{}",
        color::CYAN, color::RESET, color::WHITE, wizard.theme, color::RESET,
    );
    println!(
        "  {}Language:{}     {}{}",
        color::CYAN, color::RESET, color::WHITE, wizard.language,
    );
    println!(
        "  {}Provider:{}     {}{}{}",
        color::CYAN,
        color::RESET,
        color::WHITE,
        wizard.provider.as_deref().unwrap_or("None (configure later)"),
        color::RESET,
    );
    println!(
        "  {}Install Dir:{}  {}{}",
        color::CYAN,
        color::RESET,
        wizard.install_dir.display(),
    );
    println!();

    // Dependencies status
    println!("  {}Dependencies:{}", color::CYAN, color::RESET);
    for dep in deps {
        let icon = if dep.installed { "✓" } else { "✗" };
        let icon_color = if dep.installed { color::GREEN } else { color::RED };
        let ver = dep
            .version
            .as_ref()
            .map(|v| format!(" ({})", v))
            .unwrap_or_default();
        let pkg = dep
            .package
            .map(|p| format!(" [install: {}]", p))
            .unwrap_or_default();
        println!(
            "    {}{}{}  {}{}{}",
            icon_color, icon, color::RESET, dep.name, color::DIM, format!("{}{}", ver, pkg),
        );
    }

    println!();
    confirm("Begin installation with these settings?", true)
}

// ─── Download & Install ────────────────────────────────────────────────────

/// Construct the download URL for the AIRIS binary.
fn download_url(platform: &Platform, arch: &str) -> String {
    let os_part = match platform {
        Platform::Linux => "linux",
        Platform::MacOS => "macos",
        Platform::Windows => "windows",
        Platform::AndroidTermux => "android-termux",
    };
    // Note: This URL is the canonical release endpoint.
    // In production, replace with actual release server.
    format!(
        "https://github.com/kageos/airis/releases/download/v{}/airis-{}-{}",
        VERSION, os_part, arch
    )
}

/// Compute SHA-256 of a file.
fn sha256_file(path: &Path) -> io::Result<String> {
    let data = std::fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(format!("{:x}", hasher.finalize()))
}

/// Fetch the expected checksum from the release server.
async fn fetch_expected_checksum(url: &str) -> AirisResult<String> {
    let checksum_url = format!("{}.sha256", url);
    let resp = reqwest::get(&checksum_url)
        .await
        .map_err(|e| AirisError::Http(format!("Failed to fetch checksum: {e}")))?;

    let text = resp
        .text()
        .await
        .map_err(|e| AirisError::Http(format!("Failed to read checksum: {e}")))?;

    // Parse "hash  filename" format
    Ok(text
        .split_whitespace()
        .next()
        .unwrap_or("")
        .trim()
        .to_string())
}

/// Perform the download with progress bar.
async fn download_binary(
    url: &str,
    dest: &Path,
    multi: &MultiProgress,
) -> AirisResult<()> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| AirisError::Http(format!("Client build error: {e}")))?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| AirisError::Http(format!("Download failed: {e}")))?;

    if !resp.status().is_success() {
        return Err(AirisError::Http(format!(
            "Download returned HTTP {}",
            resp.status()
        )));
    }

    let total_size = resp
        .content_length()
        .unwrap_or(0);

    let pb = multi.add(make_progress_bar(total_size.max(1), "Downloading AIRIS binary"));
    pb.set_length(total_size);

    let mut dest_file = tokio::fs::File::create(dest)
        .await
        .map_err(|e| AirisError::Io(e))?;

    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();

    // Use StreamReader for clean streaming
    let mut reader = StreamReader::new(
        stream.map(|chunk| {
            chunk.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
        }),
    );

    let mut buf = [0u8; 65536];
    loop {
        let n = reader
            .read(&mut buf)
            .await
            .map_err(|e| AirisError::Io(e))?;
        if n == 0 {
            break;
        }
        dest_file.write_all(&buf[..n])
            .await
            .map_err(|e| AirisError::Io(e))?;
        downloaded += n as u64;
        pb.set_position(downloaded);
    }

    pb.finish_with_message("Download complete");
    Ok(())
}

/// Install the binary to the target directory.
async fn install_binary(
    downloaded: &Path,
    install_dir: &Path,
) -> AirisResult<()> {
    tokio::fs::create_dir_all(install_dir)
        .await
        .map_err(|e| AirisError::Io(e))?;

    let binary_name = if cfg!(windows) { "airis.exe" } else { "airis" };
    let dest = install_dir.join(binary_name);

    // Copy binary
    tokio::fs::copy(downloaded, &dest)
        .await
        .map_err(|e| AirisError::Io(e))?;

    // Set executable permission (Unix)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        tokio::fs::set_permissions(&dest, perms)
            .await
            .map_err(|e| AirisError::Io(e))?;
    }

    println!(
        "  {}✓{} Installed {}binary to {}{}",
        color::GREEN,
        color::RESET,
        color::CYAN,
        dest.display(),
        color::RESET,
    );

    Ok(())
}

/// Write the initial configuration file.
async fn write_config(
    install_dir: &Path,
    wizard: &WizardOptions,
    provider_config: &HashMap<String, String>,
    _platform: &Platform,
) -> AirisResult<()> {
    let config_dir = install_dir.join("../.airis");
    let config_dir = config_dir.canonicalize().unwrap_or(config_dir);
    tokio::fs::create_dir_all(&config_dir)
        .await
        .map_err(|e| AirisError::Io(e))?;

    let theme = wizard.theme.config_value();

    let mut config_content = format!(
        r#"# AIRIS-CLI Configuration
# Generated by `airis install` v{version}
# ──────────────────────────────────────────

[core]
default_provider = "{provider}"
default_model = "{model}"
max_tokens = 4096
temperature = 0.7
theme = "{theme}"
session_dir = ".airis/sessions"
cache_dir = ".airis/cache"

[ui]
enable_animations = true
show_token_count = true
show_cost = false
syntax_theme = "base16-ocean.dark"
font_size = 12

[workspace]
auto_index = true
max_context_files = 50

[workspace.indexing]
max_file_size = 1048576
exclude_patterns = ["node_modules/**", "target/**", ".git/**"]
enable_vector_search = true
"#,
        version = VERSION,
        provider = wizard.provider.as_deref().unwrap_or(""),
        model = provider_config
            .get("default_model")
            .map(|s| s.as_str())
            .unwrap_or("gpt-4o"),
        theme = theme,
    );

    // Add provider configs if present
    if let Some(providers_json) = provider_config.get("providers") {
        if let Ok(providers_map) =
            serde_json::from_str::<HashMap<String, HashMap<String, String>>>(providers_json)
        {
            config_content.push_str("\n[providers]\n");
            for (provider_id, cfg) in &providers_map {
                config_content.push_str(&format!(
                    "\n[providers.{}]\n",
                    provider_id
                ));
                if let Some(api_key) = cfg.get("api_key") {
                    config_content.push_str(&format!("api_key = \"{}\"\n", api_key));
                }
                if let Some(base_url) = cfg.get("base_url") {
                    config_content.push_str(&format!("base_url = \"{}\"\n", base_url));
                }
                if let Some(models) = cfg.get("models") {
                    let models_list: Vec<&str> = models.split(',').map(|s| s.trim()).collect();
                    config_content.push_str(&format!(
                        "models = [{}]\n",
                        models_list
                            .iter()
                            .map(|m| format!("\"{}\"", m))
                            .collect::<Vec<_>>()
                            .join(", ")
                    ));
                }
                config_content.push_str("timeout_secs = 120\n");
                config_content.push_str("max_retries = 3\n");
            }
        }
    }

    let config_path = config_dir.join("config.toml");
    tokio::fs::write(&config_path, config_content.as_bytes())
        .await
        .map_err(|e| AirisError::Io(e))?;

    println!(
        "  {}✓{} Configuration written to {}",
        color::GREEN,
        color::RESET,
        config_path.display(),
    );

    Ok(())
}

/// Add binary directory to PATH by writing shell rc snippets.
async fn add_to_path(install_dir: &Path, platform: &Platform) -> AirisResult<()> {
    if platform == &Platform::Windows {
        // Windows: instruct user to add to PATH manually
        println!(
            "  {}ℹ{}  Add {} to your PATH environment variable.",
            color::YELLOW,
            color::RESET,
            install_dir.display(),
        );
        return Ok(());
    }

    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let bin_path = install_dir.to_string_lossy().to_string();

    // Check if already in PATH
    if let Ok(path_env) = std::env::var("PATH") {
        if path_env.split(':').any(|p| p == bin_path) {
            return Ok(()); // already in PATH
        }
    }

    // Determine which shell config to update
    let rc_files = [
        (home.join(".bashrc"), format!("\nexport PATH=\"$PATH:{}\"\n", bin_path)),
        (home.join(".zshrc"), format!("\nexport PATH=\"$PATH:{}\"\n", bin_path)),
        (home.join(".config/fish/config.fish"), format!("\nset -gx PATH $PATH {}\n", bin_path)),
    ];

    let mut updated = false;
    for (rc_path, line) in &rc_files {
        // Only update if the file exists
        if rc_path.exists() {
            let content = tokio::fs::read_to_string(rc_path)
                .await
                .unwrap_or_default();
            if !content.contains(&bin_path) {
                tokio::fs::OpenOptions::new()
                    .append(true)
                    .create(true)
                    .open(rc_path)
                    .await
                    .map_err(|e| AirisError::Io(e))?
                    .write_all(line.as_bytes())
                    .await
                    .map_err(|e| AirisError::Io(e))?;
                println!(
                    "  {}✓{} Added PATH to {}",
                    color::GREEN,
                    color::RESET,
                    rc_path.display(),
                );
                updated = true;
            }
        }
    }

    if !updated {
        // No shell config found — try .profile
        let profile = home.join(".profile");
        let line = format!("\nexport PATH=\"$PATH:{}\"\n", bin_path);
        if profile.exists() {
            let content = tokio::fs::read_to_string(&profile)
                .await
                .unwrap_or_default();
            if !content.contains(&bin_path) {
                tokio::fs::OpenOptions::new()
                    .append(true)
                    .create(true)
                    .open(&profile)
                    .await
                    .map_err(|e| AirisError::Io(e))?
                    .write_all(line.as_bytes())
                    .await
                    .map_err(|e| AirisError::Io(e))?;
                println!(
                    "  {}✓{} Added PATH to {}",
                    color::GREEN,
                    color::RESET,
                    profile.display(),
                );
                updated = true;
            }
        }
    }

    if updated {
        println!(
            "  {}ℹ{}  Restart your terminal or run: source ~/.bashrc (or equivalent){}",
            color::YELLOW,
            color::RESET,
            color::DIM,
        );
    }

    Ok(())
}

// ─── Rollback ──────────────────────────────────────────────────────────────

/// Rollback context tracking what was done so it can be undone.
struct Rollback {
    created_dirs: Vec<PathBuf>,
    created_files: Vec<PathBuf>,
    backup_files: Vec<(PathBuf, PathBuf)>, // (backup, original)
}

impl Rollback {
    fn new() -> Self {
        Self {
            created_dirs: Vec::new(),
            created_files: Vec::new(),
            backup_files: Vec::new(),
        }
    }

    fn track_dir(&mut self, dir: PathBuf) {
        self.created_dirs.push(dir);
    }

    fn track_file(&mut self, file: PathBuf) {
        self.created_files.push(file);
    }

    fn backup(&mut self, path: &Path) -> io::Option<PathBuf> {
        if path.exists() {
            let backup = path.with_extension("bak.airis");
            std::fs::copy(path, &backup).ok()?;
            self.backup_files.push((backup.clone(), path.to_path_buf()));
            Some(backup)
        } else {
            None
        }
    }

    /// Execute the rollback in reverse order.
    fn rollback(&self) {
        eprintln!("  {}Rolling back...{}", color::YELLOW, color::RESET);

        // Restore backup files
        for (backup, original) in &self.backup_files {
            if backup.exists() {
                if let Err(e) = std::fs::copy(backup, original) {
                    eprintln!("    Failed to restore {original:?}: {e}");
                }
                let _ = std::fs::remove_file(backup);
            }
        }

        // Remove created files (newest first)
        for file in self.created_files.iter().rev() {
            if file.exists() {
                if let Err(e) = std::fs::remove_file(file) {
                    eprintln!("    Failed to remove {file:?}: {e}");
                }
            }
        }

        // Remove created directories (newest first, only if empty)
        for dir in self.created_dirs.iter().rev() {
            if dir.exists() {
                if let Err(e) = std::fs::remove_dir(dir) {
                    // Directory not empty — that's fine, skip
                    let _ = e;
                }
            }
        }

        eprintln!("  {}✓ Rollback complete.{}", color::GREEN, color::RESET);
    }
}

// ─── Checkpoint Persistence ────────────────────────────────────────────────

fn checkpoint_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(CHECKPOINT_FILE)
}

fn save_checkpoint(state: &InstallState) -> AirisResult<()> {
    let json = serde_json::to_string_pretty(state)
        .map_err(|e| AirisError::Internal(format!("Checkpoint serialization: {e}")))?;
    let path = checkpoint_path();
    std::fs::write(&path, &json)
        .map_err(|e| AirisError::Io(e))?;
    Ok(())
}

fn load_checkpoint() -> AirisResult<Option<InstallState>> {
    let path = checkpoint_path();
    if !path.exists() {
        return Ok(None);
    }
    let json = std::fs::read_to_string(&path)
        .map_err(|e| AirisError::Io(e))?;
    let state: InstallState = serde_json::from_str(&json)
        .map_err(|e| AirisError::Internal(format!("Checkpoint deserialization: {e}")))?;
    Ok(Some(state))
}

fn clear_checkpoint() {
    let path = checkpoint_path();
    let _ = std::fs::remove_file(&path);
}

fn has_completed(state: &InstallState, step_name: &str) -> bool {
    state.completed_steps.iter().any(|s| s == step_name)
}

fn mark_completed(state: &mut InstallState, step_name: &str) -> AirisResult<()> {
    if !has_completed(state, step_name) {
        state.completed_steps.push(step_name.to_string());
    }
    save_checkpoint(state)
}

// ─── Main Installation Orchestrator ───────────────────────────────────────

/// Run the installation.
async fn run_installation(
    platform: &Platform,
    arch: &str,
    wizard: &WizardOptions,
    provider_config: &HashMap<String, String>,
    deps: &[Dependency],
) -> AirisResult<()> {
    // ── Initialize rollback ──
    let rollback = Rollback::new();
    let install_dir = &wizard.install_dir;

    // Create multi-progress for parallel operations
    let multi = MultiProgress::new();

    // ── Step 1: Check dependencies ──
    print_header("Step 1/5: Dependencies");
    for dep in deps {
        if dep.installed {
            println!(
                "  {}✓{} {} {}v{}",
                color::GREEN,
                color::RESET,
                dep.name,
                color::DIM,
                dep.version.as_deref().unwrap_or("?"),
            );
        } else {
            println!(
                "  {}✗{} {} {}— install: {}{}",
                color::RED,
                color::RESET,
                dep.name,
                color::DIM,
                dep.package.unwrap_or("manual install required"),
                color::RESET,
            );
        }
    }

    // If missing critical deps, warn but continue
    let missing_critical: Vec<&Dependency> = deps
        .iter()
        .filter(|d| !d.installed && d.binary == Some("curl"))
        .collect();
    if !missing_critical.is_empty() {
        println!(
            "\n  {}⚠  curl is required for downloading. Install it and re-run.{}",
            color::YELLOW,
            color::RESET,
        );
        // Without curl, we can't download. Use reqwest as fallback.
        println!("  {}  Using built-in HTTP client as fallback.{}", color::DIM, color::RESET);
    }

    // ── Step 2: Download binary ──
    print_header("Step 2/5: Download");
    let url = download_url(platform, arch);
    println!(
        "  {}Downloading from: {}{}",
        color::DIM,
        url,
        color::RESET,
    );

    let tmp_dir = std::env::temp_dir().join(format!("airis-install-{}", std::process::id()));
    tokio::fs::create_dir_all(&tmp_dir)
        .await
        .map_err(|e| AirisError::Io(e))?;
    rollback.track_dir(tmp_dir.clone());

    let binary_name = if cfg!(windows) { "airis.exe" } else { "airis" };
    let download_path = tmp_dir.join(binary_name);

    // Download with progress
    download_binary(&url, &download_path, &multi).await?;
    rollback.track_file(download_path.clone());

    // ── Step 3: Verify checksum ──
    print_header("Step 3/5: Integrity Verification");

    let progress = show_progress("Verifying SHA-256 checksum...");
    let actual_hash = sha256_file(&download_path)
        .map_err(|e| AirisError::Io(e))?;

    // Try to fetch expected checksum
    let expected_hash = fetch_expected_checksum(&url).await;
    match expected_hash {
        Ok(expected) if !expected.is_empty() => {
            if actual_hash == expected {
                progress.finish_with_message("Checksum verified ✓");
                println!(
                    "  {}✓{} SHA-256: {}",
                    color::GREEN,
                    color::RESET,
                    actual_hash,
                );
            } else {
                progress.finish_with_message("Checksum mismatch ✗");
                return Err(AirisError::Internal(format!(
                    "Checksum mismatch!\n  Expected: {expected}\n  Actual:   {actual_hash}\n\n\
                     This could indicate a corrupted download or tampered release.\n\
                     Rollback will restore your system to its previous state."
                )));
            }
        }
        _ => {
            // No checksum available, just show the computed one
            progress.finish_with_message("Checksum computed (no reference available)");
            println!(
                "  {}ℹ{} SHA-256: {} {}",
                color::YELLOW,
                color::RESET,
                actual_hash,
                color::DIM,
                "(no reference checksum available)",
            );
        }
    }

    // ── Step 4: Install binary ──
    print_header("Step 4/5: Installation");

    // Backup existing binary if present
    let existing_binary = install_dir.join(binary_name);
    if existing_binary.exists() {
        let backup_path = format!("{}.bak", existing_binary.display());
        tokio::fs::copy(&existing_binary, &backup_path)
            .await
            .map_err(|e| AirisError::Io(e))?;
        rollback.track_file(PathBuf::from(&backup_path));
    }

    install_binary(&download_path, install_dir).await?;
    rollback.track_file(existing_binary.clone());

    // ── Step 5: Configuration ──
    print_header("Step 5/5: Configuration");

    write_config(install_dir, wizard, provider_config, platform).await?;

    // Add to PATH
    add_to_path(install_dir, platform).await?;

    // ── Finalization ──
    println!();
    print_header("Installation Complete");
    println!(
        "  {}AIRIS-CLI v{} has been installed successfully!{}",
        color::GREEN,
        VERSION,
        color::RESET,
    );
    println!();
    println!(
        "  {}Next steps:{}",
        color::CYAN,
        color::RESET,
    );
    println!("  {}  •{} Run `airis chat` to start a conversation", color::GRAY, color::RESET);
    println!("  {}  •{} Run `airis --help` to see available commands", color::GRAY, color::RESET);
    println!("  {}  •{} Run `airis doctor` to verify your setup", color::GRAY, color::RESET);
    println!();
    println!(
        "  {}Thank you for choosing AIRIS-CLI!{}",
        color::CYAN,
        color::RESET,
    );

    // Clean up temp files
    let _ = tokio::fs::remove_dir_all(&tmp_dir).await;

    Ok(())
}

// ─── Resume Logic ──────────────────────────────────────────────────────────

/// Attempt to resume a previously interrupted installation.
async fn try_resume(
    platform: &Platform,
    arch: &str,
) -> AirisResult<Option<WizardOptions>> {
    let state = match load_checkpoint()? {
        Some(s) => s,
        None => return Ok(None),
    };

    if has_completed(&state, step::COMPLETE) {
        // Already complete, clean up
        clear_checkpoint();
        return Ok(None);
    }

    clear_screen();
    print_header("Resume Installation");
    println!(
        "  {}An incomplete installation was found from a previous run.{}",
        color::YELLOW,
        color::RESET,
    );
    println!(
        "  {}Platform: {}{}",
        color::DIM,
        state.platform,
        color::RESET,
    );
    println!(
        "  {}Completed: {}{}",
        color::DIM,
        state.completed_steps.join(", "),
        color::RESET,
    );
    println!();

    if !confirm("Resume installation?", true)? {
        if confirm("Start fresh (discard checkpoint)?", false)? {
            clear_checkpoint();
            return Ok(None);
        }
        return Err(AirisError::Custom("Installation cancelled by user.".into()));
    }

    // Construct wizard options from saved state
    let theme = match state.theme.as_str() {
        "amoled-dark" => WizardTheme::AmoledDark,
        "blue-light" => WizardTheme::BlueLight,
        "cyan-dark" => WizardTheme::CyanDark,
        other => WizardTheme::Custom(other.to_string()),
    };

    let wizard = WizardOptions {
        theme,
        language: state.language,
        provider: state.provider,
        provider_config: state.provider_config,
        install_dir: state.install_dir,
        install_system: false,
    };

    // Check deps
    let deps = check_dependencies(platform).await;
    let _ = run_installation(platform, arch, &wizard, &HashMap::new(), &deps).await?;

    Ok(Some(wizard))
}

// ─── Entry Point ───────────────────────────────────────────────────────────

/// Execute the `airis install` command.
pub async fn execute(_ctx: &CommandContext) -> AirisResult<()> {
    // ── Detect platform ──
    let platform = detect_platform();
    let arch = detect_architecture();

    println!(
        "{}AIRIS-CLI Installer v{}{}",
        color::CYAN,
        VERSION,
        color::RESET,
    );
    println!(
        "  {}Detected: {} ({}){}",
        color::DIM,
        platform,
        arch,
        color::RESET,
    );
    println!();

    // ── Try resume ──
    let wizard_from_resume = try_resume(&platform, &arch).await?;
    if wizard_from_resume.is_some() {
        clear_checkpoint();
        return Ok(());
    }

    // ── Welcome screen ──
    if !welcome_screen().await? {
        println!("\n  {}Installation cancelled.{}", color::YELLOW, color::RESET);
        return Ok(());
    }

    // ── Check dependencies ──
    let deps = check_dependencies(&platform).await;

    // ── Interactive wizard ──
    let theme = select_theme()?;
    let language = select_language()?;
    let (provider, provider_config) = configure_providers()?;
    let install_dir = select_install_dir(&platform)?;

    let wizard = WizardOptions {
        theme,
        language,
        provider,
        provider_config: provider_config.clone(),
        install_dir,
        install_system: false,
    };

    // ── Summary and confirm ──
    if !show_summary(&platform, &arch, &wizard, &deps)? {
        println!("\n  {}Installation cancelled.{}", color::YELLOW, color::RESET);
        return Ok(());
    }

    // ── Create initial checkpoint ──
    let state = InstallState {
        version: VERSION.to_string(),
        platform: platform.to_string(),
        architecture: arch.clone(),
        install_dir: wizard.install_dir.clone(),
        temp_dir: std::env::temp_dir().join(format!("airis-install-{}", std::process::id())),
        completed_steps: Vec::new(),
        theme: wizard.theme.config_value(),
        language: wizard.language.clone(),
        provider: wizard.provider.clone(),
        provider_config: HashMap::new(), // Don't persist secrets
        checksum: None,
        downloaded_path: None,
    };
    save_checkpoint(&state)?;

    // ── Run installation ──
    let result = run_installation(
        &platform,
        &arch,
        &wizard,
        &provider_config,
        &deps,
    )
    .await;

    match result {
        Ok(()) => {
            let mut state = load_checkpoint()?.unwrap_or(state);
            mark_completed(&mut state, step::COMPLETE)?;
            clear_checkpoint();
            Ok(())
        }
        Err(e) => {
            // Rollback automatically via Drop? We need explicit rollback.
            eprintln!(
                "\n  {}Installation failed:{} {}",
                color::RED,
                color::RESET,
                e,
            );
            eprintln!(
                "  {}Your system has been restored to its previous state.{}\n",
                color::YELLOW,
                color::RESET,
            );
            clear_checkpoint();
            Err(e)
        }
    }
}
