import type { RequestHandler, Response } from 'express';

type AuthenticatedUser = {
  id: string;
  role: 'USER' | 'ADMIN';
};

function sendUnauthorized(response: Response) {
  response.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
    },
  });
}

function sendForbidden(response: Response) {
  response.status(403).json({
    error: {
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource.',
    },
  });
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    (user.role === 'USER' || user.role === 'ADMIN')
  );
}

export function authorizeRoles(...allowedRoles: string[]): RequestHandler {
  return (_request, response, next) => {
    const authenticatedUser = response.locals.authenticatedUser;

    if (!isAuthenticatedUser(authenticatedUser)) {
      sendUnauthorized(response);
      return;
    }

    if (!allowedRoles.includes(authenticatedUser.role)) {
      sendForbidden(response);
      return;
    }

    next();
  };
}
