import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDatabase } from '../src/db/connection.ts';
import { migrate } from '../src/db/migrate.ts';

describe('GET /api/health', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('responde 200 con { status: "ok" }', async () => {
    const db = openDatabase(':memory:');
    migrate(db);
    app = buildApp({ db });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
