import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { app } from '../src/app.js';

describe('backend testing setup', () => {
  it('can exercise the Express application with Supertest', async () => {
    const response = await request(app).get('/not-configured');

    expect(response.status).toBe(404);
  });
});
