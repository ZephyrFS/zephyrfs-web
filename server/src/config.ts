import { z } from 'zod';

const configSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // ZephyrFS Node integration
  zephyrfsNodeUrl: z.string().default('http://localhost:8080'),
  zephyrfsNodeTimeout: z.number().default(30000),

  // Authentication
  jwtSecret: z.string().min(32),
  jwtExpiresIn: z.string().default('24h'),
  jwtRefreshExpiresIn: z.string().default('7d'),

  // CORS
  corsOrigins: z.array(z.string()).default(['http://localhost:5173']),

  // File upload limits
  maxFileSize: z.number().default(1024 * 1024 * 1024), // 1GB
  maxChunkSize: z.number().default(1024 * 1024), // 1MB

  // WebDAV
  webdavEnabled: z.boolean().default(true),
  webdavPath: z.string().default('/webdav'),

  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const rawConfig = {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',

    zephyrfsNodeUrl: process.env.ZEPHYRFS_NODE_URL || 'http://localhost:8080',
    zephyrfsNodeTimeout: parseInt(process.env.ZEPHYRFS_NODE_TIMEOUT || '30000'),

    jwtSecret: process.env.JWT_SECRET || 'change-this-in-production-min-32-chars-long',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],

    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || (1024 * 1024 * 1024).toString()),
    maxChunkSize: parseInt(process.env.MAX_CHUNK_SIZE || (1024 * 1024).toString()),

    webdavEnabled: process.env.WEBDAV_ENABLED !== 'false',
    webdavPath: process.env.WEBDAV_PATH || '/webdav',

    logLevel: process.env.LOG_LEVEL || 'info',
  };

  return configSchema.parse(rawConfig);
}