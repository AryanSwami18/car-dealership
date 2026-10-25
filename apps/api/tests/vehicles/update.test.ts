import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../../src/app.js';

/*
 * Update contract for PUT /api/vehicles/:id:
 * - the endpoint uses full-replacement semantics, so all mutable vehicle fields are required.
 * - make, model, and category are trimmed non-empty strings.
 * - price is a finite non-negative Decimal value.
 * - quantityInStock is a non-negative integer.
 * - malformed IDs return a safe 400 validation error; unknown valid IDs return a safe 404.
 * - successful responses use the existing { vehicle: serializedVehicle } shape.
 */

const prisma = new PrismaClient();
const createdVehicleIds = new Set<string>();
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in apps/api/.env.test for vehicle tests.');
}

const configuredJwtSecret = jwtSecret;

type VehicleUpdatePayload = {
  make: string;
  model: string;
  category: string;
  price: string | number;
  quantityInStock: unknown;
};

function createToken(role: 'USER' | 'ADMIN') {
  return jwt.sign({ role }, configuredJwtSecret, {
    subject: `${role.toLowerCase()}-vehicle-update-test-user`,
    expiresIn: 60 * 60,
  });
}

function validVehiclePayload(overrides: Partial<VehicleUpdatePayload> = {}): VehicleUpdatePayload {
  return {
    make: 'Updated Motors',
    model: 'Updated Model',
    category: 'Sedan',
    price: '31499.95',
    quantityInStock: 7,
    ...overrides,
  };
}

async function createTestVehicle(
  overrides: Partial<{
    make: string;
    model: string;
    category: string;
    price: string;
    quantityInStock: number;
  }> = {},
) {
  const vehicle = await prisma.vehicle.create({
    data: {
      make: overrides.make ?? `Update Test Make ${randomUUID()}`,
      model: overrides.model ?? 'Update Test Model',
      category: overrides.category ?? 'SUV',
      price: new Prisma.Decimal(overrides.price ?? '24999.99'),
      quantityInStock: overrides.quantityInStock ?? 5,
    },
  });

  createdVehicleIds.add(vehicle.id);
  return vehicle;
}

function updateVehicle(id: string, role: 'USER' | 'ADMIN', payload?: unknown) {
  const requestBuilder = request(app)
    .put(`/api/vehicles/${id}`)
    .set('Authorization', `Bearer ${createToken(role)}`);

  if (payload === undefined) {
    return requestBuilder;
  }

  if (payload === null) {
    return requestBuilder.set('Content-Type', 'application/json').send('null');
  }

  return requestBuilder.send(payload as string | object);
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

function expectValidationError(response: request.Response) {
  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({
    error: {
      code: 'VALIDATION_ERROR',
      message: expect.any(String),
    },
  });
  expect(response.body).not.toHaveProperty('stack');
}

function expectNotFound(response: request.Response) {
  expect(response.status).toBe(404);
  expect(response.body).toEqual({
    error: {
      code: 'NOT_FOUND',
      message: 'Vehicle not found.',
    },
  });
  expect(response.body).not.toHaveProperty('stack');
}

describe('PUT /api/vehicles/:id', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    if (createdVehicleIds.size > 0) {
      await prisma.vehicle.deleteMany({
        where: {
          id: {
            in: [...createdVehicleIds],
          },
        },
      });
    }

    createdVehicleIds.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const vehicle = await createTestVehicle();

    const response = await request(app)
      .put(`/api/vehicles/${vehicle.id}`)
      .send(validVehiclePayload());

    expectUnauthorized(response);
  });

  it('rejects an authenticated USER request with 403', async () => {
    const vehicle = await createTestVehicle();

    const response = await updateVehicle(vehicle.id, 'USER', validVehiclePayload());

    expectForbidden(response);
  });

  it('allows an authenticated ADMIN to replace all mutable vehicle fields', async () => {
    const vehicle = await createTestVehicle({
      make: 'Original Motors',
      model: 'Original Model',
      category: 'SUV',
      price: '24999.99',
      quantityInStock: 5,
    });
    const payload = validVehiclePayload();

    const response = await updateVehicle(vehicle.id, 'ADMIN', payload);

    expect(response.status).toBe(200);
    expect(response.body.vehicle).toMatchObject({
      id: vehicle.id,
      make: payload.make,
      model: payload.model,
      category: payload.category,
      price: '31499.95',
      quantityInStock: payload.quantityInStock,
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: expect.any(String),
    });
    expect(response.body.vehicle).not.toHaveProperty('passwordHash');
    expect(response.body.vehicle).not.toHaveProperty('databaseUrl');
    expect(response.body.vehicle).not.toHaveProperty('stack');

    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });

    expect(persistedVehicle).toMatchObject({
      id: vehicle.id,
      make: payload.make,
      model: payload.model,
      category: payload.category,
      price: new Prisma.Decimal('31499.95'),
      quantityInStock: payload.quantityInStock,
      createdAt: vehicle.createdAt,
    });
  });

  it('returns 404 for a valid but missing vehicle ID', async () => {
    const response = await updateVehicle(randomUUID(), 'ADMIN', validVehiclePayload());

    expectNotFound(response);
  });

  it.each([
    ['negative price', { price: '-1' }],
    ['negative stock', { quantityInStock: -1 }],
    ['fractional stock', { quantityInStock: 2.5 }],
    ['invalid price', { price: 'not-a-number' }],
    ['invalid stock', { quantityInStock: '5' }],
  ])('rejects %s with a safe validation error', async (_description, override) => {
    const vehicle = await createTestVehicle();

    const response = await updateVehicle(vehicle.id, 'ADMIN', validVehiclePayload(override));

    expectValidationError(response);
  });

  it.each(['not-a-uuid', '123'])('rejects malformed vehicle ID: %s', async (id) => {
    const response = await updateVehicle(id, 'ADMIN', validVehiclePayload());

    expectValidationError(response);
  });

  it.each([
    ['empty object', {}],
    ['missing make', { model: 'Model', category: 'SUV', price: '10000', quantityInStock: 1 }],
    ['missing model', { make: 'Make', category: 'SUV', price: '10000', quantityInStock: 1 }],
    ['missing category', { make: 'Make', model: 'Model', price: '10000', quantityInStock: 1 }],
    ['missing price', { make: 'Make', model: 'Model', category: 'SUV', quantityInStock: 1 }],
    ['missing stock', { make: 'Make', model: 'Model', category: 'SUV', price: '10000' }],
  ])('rejects an invalid full-replacement payload: %s', async (_description, payload) => {
    const vehicle = await createTestVehicle();

    const response = await updateVehicle(vehicle.id, 'ADMIN', payload);

    expectValidationError(response);
  });

  it('rejects partial payloads and leaves the existing vehicle unchanged', async () => {
    const vehicle = await createTestVehicle({
      make: 'Original Motors',
      model: 'Original Model',
      category: 'SUV',
      price: '24999.99',
      quantityInStock: 5,
    });

    const response = await updateVehicle(vehicle.id, 'ADMIN', { price: '30000.00' });

    expectValidationError(response);

    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });

    expect(persistedVehicle).toMatchObject({
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
      price: vehicle.price,
      quantityInStock: vehicle.quantityInStock,
    });
  });
});
