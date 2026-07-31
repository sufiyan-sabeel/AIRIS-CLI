//! # AIRIS Core
//!
//! Shared types, traits, errors, and primitives for the AIRIS-CLI ecosystem.
//! All crates depend on this foundational crate.

pub mod error;
pub mod types;
pub mod traits;
pub mod session;
pub mod streaming;
pub mod prelude;

/// Re-export the core prelude for convenience.
pub use prelude::*;
