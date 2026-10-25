import { useEffect, useState } from 'react';

import { AuthControls } from './AuthControls';
import { useAuth } from './auth/AuthContext';
import { getVehicle, purchaseVehicle, VehicleApiError, type Vehicle } from './api/vehicles';
import { MaisonVehicleArt } from './MaisonVehicleArt';
import { navigateTo } from './navigation';

function formatPrice(price: string) {
  const amount = Number(price);

  if (!Number.isFinite(amount)) {
    return price;
  }

  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(amount);
}

export function VehicleDetailsPage({ vehicleId }: { vehicleId: string }) {
  const { signOut } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  useEffect(() => {
    let isCurrentRequest = true;

    setVehicle(null);
    setIsLoading(true);
    setHasError(false);

    getVehicle(vehicleId)
      .then((nextVehicle) => {
        if (isCurrentRequest) {
          setVehicle(nextVehicle);
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setHasError(true);
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [vehicleId]);

  async function refreshVehicle() {
    try {
      const nextVehicle = await getVehicle(vehicleId);

      setHasError(false);
      setVehicle(nextVehicle);
      setPurchaseQuantity((currentQuantity) => {
        if (!nextVehicle || nextVehicle.quantityInStock === 0) {
          return 1;
        }

        return Math.min(Math.max(currentQuantity, 1), nextVehicle.quantityInStock);
      });
    } catch {
      setHasError(true);
    }
  }

  function handleQuantityChange(value: string) {
    const nextQuantity = Number(value);

    setPurchaseQuantity(Number.isFinite(nextQuantity) ? nextQuantity : 0);
    setPurchaseError(null);
  }

  function updatePurchaseQuantity(nextQuantity: number) {
    if (!vehicle) {
      return;
    }

    setPurchaseQuantity(Math.min(Math.max(nextQuantity, 1), vehicle.quantityInStock || 1));
    setPurchaseError(null);
  }

  function isValidPurchaseQuantity() {
    return Boolean(
      vehicle &&
      vehicle.quantityInStock > 0 &&
      Number.isInteger(purchaseQuantity) &&
      purchaseQuantity > 0 &&
      purchaseQuantity <= vehicle.quantityInStock,
    );
  }

  function handlePurchaseStart() {
    if (!isValidPurchaseQuantity()) {
      setPurchaseError(
        `Choose a whole-number quantity between 1 and ${vehicle?.quantityInStock ?? 0}.`,
      );
      return;
    }

    setPurchaseError(null);
    setPurchaseSuccess(false);
    setIsPurchaseDialogOpen(true);
  }

  async function handlePurchaseConfirm() {
    if (!vehicle || !isValidPurchaseQuantity()) {
      setPurchaseError(
        `Choose a whole-number quantity between 1 and ${vehicle?.quantityInStock ?? 0}.`,
      );
      return;
    }

    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      await purchaseVehicle(vehicle.id, purchaseQuantity);
      setIsPurchaseDialogOpen(false);
      setPurchaseSuccess(true);
      await refreshVehicle();
    } catch (error) {
      setIsPurchaseDialogOpen(false);

      if (error instanceof VehicleApiError && error.status === 401) {
        signOut();
        navigateTo('/login?reason=session-expired');
        return;
      }

      if (error instanceof VehicleApiError && error.status === 409) {
        setPurchaseError(error.message);
        await refreshVehicle();
        return;
      }

      setPurchaseError(
        error instanceof VehicleApiError && error.status === 400
          ? error.message
          : 'Unable to complete purchase. Please try again.',
      );
    } finally {
      setIsPurchasing(false);
    }
  }

  const availability = vehicle
    ? vehicle.quantityInStock === 0
      ? 'Sold out'
      : `${vehicle.quantityInStock} available`
    : null;

  return (
    <div className="maison-page">
      <header className="maison-container maison-header">
        <a href="/inventory" aria-label="Back to inventory" className="maison-back-link">
          <span aria-hidden="true">←</span>
          Back to inventory
        </a>
        <div className="maison-page-header-meta">
          <p>Maison Motoring / Detail</p>
          <AuthControls />
        </div>
      </header>

      <main>
        <section className="maison-container maison-section maison-detail-section">
          {isLoading && (
            <div
              role="status"
              aria-label="Loading vehicle details"
              className="maison-loading-state maison-loading-state--detail"
            >
              <p className="maison-state-panel__title">Loading details…</p>
              <p className="maison-state-panel__copy">Taking a closer look.</p>
            </div>
          )}

          {!isLoading && hasError && (
            <div role="alert" className="maison-state-panel maison-state-panel--error">
              <p className="maison-state-panel__title">Unable to load vehicle details.</p>
              <p className="maison-state-panel__copy">
                Please return to the collection and try again in a moment.
              </p>
            </div>
          )}

          {!isLoading && !hasError && !vehicle && (
            <div
              role="status"
              aria-label="Vehicle not found"
              className="maison-state-panel maison-state-panel--empty"
            >
              <p className="maison-state-panel__title">Vehicle not found.</p>
              <p className="maison-state-panel__copy">
                This vehicle is no longer part of the considered collection.
              </p>
            </div>
          )}

          {!isLoading && !hasError && vehicle && (
            <div className="maison-detail-grid">
              <MaisonVehicleArt
                label={`${vehicle.make} ${vehicle.model} studio study`}
                variant="hero"
              />

              <div>
                <p className="maison-eyebrow">{vehicle.category} / Maison selection</p>
                <p className="maison-detail-make">{vehicle.make}</p>
                <h1 className="maison-detail-title">
                  {vehicle.make} {vehicle.model}
                </h1>

                <div className="maison-detail-stats">
                  <div className="maison-detail-stat">
                    <p className="maison-detail-stat__label">Asking price</p>
                    <p className="maison-detail-stat__value">{formatPrice(vehicle.price)}</p>
                  </div>
                  <div className="maison-detail-stat maison-detail-stat--split">
                    <p className="maison-detail-stat__label">Availability</p>
                    <p className="maison-detail-stat__value">{availability}</p>
                  </div>
                </div>

                <p className="maison-detail-copy">
                  A considered addition to the collection, presented with the details that matter
                  before the road begins.
                </p>

                <div className="maison-purchase-panel">
                  <div className="maison-purchase-panel__header">
                    <div>
                      <label htmlFor="purchase-quantity" className="maison-field-label">
                        Purchase quantity
                      </label>
                      <div className="maison-stepper" aria-label="Purchase quantity controls">
                        <button
                          type="button"
                          className="maison-stepper__button"
                          aria-label="Decrease purchase quantity"
                          disabled={
                            vehicle.quantityInStock === 0 || isPurchasing || purchaseQuantity <= 1
                          }
                          onClick={() => updatePurchaseQuantity(purchaseQuantity - 1)}
                        >
                          −
                        </button>
                        <input
                          id="purchase-quantity"
                          aria-describedby="purchase-availability"
                          className="maison-stepper__input"
                          disabled={vehicle.quantityInStock === 0 || isPurchasing}
                          inputMode="numeric"
                          max={vehicle.quantityInStock}
                          min="1"
                          name="quantity"
                          onChange={(event) => handleQuantityChange(event.target.value)}
                          step="1"
                          type="number"
                          value={purchaseQuantity}
                        />
                        <button
                          type="button"
                          className="maison-stepper__button"
                          aria-label="Increase purchase quantity"
                          disabled={
                            vehicle.quantityInStock === 0 ||
                            isPurchasing ||
                            purchaseQuantity >= vehicle.quantityInStock
                          }
                          onClick={() => updatePurchaseQuantity(purchaseQuantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p id="purchase-availability" className="maison-purchase-panel__availability">
                      {vehicle.quantityInStock === 0
                        ? 'This vehicle is currently sold out.'
                        : `Choose up to ${vehicle.quantityInStock} vehicle${vehicle.quantityInStock === 1 ? '' : 's'} currently in stock.`}
                    </p>
                  </div>

                  {purchaseError && (
                    <div role="alert" className="maison-feedback maison-feedback--error">
                      {purchaseError}
                    </div>
                  )}

                  {purchaseSuccess && (
                    <div
                      role="status"
                      aria-label="Purchase successful"
                      className="maison-feedback maison-feedback--success"
                    >
                      <p className="font-semibold">Purchase confirmed.</p>
                      <p className="maison-feedback__copy">
                        Your vehicle has been reserved at the displayed purchase price.
                      </p>
                      <div className="maison-feedback__links">
                        <a href="/inventory" className="maison-link">
                          Return to inventory
                        </a>
                        <a href="/purchases" className="maison-link">
                          View purchase history
                        </a>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="maison-button maison-button--primary maison-purchase-action"
                    disabled={vehicle.quantityInStock === 0 || isPurchasing}
                    onClick={handlePurchaseStart}
                  >
                    Purchase vehicle
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {isPurchaseDialogOpen && vehicle && (
        <div
          role="dialog"
          aria-labelledby="purchase-dialog-title"
          aria-modal="true"
          className="maison-purchase-dialog-backdrop"
        >
          <div className="maison-purchase-dialog">
            <p className="maison-eyebrow">One considered choice</p>
            <h2 id="purchase-dialog-title" className="maison-purchase-dialog__title">
              Confirm purchase
            </h2>
            <dl className="maison-purchase-dialog__summary">
              <div className="flex justify-between gap-6">
                <dt>Vehicle</dt>
                <dd className="text-right font-semibold">
                  {vehicle.make} {vehicle.model}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt>Quantity</dt>
                <dd className="font-semibold">{purchaseQuantity}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt>Unit price</dt>
                <dd className="font-semibold">{formatPrice(vehicle.price)}</dd>
              </div>
              <div className="flex justify-between gap-6 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="font-semibold">
                  {formatPrice((Number(vehicle.price) * purchaseQuantity).toFixed(2))}
                </dd>
              </div>
            </dl>
            <div className="maison-purchase-dialog__actions">
              <button
                type="button"
                className="maison-button maison-button--quiet"
                disabled={isPurchasing}
                onClick={() => setIsPurchaseDialogOpen(false)}
              >
                Cancel purchase
              </button>
              <button
                type="button"
                className="maison-button maison-button--primary"
                disabled={isPurchasing}
                onClick={handlePurchaseConfirm}
              >
                {isPurchasing ? 'Processing…' : 'Confirm purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="maison-container maison-footer">
        <span>Maison Motoring / Inventory, considered.</span>
        <span>Est. 2026</span>
      </footer>
    </div>
  );
}
