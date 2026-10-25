import { useEffect, useState } from 'react';

import { AuthControls } from './AuthControls';
import { useAuth } from './auth/AuthContext';
import { getVehicle, purchaseVehicle, VehicleApiError, type Vehicle } from './api/vehicles';
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

function VehicleVisual({ category }: { category: string }) {
  return (
    <div
      aria-hidden="true"
      className="relative min-h-[360px] overflow-hidden rounded-[2rem] bg-[#A8B5A0] p-5 sm:min-h-[520px]"
    >
      <div className="absolute inset-5 rounded-[1.5rem] border border-[#F4F1EA]/55" />
      <div className="absolute -right-16 top-12 size-72 rounded-full bg-[#E56B45]/75 blur-3xl" />
      <div className="absolute -bottom-24 -left-10 size-80 rounded-full bg-[#171717]/70 blur-3xl" />
      <div className="absolute inset-x-10 bottom-20 h-32 rounded-[50%] bg-[#171717]/75 blur-xl" />
      <div className="absolute bottom-28 left-1/2 h-36 w-[76%] -translate-x-1/2 -skew-x-12 rounded-[45%_55%_20%_20%] border-2 border-[#F4F1EA]/80 bg-[#171717] shadow-2xl shadow-[#171717]/50" />
      <div className="absolute bottom-32 left-[20%] size-14 rounded-full border-8 border-[#171717] bg-[#F4F1EA]" />
      <div className="absolute bottom-32 right-[20%] size-14 rounded-full border-8 border-[#171717] bg-[#F4F1EA]" />
      <span className="absolute left-10 top-10 text-xs font-semibold uppercase tracking-[0.2em] text-[#171717]/65">
        {category} / Detail view
      </span>
      <span className="absolute bottom-10 left-10 text-xs font-semibold uppercase tracking-[0.18em] text-[#F4F1EA]">
        Maison Motoring / 01
      </span>
    </div>
  );
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
    <div className="min-h-screen overflow-x-hidden bg-[#F4F1EA] text-[#171717]">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-6 lg:px-12">
        <a
          href="/inventory"
          aria-label="Back to inventory"
          className="group inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
        >
          <span className="text-lg motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:-translate-x-1">
            ←
          </span>
          Back to inventory
        </a>
        <div className="flex items-center gap-5">
          <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-[#171717]/55 sm:block">
            Maison Motoring / Detail
          </span>
          <AuthControls />
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1440px] px-6 pb-20 pt-12 lg:px-12 lg:pb-32 lg:pt-24">
          {isLoading && (
            <div role="status" aria-label="Loading vehicle details" className="py-32 text-center">
              <p className="font-display text-4xl tracking-[-0.05em]">Loading details…</p>
              <p className="mt-3 text-sm text-[#171717]/55">Taking a closer look.</p>
            </div>
          )}

          {!isLoading && hasError && (
            <div
              role="alert"
              className="rounded-[2rem] border border-[#E56B45]/45 bg-[#E56B45]/10 px-6 py-12 sm:px-10"
            >
              <p className="font-display text-4xl tracking-[-0.05em]">
                Unable to load vehicle details.
              </p>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#171717]/65">
                Please return to the collection and try again in a moment.
              </p>
            </div>
          )}

          {!isLoading && !hasError && !vehicle && (
            <div
              role="status"
              aria-label="Vehicle not found"
              className="rounded-[2rem] border border-dashed border-[#171717]/25 px-6 py-16 text-center sm:px-10"
            >
              <p className="font-display text-4xl tracking-[-0.05em]">Vehicle not found.</p>
              <p className="mt-3 text-sm leading-6 text-[#171717]/65">
                This vehicle is no longer part of the considered collection.
              </p>
            </div>
          )}

          {!isLoading && !hasError && vehicle && (
            <div className="grid gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)] lg:items-center lg:gap-20">
              <VehicleVisual category={vehicle.category} />

              <div>
                <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#E56B45]">
                  {vehicle.category} / Maison selection
                </p>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#171717]/55">
                  {vehicle.make}
                </p>
                <h1 className="mt-3 max-w-2xl font-display text-[clamp(3.5rem,8vw,7rem)] leading-[0.88] tracking-[-0.07em]">
                  {vehicle.make} {vehicle.model}
                </h1>

                <div className="mt-12 grid max-w-xl grid-cols-2 border-y border-[#171717]/15 py-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#171717]/55">
                      Asking price
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                      {formatPrice(vehicle.price)}
                    </p>
                  </div>
                  <div className="border-l border-[#171717]/15 pl-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#171717]/55">
                      Availability
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{availability}</p>
                  </div>
                </div>

                <p className="mt-8 max-w-lg text-base leading-7 text-[#171717]/65">
                  A considered addition to the collection, presented with the details that matter
                  before the road begins.
                </p>

                <div className="mt-10 max-w-xl rounded-[1.5rem] border border-[#171717]/15 bg-white/25 p-5 sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <label
                        htmlFor="purchase-quantity"
                        className="block text-xs font-semibold uppercase tracking-[0.18em] text-[#171717]/60"
                      >
                        Purchase quantity
                      </label>
                      <input
                        id="purchase-quantity"
                        aria-describedby="purchase-availability"
                        className="mt-3 w-full rounded-2xl border border-[#171717]/20 bg-[#F4F1EA] px-4 py-3 text-lg font-semibold outline-none transition-colors focus:border-[#E56B45] disabled:cursor-not-allowed disabled:opacity-50 sm:w-32"
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
                    </div>
                    <p
                      id="purchase-availability"
                      className="text-sm leading-6 text-[#171717]/60 sm:max-w-[14rem] sm:text-right"
                    >
                      {vehicle.quantityInStock === 0
                        ? 'This vehicle is currently sold out.'
                        : `Choose up to ${vehicle.quantityInStock} vehicle${vehicle.quantityInStock === 1 ? '' : 's'} currently in stock.`}
                    </p>
                  </div>

                  {purchaseError && (
                    <div
                      role="alert"
                      className="mt-5 rounded-2xl border border-[#E56B45]/45 bg-[#E56B45]/10 px-4 py-3 text-sm leading-6"
                    >
                      {purchaseError}
                    </div>
                  )}

                  {purchaseSuccess && (
                    <div
                      role="status"
                      aria-label="Purchase successful"
                      className="mt-5 rounded-2xl border border-[#A8B5A0] bg-[#A8B5A0]/25 px-4 py-4 text-sm leading-6"
                    >
                      <p className="font-semibold">Purchase confirmed.</p>
                      <p className="mt-1 text-[#171717]/65">
                        Your vehicle has been reserved at the displayed purchase price.
                      </p>
                      <a
                        href="/inventory"
                        className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.14em] underline decoration-[#E56B45] decoration-2 underline-offset-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
                      >
                        Return to inventory
                      </a>
                    </div>
                  )}

                  <button
                    type="button"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#171717] px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#F4F1EA] transition-[background-color,transform] duration-300 hover:-translate-y-1 hover:bg-[#E56B45] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none motion-reduce:hover:transform-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
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
          className="fixed inset-0 z-10 flex items-center justify-center bg-[#171717]/55 px-6 py-8"
        >
          <div className="w-full max-w-lg rounded-[2rem] bg-[#F4F1EA] p-6 text-[#171717] shadow-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E56B45]">
              One considered choice
            </p>
            <h2
              id="purchase-dialog-title"
              className="mt-3 font-display text-4xl tracking-[-0.05em]"
            >
              Confirm purchase
            </h2>
            <dl className="mt-8 space-y-4 border-y border-[#171717]/15 py-5 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-[#171717]/60">Vehicle</dt>
                <dd className="text-right font-semibold">
                  {vehicle.make} {vehicle.model}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-[#171717]/60">Quantity</dt>
                <dd className="font-semibold">{purchaseQuantity}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-[#171717]/60">Unit price</dt>
                <dd className="font-semibold">{formatPrice(vehicle.price)}</dd>
              </div>
              <div className="flex justify-between gap-6 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="font-semibold">
                  {formatPrice((Number(vehicle.price) * purchaseQuantity).toFixed(2))}
                </dd>
              </div>
            </dl>
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-full border border-[#171717]/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-[#171717] hover:bg-[#171717] hover:text-[#F4F1EA] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
                disabled={isPurchasing}
                onClick={() => setIsPurchaseDialogOpen(false)}
              >
                Cancel purchase
              </button>
              <button
                type="button"
                className="rounded-full bg-[#171717] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#F4F1EA] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#E56B45] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:transform-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
                disabled={isPurchasing}
                onClick={handlePurchaseConfirm}
              >
                {isPurchasing ? 'Processing…' : 'Confirm purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mx-auto max-w-[1440px] border-t border-[#171717]/15 px-6 py-8 text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55 lg:px-12">
        Maison Motoring / Inventory, considered.
      </footer>
    </div>
  );
}
