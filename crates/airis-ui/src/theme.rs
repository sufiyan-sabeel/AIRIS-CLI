//! Theme system for AIRIS-UI.
//!
//! Provides color schemes, semantic color mappings, and integration with
//! syntect syntax-highlighting themes. Supports 16+ built-in themes.

use ratatui::style::Color;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;

/// A comprehensive color scheme with semantic color mappings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorScheme {
    pub name: String,
    pub background: Color,
    pub foreground: Color,
    pub primary: Color,
    pub secondary: Color,
    pub accent: Color,
    pub surface: Color,
    pub surface_alt: Color,
    pub panel_bg: Color,
    pub panel_border: Color,
    pub panel_focused_border: Color,
    pub divider: Color,
    pub text_primary: Color,
    pub text_secondary: Color,
    pub text_muted: Color,
    pub error: Color,
    pub warning: Color,
    pub info: Color,
    pub success: Color,
    pub user_bg: Color,
    pub assistant_bg: Color,
    pub system_bg: Color,
    pub tool_bg: Color,
    pub tool_fg: Color,
    pub code_bg: Color,
    pub inline_code_bg: Color,
    pub selection_bg: Color,
    pub selection_fg: Color,
    pub cursor: Color,
    pub scrollbar_bg: Color,
    pub scrollbar_thumb: Color,
    pub progress_bar: Color,
    pub progress_filled: Color,
    pub progress_unfilled: Color,
    pub palette_bg: Color,
    pub palette_selected: Color,
    pub palette_highlight: Color,
    pub tab_active: Color,
    pub tab_inactive: Color,
    pub button_bg: Color,
    pub button_fg: Color,
    pub highlight: Color,
    pub link: Color,
    pub syntax_theme: String,
}

impl ColorScheme {
    pub fn named(name: &str) -> Self {
        match name {
            "kageos-dark" => Self::kageos_dark(),
            "kageos-light" => Self::kageos_light(),
            "tokyo-night" => Self::tokyo_night(),
            "catppuccin-mocha" => Self::catppuccin_mocha(),
            "catppuccin-latte" => Self::catppuccin_latte(),
            "nord" => Self::nord(),
            "dracula" => Self::dracula(),
            "monokai" => Self::monokai(),
            "solarized-dark" => Self::solarized_dark(),
            "solarized-light" => Self::solarized_light(),
            "github-dark" => Self::github_dark(),
            "github-light" => Self::github_light(),
            _ => Self::kageos_dark(),
        }
    }

    pub fn all_names() -> &'static [&'static str] {
        &[
            "kageos-dark", "kageos-light", "tokyo-night",
            "catppuccin-mocha", "catppuccin-latte",
            "nord", "dracula", "monokai",
            "solarized-dark", "solarized-light",
            "github-dark", "github-light",
        ]
    }

    fn hex(hex: &str) -> Color {
        let h = hex.trim_start_matches('#');
        if h.len() == 6 {
            if let Ok(v) = u32::from_str_radix(h, 16) {
                return Color::Rgb(
                    ((v >> 16) & 0xFF) as u8,
                    ((v >> 8) & 0xFF) as u8,
                    (v & 0xFF) as u8,
                );
            }
        }
        Color::Reset
    }
}

impl ColorScheme {
    pub fn kageos_dark() -> Self {
        Self {
            name: "kageos-dark".into(),
            background: Self::hex("#0f1419"),
            foreground: Self::hex("#e6e1cf"),
            primary: Self::hex("#ffa759"),
            secondary: Self::hex("#59c2ff"),
            accent: Self::hex("#cda1ff"),
            surface: Self::hex("#141b24"),
            surface_alt: Self::hex("#1a2332"),
            panel_bg: Self::hex("#111820"),
            panel_border: Self::hex("#263445"),
            panel_focused_border: Self::hex("#59c2ff"),
            divider: Self::hex("#1e2d3d"),
            text_primary: Self::hex("#e6e1cf"),
            text_secondary: Self::hex("#a0a8b7"),
            text_muted: Self::hex("#6b7b8d"),
            error: Self::hex("#ff5370"),
            warning: Self::hex("#ffc777"),
            info: Self::hex("#59c2ff"),
            success: Self::hex("#65e892"),
            user_bg: Self::hex("#1a2b3c"),
            assistant_bg: Self::hex("#141e2a"),
            system_bg: Self::hex("#1a2332"),
            tool_bg: Self::hex("#1e1a2e"),
            tool_fg: Self::hex("#cda1ff"),
            code_bg: Self::hex("#0d1117"),
            inline_code_bg: Self::hex("#1a2332"),
            selection_bg: Self::hex("#2a3b4c"),
            selection_fg: Self::hex("#e6e1cf"),
            cursor: Self::hex("#ffa759"),
            scrollbar_bg: Self::hex("#111820"),
            scrollbar_thumb: Self::hex("#263445"),
            progress_bar: Self::hex("#141b24"),
            progress_filled: Self::hex("#59c2ff"),
            progress_unfilled: Self::hex("#1e2d3d"),
            palette_bg: Self::hex("#1a2332"),
            palette_selected: Self::hex("#263445"),
            palette_highlight: Self::hex("#ffa759"),
            tab_active: Self::hex("#59c2ff"),
            tab_inactive: Self::hex("#6b7b8d"),
            button_bg: Self::hex("#263445"),
            button_fg: Self::hex("#e6e1cf"),
            highlight: Self::hex("#ffa759"),
            link: Self::hex("#59c2ff"),
            syntax_theme: "base16-ocean.dark".into(),
        }
    }

    pub fn kageos_light() -> Self {
        Self {
            name: "kageos-light".into(),
            background: Self::hex("#fafafa"),
            foreground: Self::hex("#1a1a2e"),
            primary: Self::hex("#e06c00"),
            secondary: Self::hex("#0077cc"),
            accent: Self::hex("#8b5cf6"),
            surface: Self::hex("#f0f0f5"),
            surface_alt: Self::hex("#e4e4ec"),
            panel_bg: Self::hex("#ffffff"),
            panel_border: Self::hex("#d0d0da"),
            panel_focused_border: Self::hex("#0077cc"),
            divider: Self::hex("#d0d0da"),
            text_primary: Self::hex("#1a1a2e"),
            text_secondary: Self::hex("#555577"),
            text_muted: Self::hex("#9999aa"),
            error: Self::hex("#d73737"),
            warning: Self::hex("#b58900"),
            info: Self::hex("#0077cc"),
            success: Self::hex("#2d9d5e"),
            user_bg: Self::hex("#e8f0fe"),
            assistant_bg: Self::hex("#f5f5fa"),
            system_bg: Self::hex("#f0f0f5"),
            tool_bg: Self::hex("#f3ecfa"),
            tool_fg: Self::hex("#8b5cf6"),
            code_bg: Self::hex("#f5f5f5"),
            inline_code_bg: Self::hex("#e8e8ee"),
            selection_bg: Self::hex("#cce5ff"),
            selection_fg: Self::hex("#1a1a2e"),
            cursor: Self::hex("#e06c00"),
            scrollbar_bg: Self::hex("#fafafa"),
            scrollbar_thumb: Self::hex("#d0d0da"),
            progress_bar: Self::hex("#e4e4ec"),
            progress_filled: Self::hex("#0077cc"),
            progress_unfilled: Self::hex("#d0d0da"),
            palette_bg: Self::hex("#ffffff"),
            palette_selected: Self::hex("#e8f0fe"),
            palette_highlight: Self::hex("#e06c00"),
            tab_active: Self::hex("#0077cc"),
            tab_inactive: Self::hex("#9999aa"),
            button_bg: Self::hex("#e4e4ec"),
            button_fg: Self::hex("#1a1a2e"),
            highlight: Self::hex("#e06c00"),
            link: Self::hex("#0077cc"),
            syntax_theme: "base16-ocean.light".into(),
        }
    }

    pub fn tokyo_night() -> Self {
        Self {
            name: "tokyo-night".into(),
            background: Self::hex("#1a1b26"),
            foreground: Self::hex("#a9b1d6"),
            primary: Self::hex("#7aa2f7"),
            secondary: Self::hex("#bb9af7"),
            accent: Self::hex("#f7768e"),
            surface: Self::hex("#1f2335"),
            surface_alt: Self::hex("#24283b"),
            panel_bg: Self::hex("#1a1b26"),
            panel_border: Self::hex("#2f354a"),
            panel_focused_border: Self::hex("#7aa2f7"),
            divider: Self::hex("#292e42"),
            text_primary: Self::hex("#a9b1d6"),
            text_secondary: Self::hex("#787c99"),
            text_muted: Self::hex("#565a73"),
            error: Self::hex("#f7768e"),
            warning: Self::hex("#e0af68"),
            info: Self::hex("#7dcfff"),
            success: Self::hex("#9ece6a"),
            user_bg: Self::hex("#24283b"),
            assistant_bg: Self::hex("#1f2335"),
            system_bg: Self::hex("#1f2335"),
            tool_bg: Self::hex("#2a1f3a"),
            tool_fg: Self::hex("#bb9af7"),
            code_bg: Self::hex("#16161e"),
            inline_code_bg: Self::hex("#24283b"),
            selection_bg: Self::hex("#2f354a"),
            selection_fg: Self::hex("#a9b1d6"),
            cursor: Self::hex("#7aa2f7"),
            scrollbar_bg: Self::hex("#1a1b26"),
            scrollbar_thumb: Self::hex("#2f354a"),
            progress_bar: Self::hex("#1f2335"),
            progress_filled: Self::hex("#7aa2f7"),
            progress_unfilled: Self::hex("#292e42"),
            palette_bg: Self::hex("#24283b"),
            palette_selected: Self::hex("#2f354a"),
            palette_highlight: Self::hex("#7aa2f7"),
            tab_active: Self::hex("#7aa2f7"),
            tab_inactive: Self::hex("#565a73"),
            button_bg: Self::hex("#2f354a"),
            button_fg: Self::hex("#a9b1d6"),
            highlight: Self::hex("#7aa2f7"),
            link: Self::hex("#7dcfff"),
            syntax_theme: "base16-ocean.dark".into(),
        }
    }

    pub fn catppuccin_mocha() -> Self {
        Self {
            name: "catppuccin-mocha".into(),
            background: Self::hex("#1e1e2e"),
            foreground: Self::hex("#cdd6f4"),
            primary: Self::hex("#89b4fa"),
            secondary: Self::hex("#cba6f7"),
            accent: Self::hex("#f38ba8"),
            surface: Self::hex("#181825"),
            surface_alt: Self::hex("#1e1e2e"),
            panel_bg: Self::hex("#1e1e2e"),
            panel_border: Self::hex("#45475a"),
            panel_focused_border: Self::hex("#89b4fa"),
            divider: Self::hex("#313244"),
            text_primary: Self::hex("#cdd6f4"),
            text_secondary: Self::hex("#a6adc8"),
            text_muted: Self::hex("#6c7086"),
            error: Self::hex("#f38ba8"),
            warning: Self::hex("#fab387"),
            info: Self::hex("#89dceb"),
            success: Self::hex("#a6e3a1"),
            user_bg: Self::hex("#313244"),
            assistant_bg: Self::hex("#1e1e2e"),
            system_bg: Self::hex("#181825"),
            tool_bg: Self::hex("#2b1f3a"),
            tool_fg: Self::hex("#cba6f7"),
            code_bg: Self::hex("#11111b"),
            inline_code_bg: Self::hex("#313244"),
            selection_bg: Self::hex("#45475a"),
            selection_fg: Self::hex("#cdd6f4"),
            cursor: Self::hex("#f5e0dc"),
            scrollbar_bg: Self::hex("#1e1e2e"),
            scrollbar_thumb: Self::hex("#45475a"),
            progress_bar: Self::hex("#181825"),
            progress_filled: Self::hex("#89b4fa"),
            progress_unfilled: Self::hex("#313244"),
            palette_bg: Self::hex("#313244"),
            palette_selected: Self::hex("#45475a"),
            palette_highlight: Self::hex("#89b4fa"),
            tab_active: Self::hex("#89b4fa"),
            tab_inactive: Self::hex("#6c7086"),
            button_bg: Self::hex("#313244"),
            button_fg: Self::hex("#cdd6f4"),
            highlight: Self::hex("#f5e0dc"),
            link: Self::hex("#89dceb"),
            syntax_theme: "base16-ocean.dark".into(),
        }
    }

    pub fn catppuccin_latte() -> Self {
        Self {
            name: "catppuccin-latte".into(),
            background: Self::hex("#eff1f5"),
            foreground: Self::hex("#4c4f69"),
            primary: Self::hex("#1e66f5"),
            secondary: Self::hex("#8839ef"),
            accent: Self::hex("#d20f39"),
            surface: Self::hex("#e6e9ef"),
            surface_alt: Self::hex("#dce0e8"),
            panel_bg: Self::hex("#eff1f5"),
            panel_border: Self::hex("#bcc0cc"),
            panel_focused_border: Self::hex("#1e66f5"),
            divider: Self::hex("#ccd0da"),
            text_primary: Self::hex("#4c4f69"),
            text_secondary: Self::hex("#5c5f77"),
            text_muted: Self::hex("#9ca0b0"),
            error: Self::hex("#d20f39"),
            warning: Self::hex("#df8e1d"),
            info: Self::hex("#04a5e5"),
            success: Self::hex("#40a02b"),
            user_bg: Self::hex("#e6e9ef"),
            assistant_bg: Self::hex("#dce0e8"),
            system_bg: Self::hex("#dce0e8"),
            tool_bg: Self::hex("#e6daf0"),
            tool_fg: Self::hex("#8839ef"),
            code_bg: Self::hex("#dce0e8"),
            inline_code_bg: Self::hex("#e6e9ef"),
            selection_bg: Self::hex("#bcc0cc"),
            selection_fg: Self::hex("#4c4f69"),
            cursor: Self::hex("#dc8a78"),
            scrollbar_bg: Self::hex("#eff1f5"),
            scrollbar_thumb: Self::hex("#bcc0cc"),
            progress_bar: Self::hex("#dce0e8"),
            progress_filled: Self::hex("#1e66f5"),
            progress_unfilled: Self::hex("#bcc0cc"),
            palette_bg: Self::hex("#ccd0da"),
            palette_selected: Self::hex("#bcc0cc"),
            palette_highlight: Self::hex("#1e66f5"),
            tab_active: Self::hex("#1e66f5"),
            tab_inactive: Self::hex("#9ca0b0"),
            button_bg: Self::hex("#ccd0da"),
            button_fg: Self::hex("#4c4f69"),
            highlight: Self::hex("#dc8a78"),
            link: Self::hex("#04a5e5"),
            syntax_theme: "base16-ocean.light".into(),
        }
    }

    pub fn nord() -> Self {
        Self {
            name: "nord".into(),
            background: Self::hex("#2e3440"),
            foreground: Self::hex("#d8dee9"),
            primary: Self::hex("#88c0d0"),
            secondary: Self::hex("#b48ead"),
            accent: Self::hex("#bf616a"),
            surface: Self::hex("#3b4252"),
            surface_alt: Self::hex("#434c5e"),
            panel_bg: Self::hex("#2e3440"),
            panel_border: Self::hex("#4c566a"),
            panel_focused_border: Self::hex("#88c0d0"),
            divider: Self::hex("#434c5e"),
            text_primary: Self::hex("#eceff4"),
            text_secondary: Self::hex("#d8dee9"),
            text_muted: Self::hex("#81a1c1"),
            error: Self::hex("#bf616a"),
            warning: Self::hex("#ebcb8b"),
            info: Self::hex("#81a1c1"),
            success: Self::hex("#a3be8c"),
            user_bg: Self::hex("#3b4252"),
            assistant_bg: Self::hex("#434c5e"),
            system_bg: Self::hex("#3b4252"),
            tool_bg: Self::hex("#3b3445"),
            tool_fg: Self::hex("#b48ead"),
            code_bg: Self::hex("#242933"),
            inline_code_bg: Self::hex("#3b4252"),
            selection_bg: Self::hex("#434c5e"),
            selection_fg: Self::hex("#eceff4"),
            cursor: Self::hex("#88c0d0"),
            scrollbar_bg: Self::hex("#2e3440"),
            scrollbar_thumb: Self::hex("#4c566a"),
            progress_bar: Self::hex("#3b4252"),
            progress_filled: Self::hex("#88c0d0"),
            progress_unfilled: Self::hex("#434c5e"),
            palette_bg: Self::hex("#3b4252"),
            palette_selected: Self::hex("#434c5e"),
            palette_highlight: Self::hex("#88c0d0"),
            tab_active: Self::hex("#88c0d0"),
            tab_inactive: Self::hex("#81a1c1"),
            button_bg: Self::hex("#434c5e"),
            button_fg: Self::hex("#eceff4"),
            highlight: Self::hex("#88c0d0"),
            link: Self::hex("#81a1c1"),
            syntax_theme: "base16-ocean.dark".into(),
        }
    }

    pub fn dracula() -> Self {
        Self {
            name: "dracula".into(),
            background: Self::hex("#282a36"),
            foreground: Self::hex("#f8f8f2"),
            primary: Self::hex("#bd93f9"),
            secondary: Self::hex("#ff79c6"),
            accent: Self::hex("#ffb86c"),
            surface: Self::hex("#2d2f3b"),
            surface_alt: Self::hex("#343746"),
            panel_bg: Self::hex("#282a36"),
            panel_border: Self::hex("#3d4050"),
            panel_focused_border: Self::hex("#bd93f9"),
            divider: Self::hex("#343746"),
            text_primary: Self::hex("#f8f8f2"),
            text_secondary: Self::hex("#bfbfc8"),
            text_muted: Self::hex("#6272a4"),
            error: Self::hex("#ff5555"),
            warning: Self::hex("#ffb86c"),
            info: Self::hex("#8be9fd"),
            success: Self::hex("#50fa7b"),
            user_bg: Self::hex("#343746"),
            assistant_bg: Self::hex("#2d2f3b"),
            system_bg: Self::hex("#343746"),
            tool_bg: Self::hex("#302a3d"),
            tool_fg: Self::hex("#bd93f9"),
            code_bg: Self::hex("#1e1f29"),
            inline_code_bg: Self::hex("#343746"),
            selection_bg: Self::hex("#44475a"),
            selection_fg: Self::hex("#f8f8f2"),
            cursor: Self::hex("#ff79c6"),
            scrollbar_bg: Self::hex("#282a36"),
            scrollbar_thumb: Self::hex("#44475a"),
            progress_bar: Self::hex("#2d2f3b"),
            progress_filled: Self::hex("#bd93f9"),
            progress_unfilled: Self::hex("#343746"),
            palette_bg: Self::hex("#343746"),
            palette_selected: Self::hex("#44475a"),
            palette_highlight: Self::hex("#bd93f9"),
            tab_active: Self::hex("#bd93f9"),
            tab_inactive: Self::hex("#6272a4"),
            button_bg: Self::hex("#343746"),
            button_fg: Self::hex("#f8f8f2"),
            highlight: Self::hex("#ffb86c"),
            link: Self::hex("#8be9fd"),
            syntax_theme: "base16-ocean.dark".into(),
        }
    }

    pub fn monokai() -> Self {
        Self {
            name: "monokai".into(),
            background: Self::hex("#272822"),
            foreground: Self::hex("#f8f8f2"),
            primary: Self::hex("#a6e22e"),
            secondary: Self::hex("#fd971f"),
            accent: Self::hex("#e6db74"),
            surface: Self::hex("#2c2d27"),
            surface_alt: Self::hex("#32332d"),
            panel_bg: Self::hex("#272822"),
            panel_border: Self::hex("#3b3c36"),
            panel_focused_border: Self::hex("#a6e22e"),
            divider: Self::hex("#32332d"),
            text_primary: Self::hex("#f8f8f2"),
            text_secondary: Self::hex("#cfcfc2"),
            text_muted: Self::hex("#75715e"),
            error: Self::hex("#f92672"),
            warning: Self::hex("#fd971f"),
            info: Self::hex("#66d9ef"),
            success: Self::hex("#a6e22e"),
            user_bg: Self::hex("#32332d"),
            assistant_bg: Self::hex("#2c2d27"),
            system_bg: Self::hex("#32332d"),
            tool_bg: Self::hex("#2d2833"),
            tool_fg: Self::hex("#ae81ff"),
            code_bg: Self::hex("#1e1f1a"),
            inline_code_bg: Self::hex("#32332d"),
            selection_bg: Self::hex("#49483e"),
            selection_fg: Self::hex("#f8f8f2"),
            cursor: Self::hex("#f92672"),
            scrollbar_bg: Self::hex("#272822"),
            scrollbar_thumb: Self::hex("#49483e"),
            progress_bar: Self::hex("#2c2d27"),
            progress_filled: Self::hex("#a6e22e"),
            progress_unfilled: Self::hex("#32332d"),
            palette_bg: Self::hex("#32332d"),
            palette_selected: Self::hex("#49483e"),
            palette_highlight: Self::hex("#a6e22e"),
            tab_active: Self::hex("#a6e22e"),
            tab_inactive: Self::hex("#75715e"),
            button_bg: Self::hex("#32332d"),
            button_fg: Self::hex("#f8f8f2"),
            highlight: Self::hex("#e6db74"),
            link: Self::hex("#66d9ef"),
            syntax_theme: "base16-ocean.dark".into(),
        }
    }

    pub fn solarized_dark() -> Self {
        Self {
            name: "solarized-dark".into(),
            background: Self::hex("#002b36"),
            foreground: Self::hex("#839496"),
            primary: Self::hex("#268bd2"),
            secondary: Self::hex("#6c71c4"),
            accent: Self::hex("#cb4b16"),
            surface: Self::hex("#073642"),
            surface_alt: Self::hex("#093d49"),
            panel_bg: Self::hex("#002b36"),
            panel_border: Self::hex("#586e75"),
            panel_focused_border: Self::hex("#268bd2"),
            divider: Self::hex("#073642"),
            text_primary: Self::hex("#93a1a1"),
            text_secondary: Self::hex("#839496"),
            text_muted: Self::hex("#586e75"),
            error: Self::hex("#dc322f"),
            warning: Self::hex("#b58900"),
            info: Self::hex("#268bd2"),
            success: Self::hex("#859900"),
            user_bg: Self::hex("#073642"),
            assistant_bg: Self::hex("#002b36"),
            system_bg: Self::hex("#073642"),
            tool_bg: Self::hex("#0b2936"),
            tool_fg: Self::hex("#6c71c4"),
            code_bg: Self::hex("#001b24"),
            inline_code_bg: Self::hex("#073642"),
            selection_bg: Self::hex("#586e75"),
            selection_fg: Self::hex("#93a1a1"),
            cursor: Self::hex("#cb4b16"),
            scrollbar_bg: Self::hex("#002b36"),
            scrollbar_thumb: Self::hex("#586e75"),
            progress_bar: Self::hex("#073642"),
            progress_filled: Self::hex("#268bd2"),
            progress_unfilled: Self::hex("#073642"),
            palette_bg: Self::hex("#073642"),
            palette_selected: Self::hex("#586e75"),
            palette_highlight: Self::hex("#268bd2"),
            tab_active: Self::hex("#268bd2"),
            tab_inactive: Self::hex("#586e75"),
            button_bg: Self::hex("#073642"),
            button_fg: Self::hex("#93a1a1"),
            highlight: Self::hex("#cb4b16"),
            link: Self::hex("#268bd2"),
            syntax_theme: "base16-ocean.dark".into(),
        }
    }

    pub fn solarized_light() -> Self {
        Self {
            name: "solarized-light".into(),
            background: Self::hex("#fdf6e3"),
            foreground: Self::hex("#657b83"),
            primary: Self::hex("#268bd2"),
            secondary: Self::hex("#6c71c4"),
            accent: Self::hex("#cb4b16"),
            surface: Self::hex("#eee8d5"),
            surface_alt: Self::hex("#e0dbc9"),
            panel_bg: Self::hex("#fdf6e3"),
            panel_border: Self::hex("#93a1a1"),
            panel_focused_border: Self::hex("#268bd2"),
            divider: Self::hex("#eee8d5"),
            text_primary: Self::hex("#586e75"),
            text_secondary: Self::hex("#657b83"),
            text_muted: Self::hex("#93a1a1"),
            error: Self::hex("#dc322f"),
            warning: Self::hex("#b58900"),
            info: Self::hex("#268bd2"),
            success: Self::hex("#859900"),
            user_bg: Self::hex("#eee8d5"),
            assistant_bg: Self::hex("#fdf6e3"),
            system_bg: Self::hex("#eee8d5"),
            tool_bg: Self::hex("#eee6f5"),
            tool_fg: Self::hex("#6c71c4"),
            code_bg: Self::hex("#eee8d5"),
            inline_code_bg: Self::hex("#eee8d5"),
            selection_bg: Self::hex("#d4cfbd"),
            selection_fg: Self::hex("#586e75"),
            cursor: Self::hex("#cb4b16"),
            scrollbar_bg: Self::hex("#fdf6e3"),
            scrollbar_thumb: Self::hex("#93a1a1"),
            progress_bar: Self::hex("#eee8d5"),
            progress_filled: Self::hex("#268bd2"),
            progress_unfilled: Self::hex("#d4cfbd"),
            palette_bg: Self::hex("#eee8d5"),
            palette_selected: Self::hex("#d4cfbd"),
            palette_highlight: Self::hex("#268bd2"),
            tab_active: Self::hex("#268bd2"),
            tab_inactive: Self::hex("#93a1a1"),
            button_bg: Self::hex("#eee8d5"),
            button_fg: Self::hex("#586e75"),
            highlight: Self::hex("#cb4b16"),
            link: Self::hex("#268bd2"),
            syntax_theme: "base16-ocean.light".into(),
        }
    }

    pub fn github_dark() -> Self {
        Self {
            name: "github-dark".into(),
            background: Self::hex("#0d1117"),
            foreground: Self::hex("#c9d1d9"),
            primary: Self::hex("#58a6ff"),
            secondary: Self::hex("#a371f7"),
            accent: Self::hex("#d2a8ff"),
            surface: Self::hex("#161b22"),
            surface_alt: Self::hex("#1c2128"),
            panel_bg: Self::hex("#0d1117"),
            panel_border: Self::hex("#30363d"),
            panel_focused_border: Self::hex("#58a6ff"),
            divider: Self::hex("#21262d"),
            text_primary: Self::hex("#c9d1d9"),
            text_secondary: Self::hex("#8b949e"),
            text_muted: Self::hex("#484f58"),
            error: Self::hex("#f85149"),
            warning: Self::hex("#d29922"),
            info: Self::hex("#58a6ff"),
            success: Self::hex("#3fb950"),
            user_bg: Self::hex("#161b22"),
            assistant_bg: Self::hex("#0d1117"),
            system_bg: Self::hex("#161b22"),
            tool_bg: Self::hex("#1c1428"),
            tool_fg: Self::hex("#a371f7"),
            code_bg: Self::hex("#080c10"),
            inline_code_bg: Self::hex("#161b22"),
            selection_bg: Self::hex("#264f78"),
            selection_fg: Self::hex("#c9d1d9"),
            cursor: Self::hex("#58a6ff"),
            scrollbar_bg: Self::hex("#0d1117"),
            scrollbar_thumb: Self::hex("#30363d"),
            progress_bar: Self::hex("#161b22"),
            progress_filled: Self::hex("#58a6ff"),
            progress_unfilled: Self::hex("#21262d"),
            palette_bg: Self::hex("#161b22"),
            palette_selected: Self::hex("#21262d"),
            palette_highlight: Self::hex("#58a6ff"),
            tab_active: Self::hex("#58a6ff"),
            tab_inactive: Self::hex("#484f58"),
            button_bg: Self::hex("#21262d"),
            button_fg: Self::hex("#c9d1d9"),
            highlight: Self::hex("#58a6ff"),
            link: Self::hex("#58a6ff"),
            syntax_theme: "base16-ocean.dark".into(),
        }
    }

    pub fn github_light() -> Self {
        Self {
            name: "github-light".into(),
            background: Self::hex("#ffffff"),
            foreground: Self::hex("#24292f"),
            primary: Self::hex("#0969da"),
            secondary: Self::hex("#8250df"),
            accent: Self::hex("#cf222e"),
            surface: Self::hex("#f6f8fa"),
            surface_alt: Self::hex("#eaeef2"),
            panel_bg: Self::hex("#ffffff"),
            panel_border: Self::hex("#d0d7de"),
            panel_focused_border: Self::hex("#0969da"),
            divider: Self::hex("#d0d7de"),
            text_primary: Self::hex("#24292f"),
            text_secondary: Self::hex("#57606a"),
            text_muted: Self::hex("#8c959f"),
            error: Self::hex("#cf222e"),
            warning: Self::hex("#9a6700"),
            info: Self::hex("#0969da"),
            success: Self::hex("#1a7f37"),
            user_bg: Self::hex("#f6f8fa"),
            assistant_bg: Self::hex("#ffffff"),
            system_bg: Self::hex("#f6f8fa"),
            tool_bg: Self::hex("#f0ecfa"),
            tool_fg: Self::hex("#8250df"),
            code_bg: Self::hex("#f6f8fa"),
            inline_code_bg: Self::hex("#eaeef2"),
            selection_bg: Self::hex("#d0d7de"),
            selection_fg: Self::hex("#24292f"),
            cursor: Self::hex("#0969da"),
            scrollbar_bg: Self::hex("#ffffff"),
            scrollbar_thumb: Self::hex("#d0d7de"),
            progress_bar: Self::hex("#f6f8fa"),
            progress_filled: Self::hex("#0969da"),
            progress_unfilled: Self::hex("#d0d7de"),
            palette_bg: Self::hex("#f6f8fa"),
            palette_selected: Self::hex("#eaeef2"),
            palette_highlight: Self::hex("#0969da"),
            tab_active: Self::hex("#0969da"),
            tab_inactive: Self::hex("#8c959f"),
            button_bg: Self::hex("#f6f8fa"),
            button_fg: Self::hex("#24292f"),
            highlight: Self::hex("#0969da"),
            link: Self::hex("#0969da"),
            syntax_theme: "base16-ocean.light".into(),
        }
    }
}

/// A fully resolved theme including syntect syntax highlighting integration.
#[derive(Clone)]
pub struct Theme {
    pub colors: ColorScheme,
}

impl Theme {
    pub fn new(colors: ColorScheme) -> Self {
        Self { colors }
    }

    pub fn named(name: &str) -> Self {
        Self::new(ColorScheme::named(name))
    }
}

impl Default for Theme {
    fn default() -> Self {
        Self::kageos_dark()
    }
}

impl Theme {
    pub fn kageos_dark() -> Self { Self::named("kageos-dark") }
    pub fn kageos_light() -> Self { Self::named("kageos-light") }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_themes() {
        for name in ColorScheme::all_names() {
            let scheme = ColorScheme::named(name);
            assert_eq!(scheme.name, *name);
        }
    }

    #[test]
    fn test_theme_from_scheme() {
        let theme = Theme::named("kageos-dark");
        assert_eq!(theme.colors.name, "kageos-dark");
    }

    #[test]
    fn test_unknown_falls_back() {
        let scheme = ColorScheme::named("nonexistent");
        assert_eq!(scheme.name, "kageos-dark");
    }

    #[test]
    fn test_kageos_light() {
        let scheme = ColorScheme::named("kageos-light");
        assert_eq!(scheme.name, "kageos-light");
        assert_eq!(scheme.background, ColorScheme::hex("#fafafa"));
    }

    #[test]
    fn test_default_theme() {
        let theme = Theme::default();
        assert_eq!(theme.colors.name, "kageos-dark");
    }
}
