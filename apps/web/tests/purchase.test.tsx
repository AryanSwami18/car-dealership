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

function getPurchaseCalls() {
  return fetchMock.mock.calls.filter(
    ([, options]) => (options as RequestInit | undefined)?.method === 'POST',
  );
}

describe('vehicle purchase flow', () => {
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

  it('starts with quantity one and allows only an available positive quantity', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [vehicle] }));

    renderAtPath(`/vehicles/${vehicle.id}`);

    const quantity = await screen.findByRole('spinbutton', { name: /purchase quantity/i });
    expect(quantity).toHaveValue(1);
    expect(quantity).toHaveAttribute('min', '1');
    expect(quantity).toHaveAttribute('max', '3');
    expect(screen.getByRole('button', { name: /purchase vehicle/i })).toBeEnabled();

    fireEvent.change(quantity, { target: { value: '2' } });
    expect(quantity).toHaveValue(2);
  });

  it('offers accessible quantity stepper controls bounded by available stock', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [vehicle] }));

    renderAtPath(`/vehicles/${vehicle.id}`);

    const quantity = await screen.findByRole('spinbutton', { name: /purchase quantity/i });
    const increase = screen.getByRole('button', { name: /increase purchase quantity/i });
    const decrease = screen.getByRole('button', { name: /decrease purchase quantity/i });

    expect(decrease).toBeDisabled();
    fireEvent.click(increase);
    expect(quantity).toHaveValue(2);
    fireEvent.click(increase);
    expect(quantity).toHaveValue(3);
    expect(increase).toBeDisabled();

    fireEvent.click(decrease);
    expect(quantity).toHaveValue(2);
  });

  it('disables purchasing when the vehicle is out of stock', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [{ ...vehicle, quantityInStock: 0 }] }));

    renderAtPath(`/vehicles/${vehicle.id}`);

    expect(await screen.findByText('Sold out', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /purchase vehicle/i })).toBeDisabled();
  });

  it.each([
    ['zero', '0'],
    ['fractional', '1.5'],
    ['above available stock', '4'],
  ])('rejects a %s purchase quantity without making a request', async (_description, value) => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [vehicle] }));

    renderAtPath(`/vehicles/${vehicle.id}`);

    const quantity = await screen.findByRole('spinbutton', { name: /purchase quantity/i });
    fireEvent.change(quantity, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: /purchase vehicle/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/whole-number quantity/i);
    expect(getPurchaseCalls()).toHaveLength(0);
  });

  it('opens an accessible confirmation dialog and supports cancellation', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vehicles: [vehicle] }));

    renderAtPath(`/vehicles/${vehicle.id}`);

    const quantity = await screen.findByRole('spinbutton', { name: /purchase quantity/i });
    fireEvent.change(quantity, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /purchase vehicle/i }));

    const dialog = await screen.findByRole('dialog', { name: /confirm purchase/i });
    expect(dialog).toHaveTextContent('Aurora Motors Roadster');
    expect(dialog).toHaveTextContent(/quantity\s*2/i);
    expect(dialog).toHaveTextContent(/unit price\s*\$42,000\.00/i);
    expect(dialog).toHaveTextContent(/total\s*\$84,000\.00/i);

    fireEvent.click(within(dialog).getByRole('button', { name: /cancel purchase/i }));

    expect(screen.queryByRole('dialog', { name: /confirm purchase/i })).not.toBeInTheDocument();
    expect(getPurchaseCalls()).toHaveLength(0);
  });

  it('submits the exact backend payload with the access token and refreshes stock on success', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ vehicles: [vehicle] }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            purchase: {
              id: 'purchase-1',
              userId: 'user-1',
              vehicleId: vehicle.id,
              quantity: 2,
              unitPrice: '42000.00',
              purchasedAt: '2026-01-03T00:00:00.000Z',
            },
          },
          201,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ vehicles: [{ ...vehicle, quantityInStock: 1 }] }));

    renderAtPath(`/vehicles/${vehicle.id}`);

    const quantity = await screen.findByRole('spinbutton', { name: /purchase quantity/i });
    fireEvent.change(quantity, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /purchase vehicle/i }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: /confirm purchase/i })).getByRole('button', {
        name: /confirm purchase/i,
      }),
    );

    expect(await screen.findByRole('status', { name: /purchase successful/i })).toBeInTheDocument();
    expect(screen.getByText('1 available', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return to inventory/i })).toHaveAttribute(
      'href',
      '/inventory',
    );
    expect(screen.getByRole('link', { name: /view purchase history/i })).toHaveAttribute(
      'href',
      '/purchases',
    );

    const purchaseCall = getPurchaseCalls()[0];
    expect(purchaseCall?.[0]).toBe(`/api/vehicles/${vehicle.id}/purchase`);
    expect(purchaseCall?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quantity: 2 }),
    });
  });

  it('prevents duplicate submissions while a purchase is in progress', async () => {
    let resolvePurchase!: (response: Response) => void;
    const pendingPurchase = new Promise<Response>((resolve) => {
      resolvePurchase = resolve;
    });

    fetchMock.mockImplementation((_input: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return pendingPurchase;
      }

      return Promise.resolve(jsonResponse({ vehicles: [vehicle] }));
    });

    renderAtPath(`/vehicles/${vehicle.id}`);

    await screen.findByRole('spinbutton', { name: /purchase quantity/i });
    fireEvent.click(screen.getByRole('button', { name: /purchase vehicle/i }));
    const dialog = await screen.findByRole('dialog', { name: /confirm purchase/i });
    const confirm = within(dialog).getByRole('button', { name: /confirm purchase/i });

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(getPurchaseCalls()).toHaveLength(1);
    expect(confirm).toBeDisabled();

    resolvePurchase(jsonResponse({ purchase: {} }, 201));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('refreshes the vehicle and reports insufficient stock safely after a 409 response', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ vehicles: [vehicle] }))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 'INSUFFICIENT_STOCK', message: 'Insufficient vehicle stock.' } },
          409,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ vehicles: [{ ...vehicle, quantityInStock: 1 }] }));

    renderAtPath(`/vehicles/${vehicle.id}`);

    await screen.findByRole('spinbutton', { name: /purchase quantity/i });
    fireEvent.click(screen.getByRole('button', { name: /purchase vehicle/i }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: /confirm purchase/i })).getByRole('button', {
        name: /confirm purchase/i,
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer has enough stock/i);
    expect(await screen.findByText('1 available', { exact: true })).toBeInTheDocument();
  });

  it('shows a safe validation message returned by the purchase API', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ vehicles: [vehicle] }))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 'VALIDATION_ERROR', message: 'Quantity must be a positive integer.' } },
          400,
        ),
      );

    renderAtPath(`/vehicles/${vehicle.id}`);

    await screen.findByRole('spinbutton', { name: /purchase quantity/i });
    fireEvent.click(screen.getByRole('button', { name: /purchase vehicle/i }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: /confirm purchase/i })).getByRole('button', {
        name: /confirm purchase/i,
      }),
    );

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/quantity must be a positive integer/i);
    expect(error).not.toHaveTextContent(/stack|prisma|database url/i);
  });

  it('clears an expired session and sends the user to login after a 401 response', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ vehicles: [vehicle] }))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, 401),
      );

    renderAtPath(`/vehicles/${vehicle.id}`);

    await screen.findByRole('spinbutton', { name: /purchase quantity/i });
    fireEvent.click(screen.getByRole('button', { name: /purchase vehicle/i }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: /confirm purchase/i })).getByRole('button', {
        name: /confirm purchase/i,
      }),
    );

    expect(
      await screen.findByRole('heading', { name: /sign in to the road/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/session has expired/i);
    expect(window.localStorage.getItem('accessToken')).toBeNull();
  });

  it('shows a safe generic error for unexpected purchase failures', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ vehicles: [vehicle] })).mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unable to complete vehicle purchase.',
            stack: 'private stack',
          },
        },
        500,
      ),
    );

    renderAtPath(`/vehicles/${vehicle.id}`);

    await screen.findByRole('spinbutton', { name: /purchase quantity/i });
    fireEvent.click(screen.getByRole('button', { name: /purchase vehicle/i }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: /confirm purchase/i })).getByRole('button', {
        name: /confirm purchase/i,
      }),
    );

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/unable to complete purchase/i);
    expect(error).not.toHaveTextContent(/private stack|prisma|database url/i);
  });
});
