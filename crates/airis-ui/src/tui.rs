//! Main TUI application for AIRIS-CLI.
//!
//! Provides the `TuiApp` struct and event loop that integrates all UI
//! components: chat, input, panels, streaming, command palette, progress,
//! and the animated AIRIS logo welcome screen.

use crate::chat::ChatArea;
use crate::command::CommandPalette;
use crate::components::welcome::WelcomeComponent;
use crate::input::{InputAction, InputArea, map_input_event};
use crate::panel::{self, FileEntry, PanelId, PanelRects, SplitLayout};
use crate::progress::{MultiProgress, ProgressState, StatusBar, StatusMode};
use crate::streaming::StreamingWidget;
use crate::theme::{ColorScheme, Theme};
use airis_core::prelude::*;
use ratatui::layout::{Constraint, Direction, Layout, Margin, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, Borders, Clear, Paragraph, Widget, Wrap};
use ratatui::Terminal;
use ratatui::buffer::Buffer;
use std::sync::Arc;
use std::time::{Duration, Instant};
use crossterm::event::{Event, KeyCode, KeyEvent, KeyModifiers, MouseEvent, MouseEventKind};
use tracing::info;

/// Tick rate for the UI event loop (~60 FPS).
const TICK_RATE: Duration = Duration::from_millis(16);
/// Maximum events processed per frame.
const MAX_EVENTS_PER_FRAME: usize = 100;

/// Application operation mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppMode {
    Normal,
    Streaming,
    Processing,
    Command,
    Welcome,
}

/// The main TUI application.
pub struct TuiApp {
    /// Session manager for conversation persistence.
    pub session_manager: Option<Arc<SessionManager>>,
    /// Global configuration.
    pub config: Arc<AirisConfig>,
    /// Whether the app should quit.
    pub should_quit: bool,
    /// Split panel layout.
    pub panels: SplitLayout,
    /// Conversation display.
    pub chat: ChatArea,
    /// Input editor.
    pub input: InputArea,
    /// Streaming token display.
    pub streaming: Option<StreamingWidget>,
    /// Command palette overlay.
    pub command_palette: CommandPalette,
    /// Multi-progress tracker.
    pub progress: MultiProgress,
    /// Status bar.
    pub status_bar: StatusBar,
    /// Current theme.
    pub theme: Theme,
    /// Welcome component with animated AIRIS logo.
    pub welcome: WelcomeComponent,
    /// Whether to show the welcome screen.
    pub show_welcome: bool,
    /// Files in the files panel.
    pub files: Vec<FileEntry>,
    /// Available tool definitions.
    pub tool_definitions: Vec<ToolDefinition>,
    /// Currently executing tool name.
    pub active_tool: Option<String>,
    /// Current application mode.
    pub mode: AppMode,
    /// Last terminal size.
    last_size: (u16, u16),
}

impl TuiApp {
    /// Create a new TUI application from config (no session manager yet).
    pub fn new(config: &AirisConfig) -> Self {
        let theme = Theme::named(&config.ui.syntax_theme);
        let mut cmd_palette = CommandPalette::new(theme.clone());
        cmd_palette.hide();

        Self {
            session_manager: None,
            config: Arc::new(config.clone()),
            should_quit: false,
            panels: SplitLayout::new(),
            chat: ChatArea::new(theme.clone()),
            input: InputArea::new(theme.clone()),
            streaming: None,
            command_palette: cmd_palette,
            progress: MultiProgress::new(),
            status_bar: StatusBar::new(),
            welcome: WelcomeComponent::new(theme.clone()),
            show_welcome: true,
            theme,
            files: Vec::new(),
            tool_definitions: Vec::new(),
            active_tool: None,
            mode: AppMode::Welcome,
            last_size: (0, 0),
        }
    }

    /// Set up terminal for raw mode.
    pub fn setup_terminal(
    ) -> crossterm::Result<Terminal<ratatui::backend::CrosstermBackend<std::io::Stdout>>> {
        crossterm::terminal::enable_raw_mode()?;
        let mut stdout = std::io::stdout();
        crossterm::execute!(
            stdout,
            crossterm::terminal::EnterAlternateScreen,
            crossterm::event::EnableMouseCapture,
            crossterm::event::EnableBracketedPaste,
        )?;

        let backend = ratatui::backend::CrosstermBackend::new(stdout);
        let mut terminal = Terminal::new(backend)?;
        terminal.clear()?;
        terminal.hide_cursor()?;
        Ok(terminal)
    }

    /// Restore terminal to normal mode.
    pub fn teardown_terminal(
        terminal: &mut Terminal<ratatui::backend::CrosstermBackend<std::io::Stdout>>,
    ) -> crossterm::Result<()> {
        terminal.show_cursor()?;
        crossterm::execute!(
            terminal.backend_mut(),
            crossterm::event::DisableMouseCapture,
            crossterm::terminal::LeaveAlternateScreen,
        )?;
        crossterm::terminal::disable_raw_mode()?;
        Ok(())
    }

    /// Run the main event loop.
    pub fn run(
        &mut self,
        terminal: &mut Terminal<ratatui::backend::CrosstermBackend<std::io::Stdout>>,
    ) -> AirisResult<()> {
        let mut last_tick = Instant::now();

        // Show welcome screen with AIRIS logo animation
        terminal.draw(|f| {
            if self.show_welcome {
                let area = f.area();
                self.welcome.render(f, area);
            }
        })?;

        loop {
            let timeout = TICK_RATE
                .checked_sub(last_tick.elapsed())
                .unwrap_or(Duration::ZERO);

            let events = self.poll_events(timeout);
            if self.should_quit {
                break;
            }
            for event in events {
                self.handle_event(event)?;
            }

            let now = Instant::now();
            if now - last_tick >= TICK_RATE {
                self.tick();
                last_tick = now;
            }

            terminal.draw(|f| {
                if self.show_welcome {
                    self.welcome.render(f, f.area());
                } else {
                    self.render(f.area(), f.buffer_mut());
                }
            })?;
        }

        Ok(())
    }

    fn poll_events(&self, timeout: Duration) -> Vec<Event> {
        let mut events = Vec::new();
        if crossterm::event::poll(timeout).unwrap_or(false) {
            for _ in 0..MAX_EVENTS_PER_FRAME {
                match crossterm::event::read() {
                    Ok(event) => {
                        events.push(event);
                        if !crossterm::event::poll(Duration::ZERO).unwrap_or(false) {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        }
        events
    }

    fn handle_event(&mut self, event: Event) -> AirisResult<()> {
        match event {
            Event::Key(key) => self.handle_key(key),
            Event::Mouse(mouse) => self.handle_mouse(mouse),
            Event::Resize(w, h) => {
                self.last_size = (w, h);
                Ok(())
            }
            _ => Ok(()),
        }
    }

    fn handle_key(&mut self, key: KeyEvent) -> AirisResult<()> {
        // Welcome screen: any key dismisses it after animation completes
        if self.show_welcome {
            if !self.welcome.is_animating() {
                self.show_welcome = false;
                self.mode = AppMode::Normal;
                self.update_status_bar();
            }
            return Ok(());
        }

        // Command palette gets priority
        if self.command_palette.is_visible() {
            self.command_palette.handle_key(&key);
            if !self.command_palette.is_visible() {
                self.mode = AppMode::Normal;
                self.update_status_bar();
            }
            return Ok(());
        }

        match (key.code, key.modifiers) {
            (KeyCode::Char('q'), KeyModifiers::CONTROL)
            | (KeyCode::Char('c'), KeyModifiers::CONTROL) if self.input.text().is_empty() => {
                self.should_quit = true;
                return Ok(());
            }
            (KeyCode::Char('p'), KeyModifiers::CONTROL) => {
                self.command_palette.show();
                self.mode = AppMode::Command;
                self.update_status_bar();
                return Ok(());
            }
            (KeyCode::Char('b'), KeyModifiers::CONTROL) => {
                self.panels.toggle_tools();
                return Ok(());
            }
            (KeyCode::Char('t'), KeyModifiers::CONTROL) => {
                self.panels.toggle_files();
                return Ok(());
            }
            (KeyCode::Tab, _) => {
                self.panels.focus_next();
                self.update_focus();
                return Ok(());
            }
            (KeyCode::BackTab, _) => {
                self.panels.focus_prev();
                self.update_focus();
                return Ok(());
            }
            (KeyCode::Esc, _) => {
                if self.mode == AppMode::Streaming {
                    self.cancel_streaming();
                } else if self.panels.focus != PanelId::Conversation {
                    self.panels.set_focus(PanelId::Conversation);
                    self.update_focus();
                }
                return Ok(());
            }
            (KeyCode::PageUp, _) => {
                self.chat.scroll_up(10);
                return Ok(());
            }
            (KeyCode::PageDown, _) => {
                self.chat.scroll_down(10);
                return Ok(());
            }
            (KeyCode::Home, _) => {
                self.chat.scroll_to_top();
                return Ok(());
            }
            (KeyCode::End, _) => {
                self.chat.scroll_to_bottom();
                return Ok(());
            }
            _ => {}
        }

        // Route to focused panel
        if self.panels.focus == PanelId::Conversation {
            let action = map_input_event(&key, &mut self.input);
            match action {
                InputAction::Submit => {
                    if let Some(content) = self.input.submit() {
                        self.send_message(content);
                    }
                }
                InputAction::Quit => self.should_quit = true,
                InputAction::Cancel => self.input.clear(),
                InputAction::CommandPalette => {
                    self.command_palette.show();
                    self.mode = AppMode::Command;
                    self.update_status_bar();
                }
                _ => {}
            }
        }

        Ok(())
    }

    fn handle_mouse(&mut self, mouse: MouseEvent) -> AirisResult<()> {
        if self.show_welcome {
            return Ok(());
        }
        match mouse.kind {
            MouseEventKind::ScrollUp => {
                self.chat.scroll_up(3);
            }
            MouseEventKind::ScrollDown => {
                self.chat.scroll_down(3);
            }
            MouseEventKind::Down(_) => {
                let area = Rect::new(0, 0, self.last_size.0, self.last_size.1);
                let rects = self.panels.split(area);
                if rects.conversation.contains_point((mouse.column, mouse.row)) {
                    self.panels.set_focus(PanelId::Conversation);
                } else if rects.tools.contains_point((mouse.column, mouse.row)) {
                    self.panels.set_focus(PanelId::Tools);
                } else if rects.files.contains_point((mouse.column, mouse.row)) {
                    self.panels.set_focus(PanelId::Files);
                }
                self.update_focus();
            }
            _ => {}
        }
        Ok(())
    }

    fn tick(&mut self) {
        if self.show_welcome {
            // Welcome component ticks itself during render
        }
        if let Some(ref mut sw) = self.streaming {
            sw.tick();
        }
    }

    /// Dismiss the welcome screen manually.
    pub fn dismiss_welcome(&mut self) {
        self.show_welcome = false;
        self.mode = AppMode::Normal;
        self.update_status_bar();
    }

    /// Send a user message, add it to the session, and start streaming.
    pub fn send_message(&mut self, content: String) {
        if self.show_welcome {
            self.dismiss_welcome();
        }

        self.mode = AppMode::Streaming;
        self.chat.start_streaming();

        let mut sw = StreamingWidget::new(Theme::new(self.theme.colors.clone()));
        sw.set_chars_per_tick(5);
        self.streaming = Some(sw);

        self.update_status_bar();
    }

    /// Append a streaming chunk.
    pub fn append_stream_chunk(&mut self, chunk: &str) {
        self.chat.append_stream_chunk(chunk);
        if let Some(ref mut sw) = self.streaming {
            sw.append(chunk);
        }
    }

    /// Finish streaming.
    pub fn finish_streaming(&mut self, finish_reason: &str, usage: Option<TokenUsage>) {
        self.chat.finish_streaming();
        if let Some(ref mut sw) = self.streaming {
            sw.finish(finish_reason, usage);
        }
        self.mode = AppMode::Normal;
        self.streaming = None;
        self.update_status_bar();
    }

    /// Cancel streaming.
    pub fn cancel_streaming(&mut self) {
        self.chat.finish_streaming();
        self.streaming = None;
        self.mode = AppMode::Normal;
        self.update_status_bar();
    }

    /// Set processing state.
    pub fn set_processing(&mut self, message: &str) {
        if self.show_welcome {
            self.dismiss_welcome();
        }
        self.mode = AppMode::Processing;
        self.status_bar.center_text = format!(" \u{2699} {} ", message);
        self.status_bar.mode = StatusMode::Processing;
    }

    /// Add a progress entry.
    pub fn add_progress(&mut self, step: impl Into<String>) -> usize {
        self.progress.add(ProgressState::new(step))
    }

    /// Update a progress entry.
    pub fn update_progress(&mut self, id: usize, step: impl Into<String>, progress: f64) {
        self.progress.update(id, ProgressState::with_progress(step, progress));
    }

    /// Remove a progress entry.
    pub fn remove_progress(&mut self, id: usize) {
        self.progress.remove(id);
    }

    fn update_focus(&mut self) {
        self.input.set_focused(self.panels.focus == PanelId::Conversation);
        self.update_status_bar();
    }

    fn update_status_bar(&mut self) {
        self.status_bar.mode = match self.mode {
            AppMode::Welcome => StatusMode::Normal,
            AppMode::Normal => StatusMode::Normal,
            AppMode::Streaming => StatusMode::Streaming,
            AppMode::Processing => StatusMode::Processing,
            AppMode::Command => StatusMode::Command,
        };
    }

    /// Render the entire UI (non-welcome mode).
    fn render(&mut self, area: Rect, buf: &mut Buffer) {
        let colors = &self.theme.colors;

        // Background fill
        let bg = Style::default().bg(colors.background);
        for y in area.top()..area.bottom() {
            for x in area.left()..area.right() {
                buf[(x, y)] = ratatui::buffer::Cell::default().set_style(bg);
            }
        }

        let rects = self.panels.split(area);

        // ── Conversation panel ──
        {
            let conv = rects.conversation;
            let inner = Rect::new(
                conv.x + 1, conv.y + 1,
                conv.width.saturating_sub(2), conv.height.saturating_sub(2),
            );

            // Draw border
            let border = if self.panels.focus == PanelId::Conversation {
                colors.panel_focused_border
            } else {
                colors.panel_border
            };
            let border_style = Style::default().fg(border);
            for x in conv.left()..conv.right() {
                buf[(x, conv.y)].set_style(border_style);
                buf[(x, conv.bottom() - 1)].set_style(border_style);
            }
            for y in conv.top()..conv.bottom() {
                buf[(conv.x, y)].set_style(border_style);
                buf[(conv.right() - 1, y)].set_style(border_style);
            }

            // Render chat content and input
            if inner.height >= 4 {
                let input_h = self.input.visual_height().min(inner.height / 2);
                let chat_h = inner.height.saturating_sub(input_h + 1);

                let chat_area = Rect::new(inner.x, inner.y, inner.width, chat_h);
                if chat_area.height >= 2 {
                    self.chat.set_max_visible_lines(chat_area.height as usize);
                    self.chat.render(chat_area, buf);
                }

                let input_y = inner.y + chat_h + 1;
                let input_area = Rect::new(inner.x, input_y, inner.width, input_h);
                self.input.render(input_area, buf);
            }
        }

        // ── Side panels ──
        if self.panels.side_visible.tools && rects.tools.width > 5 && rects.tools.height > 3 {
            panel::render_tools_panel(
                rects.tools, buf, colors,
                self.panels.focus == PanelId::Tools,
                &self.tool_definitions, self.active_tool.as_deref(),
            );
        }

        if self.panels.side_visible.files && rects.files.width > 5 && rects.files.height > 3 {
            panel::render_files_panel(
                rects.files, buf, colors,
                self.panels.focus == PanelId::Files,
                &self.files,
            );
        }

        // ── Dividers ──
        panel::render_dividers(&rects, buf, colors, self.panels.focus);

        // ── Streaming overlay ──
        if self.mode == AppMode::Streaming {
            if let Some(ref sw) = self.streaming {
                let oh = 6u16.min(area.height / 4);
                let overlay = Rect::new(
                    area.x + 2, area.height.saturating_sub(oh + 2),
                    area.width.saturating_sub(4), oh,
                );
                Clear.render(overlay, buf);

                let block = Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(colors.info))
                    .title(format!(" \u{f104} {} ", sw.token_display()));
                let inner = block.inner(overlay);
                block.render(overlay, buf);

                if inner.height > 0 {
                    let text = crate::syntax::truncate_to_width(
                        sw.total_content(), inner.width as usize,
                    );
                    Paragraph::new(Line::from(Span::styled(
                        text,
                        Style::default().fg(colors.text_primary),
                    ))).render(inner, buf);
                }
            }
        }

        // ── Progress area ──
        if !self.progress.is_empty() {
            let h = self.progress.len() as u16;
            let prog_area = Rect::new(
                rects.conversation.x + 1,
                rects.conversation.bottom().saturating_sub(h + 2),
                rects.conversation.width.saturating_sub(2), h,
            );
            crate::progress::render_multi_progress(&self.progress, prog_area, buf, colors);
        }

        // ── Status bar ──
        let status_area = Rect::new(area.x, area.height.saturating_sub(1), area.width, 1);
        self.status_bar.render(status_area, buf, colors);

        // ── Command palette ──
        if self.command_palette.is_visible() {
            self.command_palette.render(area, buf);
        }
    }
}

// Extend Rect to check point containment within this crate
use panel::RectExt;

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn test_config() -> Arc<AirisConfig> {
        Arc::new(AirisConfig {
            ui: airis_core::types::UiConfig::default(),
            ..Default::default()
        })
    }

    #[test]
    fn test_app_new() {
        let config = AirisConfig {
            ui: airis_core::types::UiConfig::default(),
            ..Default::default()
        };
        let app = TuiApp::new(&config);
        assert!(!app.should_quit);
        assert_eq!(app.mode, AppMode::Welcome);
        assert!(app.show_welcome);
    }

    #[test]
    fn test_dismiss_welcome() {
        let config = AirisConfig::default();
        let mut app = TuiApp::new(&config);
        assert!(app.show_welcome);
        app.dismiss_welcome();
        assert!(!app.show_welcome);
        assert_eq!(app.mode, AppMode::Normal);
    }

    #[test]
    fn test_send_message_dismisses_welcome() {
        let config = AirisConfig::default();
        let mut app = TuiApp::new(&config);
        app.send_message("Hello".into());
        assert!(!app.show_welcome);
        assert_eq!(app.mode, AppMode::Streaming);
    }

    #[test]
    fn test_cancel_streaming() {
        let config = AirisConfig::default();
        let mut app = TuiApp::new(&config);
        app.send_message("hi".into());
        app.cancel_streaming();
        assert_eq!(app.mode, AppMode::Normal);
    }

    #[test]
    fn test_finish_streaming() {
        let config = AirisConfig::default();
        let mut app = TuiApp::new(&config);
        app.send_message("hello".into());
        app.append_stream_chunk("Hi");
        app.finish_streaming("stop", None);
        assert_eq!(app.mode, AppMode::Normal);
    }

    #[test]
    fn test_progress_lifecycle() {
        let config = AirisConfig::default();
        let mut app = TuiApp::new(&config);
        let id = app.add_progress("Working");
        assert!(!app.progress.is_empty());
        app.update_progress(id, "Processing", 0.5);
        app.remove_progress(id);
        assert!(app.progress.is_empty());
    }

    #[test]
    fn test_focus() {
        let config = AirisConfig::default();
        let mut app = TuiApp::new(&config);
        app.dismiss_welcome();
        assert_eq!(app.panels.focus, PanelId::Conversation);
        app.panels.focus_next();
        assert_eq!(app.panels.focus, PanelId::Tools);
    }
}
