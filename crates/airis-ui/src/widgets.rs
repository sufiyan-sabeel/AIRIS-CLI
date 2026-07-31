//! TUI widgets for AIRIS-CLI.

use ratatui::{
    layout::{Constraint, Layout, Rect},
    style::{Style, Stylize},
    text::{Line, Span, Text},
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
    Frame,
};

use crate::theme::Theme;

/// Render a chat message in the TUI.
pub fn render_message(frame: &mut Frame, area: Rect, role: &str, content: &str, theme: &Theme) {
    let colors = theme.ratatui_colors();
    let role_style = match role {
        "user" => Style::default().fg(colors.primary).bold(),
        "assistant" => Style::default().fg(colors.accent).bold(),
        "system" => Style::default().fg(colors.text_dim),
        _ => Style::default().fg(colors.text),
    };

    let block = Block::default()
        .title(Span::styled(format!(" {} ", role), role_style))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(colors.border));

    let text = Text::from(Line::from(Span::raw(content)));
    let paragraph = Paragraph::new(text)
        .block(block)
        .style(Style::default().fg(colors.text))
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

/// Render a streaming token indicator.
pub fn render_streaming_indicator(frame: &mut Frame, area: Rect, theme: &Theme) {
    let colors = theme.ratatui_colors();
    let text = Text::from(Line::from(vec![
        Span::styled("● ", Style::default().fg(colors.accent)),
        Span::styled("AI is thinking...", Style::default().fg(colors.text_dim)),
    ]));

    let paragraph = Paragraph::new(text);
    frame.render_widget(paragraph, area);
}

/// Render a progress indicator.
pub fn render_progress(frame: &mut Frame, area: Rect, progress: f64, label: &str, theme: &Theme) {
    let colors = theme.ratatui_colors();
    let bar_width = (area.width as f64 * progress) as u16;

    let progress_bar = Line::from(vec![
        Span::styled(
            "█".repeat(bar_width as usize),
            Style::default().fg(colors.primary),
        ),
        Span::styled(
            "░".repeat((area.width.saturating_sub(bar_width)) as usize),
            Style::default().fg(colors.text_dim),
        ),
        Span::raw(format!(" {:.0}%", progress * 100.0)),
    ]);

    let block = Block::default()
        .title(Span::styled(label, Style::default().fg(colors.text)))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(colors.border));

    let inner = block.inner(area);
    frame.render_widget(block, area);
    frame.render_widget(Paragraph::new(progress_bar), inner);
}

/// Render a tool call notification.
pub fn render_tool_call(frame: &mut Frame, area: Rect, tool_name: &str, status: &str, theme: &Theme) {
    let colors = theme.ratatui_colors();
    let (icon, status_color) = match status {
        "running" => ("▶", colors.warning),
        "success" => ("✓", colors.success),
        "error" => ("✗", colors.error),
        _ => ("○", colors.text_dim),
    };

    let text = Text::from(Line::from(vec![
        Span::styled(format!(" {} ", icon), Style::default().fg(status_color)),
        Span::styled(tool_name, Style::default().fg(colors.text)),
        Span::styled(format!(" {}", status), Style::default().fg(colors.text_dim)),
    ]));

    frame.render_widget(Paragraph::new(text), area);
}

/// Render a code block with syntax highlighting placeholder.
pub fn render_code_block(frame: &mut Frame, area: Rect, code: &str, language: &str, theme: &Theme) {
    let colors = theme.ratatui_colors();
    let lines: Vec<Line> = code
        .lines()
        .map(|line| {
            Line::from(Span::styled(line.to_string(), Style::default().fg(colors.text)))
        })
        .collect();

    let block = Block::default()
        .title(format!(" {} ", language))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(colors.secondary))
        .style(Style::default().bg(colors.surface));

    let paragraph = Paragraph::new(Text::from(lines))
        .block(block)
        .wrap(Wrap { trim: false });

    frame.render_widget(paragraph, area);
}
