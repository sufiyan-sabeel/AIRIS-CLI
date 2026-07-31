//! # AIRIS-UI
//!
//! Terminal UI system for AIRIS-CLI using ratatui + crossterm.
//!
//! Provides a full-featured TUI with:
//! - Chat interface with message history
//! - Streaming token display
//! - Multi-line input editor with tui-textarea
//! - Syntax highlighting with syntect
//! - Progress indicators and spinners
//! - Command palette with fuzzy search
//! - Theme system with 16+ color schemes
//! - Nerd Font icon support
//! - Mouse support (scroll, click, drag-resize)
//! - Split panel layout (conversation | tools | files)

pub mod chat;
pub mod command;
pub mod input;
pub mod panel;
pub mod progress;
pub mod streaming;
pub mod syntax;
pub mod theme;
pub mod tui;

// Re-export core types from airis_core
use airis_core::prelude::*;

// Re-export main TUI entry point
pub use tui::TuiApp;
pub use theme::{ColorScheme, Theme};

/// Re-export of common UI traits for convenience.
pub mod prelude {
    pub use super::chat::ChatArea;
    pub use super::command::{Command, CommandPalette};
    pub use super::input::InputArea;
    pub use super::panel::{FileEntry, PanelId, SplitLayout};
    pub use super::progress::{ProgressWidget, ProgressState, MultiProgress, StatusBar, StatusMode};
    pub use super::streaming::StreamingWidget;
    pub use super::syntax::CodeHighlighter;
    pub use super::theme::{ColorScheme, Theme};
    pub use super::tui::{AppMode, TuiApp};
}

/// Version of the UI crate.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prelude_imports() {
        // Verify that all prelude items are accessible
        let _ = prelude::AppMode::Normal;
        let _ = prelude::StatusMode::Normal;
    }

    #[test]
    fn test_theme_named() {
        let theme = Theme::named("kageos-dark");
        assert_eq!(theme.colors.name, "kageos-dark");
    }

    #[test]
    fn test_all_themes() {
        for name in ColorScheme::all_names() {
            let theme = Theme::named(name);
            assert_eq!(theme.colors.name, *name);
        }
    }
}
