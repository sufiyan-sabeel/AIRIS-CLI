//! # AIRIS Core
//!
//! Shared types, traits, errors, and primitives for the AIRIS-CLI ecosystem.
//! All crates depend on this foundational crate.

pub mod compression;
pub mod doctor;
pub mod error;
pub mod security;
pub mod session;
pub mod session_persistence;
pub mod streaming;
pub mod task;
pub mod traits;
pub mod types;
pub mod prelude;

/// Re-export the core prelude for convenience.
pub use prelude::*;
