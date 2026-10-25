import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { authenticateRequest } from '../../src/auth/authenticate.js';
import { authorizeRoles } from '../../src/auth/authorize.js';

type Role = 'USER' | 'ADMIN';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in apps/api/.env.test for authorization tests.');
}

const configuredJwtSecret = jwtSecret;

function createToken(role: Role, subject = `${role.toLowerCase()}-user-123`) {
  return jwt.sign({ role }, configuredJwtSecret, {
    subject,
    expiresIn: 60 * 60,
  });
}

function createAuthorizationApp(
  allowedRoles: Role[],
  options: {
    authenticate?: boolean;
    authenticatedUser?: unknown;
  } = {},
) {
  const authorizationApp = express();
  authorizationApp.use(express.json());

  if (options.authenticate !== false) {
    authorizationApp.use(authenticateRequest);
  } else if (options.authenticatedUser !== undefined) {
    authorizationApp.use((_request, response, next) => {
      response.locals.authenticatedUser = options.authenticatedUser;
      next();
    });
  }

  authorizationApp.post('/protected', authorizeRoles(...allowedRoles), (_request, response) => {
    response.status(200).json({ ok: true });
  });

  return authorizationApp;
}

function expectUnauthorized(response: request.Response) {
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

function expectForbidden(response: request.Response) {
  expect(response.status).toBe(403);
  expect(response.body).toEqual({
    error: {
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource.',
    },
  });
  expect(response.body).not.toHaveProperty('stack');
  expect(response.body).not.toHaveProperty('authenticatedUser');
}

describe('role-based authorization middleware', () => {
  it('allows an authenticated ADMIN to access an admin-only route', async () => {
    const authorizationApp = createAuthorizationApp(['ADMIN']);

    const response = await request(authorizationApp)
      .post('/protected')
      .set('Authorization', `Bearer ${createToken('ADMIN')}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('returns 403 when an authenticated USER accesses an admin-only route', async () => {
    const authorizationApp = createAuthorizationApp(['ADMIN']);

    const response = await request(authorizationApp)
      .post('/protected')
      .set('Authorization', `Bearer ${createToken('USER')}`);

    expectForbidden(response);
  });

  it('allows an authenticated user to access a route that permits their role', async () => {
    const authorizationApp = createAuthorizationApp(['USER']);

    const response = await request(authorizationApp)
      .post('/protected')
      .set('Authorization', `Bearer ${createToken('USER')}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('keeps missing authentication as a 401 from the existing authentication middleware', async () => {
    const authorizationApp = createAuthorizationApp(['ADMIN']);

    const response = await request(authorizationApp).post('/protected');

    expectUnauthorized(response);
  });

  it('does not trust a role supplied in the request body or query string', async () => {
    const authorizationApp = createAuthorizationApp(['ADMIN']);

    const response = await request(authorizationApp)
      .post('/protected?role=ADMIN')
      .set('Authorization', `Bearer ${createToken('USER')}`)
      .send({ role: 'ADMIN' });

    expectForbidden(response);
  });

  it('uses the verified role placed in res.locals by authentication middleware', async () => {
    const authorizationApp = createAuthorizationApp(['ADMIN']);

    const response = await request(authorizationApp)
      .post('/protected')
      .set('Authorization', `Bearer ${createToken('ADMIN', 'verified-admin-456')}`)
      .send({ role: 'USER' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it.each([
    { description: 'missing context', authenticatedUser: undefined },
    { description: 'invalid role context', authenticatedUser: { id: 'user-123', role: 'OWNER' } },
    { description: 'incomplete context', authenticatedUser: { role: 'ADMIN' } },
  ])('handles $description safely', async ({ authenticatedUser }) => {
    const authorizationApp = createAuthorizationApp(['ADMIN'], {
      authenticate: false,
      authenticatedUser,
    });

    const response = await request(authorizationApp).post('/protected');

    expectUnauthorized(response);
  });

  it('returns a consistent safe error for insufficient privileges', async () => {
    const authorizationApp = createAuthorizationApp(['ADMIN']);

    const response = await request(authorizationApp)
      .post('/protected')
      .set('Authorization', `Bearer ${createToken('USER')}`);

    expectForbidden(response);
  });
});
