import type { FastifyInstance } from 'fastify';
import { filesRoutes } from './files.js';
import { statusRoutes } from './status.js';
import { authRoutes } from './auth.js';
import { webdavRoutes } from './webdav.js';
import { foldersRoutes } from './folders.js';
import { bulkRoutes } from './bulk.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // Register all route modules
  await fastify.register(authRoutes);
  await fastify.register(filesRoutes);
  await fastify.register(foldersRoutes);
  await fastify.register(bulkRoutes);
  await fastify.register(statusRoutes);
  await fastify.register(webdavRoutes);

  // API info endpoint
  fastify.get('/', async () => {
    return {
      name: 'ZephyrFS Web API',
      version: '0.1.0',
      description: 'Web interface backend for ZephyrFS distributed storage',
      endpoints: {
        auth: [
          'POST /auth/login',
          'POST /auth/refresh',
          'POST /auth/logout',
        ],
        files: [
          'GET /files',
          'POST /files/upload',
          'GET /files/:fileId/download',
          'GET /files/:fileId/info',
          'DELETE /files/:fileId',
        ],
        status: [
          'GET /health',
          'GET /status/network',
          'GET /status/node',
          'GET /status/ws (WebSocket)',
        ],
        webdav: [
          'GET /webdav',
          'ALL /webdav/* (WebDAV protocol)',
        ],
      },
      documentation: '/docs',
    };
  });
}