//! Input editor for the TUI.
//!
//! Provides a multi-line text input area using tui-textarea with
//! syntax-aware features: auto-indent, line numbers, key bindings,
//! history navigation, and submit handling.

use crate::theme::Theme;
use airis_core::prelude::*;
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph, Widget, Wrap};
use ratatui::buffer::Buffer;
use tui_textarea::{CursorMove, Input, Key, Scroll, TextArea};

/// A multi-line text input with chat-optimized key bindings.
pub struct InputArea {
    /// The underlying textarea.
    textarea: TextArea<'static>,
    /// Message history for up/down navigation.
    history: Vec<String>,
    /// Current position in history (None = new message).
    history_pos: Option<usize>,
    /// Placeholder text shown when empty.
    placeholder: String,
    /// Whether the input is focused.
    focused: bool,
    /// Theme reference.
    theme: Theme,
    /// Maximum input height in lines.
    max_height: u16,
    /// Current line count.
    line_count: usize,
}

impl InputArea {
    /// Create a new input area.
    pub fn new(theme: Theme) -> Self {
        let mut textarea = TextArea::default();
        textarea.set_placeholder_text("Type a message...");
        textarea.set_cursor_line_style(Style::default());
        textarea.set_block(Block::default().borders(Borders::ALL));

        Self {
            textarea,
            history: Vec::new(),
            history_pos: None,
            placeholder: "Type a message...".into(),
            focused: true,
            theme,
            max_height: 8,
            line_count: 1,
        }
    }

    /// Get the current input text.
    pub fn text(&self) -> String {
        self.textarea.lines().join("\n")
    }

    /// Set the input text.
    pub fn set_text(&mut self, text: impl Into<String>) {
        let s: String = text.into();
        self.textarea = TextArea::from(s.lines().map(String::from).collect::<Vec<_>>());
        self.textarea.set_cursor_line_style(Style::default());
        self.textarea.set_block(Block::default().borders(Borders::ALL));
        self.line_count = self.textarea.lines().len();
    }

    /// Clear the input.
    pub fn clear(&mut self) {
        self.textarea = TextArea::default();
        self.textarea.set_placeholder_text(&self.placeholder);
        self.textarea.set_cursor_line_style(Style::default());
        self.textarea.set_block(Block::default().borders(Borders::ALL));
        self.line_count = 1;
    }

    /// Submit the current input and add to history.
    pub fn submit(&mut self) -> Option<String> {
        let text = self.text();
        if text.trim().is_empty() {
            return None;
        }
        self.history.push(text.clone());
        self.history_pos = None;
        self.clear();
        Some(text)
    }

    /// Set whether the input is focused.
    pub fn set_focused(&mut self, focused: bool) {
        self.focused = focused;
    }

    /// Set the maximum height in lines.
    pub fn set_max_height(&mut self, height: u16) {
        self.max_height = height;
    }

    /// Get the current cursor position.
    pub fn cursor_position(&self) -> (usize, usize) {
        let (col, line) = self.textarea.cursor();
        (line, col)
    }

    /// Process an input key event. Returns true if the event was handled.
    pub fn input(&mut self, input: &Input) -> bool {
        match input {
            Input { key: Key::Up, ctrl: false, alt: false, .. } => {
                // If on first line, navigate history
                if self.textarea.cursor().0 == 0 {
                    self.history_back();
                    true
                } else {
                    self.textarea.input(input);
                    true
                }
            }
            Input { key: Key::Down, ctrl: false, alt: false, .. } => {
                let lines = self.textarea.lines().len();
                if self.textarea.cursor().0 >= lines.saturating_sub(1) {
                    self.history_forward();
                    true
                } else {
                    self.textarea.input(input);
                    true
                }
            }
            Input { key: Key::Enter, ctrl: true, .. } => {
                // Ctrl+Enter = insert newline
                self.textarea.input(Input {
                    key: Key::Enter,
                    ctrl: false,
                    alt: false,
                    ..*input
                });
                true
            }
            _ => {
                self.textarea.input(input);
                self.line_count = self.textarea.lines().len();
                true
            }
        }
    }

    /// Navigate to previous history entry.
    fn history_back(&mut self) {
        if self.history.is_empty() {
            return;
        }
        let pos = match self.history_pos {
            Some(p) if p > 0 => p - 1,
            Some(_) => return, // Already at oldest
            None => self.history.len().saturating_sub(1),
        };
        self.history_pos = Some(pos);
        if let Some(text) = self.history.get(pos) {
            self.set_text(text.clone());
        }
    }

    /// Navigate to next history entry.
    fn history_forward(&mut self) {
        match self.history_pos {
            Some(pos) if pos + 1 < self.history.len() => {
                self.history_pos = Some(pos + 1);
                if let Some(text) = self.history.get(pos + 1) {
                    self.set_text(text.clone());
                }
            }
            Some(_) => {
                // Reached end of history, show empty input
                self.history_pos = None;
                self.clear();
            }
            None => {}
        }
    }

    /// Get the visual height this input occupies.
    pub fn visual_height(&self) -> u16 {
        let lines = self.textarea.lines().len() as u16;
        lines.min(self.max_height) + 2 // +2 for borders
    }

    /// Get the line count.
    pub fn line_count(&self) -> usize {
        self.line_count
    }
}

impl Widget for &mut InputArea {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let colors = &self.theme.colors;

        // Style the textarea based on focus state
        let border_color = if self.focused {
            colors.panel_focused_border
        } else {
            colors.panel_border
        };

        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(border_color));

        self.textarea.set_block(block);
        self.textarea.set_style(Style::default().fg(colors.text_primary).bg(colors.panel_bg));

        // Cursor style
        self.textarea.set_cursor_style(Style::default().fg(colors.cursor));

        // Render the textarea
        self.textarea.render(area, buf);

        // Draw line count indicator in the bottom-right corner if multi-line
        if self.line_count > 1 {
            let line_indicator = format!(" {} ", self.line_count);
            let indicator_w = line_indicator.len() as u16;
            if indicator_w + 1 < area.width {
                let indicator_style = Style::default()
                    .fg(colors.text_muted)
                    .bg(colors.surface);
                let span = Span::styled(line_indicator, indicator_style);
                buf.set_span(
                    area.x + area.width - indicator_w - 1,
                    area.y + area.height - 1,
                    &span,
                    indicator_w,
                );
            }
        }
    }
}

/// Pre-defined keybinding handler for the input area.
/// Returns `InputAction` to signal what the parent should do.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputAction {
    /// Continue editing.
    Continue,
    /// Submit the input.
    Submit,
    /// Cancel/discard input.
    Cancel,
    /// Close the application.
    Quit,
    /// Open command palette.
    CommandPalette,
    /// Open file selector.
    FilePicker,
    /// Switch focus to next panel.
    NextPanel,
    /// Switch focus to previous panel.
    PreviousPanel,
}

/// Translate a crossterm event to an InputAction for the input area.
pub fn map_input_event(
    key_event: &crossterm::event::KeyEvent,
    input_area: &mut InputArea,
) -> InputAction {
    use crossterm::event::KeyCode;
    use crossterm::event::KeyModifiers;

    let input: Input = convert_key_event(key_event);

    match (key_event.code, key_event.modifiers) {
        (KeyCode::Enter, KeyModifiers::NONE) => {
            return InputAction::Submit;
        }
        (KeyCode::Char('c'), KeyModifiers::CONTROL) if input_area.text().is_empty() => {
            return InputAction::Quit;
        }
        (KeyCode::Char('d'), KeyModifiers::CONTROL) => {
            return InputAction::Cancel;
        }
        (KeyCode::Char('p'), KeyModifiers::CONTROL | KeyModifiers::SHIFT) => {
            return InputAction::CommandPalette;
        }
        (KeyCode::Tab, KeyModifiers::NONE) => {
            return InputAction::NextPanel;
        }
        (KeyCode::BackTab, KeyModifiers::NONE) => {
            return InputAction::PreviousPanel;
        }
        (KeyCode::Esc, KeyModifiers::NONE) => {
            if input_area.text().is_empty() {
                return InputAction::Cancel;
            }
            input_area.clear();
            return InputAction::Continue;
        }
        _ => {}
    }

    input_area.input(&input);
    InputAction::Continue
}

/// Convert a crossterm KeyEvent to a tui-textarea Input.
fn convert_key_event(ev: &crossterm::event::KeyEvent) -> Input {
    use crossterm::event::KeyCode;
    use crossterm::event::KeyModifiers;

    let key = match ev.code {
        KeyCode::Enter => Key::Enter,
        KeyCode::Tab => Key::Tab,
        KeyCode::BackTab => Key::Tab,
        KeyCode::Backspace => Key::Backspace,
        KeyCode::Delete => Key::Delete,
        KeyCode::Left => Key::Left,
        KeyCode::Right => Key::Right,
        KeyCode::Up => Key::Up,
        KeyCode::Down => Key::Down,
        KeyCode::Home => Key::Home,
        KeyCode::End => Key::End,
        KeyCode::PageUp => Key::PageUp,
        KeyCode::PageDown => Key::PageDown,
        KeyCode::Esc => Key::Esc,
        KeyCode::Char(c) => Key::Char(c),
        _ => Key::Null,
    };

    let ctrl = ev.modifiers.contains(KeyModifiers::CONTROL);
    let alt = ev.modifiers.contains(KeyModifiers::ALT);
    let shift = ev.modifiers.contains(KeyModifiers::SHIFT);

    Input { key, ctrl, alt, shift }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_theme() -> Theme {
        Theme::named("kageos-dark")
    }

    #[test]
    fn test_input_new() {
        let theme = test_theme();
        let input = InputArea::new(theme);
        assert!(input.text().is_empty());
        assert!(input.focused);
    }

    #[test]
    fn test_input_text() {
        let theme = test_theme();
        let mut input = InputArea::new(theme);
        input.set_text("hello world");
        assert_eq!(input.text(), "hello world");
    }

    #[test]
    fn test_input_submit() {
        let theme = test_theme();
        let mut input = InputArea::new(theme);
        input.set_text("test message");
        let result = input.submit();
        assert_eq!(result, Some("test message".into()));
        assert!(input.text().is_empty());
        assert_eq!(input.history.len(), 1);
    }

    #[test]
    fn test_input_empty_submit() {
        let theme = test_theme();
        let mut input = InputArea::new(theme);
        let result = input.submit();
        assert!(result.is_none());
    }

    #[test]
    fn test_history() {
        let theme = test_theme();
        let mut input = InputArea::new(theme);
        input.submit(); // empty, no history
        input.set_text("first");
        input.submit();
        input.set_text("second");
        input.submit();

        assert_eq!(input.history.len(), 2);
        assert_eq!(input.history[0], "first");
        assert_eq!(input.history[1], "second");
    }

    #[test]
    fn test_clear() {
        let theme = test_theme();
        let mut input = InputArea::new(theme);
        input.set_text("something");
        input.clear();
        assert!(input.text().is_empty());
    }
}
