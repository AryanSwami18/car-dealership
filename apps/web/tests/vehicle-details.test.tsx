import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../src/AppShell';

const vehicle = {
  id: '11111111-1111-4111-8111-111111111111',
  make: 'Aurora Motors',
  model: 'Roadster',
  category: 'Coupe',
  price: '42000.00',
  quantityInStock: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
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

describe('vehicle details page', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    originalWindowFetch = window.fetch;
    vi.stubGlobal('fetch', fetchMock);
    window.fetch = fetchMock as unknown as typeof window.fetch;
    window.localStorage.setItem('accessToken', 'test-token');
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    window.fetch = originalWindowFetch;
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('shows an accessible loading state while vehicle details are fetched', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    renderAtPath(`/vehicles/${vehicle.id}`);

    expect(screen.getByRole('status', { name: /loading vehicle details/i })).toBeInTheDocument();
  });

  it('renders public vehicle details from the existing vehicles response contract', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [vehicle] }));

    renderAtPath(`/vehicles/${vehicle.id}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: /aurora motors roadster/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Coupe \/ Maison selection/i)).toBeInTheDocument();
    expect(screen.getByText(/42,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/3 available/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to inventory/i })).toHaveAttribute(
      'href',
      '/inventory',
    );
    expect(screen.queryByText(/createdAt|updatedAt|passwordHash/i)).not.toBeInTheDocument();
  });

  it('shows an accessible not-found state when the vehicle is absent from inventory', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [] }));

    renderAtPath(`/vehicles/${vehicle.id}`);

    expect(await screen.findByRole('status', { name: /vehicle not found/i })).toBeInTheDocument();
    expect(screen.getByText(/vehicle not found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to inventory/i })).toHaveAttribute(
      'href',
      '/inventory',
    );
  });

  it('shows a safe API-error state when the vehicle request fails', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to list vehicles.' } },
        500,
      ),
    );

    renderAtPath(`/vehicles/${vehicle.id}`);

    const error = await screen.findByRole('alert');

    expect(error).toHaveTextContent(/unable to load vehicle details/i);
    expect(error).not.toHaveTextContent(/stack|prisma|database url/i);
  });
});
