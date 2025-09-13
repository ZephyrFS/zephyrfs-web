import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import { loadConfig } from './config.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import { performanceMiddleware } from './middleware/performance.js';
import { cacheMiddleware } from './middleware/cache.js';
import { ZephyrFSClient } from './integration/zephyrfs-client.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const config = loadConfig();

  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.nodeEnv === 'development' ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    },
  });

  // Initialize ZephyrFS client
  const zephyrfsClient = new ZephyrFSClient(config.zephyrfsNodeUrl, {
    timeout: config.zephyrfsNodeTimeout,
  });

  // Register plugins
  await fastify.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: config.jwtSecret,
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: config.maxFileSize,
    },
  });

  await fastify.register(websocket);

  // Serve static files in production
  if (config.nodeEnv === 'production') {
    await fastify.register(staticFiles, {
      root: path.join(__dirname, '../public'),
      prefix: '/',
    });
  }

  // Add context
  fastify.decorate('zephyrfs', zephyrfsClient);
  fastify.decorate('config', config);

  // Register middleware
  fastify.setErrorHandler(errorHandler);
  await fastify.register(performanceMiddleware);
  await fastify.register(cacheMiddleware);
  await fastify.register(authMiddleware);

  // Register routes
  await fastify.register(registerRoutes, { prefix: '/api' });

  return fastify;
}

async function start() {
  try {
    const config = loadConfig();
    const server = await createServer();

    await server.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`🚀 ZephyrFS Web Server running on http://${config.host}:${config.port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { createServer };