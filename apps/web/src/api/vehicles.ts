import { readAccessToken } from '../auth/storage';

export type Vehicle = {
  id: string;
  make: string;
  model: string;
  category: string;
  price: string;
  quantityInStock: number;
  createdAt: string;
  updatedAt: string;
};

export type VehicleFilters = {
  search?: string;
  category?: string;
};

export class VehicleApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status = 0, code: string | null = null) {
    super(message);
    this.name = 'VehicleApiError';
    this.status = status;
    this.code = code;
  }
}

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
}

function getErrorDetails(body: unknown) {
  if (typeof body !== 'object' || body === null) {
    return { code: null, message: null };
  }

  const error = (body as { error?: unknown }).error;

  if (typeof error !== 'object' || error === null) {
    return { code: null, message: null };
  }

  const details = error as { code?: unknown; message?: unknown };

  return {
    code: typeof details.code === 'string' ? details.code : null,
    message: typeof details.message === 'string' ? details.message : null,
  };
}

export async function listVehicles(filters: VehicleFilters = {}) {
  const searchParams = new URLSearchParams();
  const search = filters.search?.trim();
  const category = filters.category?.trim();

  if (search) {
    searchParams.set('search', search);
  }

  if (category) {
    searchParams.set('category', category);
  }

  const query = searchParams.toString();
  const endpoint = `${getApiBaseUrl()}/vehicles${query ? `?${query}` : ''}`;
  const accessToken = readAccessToken();
  const response = await window.fetch(endpoint, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    throw new VehicleApiError('Unable to load inventory.');
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as { vehicles?: unknown }).vehicles)
  ) {
    throw new VehicleApiError('Unable to load inventory.');
  }

  return (body as { vehicles: Vehicle[] }).vehicles;
}

export async function getVehicle(id: string) {
  const vehicles = await listVehicles();

  return vehicles.find((vehicle) => vehicle.id === id) ?? null;
}

export async function purchaseVehicle(id: string, quantity: number) {
  const accessToken = readAccessToken();
  const response = await window.fetch(`${getApiBaseUrl()}/vehicles/${id}/purchase`, {
    body: JSON.stringify({ quantity }),
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
    const { code, message } = getErrorDetails(body);

    if (response.status === 401) {
      throw new VehicleApiError(
        'Your session has expired. Please sign in again.',
        response.status,
        code,
      );
    }

    if (response.status === 409 && code === 'INSUFFICIENT_STOCK') {
      throw new VehicleApiError(
        'This vehicle no longer has enough stock for that quantity.',
        response.status,
        code,
      );
    }

    if (response.status === 400 && code === 'VALIDATION_ERROR' && message) {
      throw new VehicleApiError(message, response.status, code);
    }

    throw new VehicleApiError('Unable to complete purchase.', response.status, code);
  }

  return body as { purchase?: unknown };
}
