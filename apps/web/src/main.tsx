import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppShell } from './AppShell';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element is missing.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
