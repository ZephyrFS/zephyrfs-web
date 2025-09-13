// Database types for ZephyrFS authentication system

export interface User {
  id: string;
  email: string;
  username?: string;
  passwordHash?: string;
  userType: 'backup' | 'volunteer' | 'admin';
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpiresAt?: Date;
  passwordResetToken?: string;
  passwordResetExpiresAt?: Date;
  githubId?: string;
  githubUsername?: string;
  githubAvatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  profileData?: string; // JSON storage
}

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface EmailVerification {
  id: string;
  userId: string;
  email: string;
  token: string;
  attempts: number;
  verifiedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface PasswordReset {
  id: string;
  userId: string;
  token: string;
  attempts: number;
  usedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface UserOnboarding {
  id: string;
  userId: string;
  step: string;
  completed: boolean;
  data?: string; // JSON storage
  completedAt?: Date;
  createdAt: Date;
}

export interface Database {
  users: User;
  oauth_accounts: OAuthAccount;
  user_sessions: UserSession;
  email_verifications: EmailVerification;
  password_resets: PasswordReset;
  user_onboarding: UserOnboarding;
}

// API types for requests/responses
export interface RegisterRequest {
  email: string;
  username?: string;
  password: string;
  userType: 'backup' | 'volunteer';
}

export interface LoginRequest {
  email?: string;
  username?: string;
  password?: string;
  token?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  email: string;
  username?: string;
  userType: 'backup' | 'volunteer' | 'admin';
  emailVerified: boolean;
  githubUsername?: string;
  githubAvatarUrl?: string;
  createdAt: Date;
}

export interface EmailVerificationRequest {
  token: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

export interface OnboardingUpdateRequest {
  step: string;
  data?: Record<string, any>;
  completed?: boolean;
}