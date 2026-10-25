import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../src/AppShell';

const userPurchase = {
  id: 'purchase-1',
  userId: 'user-1',
  vehicleId: '11111111-1111-4111-8111-111111111111',
  quantity: 2,
  unitPrice: '18000.50',
  purchasedAt: '2026-01-03T00:00:00.000Z',
  vehicle: {
    id: '11111111-1111-4111-8111-111111111111',
    make: 'Aurora Motors',
    model: 'Roadster',
    category: 'Coupe',
    price: '18500.75',
    quantityInStock: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-04T00:00:00.000Z',
  },
};

const adminPurchase = {
  ...userPurchase,
  id: 'purchase-2',
  userId: 'user-2',
  vehicleId: '22222222-2222-4222-8222-222222222222',
  quantity: 1,
  unitPrice: '32000.00',
  purchasedAt: '2026-02-05T00:00:00.000Z',
  vehicle: {
    ...userPurchase.vehicle,
    id: '22222222-2222-4222-8222-222222222222',
    make: 'Northstar Automotive',
    model: 'Touring 4',
    category: 'Sedan',
    price: '32500.00',
  },
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

function setSession(role: 'USER' | 'ADMIN' = 'USER') {
  window.localStorage.setItem('accessToken', `${role.toLowerCase()}-token`);
  window.localStorage.setItem(
    'authUser',
    JSON.stringify({
      id: role === 'ADMIN' ? 'admin-1' : 'user-1',
      name: role === 'ADMIN' ? 'Admin User' : 'Member User',
      email: `${role.toLowerCase()}@example.test`,
      role,
    }),
  );
}

describe('/purchases purchase history page', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    originalWindowFetch = window.fetch;
    vi.stubGlobal('fetch', fetchMock);
    window.fetch = fetchMock as unknown as typeof window.fetch;
    setSession();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    window.fetch = originalWindowFetch;
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('protects the purchase history route for unauthenticated visitors', () => {
    window.localStorage.clear();

    renderAtPath('/purchases');

    expect(screen.getByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an accessible loading state while purchase history is fetched', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    renderAtPath('/purchases');

    expect(screen.getByRole('status', { name: /loading purchase history/i })).toBeInTheDocument();
  });

  it('renders a USER purchase history using the existing API response and JWT convention', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ purchases: [userPurchase] }));

    renderAtPath('/purchases');

    expect(
      await screen.findByRole('heading', { level: 1, name: /purchase history/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /aurora motors roadster/i })).toBeInTheDocument();
    expect(screen.getByText(/2 vehicles/i)).toBeInTheDocument();
    expect(screen.getByText('$18,000.50')).toBeInTheDocument();
    expect(screen.getByText('$36,001.00')).toBeInTheDocument();
    expect(screen.getByText(/Jan 3, 2026/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view aurora motors roadster/i })).toHaveAttribute(
      'href',
      `/vehicles/${userPurchase.vehicleId}`,
    );
    expect(screen.getByRole('link', { name: /back to inventory/i })).toHaveAttribute(
      'href',
      '/inventory',
    );

    expect(fetchMock).toHaveBeenCalledWith('/api/purchases', {
      headers: { Authorization: 'Bearer user-token' },
    });
    expect(screen.queryByText(/passwordHash|jwt|token|database url/i)).not.toBeInTheDocument();
  });

  it('renders all purchases returned for an authenticated ADMIN without client-side filtering', async () => {
    setSession('ADMIN');
    fetchMock.mockResolvedValue(jsonResponse({ purchases: [adminPurchase, userPurchase] }));

    renderAtPath('/purchases');

    expect(
      await screen.findByRole('heading', { level: 1, name: /all purchase history/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /northstar automotive touring 4/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /aurora motors roadster/i })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/purchases');
  });

  it('shows a useful empty state and inventory navigation when there are no purchases', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ purchases: [] }));

    renderAtPath('/purchases');

    expect(await screen.findByText(/no purchases yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return to inventory/i })).toHaveAttribute(
      'href',
      '/inventory',
    );
  });

  it('shows a safe error when the purchase history request fails', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unable to retrieve purchase history.',
            stack: 'private stack',
          },
        },
        500,
      ),
    );

    renderAtPath('/purchases');

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/unable to load purchase history/i);
    expect(error).not.toHaveTextContent(/private stack|prisma|database url/i);
  });

  it('clears an expired session and sends the user to login after a 401 response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, 401),
    );

    renderAtPath('/purchases');

    expect(
      await screen.findByRole('heading', { name: /sign in to the road/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/session has expired/i);
    expect(window.localStorage.getItem('accessToken')).toBeNull();
  });
});
