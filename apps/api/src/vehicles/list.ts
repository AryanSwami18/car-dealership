import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { prisma } from '../db/prisma.js';
import { serializeVehicle } from './create.js';

class VehicleListValidationError extends Error {
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

function parseOptionalFilter(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new VehicleListValidationError(`${fieldName} must be a single string value.`);
  }

  const normalizedValue = value.trim();
  return normalizedValue || undefined;
}

function parseVehicleFilters(query: unknown) {
  if (typeof query !== 'object' || query === null) {
    throw new VehicleListValidationError('Vehicle filters must be valid query parameters.');
  }

  const filters = query as Record<string, unknown>;

  return {
    search: parseOptionalFilter(filters.search, 'search'),
    category: parseOptionalFilter(filters.category, 'category'),
  };
}

export async function listVehicles(request: Request, response: Response) {
  try {
    const { search, category } = parseVehicleFilters(request.query);
    const where: Prisma.VehicleWhereInput = {};

    if (search) {
      where.OR = [
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    response.status(200).json({
      vehicles: vehicles.map(serializeVehicle),
    });
  } catch (error) {
    if (error instanceof VehicleListValidationError) {
      sendError(response, 400, error.code, error.message);
      return;
    }

    sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'Unable to list vehicles.');
  }
}
