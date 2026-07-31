//! AIRIS-CLI animated ASCII logo with gradient sweep animation.
//!
//! Inspired by Oh My Pi's gradient logo animation, original Rust implementation.

use ratatui::style::Color;

/// AIRIS-CLI ASCII logo — original block-art design.
pub const AIRIS_LOGO: &[&str] = &[
    " █████  ██ ██████  ██ ██████  ",
    "██   ██ ██ ██   ██ ██ ██   ██ ",
    "███████ ██ ██████  ██ ██████  ",
    "██   ██ ██ ██   ██ ██ ██   ██ ",
    "██   ██ ██ ██   ██ ██ ██   ██ ",
];

/// Secondary "CLI" label
pub const CLI_LABEL: &[&str] = &[
    " ██████ ██      ██",
    "██      ██      ██",
    "██      ██      ██",
    "██      ██      ██",
    " ██████ ███████ ██",
];

/// KageOS wordmark
pub const KAGEOS_WORDMARK: &[&str] = &[
    "██   ██  █████  ██████  ███████  ██████  ███████ ",
    "██  ██  ██   ██ ██   ██ ██      ██    ██ ██      ",
    "█████   ███████ ██████  █████   ██    ██ ███████ ",
    "██  ██  ██   ██ ██   ██ ██      ██    ██      ██ ",
    "██   ██ ██   ██ ██   ██ ███████  ██████  ███████ ",
];

/// Gradient color stops for the logo animation.
/// (hue, saturation, lightness) in HSL
const GRADIENT_STOPS: &[(f64, f64, f64)] = &[
    (260.0, 0.85, 0.55), // purple
    (200.0, 0.80, 0.55), // cyan
    (160.0, 0.75, 0.50), // teal
    (220.0, 0.85, 0.60), // blue
];

/// Compute gradient color for a normalized position t in [0, 1).
fn gradient_color(t: f64, phase: f64) -> Color {
    let len = GRADIENT_STOPS.len() as f64;
    let offset = (t + phase) % 1.0;
    let pos = offset * len;
    let idx = pos.floor() as usize % GRADIENT_STOPS.len();
    let next = (idx + 1) % GRADIENT_STOPS.len();
    let frac = pos.fract();

    let (h1, s1, l1) = GRADIENT_STOPS[idx];
    let (h2, s2, l2) = GRADIENT_STOPS[next];

    let h = h1 + (h2 - h1) * frac;
    let s = s1 + (s2 - s1) * frac;
    let l = l1 + (l2 - l1) * frac;

    // Convert HSL to RGB
    let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
    let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
    let m = l - c / 2.0;

    let (r, g, b) = if h < 60.0 {
        (c, x, 0.0)
    } else if h < 120.0 {
        (x, c, 0.0)
    } else if h < 180.0 {
        (0.0, c, x)
    } else if h < 240.0 {
        (0.0, x, c)
    } else if h < 300.0 {
        (x, 0.0, c)
    } else {
        (c, 0.0, x)
    };

    Color::Rgb(
        ((r + m) * 255.0).round() as u8,
        ((g + m) * 255.0).round() as u8,
        ((b + m) * 255.0).round() as u8,
    )
}

/// Apply diagonal gradient to logo lines with optional shine.
pub fn apply_gradient(
    lines: &[&str],
    phase: f64,
    shine_offset: Option<f64>,
) -> Vec<String> {
    let height = lines.len();
    let width = lines.iter().map(|l| l.len()).max().unwrap_or(0);

    lines
        .iter()
        .enumerate()
        .map(|(y, line)| {
            let mut styled = String::new();
            for (x, ch) in line.chars().enumerate() {
                if ch == ' ' {
                    styled.push(' ');
                    continue;
                }
                // Normalized position: diagonal gradient (bottom-left to top-right)
                let t = if width > 0 && height > 0 {
                    let nx = x as f64 / width as f64;
                    let ny = y as f64 / height as f64;
                    (nx + (1.0 - ny)) / 2.0
                } else {
                    0.5
                };

                // Apply shine highlight if within band
                if let Some(shine) = shine_offset {
                    let shine_width = 0.18;
                    let dist = (t - shine).abs();
                    if dist < shine_width {
                        // Brighten: blend toward white
                        let brightness = 1.0 - (dist / shine_width);
                        let color = gradient_color(t, phase);
                        if let Color::Rgb(r, g, b) = color {
                            let blend = |c: u8| -> u8 {
                                ((c as f64) * (1.0 - brightness * 0.5) + 255.0 * brightness * 0.5)
                                    .round() as u8
                            };
                            styled.push_str(&format!(
                                "\x1b[38;2;{};{};{}m{}\x1b[0m",
                                blend(r),
                                blend(g),
                                blend(b),
                                ch
                            ));
                            continue;
                        }
                    }
                }

                let color = gradient_color(t, phase);
                if let Color::Rgb(r, g, b) = color {
                    styled.push_str(&format!("\x1b[38;2;{};{};{}m{}\x1b[0m", r, g, b, ch));
                } else {
                    styled.push(ch);
                }
            }
            styled
        })
        .collect()
}

/// Compute an intro animation frame for progress in [0, 1).
pub fn intro_logo_frame(progress: f64) -> Vec<String> {
    // Sweep the phase across multiple rotations
    let sweeps = 2.5;
    let phase = progress * sweeps;

    // Shine traverses the gradient
    let shine_traversals = 3.0;
    let shine_offset = (progress * shine_traversals) % 1.0;

    apply_gradient(AIRIS_LOGO, phase, Some(shine_offset))
}

/// Resting (non-animated) gradient logo.
pub fn resting_logo() -> Vec<String> {
    apply_gradient(AIRIS_LOGO, 0.0, None)
}

/// Render a welcome banner combining the AIRIS logo + KageOS branding.
pub fn render_logo_banner(width: usize, progress: Option<f64>) -> Vec<String> {
    let logo = match progress {
        Some(p) => intro_logo_frame(p),
        None => resting_logo(),
    };

    let mut banner = Vec::new();
    banner.push(String::new());

    // Center the logo horizontally
    let logo_width = AIRIS_LOGO[0].len();
    let left_pad = width.saturating_sub(logo_width) / 2;
    let padding = " ".repeat(left_pad);

    for line in &logo {
        banner.push(format!("{}{}", padding, line));
    }

    banner.push(String::new());

    // Subtitle with gradient
    let subtitle = format!("{} v{}", "Next-Gen AI Coding Assistant", env!("CARGO_PKG_VERSION"));
    let sub_pad = width.saturating_sub(subtitle.len()) / 2;
    let subtitle_line = format!(
        "{}\x1b[38;2;180;120;255m{}\x1b[0m",
        " ".repeat(sub_pad),
        subtitle
    );
    banner.push(subtitle_line);

    banner.push(String::new());
    banner
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gradient_color() {
        let color = gradient_color(0.0, 0.0);
        assert!(matches!(color, Color::Rgb(_, _, _)));
    }

    #[test]
    fn test_apply_gradient() {
        let result = apply_gradient(AIRIS_LOGO, 0.0, None);
        assert_eq!(result.len(), AIRIS_LOGO.len());
    }

    #[test]
    fn test_intro_logo_frame() {
        let frame = intro_logo_frame(0.5);
        assert_eq!(frame.len(), 5);
    }

    #[test]
    fn test_resting_logo() {
        let logo = resting_logo();
        assert_eq!(logo.len(), 5);
    }

    #[test]
    fn test_render_logo_banner() {
        let banner = render_logo_banner(80, None);
        assert!(!banner.is_empty());
    }
}
