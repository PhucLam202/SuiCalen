/**
 * In-memory cache utility for APR data
 * Provides TTL (Time To Live) based caching
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Generic in-memory cache with TTL support
 */
export class Cache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private ttl: number; // Time to live in milliseconds

  constructor(ttl: number = 60000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  /**
   * Get data from cache
   * @param key Cache key
   * @returns Cached data or null if not found/expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      // Entry expired, remove it
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set data in cache
   * @param key Cache key
   * @param data Data to cache
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Check if key exists and is valid (not expired)
   * @param key Cache key
   * @returns True if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      // Entry expired, remove it
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Get cache size (number of entries)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Set TTL for future entries
   * @param ttl Time to live in milliseconds
   */
  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  /**
   * Get current TTL
   */
  getTTL(): number {
    return this.ttl;
  }
}

/**
 * Create cache instance with default TTL (1 minute)
 */
export function createCache<T>(ttl: number = 60000): Cache<T> {
  return new Cache<T>(ttl);
}
