import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient, Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { app } from '../../src/app.js';
import { prisma as applicationPrisma } from '../../src/db/prisma.js';

/*
 * Purchase-history contract for GET /api/purchases:
 * - authentication is required.
 * - USER receives only purchases belonging to the authenticated user.
 * - ADMIN may view all purchase history under the existing role model.
 * - success returns { purchases: publicPurchase[] }.
 * - each purchase includes public vehicle details and the purchase-time unit price.
 * - results are ordered by purchasedAt descending, then id descending.
 * - unexpected database failures return a generic safe 500 response.
 */

const prisma = new PrismaClient();
const createdVehicleIds = new Set<string>();
const createdUserIds = new Set<string>();
const originalPurchaseFindMany = applicationPrisma.purchase.findMany;
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error(
    'JWT_SECRET must be configured in apps/api/.env.test for purchase-history tests.',
  );
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
      name: `Purchase History Test ${role}`,
      email: `purchase-history-${role.toLowerCase()}-${randomUUID()}@example.test`,
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
      make: overrides.make ?? `Purchase History Make ${randomUUID()}`,
      model: overrides.model ?? 'Purchase History Model',
      category: overrides.category ?? 'SUV',
      price: new Prisma.Decimal(overrides.price ?? '24999.99'),
      quantityInStock: overrides.quantityInStock ?? 5,
    },
  });

  createdVehicleIds.add(vehicle.id);
  return vehicle;
}

async function createTestPurchase(
  userId: string,
  vehicleId: string,
  overrides: Partial<{
    id: string;
    quantity: number;
    unitPrice: string;
    purchasedAt: Date;
  }> = {},
) {
  return prisma.purchase.create({
    data: {
      id: overrides.id,
      userId,
      vehicleId,
      quantity: overrides.quantity ?? 1,
      unitPrice: new Prisma.Decimal(overrides.unitPrice ?? '24999.99'),
      purchasedAt: overrides.purchasedAt,
    },
  });
}

function getPurchaseHistory(userId: string, role: Role) {
  return request(app)
    .get('/api/purchases')
    .set('Authorization', `Bearer ${createToken(userId, role)}`);
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

function expectInternalServerError(response: request.Response) {
  expect(response.status).toBe(500);
  expect(response.body).toEqual({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unable to retrieve purchase history.',
    },
  });
  expect(response.body).not.toHaveProperty('stack');
  expect(response.body).not.toHaveProperty('databaseUrl');
}

describe('GET /api/purchases', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    applicationPrisma.purchase.findMany = originalPurchaseFindMany;

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
    const response = await request(app).get('/api/purchases');

    expectUnauthorized(response);
  });

  it('allows an authenticated USER to retrieve only their own purchase history', async () => {
    const user = await createTestUser(Role.USER);
    const otherUser = await createTestUser(Role.USER);
    const vehicle = await createTestVehicle();
    const otherVehicle = await createTestVehicle();
    const ownPurchase = await createTestPurchase(user.id, vehicle.id);
    const otherPurchase = await createTestPurchase(otherUser.id, otherVehicle.id);

    const response = await getPurchaseHistory(user.id, Role.USER);

    expect(response.status).toBe(200);
    expect(response.body.purchases).toHaveLength(1);
    expect(response.body.purchases[0]).toMatchObject({
      id: ownPurchase.id,
      userId: user.id,
      vehicleId: vehicle.id,
    });
    expect(response.body.purchases).not.toContainEqual(
      expect.objectContaining({ id: otherPurchase.id }),
    );
  });

  it('does not allow a USER to access another user history through query parameters', async () => {
    const user = await createTestUser(Role.USER);
    const otherUser = await createTestUser(Role.USER);
    const vehicle = await createTestVehicle();
    const otherVehicle = await createTestVehicle();
    const ownPurchase = await createTestPurchase(user.id, vehicle.id);
    const otherPurchase = await createTestPurchase(otherUser.id, otherVehicle.id);

    const response = await request(app)
      .get('/api/purchases')
      .query({ userId: otherUser.id })
      .set('Authorization', `Bearer ${createToken(user.id, Role.USER)}`);

    expect(response.status).toBe(200);
    expect(response.body.purchases).toHaveLength(1);
    expect(response.body.purchases[0].id).toBe(ownPurchase.id);
    expect(response.body.purchases).not.toContainEqual(
      expect.objectContaining({ id: otherPurchase.id }),
    );
  });

  it('allows an authenticated ADMIN to retrieve all purchase history', async () => {
    const admin = await createTestUser(Role.ADMIN);
    const firstUser = await createTestUser(Role.USER);
    const secondUser = await createTestUser(Role.USER);
    const firstVehicle = await createTestVehicle();
    const secondVehicle = await createTestVehicle();
    const firstPurchase = await createTestPurchase(firstUser.id, firstVehicle.id);
    const secondPurchase = await createTestPurchase(secondUser.id, secondVehicle.id);

    const response = await getPurchaseHistory(admin.id, Role.ADMIN);

    expect(response.status).toBe(200);
    expect(response.body.purchases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstPurchase.id, userId: firstUser.id }),
        expect.objectContaining({ id: secondPurchase.id, userId: secondUser.id }),
      ]),
    );
  });

  it('returns purchase fields and safe public vehicle details without sensitive user data', async () => {
    const user = await createTestUser(Role.USER);
    const vehicle = await createTestVehicle({
      make: 'History Motors',
      model: 'History Model',
      category: 'Sedan',
      price: '18500.75',
      quantityInStock: 4,
    });
    const purchase = await createTestPurchase(user.id, vehicle.id, {
      quantity: 2,
      unitPrice: '18000.50',
    });

    const response = await getPurchaseHistory(user.id, Role.USER);

    expect(response.status).toBe(200);
    expect(response.body.purchases).toEqual([
      {
        id: purchase.id,
        userId: user.id,
        vehicleId: vehicle.id,
        quantity: 2,
        unitPrice: '18000.50',
        purchasedAt: purchase.purchasedAt.toISOString(),
        vehicle: {
          id: vehicle.id,
          make: 'History Motors',
          model: 'History Model',
          category: 'Sedan',
          price: '18500.75',
          quantityInStock: 4,
          createdAt: vehicle.createdAt.toISOString(),
          updatedAt: vehicle.updatedAt.toISOString(),
        },
      },
    ]);

    const serializedPurchase = response.body.purchases[0];
    expect(serializedPurchase).not.toHaveProperty('user');
    expect(serializedPurchase).not.toHaveProperty('email');
    expect(serializedPurchase).not.toHaveProperty('name');
    expect(serializedPurchase).not.toHaveProperty('passwordHash');
    expect(serializedPurchase).not.toHaveProperty('jwt');
    expect(serializedPurchase).not.toHaveProperty('token');
    expect(serializedPurchase.vehicle).not.toHaveProperty('passwordHash');
  });

  it('preserves the purchase-time unit price after the vehicle price changes', async () => {
    const user = await createTestUser(Role.USER);
    const vehicle = await createTestVehicle({ price: '22000.00' });
    const purchase = await createTestPurchase(user.id, vehicle.id, {
      unitPrice: '22000.00',
    });

    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { price: new Prisma.Decimal('24000.00') },
    });

    const response = await getPurchaseHistory(user.id, Role.USER);

    expect(response.status).toBe(200);
    expect(response.body.purchases).toContainEqual(
      expect.objectContaining({
        id: purchase.id,
        unitPrice: '22000.00',
        vehicle: expect.objectContaining({ price: '24000.00' }),
      }),
    );
  });

  it('returns a successful empty collection for a user with no purchases', async () => {
    const user = await createTestUser(Role.USER);

    const response = await getPurchaseHistory(user.id, Role.USER);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ purchases: [] });
  });

  it('orders purchases newest first with purchase ID as a stable tie-breaker', async () => {
    const user = await createTestUser(Role.USER);
    const vehicle = await createTestVehicle();
    const older = await createTestPurchase(user.id, vehicle.id, {
      id: '00000000-0000-4000-8000-000000000001',
      purchasedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const tiedFirst = await createTestPurchase(user.id, vehicle.id, {
      id: '00000000-0000-4000-8000-000000000002',
      purchasedAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    const tiedSecond = await createTestPurchase(user.id, vehicle.id, {
      id: '00000000-0000-4000-8000-000000000003',
      purchasedAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    const response = await getPurchaseHistory(user.id, Role.USER);

    expect(response.status).toBe(200);
    expect(response.body.purchases.map((item: { id: string }) => item.id)).toEqual([
      tiedSecond.id,
      tiedFirst.id,
      older.id,
    ]);
  });

  it('returns a generic safe error when purchase history retrieval fails', async () => {
    const user = await createTestUser(Role.USER);
    const findManySpy = vi
      .spyOn(applicationPrisma.purchase, 'findMany')
      .mockRejectedValueOnce(new Error('database internals must not leak'));

    const response = await getPurchaseHistory(user.id, Role.USER);

    expectInternalServerError(response);
    expect(findManySpy).toHaveBeenCalledOnce();
  });
});
