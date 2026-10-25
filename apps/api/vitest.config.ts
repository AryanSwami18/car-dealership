import { loadEnvFile } from 'node:process';

import { defineConfig } from 'vitest/config';

loadEnvFile(new URL('./.env.test', import.meta.url));
process.env.NODE_ENV ??= 'test';
process.env.CORS_ORIGINS ??= 'http://localhost:5173,http://127.0.0.1:5173';
process.env.BODY_SIZE_LIMIT ??= '100kb';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // API tests share the dedicated PostgreSQL database and clean up their own records.
    fileParallelism: false,
  },
});
