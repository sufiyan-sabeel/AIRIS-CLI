//! Session management for conversation persistence.

use crate::error::AirisResult;
use crate::types::*;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use uuid::Uuid;

/// Manages multiple concurrent sessions.
#[derive(Default)]
pub struct SessionManager {
    sessions: dashmap::DashMap<Uuid, SessionData>,
    active_id: arc_swap::ArcSwap<Option<Uuid>>,
}

impl SessionManager {
    /// Create a new session manager.
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a new session.
    pub fn create(&self, workspace_root: Option<PathBuf>) -> SessionData {
        let session = SessionData {
            workspace_root,
            ..SessionData::new()
        };
        self.sessions.insert(session.id, session.clone());
        self.active_id.store(Some(session.id).into());
        session
    }

    /// Get a session by ID.
    pub fn get(&self, id: &Uuid) -> Option<SessionData> {
        self.sessions.get(id).map(|s| s.clone())
    }

    /// Get the active session.
    pub fn active(&self) -> Option<SessionData> {
        let id = self.active_id.load();
        id.as_ref().and_then(|id| self.get(id))
    }

    /// Set the active session.
    pub fn set_active(&self, id: &Uuid) -> AirisResult<()> {
        if self.sessions.contains_key(id) {
            self.active_id.store(Some(*id).into());
            Ok(())
        } else {
            Err(crate::AirisError::SessionNotFound(id.to_string()))
        }
    }

    /// Update a session.
    pub fn update(&self, session: &SessionData) {
        self.sessions.insert(session.id, session.clone());
    }

    /// Delete a session.
    pub fn delete(&self, id: &Uuid) {
        self.sessions.remove(id);
        if self.active_id.load().as_ref() == Some(id) {
            self.active_id.store(None.into());
        }
    }

    /// List all sessions.
    pub fn list(&self) -> Vec<(Uuid, String, DateTime<Utc>)> {
        self.sessions
            .iter()
            .map(|s| {
                let first_msg = s
                    .conversation
                    .messages
                    .first()
                    .map(|m| m.text().chars().take(80).collect())
                    .unwrap_or_default();
                (s.id, first_msg, s.created_at)
            })
            .collect()
    }

    /// Get session count.
    pub fn count(&self) -> usize {
        self.sessions.len()
    }

    /// Clear all sessions.
    pub fn clear(&self) {
        self.sessions.clear();
        self.active_id.store(None.into());
    }
}
