/**
 * Lightweight in-process TTL cache.
 *
 * Zero external dependencies — uses a plain Map with per-entry expiry timestamps.
 * Suitable for caching short-lived, high-frequency read results such as the
 * queue-overview snapshot (TTL: 5 s) where a dedicated Redis instance would be
 * disproportionate infrastructure overhead.
 *
 * Usage:
 *   const cache = require('../config/memoryCache');
 *   cache.set('key', value, 5000);   // store for 5 s
 *   const v = cache.get('key');      // null if missing or expired
 *   cache.invalidate('key');         // remove one entry
 *   cache.invalidateAll();           // flush everything
 */

class MemoryCache {
    constructor() {
        this._store = new Map();
    }

    /**
     * Store a value under key for ttlMs milliseconds.
     * @param {string} key
     * @param {*} value
     * @param {number} [ttlMs=5000]
     */
    set(key, value, ttlMs = 5000) {
        this._store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs
        });
    }

    /**
     * Retrieve a value. Returns null if missing or expired (and cleans up stale entry).
     * @param {string} key
     * @returns {*|null}
     */
    get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.value;
    }

    /**
     * Remove a specific cache entry immediately.
     * @param {string} key
     */
    invalidate(key) {
        this._store.delete(key);
    }

    /**
     * Flush all entries — useful in tests or after destructive writes.
     */
    invalidateAll() {
        this._store.clear();
    }

    /**
     * Number of entries currently held (includes stale, for diagnostics).
     */
    get size() {
        return this._store.size;
    }
}

// Export a singleton so all modules share the same cache store.
module.exports = new MemoryCache();
