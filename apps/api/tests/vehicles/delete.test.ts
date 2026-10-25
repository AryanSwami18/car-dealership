import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient, Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { app } from '../../src/app.js';
import { prisma as applicationPrisma } from '../../src/db/prisma.js';

/*
 * Delete contract for DELETE /api/vehicles/:id:
 * - only an authenticated ADMIN may delete a vehicle.
 * - successful deletion returns 204 No Content.
 * - malformed IDs return a safe 400 validation error; unknown valid IDs return a safe 404.
 * - the Purchase.vehicleId foreign key uses ON DELETE RESTRICT, so a vehicle with purchase
 *   history returns 409 VEHICLE_HAS_PURCHASE_HISTORY and both records are preserved.
 * - unexpected database failures return a generic safe 500 response.
 */

const prisma = new PrismaClient();
const createdVehicleIds = new Set<string>();
const createdPurchaseIds = new Set<string>();
const createdUserIds = new Set<string>();
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in apps/api/.env.test for vehicle tests.');
}

const configuredJwtSecret = jwtSecret;

function createToken(role: 'USER' | 'ADMIN') {
  return jwt.sign({ role }, configuredJwtSecret, {
    subject: `${role.toLowerCase()}-vehicle-delete-test-user`,
    expiresIn: 60 * 60,
  });
}

async function createTestVehicle() {
  const vehicle = await prisma.vehicle.create({
    data: {
      make: `Delete Test Make ${randomUUID()}`,
      model: 'Delete Test Model',
      category: 'SUV',
      price: new Prisma.Decimal('24999.99'),
      quantityInStock: 5,
    },
  });

  createdVehicleIds.add(vehicle.id);
  return vehicle;
}

async function createPurchaseHistory(vehicleId: string) {
  const user = await prisma.user.create({
    data: {
      name: 'Delete Test Buyer',
      email: `delete-test-${randomUUID()}@example.test`,
      passwordHash: 'test-only-password-hash',
      role: Role.USER,
    },
  });
  createdUserIds.add(user.id);

  const purchase = await prisma.purchase.create({
    data: {
      userId: user.id,
      vehicleId,
      quantity: 1,
      unitPrice: new Prisma.Decimal('24999.99'),
    },
  });
  createdPurchaseIds.add(purchase.id);

  return { purchase, user };
}

function deleteVehicle(id: string, role: 'USER' | 'ADMIN') {
  return request(app)
    .delete(`/api/vehicles/${id}`)
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

function expectConflict(response: request.Response) {
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    error: {
      code: 'VEHICLE_HAS_PURCHASE_HISTORY',
      message: 'Vehicle cannot be deleted because it has purchase history.',
    },
  });
  expect(response.body).not.toHaveProperty('stack');
}

function expectInternalServerError(response: request.Response) {
  expect(response.status).toBe(500);
  expect(response.body).toEqual({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unable to delete vehicle.',
    },
  });
  expect(response.body).not.toHaveProperty('stack');
  expect(response.body).not.toHaveProperty('databaseUrl');
}

describe('DELETE /api/vehicles/:id', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    if (createdPurchaseIds.size > 0) {
      await prisma.purchase.deleteMany({
        where: {
          id: {
            in: [...createdPurchaseIds],
          },
        },
      });
    }

    if (createdVehicleIds.size > 0) {
      await prisma.vehicle.deleteMany({
        where: {
          id: {
            in: [...createdVehicleIds],
          },
        },
      });
    }

    if (createdUserIds.size > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [...createdUserIds],
          },
        },
      });
    }

    createdPurchaseIds.clear();
    createdVehicleIds.clear();
    createdUserIds.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const vehicle = await createTestVehicle();

    const response = await request(app).delete(`/api/vehicles/${vehicle.id}`);

    expectUnauthorized(response);
  });

  it('rejects an authenticated USER request with 403', async () => {
    const vehicle = await createTestVehicle();

    const response = await deleteVehicle(vehicle.id, 'USER');

    expectForbidden(response);
  });

  it('allows an authenticated ADMIN to delete an existing vehicle', async () => {
    const vehicle = await createTestVehicle();

    const response = await deleteVehicle(vehicle.id, 'ADMIN');

    expect(response.status).toBe(204);
    expect(response.text).toBe('');

    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });
    expect(persistedVehicle).toBeNull();

    const inventoryResponse = await request(app)
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${createToken('ADMIN')}`);

    expect(inventoryResponse.status).toBe(200);
    expect(inventoryResponse.body.vehicles).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: vehicle.id })]),
    );
  });

  it('returns 404 for a valid but nonexistent vehicle ID', async () => {
    const response = await deleteVehicle(randomUUID(), 'ADMIN');

    expectNotFound(response);
  });

  it.each(['not-a-uuid', '123'])('rejects malformed vehicle ID: %s', async (id) => {
    const response = await deleteVehicle(id, 'ADMIN');

    expectValidationError(response);
  });

  it('preserves a vehicle and its purchase history when deletion is restricted', async () => {
    const vehicle = await createTestVehicle();
    const { purchase } = await createPurchaseHistory(vehicle.id);

    const response = await deleteVehicle(vehicle.id, 'ADMIN');

    expectConflict(response);

    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });
    const persistedPurchase = await prisma.purchase.findUnique({
      where: { id: purchase.id },
    });

    expect(persistedVehicle).not.toBeNull();
    expect(persistedPurchase).not.toBeNull();
    expect(persistedPurchase?.vehicleId).toBe(vehicle.id);
  });

  it('returns a generic safe 500 response for unexpected database errors', async () => {
    const vehicle = await createTestVehicle();
    const deleteSpy = vi
      .spyOn(applicationPrisma.vehicle, 'delete')
      .mockRejectedValueOnce(new Error('database internals must not leak'));

    let response: request.Response;
    try {
      response = await deleteVehicle(vehicle.id, 'ADMIN');
    } finally {
      deleteSpy.mockRestore();
    }

    expectInternalServerError(response!);

    const persistedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
    });
    expect(persistedVehicle).not.toBeNull();
  });
});
