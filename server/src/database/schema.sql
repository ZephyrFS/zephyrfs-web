-- ZephyrFS Authentication Database Schema

-- Users table with email registration and OAuth support
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    password_hash TEXT,
    user_type TEXT CHECK (user_type IN ('backup', 'volunteer', 'admin')) NOT NULL DEFAULT 'backup',
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token TEXT,
    email_verification_expires_at DATETIME,
    password_reset_token TEXT,
    password_reset_expires_at DATETIME,
    github_id TEXT UNIQUE,
    github_username TEXT,
    github_avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    profile_data TEXT -- JSON storage for additional profile info
);

-- OAuth accounts table for multiple providers
CREATE TABLE oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at DATETIME,
    token_type TEXT,
    scope TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(provider, provider_account_id)
);

-- User sessions table
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_access_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Email verification attempts tracking
CREATE TABLE email_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    verified_at DATETIME,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Password reset attempts tracking
CREATE TABLE password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    used_at DATETIME,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- User onboarding progress tracking
CREATE TABLE user_onboarding (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    step TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    data TEXT, -- JSON storage for step-specific data
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_github_id ON oauth_accounts (provider_account_id);
CREATE INDEX idx_sessions_token ON user_sessions (session_token);
CREATE INDEX idx_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_email_verifications_token ON email_verifications (token);
CREATE INDEX idx_password_resets_token ON password_resets (token);

-- Insert default admin user
INSERT INTO users (
    id,
    email,
    username,
    password_hash,
    user_type,
    email_verified
) VALUES (
    'admin',
    'admin@zephyrfs.org',
    'admin',
    '$2b$10$rKGHZ0aB0qKhP0DqW8qZHu2wF2nF.FqD3tYw1pV6gB2wZ8vY0gG4u', -- 'admin' hashed
    'admin',
    TRUE
);

INSERT INTO users (
    id,
    email,
    username,
    password_hash,
    user_type,
    email_verified
) VALUES (
    'demo',
    'demo@zephyrfs.org',
    'demo',
    '$2b$10$rKGHZ0aB0qKhP0DqW8qZHu2wF2nF.FqD3tYw1pV6gB2wZ8vY0gG4u', -- 'demo' hashed
    'backup',
    TRUE
);