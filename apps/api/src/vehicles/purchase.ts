import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { prisma } from '../db/prisma.js';

class PurchaseValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
}

class VehicleNotFoundError extends Error {
  readonly code = 'NOT_FOUND';
}

class InsufficientStockError extends Error {
  readonly code = 'INSUFFICIENT_STOCK';
}

function sendError(response: Response, status: number, code: string, message: string) {
  response.status(status).json({
    error: {
      code,
      message,
    },
  });
}

function parseQuantity(body: unknown) {
  if (typeof body !== 'object' || body === null) {
    throw new PurchaseValidationError('Quantity must be a positive integer.');
  }

  const quantity = (body as Record<string, unknown>).quantity;

  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
    throw new PurchaseValidationError('Quantity must be a positive integer.');
  }

  return quantity;
}

function serializePurchase(purchase: {
  id: string;
  userId: string;
  vehicleId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  purchasedAt: Date;
}) {
  return {
    id: purchase.id,
    userId: purchase.userId,
    vehicleId: purchase.vehicleId,
    quantity: purchase.quantity,
    unitPrice: purchase.unitPrice.toFixed(2),
    purchasedAt: purchase.purchasedAt.toISOString(),
  };
}

export async function purchaseVehicle(request: Request, response: Response) {
  try {
    const vehicleId = request.params.id;
    const userId = (response.locals.authenticatedUser as { id?: unknown } | undefined)?.id;

    if (typeof vehicleId !== 'string' || vehicleId.length === 0) {
      throw new PurchaseValidationError('Vehicle ID is required.');
    }

    if (typeof userId !== 'string') {
      sendError(response, 401, 'UNAUTHORIZED', 'Authentication required.');
      return;
    }

    const quantity = parseQuantity(request.body);
    const purchase = await prisma.$transaction(async (transaction) => {
      const vehicle = await transaction.vehicle.findUnique({
        where: { id: vehicleId },
      });

      if (!vehicle) {
        throw new VehicleNotFoundError('Vehicle not found.');
      }

      const stockUpdate = await transaction.vehicle.updateMany({
        where: {
          id: vehicleId,
          quantityInStock: {
            gte: quantity,
          },
        },
        data: {
          quantityInStock: {
            decrement: quantity,
          },
        },
      });

      if (stockUpdate.count !== 1) {
        throw new InsufficientStockError('Insufficient vehicle stock.');
      }

      return transaction.purchase.create({
        data: {
          userId,
          vehicleId,
          quantity,
          unitPrice: vehicle.price,
        },
      });
    });

    response.status(201).json({
      purchase: serializePurchase(purchase),
    });
  } catch (error) {
    if (error instanceof PurchaseValidationError) {
      sendError(response, 400, error.code, error.message);
      return;
    }

    if (error instanceof VehicleNotFoundError) {
      sendError(response, 404, error.code, error.message);
      return;
    }

    if (error instanceof InsufficientStockError) {
      sendError(response, 409, error.code, error.message);
      return;
    }

    sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'Unable to complete vehicle purchase.');
  }
}
