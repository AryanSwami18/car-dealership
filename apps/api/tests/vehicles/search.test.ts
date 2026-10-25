import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../../src/app.js';

/*
 * Query contract for GET /api/vehicles:
 * - search is an optional, trimmed, case-insensitive substring match across make and model.
 * - category is an optional, trimmed, case-insensitive exact match.
 * - empty or whitespace-only values are treated as omitted filters.
 * - repeated or object-style filter values are invalid and return VALIDATION_ERROR (400).
 * - the response remains { vehicles: [...] } and uses the existing public vehicle serializer.
 */

const prisma = new PrismaClient();
const createdVehicleIds = new Set<string>();
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in apps/api/.env.test for vehicle tests.');
}

const configuredJwtSecret = jwtSecret;

function createToken(role: 'USER' | 'ADMIN') {
  return jwt.sign({ role }, configuredJwtSecret, {
    subject: `${role.toLowerCase()}-vehicle-search-test-user`,
    expiresIn: 60 * 60,
  });
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
      make: overrides.make ?? `Search Test Make ${randomUUID()}`,
      model: overrides.model ?? 'Search Test Model',
      category: overrides.category ?? 'SUV',
      price: new Prisma.Decimal(overrides.price ?? '24999.99'),
      quantityInStock: overrides.quantityInStock ?? 5,
    },
  });

  createdVehicleIds.add(vehicle.id);
  return vehicle;
}

function listVehicles(role: 'USER' | 'ADMIN', query = '') {
  return request(app)
    .get(`/api/vehicles${query}`)
    .set('Authorization', `Bearer ${createToken(role)}`);
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

describe('GET /api/vehicles search and filtering', () => {
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

  it('requires authentication when search or filters are requested', async () => {
    const response = await request(app).get('/api/vehicles?search=roadster&category=Coupe');

    expectUnauthorized(response);
  });

  it.each(['USER', 'ADMIN'] as const)(
    'preserves authenticated %s access while filtering',
    async (role) => {
      const matchingVehicle = await createTestVehicle({
        make: `Acme ${randomUUID()}`,
        model: 'Roadster',
      });
      await createTestVehicle({
        make: `Other ${randomUUID()}`,
        model: 'Sedan',
      });

      const response = await listVehicles(role, '?search=roadster');

      expect(response.status).toBe(200);
      expect(response.body.vehicles).toHaveLength(1);
      expect(response.body.vehicles[0].id).toBe(matchingVehicle.id);
    },
  );

  it('searches vehicles by make', async () => {
    const matchingVehicle = await createTestVehicle({
      make: 'Aurora Motors',
      model: 'Roadster',
    });
    await createTestVehicle({
      make: 'Borealis Cars',
      model: 'Roadster',
    });

    const response = await listVehicles('USER', '?search=Aurora');

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: { id: string }) => vehicle.id)).toEqual([
      matchingVehicle.id,
    ]);
  });

  it('searches vehicles by model', async () => {
    const matchingVehicle = await createTestVehicle({
      make: 'Aurora Motors',
      model: 'Falcon GT',
    });
    await createTestVehicle({
      make: 'Aurora Motors',
      model: 'City Sedan',
    });

    const response = await listVehicles('USER', '?search=Falcon');

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: { id: string }) => vehicle.id)).toEqual([
      matchingVehicle.id,
    ]);
  });

  it('matches search terms case-insensitively across make and model', async () => {
    const matchingVehicle = await createTestVehicle({
      make: 'Northstar Motors',
      model: 'Explorer',
    });
    await createTestVehicle({
      make: 'Southstar Motors',
      model: 'Commuter',
    });

    const response = await listVehicles('USER', '?search=nOrThStAr');

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: { id: string }) => vehicle.id)).toEqual([
      matchingVehicle.id,
    ]);
  });

  it('filters vehicles by category', async () => {
    const matchingVehicle = await createTestVehicle({
      make: 'Category Motors',
      model: 'Utility',
      category: 'SUV',
    });
    await createTestVehicle({
      make: 'Category Motors',
      model: 'Family',
      category: 'Sedan',
    });

    const response = await listVehicles('USER', '?category=sUv');

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: { id: string }) => vehicle.id)).toEqual([
      matchingVehicle.id,
    ]);
  });

  it('combines search and category filters', async () => {
    const matchingVehicle = await createTestVehicle({
      make: 'Combined Motors',
      model: 'Trail Edition',
      category: 'SUV',
    });
    await createTestVehicle({
      make: 'Combined Motors',
      model: 'Trail Edition',
      category: 'Sedan',
    });
    await createTestVehicle({
      make: 'Different Motors',
      model: 'Trail Edition',
      category: 'SUV',
    });

    const response = await listVehicles('USER', '?search=combined&category=suv');

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: { id: string }) => vehicle.id)).toEqual([
      matchingVehicle.id,
    ]);
  });

  it('returns an empty collection when no vehicles match', async () => {
    await createTestVehicle({ make: 'Existing Motors', model: 'Existing Model' });

    const response = await listVehicles('USER', '?search=NoSuchVehicle');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ vehicles: [] });
  });

  it.each(['?search=', '?search=%20%20%20', '?category=', '?category=%20%20%20'])(
    'treats an empty or whitespace-only filter as omitted: %s',
    async (query) => {
      const vehicle = await createTestVehicle();

      const response = await listVehicles('USER', query);

      expect(response.status).toBe(200);
      expect(response.body.vehicles.map((item: { id: string }) => item.id)).toEqual([vehicle.id]);
    },
  );

  it('rejects repeated filter values with a safe validation error', async () => {
    const response = await listVehicles('USER', '?search=one&search=two');

    expectValidationError(response);
  });

  it('keeps deterministic ordering and does not expose internal or sensitive fields', async () => {
    const firstVehicle = await createTestVehicle({
      make: `Deterministic First ${randomUUID()}`,
      model: 'Shared Model',
    });
    const secondVehicle = await createTestVehicle({
      make: `Deterministic Second ${randomUUID()}`,
      model: 'Shared Model',
    });

    const firstResponse = await listVehicles('ADMIN', '?search=Shared');
    const secondResponse = await listVehicles('ADMIN', '?search=Shared');

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstResponse.body.vehicles.map((vehicle: { id: string }) => vehicle.id)).toEqual(
      secondResponse.body.vehicles.map((vehicle: { id: string }) => vehicle.id),
    );
    expect(firstResponse.body.vehicles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstVehicle.id }),
        expect.objectContaining({ id: secondVehicle.id }),
      ]),
    );

    for (const vehicle of firstResponse.body.vehicles) {
      expect(vehicle).not.toHaveProperty('passwordHash');
      expect(vehicle).not.toHaveProperty('databaseUrl');
      expect(vehicle).not.toHaveProperty('stack');
    }
  });
});
