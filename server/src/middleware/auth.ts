import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      username: string;
      sessionId: string;
    };
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    config: import('../config.js').Config;
  }
}

export async function authMiddleware(fastify: FastifyInstance) {
  // Register authentication hook
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw fastify.httpErrors.unauthorized('Authorization header required');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify JWT token
      const decoded = fastify.jwt.verify(token) as {
        userId: string;
        username: string;
        sessionId: string;
      };

      // Attach user info to request
      request.user = {
        userId: decoded.userId,
        username: decoded.username,
        sessionId: decoded.sessionId,
      };
    } catch (error) {
      if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
        throw fastify.httpErrors.unauthorized('Token expired');
      } else if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
        throw fastify.httpErrors.unauthorized('Invalid token');
      } else if (error.statusCode) {
        throw error;
      } else {
        fastify.log.error(error, 'Authentication failed');
        throw fastify.httpErrors.unauthorized('Authentication failed');
      }
    }
  });

  // Optional authentication hook (for endpoints that work with or without auth)
  fastify.decorate('optionalAuth', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = fastify.jwt.verify(token) as {
          userId: string;
          username: string;
          sessionId: string;
        };

        request.user = {
          userId: decoded.userId,
          username: decoded.username,
          sessionId: decoded.sessionId,
        };
      }
    } catch (error) {
      // Ignore authentication errors for optional auth
      fastify.log.debug(error, 'Optional authentication failed');
    }
  });

  // Rate limiting middleware (simple in-memory implementation)
  const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  fastify.addHook('preHandler', async (request, reply) => {
    // Skip rate limiting for health checks
    if (request.url === '/api/health') {
      return;
    }

    const clientIp = request.ip;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 100; // 100 requests per minute

    const key = `${clientIp}:${Math.floor(now / windowMs)}`;
    const current = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };

    if (current.count >= maxRequests) {
      reply.header('Retry-After', Math.ceil((current.resetTime - now) / 1000));
      throw fastify.httpErrors.tooManyRequests('Rate limit exceeded');
    }

    current.count++;
    rateLimitStore.set(key, current);

    // Clean up old entries
    if (Math.random() < 0.01) { // 1% chance to clean up
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetTime < now) {
          rateLimitStore.delete(k);
        }
      }
    }
  });

  // Security headers
  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (fastify.config.nodeEnv === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });
}