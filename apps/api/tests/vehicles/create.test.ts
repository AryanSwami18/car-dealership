import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../../src/app.js';

const prisma = new PrismaClient();
const createdMakes = new Set<string>();
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in apps/api/.env.test for vehicle tests.');
}

const configuredJwtSecret = jwtSecret;

function createToken(role: 'USER' | 'ADMIN') {
  return jwt.sign({ role }, configuredJwtSecret, {
    subject: `${role.toLowerCase()}-vehicle-test-user`,
    expiresIn: 60 * 60,
  });
}

function vehiclePayload(overrides: Record<string, unknown> = {}) {
  const make = `TDD Vehicle ${randomUUID()}`;
  createdMakes.add(make);

  return {
    make,
    model: 'Model Test',
    category: 'SUV',
    price: 24999.99,
    quantityInStock: 5,
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
  expect(response.body).not.toHaveProperty('stack');
  expect(response.body).not.toHaveProperty('passwordHash');
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
}

describe('POST /api/vehicles', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    if (createdMakes.size > 0) {
      await prisma.vehicle.deleteMany({
        where: {
          make: {
            in: [...createdMakes],
          },
        },
      });
    }

    createdMakes.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const response = await request(app).post('/api/vehicles').send(vehiclePayload());

    expectUnauthorized(response);
  });

  it('rejects an authenticated USER with 403', async () => {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${createToken('USER')}`)
      .send(vehiclePayload());

    expectForbidden(response);
  });

  it('allows an authenticated ADMIN to create a vehicle with valid data', async () => {
    const payload = vehiclePayload();

    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${createToken('ADMIN')}`)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.vehicle).toMatchObject({
      make: payload.make,
      model: payload.model,
      category: payload.category,
      price: '24999.99',
      quantityInStock: payload.quantityInStock,
    });

    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: response.body.vehicle.id },
    });

    expect(persistedVehicle).not.toBeNull();
    expect(persistedVehicle).toMatchObject({
      make: payload.make,
      model: payload.model,
      category: payload.category,
      quantityInStock: payload.quantityInStock,
    });
    expect(persistedVehicle?.price.toString()).toBe('24999.99');
  });

  it.each(['make', 'model', 'category', 'price', 'quantityInStock'])(
    'rejects a request when %s is missing',
    async (field) => {
      const payload: Record<string, unknown> = vehiclePayload();
      delete payload[field];

      const response = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${createToken('ADMIN')}`)
        .send(payload);

      expectValidationError(response);
    },
  );

  it.each([
    { field: 'price', value: -0.01 },
    { field: 'quantityInStock', value: -1 },
  ])('rejects a negative $field', async ({ field, value }) => {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${createToken('ADMIN')}`)
      .send(vehiclePayload({ [field]: value }));

    expectValidationError(response);
  });

  it('rejects vehicle text fields and prices outside supported ranges', async () => {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${createToken('ADMIN')}`)
      .send(
        vehiclePayload({
          make: 'A'.repeat(101),
          price: '10000000000.00',
        }),
      );

    expectValidationError(response);
  });

  it.each([
    { field: 'price', value: 'not-a-number' },
    { field: 'quantityInStock', value: 'five' },
    { field: 'quantityInStock', value: 1.5 },
  ])('rejects an invalid numeric value for $field', async ({ field, value }) => {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${createToken('ADMIN')}`)
      .send(vehiclePayload({ [field]: value }));

    expectValidationError(response);
  });

  it('returns only safe public vehicle data after creation', async () => {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${createToken('ADMIN')}`)
      .send(vehiclePayload());

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      vehicle: {
        id: expect.any(String),
        make: expect.any(String),
        model: expect.any(String),
        category: expect.any(String),
        price: expect.any(String),
        quantityInStock: expect.any(Number),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('databaseUrl');
    expect(response.body).not.toHaveProperty('stack');
  });
});
