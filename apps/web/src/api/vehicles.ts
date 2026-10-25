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

class VehicleApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VehicleApiError';
  }
}

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
}

function getAccessToken() {
  try {
    return window.localStorage.getItem('accessToken');
  } catch {
    return null;
  }
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
  const accessToken = getAccessToken();
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
