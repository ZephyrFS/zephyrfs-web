import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';

interface CacheEntry {
  data: any;
  headers: Record<string, string>;
  statusCode: number;
  timestamp: number;
  ttl: number;
  size: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private currentSize = 0;
  private maxEntrySize: number;
  private defaultTTL: number;

  constructor(options: {
    maxSize?: number;
    maxEntrySize?: number;
    defaultTTL?: number;
  } = {}) {
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB
    this.maxEntrySize = options.maxEntrySize || 10 * 1024 * 1024; // 10MB per entry
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
  }

  set(key: string, data: any, headers: Record<string, string>, statusCode: number, ttl?: number): boolean {
    const size = this.estimateSize(data);

    // Don't cache large entries
    if (size > this.maxEntrySize) {
      return false;
    }

    // Evict entries if needed
    this.evictIfNeeded(size);

    const entry: CacheEntry = {
      data,
      headers,
      statusCode,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      size,
    };

    this.cache.set(key, entry);
    this.currentSize += size;

    return true;
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }

    return entry;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.currentSize -= entry.size;
      return true;
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  getStats() {
    return {
      entries: this.cache.size,
      size: this.currentSize,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate(),
    };
  }

  private evictIfNeeded(newEntrySize: number): void {
    // Use LRU eviction
    while (this.currentSize + newEntrySize > this.maxSize && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.delete(oldestKey);
      }
    }
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default size if can't stringify
    }
  }

  private hitRate = 0;
  private hits = 0;
  private misses = 0;

  recordHit(): void {
    this.hits++;
    this.updateHitRate();
  }

  recordMiss(): void {
    this.misses++;
    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.hits + this.misses;
    this.hitRate = total > 0 ? (this.hits / total) * 100 : 0;
  }

  private calculateHitRate(): number {
    return this.hitRate;
  }
}

const cache = new MemoryCache();

export async function cacheMiddleware(fastify: FastifyInstance) {
  // Cache configuration
  const cacheConfig = {
    // Routes that should be cached
    cacheable: [
      '/api/files',
      '/api/status/network',
      '/api/status/node',
    ],
    // Routes that should never be cached
    nocache: [
      '/api/auth/',
      '/api/files/upload',
      '/api/files/bulk/',
    ],
    // Default TTL for different route patterns
    ttl: {
      '/api/files': 30 * 1000, // 30 seconds
      '/api/status/': 10 * 1000, // 10 seconds
    },
  };

  // Pre-handler to check cache
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only cache GET requests
    if (request.method !== 'GET') {
      return;
    }

    // Check if route should be cached
    if (!shouldCacheRoute(request.url, cacheConfig)) {
      return;
    }

    const cacheKey = generateCacheKey(request);
    const cached = cache.get(cacheKey);

    if (cached) {
      cache.recordHit();

      // Set cached headers
      Object.entries(cached.headers).forEach(([key, value]) => {
        reply.header(key, value);
      });

      // Add cache headers
      reply.header('X-Cache', 'HIT');
      reply.header('X-Cache-Time', new Date(cached.timestamp).toISOString());

      reply.code(cached.statusCode);
      return reply.send(cached.data);
    } else {
      cache.recordMiss();
      reply.header('X-Cache', 'MISS');
    }
  });

  // Post-handler to cache responses
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    // Only cache successful GET requests
    if (request.method !== 'GET' || reply.statusCode >= 400) {
      return payload;
    }

    // Check if route should be cached
    if (!shouldCacheRoute(request.url, cacheConfig)) {
      return payload;
    }

    // Don't cache if already cached
    if (reply.getHeader('X-Cache') === 'HIT') {
      return payload;
    }

    const cacheKey = generateCacheKey(request);
    const ttl = getTTLForRoute(request.url, cacheConfig);

    // Get response headers (excluding some)
    const headers: Record<string, string> = {};
    const excludeHeaders = ['set-cookie', 'authorization', 'x-cache'];

    Object.entries(reply.getHeaders()).forEach(([key, value]) => {
      if (!excludeHeaders.includes(key.toLowerCase()) && typeof value === 'string') {
        headers[key] = value;
      }
    });

    // Cache the response
    cache.set(cacheKey, payload, headers, reply.statusCode, ttl);

    return payload;
  });

  // Cache management endpoints
  fastify.get('/api/cache/stats', async () => {
    return cache.getStats();
  });

  fastify.delete('/api/cache/clear', {
    preHandler: fastify.authenticate,
  }, async () => {
    cache.clear();
    return { success: true, message: 'Cache cleared' };
  });

  fastify.delete('/api/cache/invalidate', {
    preHandler: fastify.authenticate,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest) => {
    const { pattern } = request.query as { pattern?: string };

    if (!pattern) {
      return { success: false, message: 'Pattern is required' };
    }

    let invalidated = 0;
    const regex = new RegExp(pattern);

    for (const key of cache['cache'].keys()) {
      if (regex.test(key)) {
        cache.delete(key);
        invalidated++;
      }
    }

    return {
      success: true,
      message: `Invalidated ${invalidated} cache entries`,
      invalidated,
    };
  });

  // Periodic cache cleanup
  setInterval(() => {
    const stats = cache.getStats();
    fastify.log.debug({
      cache: {
        entries: stats.entries,
        sizeMB: Math.round(stats.size / 1024 / 1024),
        hitRate: Math.round(stats.hitRate * 100) / 100,
      },
    }, 'Cache statistics');

    // Force cleanup if cache is getting full
    if (stats.size > stats.maxSize * 0.9) {
      // Remove oldest 10% of entries
      const keysToRemove = Math.floor(stats.entries * 0.1);
      let removed = 0;

      for (const key of cache['cache'].keys()) {
        if (removed >= keysToRemove) break;
        cache.delete(key);
        removed++;
      }

      fastify.log.info({ removedEntries: removed }, 'Cache cleanup performed');
    }
  }, 60 * 1000); // Check every minute
}

function shouldCacheRoute(url: string, config: any): boolean {
  // Check nocache patterns first
  for (const pattern of config.nocache) {
    if (url.startsWith(pattern)) {
      return false;
    }
  }

  // Check cacheable patterns
  for (const pattern of config.cacheable) {
    if (url.startsWith(pattern)) {
      return true;
    }
  }

  return false;
}

function generateCacheKey(request: FastifyRequest): string {
  const url = request.url;
  const method = request.method;
  const headers = request.headers;

  // Include relevant headers in cache key
  const relevantHeaders = ['accept', 'accept-encoding'];
  const headerKey = relevantHeaders
    .map(h => `${h}:${headers[h] || ''}`)
    .join('|');

  const keyString = `${method}:${url}:${headerKey}`;

  return createHash('md5').update(keyString).digest('hex');
}

function getTTLForRoute(url: string, config: any): number {
  for (const [pattern, ttl] of Object.entries(config.ttl)) {
    if (url.startsWith(pattern)) {
      return ttl as number;
    }
  }

  return 5 * 60 * 1000; // Default 5 minutes
}