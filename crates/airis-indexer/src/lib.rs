//! Project indexing and code search for AIRIS-CLI.
//!
//! Provides recursive directory walking (respecting `.gitignore`), language
//! detection by file extension, file chunking, symbol extraction via regex
//! patterns, symbol search, full-text code search, incremental re-indexing
//! by modification time, index persistence, and statistics tracking.

use airis_core::prelude::*;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use ignore::WalkBuilder;
use parking_lot::RwLock;
use regex::Regex;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tracing::{debug, info, trace, warn};

// ─── Language Detection ────────────────────────────────────────────────────

/// Map a file extension to its language name.
fn extension_to_language(ext: &str) -> Option<&'static str> {
    match ext.to_lowercase().as_str() {
        "rs" => Some("Rust"),
        "py" | "pyw" | "pyx" | "pxd" => Some("Python"),
        "js" | "jsx" | "mjs" | "cjs" => Some("JavaScript"),
        "ts" | "tsx" | "mts" | "cts" => Some("TypeScript"),
        "go" => Some("Go"),
        "java" | "kt" | "kts" | "scala" => Some("Java"),
        "c" | "h" => Some("C"),
        "cpp" | "cc" | "cxx" | "hpp" | "hh" | "hxx" => Some("C++"),
        "cs" => Some("C#"),
        "swift" => Some("Swift"),
        "rb" | "erb" => Some("Ruby"),
        "php" | "phtml" => Some("PHP"),
        "sh" | "bash" | "zsh" | "fish" => Some("Shell"),
        "html" | "htm" | "xhtml" => Some("HTML"),
        "css" | "scss" | "sass" | "less" => Some("CSS"),
        "xml" | "svg" | "xslt" | "xsd" => Some("XML"),
        "md" | "markdown" | "rst" => Some("Markdown"),
        "json" => Some("JSON"),
        "yaml" | "yml" => Some("YAML"),
        "toml" => Some("TOML"),
        "ini" | "cfg" | "conf" => Some("INI"),
        "sql" | "psql" => Some("SQL"),
        "lua" => Some("Lua"),
        "dart" => Some("Dart"),
        "hs" | "lhs" => Some("Haskell"),
        "ex" | "exs" => Some("Elixir"),
        "clj" | "cljs" | "cljc" | "edn" => Some("Clojure"),
        "zig" => Some("Zig"),
        "nim" => Some("Nim"),
        "r" | "R" | "rda" => Some("R"),
        "jl" => Some("Julia"),
        "erl" | "hrl" => Some("Erlang"),
        "ml" | "mli" => Some("OCaml"),
        "fs" | "fsx" | "fsi" => Some("F#"),
        "asm" | "s" | "S" => Some("Assembly"),
        "proto" => Some("Protobuf"),
        "graphql" | "gql" => Some("GraphQL"),
        _ => None,
    }
}

/// Detect the programming language for a file based on its path.
fn detect_language(path: &Path) -> Option<String> {
    // Check special filenames first.
    let file_name = path.file_name()?.to_str()?;
    match file_name {
        "Dockerfile" | "Containerfile" => return Some("Dockerfile".to_string()),
        "Makefile" | "makefile" | "GNUmakefile" => return Some("Makefile".to_string()),
        "CMakeLists.txt" => return Some("CMake".to_string()),
        _ => {}
    }
    let ext = path.extension()?.to_str()?;
    extension_to_language(ext).map(String::from)
}

// ─── Symbol Extraction ─────────────────────────────────────────────────────

/// Compiled regex patterns for symbol extraction across languages.
struct SymbolPatterns {
    // Rust
    rust_fn: Regex,
    rust_struct: Regex,
    rust_enum: Regex,
    rust_trait: Regex,
    rust_mod: Regex,
    rust_const: Regex,
    rust_type: Regex,
    rust_use: Regex,
    // Python
    python_fn: Regex,
    python_class: Regex,
    // JavaScript / TypeScript
    js_fn: Regex,
    js_class: Regex,
    js_interface: Regex,
    js_arrow: Regex,
    js_type: Regex,
    js_enum: Regex,
    // Go
    go_fn: Regex,
    go_struct: Regex,
    go_interface: Regex,
    go_const: Regex,
    go_type: Regex,
    // Java / C#
    java_class: Regex,
    java_interface: Regex,
    java_method: Regex,
    java_enum: Regex,
    // C / C++
    c_fn: Regex,
    c_struct: Regex,
    c_enum: Regex,
    c_macro: Regex,
    // Generic fallback
    generic_assign: Regex,
}

impl SymbolPatterns {
    fn new() -> Self {
        Self {
            // Rust
            rust_fn: Regex::new(
                r#"(?m)^\s*(?:pub\s+)?(?:unsafe\s+)?(?:async\s+)?fn\s+(\w+)"#,
            )
            .unwrap(),
            rust_struct: Regex::new(
                r#"(?m)^\s*(?:pub\s+)?(?:struct|union)\s+(\w+)"#,
            )
            .unwrap(),
            rust_enum: Regex::new(r#"(?m)^\s*(?:pub\s+)?enum\s+(\w+)"#).unwrap(),
            rust_trait: Regex::new(
                r#"(?m)^\s*(?:pub\s+)?(?:unsafe\s+)?trait\s+(\w+)"#,
            )
            .unwrap(),
            rust_mod: Regex::new(r#"(?m)^\s*(?:pub\s+)?mod\s+(\w+)"#).unwrap(),
            rust_const: Regex::new(
                r#"(?m)^\s*(?:pub\s+)?(?:const|static)\s+(\w+)"#,
            )
            .unwrap(),
            rust_type: Regex::new(
                r#"(?m)^\s*(?:pub\s+)?type\s+(\w+)"#,
            )
            .unwrap(),
            rust_use: Regex::new(r#"(?m)^\s*(?:pub\s+)?use\s+(\S+)"#).unwrap(),

            // Python
            python_fn: Regex::new(
                r#"(?m)^\s*(?:async\s+)?def\s+(\w+)\s*\("#,
            )
            .unwrap(),
            python_class: Regex::new(r#"(?m)^\s*class\s+(\w+)"#).unwrap(),

            // JavaScript / TypeScript
            js_fn: Regex::new(
                r#"(?m)^\s*(?:export\s+)?(?:async\s+)?function\s+(?:\*\s+)?(\w+)"#,
            )
            .unwrap(),
            js_class: Regex::new(
                r#"(?m)^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)"#,
            )
            .unwrap(),
            js_interface: Regex::new(
                r#"(?m)^\s*(?:export\s+)?interface\s+(\w+)"#,
            )
            .unwrap(),
            js_arrow: Regex::new(
                r#"(?m)^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\(|\w+)\s*(?:\)|\w+)\s*(?::[^=]*)?\s*=>"#,
            )
            .unwrap(),
            js_type: Regex::new(
                r#"(?m)^\s*(?:export\s+)?type\s+(\w+)"#,
            )
            .unwrap(),
            js_enum: Regex::new(
                r#"(?m)^\s*(?:export\s+)?enum\s+(\w+)"#,
            )
            .unwrap(),

            // Go
            go_fn: Regex::new(
                r#"(?m)^\s*(?:func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+))\s*\("#,
            )
            .unwrap(),
            go_struct: Regex::new(r#"(?m)^\s*type\s+(\w+)\s+struct"#).unwrap(),
            go_interface: Regex::new(
                r#"(?m)^\s*type\s+(\w+)\s+interface"#,
            )
            .unwrap(),
            go_const: Regex::new(r#"(?m)^\s*const\s+(\w+)"#).unwrap(),
            go_type: Regex::new(r#"(?m)^\s*type\s+(\w+)\s+"#).unwrap(),

            // Java / C#
            java_class: Regex::new(
                r#"(?m)^\s*(?:public|private|protected)?\s*(?:abstract|final|static)?\s*(?:class|record)\s+(\w+)"#,
            )
            .unwrap(),
            java_interface: Regex::new(
                r#"(?m)^\s*(?:public|private|protected)?\s*interface\s+(\w+)"#,
            )
            .unwrap(),
            java_method: Regex::new(
                r#"(?m)^\s*(?:public|private|protected)?\s*(?:static|abstract|final|synchronized)?\s*(?:\w+(?:<[^>]*>)?)\s+(\w+)\s*\("#,
            )
            .unwrap(),
            java_enum: Regex::new(
                r#"(?m)^\s*(?:public|private|protected)?\s*enum\s+(\w+)"#,
            )
            .unwrap(),

            // C / C++
            c_fn: Regex::new(
                r#"(?m)^\s*(?:static\s+|inline\s+|extern\s+)*(?:\w+(?:\s*\*)?\s+)+(\w+)\s*\("#,
            )
            .unwrap(),
            c_struct: Regex::new(
                r#"(?m)^\s*(?:typedef\s+)?(?:struct|union)\s+(\w+)"#,
            )
            .unwrap(),
            c_enum: Regex::new(
                r#"(?m)^\s*(?:typedef\s+)?enum\s+(\w+)"#,
            )
            .unwrap(),
            c_macro: Regex::new(r#"(?m)^\s*#\s*define\s+(\w+)"#).unwrap(),

            // Generic
            generic_assign: Regex::new(
                r#"(?m)^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?:=|:)"#,
            )
            .unwrap(),
        }
    }

    /// Extract symbols from source content for a given language.
    fn extract(&self, content: &str, language: Option<&str>) -> Vec<Symbol> {
        let mut symbols = Vec::new();

        match language {
            Some("Rust") => {
                self.capture_all(content, &self.rust_fn, SymbolKind::Function, &mut symbols);
                self.capture_all(content, &self.rust_struct, SymbolKind::Struct, &mut symbols);
                self.capture_all(content, &self.rust_enum, SymbolKind::Enum, &mut symbols);
                self.capture_all(content, &self.rust_trait, SymbolKind::Trait, &mut symbols);
                self.capture_all(content, &self.rust_mod, SymbolKind::Module, &mut symbols);
                self.capture_all(
                    content,
                    &self.rust_const,
                    SymbolKind::Constant,
                    &mut symbols,
                );
                self.capture_all(content, &self.rust_type, SymbolKind::Type, &mut symbols);
                self.capture_all(content, &self.rust_use, SymbolKind::Import, &mut symbols);
            }
            Some("Python") => {
                self.capture_all(
                    content,
                    &self.python_fn,
                    SymbolKind::Function,
                    &mut symbols,
                );
                self.capture_all(
                    content,
                    &self.python_class,
                    SymbolKind::Class,
                    &mut symbols,
                );
            }
            Some("JavaScript") | Some("TypeScript") => {
                self.capture_all(
                    content,
                    &self.js_fn,
                    SymbolKind::Function,
                    &mut symbols,
                );
                self.capture_all(
                    content,
                    &self.js_class,
                    SymbolKind::Class,
                    &mut symbols,
                );
                self.capture_all(
                    content,
                    &self.js_interface,
                    SymbolKind::Interface,
                    &mut symbols,
                );
                self.capture_all(
                    content,
                    &self.js_arrow,
                    SymbolKind::Function,
                    &mut symbols,
                );
                self.capture_all(content, &self.js_type, SymbolKind::Type, &mut symbols);
                self.capture_all(content, &self.js_enum, SymbolKind::Enum, &mut symbols);
            }
            Some("Go") => {
                self.capture_all(content, &self.go_fn, SymbolKind::Function, &mut symbols);
                self.capture_all(
                    content,
                    &self.go_struct,
                    SymbolKind::Struct,
                    &mut symbols,
                );
                self.capture_all(
                    content,
                    &self.go_interface,
                    SymbolKind::Interface,
                    &mut symbols,
                );
                self.capture_all(
                    content,
                    &self.go_const,
                    SymbolKind::Constant,
                    &mut symbols,
                );
                self.capture_all(content, &self.go_type, SymbolKind::Type, &mut symbols);
            }
            Some("Java") | Some("C#") => {
                self.capture_all(
                    content,
                    &self.java_class,
                    SymbolKind::Class,
                    &mut symbols,
                );
                self.capture_all(
                    content,
                    &self.java_interface,
                    SymbolKind::Interface,
                    &mut symbols,
                );
                self.capture_all(
                    content,
                    &self.java_method,
                    SymbolKind::Method,
                    &mut symbols,
                );
                self.capture_all(
                    content,
                    &self.java_enum,
                    SymbolKind::Enum,
                    &mut symbols,
                );
            }
            Some("C") | Some("C++") => {
                self.capture_all(
                    content,
                    &self.c_fn,
                    SymbolKind::Function,
                    &mut symbols,
                );
                self.capture_all(
                    content,
                    &self.c_struct,
                    SymbolKind::Struct,
                    &mut symbols,
                );
                self.capture_all(content, &self.c_enum, SymbolKind::Enum, &mut symbols);
                self.capture_all(content, &self.c_macro, SymbolKind::Macro, &mut symbols);
            }
            Some("Lua") => {
                if let Ok(re) =
                    Regex::new(r#"(?m)^\s*(?:local\s+)?function\s+(\w+)"#)
                {
                    self.capture_all(content, &re, SymbolKind::Function, &mut symbols);
                }
            }
            Some("Ruby") => {
                if let Ok(re) = Regex::new(
                    r#"(?m)^\s*(?:def\s+(?:self\.)?(\w+)|class\s+(\w+)|module\s+(\w+))"#,
                ) {
                    for cap in re.captures_iter(content) {
                        if let Some(name) = cap
                            .get(1)
                            .or_else(|| cap.get(2))
                            .or_else(|| cap.get(3))
                        {
                            let kind = if cap.get(2).is_some() {
                                SymbolKind::Class
                            } else if cap.get(3).is_some() {
                                SymbolKind::Module
                            } else {
                                SymbolKind::Method
                            };
                            let line = content[..name.start()].lines().count();
                            let col = name.start()
                                - content[..name.start()]
                                    .rfind('\n')
                                    .map_or(0, |i| i + 1);
                            symbols.push(Symbol {
                                name: name.as_str().to_string(),
                                kind,
                                line: line.saturating_add(1),
                                column: col.saturating_add(1),
                            });
                        }
                    }
                }
            }
            Some("PHP") => {
                if let Ok(re) = Regex::new(
                    r#"(?m)^\s*(?:public|private|protected|static)?\s*function\s+&?\s*(\w+)"#,
                ) {
                    self.capture_all(content, &re, SymbolKind::Function, &mut symbols);
                }
                if let Ok(re) =
                    Regex::new(r#"(?m)^\s*(?:abstract\s+)?class\s+(\w+)"#)
                {
                    self.capture_all(content, &re, SymbolKind::Class, &mut symbols);
                }
                if let Ok(re) =
                    Regex::new(r#"(?m)^\s*interface\s+(\w+)"#)
                {
                    self.capture_all(content, &re, SymbolKind::Interface, &mut symbols);
                }
            }
            Some("Shell") => {
                if let Ok(re) =
                    Regex::new(r#"(?m)^\s*(?:function\s+)?(\w+)\s*\(\)"#)
                {
                    self.capture_all(
                        content,
                        &re,
                        SymbolKind::Function,
                        &mut symbols,
                    );
                }
            }
            Some("Swift") => {
                if let Ok(re) = Regex::new(
                    r#"(?m)^\s*(?:public|private|fileprivate|internal|open)?\s*(?:static|class)?\s*func\s+(\w+)"#,
                ) {
                    self.capture_all(content, &re, SymbolKind::Function, &mut symbols);
                }
                if let Ok(re) = Regex::new(
                    r#"(?m)^\s*(?:public|private|fileprivate|internal|open)?\s*(?:final)?\s*class\s+(\w+)"#,
                ) {
                    self.capture_all(content, &re, SymbolKind::Class, &mut symbols);
                }
                if let Ok(re) = Regex::new(
                    r#"(?m)^\s*(?:public|private|fileprivate|internal|open)?\s*struct\s+(\w+)"#,
                ) {
                    self.capture_all(content, &re, SymbolKind::Struct, &mut symbols);
                }
                if let Ok(re) = Regex::new(
                    r#"(?m)^\s*(?:public|private|fileprivate|internal|open)?\s*enum\s+(\w+)"#,
                ) {
                    self.capture_all(content, &re, SymbolKind::Enum, &mut symbols);
                }
                if let Ok(re) = Regex::new(
                    r#"(?m)^\s*(?:public|private|fileprivate|internal|open)?\s*protocol\s+(\w+)"#,
                ) {
                    self.capture_all(
                        content,
                        &re,
                        SymbolKind::Interface,
                        &mut symbols,
                    );
                }
            }
            Some("Dart") => {
                if let Ok(re) =
                    Regex::new(r#"(?m)^\s*(?:abstract\s+)?class\s+(\w+)"#)
                {
                    self.capture_all(content, &re, SymbolKind::Class, &mut symbols);
                }
                if let Ok(re) =
                    Regex::new(r#"(?m)^\s*mixin\s+(\w+)"#)
                {
                    self.capture_all(content, &re, SymbolKind::Trait, &mut symbols);
                }
                if let Ok(re) =
                    Regex::new(r#"(?m)^\s*enum\s+(\w+)"#)
                {
                    self.capture_all(content, &re, SymbolKind::Enum, &mut symbols);
                }
            }
            Some("Haskell") => {
                if let Ok(re) =
                    Regex::new(r#"(?m)^(\w+)\s*(?:::?|\()"#)
                {
                    self.capture_all(
                        content,
                        &re,
                        SymbolKind::Function,
                        &mut symbols,
                    );
                }
                if let Ok(re) =
                    Regex::new(r#"(?m)^\s*data\s+(?:Family\s+)?(\w+)"#)
                {
                    self.capture_all(content, &re, SymbolKind::Type, &mut symbols);
                }
                if let Ok(re) =
                    Regex::new(r#"(?m)^\s*type\s+(?:family\s+)?(\w+)"#)
                {
                    self.capture_all(content, &re, SymbolKind::Type, &mut symbols);
                }
                if let Ok(re) = Regex::new(
                    r#"(?m)^\s*class\s+(?:\([^)]*\)\s+=>\s+)?(\w+)"#,
                ) {
                    self.capture_all(content, &re, SymbolKind::Trait, &mut symbols);
                }
                if let Ok(re) =
                    Regex::new(r#"(?m)^\s*module\s+(\w+(?:\.\w+)*)"#)
                {
                    self.capture_all(
                        content,
                        &re,
                        SymbolKind::Module,
                        &mut symbols,
                    );
                }
            }
            _ => {
                // Generic fallback: function-like patterns and variable assigns.
                if let Ok(re) = Regex::new(
                    r#"(?m)^\s*(?:function\s+)?(\w+)\s*\((?:[^)]*)\)\s*(?:\{|=>|:)"#,
                ) {
                    self.capture_all(
                        content,
                        &re,
                        SymbolKind::Function,
                        &mut symbols,
                    );
                }
                self.capture_all(
                    content,
                    &self.generic_assign,
                    SymbolKind::Variable,
                    &mut symbols,
                );
            }
        }

        // Deduplicate by (name, kind, line).
        let mut seen = HashSet::new();
        symbols.retain(|s| seen.insert((s.name.clone(), s.kind.clone(), s.line)));

        symbols
    }

    fn capture_all(
        &self,
        content: &str,
        re: &Regex,
        kind: SymbolKind,
        output: &mut Vec<Symbol>,
    ) {
        for cap in re.captures_iter(content) {
            if let Some(name_match) = cap.get(1) {
                let mut name = name_match.as_str().to_string();
                // Trim trailing non-name characters (generics, parens, etc.).
                name = name
                    .trim_end_matches('<')
                    .trim_end_matches(|c: char| c.is_whitespace() || c == '{' || c == '(')
                    .to_string();
                if name.is_empty() {
                    continue;
                }
                let line = content[..name_match.start()].lines().count();
                let col = name_match.start()
                    - content[..name_match.start()]
                        .rfind('\n')
                        .map_or(0, |i| i + 1);
                output.push(Symbol {
                    name,
                    kind: kind.clone(),
                    line: line.saturating_add(1),
                    column: col.saturating_add(1),
                });
            }
        }
    }
}

// ─── File Chunking ─────────────────────────────────────────────────────────

/// Default chunk size in lines.
const CHUNK_LINES: usize = 50;

/// Split file content into overlapping chunks.
fn chunk_content(content: &str) -> Vec<FileChunk> {
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() || content.trim().is_empty() {
        return Vec::new();
    }

    let total = lines.len();
    if total <= CHUNK_LINES {
        return vec![FileChunk {
            start_line: 1,
            end_line: total,
            content: content.to_string(),
            tokens: estimate_tokens(content),
        }];
    }

    let mut chunks = Vec::new();
    let overlap = CHUNK_LINES / 5; // ~20% overlap
    let step = CHUNK_LINES - overlap;
    let mut start = 0;

    while start < total {
        let end = (start + CHUNK_LINES).min(total);
        let chunk_text = lines[start..end].join("\n");
        chunks.push(FileChunk {
            start_line: start + 1,
            end_line: end,
            content: chunk_text,
            tokens: estimate_tokens(&chunk_text),
        });
        if end == total {
            break;
        }
        start += step;

        // If the remaining content is less than 1/3 chunk, merge into last.
        if total - start < CHUNK_LINES / 3 {
            let last = chunks.last_mut().unwrap();
            let merged = lines[last.start_line - 1..total].join("\n");
            last.content = merged;
            last.end_line = total;
            last.tokens = estimate_tokens(&last.content);
            break;
        }
    }

    chunks
}

/// Rough token estimate: 1 token ≈ 4 ASCII characters.
fn estimate_tokens(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    if text.is_ascii() {
        text.len() / 4 + 1
    } else {
        text.chars().count() / 4 + 1
    }
}

// ─── Content Hashing ───────────────────────────────────────────────────────

/// Compute the SHA-256 hex digest of file content.
fn hash_content(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    hex_encode(&hasher.finalize())
}

/// Minimal hex encoder (avoids pulling in the `hex` crate).
fn hex_encode(bytes: &[u8]) -> String {
    const HEX_CHARS: &[u8] = b"0123456789abcdef";
    let mut out = vec![0u8; bytes.len() * 2];
    for (i, &byte) in bytes.iter().enumerate() {
        out[i * 2] = HEX_CHARS[(byte >> 4) as usize];
        out[i * 2 + 1] = HEX_CHARS[(byte & 0xF) as usize];
    }
    unsafe { String::from_utf8_unchecked(out) }
}

// ─── Configuration ─────────────────────────────────────────────────────────

/// Configuration for the indexer.
#[derive(Debug, Clone)]
pub struct IndexerConfig {
    /// Maximum file size in bytes to index (default: 1 MiB).
    pub max_file_size: u64,
    /// Glob patterns to exclude.
    pub exclude_patterns: Vec<String>,
    /// Glob patterns to include (empty = include all non-excluded).
    pub include_patterns: Vec<String>,
    /// Maximum number of files to index (0 = unlimited).
    pub max_files: usize,
    /// Enable vector search (reserved for future use).
    pub enable_vector_search: bool,
}

impl Default for IndexerConfig {
    fn default() -> Self {
        Self {
            max_file_size: 1_048_576, // 1 MiB
            exclude_patterns: Vec::new(),
            include_patterns: Vec::new(),
            max_files: 0,
            enable_vector_search: false,
        }
    }
}

impl From<IndexingConfig> for IndexerConfig {
    fn from(cfg: IndexingConfig) -> Self {
        Self {
            max_file_size: cfg.max_file_size,
            exclude_patterns: cfg.exclude_patterns,
            include_patterns: cfg.include_patterns,
            max_files: cfg.max_files,
            enable_vector_search: cfg.enable_vector_search,
        }
    }
}

// ─── Persistence ───────────────────────────────────────────────────────────

/// On-disk representation of the index.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct IndexStore {
    files: Vec<IndexedFile>,
    indexed_at: DateTime<Utc>,
}

// ─── Indexer Implementation ────────────────────────────────────────────────

/// Project indexer implementing the [`Indexer`] trait.
///
/// Walks workspace directories respecting `.gitignore`, detects languages,
/// extracts symbols, chunks files, and supports full-text and symbol search.
pub struct IndexerImpl {
    config: RwLock<IndexerConfig>,
    /// file path → IndexedFile
    files: DashMap<PathBuf, IndexedFile>,
    /// (name, kind) → list of symbols for fast lookup
    symbol_index: DashMap<(String, SymbolKind), Vec<Symbol>>,
    /// Flat list of all symbols.
    all_symbols: RwLock<Vec<Symbol>>,
    /// Index statistics.
    stats: RwLock<IndexStats>,
    /// Persistence path on disk.
    index_path: RwLock<Option<PathBuf>>,
    /// Lazy-compiled symbol extraction patterns.
    patterns: SymbolPatterns,
    /// Language occurrence counter.
    languages: DashMap<String, usize>,
}

impl IndexerImpl {
    /// Create a new indexer with default configuration.
    pub fn new() -> Self {
        Self {
            config: RwLock::new(IndexerConfig::default()),
            files: DashMap::new(),
            symbol_index: DashMap::new(),
            all_symbols: RwLock::new(Vec::new()),
            stats: RwLock::new(IndexStats {
                total_files: 0,
                total_chunks: 0,
                total_symbols: 0,
                indexed_bytes: 0,
                languages: Vec::new(),
                last_indexed: None,
            }),
            index_path: RwLock::new(None),
            patterns: SymbolPatterns::new(),
            languages: DashMap::new(),
        }
    }

    /// Create a new indexer with a custom configuration.
    pub fn with_config(config: IndexerConfig) -> Self {
        let idx = Self::new();
        *idx.config.write() = config;
        idx
    }

    /// Create a new indexer with a persistence path.
    pub fn with_index_path(path: PathBuf) -> Self {
        let idx = Self::new();
        *idx.index_path.write() = Some(path);
        idx
    }

    // ── Internal helpers ──

    /// Index a single file and return the indexed entry (or `None` if skipped).
    fn index_file(
        &self,
        path: &Path,
        config: &IndexerConfig,
    ) -> AirisResult<Option<IndexedFile>> {
        let metadata = std::fs::metadata(path).map_err(|e| {
            AirisError::Io(std::io::Error::new(
                e.kind(),
                format!("{}: {}", path.display(), e),
            ))
        })?;

        if !metadata.is_file() {
            return Ok(None);
        }
        if metadata.len() > config.max_file_size {
            trace!(
                "Skipping large file: {} ({} bytes)",
                path.display(),
                metadata.len()
            );
            return Ok(None);
        }

        let last_modified = modified_to_datetime(&metadata)?;
        let content = std::fs::read(path).map_err(|e| {
            AirisError::Io(std::io::Error::new(
                e.kind(),
                format!("{}: {}", path.display(), e),
            ))
        })?;

        let content_hash = hash_content(&content);
        let content_str = String::from_utf8_lossy(&content).to_string();
        let language = detect_language(path);

        let symbols = self
            .patterns
            .extract(&content_str, language.as_deref());
        let chunks = chunk_content(&content_str);

        if let Some(lang) = &language {
            *self.languages.entry(lang.clone()).or_insert(0) += 1;
        }

        Ok(Some(IndexedFile {
            path: path.to_path_buf(),
            content_hash,
            last_modified,
            size_bytes: metadata.len(),
            language,
            symbols,
            chunks,
        }))
    }

    /// Check whether a file needs re-indexing based on modification time.
    fn needs_reindex(&self, path: &Path, current_mtime: DateTime<Utc>) -> bool {
        self.files
            .get(path)
            .map_or(true, |existing| existing.last_modified < current_mtime)
    }

    /// Rebuild the symbol lookup index from all indexed files.
    fn rebuild_symbol_index(&self) {
        self.symbol_index.clear();
        let mut all_symbols = Vec::new();
        let mut total_symbols = 0usize;

        for entry in self.files.iter() {
            for sym in &entry.symbols {
                let key = (sym.name.clone(), sym.kind.clone());
                self.symbol_index
                    .entry(key)
                    .or_insert_with(Vec::new)
                    .push(sym.clone());
                all_symbols.push(sym.clone());
                total_symbols += 1;
            }
        }

        *self.all_symbols.write() = all_symbols;

        let mut stats = self.stats.write();
        stats.total_files = self.files.len();
        stats.total_chunks = self.files.iter().map(|f| f.chunks.len()).sum();
        stats.total_symbols = total_symbols;
        stats.indexed_bytes = self.files.iter().map(|f| f.size_bytes).sum();
        let mut langs: Vec<String> = self
            .languages
            .iter()
            .map(|e| e.key().clone())
            .collect();
        langs.sort();
        stats.languages = langs;
    }

    /// Persist the index to disk as JSON.
    fn save_to_disk(&self) -> AirisResult<()> {
        let path_opt = self.index_path.read();
        let Some(path) = path_opt.as_ref() else {
            return Ok(());
        };

        let store = IndexStore {
            files: self.files.iter().map(|e| e.value().clone()).collect(),
            indexed_at: Utc::now(),
        };

        let json = serde_json::to_string_pretty(&store)?;
        std::fs::write(path, json)?;
        debug!("Index saved to {}", path.display());
        Ok(())
    }

    /// Load a previously persisted index from disk into memory.
    fn load_from_disk(&self) -> AirisResult<Option<IndexStore>> {
        let path_opt = self.index_path.read();
        let Some(path) = path_opt.as_ref() else {
            return Ok(None);
        };

        if !path.exists() {
            return Ok(None);
        }

        let json = std::fs::read_to_string(path)?;
        let store: IndexStore = serde_json::from_str(&json)?;
        debug!(
            "Index loaded from {} ({} files)",
            path.display(),
            store.files.len()
        );
        Ok(Some(store))
    }

    /// Load an existing index into the in-memory maps.
    fn load_existing(&self) -> AirisResult<()> {
        let Some(store) = self.load_from_disk()? else {
            return Ok(());
        };

        self.files.clear();
        self.languages.clear();

        for file in store.files {
            if let Some(lang) = &file.language {
                *self.languages.entry(lang.clone()).or_insert(0) += 1;
            }
            self.files.insert(file.path.clone(), file);
        }

        self.rebuild_symbol_index();

        let mut stats = self.stats.write();
        stats.last_indexed = Some(store.indexed_at);

        Ok(())
    }
}

impl Default for IndexerImpl {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Indexer for IndexerImpl {
    async fn index(&self, root: &Path) -> AirisResult<IndexStats> {
        let config = self.config.read().clone();
        info!("Indexing workspace: {}", root.display());

        // Load previously persisted index.
        self.load_existing()?;

        let mut file_count = 0usize;

        let mut walk = WalkBuilder::new(root);
        walk.hidden(false)
            .git_global(true)
            .git_ignore(true)
            .git_exclude(true)
            .require_git(false);

        // Apply custom exclude globs.
        let exclude_pats: Vec<_> = config
            .exclude_patterns
            .iter()
            .filter_map(|p| globset::Glob::new(p).ok().map(|g| g.compile_matcher()))
            .collect();
        for matcher in &exclude_pats {
            let m = matcher.clone();
            walk.filter_entry(move |entry| !m.is_match(entry.path()));
        }

        // Pre-compile include globs.
        let include_pats: Vec<_> = config
            .include_patterns
            .iter()
            .filter_map(|p| globset::Glob::new(p).ok().map(|g| g.compile_matcher()))
            .collect();
        let has_includes = !include_pats.is_empty();

        for result in walk.build() {
            let entry = match result {
                Err(e) => {
                    warn!("Walk error: {}", e);
                    continue;
                }
                Ok(e) => e,
            };

            if entry.file_type().map_or(false, |t| t.is_dir()) {
                continue;
            }

            let path = entry.path();

            // Apply include filtering.
            if has_includes && !include_pats.iter().any(|m| m.is_match(path)) {
                continue;
            }

            // Respect max file limit.
            if config.max_files > 0 && file_count >= config.max_files {
                warn!("Reached max file limit ({})", config.max_files);
                break;
            }

            // Check mtime for incremental re-indexing.
            let mtime = match std::fs::metadata(path)
                .ok()
                .and_then(|m| m.modified().ok())
            {
                Some(t) => system_time_to_datetime(t),
                None => continue,
            };

            if !self.needs_reindex(path, mtime) {
                file_count += 1;
                continue;
            }

            match self.index_file(path, &config) {
                Ok(Some(indexed)) => {
                    self.files.insert(path.to_path_buf(), indexed);
                    file_count += 1;
                }
                Ok(None) => {}
                Err(e) => {
                    trace!("Error indexing {}: {}", path.display(), e);
                }
            }
        }

        // Rebuild symbol index and finalise stats.
        self.rebuild_symbol_index();

        let mut stats = self.stats.write();
        stats.last_indexed = Some(Utc::now());
        let stats_clone = stats.clone();
        drop(stats);

        self.save_to_disk()?;

        info!(
            "Indexing complete: {} files, {} symbols, {} chunks",
            stats_clone.total_files,
            stats_clone.total_symbols,
            stats_clone.total_chunks,
        );

        Ok(stats_clone)
    }

    async fn search(&self, query: &str, limit: usize) -> AirisResult<Vec<SearchResult>> {
        if query.is_empty() {
            return Ok(Vec::new());
        }

        let query_lower = query.to_lowercase();
        let mut results = Vec::new();

        for entry in self.files.iter() {
            let file = entry.value();
            let content = match std::fs::read_to_string(&file.path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let lines: Vec<&str> = content.lines().collect();

            for (i, line) in lines.iter().enumerate() {
                let line_lower = line.to_lowercase();
                if let Some(col) = line_lower.find(&query_lower) {
                    let line_no = i + 1;
                    let ctx_start = i.saturating_sub(3);
                    let ctx_end = (i + 4).min(lines.len());

                    // Exact matches rank higher.
                    let exact = line.contains(query);
                    let relevance = if exact {
                        1.0 - (line_no as f64 * 0.000_1)
                    } else {
                        0.8 - (line_no as f64 * 0.000_1)
                    };

                    results.push(SearchResult {
                        file: file.path.clone(),
                        line: line_no,
                        column: col + 1,
                        line_content: (*line).to_string(),
                        context_before: lines[ctx_start..i]
                            .iter()
                            .map(|l| (*l).to_string())
                            .collect(),
                        context_after: lines[i + 1..ctx_end]
                            .iter()
                            .map(|l| (*l).to_string())
                            .collect(),
                        relevance,
                    });

                    if results.len() >= limit {
                        break;
                    }
                }
            }

            if results.len() >= limit {
                break;
            }
        }

        results.sort_by(|a, b| {
            b.relevance
                .partial_cmp(&a.relevance)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        results.truncate(limit);
        Ok(results)
    }

    async fn search_symbols(
        &self,
        name: &str,
        kind: Option<SymbolKind>,
    ) -> AirisResult<Vec<Symbol>> {
        if name.is_empty() {
            return Ok(Vec::new());
        }

        let name_lower = name.to_lowercase();
        let mut results = Vec::new();

        // Exact (name + kind) matches from the index.
        if let Some(k) = &kind {
            if let Some(symbols) = self
                .symbol_index
                .get(&(name.to_string(), k.clone()))
            {
                results.extend(symbols.value().iter().cloned());
            }
        }

        // Partial matches across all symbols.
        let all_syms = self.all_symbols.read();
        for sym in all_syms.iter() {
            // Skip already added (exact match).
            if results.iter().any(|r| {
                r.name == sym.name
                    && r.kind == sym.kind
                    && r.line == sym.line
                    && r.column == sym.column
            }) {
                continue;
            }

            if sym.name.to_lowercase().contains(&name_lower) {
                if let Some(k) = &kind {
                    if *k != sym.kind {
                        continue;
                    }
                }
                results.push(sym.clone());
            }
        }

        // Exact name prefix matches first, then shorter names.
        results.sort_by(|a, b| {
            let a_exact = a.name.to_lowercase() == name_lower;
            let b_exact = b.name.to_lowercase() == name_lower;
            b_exact
                .cmp(&a_exact)
                .then_with(|| a.name.len().cmp(&b.name.len()))
        });

        Ok(results)
    }

    async fn get_file(&self, path: &Path) -> AirisResult<Option<IndexedFile>> {
        Ok(self.files.get(path).map(|e| e.value().clone()))
    }

    async fn stats(&self) -> AirisResult<IndexStats> {
        Ok(self.stats.read().clone())
    }

    async fn clear(&self) -> AirisResult<()> {
        self.files.clear();
        self.symbol_index.clear();
        self.all_symbols.write().clear();
        self.languages.clear();

        *self.stats.write() = IndexStats {
            total_files: 0,
            total_chunks: 0,
            total_symbols: 0,
            indexed_bytes: 0,
            languages: Vec::new(),
            last_indexed: None,
        };

        // Remove persisted index file.
        if let Some(path) = self.index_path.read().as_ref() {
            if path.exists() {
                std::fs::remove_file(path).ok();
            }
        }

        debug!("Index cleared");
        Ok(())
    }
}

// ─── Time Helpers ──────────────────────────────────────────────────────────

fn system_time_to_datetime(t: SystemTime) -> DateTime<Utc> {
    let duration = t.duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default();
    DateTime::from_timestamp(duration.as_secs() as i64, duration.subsec_nanos())
        .unwrap_or_default()
}

fn modified_to_datetime(metadata: &std::fs::Metadata) -> AirisResult<DateTime<Utc>> {
    let t = metadata
        .modified()
        .map_err(|e| {
            AirisError::Io(std::io::Error::new(e.kind(), "failed to read modification time"))
        })?;
    Ok(system_time_to_datetime(t))
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // ── Language detection ──

    #[test]
    fn test_detect_language() {
        assert_eq!(
            detect_language(Path::new("foo.rs")),
            Some("Rust".into())
        );
        assert_eq!(
            detect_language(Path::new("foo.py")),
            Some("Python".into())
        );
        assert_eq!(
            detect_language(Path::new("foo.ts")),
            Some("TypeScript".into())
        );
        assert_eq!(
            detect_language(Path::new("foo.tsx")),
            Some("TypeScript".into())
        );
        assert_eq!(
            detect_language(Path::new("foo.js")),
            Some("JavaScript".into())
        );
        assert_eq!(
            detect_language(Path::new("foo.go")),
            Some("Go".into())
        );
        assert_eq!(
            detect_language(Path::new("foo.java")),
            Some("Java".into())
        );
        assert_eq!(
            detect_language(Path::new("Dockerfile")),
            Some("Dockerfile".into())
        );
        assert_eq!(
            detect_language(Path::new("Makefile")),
            Some("Makefile".into())
        );
        assert_eq!(detect_language(Path::new("foo.unknown_ext")), None);
        assert_eq!(detect_language(Path::new("")), None);
    }

    // ── Hashing ──

    #[test]
    fn test_hash_content() {
        let h1 = hash_content(b"hello world");
        let h2 = hash_content(b"hello world");
        let h3 = hash_content(b"hello world!");
        assert_eq!(h1, h2);
        assert_ne!(h1, h3);
        assert_eq!(h1.len(), 64);
    }

    #[test]
    fn test_hex_encode() {
        assert_eq!(hex_encode(&[0x00]), "00");
        assert_eq!(hex_encode(&[0xFF, 0x01]), "ff01");
        assert_eq!(hex_encode(&[]), "");
    }

    // ── Chunking ──

    #[test]
    fn test_chunk_content_small() {
        let content = "line1\nline2\nline3";
        let chunks = chunk_content(content);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].start_line, 1);
        assert_eq!(chunks[0].end_line, 3);
    }

    #[test]
    fn test_chunk_content_large() {
        let lines: Vec<String> = (0..200).map(|i| format!("line_{}", i)).collect();
        let content = lines.join("\n");
        let chunks = chunk_content(&content);
        assert!(chunks.len() >= 4);
        assert_eq!(chunks[0].start_line, 1);
        assert_eq!(chunks.last().unwrap().end_line, 200);
    }

    #[test]
    fn test_chunk_overlap() {
        let lines: Vec<String> = (0..60).map(|i| format!("line_{}", i)).collect();
        let content = lines.join("\n");
        let chunks = chunk_content(&content);
        assert!(chunks.len() >= 2);
        if chunks.len() >= 2 {
            assert!(chunks[1].start_line < 51, "chunks should overlap");
        }
    }

    // ── Symbol extraction ──

    #[test]
    fn test_symbol_extraction_rust() {
        let patterns = SymbolPatterns::new();
        let content = r#"
pub fn hello() {}
fn private_fn() -> i32 { 42 }
pub struct MyStruct { x: i32 }
enum Color { Red, Green, Blue }
pub trait Display { fn fmt(&self); }
mod utils;
pub const MAX_SIZE: usize = 1024;
pub type MyResult<T> = std::result::Result<T, Error>;
use std::collections::HashMap;
"#;
        let symbols = patterns.extract(content, Some("Rust"));
        let names: Vec<&str> = symbols.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"hello"), "fn hello: {:?}", names);
        assert!(names.contains(&"private_fn"), "fn private_fn: {:?}", names);
        assert!(names.contains(&"MyStruct"), "struct MyStruct: {:?}", names);
        assert!(names.contains(&"Color"), "enum Color: {:?}", names);
        assert!(names.contains(&"Display"), "trait Display: {:?}", names);
        assert!(names.contains(&"utils"), "mod utils: {:?}", names);
        assert!(names.contains(&"MAX_SIZE"), "const MAX_SIZE: {:?}", names);
        assert!(names.contains(&"MyResult"), "type MyResult: {:?}", names);
    }

    #[test]
    fn test_symbol_extraction_python() {
        let patterns = SymbolPatterns::new();
        let content = r#"
def simple():
    pass

async def async_func():
    pass

class MyClass:
    pass
"#;
        let symbols = patterns.extract(content, Some("Python"));
        let names: Vec<&str> = symbols.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"simple"));
        assert!(names.contains(&"async_func"));
        assert!(names.contains(&"MyClass"));
    }

    #[test]
    fn test_symbol_extraction_typescript() {
        let patterns = SymbolPatterns::new();
        let content = r#"
interface User { name: string; }
type Result<T> = T | null;
enum Direction { Up, Down }
function greet(name: string): void {}
const arrow = (x: number) => x * 2;
export class Service {}
"#;
        let symbols = patterns.extract(content, Some("TypeScript"));
        let names: Vec<&str> = symbols.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"User"));
        assert!(names.contains(&"Result"));
        assert!(names.contains(&"Direction"));
        assert!(names.contains(&"greet"));
        assert!(names.contains(&"arrow"));
        assert!(names.contains(&"Service"));
    }

    #[test]
    fn test_symbol_extraction_go() {
        let patterns = SymbolPatterns::new();
        let content = r#"
func hello() {}
type MyStruct struct { x int }
type MyInterface interface { Do() }
const PI = 3.14
type StringAlias string
"#;
        let symbols = patterns.extract(content, Some("Go"));
        let names: Vec<&str> = symbols.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"hello"));
        assert!(names.contains(&"MyStruct"));
        assert!(names.contains(&"MyInterface"));
        assert!(names.contains(&"PI"));
    }

    #[test]
    fn test_symbol_extraction_no_language() {
        let patterns = SymbolPatterns::new();
        let content = "const x = 42\nfunction foo() {\n  return 1\n}";
        let symbols = patterns.extract(content, None);
        assert!(symbols.iter().any(|s| s.name == "x" || s.name == "foo"));
    }

    #[test]
    fn test_symbol_kind_counts() {
        let patterns = SymbolPatterns::new();
        let content = r#"
pub const MAX: u32 = 100;
pub type MyType = i32;
use std::collections::HashMap;
fn whatever() {}
"#;
        let symbols = patterns.extract(content, Some("Rust"));
        let names: Vec<&str> = symbols.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"MAX"));
        assert!(names.contains(&"MyType"));
        assert!(names.contains(&"whatever"));
    }

    // ── Indexer ──

    #[test]
    fn test_indexer_new() {
        let indexer = IndexerImpl::new();
        let stats = indexer.stats();
        assert_eq!(stats.total_files, 0);
        assert_eq!(stats.total_symbols, 0);
    }

    #[tokio::test]
    async fn test_indexer_clear() {
        let indexer = IndexerImpl::new();
        indexer.clear().await.unwrap();
        let stats = indexer.stats().unwrap();
        assert_eq!(stats.total_files, 0);
    }

    #[tokio::test]
    async fn test_index_file_content() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("test.rs");
        std::fs::write(
            &file_path,
            "pub fn hello() {}\npub struct Foo {}\n",
        )
        .unwrap();

        let indexer = IndexerImpl::new();
        let stats = indexer.index(dir.path()).await.unwrap();
        assert_eq!(stats.total_files, 1);
        assert!(stats.total_symbols >= 2);
        assert_eq!(stats.languages, vec!["Rust"]);

        let file = indexer.get_file(&file_path).await.unwrap();
        assert!(file.is_some());
        let file = file.unwrap();
        assert_eq!(file.language, Some("Rust".into()));
        assert_eq!(file.symbols.len(), 2);
    }

    #[tokio::test]
    async fn test_search() {
        let dir = TempDir::new().unwrap();
        let rs_path = dir.path().join("lib.rs");
        std::fs::write(
            &rs_path,
            "pub fn add(x: i32, y: i32) -> i32 { x + y }\npub fn sub(x: i32, y: i32) -> i32 { x - y }\n",
        )
        .unwrap();

        let indexer = IndexerImpl::new();
        indexer.index(dir.path()).await.unwrap();

        let results = indexer.search("add", 10).await.unwrap();
        assert!(!results.is_empty());
        assert!(results.iter().any(|r| r.line_content.contains("add")));

        let no_results = indexer.search("nonexistent", 10).await.unwrap();
        assert!(no_results.is_empty());
    }

    #[tokio::test]
    async fn test_search_symbols() {
        let dir = TempDir::new().unwrap();
        std::fs::write(
            dir.path().join("lib.rs"),
            "pub fn hello() {}\npub struct MyStruct {}\npub fn help() {}\n",
        )
        .unwrap();

        let indexer = IndexerImpl::new();
        indexer.index(dir.path()).await.unwrap();

        let syms = indexer.search_symbols("hello", None).await.unwrap();
        assert!(!syms.is_empty());
        assert_eq!(syms[0].name, "hello");
        assert_eq!(syms[0].kind, SymbolKind::Function);

        let structs = indexer
            .search_symbols("My", Some(SymbolKind::Struct))
            .await
            .unwrap();
        assert!(!structs.is_empty());
        assert_eq!(structs[0].name, "MyStruct");
    }

    #[tokio::test]
    async fn test_incremental_reindex() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("lib.rs");
        std::fs::write(&file_path, "pub fn hello() {}\n").unwrap();

        let indexer = IndexerImpl::new();
        let stats1 = indexer.index(dir.path()).await.unwrap();
        assert_eq!(stats1.total_files, 1);

        // Re-index without changes.
        let stats2 = indexer.index(dir.path()).await.unwrap();
        assert_eq!(stats2.total_files, 1);

        // Modify file and re-index.
        std::fs::write(
            &file_path,
            "pub fn hello() {}\npub fn world() {}\n",
        )
        .unwrap();
        let stats3 = indexer.index(dir.path()).await.unwrap();
        assert_eq!(stats3.total_files, 1);
        assert!(stats3.total_symbols >= 2);
    }

    #[tokio::test]
    async fn test_persistence() {
        let dir = TempDir::new().unwrap();
        let index_path = dir.path().join("index.json");
        let src_dir = TempDir::new().unwrap();
        std::fs::write(
            src_dir.path().join("lib.rs"),
            "pub fn foo() {}\n",
        )
        .unwrap();

        // Index and persist.
        let indexer = IndexerImpl::with_index_path(index_path.clone());
        indexer.index(src_dir.path()).await.unwrap();
        assert!(index_path.exists());

        // Load from disk.
        let indexer2 = IndexerImpl::with_index_path(index_path);
        indexer2.index(src_dir.path()).await.unwrap();
        let stats = indexer2.stats().await.unwrap();
        assert_eq!(stats.total_files, 1);
    }

    // ── Config ──

    #[test]
    fn test_indexer_config_default() {
        let cfg = IndexerConfig::default();
        assert_eq!(cfg.max_file_size, 1_048_576);
        assert!(cfg.exclude_patterns.is_empty());
    }

    // ── Edge cases ──

    #[tokio::test]
    async fn test_empty_query() {
        let indexer = IndexerImpl::new();
        let results = indexer.search("", 10).await.unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_empty_content_chunking() {
        let chunks = chunk_content("");
        assert!(chunks.is_empty());
    }

    #[test]
    fn test_empty_hash() {
        let h = hash_content(b"");
        assert_eq!(h.len(), 64);
    }
}
