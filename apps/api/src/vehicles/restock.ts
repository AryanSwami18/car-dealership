import type { Request, Response } from 'express';

import { prisma } from '../db/prisma.js';
import { serializeVehicle } from './create.js';

const MAX_POSTGRES_INT = 2_147_483_647;

class RestockValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
}

class VehicleNotFoundError extends Error {
  readonly code = 'NOT_FOUND';
}

class StockLimitExceededError extends Error {
  readonly code = 'STOCK_LIMIT_EXCEEDED';
}

function sendError(response: Response, status: number, code: string, message: string) {
  response.status(status).json({
    error: {
      code,
      message,
    },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseQuantity(body: unknown) {
  if (typeof body !== 'object' || body === null) {
    throw new RestockValidationError('Quantity must be a positive integer.');
  }

  const quantity = (body as Record<string, unknown>).quantity;

  if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RestockValidationError('Quantity must be a positive integer.');
  }

  return quantity;
}

export async function restockVehicle(request: Request, response: Response) {
  try {
    const vehicleId = request.params.id;

    if (typeof vehicleId !== 'string' || !isUuid(vehicleId)) {
      throw new RestockValidationError('Vehicle ID must be a valid UUID.');
    }

    const quantity = parseQuantity(request.body);
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new VehicleNotFoundError('Vehicle not found.');
    }

    if (quantity > MAX_POSTGRES_INT - vehicle.quantityInStock) {
      throw new StockLimitExceededError('Vehicle stock limit exceeded.');
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        quantityInStock: {
          increment: quantity,
        },
      },
    });

    response.status(200).json({
      vehicle: serializeVehicle(updatedVehicle),
    });
  } catch (error) {
    if (error instanceof RestockValidationError) {
      sendError(response, 400, error.code, error.message);
      return;
    }

    if (error instanceof VehicleNotFoundError) {
      sendError(response, 404, error.code, error.message);
      return;
    }

    if (error instanceof StockLimitExceededError) {
      sendError(response, 409, error.code, error.message);
      return;
    }

    sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'Unable to restock vehicle.');
  }
}
