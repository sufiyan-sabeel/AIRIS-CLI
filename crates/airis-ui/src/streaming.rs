//! Streaming token display for real-time model output.
//!
//! Provides a widget that renders tokens as they arrive from the model,
//! with animated typewriter effect, word-wrap, and auto-scroll.

use crate::theme::Theme;
use airis_core::prelude::*;
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, Borders, Paragraph, Widget, Wrap};
use ratatui::buffer::Buffer;
use std::time::Instant;

/// A widget for displaying streaming token output in real-time.
pub struct StreamingWidget {
    /// Accumulated content so far.
    content: String,
    /// Buffer of characters not yet displayed.
    pending: String,
    /// Rendering position in the pending buffer.
    render_pos: usize,
    /// Characters displayed per tick for typewriter effect.
    chars_per_tick: usize,
    /// Interval between animation ticks.
    tick_interval: std::time::Duration,
    /// Last tick time.
    last_tick: Instant,
    /// Whether streaming is paused (visible but not advancing).
    paused: bool,
    /// Maximum width for word wrap.
    max_width: usize,
    /// Whether the display is finished/completed.
    done: bool,
    /// Finish reason if available.
    finish_reason: Option<String>,
    /// Token usage if available.
    usage: Option<TokenUsage>,
    /// Theme reference.
    theme: Theme,
    /// Start time for elapsed display.
    started_at: Instant,
}

impl StreamingWidget {
    /// Create a new streaming widget.
    pub fn new(theme: Theme) -> Self {
        Self {
            content: String::new(),
            pending: String::new(),
            render_pos: 0,
            chars_per_tick: 3,
            tick_interval: std::time::Duration::from_millis(16), // ~60fps
            last_tick: Instant::now(),
            paused: false,
            max_width: 80,
            done: false,
            finish_reason: None,
            usage: None,
            theme,
            started_at: Instant::now(),
        }
    }

    /// Append new content to the stream.
    pub fn append(&mut self, chunk: &str) {
        self.pending.push_str(chunk);
        self.done = false;
    }

    /// Mark streaming as complete.
    pub fn finish(&mut self, finish_reason: &str, usage: Option<TokenUsage>) {
        self.done = true;
        self.finish_reason = Some(finish_reason.to_string());
        self.usage = usage;
        // Flush remaining pending
        self.advance_to_end();
    }

    /// Immediately advance all pending content.
    pub fn advance_to_end(&mut self) {
        self.content.push_str(&self.pending[self.render_pos..]);
        self.render_pos = self.pending.len();
    }

    /// Tick the animation forward. Returns true if the display changed.
    pub fn tick(&mut self) -> bool {
        if self.paused || self.render_pos >= self.pending.len() {
            return false;
        }

        let now = Instant::now();
        if now.duration_since(self.last_tick) < self.tick_interval {
            return false;
        }
        self.last_tick = now;

        let end = (self.render_pos + self.chars_per_tick).min(self.pending.len());
        self.content.push_str(&self.pending[self.render_pos..end]);
        self.render_pos = end;

        true
    }

    /// Get the fully rendered (flushed) content.
    pub fn content(&self) -> &str {
        &self.content
    }

    /// Get the total content including pending.
    pub fn total_content(&self) -> &str {
        &self.pending
    }

    /// Whether the stream has completed.
    pub fn is_done(&self) -> bool {
        self.done && self.render_pos >= self.pending.len()
    }

    /// Reset for a new stream.
    pub fn reset(&mut self) {
        self.content.clear();
        self.pending.clear();
        self.render_pos = 0;
        self.done = false;
        self.finish_reason = None;
        self.usage = None;
        self.started_at = Instant::now();
    }

    /// Pause or resume the animation.
    pub fn set_paused(&mut self, paused: bool) {
        self.paused = paused;
    }

    /// Set characters per tick.
    pub fn set_chars_per_tick(&mut self, count: usize) {
        self.chars_per_tick = count;
    }

    /// Set the maximum width for display.
    pub fn set_max_width(&mut self, width: usize) {
        self.max_width = width;
    }

    /// Elapsed time since streaming started.
    pub fn elapsed(&self) -> std::time::Duration {
        self.started_at.elapsed()
    }

    /// Formatted token count display.
    pub fn token_display(&self) -> String {
        if let Some(ref usage) = self.usage {
            format!("{} tokens", usage.completion_tokens)
        } else if self.done {
            format!("{} chars", self.content.len())
        } else {
            format!("{} chars", self.pending.len())
        }
    }

    /// Get the finish reason.
    pub fn finish_reason(&self) -> Option<&str> {
        self.finish_reason.as_deref()
    }

    /// Get the token usage.
    pub fn usage(&self) -> Option<&TokenUsage> {
        self.usage.as_ref()
    }
}

impl Widget for &mut StreamingWidget {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 5 || area.height < 3 {
            return;
        }

        let colors = &self.theme.colors;

        // Title bar
        let elapsed = self.elapsed();
        let elapsed_str = if elapsed.as_secs() > 60 {
            format!("{}m {:02}s", elapsed.as_secs() / 60, elapsed.as_secs() % 60)
        } else {
            format!("{:.1}s", elapsed.as_secs_f64())
        };

        let title = if self.is_done() {
            format!("  Response  {}  {}", elapsed_str, self.token_display())
        } else {
            format!("  Streaming  {}  {}", elapsed_str, self.token_display())
        };

        let title_style = if self.is_done() {
            Style::default().fg(colors.success)
        } else {
            Style::default().fg(colors.info)
        };

        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(if self.is_done() { colors.success } else { colors.info }))
            .title(Line::from(Span::styled(title, title_style)));

        let inner = block.inner(area);
        block.render(area, buf);

        if inner.height < 1 {
            return;
        }

        // Render content with word wrap
        let display_content = if self.is_done() {
            &self.content
        } else {
            // Show pending + content up to rendered pos
            &self.pending[..self.render_pos.max(self.content.len())]
        };

        if display_content.is_empty() {
            let cursor = if self.paused { "⏸" } else { "▊" };
            let span = Span::styled(
                cursor,
                Style::default().fg(colors.text_muted).add_modifier(Modifier::SLOW_BLINK),
            );
            let paragraph = Paragraph::new(Line::from(span));
            paragraph.render(inner, buf);
            return;
        }

        // Word-wrap lines
        let width = inner.width as usize;
        let mut lines: Vec<Line> = Vec::new();
        let content_str = display_content;

        // For now, simple wrapping by words
        let mut current_line = String::new();
        for word in content_str.split_inclusive(' ') {
            let word_width = unicode_width::UnicodeWidthStr::width(word);
            let line_width = unicode_width::UnicodeWidthStr::width(&current_line);

            if !current_line.is_empty() && line_width + word_width > width {
                lines.push(Line::from(Span::styled(
                    std::mem::take(&mut current_line),
                    Style::default().fg(colors.text_primary),
                )));
            }
            current_line.push_str(word);
        }
        if !current_line.is_empty() {
            lines.push(Line::from(Span::styled(
                current_line,
                Style::default().fg(colors.text_primary),
            )));
        }

        // Add cursor/blink indicator on last line if still streaming
        if !self.is_done() && !lines.is_empty() {
            let last_idx = lines.len() - 1;
            let mut last_spans = lines[last_idx].spans().to_vec();
            last_spans.push(Span::styled(
                "▊",
                Style::default().fg(colors.cursor).add_modifier(Modifier::SLOW_BLINK),
            ));
            lines[last_idx] = Line::from(last_spans);
        }

        // Add finish reason if done
        if self.is_done() {
            if let Some(ref reason) = self.finish_reason {
                let reason_text = format!("  Finished: {}", reason);
                lines.push(Line::from(Span::styled(
                    reason_text,
                    Style::default().fg(colors.text_muted),
                )));
            }

            if let Some(ref usage) = self.usage {
                let usage_text = format!(
                    " ⚡ {} in / {} out / {} total",
                    usage.prompt_tokens, usage.completion_tokens, usage.total_tokens
                );
                let cost_str = usage.cost.map(|c| format!(" [${:.6}]", c)).unwrap_or_default();
                lines.push(Line::from(Span::styled(
                    format!("{}{}", usage_text, cost_str),
                    Style::default().fg(colors.text_muted),
                )));
            }
        }

        // Render visible portion
        let visible_lines = inner.height as usize;
        let start = lines.len().saturating_sub(visible_lines);
        let visible: Vec<Line> = lines.into_iter().skip(start).take(visible_lines).collect();

        let paragraph = Paragraph::new(Text::from(visible));
        paragraph.render(inner, buf);
    }
}

/// Configuration for the streaming widget's animation.
#[derive(Debug, Clone)]
pub struct StreamingConfig {
    pub chars_per_tick: usize,
    pub tick_ms: u64,
    pub max_width: usize,
    pub smooth_scroll: bool,
}

impl Default for StreamingConfig {
    fn default() -> Self {
        Self {
            chars_per_tick: 3,
            tick_ms: 16,
            max_width: 80,
            smooth_scroll: true,
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
    fn test_streaming_widget_create() {
        let theme = test_theme();
        let sw = StreamingWidget::new(theme);
        assert!(sw.content().is_empty());
        assert!(!sw.is_done());
    }

    #[test]
    fn test_streaming_append() {
        let theme = test_theme();
        let mut sw = StreamingWidget::new(theme);
        sw.append("Hello");
        sw.append(" World");
        assert_eq!(sw.total_content(), "Hello World");
    }

    #[test]
    fn test_streaming_tick() {
        let theme = test_theme();
        let mut sw = StreamingWidget::new(theme);
        sw.chars_per_tick = 10;
        sw.tick_interval = std::time::Duration::from_millis(0); // always ready
        sw.last_tick = std::time::Instant::now()
            .checked_sub(std::time::Duration::from_secs(1))
            .unwrap();

        sw.append("Hello World");
        assert!(sw.tick());
        assert_eq!(sw.content(), "Hello Worl");
        assert!(sw.tick());
        assert_eq!(sw.content(), "Hello World");
        assert!(!sw.tick()); // No more pending
    }

    #[test]
    fn test_streaming_finish() {
        let theme = test_theme();
        let mut sw = StreamingWidget::new(theme);
        sw.append("Done");
        sw.finish("stop", None);
        assert!(sw.is_done());
        assert_eq!(sw.finish_reason(), Some("stop"));
    }

    #[test]
    fn test_streaming_reset() {
        let theme = test_theme();
        let mut sw = StreamingWidget::new(theme);
        sw.append("Some content");
        sw.finish("stop", None);
        assert!(sw.is_done());
        sw.reset();
        assert!(sw.content().is_empty());
        assert!(!sw.is_done());
    }

    #[test]
    fn test_token_display() {
        let theme = test_theme();
        let mut sw = StreamingWidget::new(theme);
        sw.append("test");
        let display = sw.token_display();
        assert!(display.contains("chars"));
    }
}
