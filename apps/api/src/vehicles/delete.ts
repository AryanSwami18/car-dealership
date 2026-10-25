import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { prisma } from '../db/prisma.js';
import { VehicleValidationError } from './create.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendError(response: Response, status: number, code: string, message: string) {
  response.status(status).json({
    error: {
      code,
      message,
    },
  });
}

function isPurchaseHistoryConstraintError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2003' || error.code === 'P2014';
  }

  return (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    error.message.includes('violates RESTRICT setting of foreign key constraint')
  );
}

export async function deleteVehicle(request: Request, response: Response) {
  try {
    const vehicleId = request.params.id;

    if (typeof vehicleId !== 'string' || !UUID_PATTERN.test(vehicleId)) {
      throw new VehicleValidationError('Vehicle ID must be a valid UUID.');
    }

    await prisma.vehicle.delete({
      where: { id: vehicleId },
    });

    response.status(204).send();
  } catch (error) {
    if (error instanceof VehicleValidationError) {
      sendError(response, 400, error.code, error.message);
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      sendError(response, 404, 'NOT_FOUND', 'Vehicle not found.');
      return;
    }

    if (isPurchaseHistoryConstraintError(error)) {
      sendError(
        response,
        409,
        'VEHICLE_HAS_PURCHASE_HISTORY',
        'Vehicle cannot be deleted because it has purchase history.',
      );
      return;
    }

    sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'Unable to delete vehicle.');
  }
}
