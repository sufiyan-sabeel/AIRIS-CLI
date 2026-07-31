//! Session persistence for saving and restoring agent sessions.
//!
//! Stores sessions as JSON files with conversation history, metadata,
//! and incremental checkpointing support.

use crate::error::AirisResult;
use crate::types::*;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::info;

/// Manages session persistence on disk.
pub struct SessionPersistence {
    session_dir: PathBuf,
}

impl SessionPersistence {
    /// Create session persistence in the given directory.
    pub fn new(session_dir: impl Into<PathBuf>) -> Self {
        Self {
            session_dir: session_dir.into(),
        }
    }

    /// Get the default session directory.
    pub async fn default() -> Self {
        let dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("airis")
            .join("sessions");
        fs::create_dir_all(&dir).await.ok();
        Self::new(dir)
    }

    /// Save a session to disk.
    pub async fn save(&self, session: &SessionData) -> AirisResult<PathBuf> {
        let path = self.session_dir.join(format!("{}.json", session.id));
        let json = serde_json::to_string_pretty(session).map_err(|e| {
            AirisError::Custom(format!("Failed to serialize session: {}", e))
        })?;
        fs::write(&path, json).await.map_err(|e| {
            AirisError::Custom(format!("Failed to write session: {}", e))
        })?;
        info!("Saved session {} to {}", session.id, path.display());
        Ok(path)
    }

    /// Load a session by ID.
    pub async fn load(&self, id: &uuid::Uuid) -> AirisResult<SessionData> {
        let path = self.session_dir.join(format!("{}.json", id));
        let json = fs::read_to_string(&path).await.map_err(|e| {
            AirisError::Custom(format!("Failed to read session {}: {}", id, e))
        })?;
        let session: SessionData = serde_json::from_str(&json).map_err(|e| {
            AirisError::Custom(format!("Failed to deserialize session: {}", e))
        })?;
        info!("Loaded session {} from {}", id, path.display());
        Ok(session)
    }

    /// List all saved sessions.
    pub async fn list(&self) -> AirisResult<Vec<SessionData>> {
        let mut sessions = Vec::new();
        let mut dir = fs::read_dir(&self.session_dir).await.map_err(|e| {
            AirisError::Custom(format!("Failed to read session dir: {}", e))
        })?;

        while let Some(entry) = dir.next_entry().await.map_err(AirisError::Io)? {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(json) = fs::read_to_string(&path).await {
                    if let Ok(session) = serde_json::from_str::<SessionData>(&json) {
                        sessions.push(session);
                    }
                }
            }
        }

        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(sessions)
    }

    /// Delete a session.
    pub async fn delete(&self, id: &uuid::Uuid) -> AirisResult<()> {
        let path = self.session_dir.join(format!("{}.json", id));
        if path.exists() {
            fs::remove_file(&path).await.map_err(AirisError::Io)?;
            info!("Deleted session {}", id);
        }
        Ok(())
    }

    /// Append a checkpoint to the session log (JSONL format).
    pub async fn append_checkpoint(
        &self,
        id: &uuid::Uuid,
        entry: &CheckpointEntry,
    ) -> AirisResult<()> {
        let path = self.session_dir.join(format!("{}.jsonl", id));
        let json = serde_json::to_string(entry).map_err(|e| {
            AirisError::Custom(format!("Failed to serialize checkpoint: {}", e))
        })?;
        fs::write(&path, format!("{}\n", json)).await.map_err(AirisError::Io)?;
        Ok(())
    }

    /// Load checkpoint log for a session.
    pub async fn load_checkpoints(&self, id: &uuid::Uuid) -> AirisResult<Vec<CheckpointEntry>> {
        let path = self.session_dir.join(format!("{}.jsonl", id));
        if !path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&path).await.map_err(AirisError::Io)?;
        let entries: Vec<CheckpointEntry> = content
            .lines()
            .filter_map(|l| serde_json::from_str(l).ok())
            .collect();

        Ok(entries)
    }
}

/// A checkpoint entry in the session log.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointEntry {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub event_type: String,
    pub message_count: usize,
    pub tokens_used: usize,
    pub metadata: std::collections::HashMap<String, String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_save_load_session() {
        let dir = TempDir::new().unwrap();
        let persistence = SessionPersistence::new(dir.path());

        let id = Uuid::new_v4();
        let session = SessionData {
            id,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            messages: vec![
                Message::user("Hello"),
                Message::assistant("Hi there!"),
            ],
            metadata: std::collections::HashMap::new(),
        };

        persistence.save(&session).await.unwrap();
        let loaded = persistence.load(&id).await.unwrap();
        assert_eq!(loaded.id, id);
        assert_eq!(loaded.messages.len(), 2);
    }

    #[tokio::test]
    async fn test_list_sessions() {
        let dir = TempDir::new().unwrap();
        let persistence = SessionPersistence::new(dir.path());

        let s1 = SessionData {
            id: Uuid::new_v4(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            messages: vec![],
            metadata: std::collections::HashMap::new(),
        };
        let s2 = SessionData {
            id: Uuid::new_v4(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            messages: vec![],
            metadata: std::collections::HashMap::new(),
        };

        persistence.save(&s1).await.unwrap();
        persistence.save(&s2).await.unwrap();

        let sessions = persistence.list().await.unwrap();
        assert_eq!(sessions.len(), 2);
    }

    #[tokio::test]
    async fn test_delete_session() {
        let dir = TempDir::new().unwrap();
        let persistence = SessionPersistence::new(dir.path());

        let id = Uuid::new_v4();
        let session = SessionData {
            id,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            messages: vec![],
            metadata: std::collections::HashMap::new(),
        };

        persistence.save(&session).await.unwrap();
        persistence.delete(&id).await.unwrap();

        let sessions = persistence.list().await.unwrap();
        assert_eq!(sessions.len(), 0);
    }

    #[tokio::test]
    async fn test_checkpoint() {
        let dir = TempDir::new().unwrap();
        let persistence = SessionPersistence::new(dir.path());

        let id = Uuid::new_v4();
        let entry = CheckpointEntry {
            timestamp: chrono::Utc::now(),
            event_type: "turn_complete".into(),
            message_count: 5,
            tokens_used: 1000,
            metadata: std::collections::HashMap::new(),
        };

        persistence.append_checkpoint(&id, &entry).await.unwrap();
        let entries = persistence.load_checkpoints(&id).await.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].event_type, "turn_complete");
    }
}
