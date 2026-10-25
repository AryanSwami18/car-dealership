import type { Request, Response } from 'express';

import { prisma } from '../db/prisma.js';
import { serializeVehicle } from './create.js';

export async function listVehicles(_request: Request, response: Response) {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    response.status(200).json({
      vehicles: vehicles.map(serializeVehicle),
    });
  } catch {
    response.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unable to list vehicles.',
      },
    });
  }
}
