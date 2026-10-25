import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { prisma } from '../db/prisma.js';
import { serializeVehicle } from '../vehicles/create.js';

type AuthenticatedUser = {
  id: string;
  role: 'USER' | 'ADMIN';
};

type PurchaseWithVehicle = Prisma.PurchaseGetPayload<{
  include: {
    vehicle: true;
  };
}>;

function sendError(response: Response, status: number, code: string, message: string) {
  response.status(status).json({
    error: {
      code,
      message,
    },
  });
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    (user.role === 'USER' || user.role === 'ADMIN')
  );
}

function serializePurchaseHistory(purchase: PurchaseWithVehicle) {
  return {
    id: purchase.id,
    userId: purchase.userId,
    vehicleId: purchase.vehicleId,
    quantity: purchase.quantity,
    unitPrice: purchase.unitPrice.toFixed(2),
    purchasedAt: purchase.purchasedAt.toISOString(),
    vehicle: serializeVehicle(purchase.vehicle),
  };
}

export async function listPurchaseHistory(_request: Request, response: Response) {
  try {
    const authenticatedUser = response.locals.authenticatedUser;

    if (!isAuthenticatedUser(authenticatedUser)) {
      sendError(response, 401, 'UNAUTHORIZED', 'Authentication required.');
      return;
    }

    const purchases = await prisma.purchase.findMany({
      where: authenticatedUser.role === 'ADMIN' ? undefined : { userId: authenticatedUser.id },
      include: {
        vehicle: true,
      },
      orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }],
    });

    response.status(200).json({
      purchases: purchases.map(serializePurchaseHistory),
    });
  } catch {
    sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'Unable to retrieve purchase history.');
  }
}
