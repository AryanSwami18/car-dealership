import { loadEnvFile } from 'node:process';

import { defineConfig } from 'vitest/config';

loadEnvFile(new URL('./.env.test', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
