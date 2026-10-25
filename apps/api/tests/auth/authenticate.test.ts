import express, { type RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { authenticateRequest } from '../../src/auth/authenticate.js';

const jwtSecret = process.env.JWT_SECRET;
const testUserId = 'test-user-123';
const tokenLifetimeInSeconds = 60 * 60;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in apps/api/.env.test for middleware tests.');
}

const configuredJwtSecret = jwtSecret;

function createProtectedApp(middleware: RequestHandler) {
  const protectedApp = express();

  protectedApp.get('/protected', middleware, (_request, response) => {
    response.status(200).json({
      authenticatedUser: response.locals.authenticatedUser,
    });
  });

  return protectedApp;
}

function createToken({
  role = 'USER',
  secret = configuredJwtSecret,
  subject = testUserId,
  expiresIn = tokenLifetimeInSeconds,
}: {
  role?: string;
  secret?: string;
  subject?: string;
  expiresIn?: number;
} = {}) {
  return jwt.sign({ role }, secret, { expiresIn, subject });
}

function tamperWithToken(token: string) {
  const parts = token.split('.');
  return `${parts[0]}.${parts[1]}.tampered-signature`;
}

function expectSafeUnauthorized(response: request.Response) {
  expect(response.status).toBe(401);
  expect(response.body).toEqual({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
    },
  });
  expect(response.body).not.toHaveProperty('stack');
  expect(response.body).not.toHaveProperty('authenticatedUser');
}

describe('JWT authentication middleware', () => {
  const protectedApp = createProtectedApp(authenticateRequest);

  it('authenticates a request with a valid JWT', async () => {
    const token = createToken();

    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.authenticatedUser).toEqual({
      id: testUserId,
      role: 'USER',
    });
  });

  it('rejects a request without an Authorization header', async () => {
    const response = await request(protectedApp).get('/protected');

    expectSafeUnauthorized(response);
  });

  it.each(['Bearer', 'Basic some-token', 'Token some-token', 'Bearer one two'])(
    'rejects a malformed Authorization header: %s',
    async (authorization) => {
      const response = await request(protectedApp)
        .get('/protected')
        .set('Authorization', authorization);

      expectSafeUnauthorized(response);
    },
  );

  it('rejects an invalid or tampered JWT', async () => {
    const token = tamperWithToken(createToken());

    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expectSafeUnauthorized(response);
  });

  it('rejects an expired JWT', async () => {
    const token = createToken({ expiresIn: -1 });

    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expectSafeUnauthorized(response);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = createToken({ secret: 'a-different-test-secret' });

    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expectSafeUnauthorized(response);
  });

  it('rejects a token signed with an unsupported algorithm', async () => {
    const token = jwt.sign({ role: 'USER' }, configuredJwtSecret, {
      algorithm: 'HS384',
      expiresIn: tokenLifetimeInSeconds,
      subject: testUserId,
    });

    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expectSafeUnauthorized(response);
  });

  it('extracts the verified user ID and role from JWT claims', async () => {
    const token = createToken({ role: 'ADMIN', subject: 'admin-user-456' });

    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.authenticatedUser).toEqual({
      id: 'admin-user-456',
      role: 'ADMIN',
    });
  });

  it('does not create an authenticated context for an invalid token', async () => {
    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', 'Bearer definitely-not-a-jwt');

    expectSafeUnauthorized(response);
  });

  it('uses the configured JWT_SECRET rather than a hardcoded secret', async () => {
    const token = createToken({ role: 'ADMIN', subject: 'configured-secret-user' });

    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.authenticatedUser).toEqual({
      id: 'configured-secret-user',
      role: 'ADMIN',
    });
  });
});
