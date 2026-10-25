import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../../src/app.js';

const prisma = new PrismaClient();
const createdVehicleIds = new Set<string>();
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in apps/api/.env.test for vehicle tests.');
}

const configuredJwtSecret = jwtSecret;

function createToken(role: 'USER' | 'ADMIN') {
  return jwt.sign({ role }, configuredJwtSecret, {
    subject: `${role.toLowerCase()}-vehicle-list-test-user`,
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
      make: overrides.make ?? `List Test Make ${randomUUID()}`,
      model: overrides.model ?? 'List Test Model',
      category: overrides.category ?? 'SUV',
      price: new Prisma.Decimal(overrides.price ?? '24999.99'),
      quantityInStock: overrides.quantityInStock ?? 5,
    },
  });

  createdVehicleIds.add(vehicle.id);
  return vehicle;
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

describe('GET /api/vehicles', () => {
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
    const response = await request(app).get('/api/vehicles');

    expectUnauthorized(response);
  });

  it.each(['USER', 'ADMIN'] as const)(
    'allows an authenticated %s to list vehicles',
    async (role) => {
      await createTestVehicle();

      const response = await request(app)
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${createToken(role)}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('vehicles');
      expect(Array.isArray(response.body.vehicles)).toBe(true);
    },
  );

  it('returns an empty vehicles collection when inventory is empty', async () => {
    const response = await request(app)
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${createToken('USER')}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ vehicles: [] });
  });

  it('returns each vehicle with its public fields and timestamps', async () => {
    const vehicle = await createTestVehicle({
      make: `Public Fields Make ${randomUUID()}`,
      model: 'Public Fields Model',
      category: 'Sedan',
      price: '12345.60',
      quantityInStock: 3,
    });

    const response = await request(app)
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${createToken('USER')}`);

    expect(response.status).toBe(200);
    expect(response.body.vehicles).toContainEqual({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
      price: '12345.60',
      quantityInStock: vehicle.quantityInStock,
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: vehicle.updatedAt.toISOString(),
    });
  });

  it('serializes Decimal prices consistently to two decimal places', async () => {
    const wholePriceVehicle = await createTestVehicle({
      price: '12000',
    });
    const fractionalPriceVehicle = await createTestVehicle({
      price: '12000.5',
    });

    const response = await request(app)
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${createToken('USER')}`);

    expect(response.status).toBe(200);
    expect(response.body.vehicles).toContainEqual(
      expect.objectContaining({ id: wholePriceVehicle.id, price: '12000.00' }),
    );
    expect(response.body.vehicles).toContainEqual(
      expect.objectContaining({ id: fractionalPriceVehicle.id, price: '12000.50' }),
    );
  });

  it('returns multiple vehicles without exposing internal or sensitive fields', async () => {
    const firstVehicle = await createTestVehicle({
      make: `First List Make ${randomUUID()}`,
      price: '10000.00',
    });
    const secondVehicle = await createTestVehicle({
      make: `Second List Make ${randomUUID()}`,
      price: '20000.00',
    });

    const response = await request(app)
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${createToken('ADMIN')}`);

    expect(response.status).toBe(200);
    expect(response.body.vehicles).toHaveLength(2);
    expect(response.body.vehicles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstVehicle.id, make: firstVehicle.make }),
        expect.objectContaining({ id: secondVehicle.id, make: secondVehicle.make }),
      ]),
    );

    for (const vehicle of response.body.vehicles) {
      expect(vehicle).not.toHaveProperty('passwordHash');
      expect(vehicle).not.toHaveProperty('databaseUrl');
      expect(vehicle).not.toHaveProperty('stack');
    }
  });
});
