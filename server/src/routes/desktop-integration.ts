/**
 * Desktop Integration API routes for ZephyrFS
 *
 * Handles communication between the desktop app and web interface
 * for seamless authentication and configuration synchronization.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../database/db.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

// Validation schemas
const DesktopTokenSchema = z.object({
  desktop_token: z.string().uuid(),
  desktop_metadata: z.object({
    app_version: z.string(),
    os: z.string(),
    machine_id: z.string(),
    storage_config: z.object({
      storage_folder: z.string(),
      storage_limit: z.number(),
      current_usage: z.number(),
      node_status: z.enum(['Inactive', 'Starting', 'Running', 'Paused', 'Error']),
    }).optional(),
  }),
});

const RegistrationFlowSchema = z.object({
  desktop_token: z.string().uuid(),
  preferred_user_type: z.enum(['Backup', 'Volunteer']).optional(),
  return_url: z.string().url(),
  storage_ready: z.boolean(),
  capabilities: z.array(z.string()),
});

const ConfigSyncRequestSchema = z.object({
  desktop_token: z.string().uuid(),
  desktop_config: z.record(z.any()),
  last_sync: z.number(),
});

interface DesktopSession {
  id: string;
  desktop_token: string;
  user_id: string | null;
  user_type: 'backup' | 'volunteer' | null;
  machine_id: string;
  app_version: string;
  os: string;
  created_at: Date;
  expires_at: Date;
  storage_config: any | null;
}

/**
 * Register desktop integration routes
 */
export async function desktopIntegrationRoutes(fastify: FastifyInstance) {
  // Middleware to validate desktop token
  const validateDesktopToken = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Desktop token required' });
    }

    const token = authHeader.substring(7);
    try {
      const session = await getDesktopSession(token);
      if (!session) {
        return reply.code(401).send({ error: 'Invalid desktop token' });
      }

      if (new Date() > session.expires_at) {
        await deleteDesktopSession(token);
        return reply.code(401).send({ error: 'Desktop token expired' });
      }

      (request as any).desktopSession = session;
    } catch (error) {
      fastify.log.error('Desktop token validation error:', error);
      return reply.code(500).send({ error: 'Token validation failed' });
    }
  };

  // Register desktop app and create session
  fastify.post('/api/desktop/register', async (request, reply) => {
    try {
      const validatedData = DesktopTokenSchema.parse(request.body);

      const sessionId = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      const session: DesktopSession = {
        id: sessionId,
        desktop_token: validatedData.desktop_token,
        user_id: null,
        user_type: null,
        machine_id: validatedData.desktop_metadata.machine_id,
        app_version: validatedData.desktop_metadata.app_version,
        os: validatedData.desktop_metadata.os,
        created_at: new Date(),
        expires_at: expiresAt,
        storage_config: validatedData.desktop_metadata.storage_config || null,
      };

      await storeDesktopSession(session);

      return reply.send({
        success: true,
        session_id: sessionId,
        expires_at: expiresAt.toISOString(),
        message: 'Desktop session created successfully',
      });
    } catch (error) {
      fastify.log.error('Desktop registration error:', error);
      return reply.code(400).send({ error: 'Invalid registration data' });
    }
  });

  // Handle registration flow from desktop app
  fastify.post('/api/desktop/registration-flow', async (request, reply) => {
    try {
      const validatedData = RegistrationFlowSchema.parse(request.body);

      // Store registration flow data for web interface
      await storeRegistrationFlow(validatedData);

      // Generate a temporary registration token
      const registrationToken = jwt.sign(
        {
          desktop_token: validatedData.desktop_token,
          flow_type: 'registration',
          preferred_user_type: validatedData.preferred_user_type,
        },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      return reply.send({
        success: true,
        registration_token: registrationToken,
        return_url: validatedData.return_url,
        storage_ready: validatedData.storage_ready,
      });
    } catch (error) {
      fastify.log.error('Registration flow error:', error);
      return reply.code(400).send({ error: 'Invalid registration flow data' });
    }
  });

  // Get authentication status for desktop app
  fastify.get('/api/desktop/auth-status', {
    preHandler: validateDesktopToken,
  }, async (request, reply) => {
    const session = (request as any).desktopSession as DesktopSession;

    if (session.user_id) {
      // Get user details
      const user = await db
        .selectFrom('users')
        .select(['id', 'email', 'display_name', 'user_type'])
        .where('id', '=', session.user_id)
        .executeTakeFirst();

      if (user) {
        return reply.send({
          authenticated: true,
          user_id: user.id,
          user_type: user.user_type === 'backup' ? 'Backup' : 'Volunteer',
          display_name: user.display_name || user.email,
          email: user.email,
        });
      }
    }

    return reply.send({
      authenticated: false,
      user_id: null,
      user_type: null,
      display_name: null,
      email: null,
    });
  });

  // Link web authentication to desktop session
  fastify.post('/api/desktop/link-auth', async (request, reply) => {
    try {
      const { desktop_token, web_session_token } = request.body as {
        desktop_token: string;
        web_session_token: string;
      };

      // Verify web session token
      const webSession = jwt.verify(web_session_token, process.env.JWT_SECRET!) as any;

      if (!webSession.userId) {
        return reply.code(400).send({ error: 'Invalid web session' });
      }

      // Update desktop session with user authentication
      const updated = await linkDesktopSessionToUser(
        desktop_token,
        webSession.userId,
        webSession.userType
      );

      if (!updated) {
        return reply.code(404).send({ error: 'Desktop session not found' });
      }

      return reply.send({
        success: true,
        message: 'Desktop session linked to user account',
        user_id: webSession.userId,
        user_type: webSession.userType,
      });
    } catch (error) {
      fastify.log.error('Auth linking error:', error);
      return reply.code(500).send({ error: 'Failed to link authentication' });
    }
  });

  // Sync configuration between desktop and web
  fastify.post('/api/desktop/sync', {
    preHandler: validateDesktopToken,
  }, async (request, reply) => {
    try {
      const validatedData = ConfigSyncRequestSchema.parse(request.body);
      const session = (request as any).desktopSession as DesktopSession;

      // Update desktop configuration in session
      await updateDesktopConfig(session.desktop_token, validatedData.desktop_config);

      // Get any configuration updates from web interface
      const webConfig = await getWebConfigUpdates(session.user_id, validatedData.last_sync);

      return reply.send({
        success: true,
        changes_applied: Object.keys(webConfig).length,
        web_config: webConfig,
        next_sync: Math.floor(Date.now() / 1000) + 300, // 5 minutes from now
      });
    } catch (error) {
      fastify.log.error('Config sync error:', error);
      return reply.code(500).send({ error: 'Configuration sync failed' });
    }
  });

  // Handle desktop app logout
  fastify.post('/api/desktop/logout', {
    preHandler: validateDesktopToken,
  }, async (request, reply) => {
    const session = (request as any).desktopSession as DesktopSession;

    // Remove user association but keep desktop session for re-auth
    await unlinkDesktopSessionFromUser(session.desktop_token);

    return reply.send({
      success: true,
      message: 'Desktop session unlinked from user account',
    });
  });

  // Get desktop sessions for debugging (admin only)
  fastify.get('/api/admin/desktop-sessions', {
    preHandler: async (request, reply) => {
      // Add admin authentication check here
      // For now, just a simple check
      const adminToken = request.headers['x-admin-token'];
      if (adminToken !== process.env.ADMIN_TOKEN) {
        return reply.code(403).send({ error: 'Admin access required' });
      }
    },
  }, async (request, reply) => {
    const sessions = await getAllDesktopSessions();
    return reply.send({ sessions });
  });
}

// Database operations for desktop sessions
async function storeDesktopSession(session: DesktopSession): Promise<void> {
  await db
    .insertInto('desktop_sessions')
    .values({
      id: session.id,
      desktop_token: session.desktop_token,
      user_id: session.user_id,
      user_type: session.user_type,
      machine_id: session.machine_id,
      app_version: session.app_version,
      os: session.os,
      created_at: session.created_at,
      expires_at: session.expires_at,
      storage_config: JSON.stringify(session.storage_config),
    })
    .execute();
}

async function getDesktopSession(token: string): Promise<DesktopSession | null> {
  const result = await db
    .selectFrom('desktop_sessions')
    .selectAll()
    .where('desktop_token', '=', token)
    .executeTakeFirst();

  if (!result) return null;

  return {
    id: result.id,
    desktop_token: result.desktop_token,
    user_id: result.user_id,
    user_type: result.user_type as 'backup' | 'volunteer' | null,
    machine_id: result.machine_id,
    app_version: result.app_version,
    os: result.os,
    created_at: result.created_at,
    expires_at: result.expires_at,
    storage_config: result.storage_config ? JSON.parse(result.storage_config) : null,
  };
}

async function linkDesktopSessionToUser(
  desktopToken: string,
  userId: string,
  userType: string
): Promise<boolean> {
  const result = await db
    .updateTable('desktop_sessions')
    .set({
      user_id: userId,
      user_type: userType === 'backup' ? 'backup' : 'volunteer',
    })
    .where('desktop_token', '=', desktopToken)
    .execute();

  return result.length > 0;
}

async function unlinkDesktopSessionFromUser(desktopToken: string): Promise<boolean> {
  const result = await db
    .updateTable('desktop_sessions')
    .set({
      user_id: null,
      user_type: null,
    })
    .where('desktop_token', '=', desktopToken)
    .execute();

  return result.length > 0;
}

async function updateDesktopConfig(
  desktopToken: string,
  config: Record<string, any>
): Promise<void> {
  await db
    .updateTable('desktop_sessions')
    .set({
      storage_config: JSON.stringify(config),
    })
    .where('desktop_token', '=', desktopToken)
    .execute();
}

async function getWebConfigUpdates(
  userId: string | null,
  lastSync: number
): Promise<Record<string, any>> {
  if (!userId) return {};

  // Get any configuration changes from web interface since last sync
  // This would query user preferences, storage settings, etc.
  const webConfig: Record<string, any> = {};

  // Example: Get user preferences that changed since last sync
  const preferences = await db
    .selectFrom('user_preferences')
    .selectAll()
    .where('user_id', '=', userId)
    .where('updated_at', '>', new Date(lastSync * 1000))
    .execute();

  for (const pref of preferences) {
    webConfig[pref.key] = pref.value;
  }

  return webConfig;
}

async function deleteDesktopSession(token: string): Promise<void> {
  await db
    .deleteFrom('desktop_sessions')
    .where('desktop_token', '=', token)
    .execute();
}

async function getAllDesktopSessions(): Promise<DesktopSession[]> {
  const results = await db
    .selectFrom('desktop_sessions')
    .selectAll()
    .execute();

  return results.map(result => ({
    id: result.id,
    desktop_token: result.desktop_token,
    user_id: result.user_id,
    user_type: result.user_type as 'backup' | 'volunteer' | null,
    machine_id: result.machine_id,
    app_version: result.app_version,
    os: result.os,
    created_at: result.created_at,
    expires_at: result.expires_at,
    storage_config: result.storage_config ? JSON.parse(result.storage_config) : null,
  }));
}

async function storeRegistrationFlow(flow: z.infer<typeof RegistrationFlowSchema>): Promise<void> {
  // Store registration flow data temporarily for web interface
  // This could use Redis or a temporary database table
  // For now, just log it
  console.log('Registration flow stored:', flow);
}

// Cleanup expired desktop sessions (should be called periodically)
export async function cleanupExpiredDesktopSessions(): Promise<void> {
  await db
    .deleteFrom('desktop_sessions')
    .where('expires_at', '<', new Date())
    .execute();
}