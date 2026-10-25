import { readAccessToken } from '../auth/storage';
import { VehicleApiError, type Vehicle } from './vehicles';

export type PurchaseHistoryItem = {
  id: string;
  userId: string;
  vehicleId: string;
  quantity: number;
  unitPrice: string;
  purchasedAt: string;
  vehicle: Vehicle;
};

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
}

function getErrorDetails(body: unknown) {
  if (typeof body !== 'object' || body === null) {
    return { code: null };
  }

  const error = (body as { error?: unknown }).error;

  if (typeof error !== 'object' || error === null) {
    return { code: null };
  }

  const code = (error as { code?: unknown }).code;

  return { code: typeof code === 'string' ? code : null };
}

export async function listPurchaseHistory() {
  const accessToken = readAccessToken();
  const response = await window.fetch(`${getApiBaseUrl()}/purchases`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const { code } = getErrorDetails(body);

    if (response.status === 401) {
      throw new VehicleApiError(
        'Your session has expired. Please sign in again.',
        response.status,
        code,
      );
    }

    throw new VehicleApiError('Unable to load purchase history.', response.status, code);
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as { purchases?: unknown }).purchases)
  ) {
    throw new VehicleApiError('Unable to load purchase history.');
  }

  return (body as { purchases: PurchaseHistoryItem[] }).purchases;
}
