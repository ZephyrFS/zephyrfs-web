import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthRequest, AuthResponse } from '../../shared/types.js';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  token: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// Simple in-memory session store (replace with Redis in production)
const sessions = new Map<string, {
  userId: string;
  username: string;
  createdAt: Date;
  lastAccess: Date;
}>();

// Simple user store (replace with proper database in production)
const users = new Map([
  ['admin', {
    id: 'admin',
    username: 'admin',
    passwordHash: 'admin', // In production, use proper bcrypt hashing
  }],
  ['demo', {
    id: 'demo',
    username: 'demo',
    passwordHash: 'demo',
  }],
]);

export async function authRoutes(fastify: FastifyInstance) {
  // Login endpoint
  fastify.post<{
    Body: z.infer<typeof loginSchema>;
  }>('/auth/login', {
    schema: {
      body: loginSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password, token } = request.body as z.infer<typeof loginSchema>;

    try {
      let user;

      if (token) {
        // Token-based authentication (for API clients)
        try {
          const decoded = fastify.jwt.verify(token) as { userId: string; username: string };
          user = users.get(decoded.username);
          if (!user || user.id !== decoded.userId) {
            throw new Error('Invalid token');
          }
        } catch (error) {
          throw fastify.httpErrors.unauthorized('Invalid token');
        }
      } else if (username && password) {
        // Password-based authentication
        user = users.get(username);
        if (!user || user.passwordHash !== password) {
          throw fastify.httpErrors.unauthorized('Invalid credentials');
        }
      } else {
        throw fastify.httpErrors.badRequest('Username/password or token required');
      }

      // Create session
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, {
        userId: user.id,
        username: user.username,
        createdAt: new Date(),
        lastAccess: new Date(),
      });

      // Generate tokens
      const accessToken = fastify.jwt.sign(
        { userId: user.id, username: user.username, sessionId },
        { expiresIn: fastify.config.jwtExpiresIn }
      );

      const refreshToken = fastify.jwt.sign(
        { userId: user.id, sessionId, type: 'refresh' },
        { expiresIn: fastify.config.jwtRefreshExpiresIn }
      );

      const response: AuthResponse = {
        token: accessToken,
        refreshToken,
        expiresIn: 24 * 60 * 60, // 24 hours in seconds
        user: {
          id: user.id,
          username: user.username,
        },
      };

      return response;
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      fastify.log.error(error, 'Login failed');
      throw fastify.httpErrors.internalServerError('Login failed');
    }
  });

  // Refresh token endpoint
  fastify.post<{
    Body: z.infer<typeof refreshSchema>;
  }>('/auth/refresh', {
    schema: {
      body: refreshSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as z.infer<typeof refreshSchema>;

    try {
      // Verify refresh token
      const decoded = fastify.jwt.verify(refreshToken) as {
        userId: string;
        sessionId: string;
        type: string;
      };

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check session exists
      const session = sessions.get(decoded.sessionId);
      if (!session || session.userId !== decoded.userId) {
        throw new Error('Invalid session');
      }

      // Update session
      session.lastAccess = new Date();

      // Generate new access token
      const accessToken = fastify.jwt.sign(
        { userId: session.userId, username: session.username, sessionId: decoded.sessionId },
        { expiresIn: fastify.config.jwtExpiresIn }
      );

      const response: AuthResponse = {
        token: accessToken,
        refreshToken, // Keep the same refresh token
        expiresIn: 24 * 60 * 60,
        user: {
          id: session.userId,
          username: session.username,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error, 'Token refresh failed');
      throw fastify.httpErrors.unauthorized('Invalid refresh token');
    }
  });

  // Logout endpoint
  fastify.post('/auth/logout', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { sessionId: string };

      // Remove session
      sessions.delete(user.sessionId);

      return { success: true };
    } catch (error) {
      fastify.log.error(error, 'Logout failed');
      throw fastify.httpErrors.internalServerError('Logout failed');
    }
  });

  // Get current user info
  fastify.get('/auth/me', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { userId: string; username: string; sessionId: string };

    // Update session last access
    const session = sessions.get(user.sessionId);
    if (session) {
      session.lastAccess = new Date();
    }

    return {
      id: user.userId,
      username: user.username,
    };
  });
}