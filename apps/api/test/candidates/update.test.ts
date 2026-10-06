import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCandidate } from '../helpers/candidates.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. El alta se fija a 2026-10-06 (Madrid, UTC+2): sin consentimiento la retención es 2027-04-06.
const NOW = '2026-10-06T09:00:00.000Z';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

function patch(id: number | string, payload: unknown) {
  return app.inject({ method: 'PATCH', url: `/api/candidates/${id}`, payload: payload as object });
}

function getCandidate(id: number) {
  return app.inject({ method: 'GET', url: `/api/candidates/${id}` });
}

function seed(overrides: Record<string, unknown> = {}) {
  return createCandidate(app, {
    fullName: 'Lucía Ferrer Soler',
    email: 'lucia.ferrer@example.com',
    phone: '+34 600 000 000',
    summary: 'Resumen inicial.',
    skills: ['typescript'],
    ...overrides,
  });
}

describe('PATCH /api/candidates/:id — edición correcta', () => {
  it('CA-07 cambia teléfono, resumen y skills normalizados sin tocar retención ni consentimiento', async () => {
    const created = await seed();

    const response = await patch(created.id, {
      phone: ' +34 600 000 001 ',
      summary: '  Resumen nuevo.  ',
      skills: ['SQL', 'Python'],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...created,
      phone: '+34 600 000 001',
      summary: 'Resumen nuevo.',
      skills: ['sql', 'python'],
    });
    expect(response.json()).toMatchObject({
      retentionEndsAt: '2027-04-06',
      consentGivenAt: null,
      consentVersion: null,
      consentWithdrawnAt: null,
    });
  });

  it('CA-08 un email libre se normaliza a minúsculas y sin espacios', async () => {
    const created = await seed();

    const response = await patch(created.id, { email: ' Nuevo.Correo@Example.com ' });

    expect(response.statusCode).toBe(200);
    expect(response.json().email).toBe('nuevo.correo@example.com');
  });

  it('CA-09 el propio email con otra forma no choca consigo mismo', async () => {
    const created = await seed({ email: 'jose.ruiz@example.com' });

    const response = await patch(created.id, { email: ' Jose.Ruiz@Example.com' });

    expect(response.statusCode).toBe(200);
    expect(response.json().email).toBe('jose.ruiz@example.com');
  });

  it('CA-10 / EC-26 repetir el mismo PATCH, o enviarlo sin cambios reales, deja la ficha idéntica', async () => {
    const created = await seed({ consent: true });
    const body = { phone: '+34 600 000 009', skills: ['go'] };

    const first = await patch(created.id, body);
    const second = await patch(created.id, body);
    const unchanged = await patch(created.id, { fullName: created.fullName });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(unchanged.statusCode).toBe(200);
    expect(unchanged.json()).toEqual(first.json());
    expect(second.json()).toMatchObject({
      consentGivenAt: NOW,
      consentVersion: 'v1',
      consentWithdrawnAt: null,
      retentionEndsAt: '2028-10-06',
    });
  });

  it('CA-11 un resumen de 2 000 caracteres se acepta', async () => {
    const created = await seed();

    const response = await patch(created.id, { summary: 'a'.repeat(2000) });

    expect(response.statusCode).toBe(200);
    expect(response.json().summary).toHaveLength(2000);
  });

  it('EC-21 teléfono vacío, resumen en blanco y skills vacías pasan a null, null y []', async () => {
    const created = await seed({ consent: true });

    const response = await patch(created.id, { phone: '', summary: '   ', skills: [] });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...created, phone: null, summary: null, skills: [] });
  });

  it('EC-24 no recalcula la retención: una NULL puesta por SQL sigue null tras el PATCH', async () => {
    const created = await seed();
    db.prepare('UPDATE candidates SET retention_ends_at = NULL WHERE id = ?').run(created.id);

    const response = await patch(created.id, { fullName: 'Lucía Ferrer' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ fullName: 'Lucía Ferrer', retentionEndsAt: null });
  });

  it('EC-38 un GET posterior devuelve lo último escrito', async () => {
    const created = await seed();

    await patch(created.id, { summary: 'Primero.' });
    await patch(created.id, { summary: 'Último.' });
    const response = await getCandidate(created.id);

    expect(response.json().summary).toBe('Último.');
  });
});

describe('PATCH /api/candidates/:id — rechazos', () => {
  it('CA-11 resumen de 2 001, nombre vacío o retentionEndsAt → 400 en su campo y la ficha no cambia', async () => {
    const created = await seed();
    const cases: [Record<string, unknown>, string, string][] = [
      [{ summary: 'a'.repeat(2001) }, 'summary', 'Debe tener como máximo 2000 caracteres.'],
      [{ fullName: '' }, 'fullName', 'Debe tener al menos 2 caracteres.'],
      [{ retentionEndsAt: '2030-01-01' }, 'retentionEndsAt', 'Campo no permitido.'],
    ];

    for (const [payload, field, message] of cases) {
      const response = await patch(created.id, payload);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
      expect(response.json().error.details).toEqual([{ field, message }]);
    }
    expect((await getCandidate(created.id)).json()).toEqual(created);
  });

  it('CA-12 el email de otro candidato → 409 DUPLICATE con su existingId y sin el email', async () => {
    const other = await seed({ email: 'otra.persona@example.com' });
    const created = await seed({ email: 'lucia.ferrer@example.com' });

    const response = await patch(created.id, { email: 'Otra.Persona@Example.com' });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('DUPLICATE');
    expect(response.json().error.details).toEqual([
      { field: 'email', message: 'Ya existe un candidato con este email.', existingId: other.id },
    ]);
    expect(response.body).not.toContain('otra.persona@example.com');
    expect((await getCandidate(created.id)).json().email).toBe('lucia.ferrer@example.com');
  });

  it('CA-13 un ID inexistente → 404 sin datos', async () => {
    const response = await patch(999, { fullName: 'Nadie Aquí' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'El candidato no existe.' },
    });
  });

  it('EC-20 un ID no numérico → 400 en id', async () => {
    const response = await patch('abc', { fullName: 'Nadie Aquí' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual([
      { field: 'id', message: expect.any(String) as string },
    ]);
  });

  it('EC-19 cuerpo vacío → 400 «Envía al menos un campo.» y la ficha no cambia', async () => {
    const created = await seed();

    const response = await patch(created.id, {});

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual([
      { field: 'body', message: 'Envía al menos un campo.' },
    ]);
    expect((await getCandidate(created.id)).json()).toEqual(created);
  });

  it('EC-19 consent, createdAt, id o retentionEndsAt → 400 con su nombre y la ficha no cambia', async () => {
    const created = await seed();
    const forbidden: Record<string, unknown> = {
      consent: true,
      createdAt: '2020-01-01T00:00:00.000Z',
      id: 77,
      retentionEndsAt: '2030-01-01',
    };

    for (const [field, value] of Object.entries(forbidden)) {
      const response = await patch(created.id, { fullName: 'Otro Nombre', [field]: value });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.details).toEqual([{ field, message: 'Campo no permitido.' }]);
    }
    expect((await getCandidate(created.id)).json()).toEqual(created);
  });

  it('EC-19 fullName o email a null → 400 en su campo', async () => {
    const created = await seed();

    for (const field of ['fullName', 'email']) {
      const response = await patch(created.id, { [field]: null });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.details).toEqual([
        { field, message: expect.any(String) as string },
      ]);
    }
  });
});
