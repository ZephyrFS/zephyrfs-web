import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { NetworkStatus, NodeStatus } from '../../shared/types.js';

export async function statusRoutes(fastify: FastifyInstance) {
  // Health check endpoint (no auth required)
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const isAlive = await fastify.zephyrfs.ping();

      if (isAlive) {
        return {
          status: 'healthy',
          timestamp: new Date(),
          services: {
            web: 'online',
            zephyrfs: 'online',
          },
        };
      } else {
        reply.code(503);
        return {
          status: 'unhealthy',
          timestamp: new Date(),
          services: {
            web: 'online',
            zephyrfs: 'offline',
          },
        };
      }
    } catch (error) {
      fastify.log.error(error, 'Health check failed');
      reply.code(503);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        services: {
          web: 'online',
          zephyrfs: 'error',
        },
        error: error.message,
      };
    }
  });

  // Get network status
  fastify.get('/status/network', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const networkStatus = await fastify.zephyrfs.getNetworkStatus();
      return networkStatus;
    } catch (error) {
      fastify.log.error(error, 'Failed to get network status');
      throw fastify.httpErrors.internalServerError('Failed to get network status');
    }
  });

  // Get node status
  fastify.get('/status/node', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const nodeStatus = await fastify.zephyrfs.getNodeStatus();
      return nodeStatus;
    } catch (error) {
      fastify.log.error(error, 'Failed to get node status');
      throw fastify.httpErrors.internalServerError('Failed to get node status');
    }
  });

  // WebSocket endpoint for real-time status updates
  fastify.register(async function (fastify) {
    fastify.get('/status/ws', { websocket: true }, (connection, request) => {
      const sendUpdate = async () => {
        try {
          const [networkStatus, nodeStatus] = await Promise.all([
            fastify.zephyrfs.getNetworkStatus(),
            fastify.zephyrfs.getNodeStatus(),
          ]);

          connection.socket.send(JSON.stringify({
            type: 'status_update',
            data: {
              network: networkStatus,
              node: nodeStatus,
              timestamp: new Date(),
            },
          }));
        } catch (error) {
          fastify.log.error(error, 'Failed to send status update');
          connection.socket.send(JSON.stringify({
            type: 'error',
            data: {
              message: 'Failed to get status update',
              timestamp: new Date(),
            },
          }));
        }
      };

      // Send initial status
      sendUpdate();

      // Send updates every 5 seconds
      const interval = setInterval(sendUpdate, 5000);

      connection.socket.on('close', () => {
        clearInterval(interval);
      });

      connection.socket.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'ping') {
            connection.socket.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date(),
            }));
          }
        } catch (error) {
          fastify.log.warn(error, 'Invalid WebSocket message received');
        }
      });
    });
  });
}