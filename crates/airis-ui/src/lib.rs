//! Enhanced Terminal UI for AIRIS-CLI with component system and streaming.
//!
//! Architecture inspired by Oh My Pi but original Rust implementation.

pub mod components;
pub mod dashboard;
pub mod tui;

pub use components::*;
pub use dashboard::Dashboard;
pub use tui::TuiApp;
