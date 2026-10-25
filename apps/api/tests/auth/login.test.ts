import { Role, PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';

const prisma = new PrismaClient();
const testPassword = 'ValidPass1';
const jwtSecret = process.env.JWT_SECRET;
const tokenLifetimeInSeconds = 60 * 60;
const createdEmails = new Set<string>();

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in apps/api/.env.test for login tests.');
}

function uniqueEmail(prefix = 'login') {
  return `${prefix}-${randomUUID()}@example.test`;
}

async function createTestUser({
  email = uniqueEmail(),
  role = Role.USER,
}: { email?: string; role?: Role } = {}) {
  const passwordHash = await hash(testPassword, 4);
  createdEmails.add(email);

  return prisma.user.create({
    data: {
      name: 'Login Test User',
      email,
      passwordHash,
      role,
    },
  });
}

function login(payload: Record<string, unknown>) {
  return request(app).post('/api/auth/login').send(payload);
}

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  if (createdEmails.size > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: [...createdEmails] } },
    });
    createdEmails.clear();
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials and returns a safe user representation', async () => {
    const user = await createTestUser({ role: Role.ADMIN });

    const response = await login({ email: user.email, password: testPassword });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: user.id,
      email: user.email,
      role: 'ADMIN',
    });
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('rejects a login for an email that does not exist', async () => {
    const response = await login({
      email: uniqueEmail('missing'),
      password: testPassword,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });
  });

  it('rejects a login with an incorrect password', async () => {
    const user = await createTestUser();

    const response = await login({
      email: user.email,
      password: 'WrongPass1',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });
  });

  it.each([
    { email: undefined, password: testPassword, missingField: 'email' },
    { email: uniqueEmail('missing-password'), password: undefined, missingField: 'password' },
  ])('rejects a request with a missing $missingField', async ({ email, password }) => {
    const response = await login({ email, password });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email and password are required.',
      },
    });
  });

  it('rejects an invalid email format before checking credentials', async () => {
    const response = await login({
      email: 'not-an-email',
      password: testPassword,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email must be valid.',
      },
    });
  });

  it('normalizes the email before looking up the user', async () => {
    const user = await createTestUser({ email: uniqueEmail('normalized') });

    const response = await login({
      email: `  ${user.email.toUpperCase()}  `,
      password: testPassword,
    });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(user.email);
  });

  it('returns a signed JWT containing the user id and role without credentials', async () => {
    const user = await createTestUser({ role: Role.ADMIN });

    const response = await login({ email: user.email, password: testPassword });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));

    const verified = jwt.verify(response.body.token, jwtSecret);
    expect(typeof verified).toBe('object');
    const claims = verified as JwtPayload;

    expect(claims.sub).toBe(user.id);
    expect(claims.role).toBe('ADMIN');
    expect(claims).not.toHaveProperty('password');
    expect(claims).not.toHaveProperty('passwordHash');
  });

  it('uses a one-hour expiration for issued access tokens', async () => {
    const user = await createTestUser();

    const response = await login({ email: user.email, password: testPassword });
    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    const claims = jwt.verify(response.body.token, jwtSecret) as JwtPayload;

    expect(claims.iat).toEqual(expect.any(Number));
    expect(claims.exp).toEqual(expect.any(Number));
    expect((claims.exp as number) - (claims.iat as number)).toBe(tokenLifetimeInSeconds);
  });

  it('uses the same safe error for an unknown email and an incorrect password', async () => {
    const user = await createTestUser();

    const unknownEmailResponse = await login({
      email: uniqueEmail('unknown'),
      password: testPassword,
    });
    const wrongPasswordResponse = await login({
      email: user.email,
      password: 'WrongPass1',
    });

    expect(unknownEmailResponse.status).toBe(401);
    expect(wrongPasswordResponse.status).toBe(401);
    expect(wrongPasswordResponse.body).toEqual(unknownEmailResponse.body);
  });

  it('issues a token that future protected middleware can verify', async () => {
    const user = await createTestUser();

    const response = await login({ email: user.email, password: testPassword });
    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    const claims = jwt.verify(response.body.token, jwtSecret) as JwtPayload;

    expect(claims.sub).toBe(user.id);
    expect(claims.role).toBe('USER');
  });
});
