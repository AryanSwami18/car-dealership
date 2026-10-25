import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { RequestHandler } from 'express';

type AuthenticatedUser = {
  id: string;
  role: string;
};

type AuthenticatedClaims = JwtPayload & {
  role: 'USER' | 'ADMIN';
  sub: string;
};

function sendUnauthorized(response: Parameters<RequestHandler>[1]) {
  response.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
    },
  });
}

function isAuthenticatedUser(value: JwtPayload): value is AuthenticatedClaims {
  return (
    typeof value.sub === 'string' &&
    value.sub.length > 0 &&
    (value.role === 'USER' || value.role === 'ADMIN')
  );
}

export const authenticateRequest: RequestHandler = (request, response, next) => {
  const authorization = request.get('Authorization')?.trim();
  const bearerMatch = authorization?.match(/^Bearer\s+(\S+)$/i);
  const token = bearerMatch?.[1];

  if (!token) {
    sendUnauthorized(response);
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    response.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Authentication service unavailable.',
      },
    });
    return;
  }

  try {
    const verified = jwt.verify(token, secret);

    if (typeof verified === 'string' || !isAuthenticatedUser(verified)) {
      sendUnauthorized(response);
      return;
    }

    const authenticatedUser: AuthenticatedUser = {
      id: verified.sub,
      role: verified.role,
    };

    response.locals.authenticatedUser = authenticatedUser;
    next();
  } catch {
    sendUnauthorized(response);
  }
};
