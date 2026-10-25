import { useEffect, useState } from 'react';

import { AuthControls } from './AuthControls';
import { listVehicles, type Vehicle } from './api/vehicles';
import { MaisonVehicleArt, type VehicleArtVariant } from './MaisonVehicleArt';

const categoryOptions = ['SUV', 'Sedan', 'Coupe', 'Hatchback', 'Truck'];

function vehicleArtVariant(category: string): VehicleArtVariant {
  if (category === 'Coupe') {
    return 'dark';
  }

  if (category === 'Sedan' || category === 'Truck') {
    return 'warm';
  }

  return 'sage';
}

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
  const isSoldOut = vehicle.quantityInStock === 0;

  return (
    <a
      href={`/vehicles/${vehicle.id}`}
      aria-label={`View details for ${vehicle.make} ${vehicle.model}`}
      className="maison-card-link"
    >
      <article className="maison-inventory-card">
        <MaisonVehicleArt
          label={`${vehicle.make} ${vehicle.model} studio study`}
          variant={vehicleArtVariant(vehicle.category)}
        />
        <div className="maison-inventory-card__body">
          <div>
            <p className="maison-inventory-card__make">{vehicle.make}</p>
            <h3 className="maison-inventory-card__model">{vehicle.model}</h3>
            <p className="maison-inventory-card__category">{vehicle.category}</p>
          </div>
          <div className="maison-inventory-card__meta">
            <p className="maison-inventory-card__price">{formatPrice(vehicle.price)}</p>
            <p className={`maison-stock-status${isSoldOut ? ' maison-stock-status--sold' : ''}`}>
              <span aria-hidden="true" className="maison-stock-status__dot" />
              <span>{availability}</span>
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
  const [retryToken, setRetryToken] = useState(0);

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
  }, [category, retryToken, search]);

  const hasActiveFilters = Boolean(search || category);

  function resetFilters() {
    setSearch('');
    setCategory('');
  }

  return (
    <div className="maison-page">
      <header className="maison-container maison-header">
        <a href="/" aria-label="Back to home" className="maison-brand">
          <span className="maison-mark">M/01</span>
          <span>Maison Motoring</span>
        </a>
        <div className="maison-page-header-meta">
          <p>Inventory / 2026</p>
          <AuthControls />
        </div>
      </header>

      <main>
        <section className="maison-container maison-section maison-inventory-hero">
          <p className="maison-eyebrow">The considered collection</p>
          <h1 className="maison-inventory-heading">Inventory</h1>
          <p className="maison-section-copy maison-inventory-intro">
            A living edit of vehicles chosen for how they feel on the road, not just how they look
            on paper.
          </p>
        </section>

        <section
          aria-labelledby="inventory-results-heading"
          className="maison-container maison-section maison-section--rule maison-inventory-results"
        >
          <div className="maison-inventory-results__heading">
            <div>
              <p className="maison-inventory-kicker">Find your next drive</p>
              <h2 id="inventory-results-heading" className="maison-inventory-results__title">
                Inventory results
              </h2>
            </div>
            <form
              className="maison-filter-bar"
              role="search"
              onSubmit={(event) => event.preventDefault()}
            >
              <div>
                <label htmlFor="inventory-search" className="maison-field-label">
                  Search inventory
                </label>
                <input
                  id="inventory-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Make or model"
                  className="maison-field maison-field--search"
                />
              </div>
              <div>
                <label htmlFor="inventory-category" className="maison-field-label">
                  Category
                </label>
                <select
                  id="inventory-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="maison-field maison-field--select"
                >
                  <option value="">All categories</option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="maison-button maison-button--quiet maison-filter-reset"
                disabled={!hasActiveFilters}
                onClick={resetFilters}
              >
                Reset filters
              </button>
            </form>
          </div>

          <div className="maison-inventory-results__content" aria-live="polite">
            {isLoading && (
              <div role="status" aria-label="Loading inventory" className="maison-loading-state">
                <p className="sr-only">Loading inventory…</p>
                <div data-testid="inventory-skeleton-grid" className="maison-inventory-grid">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div
                      key={index}
                      data-testid="inventory-skeleton-card"
                      className="maison-skeleton-card"
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && error && (
              <div role="alert" className="maison-state-panel maison-state-panel--error">
                <p className="maison-state-panel__title">Unable to load inventory.</p>
                <p className="maison-state-panel__copy">Please try again in a moment.</p>
                <button
                  type="button"
                  className="maison-button maison-button--quiet maison-state-panel__action"
                  onClick={() => setRetryToken((value) => value + 1)}
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoading && !error && vehicles.length === 0 && (
              <div className="maison-state-panel maison-state-panel--empty">
                <p className="maison-state-panel__title">No vehicles found.</p>
                <p className="maison-state-panel__copy">
                  Try a different make, model, or category.
                </p>
              </div>
            )}

            {!isLoading && !error && vehicles.length > 0 && (
              <div className="maison-inventory-grid">
                {vehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="maison-container maison-footer">
        <span>Maison Motoring / Inventory, considered.</span>
        <span>Est. 2026</span>
      </footer>
    </div>
  );
}
