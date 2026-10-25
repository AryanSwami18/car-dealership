import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../src/AppShell';

/*
 * Inventory page contract for this RED phase:
 * - AppShell renders the inventory experience at /inventory.
 * - The browser fetch boundary requests /api/vehicles.
 * - The API response remains { vehicles: [...] }.
 * - search and category are optional query parameters, matching the backend.
 */

const vehicles = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    make: 'Aurora Motors',
    model: 'Roadster',
    category: 'Coupe',
    price: '42000.00',
    quantityInStock: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

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

function latestVehicleRequestUrl() {
  const [requestUrl] = fetchMock.mock.calls.at(-1) ?? [];

  return new URL(String(requestUrl), 'http://localhost');
}

describe('/inventory vehicle inventory page', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('renders an inventory heading and accessible inventory content at /inventory', () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [] }));

    renderAtPath('/inventory');

    expect(screen.getByRole('heading', { level: 1, name: /inventory/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /inventory results/i })).toBeInTheDocument();
  });

  it('shows a loading state while inventory data is being fetched', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    renderAtPath('/inventory');

    expect(screen.getByRole('status', { name: /loading inventory/i })).toBeInTheDocument();
  });

  it('renders vehicle make, model, price, and stock availability from the API response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles }));

    renderAtPath('/inventory');

    expect(await screen.findByText('Aurora Motors')).toBeInTheDocument();
    expect(screen.getByText('Roadster')).toBeInTheDocument();
    expect(screen.getByText(/42,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/3 available/i)).toBeInTheDocument();
  });

  it('provides accessible search and category filter controls', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [] }));

    renderAtPath('/inventory');

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.getByRole('searchbox', { name: /search inventory/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument();
  });

  it('requests backend search and category filters when the controls change', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [] }));

    renderAtPath('/inventory');

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(latestVehicleRequestUrl().pathname).toBe('/api/vehicles');
    fetchMock.mockClear();

    fireEvent.change(screen.getByRole('searchbox', { name: /search inventory/i }), {
      target: { value: 'roadster' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(latestVehicleRequestUrl().searchParams.get('search')).toBe('roadster');

    fetchMock.mockClear();
    fireEvent.change(screen.getByRole('combobox', { name: /category/i }), {
      target: { value: 'Coupe' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(latestVehicleRequestUrl().searchParams.get('category')).toBe('Coupe');
  });

  it('shows a useful empty state when no vehicles are returned', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [] }));

    renderAtPath('/inventory');

    expect(await screen.findByText(/no vehicles found/i)).toBeInTheDocument();
  });

  it('shows a safe error state when the inventory request fails', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to list vehicles.' } },
        500,
      ),
    );

    renderAtPath('/inventory');

    const error = await screen.findByRole('alert');

    expect(error).toHaveTextContent(/unable to load inventory/i);
    expect(error).not.toHaveTextContent(/stack|prisma|database url/i);
  });

  it('provides a clear navigation path back to the home page', () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [] }));

    renderAtPath('/inventory');

    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });
});
