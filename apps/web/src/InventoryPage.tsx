import { useEffect, useState } from 'react';

import { AuthControls } from './AuthControls';
import { listVehicles, type Vehicle } from './api/vehicles';

const categoryOptions = ['SUV', 'Sedan', 'Coupe', 'Hatchback', 'Truck'];

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

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const availability =
    vehicle.quantityInStock === 0 ? 'Sold out' : `${vehicle.quantityInStock} available`;

  return (
    <a
      href={`/vehicles/${vehicle.id}`}
      aria-label={`View details for ${vehicle.make} ${vehicle.model}`}
      className="block rounded-[1.5rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
    >
      <article className="group overflow-hidden rounded-[1.5rem] border border-[#171717]/15 bg-white/25 motion-safe:transition-[border-color,transform,background-color] motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:border-[#E56B45]/70 hover:bg-white/50">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#A8B5A0]">
          <div className="absolute inset-5 rounded-[1rem] border border-[#F4F1EA]/55" />
          <div className="absolute -right-8 top-8 size-40 rounded-full bg-[#E56B45]/75 blur-3xl motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-125" />
          <div className="absolute -bottom-10 left-8 h-24 w-4/5 rounded-[50%] bg-[#171717]/75 blur-xl" />
          <div className="absolute bottom-16 left-1/2 h-20 w-3/5 -translate-x-1/2 -skew-x-12 rounded-[45%_55%_20%_20%] border border-[#F4F1EA]/75 bg-[#171717]" />
          <div className="absolute bottom-14 left-[28%] size-8 rounded-full border-4 border-[#171717] bg-[#F4F1EA]" />
          <div className="absolute bottom-14 right-[28%] size-8 rounded-full border-4 border-[#171717] bg-[#F4F1EA]" />
          <span className="absolute left-6 top-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#171717]/65">
            {vehicle.category}
          </span>
        </div>
        <div className="flex items-end justify-between gap-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#171717]/55">
              {vehicle.make}
            </p>
            <h3 className="mt-2 font-display text-3xl tracking-[-0.04em]">{vehicle.model}</h3>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tracking-[-0.03em]">{formatPrice(vehicle.price)}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#171717]/55">
              {availability}
            </p>
          </div>
        </div>
      </article>
    </a>
  );
}

export function InventoryPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;

    setIsLoading(true);
    setError(null);

    listVehicles({ search, category })
      .then((nextVehicles) => {
        if (isCurrentRequest) {
          setVehicles(nextVehicles);
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setError('Unable to load inventory. Please try again.');
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
  }, [category, search]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F4F1EA] text-[#171717]">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-6 lg:px-12">
        <a
          href="/"
          aria-label="Back to home"
          className="group flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em]"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-[#171717] text-[10px] tracking-normal text-[#F4F1EA] transition-transform duration-300 group-hover:rotate-12">
            M/01
          </span>
          Maison Motoring
        </a>
        <div className="flex items-center gap-5">
          <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-[#171717]/55 sm:block">
            Inventory / 2026
          </p>
          <AuthControls />
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1440px] px-6 pb-20 pt-14 lg:px-12 lg:pb-28 lg:pt-24">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#E56B45]">
            The considered collection
          </p>
          <h1 className="max-w-5xl font-display text-[clamp(4rem,10vw,9rem)] leading-[0.86] tracking-[-0.07em]">
            Inventory
          </h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-[#171717]/65 sm:text-lg">
            A living edit of vehicles chosen for how they feel on the road, not just how they look
            on paper.
          </p>
        </section>

        <section
          aria-labelledby="inventory-results-heading"
          className="mx-auto max-w-[1440px] border-t border-[#171717]/15 px-6 py-8 lg:px-12 lg:py-12"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#171717]/55">
                Find your next drive
              </p>
              <h2
                id="inventory-results-heading"
                className="font-display text-3xl tracking-[-0.04em]"
              >
                Inventory results
              </h2>
            </div>
            <form className="grid gap-4 sm:grid-cols-[minmax(240px,1fr)_180px]" role="search">
              <div>
                <label
                  htmlFor="inventory-search"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55"
                >
                  Search inventory
                </label>
                <input
                  id="inventory-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Make or model"
                  className="w-full rounded-full border border-[#171717]/20 bg-transparent px-5 py-3 text-sm outline-none transition-colors placeholder:text-[#171717]/40 focus:border-[#E56B45]"
                />
              </div>
              <div>
                <label
                  htmlFor="inventory-category"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55"
                >
                  Category
                </label>
                <select
                  id="inventory-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full appearance-none rounded-full border border-[#171717]/20 bg-[#F4F1EA] px-5 py-3 text-sm outline-none transition-colors focus:border-[#E56B45]"
                >
                  <option value="">All categories</option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </form>
          </div>

          <div className="mt-12" aria-live="polite">
            {isLoading && (
              <div role="status" aria-label="Loading inventory" className="py-20 text-center">
                <p className="font-display text-3xl tracking-[-0.04em]">Loading inventory…</p>
                <p className="mt-3 text-sm text-[#171717]/55">Taking a closer look.</p>
              </div>
            )}

            {!isLoading && error && (
              <div
                role="alert"
                className="rounded-[1.5rem] border border-[#E56B45]/45 bg-[#E56B45]/10 px-6 py-8"
              >
                <p className="font-display text-3xl tracking-[-0.04em]">
                  Unable to load inventory.
                </p>
                <p className="mt-2 text-sm text-[#171717]/65">Please try again in a moment.</p>
              </div>
            )}

            {!isLoading && !error && vehicles.length === 0 && (
              <div className="rounded-[1.5rem] border border-dashed border-[#171717]/25 px-6 py-20 text-center">
                <p className="font-display text-3xl tracking-[-0.04em]">No vehicles found.</p>
                <p className="mt-3 text-sm text-[#171717]/55">
                  Try a different make, model, or category.
                </p>
              </div>
            )}

            {!isLoading && !error && vehicles.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {vehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[1440px] border-t border-[#171717]/15 px-6 py-8 text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55 lg:px-12">
        Maison Motoring / Inventory, considered.
      </footer>
    </div>
  );
}
