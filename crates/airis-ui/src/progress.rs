//! Progress indicators for the TUI.
//!
//! Provides a spinner, progress bar, and status display widgets that
//! integrate with the streaming and tool execution systems.

use crate::theme::Theme;
use ratatui::layout::{Alignment, Rect};
use ratatui::style::{Color, Style, Stylize};
use ratatui::symbols;
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{
    Block, Borders, Gauge, Paragraph, RenderDirection, Widget,
};
use std::time::Instant;

/// Spinner frame cycle for "classic" style.
const SPINNER_CLASSIC: &[char] = &['|', '/', '-', '\\'];
/// Spinner frames for "dots" style.
const SPINNER_DOTS: &[char] = &['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
/// Spinner frames for "arrows" style.
const SPINNER_ARROWS: &[char] = &['▹▹▹▹▹', '▸▹▹▹▹', '▹▸▹▹▹', '▹▹▸▹▹', '▹▹▹▸▹', '▹▹▹▹▸'];
/// Spinner frames for "pulse" style.
const SPINNER_PULSE: &[char] = &['█', '▓', '▒', '░', '▒', '▓'];

/// Available spinner styles.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpinnerStyle {
    Classic,
    Dots,
    Arrows,
    Pulse,
}

impl SpinnerStyle {
    fn frames(&self) -> &'static [char] {
        match self {
            Self::Classic => SPINNER_CLASSIC,
            Self::Dots => SPINNER_DOTS,
            Self::Arrows => &['▹', '▸', '▹', '▹', '▹', '▸'],
            Self::Pulse => SPINNER_PULSE,
        }
    }
}

impl Default for SpinnerStyle {
    fn default() -> Self {
        Self::Dots
    }
}

/// A progress tracker for a single operation.
#[derive(Debug, Clone)]
pub struct ProgressState {
    /// Current step description.
    pub step: String,
    /// Progress value between 0.0 and 1.0.
    pub progress: f64,
    /// Whether this is indeterminate (spinner only).
    pub indeterminate: bool,
    /// Optional sub-step label.
    pub substep: Option<String>,
    /// Elapsed time tracking.
    started_at: Instant,
}

impl ProgressState {
    pub fn new(step: impl Into<String>) -> Self {
        Self {
            step: step.into(),
            progress: 0.0,
            indeterminate: true,
            substep: None,
            started_at: Instant::now(),
        }
    }

    pub fn with_progress(step: impl Into<String>, progress: f64) -> Self {
        Self {
            step: step.into(),
            progress,
            indeterminate: false,
            substep: None,
            started_at: Instant::now(),
        }
    }

    pub fn elapsed_secs(&self) -> f64 {
        self.started_at.elapsed().as_secs_f64()
    }

    pub fn elapsed_formatted(&self) -> String {
        let secs = self.elapsed_secs();
        if secs < 60.0 {
            format!("{:.1}s", secs)
        } else {
            let m = secs as u64 / 60;
            let s = secs as u64 % 60;
            format!("{}m {:02}s", m, s)
        }
    }

    pub fn update(&mut self, step: impl Into<String>, progress: f64) {
        self.step = step.into();
        self.progress = progress;
        self.indeterminate = false;
    }

    pub fn set_substep(&mut self, substep: Option<String>) {
        self.substep = substep;
    }
}

/// A progress widget that shows a spinner or progress bar.
pub struct ProgressWidget {
    state: ProgressState,
    spinner_style: SpinnerStyle,
    frame: usize,
    width: u16,
}

impl ProgressWidget {
    pub fn new(state: ProgressState) -> Self {
        Self {
            state,
            spinner_style: SpinnerStyle::default(),
            frame: 0,
            width: 40,
        }
    }

    pub fn with_spinner_style(mut self, style: SpinnerStyle) -> Self {
        self.spinner_style = style;
        self
    }

    pub fn with_width(mut self, width: u16) -> Self {
        self.width = width;
        self
    }

    pub fn advance_frame(&mut self) {
        self.frame = self.frame.wrapping_add(1);
    }

    pub fn update(&mut self, state: ProgressState) {
        self.state = state;
        self.advance_frame();
    }
}

impl Widget for &ProgressWidget {
    fn render(self, area: Rect, buf: &mut ratatui::buffer::Buffer) {
        if area.height < 1 {
            return;
        }

        let theme = Theme::named("kageos-dark"); // Placeholder; caller should pass
        let colors = &theme.colors;

        if self.state.indeterminate {
            self.render_spinner(area, buf, colors);
        } else {
            self.render_progress_bar(area, buf, colors);
        }
    }
}

impl ProgressWidget {
    fn render_spinner(
        &self,
        area: Rect,
        buf: &mut ratatui::buffer::Buffer,
        colors: &crate::theme::ColorScheme,
    ) {
        let frames = self.spinner_style.frames();
        let spinner_char = frames[self.frame % frames.len()];

        let elapsed = self.state.elapsed_formatted();
        let text = format!(" {} {}  {}", spinner_char, self.state.step, elapsed);

        let style = Style::default().fg(colors.info);
        let line = Line::from(Span::styled(text, style));
        let paragraph = Paragraph::new(line);
        paragraph.render(area, buf);
    }

    fn render_progress_bar(
        &self,
        area: Rect,
        buf: &mut ratatui::buffer::Buffer,
        colors: &crate::theme::ColorScheme,
    ) {
        let progress = self.state.progress.clamp(0.0, 1.0);
        let percent = (progress * 100.0) as u16;

        let label = format!("{} {:.1}% {}",
            self.state.step, progress * 100.0, self.state.elapsed_formatted());

        let gauge = Gauge::default()
            .block(Block::default()
                .borders(Borders::NONE))
            .gauge_style(
                Style::default()
                    .fg(colors.progress_filled)
                    .bg(colors.progress_unfilled),
            )
            .ratio(progress as f64)
            .label(label);

        gauge.render(area, buf);
    }
}

/// Multi-progress tracker that manages several concurrent progress states.
#[derive(Default)]
pub struct MultiProgress {
    tasks: Vec<ProgressState>,
}

impl MultiProgress {
    pub fn new() -> Self {
        Self { tasks: Vec::new() }
    }

    pub fn add(&mut self, state: ProgressState) -> usize {
        let id = self.tasks.len();
        self.tasks.push(state);
        id
    }

    pub fn update(&mut self, id: usize, state: ProgressState) {
        if id < self.tasks.len() {
            self.tasks[id] = state;
        }
    }

    pub fn remove(&mut self, id: usize) {
        if id < self.tasks.len() {
            self.tasks.remove(id);
        }
    }

    pub fn len(&self) -> usize {
        self.tasks.len()
    }

    pub fn is_empty(&self) -> bool {
        self.tasks.is_empty()
    }

    pub fn iter(&self) -> impl Iterator<Item = &ProgressState> {
        self.tasks.iter()
    }
}

/// Render multiple progress states stacked vertically.
pub fn render_multi_progress(
    tasks: &MultiProgress,
    area: Rect,
    buf: &mut ratatui::buffer::Buffer,
    colors: &crate::theme::ColorScheme,
) {
    let height = area.height as usize;
    let count = tasks.len().min(height);

    for (i, state) in tasks.iter().take(count).enumerate() {
        let line_area = Rect::new(area.x, area.y + i as u16, area.width, 1);
        if state.indeterminate {
            let frames = SPINNER_DOTS;
            let spinner_char = frames[i % frames.len()];
            let text = format!(" {} {}", spinner_char, state.step);
            let span = Span::styled(text, Style::default().fg(colors.info));
            let paragraph = Paragraph::new(Line::from(span));
            paragraph.render(line_area, buf);
        } else {
            let progress = state.progress.clamp(0.0, 1.0);
            let label = format!("{} {:.0}%", state.step, progress * 100.0);
            let gauge = Gauge::default()
                .gauge_style(
                    Style::default()
                        .fg(colors.progress_filled)
                        .bg(colors.progress_unfilled),
                )
                .ratio(progress)
                .label(label);
            gauge.render(line_area, buf);
        }
    }
}

/// A simple status bar component for the bottom of the screen.
pub struct StatusBar {
    pub left_text: String,
    pub center_text: String,
    pub right_text: String,
    pub mode: StatusMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatusMode {
    Normal,
    Insert,
    Command,
    Visual,
    Streaming,
    Processing,
}

impl StatusBar {
    pub fn new() -> Self {
        Self {
            left_text: String::new(),
            center_text: String::new(),
            right_text: String::new(),
            mode: StatusMode::Normal,
        }
    }

    pub fn render(&self, area: Rect, buf: &mut ratatui::buffer::Buffer, colors: &crate::theme::ColorScheme) {
        if area.width < 3 {
            return;
        }

        let mode_str = match self.mode {
            StatusMode::Normal => " NORMAL ",
            StatusMode::Insert => " INSERT ",
            StatusMode::Command => " COMMAND ",
            StatusMode::Visual => " VISUAL ",
            StatusMode::Streaming => " STREAMING ",
            StatusMode::Processing => " PROCESSING ",
        };

        let mode_style = match self.mode {
            StatusMode::Normal => Style::default().fg(colors.background).bg(colors.primary),
            StatusMode::Insert => Style::default().fg(colors.background).bg(colors.success),
            StatusMode::Command => Style::default().fg(colors.background).bg(colors.accent),
            StatusMode::Visual => Style::default().fg(colors.background).bg(colors.secondary),
            StatusMode::Streaming => Style::default().fg(colors.background).bg(colors.info),
            StatusMode::Processing => Style::default().fg(colors.background).bg(colors.warning),
        };

        let mode_span = Span::styled(mode_str, mode_style);

        let left = Span::styled(
            truncate(&self.left_text, area.width as usize / 3),
            Style::default().fg(colors.text_secondary),
        );

        let right = Span::styled(
            truncate(&self.right_text, area.width as usize / 3),
            Style::default().fg(colors.text_muted),
        );

        let mid_fill = " ".repeat(
            (area.width as usize)
                .saturating_sub(mode_str.len())
                .saturating_sub(self.left_text.len().min(area.width as usize / 3))
                .saturating_sub(self.right_text.len().min(area.width as usize / 3))
        );

        let line = Line::from(vec![left, mode_span, Span::raw(mid_fill), right]);
        let bg = Style::default().bg(colors.surface_alt);

        Paragraph::new(line)
            .style(bg)
            .render(area, buf);
    }
}

fn truncate(s: &str, max: usize) -> String {
    if unicode_width::UnicodeWidthStr::width(s) <= max {
        s.to_string()
    } else {
        let mut out = String::new();
        let mut w = 0;
        for c in s.chars() {
            let cw = unicode_width::UnicodeWidthChar::width(c).unwrap_or(0);
            if w + cw > max.saturating_sub(1) {
                out.push('…');
                break;
            }
            w += cw;
            out.push(c);
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_progress_state() {
        let state = ProgressState::new("Testing");
        assert_eq!(state.step, "Testing");
        assert!(state.indeterminate);
        assert!(state.elapsed_secs() < 1.0);
    }

    #[test]
    fn test_progress_state_update() {
        let mut state = ProgressState::new("Start");
        state.update("Halfway", 0.5);
        assert_eq!(state.step, "Halfway");
        assert!((state.progress - 0.5).abs() < 0.001);
        assert!(!state.indeterminate);
    }

    #[test]
    fn test_multi_progress() {
        let mut mp = MultiProgress::new();
        let id1 = mp.add(ProgressState::new("Task 1"));
        let id2 = mp.add(ProgressState::new("Task 2"));
        assert_eq!(mp.len(), 2);
        mp.update(id1, ProgressState::with_progress("Task 1", 0.5));
        mp.remove(id2);
        assert_eq!(mp.len(), 1);
    }

    #[test]
    fn test_status_bar_modes() {
        for mode in &[StatusMode::Normal, StatusMode::Insert, StatusMode::Command] {
            let bar = StatusBar {
                mode: *mode,
                ..StatusBar::new()
            };
            // Just check it doesn't panic
            let _ = format!("{:?}", bar.mode);
        }
    }
}
