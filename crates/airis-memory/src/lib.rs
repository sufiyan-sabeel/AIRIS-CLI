//! # Airis Memory
//!
//! Long-term memory system for AIRIS-CLI.
//!
//! Provides file-backed persistent memory with:
//!
//! - **Memory types**: episodic (experiences), semantic (facts),
//!   procedural (skills), working (current context)
//! - **Importance-based prioritization** — more salient memories
//!   rank higher during recall
//! - **Vector similarity search** via HNSW (instant-distance crate)
//! - **Hybrid recall** combining keyword matching + vector similarity
//! - **TTL-based expiration** — entries can self-destruct after a time
//! - **Consolidation** — summarises and merges old, low-importance entries

use std::collections::HashMap;
use std::path::Path;

use chrono::{DateTime, Utc};
use instant_distance::{Builder, Hnsw, Point, Search};
use serde::{Deserialize, Serialize};
use sled::{Db, Tree};
use tokio::sync::Mutex;
use tracing::{debug, info, warn};
use uuid::Uuid;

use airis_core::prelude::*;

// ─── Vector Point ──────────────────────────────────────────────────────────

/// A cosine-distance point wrapping an `f32` embedding vector.
///
/// Used with the HNSW index for approximate nearest-neighbour search.
#[derive(Clone, Debug)]
struct VectorPoint {
    vector: Vec<f32>,
}

impl Point for VectorPoint {
    fn distance(&self, other: &Self) -> f32 {
        let dot: f32 = self
            .vector
            .iter()
            .zip(other.vector.iter())
            .map(|(a, b)| a * b)
            .sum();
        let norm_a: f32 = self.vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = other.vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm_a == 0.0 || norm_b == 0.0 {
            return 1.0;
        }
        // Cosine distance = 1 - cosine_similarity
        1.0 - (dot / (norm_a * norm_b)).clamp(-1.0, 1.0)
    }
}

// ─── Persistence Schema ───────────────────────────────────────────────────

/// Sled tree keys:
///
/// | Tree      | Key          | Value                   |
/// |-----------|--------------|-------------------------|
/// | `entries` | UUID (bytes) | JSON‑serialised `MemoryEntry` |

const ENTRIES_TREE: &str = "entries";

// ─── Config ───────────────────────────────────────────────────────────────

/// Tuning parameters for the memory store.
#[derive(Debug, Clone)]
pub struct MemoryConfig {
    /// Minimum importance threshold for consolidation (entries below this
    /// are candidates when also old enough).
    pub consolidation_importance_threshold: f64,
    /// Minimum age (in hours) before an entry is eligible for consolidation.
    pub consolidation_age_hours: i64,
    /// Content-word overlap ratio required to consider two entries "similar"
    /// during consolidation.
    pub consolidation_similarity_threshold: f64,
    /// Default TTL for consolidated summary entries (in days).
    pub consolidated_ttl_days: i64,
    /// Number of nearest neighbours to retrieve during vector search.
    pub vector_search_k: usize,
    /// Keyword match ratio weight in the combined recall score.
    pub keyword_weight: f64,
    /// Vector similarity weight in the combined recall score.
    pub vector_weight: f64,
    /// Importance weight in the combined recall score.
    pub importance_weight: f64,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            consolidation_importance_threshold: 0.5,
            consolidation_age_hours: 24,
            consolidation_similarity_threshold: 0.3,
            consolidated_ttl_days: 30,
            vector_search_k: 10,
            keyword_weight: 0.3,
            vector_weight: 0.4,
            importance_weight: 0.3,
        }
    }
}

// ─── Memory Store ─────────────────────────────────────────────────────────

/// A file-backed long-term memory store using **sled** for durability and an
/// in-memory HNSW index for vector similarity.
///
/// All public methods are `async` and `Send + Sync`, fulfilling the
/// [`MemoryStore`] trait contract.
pub struct MemoryStoreImpl {
    db: Db,
    entries: Tree,
    config: MemoryConfig,
    /// Guards [`consolidate`](MemoryStoreImpl::consolidate) so two callers
    /// never run it concurrently.
    consolidate_lock: Mutex<()>,
}

impl MemoryStoreImpl {
    /// Open (or create) a persistent memory store at `path`.
    ///
    /// # Errors
    ///
    /// Returns [`AirisError::Internal`] if the database cannot be opened.
    pub fn open(path: impl AsRef<Path>) -> AirisResult<Self> {
        let db = sled::open(path.as_ref())
            .map_err(|e| AirisError::Internal(format!("Failed to open memory store: {e}")))?;
        let entries = db
            .open_tree(ENTRIES_TREE)
            .map_err(|e| AirisError::Internal(format!("Failed to open entries tree: {e}")))?;
        Ok(Self {
            db,
            entries,
            config: MemoryConfig::default(),
            consolidate_lock: Mutex::new(()),
        })
    }

    /// Open with a custom [`MemoryConfig`].
    ///
    /// # Errors
    ///
    /// Same as [`open`](MemoryStoreImpl::open).
    pub fn open_with_config(path: impl AsRef<Path>, config: MemoryConfig) -> AirisResult<Self> {
        let mut store = Self::open(path)?;
        store.config = config;
        Ok(store)
    }

    // ── Internal helpers ──────────────────────────────────────────────────

    /// Serialise and insert a single entry into sled.
    fn store_inner(&self, entry: &MemoryEntry) -> AirisResult<()> {
        let key = entry.id.as_bytes().to_vec();
        let value = serde_json::to_vec(entry)?;
        self.entries
            .insert(key, value)
            .map_err(|e| AirisError::Internal(format!("Failed to store entry: {e}")))?;
        Ok(())
    }

    /// Load every non-expired entry from disk.
    fn load_all_entries(&self) -> AirisResult<Vec<MemoryEntry>> {
        let now = Utc::now();
        let mut entries = Vec::new();
        for result in self.entries.iter() {
            let (_key, value) = result
                .map_err(|e| AirisError::Internal(format!("Failed to read entry: {e}")))?;
            let entry: MemoryEntry = serde_json::from_slice(&value)?;
            // Filter out expired entries transparently.
            if let Some(expires) = entry.expires_at {
                if expires <= now {
                    continue;
                }
            }
            entries.push(entry);
        }
        Ok(entries)
    }

    /// Build an in-memory HNSW index from entries that carry an embedding.
    ///
    /// Returns `(hnsw, uuid_lookup)` where `uuid_lookup[i]` is the
    /// [`Uuid`] whose embedding lives at position `i` in the index.
    fn build_vector_index(
        entries: &[MemoryEntry],
    ) -> Option<(Hnsw<VectorPoint>, Vec<Uuid>)> {
        let with_emb: Vec<&MemoryEntry> =
            entries.iter().filter(|e| e.embedding.is_some()).collect();
        if with_emb.is_empty() {
            return None;
        }

        let points: Vec<VectorPoint> = with_emb
            .iter()
            .map(|e| VectorPoint {
                vector: e.embedding.as_ref().unwrap().clone(),
            })
            .collect();
        let uuids: Vec<Uuid> = with_emb.iter().map(|e| e.id).collect();

        let (hnsw, _point_ids) = Builder::default().build_hnsw(points);
        Some((hnsw, uuids))
    }

    /// Simple keyword-matching score between `query` and an entry.
    ///
    /// Returns a value in `[0, 1]` proportional to the fraction of query
    /// words that appear in the entry's `content` or `key`.
    fn keyword_score(query: &str, entry: &MemoryEntry) -> f64 {
        let query_lower = query.to_lowercase();
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();
        if query_words.is_empty() {
            return 0.0;
        }

        let content_lower = entry.content.to_lowercase();
        let key_lower = entry.key.to_lowercase();

        let matches = query_words
            .iter()
            .filter(|w| content_lower.contains(*w) || key_lower.contains(*w))
            .count();

        matches as f64 / query_words.len() as f64
    }

    /// Remove every entry whose `expires_at` is in the past.
    ///
    /// Returns the number of removed entries.
    fn remove_expired(&self) -> AirisResult<usize> {
        let now = Utc::now();
        let mut to_delete = Vec::new();

        for result in self.entries.iter() {
            let (key, value) = result
                .map_err(|e| AirisError::Internal(format!("Failed to read entry: {e}")))?;
            let entry: MemoryEntry = serde_json::from_slice(&value)?;
            if let Some(expires) = entry.expires_at {
                if expires <= now {
                    to_delete.push(key.to_vec());
                }
            }
        }

        let count = to_delete.len();
        for key in &to_delete {
            self.entries
                .remove(key.as_slice())
                .map_err(|e| AirisError::Internal(format!("Failed to delete expired entry: {e}")))?;
        }

        if count > 0 {
            debug!("Removed {count} expired memory entr{}", if count == 1 { "y" } else { "ies" });
            let _ = self.db.flush();
        }

        Ok(count)
    }

    /// Format a [`MemoryType`] as a static string label.
    fn memory_type_label(t: &MemoryType) -> &'static str {
        match t {
            MemoryType::Episodic => "episodic",
            MemoryType::Semantic => "semantic",
            MemoryType::Procedural => "procedural",
            MemoryType::Working => "working",
        }
    }

    /// Count entries by type and find the oldest / newest timestamps.
    fn compute_stats(entries: &[MemoryEntry]) -> MemoryStats {
        let total = entries.len();
        let mut episodic = 0_usize;
        let mut semantic = 0;
        let mut procedural = 0;
        let mut working = 0;
        let mut oldest: Option<DateTime<Utc>> = None;
        let mut newest: Option<DateTime<Utc>> = None;

        for e in entries {
            match e.entry_type {
                MemoryType::Episodic => episodic += 1,
                MemoryType::Semantic => semantic += 1,
                MemoryType::Procedural => procedural += 1,
                MemoryType::Working => working += 1,
            }
            match oldest {
                None => oldest = Some(e.timestamp),
                Some(t) if e.timestamp < t => oldest = Some(e.timestamp),
                _ => {}
            }
            match newest {
                None => newest = Some(e.timestamp),
                Some(t) if e.timestamp > t => newest = Some(e.timestamp),
                _ => {}
            }
        }

        MemoryStats {
            total_entries: total,
            episodic,
            semantic,
            procedural,
            working,
            oldest,
            newest,
        }
    }
}

// ─── MemoryStore trait implementation ──────────────────────────────────────

#[async_trait]
impl MemoryStore for MemoryStoreImpl {
    async fn store(&self, entry: MemoryEntry) -> AirisResult<()> {
        self.store_inner(&entry)?;
        let _ = self.db.flush();
        Ok(())
    }

    async fn recall(&self, query: &str, limit: usize) -> AirisResult<Vec<MemoryEntry>> {
        let all = self.load_all_entries()?;
        if all.is_empty() {
            return Ok(Vec::new());
        }
        let limit = limit.min(all.len());

        // Phase 1: score every entry by keyword match and importance.
        let mut scored: Vec<(f64, usize)> = all
            .iter()
            .enumerate()
            .map(|(i, e)| {
                let kw = Self::keyword_score(query, e);
                let score = kw * self.config.keyword_weight
                    + e.importance * self.config.importance_weight;
                (score, i)
            })
            .collect();
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        // Phase 2: if any entries have embeddings, perform vector expansion.
        let candidate_count = limit.min(scored.len().max(self.config.vector_search_k));
        if let Some((hnsw, uuid_lookup)) = &Self::build_vector_index(&all) {
            let top_kw_indices: Vec<usize> = scored
                .iter()
                .take(candidate_count)
                .map(|(_, i)| *i)
                .collect();

            // For each top keyword-matched entry that has an embedding, query
            // the vector index and boost the scores of its neighbours.
            for &idx in &top_kw_indices {
                let entry = &all[idx];
                if let Some(emb) = &entry.embedding {
                    let query_point = VectorPoint {
                        vector: emb.clone(),
                    };
                    let mut search = Search::default();

                    // Hnsw::search returns an opaque iterator over items that
                    // deref to PointId.  We collect eagerly because Search
                    // borrows mutably and we need the results below.
                    #[allow(clippy::needless_collect)]
                    let nearest: Vec<instant_distance::PointId> = hnsw
                        .search(&query_point, &mut search)
                        .map(|item| *item)
                        .collect();

                    for pid in &nearest {
                        let raw = pid.into_inner() as usize;
                        if raw >= uuid_lookup.len() {
                            continue;
                        }
                        let candidate_uuid = uuid_lookup[raw];
                        // Find this UUID in the scored list and boost.
                        if let Some(pos) =
                            scored.iter().position(|(_, i)| all[*i].id == candidate_uuid)
                        {
                            let dist: f32 = hnsw[pid].distance(&query_point);
                            let sim = (1.0_f64 - dist as f64).max(0.0);
                            scored[pos].0 += sim * self.config.vector_weight;
                        }
                    }
                }
            }

            // Re-sort after vector boosts.
            scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        }

        let result: Vec<MemoryEntry> = scored
            .into_iter()
            .take(limit)
            .map(|(_, i)| all[i].clone())
            .collect();
        Ok(result)
    }

    async fn recall_by_type(&self, entry_type: MemoryType, limit: usize) -> AirisResult<Vec<MemoryEntry>> {
        let all = self.load_all_entries()?;
        let mut filtered: Vec<MemoryEntry> = all
            .into_iter()
            .filter(|e| e.entry_type == entry_type)
            .collect();
        // Sort by importance descending so the most salient come first.
        filtered.sort_by(|a, b| {
            b.importance
                .partial_cmp(&a.importance)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        filtered.truncate(limit);
        Ok(filtered)
    }

    async fn recall_important(&self, min_importance: f64, limit: usize) -> AirisResult<Vec<MemoryEntry>> {
        let all = self.load_all_entries()?;
        let mut filtered: Vec<MemoryEntry> = all
            .into_iter()
            .filter(|e| e.importance >= min_importance)
            .collect();
        filtered.sort_by(|a, b| {
            b.importance
                .partial_cmp(&a.importance)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        filtered.truncate(limit);
        Ok(filtered)
    }

    async fn forget(&self, id: &Uuid) -> AirisResult<()> {
        let key = id.as_bytes().to_vec();
        self.entries
            .remove(key)
            .map_err(|e| AirisError::Internal(format!("Failed to forget entry: {e}")))?;
        let _ = self.db.flush();
        Ok(())
    }

    async fn consolidate(&self) -> AirisResult<()> {
        let _guard = self.consolidate_lock.lock().await;

        // 1. Sweep expired entries.
        let expired = self.remove_expired()?;

        // 2. Load what remains.
        let entries = self.load_all_entries()?;
        if entries.is_empty() {
            info!("Consolidation: store is empty (removed {expired} expired)");
            return Ok(());
        }

        let now = Utc::now();
        let age_budget = chrono::Duration::hours(self.config.consolidation_age_hours);

        // 3. Group old, low-importance entries by type + content overlap.
        let mut merged_ids: Vec<Uuid> = Vec::new();
        let mut groups: Vec<Vec<MemoryEntry>> = Vec::new();

        for entry in &entries {
            if merged_ids.contains(&entry.id) {
                continue;
            }
            // Only consider entries past the age threshold.
            if now.signed_duration_since(entry.timestamp) < age_budget {
                continue;
            }

            let similar: Vec<MemoryEntry> = entries
                .iter()
                .filter(|e| {
                    if merged_ids.contains(&e.id) || e.id == entry.id {
                        return false;
                    }
                    if e.entry_type != entry.entry_type {
                        return false;
                    }
                    if now.signed_duration_since(e.timestamp) < age_budget {
                        return false;
                    }
                    let overlap = content_overlap(&entry.content, &e.content);
                    overlap > self.config.consolidation_similarity_threshold
                        && (entry.importance + e.importance) / 2.0
                            < self.config.consolidation_importance_threshold
                })
                .cloned()
                .collect();

            if !similar.is_empty() {
                let mut group = vec![entry.clone()];
                let mut ids = vec![entry.id];
                for s in &similar {
                    group.push(s.clone());
                    ids.push(s.id);
                }
                groups.push(group);
                merged_ids.extend(ids);
            }
        }

        // 4. Create consolidated summary entries.
        let mut summary_count = 0;
        for group in &groups {
            if group.is_empty() {
                continue;
            }

            let avg_importance =
                group.iter().map(|e| e.importance).sum::<f64>() / group.len() as f64;
            let max_ts = group
                .iter()
                .map(|e| e.timestamp)
                .max()
                .unwrap_or(now);

            let merged_entry = MemoryEntry {
                id: Uuid::new_v4(),
                key: format!(
                    "consolidated:{}",
                    Self::memory_type_label(&group[0].entry_type)
                ),
                content: group
                    .iter()
                    .map(|e| e.content.as_str())
                    .collect::<Vec<_>>()
                    .join("\n---\n"),
                entry_type: group[0].entry_type.clone(),
                importance: avg_importance,
                timestamp: max_ts,
                expires_at: Some(now + chrono::Duration::days(self.config.consolidated_ttl_days)),
                embedding: None,
                metadata: {
                    let mut m = HashMap::new();
                    m.insert("consolidated".to_string(), "true".to_string());
                    m.insert("merged_count".to_string(), group.len().to_string());
                    m.insert(
                        "original_ids".to_string(),
                        group
                            .iter()
                            .map(|e| e.id.to_string())
                            .collect::<Vec<_>>()
                            .join(","),
                    );
                    m
                },
            };

            self.store_inner(&merged_entry)?;
            summary_count += 1;

            // Remove the originals.
            for entry in group {
                let key = entry.id.as_bytes().to_vec();
                self.entries
                    .remove(key)
                    .map_err(|e| AirisError::Internal(format!(
                        "Failed to remove consolidated entry: {e}"
                    )))?;
            }
        }

        let _ = self.db.flush();
        info!(
            "Consolidation complete: removed {expired} expired, \
             merged {} groups into {summary_count} summaries",
            groups.len(),
        );
        Ok(())
    }

    async fn stats(&self) -> AirisResult<MemoryStats> {
        let entries = self.load_all_entries()?;
        Ok(Self::compute_stats(&entries))
    }
}

impl Drop for MemoryStoreImpl {
    fn drop(&mut self) {
        let _ = self.db.flush();
    }
}

// ─── Helper: content overlap ───────────────────────────────────────────────

/// Ratio of shared unique words between two text strings.
///
/// Returns `overlap / min(len_a, len_b)`, or `0.0` when either string is
/// empty.
fn content_overlap(a: &str, b: &str) -> f64 {
    let words_a: Vec<&str> = a.split_whitespace().collect();
    let words_b: Vec<&str> = b.split_whitespace().collect();
    let min_len = words_a.len().min(words_b.len());
    if min_len == 0 {
        return 0.0;
    }
    let overlap = words_a.iter().filter(|w| words_b.contains(w)).count();
    overlap as f64 / min_len as f64
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn make_entry(
        key: &str,
        content: &str,
        entry_type: MemoryType,
        importance: f64,
    ) -> MemoryEntry {
        MemoryEntry {
            id: Uuid::new_v4(),
            key: key.to_string(),
            content: content.to_string(),
            entry_type,
            importance,
            timestamp: Utc::now(),
            expires_at: None,
            embedding: None,
            metadata: HashMap::new(),
        }
    }

    fn make_store() -> (MemoryStoreImpl, tempfile::TempDir) {
        let dir = tempfile::TempDir::with_prefix("airis-memory-test_").unwrap();
        let store = MemoryStoreImpl::open(dir.path().join("mem")).unwrap();
        (store, dir)
    }

    #[tokio::test]
    async fn test_store_and_recall() {
        let (store, _dir) = make_store();
        let entry = make_entry("greeting", "Hello world, this is a test", MemoryType::Semantic, 0.8);
        store.store(entry).await.unwrap();

        let results = store.recall("test hello", 10).await.unwrap();
        assert!(!results.is_empty(), "should find the stored entry");
        assert_eq!(results[0].key, "greeting");
    }

    #[tokio::test]
    async fn test_recall_empty_query() {
        let (store, _dir) = make_store();
        let entry = make_entry("k1", "some content", MemoryType::Semantic, 0.8);
        store.store(entry).await.unwrap();

        // Empty query should return results sorted by importance.
        let results = store.recall("", 10).await.unwrap();
        assert!(!results.is_empty());
    }

    #[tokio::test]
    async fn test_recall_by_type() {
        let (store, _dir) = make_store();
        store
            .store(make_entry("e1", "went to the store", MemoryType::Episodic, 0.5))
            .await
            .unwrap();
        store
            .store(make_entry("f1", "Paris is the capital", MemoryType::Semantic, 0.9))
            .await
            .unwrap();

        let sem = store.recall_by_type(MemoryType::Semantic, 10).await.unwrap();
        assert_eq!(sem.len(), 1);
        assert_eq!(sem[0].key, "f1");

        let epi = store.recall_by_type(MemoryType::Episodic, 10).await.unwrap();
        assert_eq!(epi.len(), 1);
        assert_eq!(epi[0].key, "e1");

        let proc = store.recall_by_type(MemoryType::Procedural, 10).await.unwrap();
        assert!(proc.is_empty());
    }

    #[tokio::test]
    async fn test_recall_important() {
        let (store, _dir) = make_store();
        store
            .store(make_entry("low", "trivial detail", MemoryType::Semantic, 0.2))
            .await
            .unwrap();
        store
            .store(make_entry("high", "critical insight", MemoryType::Semantic, 0.95))
            .await
            .unwrap();

        let results = store.recall_important(0.5, 10).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].key, "high");
    }

    #[tokio::test]
    async fn test_forget() {
        let (store, _dir) = make_store();
        let entry = make_entry("secret", "classified", MemoryType::Episodic, 0.9);
        let id = entry.id;
        store.store(entry).await.unwrap();

        assert_eq!(store.recall("classified", 10).await.unwrap().len(), 1);
        store.forget(&id).await.unwrap();
        assert_eq!(store.recall("classified", 10).await.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_ttl_expiration() {
        let (store, _dir) = make_store();
        let mut entry = make_entry("old", "expired content", MemoryType::Semantic, 0.5);
        entry.expires_at = Some(Utc::now() - chrono::Duration::hours(1));
        store.store(entry).await.unwrap();

        // Expired entries are filtered during load_all_entries, so they
        // should not appear in recall.
        let results = store.recall("expired", 10).await.unwrap();
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_consolidation_merges_similar_entries() {
        let (store, _dir) = make_store();
        let old = Utc::now() - chrono::Duration::hours(48);

        for i in 0..3 {
            let mut entry = make_entry(
                &format!("merge-{i}"),
                &format!("This is similar content piece number {i} that should be merged"),
                MemoryType::Episodic,
                0.3,
            );
            entry.timestamp = old;
            store.store(entry).await.unwrap();
        }

        // Confirm all three exist before consolidation.
        assert_eq!(store.recall("similar", 10).await.unwrap().len(), 3);

        store.consolidate().await.unwrap();

        let entries = store.load_all_entries().unwrap();
        assert_eq!(entries.len(), 1, "three old entries merged into one");
        assert_eq!(
            entries[0].metadata.get("consolidated").map(|s| s.as_str()),
            Some("true")
        );
    }

    #[tokio::test]
    async fn test_consolidation_skips_important_entries() {
        let (store, _dir) = make_store();
        let old = Utc::now() - chrono::Duration::hours(48);

        // High importance entry should NOT be consolidated.
        let mut important = make_entry("important", "Do not touch this", MemoryType::Episodic, 0.95);
        important.timestamp = old;
        store.store(important).await.unwrap();

        // Low importance but same content — would be merged only if
        // importance threshold wasn't exceeded.
        let mut low = make_entry("low", "Do not touch this either", MemoryType::Episodic, 0.2);
        low.timestamp = old;
        store.store(low).await.unwrap();

        store.consolidate().await.unwrap();

        let entries = store.load_all_entries().unwrap();
        // The high-importance entry should still be present (not merged away).
        assert!(
            entries.iter().any(|e| e.key == "important"),
            "high-importance entry must survive consolidation"
        );
    }

    #[tokio::test]
    async fn test_stats() {
        let (store, _dir) = make_store();
        store.store(make_entry("e1", "a", MemoryType::Episodic, 0.5)).await.unwrap();
        store.store(make_entry("e2", "b", MemoryType::Episodic, 0.6)).await.unwrap();
        store.store(make_entry("s1", "c", MemoryType::Semantic, 0.8)).await.unwrap();
        store.store(make_entry("p1", "d", MemoryType::Procedural, 0.4)).await.unwrap();
        store.store(make_entry("w1", "e", MemoryType::Working, 0.3)).await.unwrap();

        let stats = store.stats().await.unwrap();
        assert_eq!(stats.total_entries, 5);
        assert_eq!(stats.episodic, 2);
        assert_eq!(stats.semantic, 1);
        assert_eq!(stats.procedural, 1);
        assert_eq!(stats.working, 1);
        assert!(stats.oldest.is_some());
        assert!(stats.newest.is_some());
    }

    #[tokio::test]
    async fn test_vector_search_boost() {
        let (store, _dir) = make_store();

        // Two entries with embeddings (random-ish vectors for testing).
        let vec_a = vec![1.0, 0.0, 0.0];
        let vec_b = vec![0.95, 0.1, 0.05]; // close to vec_a
        let vec_c = vec![0.0, 1.0, 0.0]; // far from vec_a

        let mut entry_a = make_entry("a", "alpha star", MemoryType::Semantic, 0.5);
        entry_a.embedding = Some(vec_a);
        let a_id = entry_a.id;
        store.store(entry_a).await.unwrap();

        let mut entry_b = make_entry("b", "beta near alpha", MemoryType::Semantic, 0.5);
        entry_b.embedding = Some(vec_b);
        store.store(entry_b).await.unwrap();

        let mut entry_c = make_entry("c", "gamma far away", MemoryType::Semantic, 0.5);
        entry_c.embedding = Some(vec_c);
        store.store(entry_c).await.unwrap();

        // Query "alpha" should boost 'b' because its embedding is near 'a's.
        let results = store.recall("alpha", 5).await.unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].key, "a", "'a' matches keyword best");

        // 'b' should appear in the top results because of vector similarity.
        let keys: Vec<&str> = results.iter().map(|e| e.key.as_str()).collect();
        assert!(keys.contains(&"b"), "'b' should be boosted by vector similarity");
    }

    #[tokio::test]
    async fn test_recall_persistence_across_reopen() {
        let dir = tempfile::TempDir::with_prefix("airis-memory-persist_").unwrap();
        let path = dir.path().join("mem");

        // Write.
        {
            let store = MemoryStoreImpl::open(&path).unwrap();
            store
                .store(make_entry("persist", "survive restart", MemoryType::Semantic, 0.9))
                .await
                .unwrap();
        } // drop → flush

        // Re-read.
        let store = MemoryStoreImpl::open(&path).unwrap();
        let results = store.recall("survive", 10).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].key, "persist");
    }

    // ── unit-level tests ──────────────────────────────────────────────

    #[test]
    fn test_keyword_score_exact_match() {
        let e = make_entry("test-key", "the quick brown fox", MemoryType::Semantic, 0.5);
        let score = MemoryStoreImpl::keyword_score("quick fox", &e);
        assert!(
            (score - 1.0).abs() < 1e-9,
            "all query words appear → score should be 1.0, got {score}",
        );
    }

    #[test]
    fn test_keyword_score_partial_match() {
        let e = make_entry("test-key", "the quick brown fox", MemoryType::Semantic, 0.5);
        let score = MemoryStoreImpl::keyword_score("quick fox elephant", &e);
        let expected = 2.0 / 3.0; // "quick" + "fox" match, "elephant" doesn't
        assert!(
            (score - expected).abs() < 1e-9,
            "expected {expected}, got {score}",
        );
    }

    #[test]
    fn test_keyword_score_no_match() {
        let e = make_entry("test-key", "the quick brown fox", MemoryType::Semantic, 0.5);
        let score = MemoryStoreImpl::keyword_score("xyzzy", &e);
        assert_eq!(score, 0.0);
    }

    #[test]
    fn test_content_overlap() {
        assert!((content_overlap("a b c", "a b d") - 2.0 / 3.0).abs() < 1e-9);
        assert_eq!(content_overlap("a b", "c d"), 0.0);
        assert_eq!(content_overlap("", "a b"), 0.0);
    }

    #[test]
    fn test_memory_type_label() {
        assert_eq!(MemoryStoreImpl::memory_type_label(&MemoryType::Episodic), "episodic");
        assert_eq!(MemoryStoreImpl::memory_type_label(&MemoryType::Semantic), "semantic");
        assert_eq!(MemoryStoreImpl::memory_type_label(&MemoryType::Procedural), "procedural");
        assert_eq!(MemoryStoreImpl::memory_type_label(&MemoryType::Working), "working");
    }

    #[test]
    fn test_compute_stats_empty() {
        let stats = MemoryStoreImpl::compute_stats(&[]);
        assert_eq!(stats.total_entries, 0);
        assert!(stats.oldest.is_none());
        assert!(stats.newest.is_none());
    }

    #[test]
    fn test_compute_stats_counts() {
        use std::collections::HashMap;
        let entries = vec![
            make_entry("e", "", MemoryType::Episodic, 0.5),
            make_entry("s", "", MemoryType::Semantic, 0.5),
            make_entry("p", "", MemoryType::Procedural, 0.5),
            make_entry("w", "", MemoryType::Working, 0.5),
        ];
        let stats = MemoryStoreImpl::compute_stats(&entries);
        assert_eq!(stats.total_entries, 4);
        assert_eq!(stats.episodic, 1);
        assert_eq!(stats.semantic, 1);
        assert_eq!(stats.procedural, 1);
        assert_eq!(stats.working, 1);
    }

    #[test]
    fn test_default_config_sanity() {
        let cfg = MemoryConfig::default();
        assert!(cfg.consolidation_importance_threshold > 0.0);
        assert!(cfg.consolidation_age_hours > 0);
        assert!(cfg.keyword_weight + cfg.vector_weight + cfg.importance_weight > 0.0);
        let total = cfg.keyword_weight + cfg.vector_weight + cfg.importance_weight;
        assert!((total - 1.0).abs() < 1e-9, "weights should sum to 1, got {total}");
    }
}
