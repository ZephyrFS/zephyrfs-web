import { test, beforeAll, afterAll, expect } from 'vitest';
import { createServer } from '../index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let authToken: string;

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-for-testing-only-min-32-chars-long';
  process.env.ZEPHYRFS_NODE_URL = 'http://localhost:8080';

  app = await createServer();
  await app.ready();
});

afterAll(async () => {
  await app?.close();
});

test('Health check endpoint', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/health',
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.status).toBeDefined();
  expect(body.timestamp).toBeDefined();
});

test('Login with valid credentials', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'admin',
      password: 'admin',
    },
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.token).toBeDefined();
  expect(body.refreshToken).toBeDefined();
  expect(body.user.username).toBe('admin');

  authToken = body.token;
});

test('Login with invalid credentials', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'invalid',
      password: 'invalid',
    },
  });

  expect(response.statusCode).toBe(401);
});

test('API info endpoint', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/',
    headers: {
      authorization: `Bearer ${authToken}`,
    },
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.name).toBe('ZephyrFS Web API');
  expect(body.endpoints).toBeDefined();
});

test('Get current user info', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: {
      authorization: `Bearer ${authToken}`,
    },
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.username).toBe('admin');
});

test('Unauthorized request without token', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/files',
  });

  expect(response.statusCode).toBe(401);
});

test('WebDAV discovery endpoint', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/webdav',
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.service).toBe('ZephyrFS WebDAV');
  expect(body.url).toBeDefined();
  expect(body.instructions).toBeDefined();
});