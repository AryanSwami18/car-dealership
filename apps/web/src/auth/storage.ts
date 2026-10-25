import type { AuthSession, AuthUser } from './types';

export const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';
export const AUTH_USER_STORAGE_KEY = 'authUser';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const user = value as Record<string, unknown>;

  return (
    typeof user.id === 'string' &&
    typeof user.name === 'string' &&
    typeof user.email === 'string' &&
    (user.role === 'USER' || user.role === 'ADMIN')
  );
}

export function readAccessToken() {
  return getStorage()?.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? null;
}

export function readStoredSession(): AuthSession | null {
  const storage = getStorage();
  const token = storage?.getItem(ACCESS_TOKEN_STORAGE_KEY);

  if (!storage || !token) {
    return null;
  }

  let user: unknown;

  try {
    user = JSON.parse(storage.getItem(AUTH_USER_STORAGE_KEY) ?? 'null');
  } catch {
    user = null;
  }

  return {
    token,
    user: isAuthUser(user) ? user : null,
  };
}

export function writeSession(session: AuthSession) {
  const storage = getStorage();

  storage?.setItem(ACCESS_TOKEN_STORAGE_KEY, session.token);
  storage?.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user));
}

export function clearStoredSession() {
  const storage = getStorage();

  storage?.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  storage?.removeItem(AUTH_USER_STORAGE_KEY);
}
