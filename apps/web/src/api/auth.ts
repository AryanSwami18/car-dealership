import type { AuthUser } from '../auth/types';

type AuthErrorBody = {
  error?: {
    code?: unknown;
    message?: unknown;
  };
};

export type RegistrationInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export class AuthApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
  }
}

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
}

function safeErrorMessage(body: unknown, fallback: string) {
  if (typeof body !== 'object' || body === null) {
    return fallback;
  }

  const error = body as AuthErrorBody;
  const code = typeof error.error?.code === 'string' ? error.error.code : null;
  const message = typeof error.error?.message === 'string' ? error.error.message : null;
  const knownSafeCodes = new Set([
    'VALIDATION_ERROR',
    'EMAIL_ALREADY_EXISTS',
    'INVALID_CREDENTIALS',
  ]);

  return code && message && knownSafeCodes.has(code) ? message : fallback;
}

async function postAuthRequest<T>(path: string, payload: unknown, fallback: string) {
  const response = await window.fetch(`${getApiBaseUrl()}${path}`, {
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const error = body as AuthErrorBody;
    const code = typeof error?.error?.code === 'string' ? error.error.code : null;
    throw new AuthApiError(safeErrorMessage(body, fallback), response.status, code);
  }

  return body as T;
}

export async function registerUser(input: RegistrationInput) {
  const body = await postAuthRequest<{ user: AuthUser }>(
    '/auth/register',
    input,
    'Unable to create your account.',
  );

  return body.user;
}

export async function loginUser(input: LoginInput): Promise<LoginResponse> {
  const body = await postAuthRequest<LoginResponse>('/auth/login', input, 'Unable to sign in.');

  if (
    typeof body?.token !== 'string' ||
    typeof body.user !== 'object' ||
    body.user === null ||
    (body.user.role !== 'USER' && body.user.role !== 'ADMIN')
  ) {
    throw new AuthApiError('Unable to sign in.', 502, null);
  }

  return body;
}
