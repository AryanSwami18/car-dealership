import express from 'express';

import { loginUser } from './auth/login.js';
import { registerUser } from './auth/register.js';
import { authenticateRequest } from './auth/authenticate.js';
import { authorizeRoles } from './auth/authorize.js';
import { loadConfig } from './config/env.js';
import { createCorsMiddleware } from './http/cors.js';
import { requestLogger } from './http/logging.js';
import { listPurchaseHistory } from './purchases/history.js';
import { createVehicle } from './vehicles/create.js';
import { deleteVehicle } from './vehicles/delete.js';
import { listVehicles } from './vehicles/list.js';
import { purchaseVehicle } from './vehicles/purchase.js';
import { restockVehicle } from './vehicles/restock.js';
import { updateVehicle } from './vehicles/update.js';

export const app = express();
const config = loadConfig();

app.use(requestLogger);
app.use(createCorsMiddleware(config.corsOrigins));
app.use(express.json({ limit: config.bodySizeLimit }));
app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});
app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);
app.get('/api/purchases', authenticateRequest, listPurchaseHistory);
app.post('/api/vehicles', authenticateRequest, authorizeRoles('ADMIN'), createVehicle);
app.get('/api/vehicles', authenticateRequest, listVehicles);
app.put('/api/vehicles/:id', authenticateRequest, authorizeRoles('ADMIN'), updateVehicle);
app.delete('/api/vehicles/:id', authenticateRequest, authorizeRoles('ADMIN'), deleteVehicle);
app.post('/api/vehicles/:id/purchase', authenticateRequest, purchaseVehicle);
app.post('/api/vehicles/:id/restock', authenticateRequest, authorizeRoles('ADMIN'), restockVehicle);

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (
      error instanceof SyntaxError &&
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'entity.parse.failed'
    ) {
      response.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON.',
        },
      });
      return;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      response.status(413).json({
        error: {
          code: 'REQUEST_ENTITY_TOO_LARGE',
          message: 'Request body is too large.',
        },
      });
      return;
    }

    if (config.nodeEnv !== 'test') {
      console.error(
        JSON.stringify({
          event: 'http_error',
          method: _request.method,
          path: _request.path,
          status: 500,
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
    }

    response.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error.',
      },
    });
  },
);
