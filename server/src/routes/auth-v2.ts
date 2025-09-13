import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { randomBytes, randomUUID } from 'crypto';
import { getDatabase, toCamelCase } from '../database/connection.js';
import { EmailService } from '../services/email.js';
import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  PublicUser,
  EmailVerificationRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  OnboardingUpdateRequest,
} from '../database/types.js';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3).max(30).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  userType: z.enum(['backup', 'volunteer'], {
    required_error: 'Please select whether you want to backup files or volunteer storage',
  }),
});

const loginSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
}).refine(
  (data) => (data.email || data.username) && data.password || data.token,
  'Email/username and password, or token required'
);

const emailVerificationSchema = z.object({
  token: z.string().min(1, 'Verification token required'),
});

const passwordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const onboardingUpdateSchema = z.object({
  step: z.string().min(1),
  data: z.record(z.any()).optional(),
  completed: z.boolean().optional(),
});

let emailService: EmailService;

export async function authV2Routes(fastify: FastifyInstance) {
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

  // User registration
  fastify.post<{
    Body: RegisterRequest;
  }>('/auth/register', {
    schema: { body: registerSchema },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, username, password, userType } = request.body as RegisterRequest;

    try {
      // Check if user already exists
      const existingUser = await db
        .selectFrom('users')
        .selectAll()
        .where((eb) => eb.or([
          eb('email', '=', email),
          ...(username ? [eb('username', '=', username)] : [])
        ]))
        .executeTakeFirst();

      if (existingUser) {
        if (existingUser.email === email) {
          throw fastify.httpErrors.conflict('Email already registered');
        }
        if (existingUser.username === username) {
          throw fastify.httpErrors.conflict('Username already taken');
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Generate verification token
      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user
      const userId = randomUUID();
      await db
        .insertInto('users')
        .values({
          id: userId,
          email,
          username,
          password_hash: passwordHash,
          user_type: userType,
          email_verified: false,
          email_verification_token: verificationToken,
          email_verification_expires_at: verificationExpiresAt.toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // Create email verification record
      await db
        .insertInto('email_verifications')
        .values({
          id: randomUUID(),
          user_id: userId,
          email,
          token: verificationToken,
          attempts: 0,
          expires_at: verificationExpiresAt.toISOString(),
          created_at: new Date().toISOString(),
        })
        .execute();

      // Send verification email
      try {
        await emailService.sendEmailVerification(email, verificationToken, username);
      } catch (emailError) {
        fastify.log.error(emailError, 'Failed to send verification email');
        // Don't fail registration if email fails
      }

      // Initialize onboarding steps
      const onboardingSteps = userType === 'volunteer'
        ? ['user-type-selection', 'storage-setup', 'desktop-app', 'node-configuration']
        : ['user-type-selection', 'backup-setup', 'first-upload'];

      for (const step of onboardingSteps) {
        await db
          .insertInto('user_onboarding')
          .values({
            id: randomUUID(),
            user_id: userId,
            step,
            completed: step === 'user-type-selection', // First step completed
            data: step === 'user-type-selection' ? JSON.stringify({ userType }) : null,
            completed_at: step === 'user-type-selection' ? new Date().toISOString() : null,
            created_at: new Date().toISOString(),
          })
          .execute();
      }

      return {
        success: true,
        message: 'Registration successful! Please check your email to verify your account.',
        userId,
      };
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      fastify.log.error(error, 'Registration failed');
      throw fastify.httpErrors.internalServerError('Registration failed');
    }
  });

  // Email verification
  fastify.post<{
    Body: EmailVerificationRequest;
  }>('/auth/verify-email', {
    schema: { body: emailVerificationSchema },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.body as EmailVerificationRequest;

    try {
      // Find verification record
      const verification = await db
        .selectFrom('email_verifications')
        .selectAll()
        .where('token', '=', token)
        .where('verified_at', 'is', null)
        .executeTakeFirst();

      if (!verification) {
        throw fastify.httpErrors.badRequest('Invalid or expired verification token');
      }

      if (new Date() > new Date(verification.expires_at)) {
        throw fastify.httpErrors.badRequest('Verification token has expired');
      }

      // Update verification record
      await db
        .updateTable('email_verifications')
        .set({
          verified_at: new Date().toISOString(),
          attempts: verification.attempts + 1,
        })
        .where('id', '=', verification.id)
        .execute();

      // Update user
      const user = await db
        .updateTable('users')
        .set({
          email_verified: true,
          email_verification_token: null,
          email_verification_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .where('id', '=', verification.user_id)
        .returningAll()
        .executeTakeFirstOrThrow();

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(
          user.email,
          user.user_type as 'backup' | 'volunteer',
          user.username || undefined
        );
      } catch (emailError) {
        fastify.log.error(emailError, 'Failed to send welcome email');
      }

      return {
        success: true,
        message: 'Email verified successfully! Welcome to ZephyrFS!',
        user: toPublicUser(user),
      };
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      fastify.log.error(error, 'Email verification failed');
      throw fastify.httpErrors.internalServerError('Email verification failed');
    }
  });

  // Enhanced login
  fastify.post<{
    Body: LoginRequest;
  }>('/auth/login', {
    schema: { body: loginSchema },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, username, password, token } = request.body as LoginRequest;

    try {
      let user: any;

      if (token) {
        // Token-based authentication
        try {
          const decoded = fastify.jwt.verify(token) as { userId: string; username: string };
          user = await db
            .selectFrom('users')
            .selectAll()
            .where('id', '=', decoded.userId)
            .executeTakeFirst();

          if (!user) {
            throw new Error('User not found');
          }
        } catch (error) {
          throw fastify.httpErrors.unauthorized('Invalid token');
        }
      } else if ((email || username) && password) {
        // Password-based authentication
        user = await db
          .selectFrom('users')
          .selectAll()
          .where((eb) => eb.or([
            ...(email ? [eb('email', '=', email)] : []),
            ...(username ? [eb('username', '=', username)] : [])
          ]))
          .executeTakeFirst();

        if (!user || !user.password_hash) {
          throw fastify.httpErrors.unauthorized('Invalid credentials');
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
          throw fastify.httpErrors.unauthorized('Invalid credentials');
        }

        // Check if email is verified for new registrations
        if (!user.email_verified) {
          throw fastify.httpErrors.forbidden('Please verify your email address before logging in');
        }
      } else {
        throw fastify.httpErrors.badRequest('Email/username and password, or token required');
      }

      // Create session
      const sessionId = randomUUID();
      const sessionToken = randomBytes(32).toString('hex');
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

      // Update last login
      await db
        .updateTable('users')
        .set({
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .where('id', '=', user.id)
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
        expiresIn: 24 * 60 * 60, // 24 hours in seconds
        user: toPublicUser(user),
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

  // Password reset request
  fastify.post<{
    Body: PasswordResetRequest;
  }>('/auth/password-reset', {
    schema: { body: passwordResetSchema },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as PasswordResetRequest;

    try {
      const user = await db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', email)
        .executeTakeFirst();

      // Always return success to prevent email enumeration
      if (!user) {
        return {
          success: true,
          message: 'If an account with that email exists, we\'ve sent a password reset link.',
        };
      }

      // Generate reset token
      const resetToken = randomBytes(32).toString('hex');
      const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Update user with reset token
      await db
        .updateTable('users')
        .set({
          password_reset_token: resetToken,
          password_reset_expires_at: resetExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .where('id', '=', user.id)
        .execute();

      // Create password reset record
      await db
        .insertInto('password_resets')
        .values({
          id: randomUUID(),
          user_id: user.id,
          token: resetToken,
          attempts: 0,
          expires_at: resetExpiresAt.toISOString(),
          created_at: new Date().toISOString(),
        })
        .execute();

      // Send reset email
      try {
        await emailService.sendPasswordReset(email, resetToken, user.username || undefined);
      } catch (emailError) {
        fastify.log.error(emailError, 'Failed to send password reset email');
      }

      return {
        success: true,
        message: 'If an account with that email exists, we\'ve sent a password reset link.',
      };
    } catch (error) {
      fastify.log.error(error, 'Password reset request failed');
      throw fastify.httpErrors.internalServerError('Password reset request failed');
    }
  });

  // Password reset confirmation
  fastify.post<{
    Body: PasswordResetConfirmRequest;
  }>('/auth/password-reset/confirm', {
    schema: { body: passwordResetConfirmSchema },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { token, newPassword } = request.body as PasswordResetConfirmRequest;

    try {
      // Find reset record
      const reset = await db
        .selectFrom('password_resets')
        .selectAll()
        .where('token', '=', token)
        .where('used_at', 'is', null)
        .executeTakeFirst();

      if (!reset) {
        throw fastify.httpErrors.badRequest('Invalid or expired reset token');
      }

      if (new Date() > new Date(reset.expires_at)) {
        throw fastify.httpErrors.badRequest('Reset token has expired');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update user
      await db
        .updateTable('users')
        .set({
          password_hash: passwordHash,
          password_reset_token: null,
          password_reset_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .where('id', '=', reset.user_id)
        .execute();

      // Mark reset as used
      await db
        .updateTable('password_resets')
        .set({
          used_at: new Date().toISOString(),
          attempts: reset.attempts + 1,
        })
        .where('id', '=', reset.id)
        .execute();

      // Invalidate all sessions for this user
      await db
        .deleteFrom('user_sessions')
        .where('user_id', '=', reset.user_id)
        .execute();

      return {
        success: true,
        message: 'Password updated successfully! Please log in with your new password.',
      };
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      fastify.log.error(error, 'Password reset confirmation failed');
      throw fastify.httpErrors.internalServerError('Password reset confirmation failed');
    }
  });

  // Get user onboarding status
  fastify.get('/auth/onboarding', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest) => {
    const user = request.user as { userId: string };

    const onboardingSteps = await db
      .selectFrom('user_onboarding')
      .selectAll()
      .where('user_id', '=', user.userId)
      .orderBy('created_at', 'asc')
      .execute();

    return {
      steps: onboardingSteps.map(toCamelCase),
      completed: onboardingSteps.filter(step => step.completed).length,
      total: onboardingSteps.length,
    };
  });

  // Update onboarding progress
  fastify.post<{
    Body: OnboardingUpdateRequest;
  }>('/auth/onboarding/update', {
    preHandler: fastify.authenticate,
    schema: { body: onboardingUpdateSchema },
  }, async (request: FastifyRequest) => {
    const user = request.user as { userId: string };
    const { step, data, completed } = request.body as OnboardingUpdateRequest;

    await db
      .updateTable('user_onboarding')
      .set({
        completed: completed || false,
        data: data ? JSON.stringify(data) : null,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .where('user_id', '=', user.userId)
      .where('step', '=', step)
      .execute();

    return { success: true };
  });

  // Get current user info (enhanced)
  fastify.get('/auth/me', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest) => {
    const authUser = request.user as { userId: string; sessionId: string };

    // Get user details
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', authUser.userId)
      .executeTakeFirstOrThrow();

    // Update session last access
    await db
      .updateTable('user_sessions')
      .set({ last_access_at: new Date().toISOString() })
      .where('id', '=', authUser.sessionId)
      .execute();

    return toPublicUser(user);
  });

  // Enhanced logout (cleanup sessions)
  fastify.post('/auth/logout', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest) => {
    const user = request.user as { sessionId: string };

    // Remove session
    await db
      .deleteFrom('user_sessions')
      .where('id', '=', user.sessionId)
      .execute();

    return { success: true };
  });

  // Logout from all devices
  fastify.post('/auth/logout-all', {
    preHandler: fastify.authenticate,
  }, async (request: FastifyRequest) => {
    const user = request.user as { userId: string };

    // Remove all sessions for user
    await db
      .deleteFrom('user_sessions')
      .where('user_id', '=', user.userId)
      .execute();

    return { success: true };
  });
}