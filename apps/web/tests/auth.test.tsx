import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../src/AppShell';

const registeredUser = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  role: 'USER',
};

const adminUser = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Grace Hopper',
  email: 'grace@example.test',
  role: 'ADMIN',
};

let fetchMock: ReturnType<typeof vi.fn>;
let originalWindowFetch: typeof window.fetch;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function renderAtPath(path: string) {
  window.history.pushState({}, '', path);
  return render(<AppShell />);
}

function fillRegistrationForm() {
  fireEvent.change(screen.getByLabelText(/name/i), {
    target: { value: registeredUser.name },
  });
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: registeredUser.email },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'SecurePass1' },
  });
}

function fillLoginForm() {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: registeredUser.email },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'SecurePass1' },
  });
}

describe('frontend authentication', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    originalWindowFetch = window.fetch;
    vi.stubGlobal('fetch', fetchMock);
    window.fetch = fetchMock as unknown as typeof window.fetch;
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    window.fetch = originalWindowFetch;
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('renders an accessible registration form', () => {
    renderAtPath('/register');

    expect(screen.getByRole('heading', { level: 1, name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: /registration/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('submits registration fields to the existing registration contract', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: registeredUser }, 201));

    renderAtPath('/register');
    fillRegistrationForm();
    fireEvent.submit(screen.getByRole('form', { name: /registration/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [requestUrl, requestOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe('/api/auth/register');
    expect(requestOptions.method).toBe('POST');
    expect(JSON.parse(String(requestOptions.body))).toEqual({
      name: registeredUser.name,
      email: registeredUser.email,
      password: 'SecurePass1',
    });
    expect(await screen.findByRole('heading', { level: 1, name: /sign in/i })).toBeInTheDocument();
  });

  it('shows safe client validation for an insufficient password', async () => {
    renderAtPath('/register');
    fillRegistrationForm();
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'weakpass' },
    });
    fireEvent.submit(screen.getByRole('form', { name: /registration/i }));

    const error = await screen.findByRole('alert');

    expect(error).toHaveTextContent(/at least 8 characters.*uppercase.*numeric/i);
    expect(error).not.toHaveTextContent(/stack|prisma|database url/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the backend duplicate-email error without exposing internals', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email already exists.',
          },
        },
        409,
      ),
    );

    renderAtPath('/register');
    fillRegistrationForm();
    fireEvent.submit(screen.getByRole('form', { name: /registration/i }));

    const error = await screen.findByRole('alert');

    expect(error).toHaveTextContent(/account with this email already exists/i);
    expect(error).not.toHaveTextContent(/stack|prisma|database url/i);
  });

  it('renders an accessible login form', () => {
    renderAtPath('/login');

    expect(screen.getByRole('heading', { level: 1, name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('submits login credentials and handles invalid credentials safely', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        },
        401,
      ),
    );

    renderAtPath('/login');
    fillLoginForm();
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [requestUrl, requestOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe('/api/auth/login');
    expect(requestOptions.method).toBe('POST');
    expect(JSON.parse(String(requestOptions.body))).toEqual({
      email: registeredUser.email,
      password: 'SecurePass1',
    });

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/invalid email or password/i);
    expect(error).not.toHaveTextContent(/stack|prisma|database url/i);
  });

  it('stores the JWT and safe user metadata after login, then opens inventory', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'signed-jwt', user: registeredUser }))
      .mockResolvedValue(jsonResponse({ vehicles: [] }));

    renderAtPath('/login');
    fillLoginForm();
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));

    expect(
      await screen.findByRole('heading', { level: 1, name: /inventory/i }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem('accessToken')).toBe('signed-jwt');
    expect(JSON.parse(window.localStorage.getItem('authUser') ?? '')).toEqual(registeredUser);
    expect(window.localStorage.getItem('password')).toBeNull();
    expect(window.localStorage.getItem('passwordHash')).toBeNull();
  });

  it('disables the login action while credentials are being submitted', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    renderAtPath('/login');
    fillLoginForm();
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  it('protects inventory routes when no authenticated session exists', () => {
    renderAtPath('/inventory');

    expect(
      screen.getByRole('heading', { level: 1, name: /sign in to continue/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to login/i })).toHaveAttribute('href', '/login');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps role-aware session state, distinguishes admins, and supports logout', async () => {
    window.localStorage.setItem('accessToken', 'admin-jwt');
    window.localStorage.setItem('authUser', JSON.stringify(adminUser));
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [] }));

    renderAtPath('/inventory');

    expect(await screen.findByText(/admin account/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    expect(window.localStorage.getItem('accessToken')).toBeNull();
    expect(window.localStorage.getItem('authUser')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: /sign in to continue/i }),
    ).toBeInTheDocument();
  });
});
