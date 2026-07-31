//! Command palette for the TUI.
//!
//! Provides a fuzzy-searchable command palette invoked via keybinding,
//! allowing users to execute actions without leaving the keyboard.

use crate::theme::{ColorScheme, Theme};
use ratatui::layout::{Constraint, Direction, Layout, Margin, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, Borders, Clear, List, ListItem, ListState, Paragraph, Widget, Wrap};
use ratatui::buffer::Buffer;
use tui_textarea::TextArea;
use unicode_width::UnicodeWidthStr;

/// A single command in the palette.
#[derive(Debug, Clone)]
pub struct Command {
    /// Display name.
    pub name: &'static str,
    /// Keyboard shortcut (display only).
    pub shortcut: Option<&'static str>,
    /// Description.
    pub description: &'static str,
    /// Category for grouping.
    pub category: &'static str,
    /// Icon (Nerd Font).
    pub icon: &'static str,
}

impl Command {
    pub const fn new(
        name: &'static str,
        shortcut: Option<&'static str>,
        description: &'static str,
        category: &'static str,
        icon: &'static str,
    ) -> Self {
        Self { name, shortcut, description, category, icon }
    }
}

/// Default commands available in the palette.
pub fn default_commands() -> Vec<Command> {
    vec![
        Command::new("chat.new", Some("Ctrl+N"), "Start a new conversation", "Chat", ""),
        Command::new("chat.switch", Some("Ctrl+O"), "Switch conversation", "Chat", ""),
        Command::new("chat.rename", None, "Rename current conversation", "Chat", ""),
        Command::new("chat.export", None, "Export conversation", "Chat", ""),
        Command::new("chat.clear", None, "Clear conversation", "Chat", ""),
        Command::new("edit.undo", Some("Ctrl+Z"), "Undo last edit", "Edit", ""),
        Command::new("edit.redo", Some("Ctrl+Y"), "Redo last undone edit", "Edit", ""),
        Command::new("file.open", Some("Ctrl+P"), "Open file from workspace", "File", ""),
        Command::new("file.search", Some("Ctrl+Shift+F"), "Search across files", "File", ""),
        Command::new("file.save", Some("Ctrl+S"), "Save current file", "File", ""),
        Command::new("view.toggle_sidebar", Some("Ctrl+B"), "Toggle sidebar", "View", ""),
        Command::new("view.toggle_tools", Some("Ctrl+T"), "Toggle tools panel", "View", ""),
        Command::new("view.toggle_files", None, "Toggle files panel", "View", ""),
        Command::new("view.zoom_in", Some("Ctrl++"), "Increase font size", "View", ""),
        Command::new("view.zoom_out", Some("Ctrl+-"), "Decrease font size", "View", ""),
        Command::new("view.fullscreen", Some("F11"), "Toggle fullscreen", "View", ""),
        Command::new("theme.next", None, "Cycle to next theme", "Theme", ""),
        Command::new("theme.set", None, "Set theme by name", "Theme", ""),
        Command::new("model.select", None, "Switch active model", "Model", ""),
        Command::new("provider.select", None, "Switch provider", "Model", ""),
        Command::new("session.save", None, "Save session", "Session", ""),
        Command::new("session.load", None, "Load session", "Session", ""),
        Command::new("session.list", None, "List all sessions", "Session", ""),
        Command::new("agent.stop", Some("Ctrl+C"), "Stop current agent execution", "Agent", ""),
        Command::new("agent.status", None, "Show agent status", "Agent", ""),
        Command::new("help.keybindings", Some("Ctrl+H"), "Show keybindings", "Help", ""),
        Command::new("help.about", None, "About AIRIS-CLI", "Help", ""),
        Command::new("quit", Some("Ctrl+Q"), "Quit AIRIS", "System", ""),
    ]
}

/// Command palette state.
pub struct CommandPalette {
    /// All available commands.
    commands: Vec<Command>,
    /// Filtered command list based on search.
    filtered: Vec<usize>,
    /// Search input.
    input: TextArea<'static>,
    /// Selected index in filtered list.
    selected: usize,
    /// Whether the palette is visible.
    visible: bool,
    /// Theme.
    theme: Theme,
    /// Callback to execute when a command is chosen.
    on_execute: Option<Box<dyn FnMut(&str)>>,
}

impl CommandPalette {
    /// Create a new command palette.
    pub fn new(theme: Theme) -> Self {
        let commands = default_commands();
        let mut input = TextArea::default();
        input.set_placeholder_text("Search commands...");
        input.set_cursor_line_style(Style::default());

        Self {
            filtered: (0..commands.len()).collect(),
            selected: 0,
            input,
            visible: false,
            commands,
            theme,
            on_execute: None,
        }
    }

    /// Set a callback for command execution.
    pub fn set_on_execute<F>(&mut self, f: F)
    where
        F: FnMut(&str) + 'static,
    {
        self.on_execute = Some(Box::new(f));
    }

    /// Show the command palette.
    pub fn show(&mut self) {
        self.visible = true;
        self.input = TextArea::default();
        self.input.set_placeholder_text("Search commands...");
        self.input.set_cursor_line_style(Style::default());
        self.filter("");
        self.selected = 0;
    }

    /// Hide the command palette.
    pub fn hide(&mut self) {
        self.visible = false;
    }

    /// Toggle the command palette.
    pub fn toggle(&mut self) {
        if self.visible {
            self.hide();
        } else {
            self.show();
        }
    }

    /// Whether the palette is visible.
    pub fn is_visible(&self) -> bool {
        self.visible
    }

    /// Process a key event. Returns true if the palette handled it.
    pub fn handle_key(&mut self, key: &crossterm::event::KeyEvent) -> bool {
        use crossterm::event::KeyCode;
        use crossterm::event::KeyModifiers;

        if !self.visible {
            return false;
        }

        match (key.code, key.modifiers) {
            (KeyCode::Esc, _) => {
                self.hide();
                return true;
            }
            (KeyCode::Enter, KeyModifiers::NONE) => {
                if let Some(idx) = self.filtered.get(self.selected) {
                    let cmd = &self.commands[*idx];
                    if let Some(ref mut cb) = self.on_execute {
                        cb(cmd.name);
                    }
                }
                self.hide();
                return true;
            }
            (KeyCode::Up, KeyModifiers::NONE) | (KeyCode::Char('k'), KeyModifiers::CONTROL) => {
                self.selected = self.selected.saturating_sub(1);
                return true;
            }
            (KeyCode::Down, KeyModifiers::NONE) | (KeyCode::Char('j'), KeyModifiers::CONTROL) => {
                let max = self.filtered.len().saturating_sub(1);
                self.selected = (self.selected + 1).min(max);
                return true;
            }
            (KeyCode::PageUp, _) => {
                self.selected = self.selected.saturating_sub(10);
                return true;
            }
            (KeyCode::PageDown, _) => {
                let max = self.filtered.len().saturating_sub(1);
                self.selected = (self.selected + 10).min(max);
                return true;
            }
            (KeyCode::Home, _) => {
                self.selected = 0;
                return true;
            }
            (KeyCode::End, _) => {
                self.selected = self.filtered.len().saturating_sub(1);
                return true;
            }
            (KeyCode::Backspace, _) => {
                self.input.input(tui_textarea::Input {
                    key: tui_textarea::Key::Backspace,
                    ctrl: false,
                    alt: false,
                    shift: false,
                });
                self.filter(self.input.lines().first().unwrap_or(&String::new()));
                return true;
            }
            (KeyCode::Char(c), KeyModifiers::NONE | KeyModifiers::SHIFT) => {
                self.input.input(tui_textarea::Input {
                    key: tui_textarea::Key::Char(c),
                    ctrl: false,
                    alt: false,
                    shift: key.modifiers.contains(KeyModifiers::SHIFT),
                });
                self.filter(self.input.lines().first().unwrap_or(&String::new()));
                return true;
            }
            (KeyCode::Tab, _) => {
                self.selected = (self.selected + 1) % self.filtered.len().max(1);
                return true;
            }
            _ => {}
        }

        true
    }

    /// Filter commands based on search query using simple substring + prefix matching.
    fn filter(&mut self, query: &str) {
        let query_lower = query.to_lowercase();

        if query.is_empty() {
            self.filtered = (0..self.commands.len()).collect();
            return;
        }

        // Score-based ranking
        struct Scored {
            idx: usize,
            score: i64,
        }

        let mut scored: Vec<Scored> = self
            .commands
            .iter()
            .enumerate()
            .filter_map(|(idx, cmd)| {
                let name_lower = cmd.name.to_lowercase();
                let cat_lower = cmd.category.to_lowercase();
                let desc_lower = cmd.description.to_lowercase();

                let mut score: i64 = 0;

                // Prefix match (highest score)
                if name_lower.starts_with(&query_lower) {
                    score += 1000;
                } else if cmd.name == query_lower {
                    score += 2000;
                } else if name_lower.contains(&query_lower) {
                    score += 500;
                } else if cat_lower.contains(&query_lower) {
                    score += 200;
                } else if desc_lower.contains(&query_lower) {
                    score += 100;
                } else {
                    // Fuzzy character match
                    let mut qi = 0;
                    for c in name_lower.chars() {
                        if qi < query_lower.len() && c == query_lower.as_bytes()[qi] as char {
                            qi += 1;
                        }
                    }
                    if qi == query_lower.len() {
                        score += 300;
                    } else {
                        return None; // No match at all
                    }
                }

                // Bonus for shorter names (more relevant matches)
                score -= cmd.name.len() as i64;

                Some(Scored { idx, score })
            })
            .collect();

        scored.sort_by(|a, b| b.score.cmp(&a.score));

        self.filtered = scored.into_iter().map(|s| s.idx).collect();
        self.selected = 0;
    }

    /// Get the current filter text.
    pub fn filter_text(&self) -> String {
        self.input.lines().first().cloned().unwrap_or_default()
    }

    /// Get the selected command name.
    pub fn selected_command(&self) -> Option<&Command> {
        self.filtered.get(self.selected).map(|&i| &self.commands[i])
    }
}

impl Widget for &CommandPalette {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if !self.visible {
            return;
        }

        let colors = &self.theme.colors;

        // Overlay background
        let overlay_area = area.inner(&Margin {
            vertical: area.height / 4,
            horizontal: area.width / 6,
        });

        // Clear area
        Clear.render(overlay_area, buf);

        // Border block
        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(colors.palette_highlight))
            .title(" Command Palette ")
            .title_style(Style::default().fg(colors.palette_highlight).add_modifier(Modifier::BOLD));

        let inner = block.inner(overlay_area);
        block.render(overlay_area, buf);

        if inner.height < 3 {
            return;
        }

        // ── Search input ──
        let input_area = Rect::new(inner.x, inner.y, inner.width, 1);
        let search_icon = Span::styled(
            "  ",
            Style::default().fg(colors.palette_highlight),
        );
        let input_text = if self.input.lines().first().map_or(true, |s| s.is_empty()) {
            Span::styled(
                self.input.placeholder_text().unwrap_or(""),
                Style::default().fg(colors.text_muted),
            )
        } else {
            Span::styled(
                self.input.lines().first().cloned().unwrap_or_default(),
                Style::default().fg(colors.palette_fg),
            )
        };
        let input_line = Line::from(vec![search_icon, input_text]);
        Paragraph::new(input_line).render(input_area, buf);

        // ── Divider ──
        if inner.height > 2 {
            let div_area = Rect::new(inner.x, inner.y + 1, inner.width, 1);
            let div = Span::styled(
                "─".repeat(inner.width as usize),
                Style::default().fg(colors.divider),
            );
            Paragraph::new(Line::from(div)).render(div_area, buf);
        }

        // ── Results list ──
        let list_area = Rect::new(
            inner.x,
            inner.y + 2,
            inner.width,
            inner.height.saturating_sub(2),
        );

        let max_items = list_area.height as usize;
        let start = self.selected.saturating_sub(max_items / 2);
        let visible_items: Vec<&Command> = self.filtered
            .iter()
            .skip(start)
            .take(max_items)
            .filter_map(|&i| self.commands.get(i))
            .collect();

        let list_items: Vec<ListItem> = visible_items
            .iter()
            .enumerate()
            .map(|(i, cmd)| {
                let is_selected = (start + i) == self.selected;
                let bg = if is_selected { colors.palette_selected } else { Color::Reset };
                let fg = if is_selected {
                    colors.palette_fg
                } else {
                    colors.text_secondary
                };

                // Icon + Name
                let icon_span = Span::styled(
                    format!(" {} ", cmd.icon),
                    Style::default().fg(if is_selected { colors.palette_highlight } else { fg }),
                );
                let name_span = Span::styled(
                    format!(" {}", cmd.name),
                    Style::default().fg(fg).add_modifier(Modifier::BOLD),
                );

                // Category badge
                let cat_span = Span::styled(
                    format!(" [{}]", cmd.category),
                    Style::default().fg(colors.text_muted),
                );

                // Description
                let desc_span = Span::styled(
                    format!("  {}", cmd.description),
                    Style::default().fg(colors.text_muted),
                );

                // Shortcut
                let shortcut_span = if let Some(shortcut) = cmd.shortcut {
                    let pad = list_area.width as usize
                        - UnicodeWidthStr::width(cmd.name)
                        - UnicodeWidthStr::width(cmd.description)
                        - UnicodeWidthStr::width(cmd.category)
                        - 12;
                    let pad_str = " ".repeat(pad.saturating_sub(shortcut.len()));
                    Span::styled(
                        format!("{}{}", pad_str, shortcut),
                        Style::default().fg(colors.palette_highlight),
                    )
                } else {
                    Span::raw("")
                };

                let line = Line::from(vec![icon_span, name_span, cat_span, desc_span, shortcut_span]);

                ListItem::new(line).style(Style::default().bg(bg))
            })
            .collect();

        if list_items.is_empty() {
            let no_results = Line::from(Span::styled(
                "  No matching commands",
                Style::default().fg(colors.text_muted),
            ));
            Paragraph::new(no_results).render(list_area, buf);
        } else {
            let list = List::new(list_items).highlight_style(
                Style::default()
                    .bg(colors.palette_selected)
                    .add_modifier(Modifier::BOLD),
            );
            list.render(list_area, buf);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_theme() -> Theme {
        Theme::named("kageos-dark")
    }

    #[test]
    fn test_command_palette_create() {
        let theme = test_theme();
        let cp = CommandPalette::new(theme);
        assert!(!cp.is_visible());
        assert!(cp.commands.len() > 10);
    }

    #[test]
    fn test_show_hide() {
        let theme = test_theme();
        let mut cp = CommandPalette::new(theme);
        cp.show();
        assert!(cp.is_visible());
        cp.hide();
        assert!(!cp.is_visible());
    }

    #[test]
    fn test_filter_empty() {
        let theme = test_theme();
        let cp = CommandPalette::new(theme);
        assert_eq!(cp.filtered.len(), cp.commands.len());
    }

    #[test]
    fn test_filter_by_name() {
        let theme = test_theme();
        let mut cp = CommandPalette::new(theme);
        cp.filter("chat");
        assert!(!cp.filtered.is_empty());
        assert!(cp.filtered.iter().any(|&i| cp.commands[i].name.contains("chat")));
    }

    #[test]
    fn test_filter_no_match() {
        let theme = test_theme();
        let mut cp = CommandPalette::new(theme);
        cp.filter("zzz_nonexistent_xyz");
        assert!(cp.filtered.is_empty());
    }

    #[test]
    fn test_selected_command() {
        let theme = test_theme();
        let mut cp = CommandPalette::new(theme);
        cp.filter("quit");
        let cmd = cp.selected_command();
        assert!(cmd.is_some());
        assert_eq!(cmd.unwrap().name, "quit");
    }

    #[test]
    fn test_default_commands() {
        let cmds = default_commands();
        assert!(!cmds.is_empty());
        assert!(cmds.iter().any(|c| c.category == "System"));
    }
}
