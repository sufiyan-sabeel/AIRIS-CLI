//! Workspace management for AIRIS-CLI.
//!
//! Provides project root management, file discovery, project analysis,
//! and configuration reading for the coding assistant.

use airis_core::prelude::*;
use async_trait::async_trait;
use chrono::Utc;
use globset::{Glob, GlobSetBuilder};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::info;
use walkdir::WalkDir;

/// Thread-safe mutable workspace root state.
pub struct WorkspaceManagerImpl {
    root: Mutex<Option<PathBuf>>,
}

impl WorkspaceManagerImpl {
    /// Create a new unconfigured workspace manager.
    pub fn new() -> Self {
        Self {
            root: Mutex::new(None),
        }
    }

    /// Create a workspace manager with a pre-set root path.
    pub fn new_with_root(root: PathBuf) -> Self {
        Self {
            root: Mutex::new(Some(root)),
        }
    }
}

impl Default for WorkspaceManagerImpl {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl WorkspaceManager for WorkspaceManagerImpl {
    /// Set the workspace root directory.
    ///
    /// Validates that the path exists and is a directory, then stores it.
    async fn set_root(&self, path: &Path) -> AirisResult<()> {
        let canonical = path
            .canonicalize()
            .map_err(|e| {
                AirisError::Workspace(format!(
                    "Invalid workspace path {:?}: {}",
                    path, e
                ))
            })?;

        if !canonical.is_dir() {
            return Err(AirisError::Workspace(format!(
                "Workspace path {:?} is not a directory",
                canonical
            )));
        }

        let mut root = self.root.lock();
        *root = Some(canonical.clone());
        info!("Workspace root set to {:?}", canonical);
        Ok(())
    }

    /// Get the current workspace root path, if set.
    fn root(&self) -> Option<PathBuf> {
        self.root.lock().clone()
    }

    /// Generate a project summary by analyzing workspace contents.
    ///
    /// Detects language, frameworks, entry points, key files, and dependencies
    /// by inspecting file extensions and known build/configuration files.
    async fn summary(&self) -> AirisResult<WorkspaceSummary> {
        let root = self
            .root
            .lock()
            .clone()
            .ok_or_else(|| AirisError::Workspace("Workspace root not set".into()))?;

        let language = detect_language(&root);
        let frameworks = detect_frameworks(&root);
        let entry_points = find_entry_points(&root);
        let key_files = find_key_files(&root);
        let dependencies = find_dependencies(&root);

        Ok(WorkspaceSummary {
            root,
            language,
            frameworks,
            entry_points,
            key_files,
            dependencies,
            last_analyzed: Utc::now(),
        })
    }

    /// List workspace files matching the given glob pattern(s).
    ///
    /// Multiple patterns can be separated by newline or semicolon.
    /// Skips hidden directories (`.`-prefixed), `node_modules`, `target`,
    /// `__pycache__`, and other common build artifact directories.
    async fn list_files(&self, pattern: &str) -> AirisResult<Vec<PathBuf>> {
        let root = self
            .root
            .lock()
            .clone()
            .ok_or_else(|| AirisError::Workspace("Workspace root not set".into()))?;

        // Build a glob set from the pattern(s)
        let mut builder = GlobSetBuilder::new();
        for raw in pattern.split(|c| c == '\n' || c == ';') {
            let pat = raw.trim();
            if pat.is_empty() {
                continue;
            }
            let glob = Glob::new(pat).map_err(|e| {
                AirisError::Workspace(format!("Invalid glob pattern '{}': {}", pat, e))
            })?;
            builder.add(glob);
        }
        let globset = builder.build().map_err(|e| {
            AirisError::Workspace(format!("Failed to build glob set: {}", e))
        })?;

        // Skip common non-source directories
        let skip_dirs: &[&str] = &[
            ".git",
            ".svn",
            ".hg",
            "node_modules",
            "target",
            "__pycache__",
            ".venv",
            "venv",
            ".tox",
            "dist",
            "build",
            ".next",
            ".nuxt",
        ];

        let mut results = Vec::new();
        for entry in WalkDir::new(&root)
            .follow_links(true)
            .into_iter()
            .filter_entry(|e| {
                if e.depth() == 0 {
                    return true; // Always include root
                }
                let name = e.file_name().to_str().unwrap_or("");
                if e.file_type().is_dir() {
                    // Skip hidden directories and common build/artifact dirs
                    if name.starts_with('.') || skip_dirs.contains(&name) {
                        return false;
                    }
                }
                true
            })
        {
            let entry = entry.map_err(|e| {
                AirisError::Workspace(format!("Failed to read directory entry: {}", e))
            })?;
            if !entry.file_type().is_file() {
                continue;
            }
            let rel_path = entry.path().strip_prefix(&root).map_err(|e| {
                AirisError::Workspace(format!("Path error: {}", e))
            })?;

            if globset.is_match(rel_path) {
                results.push(rel_path.to_path_buf());
            }
        }

        results.sort();
        Ok(results)
    }

    /// Read a file relative to the workspace root.
    ///
    /// Performs a security check to ensure the resolved path does not escape
    /// the workspace root directory.
    async fn read_file(&self, relative_path: &Path) -> AirisResult<String> {
        let root = self
            .root
            .lock()
            .clone()
            .ok_or_else(|| AirisError::Workspace("Workspace root not set".into()))?;

        let full_path = root.join(relative_path);

        // Security: ensure resolved path is within workspace root
        let canonical = full_path.canonicalize().map_err(|_| {
            AirisError::FileNotFound(format!("File not found: {:?}", relative_path))
        })?;

        if !canonical.starts_with(&root) {
            return Err(AirisError::Workspace(format!(
                "Path {:?} escapes workspace root",
                relative_path
            )));
        }

        fs::read_to_string(&full_path)
            .await
            .map_err(AirisError::Io)
    }

    /// Read workspace configuration.
    ///
    /// Checks for `airis.toml` in the workspace root, then falls back to
    /// `.airis/config.toml`. Returns an empty JSON object if neither exists.
    async fn config(&self) -> AirisResult<serde_json::Value> {
        let root = self
            .root
            .lock()
            .clone()
            .ok_or_else(|| AirisError::Workspace("Workspace root not set".into()))?;

        // Try airis.toml in workspace root
        let config_path = root.join("airis.toml");
        if config_path.exists() {
            let content = fs::read_to_string(&config_path).await.map_err(|e| {
                AirisError::Workspace(format!("Failed to read config {:?}: {}", config_path, e))
            })?;
            let value: toml::Value = toml::from_str(&content)?;
            return Ok(serde_json::to_value(value)?);
        }

        // Fall back to .airis/config.toml
        let dir_config = root.join(".airis").join("config.toml");
        if dir_config.exists() {
            let content = fs::read_to_string(&dir_config).await.map_err(|e| {
                AirisError::Workspace(format!("Failed to read config {:?}: {}", dir_config, e))
            })?;
            let value: toml::Value = toml::from_str(&content)?;
            return Ok(serde_json::to_value(value)?);
        }

        // No config found
        Ok(serde_json::json!({}))
    }
}

// ─── Private Helpers ───────────────────────────────────────────────────────

/// Known source-file extension to language name mapping.
/// Ordered by specificity (more precise first).
const EXTENSION_LANGUAGES: &[(&str, &str)] = &[
    // Rust
    ("rs", "Rust"),
    // Python
    ("py", "Python"),
    ("pyi", "Python"),
    ("pyx", "Python"),
    // JavaScript / TypeScript
    ("tsx", "TypeScript"),
    ("ts", "TypeScript"),
    ("jsx", "JavaScript"),
    ("mjs", "JavaScript"),
    ("cjs", "JavaScript"),
    ("js", "JavaScript"),
    // Go
    ("go", "Go"),
    // Java / JVM
    ("java", "Java"),
    ("kt", "Kotlin"),
    ("kts", "Kotlin"),
    ("scala", "Scala"),
    ("sc", "Scala"),
    ("clj", "Clojure"),
    ("cljs", "ClojureScript"),
    // C / C++
    ("c", "C"),
    ("h", "C"),
    ("cpp", "C++"),
    ("hpp", "C++"),
    ("cc", "C++"),
    ("cxx", "C++"),
    ("cuh", "CUDA"),
    ("cu", "CUDA"),
    // Ruby
    ("rb", "Ruby"),
    ("erb", "Ruby"),
    // PHP
    ("php", "PHP"),
    // Swift
    ("swift", "Swift"),
    // Web
    ("html", "HTML"),
    ("htm", "HTML"),
    ("css", "CSS"),
    ("scss", "SCSS"),
    ("less", "Less"),
    // Shell / Scripts
    ("sh", "Shell"),
    ("bash", "Shell"),
    ("zsh", "Shell"),
    ("fish", "Shell"),
    ("ps1", "PowerShell"),
    ("lua", "Lua"),
    ("r", "R"),
    ("dart", "Dart"),
    ("elm", "Elm"),
    ("ex", "Elixir"),
    ("exs", "Elixir"),
    ("erl", "Erlang"),
    ("hrl", "Erlang"),
    ("hs", "Haskell"),
    ("lhs", "Haskell"),
    ("nim", "Nim"),
    ("zig", "Zig"),
    ("svelte", "Svelte"),
    ("vue", "Vue"),
    ("astro", "Astro"),
    ("sol", "Solidity"),
    ("tf", "Terraform"),
    ("yaml", "YAML"),
    ("yml", "YAML"),
    ("json", "JSON"),
    ("toml", "TOML"),
    ("sql", "SQL"),
];

/// Detect the primary programming language of the workspace by counting
/// source file extensions. Returns the most frequent language name.
fn detect_language(root: &Path) -> String {
    let mut ext_counts: HashMap<&'static str, usize> = HashMap::new();

    for entry in WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            for &(known_ext, lang) in EXTENSION_LANGUAGES {
                if ext_lower == known_ext {
                    *ext_counts.entry(lang).or_default() += 1;
                    break;
                }
            }
        }
    }

    // Return the most frequent language, or "Unknown"
    ext_counts
        .into_iter()
        .max_by_key(|&(_, count)| count)
        .map(|(lang, _)| lang.to_string())
        .unwrap_or_else(|| "Unknown".to_string())
}

/// Detect frameworks by scanning key build and config files.
fn detect_frameworks(root: &Path) -> Vec<String> {
    let mut frameworks = Vec::new();

    // Check Cargo.toml for Rust frameworks
    let cargo_path = root.join("Cargo.toml");
    if cargo_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&cargo_path) {
            let deps = extract_toml_dependency_names(&content);
            let rust_fw: &[(&str, &str)] = &[
                ("actix-web", "Actix-Web"),
                ("axum", "Axum"),
                ("rocket", "Rocket"),
                ("tide", "Tide"),
                ("warp", "Warp"),
                ("salvo", "Salvo"),
                ("poem", "Poem"),
                ("yew", "Yew"),
                ("leptos", "Leptos"),
                ("dioxus", "Dioxus"),
                ("tauri", "Tauri"),
                ("diesel", "Diesel"),
                ("sqlx", "SQLx"),
                ("sea-orm", "SeaORM"),
                ("tokio", "Tokio"),
                ("bevy", "Bevy"),
                ("egui", "egui"),
                ("iced", "Iced"),
            ];
            for &(dep_name, fw_name) in rust_fw {
                if deps.iter().any(|d| d == dep_name || d.starts_with(dep_name)) {
                    frameworks.push(fw_name.to_string());
                }
            }
        }
    }

    // Check package.json for Node.js frameworks
    let pkg_path = root.join("package.json");
    if pkg_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&pkg_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                let all_deps = collect_json_deps(&json);
                let js_fw: &[(&str, &str)] = &[
                    ("react", "React"),
                    ("next", "Next.js"),
                    ("vue", "Vue.js"),
                    ("nuxt", "Nuxt.js"),
                    ("angular", "Angular"),
                    ("svelte", "Svelte"),
                    ("express", "Express"),
                    ("fastify", "Fastify"),
                    ("nestjs", "NestJS"),
                    ("django", "Django"),
                    ("remix", "Remix"),
                    ("gatsby", "Gatsby"),
                    ("astro", "Astro"),
                ];
                for &(dep_name, fw_name) in js_fw {
                    if all_deps.iter().any(|d| d == dep_name || d.starts_with(dep_name)) {
                        frameworks.push(fw_name.to_string());
                    }
                }
            }
        }
    }

    // Check pyproject.toml for Python frameworks
    let pyproject = root.join("pyproject.toml");
    if pyproject.exists() {
        if let Ok(content) = std::fs::read_to_string(&pyproject) {
            let deps = extract_toml_dependency_names(&content);
            let py_fw: &[(&str, &str)] = &[
                ("django", "Django"),
                ("flask", "Flask"),
                ("fastapi", "FastAPI"),
                ("starlette", "Starlette"),
                ("tornado", "Tornado"),
                ("aiohttp", "aiohttp"),
                ("pydantic", "Pydantic"),
                ("sqlalchemy", "SQLAlchemy"),
                ("pytorch", "PyTorch"),
                ("tensorflow", "TensorFlow"),
            ];
            for &(dep_name, fw_name) in py_fw {
                if deps.iter().any(|d| d == dep_name || d.starts_with(dep_name)) {
                    frameworks.push(fw_name.to_string());
                }
            }
        }
    }

    // Check requirements.txt
    let req_path = root.join("requirements.txt");
    if req_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&req_path) {
            let py_fw: &[(&str, &str)] = &[
                ("django", "Django"),
                ("flask", "Flask"),
                ("fastapi", "FastAPI"),
                ("tornado", "Tornado"),
                ("aiohttp", "aiohttp"),
            ];
            for &(dep_name, fw_name) in py_fw {
                if content.lines().any(|l| {
                    let l = l.trim().to_lowercase();
                    l.starts_with(dep_name)
                        || l.starts_with(&format!("{}=", dep_name))
                        || l.starts_with(&format!("{}>", dep_name))
                        || l.starts_with(&format!("{}~", dep_name))
                        || l.starts_with(&format!("{}!", dep_name))
                }) {
                    if !frameworks.contains(&fw_name.to_string()) {
                        frameworks.push(fw_name.to_string());
                    }
                }
            }
        }
    }

    // Check go.mod
    let go_mod = root.join("go.mod");
    if go_mod.exists() {
        if let Ok(content) = std::fs::read_to_string(&go_mod) {
            if content.contains("github.com/gin-gonic/gin") {
                frameworks.push("Gin".to_string());
            }
            if content.contains("github.com/labstack/echo") {
                frameworks.push("Echo".to_string());
            }
            if content.contains("github.com/gofiber/fiber") {
                frameworks.push("Fiber".to_string());
            }
        }
    }

    // Check build.gradle or build.gradle.kts
    for filename in &["build.gradle", "build.gradle.kts"] {
        let path = root.join(filename);
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if content.contains("org.springframework.boot") {
                    frameworks.push("Spring Boot".to_string());
                }
                if content.contains("com.android") && content.contains("android") {
                    frameworks.push("Android".to_string());
                }
            }
        }
    }

    frameworks.sort();
    frameworks.dedup();
    frameworks
}

/// Find common entry point files for the project.
fn find_entry_points(root: &Path) -> Vec<PathBuf> {
    let candidates = &[
        "src/main.rs",
        "src/lib.rs",
        "src/main.py",
        "app.py",
        "main.py",
        "index.py",
        "src/index.ts",
        "src/index.js",
        "index.ts",
        "index.js",
        "src/app.ts",
        "src/app.tsx",
        "src/App.tsx",
        "src/App.jsx",
        "main.go",
        "cmd/main.go",
        "src/main.go",
        "Main.java",
        "src/main/java/com/example/Application.java",
        "src/main/kotlin/com/example/Application.kt",
        "index.html",
        "src/index.html",
        "app.ts",
        "app.js",
        "server.ts",
        "server.js",
        "cli.py",
        "entry.py",
        "src/entry.py",
        "main.swift",
        "Sources/App/main.swift",
        "pubspec.yaml",
        "Makefile",
        "Dockerfile",
    ];

    let mut entries = Vec::new();
    for candidate in candidates {
        let full = root.join(candidate);
        if full.exists() {
            entries.push(PathBuf::from(candidate));
        }
    }
    entries
}

/// Find important configuration and key files in the workspace.
fn find_key_files(root: &Path) -> Vec<String> {
    let candidates = &[
        "Cargo.toml",
        "package.json",
        "pyproject.toml",
        "requirements.txt",
        "go.mod",
        "go.sum",
        "build.gradle",
        "build.gradle.kts",
        "pom.xml",
        "CMakeLists.txt",
        "Makefile",
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
        ".env.example",
        "tsconfig.json",
        ".eslintrc.js",
        ".eslintrc.json",
        "prettier.config.js",
        "webpack.config.js",
        "vite.config.ts",
        "vite.config.js",
        "next.config.js",
        "nuxt.config.ts",
        "tailwind.config.js",
        "tailwind.config.ts",
        "airis.toml",
        ".airis/config.toml",
        "rust-toolchain.toml",
        "rust-toolchain",
        ".github/workflows/ci.yml",
        ".github/workflows/ci.yaml",
        "README.md",
        "LICENSE",
        ".gitignore",
        ".env",
        "settings.py",
        "manage.py",
        "Procfile",
        "composer.json",
        "Gemfile",
        "Podfile",
        "Cargo.lock",
        "yarn.lock",
        "pnpm-lock.yaml",
        "bun.lockb",
    ];

    let mut found = Vec::new();
    for candidate in candidates {
        let full = root.join(candidate);
        if full.exists() {
            found.push(candidate.to_string());
        }
    }
    found.sort();
    found
}

/// Extract dependency names from common build files by scanning their content.
fn find_dependencies(root: &Path) -> Vec<String> {
    let mut deps = Vec::new();

    // Cargo.toml
    let cargo = root.join("Cargo.toml");
    if cargo.exists() {
        if let Ok(content) = std::fs::read_to_string(&cargo) {
            let names = extract_toml_dependency_names(&content);
            deps.extend(names);
        }
    }

    // package.json
    let pkg = root.join("package.json");
    if pkg.exists() {
        if let Ok(content) = std::fs::read_to_string(&pkg) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                let names = collect_json_deps(&json);
                deps.extend(names);
            }
        }
    }

    // pyproject.toml
    let pyproject = root.join("pyproject.toml");
    if pyproject.exists() {
        if let Ok(content) = std::fs::read_to_string(&pyproject) {
            let names = extract_toml_dependency_names(&content);
            deps.extend(names);
        }
    }

    // requirements.txt
    let req = root.join("requirements.txt");
    if req.exists() {
        if let Ok(content) = std::fs::read_to_string(&req) {
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') || line.starts_with('-') {
                    continue;
                }
                // Extract package name (handle ==, >=, <=, ~=, !=, @)
                let name = line
                    .split(|c: char| c.is_whitespace() || "=<>~!@#".contains(c))
                    .next()
                    .unwrap_or(line)
                    .trim()
                    .to_string();
                if !name.is_empty() {
                    deps.push(name);
                }
            }
        }
    }

    // go.mod
    let go_mod = root.join("go.mod");
    if go_mod.exists() {
        if let Ok(content) = std::fs::read_to_string(&go_mod) {
            for line in content.lines() {
                let trimmed = line.trim();
                // Lines like: `	github.com/foo/bar v1.0.0`
                if !trimmed.starts_with("require") && trimmed.contains(' ') {
                    let parts: Vec<&str> = trimmed.split_whitespace().collect();
                    if parts.len() >= 2
                        && parts[0].contains('/')
                        && !parts[0].starts_with("//")
                    {
                        deps.push(parts[0].to_string());
                    }
                }
            }
        }
    }

    deps.sort();
    deps.dedup();
    deps
}

/// Extract dependency names from a TOML file content by looking for
/// `[dependencies]` and `[dev-dependencies]` sections.
fn extract_toml_dependency_names(content: &str) -> Vec<String> {
    let mut deps = Vec::new();
    if let Ok(value) = content.parse::<toml::Value>() {
        for key in &["dependencies", "dev-dependencies", "build-dependencies"] {
            if let Some(table) = value.get(key).and_then(|v| v.as_table()) {
                for dep_name in table.keys() {
                    deps.push(dep_name.clone());
                }
            }
        }
    }
    deps
}

/// Collect dependency names from a package.json value
/// (dependencies + devDependencies + peerDependencies).
fn collect_json_deps(json: &serde_json::Value) -> Vec<String> {
    let mut deps = Vec::new();
    for key in &["dependencies", "devDependencies", "peerDependencies"] {
        if let Some(obj) = json.get(key).and_then(|v| v.as_object()) {
            deps.extend(obj.keys().cloned());
        }
    }
    deps
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_and_default() {
        let wm = WorkspaceManagerImpl::new();
        assert!(wm.root().is_none());

        let wm_default = WorkspaceManagerImpl::default();
        assert!(wm_default.root().is_none());
    }

    #[test]
    fn test_new_with_root() {
        let root = PathBuf::from("/tmp");
        let wm = WorkspaceManagerImpl::new_with_root(root.clone());
        assert_eq!(wm.root(), Some(root));
    }

    #[tokio::test]
    async fn test_set_root_invalid_path() {
        let wm = WorkspaceManagerImpl::new();
        let result = wm.set_root(Path::new("/nonexistent_path_12345")).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_set_root_valid() {
        let wm = WorkspaceManagerImpl::new();
        let tmp = tempfile::tempdir().unwrap();
        wm.set_root(tmp.path()).await.unwrap();
        assert!(wm.root().is_some());
    }

    #[test]
    fn test_detect_language_rust() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("main.rs"), "fn main() {}").unwrap();
        std::fs::write(tmp.path().join("lib.rs"), "pub fn foo() {}").unwrap();

        let lang = detect_language(tmp.path());
        assert_eq!(lang, "Rust");
    }

    #[test]
    fn test_detect_language_python() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("main.py"), "print('hello')").unwrap();
        std::fs::write(tmp.path().join("utils.py"), "def foo(): pass").unwrap();
        // Majority should win
        std::fs::write(tmp.path().join("main.rs"), "fn main() {}").unwrap();

        let lang = detect_language(tmp.path());
        assert_eq!(lang, "Python");
    }

    #[test]
    fn test_detect_language_empty_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let lang = detect_language(tmp.path());
        assert_eq!(lang, "Unknown");
    }

    #[test]
    fn test_detect_frameworks_actix() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(
            tmp.path().join("Cargo.toml"),
            r#"
[package]
name = "test"

[dependencies]
actix-web = "4"
tokio = "1"
"#,
        )
        .unwrap();

        let frameworks = detect_frameworks(tmp.path());
        assert!(frameworks.contains(&"Actix-Web".to_string()));
        assert!(frameworks.contains(&"Tokio".to_string()));
    }

    #[test]
    fn test_detect_frameworks_react() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(
            tmp.path().join("package.json"),
            r#"{
  "dependencies": {
    "react": "^18.0.0",
    "next": "^13.0.0"
  }
}"#,
        )
        .unwrap();

        let frameworks = detect_frameworks(tmp.path());
        assert!(frameworks.contains(&"React".to_string()));
        assert!(frameworks.contains(&"Next.js".to_string()));
    }

    #[test]
    fn test_find_entry_points_rust() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("src");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("main.rs"), "fn main() {}").unwrap();

        let entries = find_entry_points(tmp.path());
        assert!(entries.contains(&PathBuf::from("src/main.rs")));
    }

    #[test]
    fn test_find_key_files_cargo() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("Cargo.toml"), "[package]\nname = \"test\"\n")
            .unwrap();
        std::fs::write(tmp.path().join(".gitignore"), "target/\n").unwrap();

        let key_files = find_key_files(tmp.path());
        assert!(key_files.contains(&"Cargo.toml".to_string()));
        assert!(key_files.contains(&".gitignore".to_string()));
    }

    #[test]
    fn test_extract_toml_dependency_names() {
        let content = r#"
[package]
name = "test"

[dependencies]
serde = "1"
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
assert_matches = "1"
"#;
        let deps = extract_toml_dependency_names(content);
        assert!(deps.contains(&"serde".to_string()));
        assert!(deps.contains(&"tokio".to_string()));
        assert!(deps.contains(&"assert_matches".to_string()));
    }

    #[test]
    fn test_collect_json_deps() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
  "dependencies": { "react": "^18" },
  "devDependencies": { "typescript": "^5" },
  "peerDependencies": { "react-dom": "^18" }
}"#,
        )
        .unwrap();
        let deps = collect_json_deps(&json);
        assert!(deps.contains(&"react".to_string()));
        assert!(deps.contains(&"typescript".to_string()));
        assert!(deps.contains(&"react-dom".to_string()));
    }

    #[tokio::test]
    async fn test_list_files_glob() {
        let wm = WorkspaceManagerImpl::new();
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("main.rs"), "").unwrap();
        std::fs::write(tmp.path().join("lib.rs"), "").unwrap();
        std::fs::write(tmp.path().join("README.md"), "").unwrap();
        // target dir should be skipped
        let target = tmp.path().join("target");
        std::fs::create_dir_all(&target).unwrap();

        wm.set_root(tmp.path()).await.unwrap();
        let files = wm.list_files("*.rs").await.unwrap();
        assert_eq!(files.len(), 2);
        assert!(files.contains(&PathBuf::from("main.rs")));
        assert!(files.contains(&PathBuf::from("lib.rs")));
    }

    #[tokio::test]
    async fn test_read_file() {
        let wm = WorkspaceManagerImpl::new();
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("hello.txt"), "Hello, World!").unwrap();

        wm.set_root(tmp.path()).await.unwrap();
        let content = wm.read_file(Path::new("hello.txt")).await.unwrap();
        assert_eq!(content, "Hello, World!");
    }

    #[tokio::test]
    async fn test_read_file_not_found() {
        let wm = WorkspaceManagerImpl::new();
        let tmp = tempfile::tempdir().unwrap();
        wm.set_root(tmp.path()).await.unwrap();
        let result = wm.read_file(Path::new("nonexistent.txt")).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_read_file_escape_attempt() {
        let wm = WorkspaceManagerImpl::new();
        let tmp = tempfile::tempdir().unwrap();
        wm.set_root(tmp.path()).await.unwrap();
        let result = wm.read_file(Path::new("../etc/passwd")).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_config_no_config() {
        let wm = WorkspaceManagerImpl::new();
        let tmp = tempfile::tempdir().unwrap();
        wm.set_root(tmp.path()).await.unwrap();
        let config = wm.config().await.unwrap();
        assert_eq!(config, serde_json::json!({}));
    }

    #[tokio::test]
    async fn test_config_airis_toml() {
        let wm = WorkspaceManagerImpl::new();
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(
            tmp.path().join("airis.toml"),
            r#"
model = "gpt-4"
temperature = 0.7
"#,
        )
        .unwrap();

        wm.set_root(tmp.path()).await.unwrap();
        let config = wm.config().await.unwrap();
        assert_eq!(config["model"], "gpt-4");
        assert_eq!(config["temperature"], 0.7);
    }

    #[tokio::test]
    async fn test_config_airis_dir() {
        let wm = WorkspaceManagerImpl::new();
        let tmp = tempfile::tempdir().unwrap();
        let airis_dir = tmp.path().join(".airis");
        std::fs::create_dir_all(&airis_dir).unwrap();
        std::fs::write(
            airis_dir.join("config.toml"),
            r#"model = "claude-3""#,
        )
        .unwrap();

        wm.set_root(tmp.path()).await.unwrap();
        let config = wm.config().await.unwrap();
        assert_eq!(config["model"], "claude-3");
    }

    #[tokio::test]
    async fn test_root_not_set_errors() {
        let wm = WorkspaceManagerImpl::new();
        assert!(wm.summary().await.is_err());
        assert!(wm.list_files("*.rs").await.is_err());
        assert!(wm.read_file(Path::new("test.rs")).await.is_err());
        assert!(wm.config().await.is_err());
    }

    #[test]
    fn test_find_dependencies_cargo() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(
            tmp.path().join("Cargo.toml"),
            r#"
[package]
name = "test"

[dependencies]
serde = "1"
tokio = { version = "1", features = ["full"] }
"#,
        )
        .unwrap();

        let deps = find_dependencies(tmp.path());
        assert!(deps.contains(&"serde".to_string()));
        assert!(deps.contains(&"tokio".to_string()));
    }
}
