import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { Writable } from 'node:stream';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { loggerOptions } from '../../src/logger.ts';
import { createTestClock, failWrites } from '../helpers/test-app.ts';

// TASK-07 [adversarial] (CA-32, RNF-03, EC-33): con el logger de la app capturado, ni las líneas de log ni los
// cuerpos de error llevan datos personales. Datos inventados.
const NOW = '2026-10-06T09:00:00.000Z';
const CANDIDATE = {
  fullName: 'Lucía Ferrer Soler',
  email: 'lucia.ferrer@example.com',
  phone: '600 000 001',
  summary: 'Resumen inventado reservado.',
  skills: ['typescript'],
};
const Q_EMAIL = 'lucia.ferrer@example.com';
const Q_LONG = `lucia.ferrer${'x'.repeat(100)}`;
const Q_CONTROL = 'lucia.ferrer\u0007ctl-hostil';
// Texto que no puede salir en ningún log ni cuerpo de error.
const PERSONAL = [
  'Lucía Ferrer Soler',
  'Lucía',
  'lucia.ferrer',
  '600 000 001',
  'Resumen inventado reservado',
  'abc-hostil',
  Q_LONG,
  'ctl-hostil',
];

let app: FastifyInstance;
let db: DatabaseSync;
let lines: string[];

beforeEach(() => {
  lines = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  db = openDatabase(':memory:');
  migrate(db);
  app = buildApp({ db, now: createTestClock(NOW).now, logger: { ...loggerOptions, stream } });
});

afterEach(async () => {
  await app.close();
});

function logs(): string {
  return lines.join('');
}

function expectNoPersonalData(text: string): void {
  for (const personal of PERSONAL) expect(text).not.toContain(personal);
}

function expectErrorBody(response: LightMyRequestResponse, status: number): void {
  expect(response.statusCode).toBe(status);
  expectNoPersonalData(response.body);
  expect(response.body).not.toContain('SQLITE');
  expect(response.body).not.toContain('stack');
}

async function create(body: Record<string, unknown> = CANDIDATE): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url: '/api/candidates', payload: body });
}

describe('logs de candidatos sin datos personales (CA-32, RNF-03)', () => {
  it('CA-32 alta, edición, búsqueda con q=email y consentimiento → logs sin nombre, email, teléfono, resumen ni q', async () => {
    const created = (await create({ ...CANDIDATE, consent: false })).json<{ id: number }>();
    const edit = { fullName: 'Lucía Ferrer Soler', summary: 'Resumen inventado reservado.' };
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/candidates/${created.id}`,
      payload: edit,
    });
    const search = await app.inject({ method: 'GET', url: `/api/candidates?q=${Q_EMAIL}` });
    const give = await app.inject({ method: 'POST', url: `/api/candidates/${created.id}/consent` });
    const withdraw = await app.inject({
      method: 'POST',
      url: `/api/candidates/${created.id}/consent/withdrawal`,
    });

    expect([patched, search, give, withdraw].map((r) => r.statusCode)).toEqual([
      200, 200, 200, 200,
    ]);
    expect(search.json<{ total: number }>().total).toBe(1);
    expectNoPersonalData(logs());
    expect(logs()).not.toContain('?q=');
    expect(logs()).toContain(`"path":"/api/candidates/${created.id}/consent"`);
    expect(logs()).toContain('"path":"/api/candidates"');
  });

  it('CA-32 / CA-04 alta con datos inválidos → 400 sin datos personales en cuerpo ni logs', async () => {
    const responses = await Promise.all([
      create({ ...CANDIDATE, phone: 'abc-hostil-123' }),
      create({ ...CANDIDATE, fullName: 'L', summary: 'x'.repeat(2001) }),
      create({ ...CANDIDATE, [Q_EMAIL]: 'x', retentionEndsAt: '2030-01-01' }),
    ]);

    for (const response of responses) expectErrorBody(response, 400);
    expectNoPersonalData(logs());
    expect(Number(db.prepare('SELECT COUNT(*) AS n FROM candidates').get()?.n)).toBe(0);
  });

  it('CA-32 / CA-05 email duplicado → 409 sin datos personales en cuerpo ni logs', async () => {
    await create();

    const response = await create({ fullName: 'Otra Persona', email: 'LUCIA.FERRER@example.com' });

    expectErrorBody(response, 409);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('DUPLICATE');
    expectNoPersonalData(logs());
  });

  it('CA-32 / CA-06 fallo de la base al guardar → 500, y el log lleva el objeto de error sin datos personales', async () => {
    failWrites(db, 'INSERT', { table: 'candidates' });

    const response = await create();

    expectErrorBody(response, 500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
    });
    expectNoPersonalData(logs());
    const entries = lines.map(
      (line) => JSON.parse(line) as { level: number; err?: { message: string } },
    );
    const errorEntry = entries.find((entry) => entry.level >= 50);
    expect(errorEntry?.err?.message).toContain('fallo simulado');
  });

  it('CA-32 / CA-20 / EC-33 búsquedas inválidas → 400 sin repetir q en cuerpo ni logs', async () => {
    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/api/candidates', query: { q: Q_LONG } }),
      app.inject({ method: 'GET', url: '/api/candidates', query: { q: Q_CONTROL } }),
      app.inject({ method: 'GET', url: '/api/candidates?pageSize=101&q=lucia.ferrer' }),
    ]);

    for (const response of responses) {
      expectErrorBody(response, 400);
      expect(response.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
    }
    expectNoPersonalData(logs());
    expect(logs()).not.toContain('pageSize=');
  });
});

describe('mensajes de error de SQLite (RNF-03)', () => {
  const row = (email: string, fullName: string) =>
    [fullName, email, '2026-10-06T09:00:00.000Z'] as const;
  const insert = 'INSERT INTO candidates (full_name, email, created_at) VALUES (?, ?, ?)';

  it('RNF-03 UNIQUE y CHECK nombran tabla y columna, no el valor recibido', () => {
    db.prepare(insert).run(...row('lucia.ferrer@example.com', 'Lucía Ferrer Soler'));

    const unique = captureMessage(() =>
      db.prepare(insert).run(...row('lucia.ferrer@example.com', 'Otra Persona')),
    );
    const check = captureMessage(() => db.prepare(insert).run(...row('otra@example.com', 'L')));

    expect(unique).toContain('candidates.email');
    expect(check).toContain('full_name');
    for (const message of [unique, check]) {
      expect(message).not.toContain('lucia.ferrer');
      expect(message).not.toContain('Otra Persona');
      expect(message).not.toContain('otra@example.com');
    }
  });
});

function captureMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('La sentencia debía fallar.');
}
