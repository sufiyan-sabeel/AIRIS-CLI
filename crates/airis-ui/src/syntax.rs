//! Syntax highlighting for code blocks using syntect.
//!
//! Provides a wrapper around syntect that integrates with ratatui's style
//! system, mapping syntect scopes and colors to terminal colors.

use crate::theme::Theme;
use ratatui::style::{Color, Modifier, Style};
use syntect::highlighting::{
    FontStyle as SyntectFontStyle, HighlightState, Highlighter, RangedHighlightIterator,
    StyleModifier as SyntectStyleModifier, Theme as SyntectTheme,
};
use syntect::parsing::{ParseState, ScopeStack, SyntaxReference, SyntaxSet};
use syntect::easy::HighlightLines as SyntectHighlightLines;
use std::sync::LazyLock;

/// Global syntax set singleton.
static SYNTAX_SET: LazyLock<SyntaxSet> = LazyLock::new(SyntaxSet::load_defaults_newlines);

fn syntax_set() -> &'static SyntaxSet {
    &SYNTAX_SET
}

/// Get a syntax definition for a given language name.
pub fn find_syntax(language: &str) -> Option<&'static SyntaxReference> {
    let ss = syntax_set();
    // Try exact match first
    if let Some(syn) = ss.find_syntax_by_name(language) {
        return Some(syn);
    }
    // Try extension-based matching
    if let Some(syn) = ss.find_syntax_by_token(language) {
        return Some(syn);
    }
    // Try first alias match
    for syn in ss.syntaxes() {
        if syn.name.eq_ignore_ascii_case(language) {
            return Some(syn);
        }
        if syn.aliases.iter().any(|a| a.eq_ignore_ascii_case(language)) {
            return Some(syn);
        }
        if syn.file_extensions.iter().any(|e| e.eq_ignore_ascii_case(language)) {
            return Some(syn);
        }
    }
    None
}

/// Highlighted segment with its style.
#[derive(Debug, Clone)]
pub struct HighlightedSegment {
    pub style: Style,
    pub text: String,
}

/// A stateful syntax highlighter for a single language.
pub struct CodeHighlighter {
    highlighter: SyntectHighlightLines<'static>,
}

impl CodeHighlighter {
    /// Create a new highlighter for the given language.
    pub fn new(language: &str, syntect_theme: &SyntectTheme) -> Self {
        let syn = find_syntax(language)
            .unwrap_or_else(|| syntax_set().find_syntax_plain_text());
        Self {
            highlighter: SyntectHighlightLines::new(syn, syntect_theme),
        }
    }

    /// Highlight a single line of code.
    pub fn highlight_line<'a>(
        &mut self,
        line: &'a str,
    ) -> Vec<HighlightedSegment> {
        let ranges = self.highlighter.highlight_line(line, syntax_set())
            .unwrap_or_default();
        ranges
            .into_iter()
            .map(|(style, text)| {
                HighlightedSegment {
                    style: syntect_to_ratatui_style(style),
                    text,
                }
            })
            .collect()
    }

    /// Highlight an entire code block.
    pub fn highlight_code(
        &mut self,
        code: &str,
    ) -> Vec<Vec<HighlightedSegment>> {
        code.lines()
            .map(|line| self.highlight_line(line))
            .collect()
    }
}

/// Convert a syntect style to a ratatui Style.
fn syntect_to_ratatui_style(syntect_style: syntect::highlighting::Style) -> Style {
    let mut style = Style::default();

    // Foreground color
    let fg = syntect_style.foreground;
    style = style.fg(Color::Rgb(fg.r, fg.g, fg.b));

    // Background color (only if non-default)
    let bg = syntect_style.background;
    if bg.a > 0 {
        style = style.bg(Color::Rgb(bg.r, bg.g, bg.b));
    }

    // Font style modifiers
    if syntect_style.font_style.contains(SyntectFontStyle::BOLD) {
        style = style.add_modifier(Modifier::BOLD);
    }
    if syntect_style.font_style.contains(SyntectFontStyle::ITALIC) {
        style = style.add_modifier(Modifier::ITALIC);
    }
    if syntect_style.font_style.contains(SyntectFontStyle::UNDERLINE) {
        style = style.add_modifier(Modifier::UNDERLINED);
    }

    style
}

/// Static highlighter for one-shot highlighting without maintaining state.
pub fn highlight_code_block(
    code: &str,
    language: &str,
    theme: &SyntectTheme,
) -> Vec<Vec<HighlightedSegment>> {
    let mut highlighter = CodeHighlighter::new(language, theme);
    highlighter.highlight_code(code)
}

/// Detect the language from a code block's info string (e.g. "rust" or "python,title=foo").
pub fn detect_language(info_string: &str) -> &str {
    let trimmed = info_string.trim();
    if trimmed.is_empty() || trimmed.contains(' ') {
        // Complex info strings: extract first word
        trimmed.split(|c: char| c.is_whitespace() || c == ',' || c == ';')
            .next()
            .unwrap_or("")
    } else {
        trimmed
    }
}

/// Estimate the terminal width of a string (handles CJK).
pub fn string_width(s: &str) -> usize {
    unicode_width::UnicodeWidthStr::width(s)
}

/// Truncate a string to fit within a given width.
pub fn truncate_to_width(s: &str, max_width: usize) -> String {
    if string_width(s) <= max_width {
        s.to_string()
    } else {
        let mut out = String::with_capacity(max_width);
        for c in s.chars() {
            let w = unicode_width::UnicodeWidthChar::width(c).unwrap_or(0);
            if string_width(&out) + w > max_width.saturating_sub(1) {
                out.push('…');
                break;
            }
            out.push(c);
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use syntect::highlighting::ThemeSet;

    #[test]
    fn test_find_syntax() {
        assert!(find_syntax("rust").is_some());
        assert!(find_syntax("python").is_some());
        assert!(find_syntax("js").is_some());
        assert!(find_syntax("nonexistent_lang_xyz").is_none());
    }

    #[test]
    fn test_detect_language() {
        assert_eq!(detect_language("rust"), "rust");
        assert_eq!(detect_language("python,title=foo"), "python");
        assert_eq!(detect_language("js"), "js");
        assert_eq!(detect_language(""), "");
        assert_eq!(detect_language("  go  "), "go");
    }

    #[test]
    fn test_highlight_code_block() {
        let ts = ThemeSet::load_defaults();
        let theme = &ts.themes["base16-ocean.dark"];
        let highlighted = highlight_code_block("fn main() {}", "rust", theme);
        assert!(!highlighted.is_empty());
        assert!(!highlighted[0].is_empty());
        let combined: String = highlighted
            .iter()
            .flat_map(|line| line.iter().map(|seg| seg.text.clone()))
            .collect();
        assert_eq!(combined, "fn main() {}");
    }

    #[test]
    fn test_string_width() {
        assert_eq!(string_width("hello"), 5);
        assert_eq!(string_width("你好"), 4);
    }

    #[test]
    fn test_truncate_to_width() {
        assert_eq!(&truncate_to_width("hello world", 5), "hello…");
        assert_eq!(&truncate_to_width("hello", 10), "hello");
    }
}
