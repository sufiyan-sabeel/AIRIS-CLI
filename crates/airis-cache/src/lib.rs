//! # AIRIS Cache
//!
//! Multi-layer caching system with:
//!
//! - **Hot layer**: In-memory [`DashMap`] + [`LruCache`] for fast concurrent access
//! - **Cold layer**: Optional [`sled`]-backed persistent storage for durability
//! - **Content-addressable keys** via blake3 hashing
//! - **TTL support** with background eviction of expired entries
//! - **JSON and MessagePack** serialization helpers
//! - **Statistics tracking** (hits, misses, entry count, size)
//!
//! ## Example
//!
//! ```rust
//! use std::num::NonZeroUsize;
//!
//! let cache = airis_airis_cache::CacheLayer::new(NonZeroUsize::new(100).unwrap());
//! cache.set_raw("my-key", b"hello".to_vec(), None).unwrap();
//! assert_eq!(cache.get_raw("my-key").unwrap(), Some(b"hello".to_vec()));
//! ```

use std::num::NonZeroUsize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use airis_core::prelude::*;
use blake3::Hash;
use chrono::Utc;
use dashmap::DashMap;
use lru::LruCache;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};

// ─── Constants ────────────────────────────────────────────────────────────

/// Default interval (seconds) for background eviction of expired hot entries.
const HOT_EVICTION_INTERVAL_SECS: u64 = 60;

/// Interval (seconds) for background eviction of expired cold entries.
const COLD_EVICTION_INTERVAL_SECS: u64 = 300;

// ─── Content Format ───────────────────────────────────────────────────────

/// Serialization format used for a cached value.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum CacheFormat {
    /// Raw binary (no special encoding).
    Binary,
    /// JSON-encoded value.
    Json,
    /// MessagePack-encoded value.
    MessagePack,
}

// ─── Cache Entry ──────────────────────────────────────────────────────────

/// A single entry in the cache, with value and metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CacheEntry {
    /// The cached payload bytes.
    data: Vec<u8>,
    /// Serialization format hint.
    format: CacheFormat,
    /// Creation time as Unix timestamp in milliseconds.
    #[serde(rename = "c")]
    created_at: i64,
    /// Expiration time as Unix timestamp in milliseconds, or `None` for no
    /// expiry.
    #[serde(rename = "e")]
    expires_at: Option<i64>,
}

impl CacheEntry {
    /// Create a new cache entry.
    fn new(data: Vec<u8>, format: CacheFormat, ttl_secs: Option<u64>) -> Self {
        let now = Utc::now().timestamp_millis();
        let expires_at = ttl_secs.map(|ttl| now + (ttl as i64 * 1000));
        Self {
            data,
            format,
            created_at: now,
            expires_at,
        }
    }

    /// Returns `true` if this entry has expired (or will expire immediately).
    fn is_expired(&self, now: i64) -> bool {
        self.expires_at.map_or(false, |exp| now >= exp)
    }

    /// Estimated byte size of this entry including overhead.
    fn size_bytes(&self) -> u64 {
        // Account for the entry struct overhead plus payload
        self.data.len() as u64 + 64
    }
}

// ─── Content-Addressable Key ──────────────────────────────────────────────

/// Derive a fixed-size content key from a string key using blake3.
///
/// This provides consistent, collision-resistant addressing for the cache
/// and prevents key-injection issues.
fn content_key(key: &str) -> Hash {
    blake3::hash(key.as_bytes())
}

// ─── Atomic Statistics ────────────────────────────────────────────────────

/// Thread-safe counters backing [`CacheStats`].
#[derive(Debug)]
struct CacheStatsInner {
    entries: AtomicU64,
    size_bytes: AtomicU64,
    hits: AtomicU64,
    misses: AtomicU64,
}

impl CacheStatsInner {
    const fn new() -> Self {
        Self {
            entries: AtomicU64::new(0),
            size_bytes: AtomicU64::new(0),
            hits: AtomicU64::new(0),
            misses: AtomicU64::new(0),
        }
    }

    fn snapshot(&self) -> CacheStats {
        CacheStats {
            entries: self.entries.load(Ordering::Relaxed) as usize,
            size_bytes: self.size_bytes.load(Ordering::Relaxed),
            hits: self.hits.load(Ordering::Relaxed),
            misses: self.misses.load(Ordering::Relaxed),
        }
    }
}

// ─── Cache Layer ──────────────────────────────────────────────────────────

/// A multi-layer cache with hot in-memory storage and optional cold persistent
/// storage.
///
/// # Architecture
///
/// | Layer  | Backing        | Purpose                           |
/// |--------|----------------|-----------------------------------|
/// | Hot    | `DashMap`+`LruCache` | Fast concurrent reads/writes |
/// | Cold   | `sled` Tree     | Durable, larger-than-memory store |
///
/// Keys are hashed with blake3 before storage, making them content-addressable.
/// Expired entries are removed lazily on access and periodically via a
/// background eviction task.
pub struct CacheLayer {
    // ── Hot layer ──────────────────────────────────────────────────────
    /// Concurrent hashmap for O(1) lookups (Arc for shared ownership with
    /// the background eviction task).
    hot: Arc<DashMap<Hash, CacheEntry>>,
    /// LRU ordering tracker; evicts oldest entries when capacity is exceeded.
    lru: Arc<Mutex<LruCache<Hash, ()>>>,

    // ── Cold layer ────────────────────────────────────────────────────
    /// Optional sled tree for persistent storage.
    cold: Option<sled::Tree>,

    // ── Statistics ─────────────────────────────────────────────────────
    stats: Arc<CacheStatsInner>,

    // ── Background eviction ────────────────────────────────────────────
    /// Join handle for the background eviction task (cancelled on drop).
    eviction_handle: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl CacheLayer {
    /// Create a new in-memory-only cache with the given hot-layer capacity.
    ///
    /// `hot_capacity` is the maximum number of entries held in the LRU hot
    /// cache before older entries are evicted.
    ///
    /// A background eviction task is automatically spawned.
    pub fn new(hot_capacity: NonZeroUsize) -> Self {
        let this = Self {
            hot: Arc::new(DashMap::new()),
            lru: Arc::new(Mutex::new(LruCache::new(hot_capacity))),
            cold: None,
            stats: Arc::new(CacheStatsInner::new()),
            eviction_handle: Mutex::new(None),
        };
        this.start_background_eviction();
        this
    }

    /// Create a cache with sled-backed persistence at the given path.
    ///
    /// The cold layer stores serialized entries on disk, surviving process
    /// restarts. Entries accessed from cold are automatically promoted into
    /// the hot layer.
    ///
    /// A background eviction task is automatically spawned.
    pub fn with_persistence(hot_capacity: NonZeroUsize, path: PathBuf) -> AirisResult<Self> {
        let db = sled::open(&path).map_err(|e| {
            AirisError::Cache(format!(
                "Failed to open sled database at {}: {e}",
                path.display()
            ))
        })?;
        let tree = db.open_tree("cache").map_err(|e| {
            AirisError::Cache(format!("Failed to open sled cache tree: {e}"))
        })?;

        let mut this = Self {
            hot: Arc::new(DashMap::with_capacity(hot_capacity.get())),
            lru: Arc::new(Mutex::new(LruCache::new(hot_capacity))),
            cold: Some(tree),
            stats: Arc::new(CacheStatsInner::new()),
            eviction_handle: Mutex::new(None),
        };

        // Restore approximate entry count from cold storage
        this.restore_cold_count();

        this.start_background_eviction();
        Ok(this)
    }

    // ── Raw byte operations ────────────────────────────────────────────

    /// Retrieve a value by key.
    ///
    /// Checks the hot layer first (with LRU promotion on hit). Falls through
    /// to the cold persistent layer if present and promotes the entry to hot.
    pub fn get_raw(&self, key: &str) -> AirisResult<Option<Vec<u8>>> {
        let hash = content_key(key);
        let now = Utc::now().timestamp_millis();

        // ── Hot layer lookup ───────────────────────────────────────────
        if let Some(entry_ref) = self.hot.get(&hash) {
            if entry_ref.is_expired(now) {
                // Expired — remove from hot and continue to cold
                let expired_entry = entry_ref.clone();
                drop(entry_ref);
                self.remove_hot(&hash);
                self.stats.misses.fetch_add(1, Ordering::Relaxed);
                return self.get_from_cold(&hash, now);
            }

            // Cache hit
            let data = entry_ref.data.clone();
            drop(entry_ref);

            // Promote in LRU
            self.lru.lock().get(&hash);

            self.stats.hits.fetch_add(1, Ordering::Relaxed);
            return Ok(Some(data));
        }

        // ── Cold layer lookup ──────────────────────────────────────────
        self.get_from_cold(&hash, now)
    }

    /// Insert a value with optional TTL (in seconds).
    ///
    /// A `None` TTL means the entry never expires.
    pub fn set_raw(&self, key: &str, value: Vec<u8>, ttl_secs: Option<u64>) -> AirisResult<()> {
        let hash = content_key(key);
        let entry = CacheEntry::new(value, CacheFormat::Binary, ttl_secs);
        let size = entry.size_bytes();

        // ── Hot layer ──────────────────────────────────────────────────
        if let Some(old) = self.hot.insert(hash, entry) {
            self.stats.size_bytes.fetch_sub(old.size_bytes(), Ordering::Relaxed);
        } else {
            self.stats.entries.fetch_add(1, Ordering::Relaxed);
        }
        self.stats.size_bytes.fetch_add(size, Ordering::Relaxed);

        // ── LRU eviction ───────────────────────────────────────────────
        let mut lru = self.lru.lock();
        let evicted = lru.push(hash, ());
        drop(lru);

        if let Some((evicted_hash, ())) = evicted {
            if evicted_hash != hash {
                if let Some((_, evicted_entry)) = self.hot.remove(&evicted_hash) {
                    self.stats.entries.fetch_sub(1, Ordering::Relaxed);
                    self.stats.size_bytes.fetch_sub(evicted_entry.size_bytes(), Ordering::Relaxed);
                }
            }
        }

        // ── Cold layer ─────────────────────────────────────────────────
        self.store_to_cold(&hash, &CacheFormat::Binary)?;

        Ok(())
    }

    /// Delete a key and its value from all layers.
    pub fn delete_raw(&self, key: &str) -> AirisResult<()> {
        let hash = content_key(key);
        self.remove_hot(&hash);
        self.remove_from_cold(&hash)
    }

    /// Check whether a key exists and has not expired.
    pub fn exists_raw(&self, key: &str) -> AirisResult<bool> {
        let hash = content_key(key);
        let now = Utc::now().timestamp_millis();

        // Check hot layer
        if let Some(entry_ref) = self.hot.get(&hash) {
            if !entry_ref.is_expired(now) {
                return Ok(true);
            }
        }

        // Check cold layer
        if let Some(ref tree) = self.cold {
            if let Some(value_bytes) = tree.get(hash.as_bytes()).map_err(|e| {
                AirisError::Cache(format!("Cold store read error: {e}"))
            })? {
                if let Ok(entry) = rmp_serde::from_slice::<CacheEntry>(&value_bytes) {
                    if !entry.is_expired(now) {
                        return Ok(true);
                    }
                }
            }
        }

        Ok(false)
    }

    /// Remove all entries from every layer and reset statistics.
    pub fn clear_raw(&self) -> AirisResult<()> {
        self.hot.clear();
        self.lru.lock().clear();

        if let Some(ref tree) = self.cold {
            tree.clear().map_err(|e| {
                AirisError::Cache(format!("Failed to clear cold store: {e}"))
            })?;
        }

        self.stats.entries.store(0, Ordering::Relaxed);
        self.stats.size_bytes.store(0, Ordering::Relaxed);
        self.stats.hits.store(0, Ordering::Relaxed);
        self.stats.misses.store(0, Ordering::Relaxed);

        Ok(())
    }

    /// Get current cache statistics.
    pub fn stats_raw(&self) -> CacheStats {
        self.stats.snapshot()
    }

    // ── JSON serialization helpers ─────────────────────────────────────

    /// Serialize a value as JSON and store it in the cache.
    pub fn set_json<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl_secs: Option<u64>,
    ) -> AirisResult<()> {
        let data = serde_json::to_vec(value)?;
        let hash = content_key(key);
        let entry = CacheEntry::new(data, CacheFormat::Json, ttl_secs);
        let size = entry.size_bytes();

        // Insert into hot
        if let Some(old) = self.hot.insert(hash, entry) {
            self.stats.size_bytes.fetch_sub(old.size_bytes(), Ordering::Relaxed);
        } else {
            self.stats.entries.fetch_add(1, Ordering::Relaxed);
        }
        self.stats.size_bytes.fetch_add(size, Ordering::Relaxed);

        // LRU eviction
        let mut lru = self.lru.lock();
        let evicted = lru.push(hash, ());
        drop(lru);

        if let Some((evicted_hash, ())) = evicted {
            if evicted_hash != hash {
                if let Some((_, evicted_entry)) = self.hot.remove(&evicted_hash) {
                    self.stats.entries.fetch_sub(1, Ordering::Relaxed);
                    self.stats.size_bytes.fetch_sub(evicted_entry.size_bytes(), Ordering::Relaxed);
                }
            }
        }

        // Persist if cold layer active
        self.store_to_cold(&hash, &CacheFormat::Json)?;

        Ok(())
    }

    /// Retrieve and deserialize a JSON value from the cache.
    pub fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        key: &str,
    ) -> AirisResult<Option<T>> {
        let hash = content_key(key);
        let now = Utc::now().timestamp_millis();

        // Hot lookup
        if let Some(entry_ref) = self.hot.get(&hash) {
            if entry_ref.is_expired(now) {
                let entry = entry_ref.clone();
                drop(entry_ref);
                self.remove_hot(&hash);
                self.stats.misses.fetch_add(1, Ordering::Relaxed);
                return self.decode_json_from_cold(&hash, now);
            }

            if entry_ref.format != CacheFormat::Json {
                self.stats.misses.fetch_add(1, Ordering::Relaxed);
                return Err(AirisError::Cache(
                    "Stored value is not JSON format".into(),
                ));
            }

            let data = entry_ref.data.clone();
            drop(entry_ref);
            self.lru.lock().get(&hash);
            self.stats.hits.fetch_add(1, Ordering::Relaxed);

            let value = serde_json::from_slice(&data)?;
            return Ok(Some(value));
        }

        // Cold lookup
        self.decode_json_from_cold(&hash, now)
    }

    // ── MessagePack serialization helpers ──────────────────────────────

    /// Serialize a value as MessagePack and store it in the cache.
    pub fn set_msgpack<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl_secs: Option<u64>,
    ) -> AirisResult<()> {
        let data = rmp_serde::to_vec(value)
            .map_err(|e| AirisError::Cache(format!("MessagePack encode error: {e}")))?;
        let hash = content_key(key);
        let entry = CacheEntry::new(data, CacheFormat::MessagePack, ttl_secs);
        let size = entry.size_bytes();

        if let Some(old) = self.hot.insert(hash, entry) {
            self.stats.size_bytes.fetch_sub(old.size_bytes(), Ordering::Relaxed);
        } else {
            self.stats.entries.fetch_add(1, Ordering::Relaxed);
        }
        self.stats.size_bytes.fetch_add(size, Ordering::Relaxed);

        let mut lru = self.lru.lock();
        let evicted = lru.push(hash, ());
        drop(lru);

        if let Some((evicted_hash, ())) = evicted {
            if evicted_hash != hash {
                if let Some((_, evicted_entry)) = self.hot.remove(&evicted_hash) {
                    self.stats.entries.fetch_sub(1, Ordering::Relaxed);
                    self.stats.size_bytes.fetch_sub(evicted_entry.size_bytes(), Ordering::Relaxed);
                }
            }
        }

        self.store_to_cold(&hash, &CacheFormat::MessagePack)?;

        Ok(())
    }

    /// Retrieve and deserialize a MessagePack value from the cache.
    pub fn get_msgpack<T: serde::de::DeserializeOwned>(
        &self,
        key: &str,
    ) -> AirisResult<Option<T>> {
        let hash = content_key(key);
        let now = Utc::now().timestamp_millis();

        // Hot lookup
        if let Some(entry_ref) = self.hot.get(&hash) {
            if entry_ref.is_expired(now) {
                let entry = entry_ref.clone();
                drop(entry_ref);
                self.remove_hot(&hash);
                self.stats.misses.fetch_add(1, Ordering::Relaxed);
                return self.decode_msgpack_from_cold(&hash, now);
            }

            if entry_ref.format != CacheFormat::MessagePack {
                self.stats.misses.fetch_add(1, Ordering::Relaxed);
                return Err(AirisError::Cache(
                    "Stored value is not MessagePack format".into(),
                ));
            }

            let data = entry_ref.data.clone();
            drop(entry_ref);
            self.lru.lock().get(&hash);
            self.stats.hits.fetch_add(1, Ordering::Relaxed);

            let value = rmp_serde::from_slice(&data)
                .map_err(|e| AirisError::Cache(format!("MessagePack decode error: {e}")))?;
            return Ok(Some(value));
        }

        // Cold lookup
        self.decode_msgpack_from_cold(&hash, now)
    }

    // ── Internal hot helpers ───────────────────────────────────────────

    /// Remove an entry from the hot layer and LRU tracker, updating stats.
    fn remove_hot(&self, hash: &Hash) {
        if let Some((_, entry)) = self.hot.remove(hash) {
            self.lru.lock().pop(hash);
            self.stats.entries.fetch_sub(1, Ordering::Relaxed);
            self.stats.size_bytes.fetch_sub(entry.size_bytes(), Ordering::Relaxed);
        }
    }

    // ── Internal cold helpers ──────────────────────────────────────────

    /// Look up a hash in the cold store, promoting to hot on hit.
    fn get_from_cold(&self, hash: &Hash, now: i64) -> AirisResult<Option<Vec<u8>>> {
        let tree = match self.cold {
            Some(ref t) => t,
            None => {
                self.stats.misses.fetch_add(1, Ordering::Relaxed);
                return Ok(None);
            }
        };

        let value_bytes = match tree.get(hash.as_bytes()).map_err(|e| {
            AirisError::Cache(format!("Cold store read error: {e}"))
        })? {
            Some(b) => b,
            None => {
                self.stats.misses.fetch_add(1, Ordering::Relaxed);
                return Ok(None);
            }
        };

        let entry: CacheEntry = rmp_serde::from_slice(&value_bytes).map_err(|e| {
            AirisError::Cache(format!("Cold store deserialization error: {e}"))
        })?;

        if entry.is_expired(now) {
            // Clean up expired cold entry
            let _ = tree.remove(hash.as_bytes());
            self.stats.misses.fetch_add(1, Ordering::Relaxed);
            return Ok(None);
        }

        // ── Promote to hot layer ───────────────────────────────────────
        let data = entry.data.clone();
        let size = entry.size_bytes();

        // Insert into hot
        self.hot.insert(*hash, entry);
        self.stats.entries.fetch_add(1, Ordering::Relaxed);
        self.stats.size_bytes.fetch_add(size, Ordering::Relaxed);

        // Update LRU
        let mut lru = self.lru.lock();
        let evicted = lru.push(*hash, ());
        drop(lru);

        if let Some((evicted_hash, ())) = evicted {
            if evicted_hash != *hash {
                if let Some((_, evicted_entry)) = self.hot.remove(&evicted_hash) {
                    self.stats.entries.fetch_sub(1, Ordering::Relaxed);
                    self.stats.size_bytes.fetch_sub(evicted_entry.size_bytes(), Ordering::Relaxed);
                }
            }
        }

        self.stats.hits.fetch_add(1, Ordering::Relaxed);
        Ok(Some(data))
    }

    /// Serialize the entry associated with `hash` to the cold store.
    fn store_to_cold(&self, hash: &Hash, format: &CacheFormat) -> AirisResult<()> {
        let tree = match self.cold {
            Some(ref t) => t,
            None => return Ok(()),
        };

        // Read current entry from hot (already inserted)
        let entry = match self.hot.get(hash) {
            Some(e) => {
                // Clone the entry but fix the format so cold matches the caller's format
                let entry = CacheEntry {
                    data: e.data.clone(),
                    format: *format,
                    created_at: e.created_at,
                    expires_at: e.expires_at,
                };
                drop(e);
                entry
            }
            None => return Ok(()),
        };

        let value_bytes = rmp_serde::to_vec(&entry).map_err(|e| {
            AirisError::Cache(format!("Cold store serialization error: {e}"))
        })?;

        tree.insert(hash.as_bytes(), value_bytes).map_err(|e| {
            AirisError::Cache(format!("Cold store write error: {e}"))
        })?;

        // Flush for durability (best-effort)
        let _ = tree.flush();

        Ok(())
    }

    /// Remove a key from the cold store.
    fn remove_from_cold(&self, hash: &Hash) -> AirisResult<()> {
        if let Some(ref tree) = self.cold {
            tree.remove(hash.as_bytes()).map_err(|e| {
                AirisError::Cache(format!("Cold store remove error: {e}"))
            })?;
        }
        Ok(())
    }

    // ── Internal typed cold helpers ────────────────────────────────────

    fn decode_json_from_cold<T: serde::de::DeserializeOwned>(
        &self,
        hash: &Hash,
        now: i64,
    ) -> AirisResult<Option<T>> {
        let raw = self.get_from_cold(hash, now)?;
        match raw {
            Some(data) => {
                let value = serde_json::from_slice(&data)?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    fn decode_msgpack_from_cold<T: serde::de::DeserializeOwned>(
        &self,
        hash: &Hash,
        now: i64,
    ) -> AirisResult<Option<T>> {
        let raw = self.get_from_cold(hash, now)?;
        match raw {
            Some(data) => {
                let value = rmp_serde::from_slice(&data)
                    .map_err(|e| AirisError::Cache(format!("MessagePack decode error: {e}")))?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    // ── Cold entry count restoration ───────────────────────────────────

    /// Scan cold storage to approximate the hot-entry count for stats.
    fn restore_cold_count(&mut self) {
        let tree = match self.cold {
            Some(ref t) => t,
            None => return,
        };

        // This is a best-effort count of cold entries; it does not account for
        // overlap with hot entries, so the resulting `entries` stat is a
        // rough upper bound.
        let count = tree.len();
        if count > 0 {
            self.stats.entries.store(count as u64, Ordering::Relaxed);
        }
    }

    // ── Background eviction ────────────────────────────────────────────

    /// Spawn the background eviction task that periodically removes expired
    /// entries from the hot and cold layers.
    fn start_background_eviction(&self) {
        let hot = self.hot.clone();
        let lru = self.lru.clone();
        let cold = self.cold.clone();
        let stats = self.stats.clone();

        let handle = tokio::spawn(async move {
            let mut hot_interval =
                tokio::time::interval(Duration::from_secs(HOT_EVICTION_INTERVAL_SECS));
            let mut cold_interval =
                tokio::time::interval(Duration::from_secs(COLD_EVICTION_INTERVAL_SECS));

            // Skew the cold interval so they don't fire in lockstep
            cold_interval.reset_after(Duration::from_secs(COLD_EVICTION_INTERVAL_SECS / 2));

            loop {
                tokio::select! {
                    _ = hot_interval.tick() => {
                        Self::evict_expired_hot(&hot, &lru, &stats);
                    }
                    _ = cold_interval.tick() => {
                        if let Some(ref tree) = cold {
                            Self::evict_expired_cold(tree, &stats);
                        }
                    }
                }
            }
        });

        *self.eviction_handle.lock() = Some(handle);
    }

    /// Remove expired entries from the hot layer.
    fn evict_expired_hot(
        hot: &DashMap<Hash, CacheEntry>,
        lru: &Mutex<LruCache<Hash, ()>>,
        stats: &CacheStatsInner,
    ) {
        let now = Utc::now().timestamp_millis();
        let mut evicted_count: u64 = 0;
        let mut evicted_bytes: u64 = 0;
        let mut evicted_hashes: Vec<Hash> = Vec::new();

        hot.retain(|hash, entry| {
            if entry.is_expired(now) {
                evicted_count += 1;
                evicted_bytes += entry.size_bytes();
                evicted_hashes.push(*hash);
                false // remove
            } else {
                true // keep
            }
        });

        // Clean up LRU entries that were evicted from hot
        if !evicted_hashes.is_empty() {
            let mut lru_guard = lru.lock();
            for hash in &evicted_hashes {
                lru_guard.pop(hash);
            }
        }

        if evicted_count > 0 {
            stats.entries.fetch_sub(evicted_count, Ordering::Relaxed);
            stats.size_bytes.fetch_sub(evicted_bytes, Ordering::Relaxed);
            debug!(evicted_count, "Background eviction removed expired hot entries");
        }
    }

    /// Remove expired entries from the cold persistent layer.
    fn evict_expired_cold(tree: &sled::Tree, stats: &CacheStatsInner) {
        let now = Utc::now().timestamp_millis();
        let mut batch = Vec::new();
        let mut evicted_count: u64 = 0;

        for result in tree.iter() {
            let (key, value) = match result {
                Ok(kv) => (kv.0, kv.1),
                Err(e) => {
                    warn!("Error iterating cold cache during eviction: {e}");
                    continue;
                }
            };

            if let Ok(entry) = rmp_serde::from_slice::<CacheEntry>(&value) {
                if entry.is_expired(now) {
                    batch.push(key.to_vec());
                    evicted_count += 1;
                }
            }
        }

        for key in batch {
            if let Err(e) = tree.remove(key) {
                warn!("Error removing expired cold entry: {e}");
            }
        }

        if evicted_count > 0 {
            stats.entries.fetch_sub(evicted_count, Ordering::Relaxed);
            debug!(evicted_count, "Background eviction removed expired cold entries");
        }
    }
}

// ─── Async Trait Implementation ──────────────────────────────────────────

#[async_trait]
impl CacheStore for CacheLayer {
    async fn get(&self, key: &str) -> AirisResult<Option<Vec<u8>>> {
        self.get_raw(key)
    }

    async fn set(&self, key: &str, value: Vec<u8>, ttl_secs: Option<u64>) -> AirisResult<()> {
        self.set_raw(key, value, ttl_secs)
    }

    async fn delete(&self, key: &str) -> AirisResult<()> {
        self.delete_raw(key)
    }

    async fn exists(&self, key: &str) -> AirisResult<bool> {
        self.exists_raw(key)
    }

    async fn clear(&self) -> AirisResult<()> {
        self.clear_raw()
    }

    async fn stats(&self) -> AirisResult<CacheStats> {
        Ok(self.stats_raw())
    }
}

// ─── Drop ─────────────────────────────────────────────────────────────────

impl Drop for CacheLayer {
    fn drop(&mut self) {
        if let Some(handle) = self.eviction_handle.lock().take() {
            handle.abort();
        }
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::num::NonZeroUsize;

    fn test_cache() -> CacheLayer {
        CacheLayer::new(NonZeroUsize::new(100).unwrap())
    }

    // ── Basic operations ───────────────────────────────────────────────

    #[test]
    fn test_get_set() {
        let cache = test_cache();
        cache.set_raw("key1", b"hello".to_vec(), None).unwrap();
        let val = cache.get_raw("key1").unwrap();
        assert_eq!(val, Some(b"hello".to_vec()));
    }

    #[test]
    fn test_get_missing() {
        let cache = test_cache();
        assert_eq!(cache.get_raw("nope").unwrap(), None);
    }

    #[test]
    fn test_delete() {
        let cache = test_cache();
        cache.set_raw("key1", b"data".to_vec(), None).unwrap();
        assert!(cache.exists_raw("key1").unwrap());
        cache.delete_raw("key1").unwrap();
        assert!(!cache.exists_raw("key1").unwrap());
        assert_eq!(cache.get_raw("key1").unwrap(), None);
    }

    #[test]
    fn test_exists() {
        let cache = test_cache();
        assert!(!cache.exists_raw("key1").unwrap());
        cache.set_raw("key1", b"data".to_vec(), None).unwrap();
        assert!(cache.exists_raw("key1").unwrap());
    }

    #[test]
    fn test_clear() {
        let cache = test_cache();
        cache.set_raw("a", b"1".to_vec(), None).unwrap();
        cache.set_raw("b", b"2".to_vec(), None).unwrap();
        cache.clear_raw().unwrap();
        assert_eq!(cache.get_raw("a").unwrap(), None);
        assert_eq!(cache.get_raw("b").unwrap(), None);
        let stats = cache.stats_raw();
        assert_eq!(stats.entries, 0);
        assert_eq!(stats.size_bytes, 0);
    }

    // ── TTL ────────────────────────────────────────────────────────────

    #[test]
    fn test_ttl_expiry() {
        let cache = test_cache();
        // TTL = 1 millisecond (minimum effective) — use 0 seconds
        cache.set_raw("key1", b"gone".to_vec(), Some(0)).unwrap();
        // Sleep long enough for the TTL to expire
        std::thread::sleep(std::time::Duration::from_millis(50));
        assert_eq!(cache.get_raw("key1").unwrap(), None);
    }

    #[test]
    fn test_ttl_no_expiry() {
        let cache = test_cache();
        cache.set_raw("permanent", b"stays".to_vec(), None).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        assert_eq!(
            cache.get_raw("permanent").unwrap(),
            Some(b"stays".to_vec())
        );
    }

    // ── LRU eviction ───────────────────────────────────────────────────

    #[test]
    fn test_lru_eviction() {
        let cache = CacheLayer::new(NonZeroUsize::new(2).unwrap());
        cache.set_raw("k1", b"v1".to_vec(), None).unwrap();
        cache.set_raw("k2", b"v2".to_vec(), None).unwrap();
        // Fill past capacity — k1 should be evicted
        cache.set_raw("k3", b"v3".to_vec(), None).unwrap();
        assert_eq!(cache.get_raw("k1").unwrap(), None, "k1 evicted by LRU");
        assert_eq!(cache.get_raw("k2").unwrap(), Some(b"v2".to_vec()), "k2 still present");
        assert_eq!(cache.get_raw("k3").unwrap(), Some(b"v3".to_vec()), "k3 still present");
    }

    #[test]
    fn test_lru_recently_used_preserved() {
        let cache = CacheLayer::new(NonZeroUsize::new(2).unwrap());
        cache.set_raw("k1", b"v1".to_vec(), None).unwrap();
        cache.set_raw("k2", b"v2".to_vec(), None).unwrap();
        // Access k1 so it becomes recently used
        let _ = cache.get_raw("k1");
        // Insert k3 — should evict k2 (the LRU entry), not k1
        cache.set_raw("k3", b"v3".to_vec(), None).unwrap();
        assert_eq!(cache.get_raw("k1").unwrap(), Some(b"v1".to_vec()), "k1 preserved by LRU promotion");
        assert_eq!(cache.get_raw("k2").unwrap(), None, "k2 evicted");
    }

    // ── Stats ──────────────────────────────────────────────────────────

    #[test]
    fn test_stats_hits_misses() {
        let cache = test_cache();
        cache.set_raw("k", b"v".to_vec(), None).unwrap();

        let _ = cache.get_raw("k"); // hit
        let _ = cache.get_raw("k"); // hit
        let _ = cache.get_raw("missing"); // miss

        let stats = cache.stats_raw();
        assert_eq!(stats.hits, 2);
        assert_eq!(stats.misses, 1);
        assert_eq!(stats.entries, 1);
        assert!(stats.size_bytes > 0);
    }

    #[test]
    fn test_stats_after_delete() {
        let cache = test_cache();
        cache.set_raw("k", b"v".to_vec(), None).unwrap();
        assert_eq!(cache.stats_raw().entries, 1);
        cache.delete_raw("k").unwrap();
        assert_eq!(cache.stats_raw().entries, 0);
    }

    // ── JSON helpers ───────────────────────────────────────────────────

    #[test]
    fn test_json_roundtrip() {
        let cache = test_cache();
        let value = vec!["hello", "world"];
        cache.set_json("list", &value, None).unwrap();
        let result: Vec<String> = cache.get_json("list").unwrap().unwrap();
        assert_eq!(result, vec!["hello".to_string(), "world".to_string()]);
    }

    #[test]
    fn test_json_struct() {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
        struct Foo {
            name: String,
            count: u32,
        }

        let cache = test_cache();
        let foo = Foo { name: "test".into(), count: 42 };
        cache.set_json("foo", &foo, None).unwrap();
        let result: Foo = cache.get_json("foo").unwrap().unwrap();
        assert_eq!(result, foo);
    }

    // ── MessagePack helpers ────────────────────────────────────────────

    #[test]
    fn test_msgpack_roundtrip() {
        let cache = test_cache();
        let value = vec![1u64, 2, 3, 4];
        cache.set_msgpack("nums", &value, None).unwrap();
        let result: Vec<u64> = cache.get_msgpack("nums").unwrap().unwrap();
        assert_eq!(result, vec![1, 2, 3, 4]);
    }

    // ── Content addressing ─────────────────────────────────────────────

    #[test]
    fn test_content_key_consistency() {
        let h1 = content_key("hello");
        let h2 = content_key("hello");
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_content_key_different() {
        let h1 = content_key("hello");
        let h2 = content_key("world");
        assert_ne!(h1, h2);
    }

    // ── Persistence ────────────────────────────────────────────────────

    #[test]
    fn test_persistence_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("cache.sled");

        {
            let cache =
                CacheLayer::with_persistence(NonZeroUsize::new(100).unwrap(), path.clone())
                    .unwrap();
            cache.set_raw("persist", b"survived".to_vec(), None).unwrap();
            cache.set_raw("temp", b"gone".to_vec(), Some(0)).unwrap();
        }

        // Open again — cold entries should be readable
        {
            let cache =
                CacheLayer::with_persistence(NonZeroUsize::new(100).unwrap(), path).unwrap();
            assert_eq!(
                cache.get_raw("persist").unwrap(),
                Some(b"survived".to_vec())
            );
            // TTL=0 entry should be expired by now
            assert_eq!(cache.get_raw("temp").unwrap(), None);
        }
    }

    // ── CacheStore trait ───────────────────────────────────────────────

    #[tokio::test]
    async fn test_cache_store_trait() {
        let cache = test_cache();
        let store: &dyn CacheStore = &cache;

        store.set("tk", b"trait-value".to_vec(), None).await.unwrap();
        let val = store.get("tk").await.unwrap().unwrap();
        assert_eq!(val, b"trait-value");

        assert!(store.exists("tk").await.unwrap());

        let stats = store.stats().await.unwrap();
        assert_eq!(stats.hits, 1, "one get hit");
        assert_eq!(stats.entries, 1, "one entry before delete");

        store.delete("tk").await.unwrap();
        assert!(!store.exists("tk").await.unwrap());

        let stats = store.stats().await.unwrap();
        assert_eq!(stats.entries, 0, "zero after delete");
    }

    #[tokio::test]
    async fn test_cache_store_clear() {
        let cache = test_cache();
        cache.set_raw("a", b"1".to_vec(), None).unwrap();
        cache.set_raw("b", b"2".to_vec(), None).unwrap();
        CacheStore::clear(&cache).await.unwrap();
        assert_eq!(cache.stats_raw().entries, 0);
    }
}
