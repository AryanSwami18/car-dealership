import { randomUUID } from 'node:crypto';

import { PrismaClient, Role } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../../src/app.js';

const prisma = new PrismaClient();
const createdEmails = new Set<string>();

const validPassword = 'SecurePass1';

function registrationPayload(overrides: Record<string, unknown> = {}) {
  const email = `registration-${randomUUID()}@example.test`;
  createdEmails.add(email);

  return {
    name: 'Ada Lovelace',
    email,
    password: validPassword,
    ...overrides,
  };
}

function expectValidationError(response: request.Response) {
  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({
    error: {
      code: 'VALIDATION_ERROR',
      message: expect.any(String),
    },
  });
  expect(response.body).not.toHaveProperty('passwordHash');
  expect(response.body).not.toHaveProperty('stack');
}

describe('POST /api/auth/register', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    if (createdEmails.size > 0) {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [...createdEmails],
          },
        },
      });
    }

    createdEmails.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('registers a valid user and returns a safe public representation', async () => {
    const payload = registrationPayload();

    const response = await request(app).post('/api/auth/register').send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      user: {
        name: payload.name,
        email: payload.email,
        role: 'USER',
      },
    });
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user).toHaveProperty('createdAt');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('stores a password hash instead of the plaintext password', async () => {
    const payload = registrationPayload();

    const response = await request(app).post('/api/auth/register').send(payload);
    const storedUser = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    expect(response.status).toBe(201);
    expect(storedUser).not.toBeNull();
    expect(storedUser?.passwordHash).not.toBe(payload.password);
    expect(storedUser?.passwordHash.length).toBeGreaterThan(20);
  });

  it.each(['name', 'email', 'password'])(
    'rejects registration when %s is missing',
    async (field) => {
      const payload: Record<string, unknown> = registrationPayload();
      delete payload[field];

      const response = await request(app).post('/api/auth/register').send(payload);

      expectValidationError(response);
    },
  );

  it('rejects an invalid email format', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(registrationPayload({ email: 'not-an-email' }));

    expectValidationError(response);
  });

  it('rejects registration fields that exceed their supported lengths', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(
        registrationPayload({
          name: 'A'.repeat(121),
          email: `${'a'.repeat(310)}@example.test`,
        }),
      );

    expectValidationError(response);
  });

  it.each(['short', 'alllowercase1', 'ALLUPPERCASE1', 'NoNumber'])(
    'rejects a password that does not meet the strength rules: %s',
    async (password) => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationPayload({ password }));

      expectValidationError(response);
    },
  );

  it('rejects a duplicate email with a conflict response', async () => {
    const payload = registrationPayload();

    await prisma.user.create({
      data: {
        name: 'Existing User',
        email: payload.email,
        passwordHash: 'existing-password-hash',
      },
    });

    const response = await request(app).post('/api/auth/register').send(payload);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        message: expect.any(String),
      },
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('stack');
  });

  it('does not allow public registration to create an admin account', async () => {
    const payload = registrationPayload({ role: 'ADMIN' });

    const response = await request(app).post('/api/auth/register').send(payload);
    const storedUser = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('USER');
    expect(storedUser?.role).toBe(Role.USER);
  });
});
