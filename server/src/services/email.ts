import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from: string;
}

export class EmailService {
  private transporter: Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;

    // For development, use Ethereal Email (fake SMTP service)
    if (process.env.NODE_ENV === 'development' && !config.auth) {
      // This will be setup asynchronously
      this.setupDevelopmentTransporter();
    } else {
      this.transporter = nodemailer.createTransporter({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      });
    }
  }

  private async setupDevelopmentTransporter() {
    try {
      // Create Ethereal Email account for development
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      console.log('Development email transporter created with Ethereal Email');
      console.log('Preview URLs will be logged when emails are sent');
    } catch (error) {
      console.error('Failed to create development email transporter:', error);
      // Fallback to console logging
      this.transporter = {
        sendMail: async (options: any) => {
          console.log('Email would be sent:', options);
          return { messageId: 'dev-' + Date.now() };
        },
      } as any;
    }
  }

  async sendEmailVerification(to: string, token: string, username?: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify your ZephyrFS account</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button {
              display: inline-block;
              background: #007bff;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ZephyrFS!</h1>
            </div>
            <div class="content">
              <h2>Verify Your Email Address</h2>
              <p>Hello${username ? ` ${username}` : ''}!</p>
              <p>Thank you for signing up for ZephyrFS, the secure and decentralized file backup system.</p>
              <p>To complete your registration and start using ZephyrFS, please verify your email address by clicking the button below:</p>

              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>

              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 3px;">
                ${verificationUrl}
              </p>

              <p><strong>This verification link will expire in 24 hours.</strong></p>

              <p>If you didn't create an account with ZephyrFS, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© 2024 ZephyrFS. All rights reserved.</p>
              <p>Secure, decentralized file backup for everyone.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Welcome to ZephyrFS!

      Hello${username ? ` ${username}` : ''}!

      Thank you for signing up for ZephyrFS, the secure and decentralized file backup system.

      To complete your registration and start using ZephyrFS, please verify your email address by visiting this link:

      ${verificationUrl}

      This verification link will expire in 24 hours.

      If you didn't create an account with ZephyrFS, you can safely ignore this email.

      © 2024 ZephyrFS. All rights reserved.
    `;

    const result = await this.transporter.sendMail({
      from: this.config.from || 'ZephyrFS <noreply@zephyrfs.org>',
      to,
      subject: 'Verify your ZephyrFS account',
      text,
      html,
    });

    // In development, log preview URL
    if (process.env.NODE_ENV === 'development') {
      const previewUrl = nodemailer.getTestMessageUrl(result);
      if (previewUrl) {
        console.log('Email verification preview:', previewUrl);
      }
    }
  }

  async sendPasswordReset(to: string, token: string, username?: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset your ZephyrFS password</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button {
              display: inline-block;
              background: #dc3545;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Reset Your Password</h2>
              <p>Hello${username ? ` ${username}` : ''}!</p>
              <p>We received a request to reset the password for your ZephyrFS account.</p>

              <div class="warning">
                <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your account is safe.
              </div>

              <p>To reset your password, click the button below:</p>

              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>

              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 3px;">
                ${resetUrl}
              </p>

              <p><strong>This reset link will expire in 1 hour.</strong></p>

              <p>After clicking the link, you'll be able to create a new password for your account.</p>
            </div>
            <div class="footer">
              <p>© 2024 ZephyrFS. All rights reserved.</p>
              <p>If you have security concerns, contact us immediately.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Password Reset Request

      Hello${username ? ` ${username}` : ''}!

      We received a request to reset the password for your ZephyrFS account.

      If you didn't request this password reset, please ignore this email. Your account is safe.

      To reset your password, visit this link:

      ${resetUrl}

      This reset link will expire in 1 hour.

      After clicking the link, you'll be able to create a new password for your account.

      © 2024 ZephyrFS. All rights reserved.
    `;

    const result = await this.transporter.sendMail({
      from: this.config.from || 'ZephyrFS Security <security@zephyrfs.org>',
      to,
      subject: 'Reset your ZephyrFS password',
      text,
      html,
    });

    // In development, log preview URL
    if (process.env.NODE_ENV === 'development') {
      const previewUrl = nodemailer.getTestMessageUrl(result);
      if (previewUrl) {
        console.log('Password reset preview:', previewUrl);
      }
    }
  }

  async sendWelcomeEmail(to: string, userType: 'backup' | 'volunteer', username?: string): Promise<void> {
    const isVolunteer = userType === 'volunteer';
    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to ZephyrFS!</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button {
              display: inline-block;
              background: #28a745;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
            .feature { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #28a745; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to ZephyrFS!</h1>
            </div>
            <div class="content">
              <h2>Your account is ready!</h2>
              <p>Hello${username ? ` ${username}` : ''}!</p>
              <p>Welcome to ZephyrFS! Your email has been verified and your account is now active.</p>

              ${isVolunteer ? `
                <h3>🤝 Thank you for volunteering!</h3>
                <p>As a storage volunteer, you're helping build a decentralized, secure backup network that benefits everyone.</p>

                <div class="feature">
                  <strong>📁 Safe Storage Allocation</strong><br>
                  Choose how much disk space to contribute safely without risking your system.
                </div>

                <div class="feature">
                  <strong>🔒 Zero-Knowledge Security</strong><br>
                  All stored data is encrypted - you can't see what's stored on your system.
                </div>

                <div class="feature">
                  <strong>💰 Earn Rewards</strong><br>
                  Get compensated for providing reliable storage to the network.
                </div>

                <p>Ready to get started? Use our desktop app to set up your storage node:</p>
              ` : `
                <h3>☁️ Secure Backup Made Simple</h3>
                <p>Your files will be encrypted, distributed, and safely backed up across our decentralized network.</p>

                <div class="feature">
                  <strong>🔐 Military-Grade Encryption</strong><br>
                  Your files are encrypted before leaving your device.
                </div>

                <div class="feature">
                  <strong>🌐 Distributed Storage</strong><br>
                  Files are split and stored across multiple secure nodes.
                </div>

                <div class="feature">
                  <strong>⚡ Simple as Google Drive</strong><br>
                  Drag and drop to backup. That's it!
                </div>

                <p>Ready to start backing up your files?</p>
              `}

              <div style="text-align: center;">
                <a href="${dashboardUrl}" class="button">Get Started</a>
              </div>

              <p>If you have any questions or need help getting started, our community is here to support you!</p>
            </div>
            <div class="footer">
              <p>© 2024 ZephyrFS. All rights reserved.</p>
              <p>Building the future of secure, decentralized storage.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await this.transporter.sendMail({
      from: this.config.from || 'ZephyrFS <welcome@zephyrfs.org>',
      to,
      subject: '🎉 Welcome to ZephyrFS - Your account is ready!',
      html,
    });

    // In development, log preview URL
    if (process.env.NODE_ENV === 'development') {
      const previewUrl = nodemailer.getTestMessageUrl(result);
      if (previewUrl) {
        console.log('Welcome email preview:', previewUrl);
      }
    }
  }
}