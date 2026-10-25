import type { RequestHandler, Response } from 'express';

const ALLOWED_METHODS = 'GET,HEAD,POST,PUT,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Authorization, Content-Type';

function sendForbidden(response: Response) {
  response.status(403).json({
    error: {
      code: 'FORBIDDEN',
      message: 'Origin is not allowed.',
    },
  });
}

export function createCorsMiddleware(allowedOrigins: string[]): RequestHandler {
  return (request, response, next) => {
    const origin = request.get('Origin');

    if (!origin) {
      next();
      return;
    }

    if (!allowedOrigins.includes(origin)) {
      sendForbidden(response);
      return;
    }

    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    response.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    response.setHeader('Vary', 'Origin');

    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }

    next();
  };
}
