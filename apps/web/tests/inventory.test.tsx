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

function latestVehicleRequestUrl() {
  const [requestUrl] = fetchMock.mock.calls.at(-1) ?? [];

  return new URL(String(requestUrl), 'http://localhost');
}

describe('/inventory vehicle inventory page', () => {
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
    expect(screen.getByTestId('inventory-skeleton-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('inventory-skeleton-card')).toHaveLength(3);
  });

  it('renders vehicle make, model, price, and stock availability from the API response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles }));

    renderAtPath('/inventory');

    expect(await screen.findByText('Aurora Motors')).toBeInTheDocument();
    expect(screen.getByText('Roadster')).toBeInTheDocument();
    expect(screen.getByText(/42,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/3 available/i)).toBeInTheDocument();
  });

  it('links each vehicle card to its details page', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles }));
    const vehicle = vehicles.at(0);

    if (!vehicle) {
      throw new Error('The vehicle fixture is missing.');
    }

    renderAtPath('/inventory');

    const vehicleLink = await screen.findByRole('link', {
      name: /view details for aurora motors roadster/i,
    });

    expect(vehicleLink).toHaveAttribute('href', `/vehicles/${vehicle.id}`);
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

  it('resets active search and category filters to the full inventory', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [] }));

    renderAtPath('/inventory');

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.change(screen.getByRole('searchbox', { name: /search inventory/i }), {
      target: { value: 'roadster' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /category/i }), {
      target: { value: 'Coupe' },
    });

    await waitFor(() => expect(latestVehicleRequestUrl().search).toContain('category=Coupe'));
    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }));

    await waitFor(() => expect(latestVehicleRequestUrl().search).toBe(''));
    expect(screen.getByRole('searchbox', { name: /search inventory/i })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /category/i })).toHaveValue('');
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

  it('offers a retry action after an inventory request fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to list vehicles.' } },
          500,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ vehicles }));

    renderAtPath('/inventory');

    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Aurora Motors')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('provides a clear navigation path back to the home page', () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [] }));

    renderAtPath('/inventory');

    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });
});
