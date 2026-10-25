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

export type VehicleInput = {
  make: string;
  model: string;
  category: string;
  price: number;
  quantityInStock: number;
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

async function readResponseBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function getAuthenticatedHeaders(includeJson = false) {
  const accessToken = readAccessToken();

  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

function getVehicleApiError(response: Response, body: unknown, fallbackMessage: string) {
  const { code, message } = getErrorDetails(body);

  if (response.status === 401) {
    return new VehicleApiError(
      'Your session has expired. Please sign in again.',
      response.status,
      code,
    );
  }

  if (response.status === 403) {
    return new VehicleApiError(
      'You do not have permission to manage inventory.',
      response.status,
      code,
    );
  }

  if (response.status === 400 && code === 'VALIDATION_ERROR' && message) {
    return new VehicleApiError(message, response.status, code);
  }

  if (response.status === 404 && code === 'NOT_FOUND') {
    return new VehicleApiError('Vehicle not found.', response.status, code);
  }

  if (response.status === 409 && code === 'VEHICLE_HAS_PURCHASE_HISTORY') {
    return new VehicleApiError(
      'This vehicle has purchase history and cannot be deleted.',
      response.status,
      code,
    );
  }

  if (response.status === 409 && code === 'STOCK_LIMIT_EXCEEDED') {
    return new VehicleApiError(
      'The stock limit has been reached. Choose a smaller quantity.',
      response.status,
      code,
    );
  }

  return new VehicleApiError(fallbackMessage, response.status, code);
}

function parseVehicleResponse(body: unknown, fallbackMessage: string) {
  if (typeof body !== 'object' || body === null) {
    throw new VehicleApiError(fallbackMessage);
  }

  const vehicle = (body as { vehicle?: unknown }).vehicle;

  if (typeof vehicle !== 'object' || vehicle === null) {
    throw new VehicleApiError(fallbackMessage);
  }

  return vehicle as Vehicle;
}

async function requestVehicleMutation(
  endpoint: string,
  options: RequestInit,
  fallbackMessage: string,
) {
  const response = await window.fetch(endpoint, options);
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw getVehicleApiError(response, body, fallbackMessage);
  }

  return body;
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
  const response = await window.fetch(endpoint, {
    headers: getAuthenticatedHeaders(),
  });

  const body = await readResponseBody(response);

  if (!response.ok) {
    throw getVehicleApiError(response, body, 'Unable to load inventory.');
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

export async function createVehicle(input: VehicleInput) {
  const body = await requestVehicleMutation(
    `${getApiBaseUrl()}/vehicles`,
    {
      body: JSON.stringify(input),
      headers: getAuthenticatedHeaders(true),
      method: 'POST',
    },
    'Unable to create vehicle.',
  );

  return parseVehicleResponse(body, 'Unable to create vehicle.');
}

export async function updateVehicle(id: string, input: VehicleInput) {
  const body = await requestVehicleMutation(
    `${getApiBaseUrl()}/vehicles/${id}`,
    {
      body: JSON.stringify(input),
      headers: getAuthenticatedHeaders(true),
      method: 'PUT',
    },
    'Unable to update vehicle.',
  );

  return parseVehicleResponse(body, 'Unable to update vehicle.');
}

export async function deleteVehicle(id: string) {
  await requestVehicleMutation(
    `${getApiBaseUrl()}/vehicles/${id}`,
    {
      headers: getAuthenticatedHeaders(),
      method: 'DELETE',
    },
    'Unable to delete vehicle.',
  );
}

export async function restockVehicle(id: string, quantity: number) {
  const body = await requestVehicleMutation(
    `${getApiBaseUrl()}/vehicles/${id}/restock`,
    {
      body: JSON.stringify({ quantity }),
      headers: getAuthenticatedHeaders(true),
      method: 'POST',
    },
    'Unable to restock vehicle.',
  );

  return parseVehicleResponse(body, 'Unable to restock vehicle.');
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
