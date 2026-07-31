//! Chat message panel that renders conversation history.
//!
//! Displays messages with role-specific styling, code block syntax
//! highlighting, tool call rendering, and streaming message support.

use crate::syntax::{self, CodeHighlighter, HighlightedSegment};
use crate::theme::Theme;
use airis_core::prelude::*;
use ratatui::layout::{Alignment, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, Borders, Clear, List, ListDirection, ListItem, ListState, Padding, Paragraph, Widget, Wrap};
use ratatui::buffer::Buffer;
use std::collections::VecDeque;

/// Maximum number of lines to cache for rendered messages.
const MAX_RENDERED_LINES: usize = 10_000;

/// A rendered message ready for display.
#[derive(Debug, Clone)]
pub struct RenderedMessage {
    pub role: MessageRole,
    pub name: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub lines: Vec<Line<'static>>,
    pub tokens: Option<usize>,
    pub has_tool_calls: bool,
    pub is_streaming: bool,
}

/// Widget for displaying the conversation chat history.
pub struct ChatArea {
    /// The conversation data to render.
    conversation: Option<Conversation>,
    /// Rendered message cache.
    rendered: Vec<RenderedMessage>,
    /// Scroll offset (0 = bottom, latest messages).
    scroll_offset: usize,
    /// Maximum visible lines in the chat area.
    max_visible_lines: usize,
    /// Current streaming message buffer.
    streaming_buffer: Option<String>,
    /// Whether auto-scroll is enabled.
    auto_scroll: bool,
    /// Theme reference.
    theme: Theme,
}

impl ChatArea {
    /// Create a new chat area widget.
    pub fn new(theme: Theme) -> Self {
        Self {
            conversation: None,
            rendered: Vec::new(),
            scroll_offset: 0,
            max_visible_lines: 0,
            streaming_buffer: None,
            auto_scroll: true,
            theme,
        }
    }

    /// Set the conversation to display.
    pub fn set_conversation(&mut self, conversation: Conversation) {
        self.conversation = Some(conversation.clone());
        self.rerender();
    }

    /// Update the conversation (e.g., after new messages).
    pub fn update_conversation(&mut self, conversation: &Conversation) {
        self.conversation = Some(conversation.clone());
        self.rerender();
    }

    /// Begin streaming a new assistant message.
    pub fn start_streaming(&mut self) {
        self.streaming_buffer = Some(String::new());
        if self.auto_scroll {
            self.scroll_offset = 0;
        }
    }

    /// Append a chunk to the streaming message.
    pub fn append_stream_chunk(&mut self, chunk: &str) {
        if let Some(ref mut buffer) = self.streaming_buffer {
            buffer.push_str(chunk);
            // Re-render the streaming message periodically
            if let Some(ref mut conv) = self.conversation {
                if let Some(last) = conv.messages.last() {
                    if last.role == MessageRole::Assistant && last.tokens.is_none() {
                        // Update the last message's text in place
                        let msg_idx = conv.messages.len() - 1;
                        conv.messages[msg_idx].content = vec![
                            ContentPart::Text { text: buffer.clone() }
                        ];
                    }
                }
            }
            // Partial re-render would be nice, but full re-render is simpler
            if self.auto_scroll {
                self.scroll_offset = 0;
            }
        }
    }

    /// Finish streaming a message.
    pub fn finish_streaming(&mut self) {
        if let Some(buffer) = self.streaming_buffer.take() {
            if let Some(ref mut conv) = self.conversation {
                conv.push(Message::assistant(buffer));
            }
            self.rerender();
        }
    }

    /// Scroll up by the given number of lines.
    pub fn scroll_up(&mut self, amount: usize) {
        let max_scroll = self.total_rendered_lines().saturating_sub(self.max_visible_lines);
        self.scroll_offset = (self.scroll_offset + amount).min(max_scroll);
        self.auto_scroll = false;
    }

    /// Scroll down by the given number of lines.
    pub fn scroll_down(&mut self, amount: usize) {
        self.scroll_offset = self.scroll_offset.saturating_sub(amount);
        if self.scroll_offset == 0 {
            self.auto_scroll = true;
        }
    }

    /// Scroll to the top.
    pub fn scroll_to_top(&mut self) {
        let max_scroll = self.total_rendered_lines().saturating_sub(self.max_visible_lines);
        self.scroll_offset = max_scroll;
        self.auto_scroll = false;
    }

    /// Scroll to the bottom.
    pub fn scroll_to_bottom(&mut self) {
        self.scroll_offset = 0;
        self.auto_scroll = true;
    }

    /// Set the maximum visible lines (updated on resize).
    pub fn set_max_visible_lines(&mut self, lines: usize) {
        self.max_visible_lines = lines;
    }

    /// Get the current scroll offset.
    pub fn scroll_offset(&self) -> usize {
        self.scroll_offset
    }

    /// Total number of rendered lines.
    fn total_rendered_lines(&self) -> usize {
        self.rendered.iter().map(|m| m.lines.len()).sum()
    }

    /// Re-render the conversation into cached lines.
    fn rerender(&mut self) {
        self.rendered.clear();
        let conv = match &self.conversation {
            Some(c) => c,
            None => return,
        };

        let colors = &self.theme.colors;

        for msg in &conv.messages {
            let lines = self.render_message(msg, colors);
            self.rendered.push(RenderedMessage {
                role: msg.role.clone(),
                name: msg.name.clone(),
                timestamp: msg.timestamp,
                lines,
                tokens: msg.tokens,
                has_tool_calls: msg.has_tool_calls(),
                is_streaming: false,
            });
        }

        // Add streaming buffer if active
        if let Some(ref buffer) = self.streaming_buffer {
            if !buffer.is_empty() {
                let msg = Message::assistant(buffer.as_str());
                let lines = self.render_message(&msg, colors);
                self.rendered.push(RenderedMessage {
                    role: MessageRole::Assistant,
                    name: None,
                    timestamp: chrono::Utc::now(),
                    lines,
                    tokens: None,
                    has_tool_calls: false,
                    is_streaming: true,
                });
            }
        }
    }

    /// Render a single message into styled lines.
    fn render_message(&self, msg: &Message, colors: &crate::theme::ColorScheme) -> Vec<Line<'static>> {
        let mut result: Vec<Line<'static>> = Vec::new();

        // ── Header line ──
        let role_style = match msg.role {
            MessageRole::User => Style::default().fg(colors.user_fg).bg(colors.user_bg).add_modifier(Modifier::BOLD),
            MessageRole::Assistant => Style::default().fg(colors.assistant_fg).bg(colors.assistant_bg).add_modifier(Modifier::BOLD),
            MessageRole::System => Style::default().fg(colors.system_fg).bg(colors.system_bg).add_modifier(Modifier::BOLD),
            MessageRole::Tool => Style::default().fg(colors.tool_fg).bg(colors.tool_bg).add_modifier(Modifier::BOLD),
        };

        let role_name = match msg.role {
            MessageRole::User => "  You ",
            MessageRole::Assistant => "  Assistant ",
            MessageRole::System => "  System ",
            MessageRole::Tool => "  Tool ",
        };

        let timestamp_str = msg.timestamp.format("%H:%M:%S").to_string();
        let header = format!("{} {} ", role_name, timestamp_str);
        let header_spans: Vec<Span> = vec![
            Span::styled(header, role_style),
        ];
        result.push(Line::from(header_spans));

        // ── Content parts ──
        for part in &msg.content {
            match part {
                ContentPart::Text { text } => {
                    let text_lines = self.render_text_content(text, colors);
                    result.extend(text_lines);
                }
                ContentPart::ToolCall { id, name, arguments } => {
                    result.push(Line::from(Span::styled(
                        format!("   Call {}: {}(", id, name),
                        Style::default().fg(colors.tool_fg).add_modifier(Modifier::ITALIC),
                    )));
                    let args_str = serde_json::to_string_pretty(arguments)
                        .unwrap_or_else(|_| arguments.to_string());
                    for line in args_str.lines() {
                        result.push(Line::from(Span::styled(
                            format!("    {}", line),
                            Style::default().fg(colors.text_secondary),
                        )));
                    }
                    result.push(Line::from(Span::styled(
                        "  )",
                        Style::default().fg(colors.tool_fg).add_modifier(Modifier::ITALIC),
                    )));
                }
                ContentPart::ToolResult { id, content } => {
                    result.push(Line::from(Span::styled(
                        format!("   Result {}:", id),
                        Style::default().fg(colors.tool_fg),
                    )));
                    // Render limited content to avoid flooding
                    let preview = if content.len() > 500 {
                        format!("{}...", &content[..500])
                    } else {
                        content.clone()
                    };
                    for line in preview.lines() {
                        result.push(Line::from(Span::styled(
                            format!("    {}", line),
                            Style::default().fg(colors.text_secondary),
                        )));
                    }
                }
                ContentPart::Image { url, detail } => {
                    let detail_str = detail.as_deref().unwrap_or("");
                    result.push(Line::from(Span::styled(
                        format!("   [Image: {} {}]", url, detail_str),
                        Style::default().fg(colors.info),
                    )));
                }
            }
        }

        // ── Token count line (optional) ──
        if let Some(tokens) = msg.tokens {
            result.push(Line::from(Span::styled(
                format!("  ⚡ {} tokens", tokens),
                Style::default().fg(colors.text_muted),
            )));
        }

        // ── Separator ──
        result.push(Line::from(Span::styled(
            "─".repeat(colors.name.len().min(40)),
            Style::default().fg(colors.divider),
        )));

        result
    }

    /// Render text content with code block detection and syntax highlighting.
    fn render_text_content(&self, text: &str, colors: &crate::theme::ColorScheme) -> Vec<Line<'static>> {
        let mut result: Vec<Line<'static>> = Vec::new();
        let mut in_code_block = false;
        let mut code_language = String::new();
        let mut code_lines: Vec<String> = Vec::new();

        for line in text.lines() {
            if line.trim_start().starts_with("```") {
                if in_code_block {
                    // End code block - render it
                    let highlighted = self.highlight_code(&code_lines.join("\n"), &code_language);
                    result.extend(highlighted);
                    code_lines.clear();
                    in_code_block = false;
                    code_language.clear();
                } else {
                    // Start code block
                    in_code_block = true;
                    code_language = syntax::detect_language(&line[3..]).to_string();
                }
                continue;
            }

            if in_code_block {
                code_lines.push(line.to_string());
                continue;
            }

            // Inline code rendering
            let rendered_line = self.render_inline_line(line, colors);
            result.push(rendered_line);
        }

        // Handle unclosed code block
        if in_code_block && !code_lines.is_empty() {
            let highlighted = self.highlight_code(&code_lines.join("\n"), &code_language);
            result.extend(highlighted);
        }

        result
    }

    /// Render a line with inline code highlighting.
    fn render_inline_line(&self, line: &str, colors: &crate::theme::ColorScheme) -> Line<'static> {
        if !line.contains('`') {
            return Line::from(Span::styled(line.to_string(), Style::default().fg(colors.text_primary)));
        }

        let mut spans = Vec::new();
        let mut in_code = false;
        let mut current = String::new();

        for ch in line.chars() {
            if ch == '`' {
                if in_code {
                    // End inline code
                    let code_span = Span::styled(
                        current.clone(),
                        Style::default()
                            .fg(colors.code_fg)
                            .bg(colors.inline_code_bg),
                    );
                    spans.push(code_span);
                    current.clear();
                    in_code = false;
                } else {
                    // Start inline code - flush any text before
                    if !current.is_empty() {
                        spans.push(Span::styled(
                            current.clone(),
                            Style::default().fg(colors.text_primary),
                        ));
                        current.clear();
                    }
                    in_code = true;
                }
                continue;
            }
            current.push(ch);
        }

        // Handle remaining text
        if in_code {
            spans.push(Span::styled(
                current,
                Style::default()
                    .fg(colors.code_fg)
                    .bg(colors.inline_code_bg),
            ));
        } else if !current.is_empty() {
            spans.push(Span::styled(current, Style::default().fg(colors.text_primary)));
        }

        Line::from(spans)
    }

    /// Highlight a code block using syntect.
    fn highlight_code(&self, code: &str, language: &str) -> Vec<Line<'static>> {
        let mut result = Vec::new();
        let colors = &self.theme.colors;

        // Language label
        let lang_label = if language.is_empty() { "code" } else { language };
        result.push(Line::from(Span::styled(
            format!(" ┌─ {} ", lang_label),
            Style::default().fg(colors.text_muted),
        )));

        // Highlighted code
        let syntect_theme = self.theme.syntect.clone();
        let highlighted = syntax::highlight_code_block(code, language, &syntect_theme);

        for line_segments in &highlighted {
            let spans: Vec<Span> = line_segments
                .iter()
                .map(|seg| Span::styled(seg.text.clone(), seg.style))
                .collect();
            // Wrap in code block
            let mut line_spans = vec![
                Span::styled(" │ ", Style::default().fg(colors.text_muted)),
            ];
            line_spans.extend(spans);
            result.push(Line::from(line_spans));
        }

        // Closing border
        result.push(Line::from(Span::styled(
            " └─",
            Style::default().fg(colors.text_muted),
        )));

        result
    }
}

impl Widget for &mut ChatArea {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 5 || area.height < 3 {
            return;
        }

        // Re-render if needed
        self.rerender();

        let colors = &self.theme.colors;

        // Calculate visible lines
        let visible_height = area.height as usize;
        self.max_visible_lines = visible_height;

        // Collect all rendered lines with their message indices for scrolling
        let all_lines: Vec<&Line<'static>> = self.rendered.iter().flat_map(|m| m.lines.iter()).collect();
        let total = all_lines.len();

        if total == 0 {
            // Empty state
            let empty_text = Paragraph::new(Line::from(Span::styled(
                "  No messages yet. Start a conversation!",
                Style::default().fg(colors.text_muted),
            )));
            empty_text.render(area, buf);
            return;
        }

        // Calculate scroll range
        let start_line = total.saturating_sub(visible_height).saturating_sub(self.scroll_offset);
        let end_line = (start_line + visible_height).min(total);

        // Draw scroll indicator if content is truncated
        if self.scroll_offset > 0 || start_line > 0 {
            let scroll_pct = if total > visible_height {
                ((total - start_line) as f64 / total as f64 * 100.0) as u16
            } else {
                100
            };
            let indicator = format!(" ↑ {}% ", scroll_pct);
            let indicator_span = Span::styled(
                indicator,
                Style::default().fg(colors.text_muted).bg(colors.surface),
            );
            let indicator_w = indicator.len() as u16;
            if indicator_w < area.width {
                buf.set_span(
                    area.x + area.width - indicator_w,
                    area.y,
                    &indicator_span,
                    indicator_w,
                );
            }
        }

        // Render visible lines
        let mut y = area.y;
        for line_idx in start_line..end_line {
            if y >= area.y + area.height {
                break;
            }
            if let Some(line) = all_lines.get(line_idx) {
                let line_area = Rect::new(area.x, y, area.width, 1);
                let paragraph = Paragraph::new(line.clone());
                paragraph.render(line_area, buf);
            }
            y += 1;
        }
    }
}

/// Tool call widget to display tool calls inline.
pub struct ToolCallWidget {
    pub tool_name: String,
    pub call_id: String,
    pub status: ToolCallStatus,
    pub arguments: serde_json::Value,
    pub result: Option<ToolResult>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolCallStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

impl ToolCallWidget {
    pub fn render(&self, area: Rect, buf: &mut Buffer, colors: &crate::theme::ColorScheme) {
        let icon = match self.status {
            ToolCallStatus::Pending => "",
            ToolCallStatus::Running => "",
            ToolCallStatus::Completed => "",
            ToolCallStatus::Failed => "",
        };

        let status_str = match self.status {
            ToolCallStatus::Pending => "pending",
            ToolCallStatus::Running => "running",
            ToolCallStatus::Completed => "completed",
            ToolCallStatus::Failed => "failed",
        };

        let color = match self.status {
            ToolCallStatus::Pending | ToolCallStatus::Running => colors.info,
            ToolCallStatus::Completed => colors.success,
            ToolCallStatus::Failed => colors.error,
        };

        let text = format!(" {} {} ({})", icon, self.tool_name, status_str);
        let span = Span::styled(text, Style::default().fg(color));
        Paragraph::new(Line::from(span)).render(area, buf);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_theme() -> Theme {
        Theme::named("kageos-dark")
    }

    #[test]
    fn test_chat_area_empty() {
        let theme = test_theme();
        let mut chat = ChatArea::new(theme);
        assert!(chat.rendered.is_empty());
        assert_eq!(chat.scroll_offset, 0);
        assert!(chat.auto_scroll);
    }

    #[test]
    fn test_chat_area_with_messages() {
        let theme = test_theme();
        let mut conv = Conversation::new();
        conv.push(Message::user("Hello!"));
        conv.push(Message::assistant("Hi there!"));

        let mut chat = ChatArea::new(theme);
        chat.set_conversation(conv.clone());
        assert!(!chat.rendered.is_empty());
        assert_eq!(chat.rendered.len(), 2);
    }

    #[test]
    fn test_streaming() {
        let theme = test_theme();
        let mut conv = Conversation::new();
        conv.push(Message::user("Write code"));
        let mut chat = ChatArea::new(theme);
        chat.set_conversation(conv);
        chat.start_streaming();
        chat.append_stream_chunk("Here");
        chat.append_stream_chunk(" is");
        chat.append_stream_chunk(" code");
        chat.finish_streaming();
        // After finish, we should have the original + the final message
        assert_eq!(chat.rendered.len(), 2);
    }

    #[test]
    fn test_scroll() {
        let theme = test_theme();
        let mut conv = Conversation::new();
        for i in 0..50 {
            conv.push(Message::user(format!("Message {}", i)));
        }
        let mut chat = ChatArea::new(theme);
        chat.max_visible_lines = 10;
        chat.set_conversation(conv);
        chat.scroll_up(20);
        assert!(chat.scroll_offset > 0);
        assert!(!chat.auto_scroll);
        chat.scroll_to_bottom();
        assert_eq!(chat.scroll_offset, 0);
        assert!(chat.auto_scroll);
    }
}
