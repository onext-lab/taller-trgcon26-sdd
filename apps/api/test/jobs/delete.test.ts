import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJob, createTestApp, createTestClock, failWrites } from '../helpers/test-app.ts';

// Datos inventados. Los casos hostiles del DELETE (ID no válido, segundo DELETE, fallo de SQLite) van en TASK-07.
const NOW = '2026-10-06T22:30:00.000Z';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

// Sin `payload` ni `Content-Type`: Fastify da 400 a un JSON con cuerpo vacío.
function deleteJob(id: number) {
  return app.inject({ method: 'DELETE', url: `/api/jobs/${id}` });
}

describe('DELETE /api/jobs/:id — borrado (camino feliz)', () => {
  it('CA-13 204 sin cuerpo y después GET → 404', async () => {
    const kept = await createJob(app, { title: 'Recruiter junior' });
    const created = await createJob(app, { title: 'Recruiter senior', location: 'Murcia' });

    const response = await deleteJob(created.id);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    const after = await app.inject({ method: 'GET', url: `/api/jobs/${created.id}` });
    expect(after.statusCode).toBe(404);
    expect(after.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'La oferta no existe.' },
    });
    // Solo se borra la indicada.
    expect((await app.inject({ method: 'GET', url: `/api/jobs/${kept.id}` })).statusCode).toBe(200);
  });

  it('EC-28 borrar el único deja el listado vacío', async () => {
    const created = await createJob(app, { title: 'Técnico/a de formación' });

    expect((await deleteJob(created.id)).statusCode).toBe(204);

    const list = await app.inject({ method: 'GET', url: '/api/jobs' });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('DD-07 un ID borrado no se reutiliza', async () => {
    await createJob(app, { title: 'Oferta inventada uno' });
    const last = await createJob(app, { title: 'Oferta inventada dos' });

    expect((await deleteJob(last.id)).statusCode).toBe(204);
    const next = await createJob(app, { title: 'Oferta inventada tres' });

    expect(next.id).toBeGreaterThan(last.id);
  });
});

describe('DELETE /api/jobs/:id — adversarial', () => {
  it.each(['abc', '0', '007', '1.5', '1234567890123456'])(
    'EC-27 DELETE /api/jobs/%s → 400',
    async (id) => {
      const created = await createJob(app, { title: 'Oferta que debe sobrevivir' });

      const response = await app.inject({ method: 'DELETE', url: `/api/jobs/${id}` });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Hay campos con errores.',
          details: [{ field: 'id', message: 'Formato no válido.' }],
        },
      });
      expect((await app.inject({ method: 'GET', url: `/api/jobs/${created.id}` })).statusCode).toBe(
        200,
      );
    },
  );

  it('EC-29 fallo de SQLite al borrar → 500 y sigue', async () => {
    const created = await createJob(app, { title: 'Oferta con borrado fallido' });
    failWrites(db, 'DELETE');

    const response = await deleteJob(created.id);

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
    });
    expect(response.body).not.toContain('fallo simulado');
    const after = await app.inject({ method: 'GET', url: `/api/jobs/${created.id}` });
    expect(after.statusCode).toBe(200);
    expect(after.json()).toMatchObject({ id: created.id, title: 'Oferta con borrado fallido' });
  });

  it('CA-14/EC-33 segundo DELETE → 404 en el envelope', async () => {
    const kept = await createJob(app, { title: 'Oferta que se queda', location: 'Sevilla' });
    const created = await createJob(app, { title: 'Oferta que se borra' });
    const keptBefore = await app.inject({ method: 'GET', url: `/api/jobs/${kept.id}` });

    expect((await deleteJob(created.id)).statusCode).toBe(204);
    const second = await deleteJob(created.id);

    expect(second.statusCode).toBe(404);
    expect(second.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'La oferta no existe.' },
    });
    const keptAfter = await app.inject({ method: 'GET', url: `/api/jobs/${kept.id}` });
    expect(keptAfter.json()).toEqual(keptBefore.json());
  });
});
