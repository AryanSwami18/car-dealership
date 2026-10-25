export type AuthRole = 'USER' | 'ADMIN';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
};

export type AuthSession = {
  token: string;
  user: AuthUser | null;
};
