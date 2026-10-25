import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient, Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { app } from '../../src/app.js';
import { prisma as applicationPrisma } from '../../src/db/prisma.js';

/*
 * Restock contract for POST /api/vehicles/:id/restock:
 * - only an authenticated ADMIN may restock a vehicle.
 * - a successful restock returns 200 with the existing public vehicle serializer.
 * - quantity must be a positive integer.
 * - integer overflow returns 409 STOCK_LIMIT_EXCEEDED and leaves stock unchanged.
 * - unexpected database failures return a generic safe 500 response.
 */

const MAX_POSTGRES_INT = 2_147_483_647;
const prisma = new PrismaClient();
const createdVehicleIds = new Set<string>();
const createdUserIds = new Set<string>();
const originalVehicleUpdate = applicationPrisma.vehicle.update;
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in apps/api/.env.test for restock tests.');
}

const configuredJwtSecret = jwtSecret;

function createToken(userId: string, role: Role) {
  return jwt.sign({ role }, configuredJwtSecret, {
    subject: userId,
    expiresIn: 60 * 60,
  });
}

async function createTestUser(role: Role = Role.USER) {
  const user = await prisma.user.create({
    data: {
      name: `Restock Test ${role}`,
      email: `restock-${role.toLowerCase()}-${randomUUID()}@example.test`,
      passwordHash: 'test-only-password-hash',
      role,
    },
  });

  createdUserIds.add(user.id);
  return user;
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
      make: overrides.make ?? `Restock Test Make ${randomUUID()}`,
      model: overrides.model ?? 'Restock Test Model',
      category: overrides.category ?? 'SUV',
      price: new Prisma.Decimal(overrides.price ?? '24999.99'),
      quantityInStock: overrides.quantityInStock ?? 5,
    },
  });

  createdVehicleIds.add(vehicle.id);
  return vehicle;
}

function restockVehicle(userId: string, role: Role, vehicleId: string, payload: unknown) {
  return request(app)
    .post(`/api/vehicles/${vehicleId}/restock`)
    .set('Authorization', `Bearer ${createToken(userId, role)}`)
    .send(payload as string | object);
}

function purchaseVehicle(userId: string, role: Role, vehicleId: string, quantity: number) {
  return request(app)
    .post(`/api/vehicles/${vehicleId}/purchase`)
    .set('Authorization', `Bearer ${createToken(userId, role)}`)
    .send({ quantity });
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

function expectStockLimitError(response: request.Response) {
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    error: {
      code: 'STOCK_LIMIT_EXCEEDED',
      message: 'Vehicle stock limit exceeded.',
    },
  });
  expect(response.body).not.toHaveProperty('stack');
}

function expectInternalServerError(response: request.Response) {
  expect(response.status).toBe(500);
  expect(response.body).toEqual({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unable to restock vehicle.',
    },
  });
  expect(response.body).not.toHaveProperty('stack');
  expect(response.body).not.toHaveProperty('databaseUrl');
}

describe('POST /api/vehicles/:id/restock', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    applicationPrisma.vehicle.update = originalVehicleUpdate;

    const vehicleIds = [...createdVehicleIds];
    const userIds = [...createdUserIds];

    if (vehicleIds.length > 0 || userIds.length > 0) {
      await prisma.purchase.deleteMany({
        where: {
          OR: [
            ...(vehicleIds.length > 0 ? [{ vehicleId: { in: vehicleIds } }] : []),
            ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
          ],
        },
      });
    }

    if (vehicleIds.length > 0) {
      await prisma.vehicle.deleteMany({
        where: {
          id: {
            in: vehicleIds,
          },
        },
      });
    }

    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });
    }

    createdVehicleIds.clear();
    createdUserIds.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const vehicle = await createTestVehicle();

    const response = await request(app)
      .post(`/api/vehicles/${vehicle.id}/restock`)
      .send({ quantity: 1 });

    expectUnauthorized(response);
  });

  it('rejects an authenticated USER request with 403', async () => {
    const user = await createTestUser(Role.USER);
    const vehicle = await createTestVehicle();

    const response = await restockVehicle(user.id, Role.USER, vehicle.id, { quantity: 1 });

    expectForbidden(response);
  });

  it('allows an authenticated ADMIN to restock an existing vehicle', async () => {
    const admin = await createTestUser(Role.ADMIN);
    const vehicle = await createTestVehicle({ quantityInStock: 4 });

    const response = await restockVehicle(admin.id, Role.ADMIN, vehicle.id, { quantity: 3 });

    expect(response.status).toBe(200);
    expect(response.body.vehicle).toMatchObject({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
      price: '24999.99',
      quantityInStock: 7,
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: expect.any(String),
    });
    expect(response.body.vehicle).not.toHaveProperty('passwordHash');
    expect(response.body.vehicle).not.toHaveProperty('databaseUrl');
    expect(response.body.vehicle).not.toHaveProperty('stack');
  });

  it('increases stock by a valid positive integer quantity', async () => {
    const admin = await createTestUser(Role.ADMIN);
    const vehicle = await createTestVehicle({ quantityInStock: 2 });

    const response = await restockVehicle(admin.id, Role.ADMIN, vehicle.id, { quantity: 5 });

    expect(response.status).toBe(200);
    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });

    expect(persistedVehicle?.quantityInStock).toBe(7);
  });

  it.each([
    ['missing quantity', {}],
    ['zero quantity', { quantity: 0 }],
    ['negative quantity', { quantity: -1 }],
    ['fractional quantity', { quantity: 1.5 }],
    ['invalid numeric quantity', { quantity: 'five' }],
    ['null quantity', { quantity: null }],
  ])('rejects %s with a safe validation error', async (_description, payload) => {
    const admin = await createTestUser(Role.ADMIN);
    const vehicle = await createTestVehicle();

    const response = await restockVehicle(admin.id, Role.ADMIN, vehicle.id, payload);

    expectValidationError(response);
  });

  it('returns 404 for a valid but nonexistent vehicle ID', async () => {
    const admin = await createTestUser(Role.ADMIN);

    const response = await restockVehicle(admin.id, Role.ADMIN, randomUUID(), { quantity: 1 });

    expectNotFound(response);
  });

  it('preserves all other vehicle fields and uses the safe vehicle serializer', async () => {
    const admin = await createTestUser(Role.ADMIN);
    const vehicle = await createTestVehicle({
      make: 'Stable Motors',
      model: 'Stable Model',
      category: 'Sedan',
      price: '18500.75',
      quantityInStock: 6,
    });

    const response = await restockVehicle(admin.id, Role.ADMIN, vehicle.id, { quantity: 2 });

    expect(response.status).toBe(200);
    expect(response.body.vehicle).toEqual({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
      price: '18500.75',
      quantityInStock: 8,
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: expect.any(String),
    });
    expect(response.body.vehicle).not.toHaveProperty('passwordHash');
    expect(response.body.vehicle).not.toHaveProperty('databaseUrl');
    expect(response.body.vehicle).not.toHaveProperty('stack');
  });

  it('rejects stock overflow without changing the vehicle', async () => {
    const admin = await createTestUser(Role.ADMIN);
    const vehicle = await createTestVehicle({ quantityInStock: MAX_POSTGRES_INT });

    const response = await restockVehicle(admin.id, Role.ADMIN, vehicle.id, { quantity: 1 });

    expectStockLimitError(response);
    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });
    expect(persistedVehicle?.quantityInStock).toBe(MAX_POSTGRES_INT);
  });

  it('returns a generic safe error when the database update fails', async () => {
    const admin = await createTestUser(Role.ADMIN);
    const vehicle = await createTestVehicle({ quantityInStock: 3 });
    const updateSpy = vi
      .spyOn(applicationPrisma.vehicle, 'update')
      .mockRejectedValueOnce(new Error('database internals must not leak'));

    const response = await restockVehicle(admin.id, Role.ADMIN, vehicle.id, { quantity: 1 });

    expectInternalServerError(response);
    expect(updateSpy).toHaveBeenCalledOnce();
    updateSpy.mockRestore();

    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });
    expect(persistedVehicle?.quantityInStock).toBe(3);
  });

  it('allows purchasing restocked stock without allowing concurrent overselling', async () => {
    const admin = await createTestUser(Role.ADMIN);
    const firstUser = await createTestUser(Role.USER);
    const secondUser = await createTestUser(Role.USER);
    const vehicle = await createTestVehicle({ quantityInStock: 0 });

    const restockResponse = await restockVehicle(admin.id, Role.ADMIN, vehicle.id, {
      quantity: 2,
    });
    expect(restockResponse.status).toBe(200);

    const purchaseResponses = await Promise.all([
      purchaseVehicle(firstUser.id, Role.USER, vehicle.id, 2),
      purchaseVehicle(secondUser.id, Role.USER, vehicle.id, 2),
    ]);

    expect(purchaseResponses.map((response) => response.status).sort()).toEqual([201, 409]);

    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });
    const purchases = await prisma.purchase.findMany({
      where: { vehicleId: vehicle.id },
    });

    expect(persistedVehicle?.quantityInStock).toBe(0);
    expect(purchases).toHaveLength(1);
    expect(purchases[0]?.quantity).toBe(2);
  });
});
