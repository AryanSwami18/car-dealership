import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient, Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { app } from '../../src/app.js';
import { prisma as applicationPrisma } from '../../src/db/prisma.js';

/*
 * Purchase contract for POST /api/vehicles/:id/purchase:
 * - authenticated USER and ADMIN roles may purchase vehicles.
 * - a successful purchase returns 201 with { purchase: publicPurchase }.
 * - quantity must be a positive integer and cannot exceed available stock.
 * - insufficient stock returns 409 INSUFFICIENT_STOCK.
 * - unitPrice stores the vehicle price at purchase time and is not changed by later price updates.
 * - stock decrement and purchase creation must occur in one PostgreSQL transaction.
 * - unexpected database failures return a generic safe 500 response without partial changes.
 */

const prisma = new PrismaClient();
const createdVehicleIds = new Set<string>();
const createdUserIds = new Set<string>();
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in apps/api/.env.test for purchase tests.');
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
      name: `Purchase Test ${role}`,
      email: `purchase-${role.toLowerCase()}-${randomUUID()}@example.test`,
      passwordHash: 'test-only-password-hash',
      role,
    },
  });

  createdUserIds.add(user.id);
  return user;
}

async function createTestVehicle(
  overrides: Partial<{
    price: string;
    quantityInStock: number;
  }> = {},
) {
  const vehicle = await prisma.vehicle.create({
    data: {
      make: `Purchase Test Make ${randomUUID()}`,
      model: 'Purchase Test Model',
      category: 'SUV',
      price: new Prisma.Decimal(overrides.price ?? '24999.99'),
      quantityInStock: overrides.quantityInStock ?? 5,
    },
  });

  createdVehicleIds.add(vehicle.id);
  return vehicle;
}

function purchaseVehicle(userId: string, role: Role, vehicleId: string, payload: unknown) {
  return request(app)
    .post(`/api/vehicles/${vehicleId}/purchase`)
    .set('Authorization', `Bearer ${createToken(userId, role)}`)
    .send(payload as string | object);
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

function expectInsufficientStock(response: request.Response) {
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    error: {
      code: 'INSUFFICIENT_STOCK',
      message: 'Insufficient vehicle stock.',
    },
  });
  expect(response.body).not.toHaveProperty('stack');
}

function expectInternalServerError(response: request.Response) {
  expect(response.status).toBe(500);
  expect(response.body).toEqual({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unable to complete vehicle purchase.',
    },
  });
  expect(response.body).not.toHaveProperty('stack');
  expect(response.body).not.toHaveProperty('databaseUrl');
}

describe('POST /api/vehicles/:id/purchase', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
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
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .send({ quantity: 1 });

    expectUnauthorized(response);
  });

  it.each([Role.USER, Role.ADMIN])('allows an authenticated %s to purchase', async (role) => {
    const user = await createTestUser(role);
    const vehicle = await createTestVehicle({ quantityInStock: 2 });

    const response = await purchaseVehicle(user.id, role, vehicle.id, { quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.purchase).toMatchObject({
      id: expect.any(String),
      userId: user.id,
      vehicleId: vehicle.id,
      quantity: 1,
      unitPrice: '24999.99',
      purchasedAt: expect.any(String),
    });
    expect(response.body.purchase).not.toHaveProperty('passwordHash');
    expect(response.body.purchase).not.toHaveProperty('databaseUrl');
    expect(response.body.purchase).not.toHaveProperty('stack');
  });

  it('records the authenticated user, vehicle, quantity, and purchase-time unit price', async () => {
    const user = await createTestUser();
    const vehicle = await createTestVehicle({ price: '27500.50', quantityInStock: 4 });

    const response = await purchaseVehicle(user.id, Role.USER, vehicle.id, { quantity: 2 });

    expect(response.status).toBe(201);
    const purchase = await prisma.purchase.findUnique({
      where: { id: response.body.purchase.id },
    });

    expect(purchase).toMatchObject({
      userId: user.id,
      vehicleId: vehicle.id,
      quantity: 2,
      unitPrice: new Prisma.Decimal('27500.50'),
    });
    expect(purchase?.purchasedAt).toBeInstanceOf(Date);
  });

  it('returns 404 for a valid but missing vehicle ID', async () => {
    const user = await createTestUser();

    const response = await purchaseVehicle(user.id, Role.USER, randomUUID(), { quantity: 1 });

    expectNotFound(response);
  });

  it.each([
    ['missing quantity', {}],
    ['zero quantity', { quantity: 0 }],
    ['negative quantity', { quantity: -1 }],
    ['fractional quantity', { quantity: 1.5 }],
    ['string quantity', { quantity: '1' }],
    ['null quantity', { quantity: null }],
  ])('rejects %s with a safe validation error', async (_description, payload) => {
    const user = await createTestUser();
    const vehicle = await createTestVehicle();

    const response = await purchaseVehicle(user.id, Role.USER, vehicle.id, payload);

    expectValidationError(response);
  });

  it('rejects a purchase that exceeds available stock without changing stock or history', async () => {
    const user = await createTestUser();
    const vehicle = await createTestVehicle({ quantityInStock: 2 });

    const response = await purchaseVehicle(user.id, Role.USER, vehicle.id, { quantity: 3 });

    expectInsufficientStock(response);

    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });
    const purchases = await prisma.purchase.findMany({
      where: { vehicleId: vehicle.id },
    });

    expect(persistedVehicle?.quantityInStock).toBe(2);
    expect(purchases).toHaveLength(0);
  });

  it('reduces stock by the purchased quantity', async () => {
    const user = await createTestUser();
    const vehicle = await createTestVehicle({ quantityInStock: 5 });

    const response = await purchaseVehicle(user.id, Role.USER, vehicle.id, { quantity: 3 });

    expect(response.status).toBe(201);
    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });

    expect(persistedVehicle?.quantityInStock).toBe(2);
  });

  it('stores a price snapshot that does not change after a later vehicle price update', async () => {
    const user = await createTestUser();
    const vehicle = await createTestVehicle({ price: '22000.00', quantityInStock: 2 });

    const response = await purchaseVehicle(user.id, Role.USER, vehicle.id, { quantity: 1 });

    expect(response.status).toBe(201);
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { price: new Prisma.Decimal('24000.00') },
    });

    const purchase = await prisma.purchase.findUnique({
      where: { id: response.body.purchase.id },
    });
    expect(purchase?.unitPrice).toEqual(new Prisma.Decimal('22000.00'));
  });

  it('allows only one of two concurrent purchases to consume the last unit', async () => {
    const firstUser = await createTestUser(Role.USER);
    const secondUser = await createTestUser(Role.ADMIN);
    const vehicle = await createTestVehicle({ quantityInStock: 1 });

    const responses = await Promise.all([
      purchaseVehicle(firstUser.id, Role.USER, vehicle.id, { quantity: 1 }),
      purchaseVehicle(secondUser.id, Role.ADMIN, vehicle.id, { quantity: 1 }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);

    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });
    const purchases = await prisma.purchase.findMany({
      where: { vehicleId: vehicle.id },
    });

    expect(persistedVehicle?.quantityInStock).toBe(0);
    expect(purchases).toHaveLength(1);
    expect(purchases[0]?.quantity).toBe(1);
  });

  it('returns a generic safe error and leaves no partial changes when the transaction fails', async () => {
    const user = await createTestUser();
    const vehicle = await createTestVehicle({ quantityInStock: 3 });
    const transactionSpy = vi
      .spyOn(applicationPrisma, '$transaction')
      .mockRejectedValueOnce(new Error('database internals must not leak'));

    const response = await purchaseVehicle(user.id, Role.USER, vehicle.id, { quantity: 1 });

    transactionSpy.mockRestore();

    expectInternalServerError(response);
    expect(transactionSpy).toHaveBeenCalledOnce();

    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });
    const purchases = await prisma.purchase.findMany({
      where: { vehicleId: vehicle.id },
    });

    expect(persistedVehicle?.quantityInStock).toBe(3);
    expect(purchases).toHaveLength(0);
  });
});
