import { useEffect, useState } from 'react';

import { AuthControls } from './AuthControls';
import { getVehicle, type Vehicle } from './api/vehicles';

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
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-[1440px] border-t border-[#171717]/15 px-6 py-8 text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55 lg:px-12">
        Maison Motoring / Inventory, considered.
      </footer>
    </div>
  );
}
