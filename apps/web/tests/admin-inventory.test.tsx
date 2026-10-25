import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const secondVehicle = {
  ...vehicle,
  id: '22222222-2222-4222-8222-222222222222',
  make: 'Northstar Automotive',
  model: 'Touring 4',
  category: 'Sedan',
  price: '32500.00',
  quantityInStock: 0,
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

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => undefined,
  } as Response;
}

function renderAtPath(path: string) {
  window.history.pushState({}, '', path);
  return render(<AppShell />);
}

function setSession(role: 'USER' | 'ADMIN') {
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

function expectAuthenticatedRequest(index: number, method?: string) {
  const [, requestOptions] = fetchMock.mock.calls[index] as [string, RequestInit];

  expect(requestOptions).toEqual(
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
    }),
  );

  if (method) {
    expect(requestOptions.method).toBe(method);
  }

  return requestOptions;
}

describe('/admin/inventory admin vehicle management', () => {
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

  it('protects the admin inventory route from unauthenticated visitors', () => {
    renderAtPath('/admin/inventory');

    expect(screen.getByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects authenticated USER accounts before loading admin data', () => {
    setSession('USER');

    renderAtPath('/admin/inventory');

    expect(screen.getByRole('heading', { name: /admin access required/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets an ADMIN view inventory totals and vehicle details', async () => {
    setSession('ADMIN');
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [vehicle, secondVehicle] }));

    renderAtPath('/admin/inventory');

    expect(
      await screen.findByRole('heading', { level: 1, name: /admin inventory/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 vehicle records/i)).toBeInTheDocument();
    expect(screen.getByText(/3 total in stock/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view aurora motors roadster/i })).toHaveAttribute(
      'href',
      `/vehicles/${vehicle.id}`,
    );
    expect(
      screen.getByRole('link', { name: /view northstar automotive touring 4/i }),
    ).toHaveAttribute('href', `/vehicles/${secondVehicle.id}`);
    expectAuthenticatedRequest(0);
  });

  it('shows an accessible loading state while admin inventory is fetched', () => {
    setSession('ADMIN');
    fetchMock.mockReturnValue(new Promise(() => {}));

    renderAtPath('/admin/inventory');

    expect(screen.getByRole('status', { name: /loading admin inventory/i })).toBeInTheDocument();
  });

  it('creates a vehicle with the backend request shape and refreshes the list', async () => {
    setSession('ADMIN');
    const createdVehicle = { ...vehicle, quantityInStock: 4 };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ vehicles: [] }))
      .mockResolvedValueOnce(jsonResponse({ vehicle: createdVehicle }, 201))
      .mockResolvedValueOnce(jsonResponse({ vehicles: [createdVehicle] }));

    renderAtPath('/admin/inventory');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/^make$/i), { target: { value: vehicle.make } });
    fireEvent.change(screen.getByLabelText(/^model$/i), { target: { value: vehicle.model } });
    fireEvent.change(screen.getByLabelText(/^category$/i), {
      target: { value: vehicle.category },
    });
    fireEvent.change(screen.getByLabelText(/^price$/i), { target: { value: '42000' } });
    fireEvent.change(screen.getByLabelText(/initial stock/i), { target: { value: '4' } });
    fireEvent.submit(screen.getByRole('form', { name: /create vehicle/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const requestOptions = expectAuthenticatedRequest(1, 'POST');
    expect(requestOptions.headers).toEqual(
      expect.objectContaining({ 'Content-Type': 'application/json' }),
    );
    expect(JSON.parse(String(requestOptions.body))).toEqual({
      make: 'Aurora Motors',
      model: 'Roadster',
      category: 'Coupe',
      price: 42000,
      quantityInStock: 4,
    });
    expect(await screen.findByText(/vehicle created/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view aurora motors roadster/i })).toBeInTheDocument();
  });

  it('blocks invalid create values before making an API mutation request', async () => {
    setSession('ADMIN');
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [] }));

    renderAtPath('/admin/inventory');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/^make$/i), { target: { value: 'Aurora Motors' } });
    fireEvent.change(screen.getByLabelText(/^model$/i), { target: { value: 'Roadster' } });
    fireEvent.change(screen.getByLabelText(/^category$/i), { target: { value: 'Coupe' } });
    fireEvent.change(screen.getByLabelText(/^price$/i), { target: { value: '-1' } });
    fireEvent.change(screen.getByLabelText(/initial stock/i), { target: { value: '-2' } });
    fireEvent.submit(screen.getByRole('form', { name: /create vehicle/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /price.*non-negative|stock.*non-negative/i,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('edits a vehicle with a full replacement payload and refreshes the list', async () => {
    setSession('ADMIN');
    const updatedVehicle = { ...vehicle, price: '43000.00', quantityInStock: 5 };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ vehicles: [vehicle] }))
      .mockResolvedValueOnce(jsonResponse({ vehicle: updatedVehicle }))
      .mockResolvedValueOnce(jsonResponse({ vehicles: [updatedVehicle] }));

    renderAtPath('/admin/inventory');
    fireEvent.click(await screen.findByRole('button', { name: /edit aurora motors roadster/i }));

    const editForm = screen.getByRole('form', { name: /edit vehicle/i });
    fireEvent.change(within(editForm).getByLabelText(/^price$/i), {
      target: { value: '43000' },
    });
    fireEvent.change(within(editForm).getByLabelText(/stock quantity/i), {
      target: { value: '5' },
    });
    fireEvent.submit(editForm);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const requestOptions = expectAuthenticatedRequest(1, 'PUT');
    expect(JSON.parse(String(requestOptions.body))).toEqual({
      make: 'Aurora Motors',
      model: 'Roadster',
      category: 'Coupe',
      price: 43000,
      quantityInStock: 5,
    });
    expect(await screen.findByText(/vehicle updated/i)).toBeInTheDocument();
    expect(screen.getByText('$43,000.00')).toBeInTheDocument();
  });

  it('requires delete confirmation and refreshes after a successful deletion', async () => {
    setSession('ADMIN');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ vehicles: [vehicle] }))
      .mockResolvedValueOnce(emptyResponse())
      .mockResolvedValueOnce(jsonResponse({ vehicles: [] }));

    renderAtPath('/admin/inventory');
    fireEvent.click(await screen.findByRole('button', { name: /delete aurora motors roadster/i }));

    const dialog = screen.getByRole('dialog', { name: /delete vehicle/i });
    expect(dialog).toHaveTextContent(/cannot be undone/i);
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /delete aurora motors roadster/i }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /delete vehicle/i })).getByRole('button', {
        name: /confirm deletion/i,
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expectAuthenticatedRequest(1, 'DELETE');
    expect(await screen.findByText(/vehicle deleted/i)).toBeInTheDocument();
    expect(screen.getByText(/no vehicles in inventory/i)).toBeInTheDocument();
  });

  it('restocks with a positive integer and refreshes stock information', async () => {
    setSession('ADMIN');
    const restockedVehicle = { ...vehicle, quantityInStock: 7 };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ vehicles: [vehicle] }))
      .mockResolvedValueOnce(jsonResponse({ vehicle: restockedVehicle }))
      .mockResolvedValueOnce(jsonResponse({ vehicles: [restockedVehicle] }));

    renderAtPath('/admin/inventory');
    fireEvent.click(await screen.findByRole('button', { name: /restock aurora motors roadster/i }));

    const dialog = screen.getByRole('dialog', { name: /restock vehicle/i });
    fireEvent.change(within(dialog).getByLabelText(/quantity to restock/i), {
      target: { value: '4' },
    });
    fireEvent.submit(within(dialog).getByRole('form', { name: /restock vehicle/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const requestOptions = expectAuthenticatedRequest(1, 'POST');
    expect(JSON.parse(String(requestOptions.body))).toEqual({ quantity: 4 });
    expect(await screen.findByText(/vehicle restocked/i)).toBeInTheDocument();
    expect(screen.getByText(/7 in stock/i)).toBeInTheDocument();
  });

  it('rejects an invalid restock quantity without making a mutation request', async () => {
    setSession('ADMIN');
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [vehicle] }));

    renderAtPath('/admin/inventory');
    fireEvent.click(await screen.findByRole('button', { name: /restock aurora motors roadster/i }));

    const dialog = screen.getByRole('dialog', { name: /restock vehicle/i });
    fireEvent.change(within(dialog).getByLabelText(/quantity to restock/i), {
      target: { value: '1.5' },
    });
    fireEvent.submit(within(dialog).getByRole('form', { name: /restock vehicle/i }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/positive integer/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows a safe permission error when the backend rejects an admin request', async () => {
    setSession('ADMIN');
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this resource.',
            stack: 'private stack',
          },
        },
        403,
      ),
    );

    renderAtPath('/admin/inventory');

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/do not have permission/i);
    expect(error).not.toHaveTextContent(/private stack|prisma|database url/i);
  });

  it('keeps the delete confirmation open when purchase history blocks deletion', async () => {
    setSession('ADMIN');
    fetchMock.mockResolvedValueOnce(jsonResponse({ vehicles: [vehicle] })).mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'VEHICLE_HAS_PURCHASE_HISTORY',
            message: 'Vehicle cannot be deleted because it has purchase history.',
          },
        },
        409,
      ),
    );

    renderAtPath('/admin/inventory');
    fireEvent.click(await screen.findByRole('button', { name: /delete aurora motors roadster/i }));
    const dialog = screen.getByRole('dialog', { name: /delete vehicle/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /confirm deletion/i }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/purchase history/i);
    expect(screen.getByRole('dialog', { name: /delete vehicle/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows safe API failures without exposing internal details', async () => {
    setSession('ADMIN');
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unable to list vehicles.',
            stack: 'private stack',
          },
        },
        500,
      ),
    );

    renderAtPath('/admin/inventory');

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/unable to load admin inventory/i);
    expect(error).not.toHaveTextContent(/private stack|prisma|database url/i);
  });

  it('clears an expired admin session and redirects to login', async () => {
    setSession('ADMIN');
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, 401),
    );

    renderAtPath('/admin/inventory');

    expect(
      await screen.findByRole('heading', { name: /sign in to the road/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/session has expired/i);
    expect(window.localStorage.getItem('accessToken')).toBeNull();
  });
});
