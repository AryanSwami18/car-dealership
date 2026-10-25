import { useEffect, useState } from 'react';

import { AuthControls } from './AuthControls';
import { useAuth } from './auth/AuthContext';
import { listPurchaseHistory, type PurchaseHistoryItem } from './api/purchases';
import { VehicleApiError } from './api/vehicles';
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

function formatPurchaseDate(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsedDate);
}

function PurchaseCard({ purchase }: { purchase: PurchaseHistoryItem }) {
  const vehicleName = `${purchase.vehicle.make} ${purchase.vehicle.model}`;
  const total = (Number(purchase.unitPrice) * purchase.quantity).toFixed(2);

  return (
    <article
      aria-labelledby={`purchase-${purchase.id}`}
      className="rounded-[1.5rem] border border-[#171717]/15 bg-white/20 p-6 sm:p-8"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E56B45]">
            Purchase record
          </p>
          <h2
            id={`purchase-${purchase.id}`}
            className="mt-3 font-display text-4xl tracking-[-0.05em]"
          >
            {vehicleName}
          </h2>
          <p className="mt-2 text-sm uppercase tracking-[0.16em] text-[#171717]/55">
            {purchase.vehicle.category}
          </p>
        </div>
        <a
          href={`/vehicles/${purchase.vehicleId}`}
          aria-label={`View ${vehicleName}`}
          className="inline-flex items-center gap-2 self-start text-xs font-semibold uppercase tracking-[0.14em] underline decoration-[#E56B45] decoration-2 underline-offset-8 transition-colors hover:text-[#E56B45] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
        >
          View vehicle
          <span aria-hidden="true">↗</span>
        </a>
      </div>

      <dl className="mt-8 grid gap-5 border-y border-[#171717]/15 py-5 sm:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55">
            Quantity
          </dt>
          <dd className="mt-2 text-lg font-semibold">
            {purchase.quantity} {purchase.quantity === 1 ? 'vehicle' : 'vehicles'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55">
            Purchase price
          </dt>
          <dd className="mt-2 text-lg font-semibold">{formatPrice(purchase.unitPrice)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55">
            Total
          </dt>
          <dd className="mt-2 text-lg font-semibold">{formatPrice(total)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55">
            Purchased
          </dt>
          <dd className="mt-2 text-lg font-semibold">
            <time dateTime={purchase.purchasedAt}>{formatPurchaseDate(purchase.purchasedAt)}</time>
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function PurchaseHistoryPage() {
  const { isAdmin, signOut } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCurrentRequest = true;

    listPurchaseHistory()
      .then((nextPurchases) => {
        if (isCurrentRequest) {
          setPurchases(nextPurchases);
        }
      })
      .catch((error) => {
        if (!isCurrentRequest) {
          return;
        }

        if (error instanceof VehicleApiError && error.status === 401) {
          signOut();
          navigateTo('/login?reason=session-expired');
          return;
        }

        setHasError(true);
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [signOut]);

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
            Maison Motoring / {isAdmin ? 'All records' : 'Your records'}
          </span>
          <AuthControls />
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1440px] px-6 pb-20 pt-12 lg:px-12 lg:pb-32 lg:pt-24">
          <div className="max-w-3xl">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#E56B45]">
              Maison Motoring / {isAdmin ? 'Collection records' : 'Your road so far'}
            </p>
            <h1 className="font-display text-[clamp(3.5rem,8vw,7rem)] leading-[0.88] tracking-[-0.07em]">
              {isAdmin ? 'All purchase history.' : 'Purchase history.'}
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[#171717]/65">
              A quiet record of the vehicles chosen and the prices held at the moment of purchase.
            </p>
          </div>

          <div className="mt-16">
            {isLoading && (
              <div
                role="status"
                aria-label="Loading purchase history"
                className="py-24 text-center"
              >
                <p className="font-display text-4xl tracking-[-0.05em]">Loading your records…</p>
                <p className="mt-3 text-sm text-[#171717]/55">Gathering the road behind you.</p>
              </div>
            )}

            {!isLoading && hasError && (
              <div
                role="alert"
                className="rounded-[2rem] border border-[#E56B45]/45 bg-[#E56B45]/10 px-6 py-12 sm:px-10"
              >
                <p className="font-display text-4xl tracking-[-0.05em]">
                  Unable to load purchase history.
                </p>
                <p className="mt-3 max-w-lg text-sm leading-6 text-[#171717]/65">
                  Please try again in a moment. Your purchase records have not been changed.
                </p>
              </div>
            )}

            {!isLoading && !hasError && purchases.length === 0 && (
              <div
                role="status"
                aria-label="No purchase history"
                className="rounded-[2rem] border border-dashed border-[#171717]/25 px-6 py-16 text-center sm:px-10"
              >
                <p className="font-display text-4xl tracking-[-0.05em]">No purchases yet.</p>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#171717]/65">
                  The next considered choice is waiting in the collection.
                </p>
                <a
                  href="/inventory"
                  className="mt-8 inline-flex rounded-full bg-[#171717] px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#F4F1EA] transition-[background-color,transform] hover:-translate-y-1 hover:bg-[#E56B45] motion-reduce:transition-none motion-reduce:hover:transform-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
                >
                  Return to inventory
                </a>
              </div>
            )}

            {!isLoading && !hasError && purchases.length > 0 && (
              <section aria-label="Purchase history results" className="space-y-5">
                {purchases.map((purchase) => (
                  <PurchaseCard key={purchase.id} purchase={purchase} />
                ))}
              </section>
            )}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[1440px] border-t border-[#171717]/15 px-6 py-8 text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55 lg:px-12">
        Maison Motoring / Purchase records, considered.
      </footer>
    </div>
  );
}
