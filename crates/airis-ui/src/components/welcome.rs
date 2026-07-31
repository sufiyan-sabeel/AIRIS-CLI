//! Welcome/splash component for the AIRIS-CLI TUI.
//!
//! Inspired by Oh My Pi's WelcomeComponent but original Rust implementation.
//! Displays animated AIRIS logo, version info, tips, and session list.

use crate::components::airis_logo;
use crate::theme::Theme;
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, Borders, Paragraph, Wrap};
use ratatui::Frame;

/// Number of recent session slots to reserve.
const SESSION_SLOTS: usize = 4;

/// Number of LSP server slots to reserve.
const LSP_SLOTS: usize = 4;

/// Duration of the intro animation in milliseconds.
const INTRO_MS: u64 = 3000;

/// Tick interval for the intro animation (~30fps).
const INTRO_TICK_MS: u64 = 33;

/// Welcome component state.
pub struct WelcomeComponent {
    /// Whether the intro animation is still playing.
    animating: bool,
    /// Progress of the intro animation [0.0, 1.0).
    progress: f64,
    /// Start time of the animation.
    start_time: std::time::Instant,
    /// Theme reference.
    theme: Theme,
    /// Available tips.
    tips: Vec<String>,
    /// Recent sessions.
    recent_sessions: Vec<String>,
    /// LSP servers detected.
    lsp_servers: Vec<String>,
    /// Model info line.
    model_info: Option<String>,
}

impl WelcomeComponent {
    pub fn new(theme: Theme) -> Self {
        Self {
            animating: true,
            progress: 0.0,
            start_time: std::time::Instant::now(),
            theme,
            tips: vec![
                "Use /help to see available commands".into(),
                "Press Ctrl+P to open command palette".into(),
                "Type /model to switch AI models".into(),
                "Use /save to persist your session".into(),
            ],
            recent_sessions: Vec::new(),
            lsp_servers: Vec::new(),
            model_info: None,
        }
    }

    /// Tick the animation forward.
    pub fn tick(&mut self) {
        if !self.animating {
            return;
        }

        let elapsed = self.start_time.elapsed().as_millis() as u64;
        if elapsed >= INTRO_MS {
            self.animating = false;
            self.progress = 1.0;
        } else {
            self.progress = elapsed as f64 / INTRO_MS as f64;
        }
    }

    pub fn is_animating(&self) -> bool {
        self.animating
    }

    pub fn set_sessions(&mut self, sessions: Vec<String>) {
        self.recent_sessions = sessions.into_iter().take(SESSION_SLOTS).collect();
    }

    pub fn set_lsp_servers(&mut self, servers: Vec<String>) {
        self.lsp_servers = servers.into_iter().take(LSP_SLOTS).collect();
    }

    pub fn set_model_info(&mut self, info: String) {
        self.model_info = Some(info);
    }

    /// Render the welcome screen.
    pub fn render(&mut self, frame: &mut Frame, area: Rect) {
        self.tick();

        let colors = self.theme.colors.clone();
        let bg = Style::default().bg(colors.background);

        // Clear area
        frame.render_widget(
            Paragraph::new(Text::raw("")).style(bg),
            area,
        );

        // Split into vertical sections
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(10),  // Logo area
                Constraint::Length(2),   // Subtitle
                Constraint::Length(1),   // Spacer
                Constraint::Length(2),   // Model info
                Constraint::Length(2),   // Tips section
                Constraint::Min(4),      // Sessions + LSP grid
                Constraint::Length(1),   // Spacer
                Constraint::Length(3),   // Footer
            ])
            .split(area);

        // Render animated logo
        let logo_area = chunks[0];
        let progress = if self.animating {
            Some(self.progress)
        } else {
            None
        };

        let logo_lines = airis_logo::render_logo_banner(area.width as usize, progress);
        // Render logo centered in logo_area
        let logo_start_y = logo_area.y;
        for (i, line) in logo_lines.iter().enumerate() {
            let y = logo_start_y + i as u16;
            if y >= area.y + area.height {
                break;
            }
            let spans = self.parse_ansi(line);
            frame.render_widget(
                Paragraph::new(Text::from(Line::from(spans)))
                    .style(bg),
                Rect::new(area.x, y, area.width, 1),
            );
        }

        // Render model info
        if let Some(ref info) = self.model_info {
            let model_style = Style::default()
                .fg(colors.secondary)
                .bg(colors.background);
            let info_line = Line::from(vec![
                Span::styled("Model: ", Style::default().fg(colors.text_muted)),
                Span::styled(info, Style::default().fg(colors.accent)),
            ]);
            frame.render_widget(
                Paragraph::new(Text::from(info_line))
                    .style(model_style)
                    .alignment(Alignment::Center),
                chunks[3],
            );
        }

        // Render tips
        if !self.animating && !self.tips.is_empty() {
            let tip_area = chunks[5];

            // Left column: recent sessions
            let tip_chunks = Layout::default()
                .direction(Direction::Horizontal)
                .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
                .split(tip_area);

            // Recent sessions
            let mut session_lines = vec![Line::from(vec![
                Span::styled(
                    " Recent Sessions ",
                    Style::default()
                        .fg(colors.primary)
                        .add_modifier(Modifier::BOLD),
                ),
            ])];

            if self.recent_sessions.is_empty() {
                session_lines.push(Line::from(vec![
                    Span::styled("  No recent sessions", Style::default().fg(colors.text_muted)),
                ]));
            } else {
                for session in &self.recent_sessions {
                    session_lines.push(Line::from(vec![
                        Span::styled(format!("  {}", session), Style::default().fg(colors.text_primary)),
                    ]));
                }
            }

            frame.render_widget(
                Paragraph::new(Text::from(session_lines))
                    .style(Style::default().bg(colors.surface))
                    .block(
                        Block::default()
                            .borders(Borders::ALL)
                            .border_style(Style::default().fg(colors.panel_border)),
                    ),
                tip_chunks[0],
            );

            // LSP servers
            let mut lsp_lines = vec![Line::from(vec![
                Span::styled(
                    " LSP Servers ",
                    Style::default()
                        .fg(colors.primary)
                        .add_modifier(Modifier::BOLD),
                ),
            ])];

            if self.lsp_servers.is_empty() {
                lsp_lines.push(Line::from(vec![
                    Span::styled("  No LSP servers", Style::default().fg(colors.text_muted)),
                ]));
            } else {
                for server in &self.lsp_servers {
                    lsp_lines.push(Line::from(vec![
                        Span::styled(
                            format!("  {}", server),
                            Style::default().fg(colors.text_primary),
                        ),
                    ]));
                }
            }

            frame.render_widget(
                Paragraph::new(Text::from(lsp_lines))
                    .style(Style::default().bg(colors.surface))
                    .block(
                        Block::default()
                            .borders(Borders::ALL)
                            .border_style(Style::default().fg(colors.panel_border)),
                    ),
                tip_chunks[1],
            );

            // Tip of the session
            let tip = &self.tips[0];
            let tip_paragraph = Paragraph::new(Text::from(Line::from(vec![
                Span::styled("Tip: ", Style::default().fg(colors.success).add_modifier(Modifier::BOLD)),
                Span::styled(tip, Style::default().fg(colors.text_secondary)),
            ])))
            .style(Style::default().bg(colors.background));
            frame.render_widget(tip_paragraph, chunks[4]);
        }

        // Footer
        if !self.animating {
            let footer_text = Line::from(vec![
                Span::styled(
                    " Ctrl+C ",
                    Style::default().fg(colors.surface).bg(colors.secondary),
                ),
                Span::styled(" to quit | ", Style::default().fg(colors.text_muted)),
                Span::styled(
                    " Ctrl+P ",
                    Style::default().fg(colors.surface).bg(colors.secondary),
                ),
                Span::styled(" for commands | ", Style::default().fg(colors.text_muted)),
                Span::styled(
                    " /help ",
                    Style::default().fg(colors.surface).bg(colors.secondary),
                ),
                Span::styled(" for help", Style::default().fg(colors.text_muted)),
            ]);

            frame.render_widget(
                Paragraph::new(Text::from(footer_text))
                    .style(Style::default().bg(colors.background))
                    .alignment(Alignment::Center),
                chunks[7],
            );
        }
    }

    /// Parse ANSI escape sequences from our gradient rendering into ratatui Spans.
    fn parse_ansi(&self, text: &str) -> Vec<Span<'static>> {
        let mut spans = Vec::new();
        let mut remaining = text;

        while let Some(start) = remaining.find("\x1b[") {
            // Text before the escape
            if start > 0 {
                spans.push(Span::raw(remaining[..start].to_string()));
            }

            let after_escape = &remaining[start + 2..];
            if let Some(m_end) = after_escape.find('m') {
                let params = &after_escape[..m_end];
                let after_seq = &after_escape[m_end + 1..];

                // Find the end of the styled text (next escape or end of string)
                let text_end = after_seq.find("\x1b[0m").unwrap_or(after_seq.len());
                let styled_text = &after_seq[..text_end];

                // Parse color from params
                if let Some(color) = self.parse_sgr_color(params) {
                    spans.push(Span::styled(
                        styled_text.to_string(),
                        Style::default().fg(color),
                    ));
                } else {
                    spans.push(Span::raw(styled_text.to_string()));
                }

                // Skip past the escape sequence and its text
                let skip = 2 + m_end + 1 + styled_text.len() + 4; // \x1b[...m...\x1b[0m
                remaining = &after_seq[text_end + 4..];
            } else {
                spans.push(Span::raw(remaining.to_string()));
                break;
            }
        }

        if !remaining.is_empty() {
            spans.push(Span::raw(remaining.to_string()));
        }

        spans
    }

    /// Parse SGR color parameters.
    fn parse_sgr_color(&self, params: &str) -> Option<Color> {
        if params == "0" || params.is_empty() {
            return None;
        }

        let parts: Vec<&str> = params.split(';').collect();
        if parts.len() >= 5 && parts[0] == "38" && parts[1] == "2" {
            let r = parts[2].parse::<u8>().ok()?;
            let g = parts[3].parse::<u8>().ok()?;
            let b = parts[4].parse::<u8>().ok()?;
            Some(Color::Rgb(r, g, b))
        } else {
            None
        }
    }
}
