import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getDatabase } from '../database/connection.js';
import { EmailService } from '../services/email.js';
import type { AuthResponse, PublicUser } from '../database/types.js';

// OAuth callback schemas
const githubCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code required'),
  state: z.string().optional(),
});

const userTypeSelectionSchema = z.object({
  userType: z.enum(['backup', 'volunteer']),
  tempUserId: z.string().uuid(),
});

interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

let emailService: EmailService;

export async function oauthRoutes(fastify: FastifyInstance) {
  const db = getDatabase();

  // Initialize email service
  emailService = new EmailService({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
    from: process.env.SMTP_FROM || 'ZephyrFS <noreply@zephyrfs.org>',
  });

  // Register GitHub OAuth plugin
  await fastify.register(import('@fastify/oauth2'), {
    name: 'githubOAuth2',
    credentials: {
      client: {
        id: process.env.GITHUB_CLIENT_ID!,
        secret: process.env.GITHUB_CLIENT_SECRET!,
      },
      auth: fastify.oauth2.GITHUB_CONFIGURATION,
    },
    scope: ['user:email', 'read:user'],
    startRedirectPath: '/oauth/github/login',
    callbackUri: `${process.env.BACKEND_URL || 'http://localhost:8080'}/oauth/github/callback`,
  });

  // Helper function to create public user object
  const toPublicUser = (user: any): PublicUser => ({
    id: user.id,
    email: user.email,
    username: user.username,
    userType: user.userType || user.user_type,
    emailVerified: user.emailVerified || user.email_verified,
    githubUsername: user.githubUsername || user.github_username,
    githubAvatarUrl: user.githubAvatarUrl || user.github_avatar_url,
    createdAt: new Date(user.createdAt || user.created_at),
  });

  // GitHub OAuth login initiation
  fastify.get('/oauth/github/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const state = randomUUID();

    // Store state for verification (in production, use Redis or database)
    // For now, we'll include it in the OAuth flow and verify in callback

    return fastify.githubOAuth2.generateAuthorizationUri(request, reply, {
      state,
    });
  });

  // GitHub OAuth callback
  fastify.get<{
    Querystring: z.infer<typeof githubCallbackSchema>;
  }>('/oauth/github/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as z.infer<typeof githubCallbackSchema>;

    try {
      // Exchange code for token
      const tokenResponse = await fastify.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

      if (!tokenResponse.access_token) {
        throw new Error('No access token received');
      }

      // Fetch GitHub user data
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenResponse.access_token}`,
          'User-Agent': 'ZephyrFS/1.0',
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch GitHub user data');
      }

      const githubUser: GitHubUser = await userResponse.json();

      // Fetch GitHub user emails
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${tokenResponse.access_token}`,
          'User-Agent': 'ZephyrFS/1.0',
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      let primaryEmail = githubUser.email;
      if (emailsResponse.ok) {
        const emails: GitHubEmail[] = await emailsResponse.json();
        const primary = emails.find(email => email.primary && email.verified);
        if (primary) {
          primaryEmail = primary.email;
        }
      }

      if (!primaryEmail) {
        // Redirect to frontend with error
        const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?error=no_email`;
        return reply.redirect(errorUrl);
      }

      // Check if user already exists with this GitHub ID
      let existingOAuthAccount = await db
        .selectFrom('oauth_accounts')
        .selectAll()
        .where('provider', '=', 'github')
        .where('provider_account_id', '=', githubUser.id.toString())
        .executeTakeFirst();

      let user: any;
      let isNewUser = false;

      if (existingOAuthAccount) {
        // User exists, get their account
        user = await db
          .selectFrom('users')
          .selectAll()
          .where('id', '=', existingOAuthAccount.user_id)
          .executeTakeFirst();

        if (!user) {
          throw new Error('OAuth account exists but user not found');
        }

        // Update OAuth account tokens
        await db
          .updateTable('oauth_accounts')
          .set({
            access_token: tokenResponse.access_token,
            refresh_token: tokenResponse.refresh_token || null,
            expires_at: tokenResponse.expires_in
              ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .where('id', '=', existingOAuthAccount.id)
          .execute();

        // Update user's GitHub info
        await db
          .updateTable('users')
          .set({
            github_username: githubUser.login,
            github_avatar_url: githubUser.avatar_url,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .where('id', '=', user.id)
          .execute();

      } else {
        // Check if user exists with the email
        user = await db
          .selectFrom('users')
          .selectAll()
          .where('email', '=', primaryEmail)
          .executeTakeFirst();

        if (user) {
          // Link GitHub to existing account
          await db
            .insertInto('oauth_accounts')
            .values({
              id: randomUUID(),
              user_id: user.id,
              provider: 'github',
              provider_account_id: githubUser.id.toString(),
              access_token: tokenResponse.access_token,
              refresh_token: tokenResponse.refresh_token || null,
              expires_at: tokenResponse.expires_in
                ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
                : null,
              token_type: tokenResponse.token_type || 'bearer',
              scope: Array.isArray(tokenResponse.scope)
                ? tokenResponse.scope.join(' ')
                : tokenResponse.scope || 'user:email read:user',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .execute();

          // Update user's GitHub info
          await db
            .updateTable('users')
            .set({
              github_id: githubUser.id.toString(),
              github_username: githubUser.login,
              github_avatar_url: githubUser.avatar_url,
              last_login_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .where('id', '=', user.id)
            .execute();

        } else {
          // New user - create temporary user and redirect to user type selection
          isNewUser = true;
          const tempUserId = randomUUID();

          // Store temporary user data in database for user type selection
          user = await db
            .insertInto('users')
            .values({
              id: tempUserId,
              email: primaryEmail,
              username: githubUser.login,
              user_type: 'backup', // Temporary, will be updated after type selection
              email_verified: true, // GitHub email is considered verified
              github_id: githubUser.id.toString(),
              github_username: githubUser.login,
              github_avatar_url: githubUser.avatar_url,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              profile_data: JSON.stringify({
                temp: true,
                githubName: githubUser.name,
                needsUserTypeSelection: true,
              }),
            })
            .returningAll()
            .executeTakeFirstOrThrow();

          // Create OAuth account
          await db
            .insertInto('oauth_accounts')
            .values({
              id: randomUUID(),
              user_id: tempUserId,
              provider: 'github',
              provider_account_id: githubUser.id.toString(),
              access_token: tokenResponse.access_token,
              refresh_token: tokenResponse.refresh_token || null,
              expires_at: tokenResponse.expires_in
                ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
                : null,
              token_type: tokenResponse.token_type || 'bearer',
              scope: Array.isArray(tokenResponse.scope)
                ? tokenResponse.scope.join(' ')
                : tokenResponse.scope || 'user:email read:user',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .execute();

          // Redirect to user type selection
          const userTypeUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/select-type?temp_user=${tempUserId}&github=true`;
          return reply.redirect(userTypeUrl);
        }
      }

      // Create session for existing user
      const sessionId = randomUUID();
      const sessionToken = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await db
        .insertInto('user_sessions')
        .values({
          id: sessionId,
          user_id: user.id,
          session_token: sessionToken,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString(),
          last_access_at: new Date().toISOString(),
          ip_address: request.ip,
          user_agent: request.headers['user-agent'],
        })
        .execute();

      // Generate tokens
      const accessToken = fastify.jwt.sign(
        { userId: user.id, username: user.username, sessionId },
        { expiresIn: fastify.config.jwtExpiresIn }
      );

      // Redirect to frontend with token
      const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/success?token=${accessToken}&new_user=${isNewUser}`;
      return reply.redirect(successUrl);

    } catch (error) {
      fastify.log.error(error, 'GitHub OAuth callback failed');
      const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?error=oauth_failed`;
      return reply.redirect(errorUrl);
    }
  });

  // Complete user type selection for GitHub OAuth users
  fastify.post<{
    Body: z.infer<typeof userTypeSelectionSchema>;
  }>('/oauth/github/complete-registration', {
    schema: { body: userTypeSelectionSchema },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userType, tempUserId } = request.body as z.infer<typeof userTypeSelectionSchema>;

    try {
      // Get temporary user
      const tempUser = await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', tempUserId)
        .executeTakeFirst();

      if (!tempUser) {
        throw fastify.httpErrors.notFound('Temporary user not found');
      }

      const profileData = tempUser.profile_data ? JSON.parse(tempUser.profile_data) : {};
      if (!profileData.temp || !profileData.needsUserTypeSelection) {
        throw fastify.httpErrors.badRequest('User registration already completed');
      }

      // Update user with selected type
      const user = await db
        .updateTable('users')
        .set({
          user_type: userType,
          profile_data: JSON.stringify({
            ...profileData,
            temp: false,
            needsUserTypeSelection: false,
          }),
          updated_at: new Date().toISOString(),
        })
        .where('id', '=', tempUserId)
        .returningAll()
        .executeTakeFirstOrThrow();

      // Initialize onboarding steps
      const onboardingSteps = userType === 'volunteer'
        ? ['user-type-selection', 'storage-setup', 'desktop-app', 'node-configuration']
        : ['user-type-selection', 'backup-setup', 'first-upload'];

      for (const step of onboardingSteps) {
        await db
          .insertInto('user_onboarding')
          .values({
            id: randomUUID(),
            user_id: user.id,
            step,
            completed: step === 'user-type-selection',
            data: step === 'user-type-selection' ? JSON.stringify({ userType }) : null,
            completed_at: step === 'user-type-selection' ? new Date().toISOString() : null,
            created_at: new Date().toISOString(),
          })
          .execute();
      }

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(user.email, userType, user.username || undefined);
      } catch (emailError) {
        fastify.log.error(emailError, 'Failed to send welcome email');
      }

      // Create session
      const sessionId = randomUUID();
      const sessionToken = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await db
        .insertInto('user_sessions')
        .values({
          id: sessionId,
          user_id: user.id,
          session_token: sessionToken,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString(),
          last_access_at: new Date().toISOString(),
          ip_address: request.ip,
          user_agent: request.headers['user-agent'],
        })
        .execute();

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
        expiresIn: 24 * 60 * 60,
        user: toPublicUser(user),
      };

      return {
        success: true,
        message: 'Registration completed successfully! Welcome to ZephyrFS!',
        auth: response,
      };

    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      fastify.log.error(error, 'GitHub OAuth registration completion failed');
      throw fastify.httpErrors.internalServerError('Registration completion failed');
    }
  });

  // Link GitHub account to existing user
  fastify.post('/oauth/github/link', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { userId: string };

    // Check if GitHub account already linked
    const existingLink = await db
      .selectFrom('oauth_accounts')
      .selectAll()
      .where('user_id', '=', user.userId)
      .where('provider', '=', 'github')
      .executeTakeFirst();

    if (existingLink) {
      throw fastify.httpErrors.conflict('GitHub account already linked to this user');
    }

    // Generate state for OAuth flow
    const state = `link_${user.userId}_${randomUUID()}`;

    return fastify.githubOAuth2.generateAuthorizationUri(request, reply, {
      state,
    });
  });

  // Unlink GitHub account
  fastify.delete('/oauth/github/unlink', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest) => {
    const user = request.user as { userId: string };

    // Remove OAuth account
    await db
      .deleteFrom('oauth_accounts')
      .where('user_id', '=', user.userId)
      .where('provider', '=', 'github')
      .execute();

    // Clear GitHub info from user
    await db
      .updateTable('users')
      .set({
        github_id: null,
        github_username: null,
        github_avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', user.userId)
      .execute();

    return { success: true, message: 'GitHub account unlinked successfully' };
  });
}