import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { prisma } from '../db/prisma.js';

export class VehicleValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
}

function sendError(response: Response, status: number, code: string, message: string) {
  response.status(status).json({
    error: {
      code,
      message,
    },
  });
}

export function parseVehicleInput(body: unknown) {
  if (typeof body !== 'object' || body === null) {
    throw new VehicleValidationError(
      'Make, model, category, price, and quantityInStock are required.',
    );
  }

  const input = body as Record<string, unknown>;
  const make = typeof input.make === 'string' ? input.make.trim() : '';
  const model = typeof input.model === 'string' ? input.model.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';

  if (!make || !model || !category) {
    throw new VehicleValidationError('Make, model, and category are required.');
  }

  if (input.price === undefined || input.price === null || input.price === '') {
    throw new VehicleValidationError('Price is required.');
  }

  let price: Prisma.Decimal;
  try {
    price = new Prisma.Decimal(input.price as Prisma.Decimal.Value);
  } catch {
    throw new VehicleValidationError('Price must be a non-negative number.');
  }

  if (!price.isFinite() || price.isNegative()) {
    throw new VehicleValidationError('Price must be a non-negative number.');
  }

  if (input.quantityInStock === undefined || input.quantityInStock === null) {
    throw new VehicleValidationError('quantityInStock is required.');
  }

  if (
    typeof input.quantityInStock !== 'number' ||
    !Number.isInteger(input.quantityInStock) ||
    input.quantityInStock < 0
  ) {
    throw new VehicleValidationError('quantityInStock must be a non-negative integer.');
  }

  return {
    make,
    model,
    category,
    price,
    quantityInStock: input.quantityInStock,
  };
}

export function serializeVehicle(vehicle: {
  id: string;
  make: string;
  model: string;
  category: string;
  price: Prisma.Decimal;
  quantityInStock: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    category: vehicle.category,
    price: vehicle.price.toFixed(2),
    quantityInStock: vehicle.quantityInStock,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

export async function createVehicle(request: Request, response: Response) {
  try {
    const data = parseVehicleInput(request.body);
    const vehicle = await prisma.vehicle.create({ data });

    response.status(201).json({
      vehicle: serializeVehicle(vehicle),
    });
  } catch (error) {
    if (error instanceof VehicleValidationError) {
      sendError(response, 400, error.code, error.message);
      return;
    }

    sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'Unable to create vehicle.');
  }
}
