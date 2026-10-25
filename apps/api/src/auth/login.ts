import { compare, hashSync } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';

import { loadConfig } from '../config/env.js';
import { prisma } from '../db/prisma.js';

const TOKEN_LIFETIME_IN_SECONDS = 60 * 60;
const PASSWORD_HASH_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_PASSWORD_HASH = hashSync('not-a-real-password', PASSWORD_HASH_ROUNDS);
const config = loadConfig();

class LoginValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
}

function parseLoginInput(body: unknown) {
  if (typeof body !== 'object' || body === null) {
    throw new LoginValidationError('Email and password are required.');
  }

  const input = body as Record<string, unknown>;
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!email || !password) {
    throw new LoginValidationError('Email and password are required.');
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new LoginValidationError('Email must be valid.');
  }

  return { email, password };
}

function sendError(response: Response, status: number, code: string, message: string) {
  response.status(status).json({
    error: {
      code,
      message,
    },
  });
}

export async function loginUser(request: Request, response: Response) {
  try {
    const { email, password } = parseLoginInput(request.body);
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = await compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches) {
      sendError(response, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      return;
    }

    const token = jwt.sign({ role: user.role }, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: TOKEN_LIFETIME_IN_SECONDS,
      subject: user.id,
    });

    response.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof LoginValidationError) {
      sendError(response, 400, error.code, error.message);
      return;
    }

    sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'Unable to log in.');
  }
}
