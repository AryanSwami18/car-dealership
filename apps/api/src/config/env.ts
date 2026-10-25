import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigins: string[];
  bodySizeLimit: string;
};

type Environment = Record<string, string | undefined>;

const DEFAULT_DEVELOPMENT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const DEFAULT_BODY_SIZE_LIMIT = '100kb';

function requiredValue(environment: Environment, key: string) {
  const value = environment[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}.`);
  }

  return value;
}

function parsePort(value: string) {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parseCorsOrigins(value: string | undefined, nodeEnv: AppConfig['nodeEnv']) {
  const origins = value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins?.length) {
    if (nodeEnv !== 'production') {
      return DEFAULT_DEVELOPMENT_ORIGINS;
    }

    throw new Error('CORS_ORIGINS must contain at least one origin.');
  }

  if (origins.includes('*')) {
    throw new Error('CORS_ORIGINS must contain explicit origins.');
  }

  for (const origin of origins) {
    try {
      const parsedOrigin = new URL(origin);
      if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.pathname !== '/') {
        throw new Error();
      }
    } catch {
      throw new Error('CORS_ORIGINS must contain valid HTTP or HTTPS origins.');
    }
  }

  return origins;
}

export function validateEnvironment(environment: Environment): AppConfig {
  const rawNodeEnv = environment.NODE_ENV?.trim() || 'development';
  if (!['development', 'test', 'production'].includes(rawNodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const nodeEnv = rawNodeEnv as AppConfig['nodeEnv'];
  const databaseUrl = requiredValue(environment, 'DATABASE_URL');
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }

  const jwtSecret = requiredValue(environment, 'JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }

  const bodySizeLimit = environment.BODY_SIZE_LIMIT?.trim() || DEFAULT_BODY_SIZE_LIMIT;
  if (!/^\d+(?:\.\d+)?\s*(?:b|kb|mb)$/i.test(bodySizeLimit)) {
    throw new Error('BODY_SIZE_LIMIT must be a size such as 100kb or 1mb.');
  }

  return {
    nodeEnv,
    port: parsePort(requiredValue(environment, 'API_PORT')),
    databaseUrl,
    jwtSecret,
    corsOrigins: parseCorsOrigins(environment.CORS_ORIGINS, nodeEnv),
    bodySizeLimit,
  };
}

function loadDevelopmentEnvironment() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const envFile = new URL('../../../.env', import.meta.url);
  if (existsSync(fileURLToPath(envFile))) {
    loadEnvFile(envFile);
  }
}

export function loadConfig() {
  loadDevelopmentEnvironment();
  return validateEnvironment(process.env);
}
