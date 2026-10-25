import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // Keep the monorepo's single root .env as the source for VITE_API_BASE_URL.
  envDir: '../..',
  plugins: [react(), tailwindcss()],
});
