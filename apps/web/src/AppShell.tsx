import { useEffect, useState } from 'react';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthRequiredPage, LoginPage, RegisterPage } from './AuthPages';
import { AdminAccessRequiredPage, AdminInventoryPage } from './AdminInventoryPage';
import { InventoryPage } from './InventoryPage';
import { PurchaseHistoryPage } from './PurchaseHistoryPage';
import { VehicleDetailsPage } from './VehicleDetailsPage';

type VehicleArtVariant = 'hero' | 'sage' | 'warm' | 'dark';

type MaisonVehicleArtProps = {
  label: string;
  variant: VehicleArtVariant;
};

function MaisonVehicleArt({ label, variant }: MaisonVehicleArtProps) {
  const sizeClass = variant === 'hero' ? 'maison-vehicle-art--hero' : 'maison-vehicle-art--compact';
  const toneClass = variant === 'hero' ? '' : `maison-vehicle-art--${variant}`;
  const sequence = variant === 'hero' ? '01 / 03' : variant === 'sage' ? '02 / 03' : '03 / 03';

  return (
    <div
      role="img"
      aria-label={label}
      className={`maison-vehicle-art ${sizeClass} ${toneClass}`.trim()}
    >
      <span aria-hidden="true" className="maison-vehicle-art__frame" />
      <span aria-hidden="true" className="maison-vehicle-art__orb" />
      <span aria-hidden="true" className="maison-vehicle-art__shadow" />
      <span aria-hidden="true" className="maison-vehicle-art__body" />
      <span
        aria-hidden="true"
        className="maison-vehicle-art__wheel maison-vehicle-art__wheel--left"
      />
      <span
        aria-hidden="true"
        className="maison-vehicle-art__wheel maison-vehicle-art__wheel--right"
      />
      <span aria-hidden="true" className="maison-vehicle-art__label">
        {variant === 'hero' ? 'Studio selection' : 'Maison edit'}
      </span>
      <span aria-hidden="true" className="maison-vehicle-art__footer">
        <span>{sequence}</span>
        <span>{variant === 'hero' ? 'Drive differently' : 'Considered motion'}</span>
      </span>
    </div>
  );
}

const featuredEdits: Array<{
  number: string;
  title: string;
  description: string;
  label: string;
  variant: VehicleArtVariant;
}> = [
  {
    number: '01',
    title: 'Low-mileage finds',
    description: 'Quiet confidence, carefully sourced.',
    label: 'Abstract studio vehicle study for low-mileage finds',
    variant: 'sage',
  },
  {
    number: '02',
    title: 'Daily icons',
    description: 'The ones you will want to keep.',
    label: 'Abstract studio vehicle study for daily icons',
    variant: 'warm',
  },
  {
    number: '03',
    title: 'Road-ready stories',
    description: 'Built for wherever next takes you.',
    label: 'Abstract studio vehicle study for road-ready stories',
    variant: 'dark',
  },
];

function getVehicleIdFromPath(pathname: string) {
  const match = pathname.match(/^\/vehicles\/([^/]+)\/?$/);
  const vehicleId = match?.[1];

  return vehicleId ? decodeURIComponent(vehicleId) : null;
}

function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => setPathname(window.location.pathname);

    window.addEventListener('popstate', handleLocationChange);

    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  return pathname;
}

function AppRoutes() {
  const pathname = usePathname();
  const { isAdmin, isAuthenticated } = useAuth();
  const vehicleId = getVehicleIdFromPath(pathname);

  if (pathname === '/register') {
    return <RegisterPage />;
  }

  if (pathname === '/login') {
    return <LoginPage />;
  }

  if (
    (pathname === '/inventory' ||
      pathname === '/purchases' ||
      pathname === '/admin/inventory' ||
      vehicleId) &&
    !isAuthenticated
  ) {
    return <AuthRequiredPage />;
  }

  if (pathname === '/admin/inventory' && !isAdmin) {
    return <AdminAccessRequiredPage />;
  }

  if (vehicleId) {
    return <VehicleDetailsPage vehicleId={vehicleId} />;
  }

  if (pathname === '/inventory') {
    return <InventoryPage />;
  }

  if (pathname === '/purchases') {
    return <PurchaseHistoryPage />;
  }

  if (pathname === '/admin/inventory') {
    return <AdminInventoryPage />;
  }

  return (
    <div data-testid="app-shell" className="maison-page">
      <header className="maison-container maison-header">
        <a href="/" aria-label="Maison Motoring home" className="maison-brand">
          <span className="maison-mark">M/01</span>
          <span>Maison Motoring</span>
        </a>

        <nav aria-label="Primary navigation" className="maison-nav">
          <a href="/inventory" className="maison-nav-link">
            Inventory
          </a>
          <a href="#featured-inventory" className="maison-nav-link">
            The edit
          </a>
        </nav>

        <a href="/inventory" className="maison-button maison-button--quiet hidden sm:inline-flex">
          View collection
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main>
        <section aria-label="Hero" className="maison-container maison-hero">
          <div className="maison-hero-copy">
            <p className="maison-eyebrow">A considered collection / 2026</p>
            <h1 id="hero-heading" className="maison-hero-heading">
              Drive something <strong>worth remembering.</strong>
            </h1>
            <p className="maison-hero-intro">
              Rare finds, everyday icons, and the right car for the road ahead. Explore a collection
              chosen with a little more intention.
            </p>
            <a
              href="/inventory"
              className="maison-button maison-button--primary motion-safe:transition mt-10"
            >
              Explore Inventory
              <span aria-hidden="true" className="text-lg">
                ↗
              </span>
            </a>
          </div>

          <MaisonVehicleArt label="Studio vehicle study" variant="hero" />
        </section>

        <section
          id="featured-inventory"
          aria-labelledby="featured-inventory-heading"
          className="maison-container maison-section maison-section--rule"
        >
          <div className="maison-section-heading">
            <div>
              <p className="maison-eyebrow">The first edit</p>
              <h2 id="featured-inventory-heading" className="maison-section-title">
                Featured inventory
              </h2>
            </div>
            <p className="maison-section-copy">
              A small beginning to a thoughtful collection. Every vehicle gets its own story,
              details, and space to be considered.
            </p>
            <a href="/inventory" className="maison-link">
              Browse all vehicles
              <span aria-hidden="true" className="text-lg">
                ↗
              </span>
            </a>
          </div>

          <div className="maison-feature-grid">
            {featuredEdits.map((edit) => (
              <article key={edit.number} className="maison-feature-card">
                <a href="/inventory" aria-label={`Explore ${edit.title}`}>
                  <MaisonVehicleArt label={edit.label} variant={edit.variant} />
                  <p className="maison-feature-number">{edit.number}</p>
                  <h3>{edit.title}</h3>
                  <p>{edit.description}</p>
                </a>
              </article>
            ))}
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

export function AppShell() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
