import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppShell } from '../src/AppShell';

describe('frontend testing setup', () => {
  it('can render the React application shell', () => {
    render(<AppShell />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });
});
