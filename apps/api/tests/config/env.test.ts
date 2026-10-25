import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '../../src/config/env.js';

const validEnvironment = {
  NODE_ENV: 'test',
  API_PORT: '3000',
  DATABASE_URL: 'postgresql://inventory_app:password@localhost:5432/inventory_test',
  JWT_SECRET: 'a-test-secret-that-is-long-enough-for-validation',
  CORS_ORIGINS: 'http://localhost:5173, http://127.0.0.1:5173',
  BODY_SIZE_LIMIT: '100kb',
};

describe('runtime environment configuration', () => {
  it('parses validated configuration without exposing raw secrets', () => {
    expect(validateEnvironment(validEnvironment)).toEqual({
      nodeEnv: 'test',
      port: 3000,
      databaseUrl: validEnvironment.DATABASE_URL,
      jwtSecret: validEnvironment.JWT_SECRET,
      corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      bodySizeLimit: '100kb',
    });
  });

  it('reports missing required variables by name without including secret values', () => {
    const environment = { ...validEnvironment, JWT_SECRET: '' };

    expect(() => validateEnvironment(environment)).toThrow(
      'Missing required environment variable: JWT_SECRET.',
    );
    expect(() => validateEnvironment(environment)).not.toThrow(validEnvironment.DATABASE_URL);
  });

  it('rejects weak JWT secrets and wildcard production CORS', () => {
    expect(() => validateEnvironment({ ...validEnvironment, JWT_SECRET: 'too-short' })).toThrow(
      'JWT_SECRET must be at least 32 characters long.',
    );

    expect(() =>
      validateEnvironment({ ...validEnvironment, NODE_ENV: 'production', CORS_ORIGINS: '*' }),
    ).toThrow('CORS_ORIGINS must contain explicit origins.');
  });

  it('rejects invalid API ports and empty CORS allowlists', () => {
    expect(() => validateEnvironment({ ...validEnvironment, API_PORT: '70000' })).toThrow(
      'API_PORT must be an integer between 1 and 65535.',
    );
    expect(() =>
      validateEnvironment({ ...validEnvironment, NODE_ENV: 'production', CORS_ORIGINS: ' , ' }),
    ).toThrow('CORS_ORIGINS must contain at least one origin.');
  });
});
