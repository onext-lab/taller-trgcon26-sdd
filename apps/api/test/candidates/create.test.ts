import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCandidate } from '../helpers/candidates.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. El alta se fija a 2026-10-06 (Madrid, UTC+2): +6 meses = 2027-04-06 y +24 = 2028-10-06.
const NOW = '2026-10-06T09:00:00.000Z';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

function post(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/candidates', payload });
}

function countRows(): number {
  return Number(db.prepare('SELECT COUNT(*) AS total FROM candidates').get()?.total);
}

let sequence = 0;
/** Cuerpo mínimo válido con un email distinto en cada llamada; `overrides` pisa los campos. */
function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  sequence += 1;
  return { fullName: 'Ana Gil', email: `ana.gil.${sequence}@example.com`, ...overrides };
}

describe('POST /api/candidates — alta', () => {
  it('CA-01 normaliza email y skills, sin consentimiento y con retención alta + 6 meses', async () => {
    const response = await post({
      fullName: 'Lucía Ferrer Soler',
      email: 'Lucia.Ferrer@Example.com ',
      skills: ['TypeScript', 'sql', 'typescript', '   '],
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: 1,
      fullName: 'Lucía Ferrer Soler',
      email: 'lucia.ferrer@example.com',
      phone: null,
      summary: null,
      skills: ['typescript', 'sql'],
      createdAt: NOW,
      consentGivenAt: null,
      consentVersion: null,
      consentWithdrawnAt: null,
      retentionEndsAt: '2027-04-06',
    });
  });

  it('CA-03 con consent: true guarda el reloj y v1, y la retención es consentimiento + 24 meses', async () => {
    const response = await post({
      fullName: 'Lucía Ferrer Soler',
      email: 'lucia.ferrer@example.com',
      consent: true,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      consentGivenAt: NOW,
      consentVersion: 'v1',
      consentWithdrawnAt: null,
      retentionEndsAt: '2028-10-06',
    });
  });

  it('CA-04 con consent: false (o sin él) no registra consentimiento', async () => {
    const explicit = await createCandidate(app, body({ consent: false }));
    const omitted = await createCandidate(app, body());

    for (const candidate of [explicit, omitted]) {
      expect(candidate.consentGivenAt).toBeNull();
      expect(candidate.consentVersion).toBeNull();
      expect(candidate.retentionEndsAt).toBe('2027-04-06');
    }
  });

  it('EC-03 «Íñigo Núñez Peñalver 🎯» se devuelve igual y el email se pasa a minúsculas', async () => {
    const response = await post({
      fullName: 'Íñigo Núñez Peñalver 🎯',
      email: '  Inigo.Nunez@Example.com',
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      fullName: 'Íñigo Núñez Peñalver 🎯',
      email: 'inigo.nunez@example.com',
    });
  });

  it('RGPD: el alta persiste una fila y solo una', async () => {
    await createCandidate(app, body());

    expect(countRows()).toBe(1);
  });
});

describe('POST /api/candidates — fronteras aceptadas (EC-11)', () => {
  it('EC-11 nombre de 2 y de 100 puntos de código, resumen de 2 000 y skill de 40 → 201', async () => {
    const emoji100 = '🎯'.repeat(100);
    const summary = 'ñ'.repeat(2000);
    const skill = 'é🎯'.repeat(20);

    const short = await post(body({ fullName: 'Li' }));
    const long = await post(body({ fullName: emoji100, summary, skills: [skill] }));

    expect(short.statusCode).toBe(201);
    expect(long.statusCode).toBe(201);
    expect(long.json()).toMatchObject({ fullName: emoji100, summary, skills: [skill] });
  });
});

describe('POST /api/candidates — skills (EC-12)', () => {
  const names = (count: number): string[] => Array.from({ length: count }, (_, i) => `skill-${i}`);

  it('EC-12 20 skills → 201', async () => {
    const response = await post(body({ skills: names(20) }));

    expect(response.statusCode).toBe(201);
    expect(response.json<{ skills: string[] }>().skills).toHaveLength(20);
  });

  it('EC-12 21 con duplicado que quedan en 20 tras normalizar → 201', async () => {
    const response = await post(body({ skills: [...names(20), ' SKILL-0 '] }));

    expect(response.statusCode).toBe(201);
    expect(response.json<{ skills: string[] }>().skills).toEqual(names(20));
  });

  it('EC-12 21 skills distintas → 400 en skills', async () => {
    const response = await post(body({ skills: names(21) }));

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual([
      { field: 'skills', message: 'Debe tener como máximo 20 elementos.' },
    ]);
  });

  it('EC-12 sin skills, o solo vacías → []', async () => {
    const omitted = await post(body());
    const blanks = await post(body({ skills: ['', '  '] }));

    expect(omitted.json<{ skills: string[] }>().skills).toEqual([]);
    expect(blanks.json<{ skills: string[] }>().skills).toEqual([]);
  });
});

describe('POST /api/candidates — teléfono (EC-13)', () => {
  it.each(['123456', '+123456', '+34 (600) 000-001', '+12345678901234567890'])(
    'EC-13 «%s» → 201 y se guarda tal cual',
    async (phone) => {
      const response = await post(body({ phone }));

      expect(response.statusCode).toBe(201);
      expect(response.json<{ phone: string }>().phone).toBe(phone);
    },
  );

  it('EC-13 teléfono vacío o solo espacios → null', async () => {
    const response = await post(body({ phone: '   ' }));

    expect(response.statusCode).toBe(201);
    expect(response.json<{ phone: string | null }>().phone).toBeNull();
  });
});
