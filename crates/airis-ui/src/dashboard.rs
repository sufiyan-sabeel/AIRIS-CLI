//! Premium animated dashboard for AIRIS-CLI.
//! Features glassmorphism design, real-time metrics, animated charts.
//! Fully original Rust implementation using ratatui.

use crate::theme::Theme;
use airis_core::prelude::*;
use ratatui::buffer::Buffer;
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, Borders, Gauge, Paragraph, Sparkline, Wrap};
use std::time::Instant;

/// Dashboard metrics snapshot.
#[derive(Debug, Clone, Default)]
pub struct DashboardMetrics {
    pub total_sessions: usize,
    pub total_messages: usize,
    pub total_tokens: usize,
    pub avg_response_time_ms: u64,
    pub cache_hit_rate: f64,
    pub active_plugins: usize,
    pub lsp_servers: usize,
    pub memory_usage_mb: f64,
    pub cpu_usage: f64,
}

/// Real-time metrics that animate.
#[derive(Debug, Clone)]
pub struct AnimatedMetric {
    pub current: f64,
    pub target: f64,
    pub velocity: f64,
}

impl AnimatedMetric {
    pub fn new(target: f64) -> Self {
        Self { current: target, target, velocity: 0.0 }
    }

    pub fn set_target(&mut self, target: f64) {
        self.target = target;
    }

    /// Smoothly animate toward target (spring physics).
    pub fn update(&mut self, dt: f64) {
        let force = (self.target - self.current) * 8.0 - self.velocity * 2.0;
        self.velocity += force * dt;
        self.current += self.velocity * dt;
        if (self.current - self.target).abs() < 0.01 && self.velocity.abs() < 0.01 {
            self.current = self.target;
            self.velocity = 0.0;
        }
    }
}

/// Premium dashboard component with glassmorphism styling.
pub struct Dashboard {
    pub metrics: DashboardMetrics,
    pub visible: bool,
    pub sparkline_data: Vec<u64>,
    theme: Theme,
    /// Animated metrics
    anim_messages: AnimatedMetric,
    anim_tokens: AnimatedMetric,
    anim_plugins: AnimatedMetric,
    last_update: Instant,
    frame_count: u64,
}

impl Dashboard {
    pub fn new(theme: Theme) -> Self {
        Self {
            metrics: DashboardMetrics::default(),
            visible: false,
            sparkline_data: Vec::new(),
            anim_messages: AnimatedMetric::new(0.0),
            anim_tokens: AnimatedMetric::new(0.0),
            anim_plugins: AnimatedMetric::new(0.0),
            last_update: Instant::now(),
            frame_count: 0,
            theme,
        }
    }

    pub fn toggle(&mut self) {
        self.visible = !self.visible;
    }

    pub fn update_metrics(&mut self, metrics: DashboardMetrics) {
        self.metrics = metrics;
        self.anim_messages.set_target(metrics.total_messages as f64);
        self.anim_tokens.set_target(metrics.total_tokens as f64);
        self.anim_plugins.set_target(metrics.active_plugins as f64);

        // Add to sparkline data
        self.sparkline_data.push(metrics.avg_response_time_ms);
        if self.sparkline_data.len() > 60 {
            self.sparkline_data.remove(0);
        }
    }

    pub fn tick(&mut self) {
        let now = Instant::now();
        let dt = now.duration_since(self.last_update).as_secs_f64().min(0.05);
        self.last_update = now;
        self.frame_count += 1;

        self.anim_messages.update(dt);
        self.anim_tokens.update(dt);
        self.anim_plugins.update(dt);
    }

    pub fn render(&mut self, area: Rect, buf: &mut Buffer) {
        if !self.visible || area.width < 40 || area.height < 10 {
            return;
        }

        let colors = &self.theme.colors;
        let bg = Color::Rgb(0, 0, 0);
        let glass_bg = Color::Rgba(15, 15, 30, 200);
        let accent = Color::Rgb(0, 229, 255); // Cyan
        let primary = Color::Rgb(0, 102, 255); // Blue

        // ── Glassmorphism background ──
        let dash_style = Style::default()
            .fg(accent)
            .bg(glass_bg);

        // Render glass panel
        let block = Block::default()
            .title(" \u{2699} AIRIS DASHBOARD ")
            .title_alignment(Alignment::Center)
            .borders(Borders::ALL)
            .border_style(Style::default().fg(accent))
            .style(dash_style);
        block.render(area, buf);

        let inner = Rect::new(area.x + 1, area.y + 1, area.width.saturating_sub(2), area.height.saturating_sub(2));
        if inner.width < 4 || inner.height < 4 {
            return;
        }

        // ── Layout: 2-column grid ──
        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
            .split(inner);

        // ── Left column: key metrics ──
        let left_chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(3),  // Messages counter
                Constraint::Length(3),  // Tokens counter
                Constraint::Length(3),  // Response time
                Constraint::Length(3),  // Cache hit rate
            ])
            .margin(0)
            .split(chunks[0]);

        // Messages (animated counter)
        let msg_val = self.anim_messages.current as usize;
        self.render_metric_card(
            left_chunks[0], buf,
            "\u{1f4ac} Messages",
            &format!("{}", msg_val),
            Color::Rgb(0, 229, 255),
            colors.surface,
        );

        // Tokens (animated counter)
        let tok_val = self.anim_tokens.current as usize;
        let tok_display = if tok_val > 1_000_000 {
            format!("{:.1}M", tok_val as f64 / 1_000_000.0)
        } else if tok_val > 1_000 {
            format!("{:.1}K", tok_val as f64 / 1_000.0)
        } else {
            format!("{}", tok_val)
        };
        self.render_metric_card(
            left_chunks[1], buf,
            "\u{1f4cb} Tokens",
            &tok_display,
            Color::Rgb(0, 102, 255),
            colors.surface,
        );

        // Response time with sparkline
        let avg_rt = self.metrics.avg_response_time_ms;
        self.render_metric_card(
            left_chunks[2], buf,
            "\u{26a1} Avg Response",
            &format!("{}ms", avg_rt),
            Color::Rgb(0, 200, 150),
            colors.surface,
        );

        // Cache hit rate gauge
        let cache_pct = (self.metrics.cache_hit_rate * 100.0) as u16;
        let gauge = Gauge::default()
            .block(Block::default().title(" Cache Hit Rate ").borders(Borders::NONE))
            .gauge_style(Style::default().fg(Color::Rgb(0, 229, 255)).bg(Color::Rgb(10, 10, 20)))
            .percent(cache_pct.min(100))
            .label(format!("{}%", cache_pct));
        gauge.render(left_chunks[3], buf);

        // ── Right column: system info ──
        let right_chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(3),  // Sessions
                Constraint::Length(3),  // Plugins
                Constraint::Length(3),  // LSP
                Constraint::Min(0),     // Sparkline
            ])
            .margin(0)
            .split(chunks[1]);

        self.render_metric_card(
            right_chunks[0], buf,
            "\u{1f4c1} Sessions",
            &format!("{}", self.metrics.total_sessions),
            Color::Rgb(255, 150, 50),
            colors.surface,
        );

        let pl_val = self.anim_plugins.current as usize;
        self.render_metric_card(
            right_chunks[1], buf,
            "\u{1f50c} Plugins",
            &format!("{}", pl_val),
            Color::Rgb(200, 100, 255),
            colors.surface,
        );

        self.render_metric_card(
            right_chunks[2], buf,
            "\u{1f4e1} LSP Servers",
            &format!("{}", self.metrics.lsp_servers),
            Color::Rgb(100, 200, 255),
            colors.surface,
        );

        // Sparkline for response times
        if !self.sparkline_data.is_empty() && right_chunks[3].height >= 3 {
            let spark = Sparkline::default()
                .block(Block::default().title(" Response Time Trend ").borders(Borders::NONE))
                .data(&self.sparkline_data)
                .style(Style::default().fg(accent).bg(Color::Rgb(10, 10, 20)));
            spark.render(right_chunks[3], buf);
        }
    }

    fn render_metric_card(
        &self, area: Rect, buf: &mut Buffer,
        label: &str, value: &str,
        accent: Color, bg: Color,
    ) {
        if area.width < 10 || area.height < 2 {
            return;
        }

        // Background fill
        for y in area.top()..area.bottom() {
            for x in area.left()..area.right() {
                buf[(x, y)] = ratatui::buffer::Cell::default()
                    .set_style(Style::default().bg(Color::Rgba(15, 15, 40, 100)));
            }
        }

        // Left accent bar
        for y in area.top()..area.bottom() {
            buf[(area.left(), y)] = ratatui::buffer::Cell::default()
                .set_style(Style::default().bg(accent));
        }

        // Label
        let label_style = Style::default()
            .fg(Color::Rgb(150, 150, 180))
            .bg(Color::Rgba(15, 15, 40, 100));
        let label_line = Line::from(vec![
            Span::styled(format!(" {}", label), label_style),
        ]);
        Paragraph::new(Text::from(label_line))
            .render(Rect::new(area.x + 2, area.y, area.width.saturating_sub(2), 1), buf);

        // Value (large, glowing)
        let val_style = Style::default()
            .fg(accent)
            .bg(Color::Rgba(15, 15, 40, 100))
            .add_modifier(Modifier::BOLD);
        let val_line = Line::from(vec![
            Span::styled(format!("  {}", value), val_style),
        ]);
        Paragraph::new(Text::from(val_line))
            .render(Rect::new(area.x + 2, area.y + 1, area.width.saturating_sub(2), 1), buf);
    }
}
