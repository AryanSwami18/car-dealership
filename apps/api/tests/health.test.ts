import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { app } from '../src/app.js';

describe('health and HTTP boundary', () => {
  it('returns a lightweight safe health response', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(JSON.stringify(response.body)).not.toMatch(/secret|password|database|token|stack/i);
  });

  it('allows configured local origins and answers preflight requests', async () => {
    const response = await request(app)
      .options('/api/vehicles')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-methods']).toMatch(/GET/);
    expect(response.headers['access-control-allow-headers']).toMatch(/Authorization/);
  });

  it('rejects disallowed origins without allowing arbitrary CORS access', async () => {
    const response = await request(app)
      .options('/api/vehicles')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBe(403);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Origin is not allowed.',
      },
    });
  });

  it('returns safe JSON for malformed JSON request bodies', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON.',
      },
    });
    expect(response.body).not.toHaveProperty('stack');
  });
});
