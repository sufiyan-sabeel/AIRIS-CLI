//! Split panel layout for the TUI.
//!
//! Provides a resizable split layout with three panels:
//! - Conversation (main chat area, left)
//! - Tools (right-top)
//! - Files (right-bottom)
//!
//! Supports drag-resizing, focus tracking, and collapse/expand.

use crate::theme::Theme;
use airis_core::prelude::*;
use ratatui::layout::{Constraint, Direction, Layout, Margin, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph, Widget, Wrap};
use ratatui::buffer::Buffer;

/// Identifies a panel in the layout.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PanelId {
    Conversation,
    Tools,
    Files,
}

/// Visibility state of the side panels.
#[derive(Debug, Clone)]
pub struct SidePanelVisibility {
    pub tools: bool,
    pub files: bool,
}

impl Default for SidePanelVisibility {
    fn default() -> Self {
        Self {
            tools: true,
            files: false,
        }
    }
}

/// The split panel layout manager.
#[derive(Debug, Clone)]
pub struct SplitLayout {
    /// Whether to show the right-hand panels.
    pub side_visible: SidePanelVisibility,
    /// Width of the side panel area (percentage of total width).
    pub side_width_pct: u16,
    /// Height split between tools and files (percentage of side height for tools).
    pub tools_height_pct: u16,
    /// Currently focused panel.
    pub focus: PanelId,
    /// Whether the divider is being dragged.
    pub dragging: Option<Direction>,
    /// Last known area.
    last_area: Option<Rect>,
}

impl Default for SplitLayout {
    fn default() -> Self {
        Self::new()
    }
}

impl SplitLayout {
    /// Create a new split layout.
    pub fn new() -> Self {
        Self {
            side_visible: SidePanelVisibility::default(),
            side_width_pct: 30,
            tools_height_pct: 50,
            focus: PanelId::Conversation,
            dragging: None,
            last_area: None,
        }
    }

    /// Get the rects for each visible panel.
    pub fn split(&mut self, area: Rect) -> PanelRects {
        self.last_area = Some(area);

        let has_side = self.side_visible.tools || self.side_visible.files;

        if !has_side {
            return PanelRects {
                conversation: area,
                tools: Rect::default(),
                tools_divider: Rect::default(),
                files: Rect::default(),
                files_divider: Rect::default(),
                side: Rect::default(),
            };
        }

        // Main horizontal split
        let side_width = (area.width * self.side_width_pct / 100).max(30).min(area.width / 2);
        let main_width = area.width.saturating_sub(side_width);

        let main_area = Rect::new(area.x, area.y, main_width, area.height);
        let divider_x = area.x + main_width;
        let side_area = Rect::new(divider_x + 1, area.y, side_width.saturating_sub(1), area.height);
        let divider_area = Rect::new(divider_x, area.y, 1, area.height);

        // Vertical split of side area
        let (tools_area, files_area) = if self.side_visible.tools && self.side_visible.files {
            let tools_height = (side_area.height * self.tools_height_pct / 100).max(3);
            let files_height = side_area.height.saturating_sub(tools_height + 1);
            let divider_y = side_area.y + tools_height;

            let t_area = Rect::new(side_area.x, side_area.y, side_area.width, tools_height);
            let f_area = Rect::new(side_area.x, divider_y + 1, side_area.width, files_height);
            let f_divider = Rect::new(side_area.x, divider_y, side_area.width, 1);

            (t_area, f_area)
        } else if self.side_visible.tools {
            (side_area, Rect::default())
        } else {
            (Rect::default(), side_area)
        };

        PanelRects {
            conversation: main_area,
            tools: tools_area,
            tools_divider: divider_area,
            files: files_area,
            files_divider: if self.side_visible.tools && self.side_visible.files {
                Rect::new(side_area.x, side_area.y + tools_area.height, side_area.width, 1)
            } else {
                Rect::default()
            },
            side: side_area,
        }
    }

    /// Toggle visibility of the tools panel.
    pub fn toggle_tools(&mut self) {
        self.side_visible.tools = !self.side_visible.tools;
        if !self.side_visible.tools && !self.side_visible.files {
            self.focus = PanelId::Conversation;
        } else if self.focus == PanelId::Conversation {
            self.focus = if self.side_visible.tools { PanelId::Tools } else { PanelId::Files };
        }
    }

    /// Toggle visibility of the files panel.
    pub fn toggle_files(&mut self) {
        self.side_visible.files = !self.side_visible.files;
        if !self.side_visible.tools && !self.side_visible.files {
            self.focus = PanelId::Conversation;
        } else if self.focus == PanelId::Conversation {
            self.focus = if self.side_visible.tools { PanelId::Tools } else { PanelId::Files };
        }
    }

    /// Focus the next panel in the cycle.
    pub fn focus_next(&mut self) {
        self.focus = match self.focus {
            PanelId::Conversation => {
                if self.side_visible.tools {
                    PanelId::Tools
                } else if self.side_visible.files {
                    PanelId::Files
                } else {
                    PanelId::Conversation
                }
            }
            PanelId::Tools => {
                if self.side_visible.files {
                    PanelId::Files
                } else {
                    PanelId::Conversation
                }
            }
            PanelId::Files => PanelId::Conversation,
        }
    }

    /// Focus the previous panel in the cycle.
    pub fn focus_prev(&mut self) {
        self.focus = match self.focus {
            PanelId::Conversation => {
                if self.side_visible.files {
                    PanelId::Files
                } else if self.side_visible.tools {
                    PanelId::Tools
                } else {
                    PanelId::Conversation
                }
            }
            PanelId::Tools => PanelId::Conversation,
            PanelId::Files => {
                if self.side_visible.tools {
                    PanelId::Tools
                } else {
                    PanelId::Conversation
                }
            }
        }
    }

    /// Set focus to a specific panel.
    pub fn set_focus(&mut self, panel: PanelId) {
        self.focus = panel;
    }

    /// Resize the side panel width.
    pub fn resize_side(&mut self, delta: i16) {
        let new_pct = self.side_width_pct as i16 + delta;
        self.side_width_pct = new_pct.clamp(15, 60) as u16;
    }

    /// Resize the tools/files split.
    pub fn resize_tools_split(&mut self, delta: i16) {
        let new_pct = self.tools_height_pct as i16 + delta;
        self.tools_height_pct = new_pct.clamp(20, 80) as u16;
    }

    /// Check if a point falls on a divider.
    pub fn hit_divider(&self, x: u16, y: u16, rects: &PanelRects) -> Option<Direction> {
        if rects.tools_divider.width > 0 && rects.tools_divider.contains_point((x, y)) {
            Some(Direction::Horizontal)
        } else if rects.files_divider.width > 0 && rects.files_divider.contains_point((x, y)) {
            Some(Direction::Vertical)
        } else {
            None
        }
    }

    /// Get divider areas for rendering.
    pub fn dividers(&self, rects: &PanelRects) -> Vec<Rect> {
        let mut divs = Vec::new();
        if rects.tools_divider.width > 0 {
            divs.push(rects.tools_divider);
        }
        if rects.files_divider.height > 0 {
            divs.push(rects.files_divider);
        }
        divs
    }
}

/// Computed panel rectangles.
#[derive(Debug, Clone, Copy)]
pub struct PanelRects {
    pub conversation: Rect,
    pub tools: Rect,
    pub tools_divider: Rect,
    pub files: Rect,
    pub files_divider: Rect,
    pub side: Rect,
}

/// Render the dividers between panels.
pub fn render_dividers(
    rects: &PanelRects,
    buf: &mut Buffer,
    colors: &crate::theme::ColorScheme,
    focus: PanelId,
) {
    // Main horizontal divider
    if rects.tools_divider.width > 0 {
        let style = if focus == PanelId::Tools || focus == PanelId::Files {
            Style::default().fg(colors.panel_focused_border)
        } else {
            Style::default().fg(colors.divider)
        };

        for y in rects.tools_divider.top()..rects.tools_divider.bottom() {
            let span = Span::styled("▕", style);
            buf.set_span(
                rects.tools_divider.x,
                y,
                &span,
                1,
            );
        }
    }

    // Vertical divider between tools and files
    if rects.files_divider.height > 0 {
        let style = match focus {
            PanelId::Tools => Style::default().fg(colors.panel_focused_border),
            PanelId::Files => Style::default().fg(colors.panel_focused_border),
            _ => Style::default().fg(colors.divider),
        };

        for x in rects.files_divider.left()..rects.files_divider.right() {
            let span = Span::styled("─", style);
            buf.set_span(
                x,
                rects.files_divider.y,
                &span,
                1,
            );
        }

        // Corner
        let corner_span = Span::styled("┼", style);
        buf.set_span(
            rects.files_divider.x,
            rects.files_divider.y,
            &corner_span,
            1,
        );
    }
}

/// Render the tools panel content.
pub fn render_tools_panel(
    area: Rect,
    buf: &mut Buffer,
    colors: &crate::theme::ColorScheme,
    focused: bool,
    tools: &[ToolDefinition],
    active_tool: Option<&str>,
) {
    if area.width < 5 || area.height < 3 {
        return;
    }

    let border_style = if focused {
        Style::default().fg(colors.panel_focused_border)
    } else {
        Style::default().fg(colors.panel_border)
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style)
        .title("  Tools ")
        .title_style(Style::default().fg(colors.text_secondary));

    let inner = block.inner(area);
    block.render(area, buf);

    if inner.height < 1 {
        return;
    }

    if tools.is_empty() {
        let empty = Paragraph::new(Line::from(Span::styled(
            "  No tools available",
            Style::default().fg(colors.text_muted),
        )));
        empty.render(inner, buf);
        return;
    }

    let max_items = inner.height as usize;
    let items: Vec<ListItem> = tools
        .iter()
        .take(max_items)
        .map(|tool| {
            let is_active = active_tool == Some(&tool.name);
            let icon = if is_active { "" } else { "" };
            let fg = if is_active { colors.success } else { colors.text_primary };
            let span = Span::styled(
                format!(" {} {}", icon, tool.name),
                Style::default().fg(fg),
            );
            ListItem::new(Line::from(span))
        })
        .collect();

    let list = List::new(items);
    list.render(inner, buf);
}

/// Render the files panel content.
pub fn render_files_panel(
    area: Rect,
    buf: &mut Buffer,
    colors: &crate::theme::ColorScheme,
    focused: bool,
    files: &[crate::panel::FileEntry],
) {
    if area.width < 5 || area.height < 3 {
        return;
    }

    let border_style = if focused {
        Style::default().fg(colors.panel_focused_border)
    } else {
        Style::default().fg(colors.panel_border)
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style)
        .title("  Files ")
        .title_style(Style::default().fg(colors.text_secondary));

    let inner = block.inner(area);
    block.render(area, buf);

    if inner.height < 1 {
        return;
    }

    if files.is_empty() {
        let empty = Paragraph::new(Line::from(Span::styled(
            "  No files loaded",
            Style::default().fg(colors.text_muted),
        )));
        empty.render(inner, buf);
        return;
    }

    let max_items = inner.height as usize;
    let items: Vec<ListItem> = files
        .iter()
        .take(max_items)
        .map(|entry| {
            let icon = match entry.extension.as_deref() {
                Some("rs") => " ",
                Some("py") => " ",
                Some("js") | Some("ts") => " ",
                Some("md") => " ",
                Some("toml") => " ",
                Some("json") => " ",
                Some("yml") | Some("yaml") => "料 ",
                Some("html") => " ",
                Some("css") => " ",
                Some("sh") => " ",
                _ => " ",
            };
            let span = Span::styled(
                format!(" {}{}", icon, entry.name),
                Style::default().fg(colors.text_primary),
            );
            ListItem::new(Line::from(span))
        })
        .collect();

    let list = List::new(items);
    list.render(inner, buf);
}

/// A simple file entry for display in the files panel.
#[derive(Debug, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: std::path::PathBuf,
    pub extension: Option<String>,
    pub size: u64,
    pub is_dir: bool,
}

/// Wrapper for List widget (used internally).
struct ListItem {
    content: Line<'static>,
}

impl ListItem {
    fn new(content: Line<'static>) -> Self {
        Self { content }
    }
}

impl Widget for ListItem {
    fn render(self, area: Rect, buf: &mut Buffer) {
        Paragraph::new(self.content).render(area, buf);
    }
}

struct List {
    items: Vec<ListItem>,
}

impl List {
    fn new(items: Vec<ListItem>) -> Self {
        Self { items }
    }
}

impl Widget for List {
    fn render(self, area: Rect, buf: &mut Buffer) {
        for (i, item) in self.items.into_iter().enumerate() {
            let y = area.y + i as u16;
            if y >= area.bottom() {
                break;
            }
            let item_area = Rect::new(area.x, y, area.width, 1);
            item.render(item_area, buf);
        }
    }
}

// Extension to check if a point is within a rect
trait RectExt {
    fn contains_point(&self, (x, y): (u16, u16)) -> bool;
}

impl RectExt for Rect {
    fn contains_point(&self, (x, y): (u16, u16)) -> bool {
        x >= self.x
            && x < self.x + self.width
            && y >= self.y
            && y < self.y + self.height
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_layout_default() {
        let layout = SplitLayout::new();
        assert_eq!(layout.focus, PanelId::Conversation);
        assert!(layout.side_visible.tools);
        assert!(!layout.side_visible.files);
    }

    #[test]
    fn test_split_with_no_side() {
        let mut layout = SplitLayout::new();
        layout.side_visible.tools = false;
        layout.side_visible.files = false;
        let area = Rect::new(0, 0, 100, 50);
        let rects = layout.split(area);
        assert_eq!(rects.conversation, area);
        assert_eq!(rects.tools, Rect::default());
        assert_eq!(rects.files, Rect::default());
    }

    #[test]
    fn test_split_with_tools() {
        let mut layout = SplitLayout::new();
        layout.side_width_pct = 30;
        let area = Rect::new(0, 0, 100, 50);
        let rects = layout.split(area);
        assert_eq!(rects.conversation.width, 70);
        assert_eq!(rects.tools.width, 29);
        assert!(rects.conversation.width > 0);
        assert!(rects.tools.width > 0);
    }

    #[test]
    fn test_focus_cycle() {
        let mut layout = SplitLayout::new();
        assert_eq!(layout.focus, PanelId::Conversation);
        layout.focus_next();
        assert_eq!(layout.focus, PanelId::Tools);
        layout.focus_next();
        assert_eq!(layout.focus, PanelId::Conversation);
    }

    #[test]
    fn test_toggle_tools() {
        let mut layout = SplitLayout::new();
        assert!(layout.side_visible.tools);
        layout.toggle_tools();
        assert!(!layout.side_visible.tools);
    }

    #[test]
    fn test_toggle_files() {
        let mut layout = SplitLayout::new();
        assert!(!layout.side_visible.files);
        layout.toggle_files();
        assert!(layout.side_visible.files);
    }

    #[test]
    fn test_resize_side() {
        let mut layout = SplitLayout::new();
        let original = layout.side_width_pct;
        layout.resize_side(5);
        assert_eq!(layout.side_width_pct, original + 5);
        layout.resize_side(-10);
        assert_eq!(layout.side_width_pct, original - 5);
    }

    #[test]
    fn test_divider_hit() {
        let mut layout = SplitLayout::new();
        let area = Rect::new(0, 0, 100, 50);
        let rects = layout.split(area);
        let hit = layout.hit_divider(70, 10, &rects);
        assert!(hit.is_some());
    }
}
