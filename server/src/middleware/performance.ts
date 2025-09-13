import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  activeConnections: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  responseTimes: number[];
  errors: number;
  lastReset: Date;
}

const metrics: PerformanceMetrics = {
  requestCount: 0,
  averageResponseTime: 0,
  p95ResponseTime: 0,
  p99ResponseTime: 0,
  errorRate: 0,
  activeConnections: 0,
  memoryUsage: process.memoryUsage(),
  cpuUsage: process.cpuUsage(),
  responseTimes: [],
  errors: 0,
  lastReset: new Date(),
};

// Keep last 1000 response times for percentile calculations
const MAX_RESPONSE_TIMES = 1000;

export async function performanceMiddleware(fastify: FastifyInstance) {
  // Request timing
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.startTime = performance.now();
    metrics.activeConnections++;
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const responseTime = performance.now() - (request.startTime || 0);

    metrics.requestCount++;
    metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);

    // Track response times
    metrics.responseTimes.push(responseTime);
    if (metrics.responseTimes.length > MAX_RESPONSE_TIMES) {
      metrics.responseTimes.shift();
    }

    // Track errors
    if (reply.statusCode >= 400) {
      metrics.errors++;
    }

    // Update metrics
    updateMetrics();

    // Log slow requests
    if (responseTime > 5000) {
      fastify.log.warn({
        url: request.url,
        method: request.method,
        responseTime,
        statusCode: reply.statusCode,
      }, 'Slow request detected');
    }
  });

  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    metrics.errors++;
    metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);
    updateMetrics();
  });

  // Metrics endpoint
  fastify.get('/api/metrics', async () => {
    return {
      ...metrics,
      uptime: process.uptime(),
      timestamp: new Date(),
    };
  });

  // Health check with performance data
  fastify.get('/api/health/detailed', async () => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      status: 'healthy',
      performance: {
        responseTime: {
          average: metrics.averageResponseTime,
          p95: metrics.p95ResponseTime,
          p99: metrics.p99ResponseTime,
        },
        throughput: {
          requestsPerSecond: calculateRequestsPerSecond(),
          activeConnections: metrics.activeConnections,
        },
        errors: {
          rate: metrics.errorRate,
          total: metrics.errors,
        },
        system: {
          memory: {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
          },
          uptime: process.uptime(),
        },
      },
      timestamp: new Date(),
    };
  });

  // Start periodic metrics collection
  startMetricsCollection(fastify);
}

function updateMetrics() {
  if (metrics.responseTimes.length === 0) return;

  // Calculate average
  const sum = metrics.responseTimes.reduce((a, b) => a + b, 0);
  metrics.averageResponseTime = sum / metrics.responseTimes.length;

  // Calculate percentiles
  const sorted = [...metrics.responseTimes].sort((a, b) => a - b);
  metrics.p95ResponseTime = percentile(sorted, 0.95);
  metrics.p99ResponseTime = percentile(sorted, 0.99);

  // Calculate error rate
  metrics.errorRate = metrics.requestCount > 0 ? (metrics.errors / metrics.requestCount) * 100 : 0;

  // Update system metrics
  metrics.memoryUsage = process.memoryUsage();
  metrics.cpuUsage = process.cpuUsage();
}

function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;

  const index = Math.ceil(sortedArray.length * p) - 1;
  return sortedArray[Math.max(0, index)];
}

function calculateRequestsPerSecond(): number {
  const now = new Date();
  const timeDiff = (now.getTime() - metrics.lastReset.getTime()) / 1000;

  if (timeDiff === 0) return 0;

  return metrics.requestCount / timeDiff;
}

function startMetricsCollection(fastify: FastifyInstance) {
  // Reset metrics periodically to prevent memory leaks
  setInterval(() => {
    // Keep recent data but reset counters
    const recentResponseTimes = metrics.responseTimes.slice(-100);

    metrics.responseTimes = recentResponseTimes;
    metrics.requestCount = Math.floor(metrics.requestCount * 0.1); // Keep 10% for trend
    metrics.errors = Math.floor(metrics.errors * 0.1);
    metrics.lastReset = new Date();

    updateMetrics();
  }, 5 * 60 * 1000); // Reset every 5 minutes

  // Log metrics periodically
  setInterval(() => {
    fastify.log.info({
      metrics: {
        requestCount: metrics.requestCount,
        averageResponseTime: Math.round(metrics.averageResponseTime),
        p95ResponseTime: Math.round(metrics.p95ResponseTime),
        errorRate: Math.round(metrics.errorRate * 100) / 100,
        activeConnections: metrics.activeConnections,
        memoryUsageMB: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
        requestsPerSecond: Math.round(calculateRequestsPerSecond() * 100) / 100,
      },
    }, 'Performance metrics');
  }, 60 * 1000); // Log every minute
}

// Declare module augmentation for request
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

// Response time tracking for caching decisions
export function shouldCache(responseTime: number, statusCode: number): boolean {
  // Cache successful responses that are reasonably fast
  if (statusCode >= 200 && statusCode < 300) {
    return responseTime < 1000; // Cache responses under 1 second
  }

  return false;
}

// Memory pressure detection
export function isMemoryPressureHigh(): boolean {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  const heapTotalMB = usage.heapTotal / 1024 / 1024;

  // Consider memory pressure high if heap usage > 80%
  return (heapUsedMB / heapTotalMB) > 0.8;
}

// CPU usage detection
export function isCpuUsageHigh(): boolean {
  const usage = process.cpuUsage();
  const totalUsage = usage.user + usage.system;

  // This is a simplified check - in production you'd want more sophisticated monitoring
  return totalUsage > 500000; // 500ms of CPU time indicates high usage
}