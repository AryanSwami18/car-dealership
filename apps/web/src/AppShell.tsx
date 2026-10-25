import { useEffect, useState } from 'react';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthRequiredPage, LoginPage, RegisterPage } from './AuthPages';
import { InventoryPage } from './InventoryPage';
import { VehicleDetailsPage } from './VehicleDetailsPage';

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
  const { isAuthenticated } = useAuth();
  const vehicleId = getVehicleIdFromPath(pathname);

  if (pathname === '/register') {
    return <RegisterPage />;
  }

  if (pathname === '/login') {
    return <LoginPage />;
  }

  if ((pathname === '/inventory' || vehicleId) && !isAuthenticated) {
    return <AuthRequiredPage />;
  }

  if (vehicleId) {
    return <VehicleDetailsPage vehicleId={vehicleId} />;
  }

  if (pathname === '/inventory') {
    return <InventoryPage />;
  }

  return (
    <div
      data-testid="app-shell"
      className="min-h-screen overflow-x-hidden bg-[#F4F1EA] text-[#171717]"
    >
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-6 lg:px-12">
        <a
          href="/"
          aria-label="Maison Motoring home"
          className="group flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em]"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-[#171717] text-[10px] tracking-normal text-[#F4F1EA] transition-transform duration-300 group-hover:rotate-12">
            M/01
          </span>
          <span>Maison Motoring</span>
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.16em] md:flex"
        >
          <a
            href="/inventory"
            className="transition-colors duration-200 hover:text-[#E56B45] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
          >
            Inventory
          </a>
          <a
            href="#featured-inventory"
            className="transition-colors duration-200 hover:text-[#E56B45] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
          >
            The edit
          </a>
        </nav>

        <a
          href="/inventory"
          className="hidden items-center gap-2 rounded-full border border-[#171717]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-200 hover:border-[#171717] hover:bg-[#171717] hover:text-[#F4F1EA] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45] sm:flex"
        >
          View collection
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main>
        <section
          aria-label="Hero"
          className="mx-auto grid max-w-[1440px] gap-12 px-6 pb-24 pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-center lg:gap-16 lg:px-12 lg:pb-36 lg:pt-20"
        >
          <div className="max-w-3xl">
            <p className="mb-8 text-xs font-semibold uppercase tracking-[0.24em] text-[#E56B45]">
              A considered collection / 2026
            </p>
            <h1
              id="hero-heading"
              className="max-w-4xl font-display text-[clamp(3.5rem,8vw,8.5rem)] leading-[0.88] tracking-[-0.065em]"
            >
              Drive something <span className="text-[#E56B45]">worth remembering.</span>
            </h1>
            <p className="mt-10 max-w-md text-base leading-7 text-[#171717]/65 sm:text-lg">
              Rare finds, everyday icons, and the right car for the road ahead. Explore a collection
              chosen with a little more intention.
            </p>
            <a
              href="/inventory"
              className="group mt-10 inline-flex items-center gap-4 rounded-full bg-[#171717] px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#F4F1EA] transition-[background-color,transform] duration-300 hover:-translate-y-1 hover:bg-[#E56B45] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
            >
              Explore Inventory
              <span
                aria-hidden="true"
                className="text-lg transition-transform duration-300 group-hover:translate-x-1"
              >
                ↗
              </span>
            </a>
          </div>

          <div
            aria-hidden="true"
            className="relative min-h-[440px] overflow-hidden rounded-[2rem] bg-[#A8B5A0] p-5 sm:min-h-[560px] lg:min-h-[640px]"
          >
            <div className="absolute inset-5 rounded-[1.5rem] border border-[#F4F1EA]/50" />
            <div className="absolute -right-16 top-16 size-72 rounded-full bg-[#E56B45]/80 blur-3xl" />
            <div className="absolute -bottom-24 -left-12 size-80 rounded-full bg-[#171717]/80 blur-3xl" />
            <div className="absolute inset-x-10 bottom-20 h-36 rounded-[50%] bg-[#171717]/80 blur-xl" />
            <div className="absolute bottom-28 left-1/2 h-40 w-[78%] -translate-x-1/2 -skew-x-12 rounded-[45%_55%_20%_20%] border-2 border-[#F4F1EA]/80 bg-[#171717] shadow-2xl shadow-[#171717]/50" />
            <div className="absolute bottom-32 left-[22%] size-16 rounded-full border-8 border-[#171717] bg-[#F4F1EA] shadow-inner" />
            <div className="absolute bottom-32 right-[22%] size-16 rounded-full border-8 border-[#171717] bg-[#F4F1EA] shadow-inner" />
            <div className="absolute left-10 top-10 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#171717]/70">
              <span className="size-2 rounded-full bg-[#E56B45]" />
              Studio selection
            </div>
            <div className="absolute bottom-10 left-10 right-10 flex items-end justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[#F4F1EA]">
              <span>01 / 03</span>
              <span>Drive differently</span>
            </div>
          </div>
        </section>

        <section
          id="featured-inventory"
          aria-labelledby="featured-inventory-heading"
          className="mx-auto max-w-[1440px] border-t border-[#171717]/15 px-6 py-20 lg:px-12 lg:py-28"
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr_auto] lg:items-end lg:gap-12">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#E56B45]">
                The first edit
              </p>
              <h2
                id="featured-inventory-heading"
                className="font-display text-5xl leading-none tracking-[-0.05em] sm:text-7xl"
              >
                Featured inventory
              </h2>
            </div>
            <p className="max-w-sm text-base leading-7 text-[#171717]/65">
              A small beginning to a thoughtful collection. Every vehicle gets its own story,
              details, and space to be considered.
            </p>
            <a
              href="/inventory"
              className="inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em] underline decoration-[#E56B45] decoration-2 underline-offset-8 transition-colors duration-200 hover:text-[#E56B45] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
            >
              Browse all vehicles
              <span aria-hidden="true" className="text-lg">
                ↗
              </span>
            </a>
          </div>

          <div className="mt-16 grid gap-4 border-t border-[#171717]/15 pt-5 sm:grid-cols-3">
            {[
              ['01', 'Low-mileage finds', 'Quiet confidence, carefully sourced.'],
              ['02', 'Daily icons', 'The ones you will want to keep.'],
              ['03', 'Road-ready stories', 'Built for wherever next takes you.'],
            ].map(([number, title, description]) => (
              <article
                key={number}
                className="group border-b border-[#171717]/15 pb-6 sm:border-b-0 sm:border-r sm:pr-6 last:border-0"
              >
                <p className="mb-12 text-xs font-semibold tracking-[0.18em] text-[#E56B45]">
                  {number}
                </p>
                <h3 className="font-display text-3xl tracking-[-0.04em] transition-colors duration-200 group-hover:text-[#E56B45]">
                  {title}
                </h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-[#171717]/60">{description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-4 border-t border-[#171717]/15 px-6 py-8 text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55 sm:flex-row sm:items-center sm:justify-between lg:px-12">
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
