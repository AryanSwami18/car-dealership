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
      className="maison-purchase-card maison-motion-enter"
    >
      <div className="maison-purchase-card__header">
        <div>
          <p className="maison-eyebrow">Purchase record</p>
          <h2 id={`purchase-${purchase.id}`} className="maison-purchase-card__title">
            {vehicleName}
          </h2>
          <p className="maison-purchase-card__category">{purchase.vehicle.category}</p>
        </div>
        <a
          href={`/vehicles/${purchase.vehicleId}`}
          aria-label={`View ${vehicleName}`}
          className="maison-link"
        >
          View vehicle
          <span aria-hidden="true">↗</span>
        </a>
      </div>

      <dl className="maison-purchase-card__details">
        <div>
          <dt>Quantity</dt>
          <dd>
            {purchase.quantity} {purchase.quantity === 1 ? 'vehicle' : 'vehicles'}
          </dd>
        </div>
        <div>
          <dt>Purchase price</dt>
          <dd>{formatPrice(purchase.unitPrice)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatPrice(total)}</dd>
        </div>
        <div>
          <dt>Purchased</dt>
          <dd>
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
    <div className="maison-page maison-motion-enter">
      <header className="maison-container maison-header">
        <a href="/inventory" aria-label="Back to inventory" className="maison-back-link">
          <span aria-hidden="true">←</span>
          Back to inventory
        </a>
        <div className="maison-page-header-meta">
          <p>Maison Motoring / {isAdmin ? 'All records' : 'Your records'}</p>
          <AuthControls />
        </div>
      </header>

      <main>
        <section className="maison-container maison-section maison-history-section">
          <div className="maison-history-intro">
            <p className="maison-eyebrow">
              Maison Motoring / {isAdmin ? 'Collection records' : 'Your road so far'}
            </p>
            <h1 className="maison-history-title">
              {isAdmin ? 'All purchase history.' : 'Purchase history.'}
            </h1>
            <p className="maison-history-copy">
              A quiet record of the vehicles chosen and the prices held at the moment of purchase.
            </p>
          </div>

          <div className="maison-history-content">
            {isLoading && (
              <div
                role="status"
                aria-label="Loading purchase history"
                className="maison-loading-state maison-loading-state--detail"
              >
                <p className="maison-state-panel__title">Loading your records…</p>
                <p className="maison-state-panel__copy">Gathering the road behind you.</p>
              </div>
            )}

            {!isLoading && hasError && (
              <div role="alert" className="maison-state-panel maison-state-panel--error">
                <p className="maison-state-panel__title">Unable to load purchase history.</p>
                <p className="maison-state-panel__copy">
                  Please try again in a moment. Your purchase records have not been changed.
                </p>
              </div>
            )}

            {!isLoading && !hasError && purchases.length === 0 && (
              <div
                role="status"
                aria-label="No purchase history"
                className="maison-state-panel maison-state-panel--empty"
              >
                <p className="maison-state-panel__title">No purchases yet.</p>
                <p className="maison-state-panel__copy">
                  The next considered choice is waiting in the collection.
                </p>
                <a href="/inventory" className="maison-button maison-button--primary">
                  Return to inventory
                </a>
              </div>
            )}

            {!isLoading && !hasError && purchases.length > 0 && (
              <section aria-label="Purchase history results" className="maison-history-list">
                {purchases.map((purchase) => (
                  <PurchaseCard key={purchase.id} purchase={purchase} />
                ))}
              </section>
            )}
          </div>
        </section>
      </main>

      <footer className="maison-container maison-footer">
        <span>Maison Motoring / Purchase records, considered.</span>
        <span>Est. 2026</span>
      </footer>
    </div>
  );
}
