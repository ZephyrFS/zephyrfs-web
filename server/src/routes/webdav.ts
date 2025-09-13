import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createWebDAVServer } from '../services/webdav-server.js';
import { createServer } from 'node:http';

export async function webdavRoutes(fastify: FastifyInstance) {
  if (!fastify.config.webdavEnabled) {
    return;
  }

  // Create WebDAV server instance
  const webdavServer = createWebDAVServer(fastify.zephyrfs, {
    username: 'zephyrfs',
    password: 'webdav', // In production, use proper authentication
  });

  // Handle WebDAV requests by proxying to the WebDAV server
  fastify.all(`${fastify.config.webdavPath}/*`, async (request: FastifyRequest, reply: FastifyReply) => {
    return new Promise((resolve, reject) => {
      // Create a minimal HTTP server request/response for the WebDAV server
      const req = {
        method: request.method,
        url: request.url.replace(fastify.config.webdavPath, ''),
        headers: request.headers,
        on: (event: string, handler: Function) => {
          if (event === 'data') {
            // Handle request body
            request.raw.on('data', handler);
          } else if (event === 'end') {
            request.raw.on('end', handler);
          }
        },
        pipe: (destination: any) => {
          request.raw.pipe(destination);
        },
      };

      const res = {
        writeHead: (statusCode: number, headers?: any) => {
          reply.code(statusCode);
          if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
              reply.header(key, value as string);
            });
          }
        },
        write: (chunk: any) => {
          if (!reply.sent) {
            reply.raw.write(chunk);
          }
        },
        end: (chunk?: any) => {
          if (!reply.sent) {
            if (chunk) {
              reply.raw.write(chunk);
            }
            reply.raw.end();
            resolve(undefined);
          }
        },
        setHeader: (name: string, value: string) => {
          reply.header(name, value);
        },
      };

      try {
        // Process the request through the WebDAV server
        webdavServer.executeRequest(req as any, res as any);
      } catch (error) {
        reject(error);
      }
    });
  });

  // WebDAV discovery endpoint
  fastify.get('/webdav', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      service: 'ZephyrFS WebDAV',
      url: `${request.protocol}://${request.hostname}:${fastify.config.port}${fastify.config.webdavPath}/`,
      authentication: 'Basic',
      username: 'zephyrfs',
      password: 'webdav',
      description: 'Mount ZephyrFS as a network drive',
      instructions: {
        windows: 'Map Network Drive → Connect to a Web site → Enter the URL above',
        macos: 'Finder → Go → Connect to Server → Enter the URL above',
        linux: 'File Manager → Other Locations → Connect to Server → Enter the URL above',
      },
    };
  });
}