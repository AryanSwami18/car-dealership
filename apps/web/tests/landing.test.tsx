import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppShell } from '../src/AppShell';

describe('public landing page', () => {
  it('provides a labeled primary navigation with an inventory destination', () => {
    render(<AppShell />);

    const navigation = screen.getByRole('navigation', {
      name: /primary navigation/i,
    });

    expect(navigation).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: /inventory/i })).toHaveAttribute(
      'href',
      '/inventory',
    );
  });

  it('presents a hero landmark with one primary heading and inventory action', () => {
    render(<AppShell />);

    const hero = screen.getByRole('region', { name: /hero/i });

    expect(hero).toBeInTheDocument();
    expect(within(hero).getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(within(hero).getByRole('link', { name: /explore inventory/i })).toHaveAttribute(
      'href',
      '/inventory',
    );
  });

  it('exposes the page main landmark and the beginning of featured inventory', () => {
    render(<AppShell />);

    expect(screen.getByRole('main')).toBeInTheDocument();

    const featuredInventory = screen.getByRole('region', {
      name: /featured inventory/i,
    });

    expect(featuredInventory).toBeInTheDocument();
    expect(
      within(featuredInventory).getByRole('heading', {
        level: 2,
        name: /featured inventory/i,
      }),
    ).toBeInTheDocument();
  });
});
