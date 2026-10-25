import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { prisma } from '../db/prisma.js';
import { parseVehicleInput, serializeVehicle, VehicleValidationError } from './create.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendError(response: Response, status: number, code: string, message: string) {
  response.status(status).json({
    error: {
      code,
      message,
    },
  });
}

export async function updateVehicle(request: Request, response: Response) {
  try {
    const vehicleId = request.params.id;

    if (typeof vehicleId !== 'string' || !UUID_PATTERN.test(vehicleId)) {
      throw new VehicleValidationError('Vehicle ID must be a valid UUID.');
    }

    const data = parseVehicleInput(request.body);
    const vehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data,
    });

    response.status(200).json({
      vehicle: serializeVehicle(vehicle),
    });
  } catch (error) {
    if (error instanceof VehicleValidationError) {
      sendError(response, 400, error.code, error.message);
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      sendError(response, 404, 'NOT_FOUND', 'Vehicle not found.');
      return;
    }

    sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'Unable to update vehicle.');
  }
}
