import type { RequestHandler } from 'express';

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = Date.now();

  response.on('finish', () => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const entry = JSON.stringify({
      event: 'http_request',
      method: request.method,
      path: request.path,
      status: response.statusCode,
      durationMs: Date.now() - startedAt,
    });

    if (response.statusCode >= 500) {
      console.error(entry);
    } else {
      console.info(entry);
    }
  });

  next();
};
