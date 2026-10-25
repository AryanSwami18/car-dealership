import { loadEnvFile } from 'node:process';

import { defineConfig } from 'vitest/config';

loadEnvFile(new URL('./.env.test', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // API tests share the dedicated PostgreSQL database and clean up their own records.
    fileParallelism: false,
  },
});
