import { Prisma, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import type { Request, Response } from 'express';

import { prisma } from '../db/prisma.js';

const PASSWORD_MIN_LENGTH = 8;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 128;
const PASSWORD_HASH_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class RegistrationValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
}

function parseRegistrationInput(body: unknown) {
  if (typeof body !== 'object' || body === null) {
    throw new RegistrationValidationError('Name, email, and password are required.');
  }

  const input = body as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!name || !email || !password) {
    throw new RegistrationValidationError('Name, email, and password are required.');
  }

  if (name.length > MAX_NAME_LENGTH || email.length > MAX_EMAIL_LENGTH) {
    throw new RegistrationValidationError('Name or email is too long.');
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new RegistrationValidationError('Password is too long.');
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new RegistrationValidationError('Email must be a valid email address.');
  }

  const hasRequiredPasswordCharacters =
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password);

  if (!hasRequiredPasswordCharacters) {
    throw new RegistrationValidationError(
      'Password must be at least 8 characters and contain uppercase, lowercase, and numeric characters.',
    );
  }

  return { name, email, password };
}

function sendError(response: Response, status: number, code: string, message: string) {
  response.status(status).json({
    error: {
      code,
      message,
    },
  });
}

export async function registerUser(request: Request, response: Response) {
  try {
    const { name, email, password } = parseRegistrationInput(request.body);
    const passwordHash = await hash(password, PASSWORD_HASH_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: Role.USER,
      },
    });

    response.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof RegistrationValidationError) {
      sendError(response, 400, error.code, error.message);
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      sendError(
        response,
        409,
        'EMAIL_ALREADY_EXISTS',
        'An account with this email already exists.',
      );
      return;
    }

    sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'Unable to register user.');
  }
}
