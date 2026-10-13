import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTransaction } from '../../src/db/transaction.ts';
import { noJobApplications } from '../../src/modules/jobs/applications-port.ts';
import { createJobsRepository, type JobsRepository } from '../../src/modules/jobs/repository.ts';
import { createJobsService } from '../../src/modules/jobs/service.ts';
import type { Job, JobStatus } from '../../src/modules/jobs/schemas.ts';
import {
  closeJob,
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
} from '../helpers/test-app.ts';

// Datos inventados. SEC-02 (HU-04 TASK-02): la guarda de estado también en el SQL de edición y de borrado.
const NOW = '2026-10-06T22:30:00.000Z';
const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'La oferta no existe.' } };
const STATE_CHANGED = 'El estado de la oferta ha cambiado: recarga e inténtalo de nuevo.';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

function patchJob(id: number, payload: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: `/api/jobs/${id}`, payload });
}

// Sin `payload` ni `Content-Type`: Fastify da 400 a un JSON con cuerpo vacío.
function deleteJob(id: number) {
  return app.inject({ method: 'DELETE', url: `/api/jobs/${id}` });
}

function conflict(message: string) {
  return { error: { code: 'INVALID_TRANSITION', message } };
}

// Regresión de las respuestas de ofertas (paso 1 de TASK-02): se escribió y pasó en verde ANTES de tocar el SQL.
describe('regresión de las respuestas de edición y borrado de ofertas', () => {
  it('PATCH de un borrador → 200 con el Job completo', async () => {
    const draft = await createJob(app, { title: 'Analista de selección', location: 'Murcia' });

    const response = await patchJob(draft.id, { title: 'Analista senior', salaryMin: 28000 });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: draft.id,
      title: 'Analista senior',
      description: null,
      location: 'Murcia',
      workMode: null,
      salaryMin: 28000,
      salaryMax: null,
      status: 'draft',
      createdAt: NOW,
      publishedAt: null,
      closedAt: null,
      enrollmentDeadline: null,
    });
  });

  it('PATCH de una publicada → 200 con el Job completo', async () => {
    const published = await createPublishedJob(app);

    const response = await patchJob(published.id, { location: 'Sevilla' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: published.id,
      title: 'Técnica/o de selección',
      description: 'Descripción inventada del puesto.',
      location: 'Sevilla',
      workMode: 'híbrida',
      salaryMin: 32000,
      salaryMax: 40000,
      status: 'published',
      createdAt: NOW,
      publishedAt: NOW,
      closedAt: null,
      enrollmentDeadline: null,
    });
  });

  it('PATCH de una cerrada → 409 INVALID_TRANSITION', async () => {
    const closed = await closeJob(app, (await createPublishedJob(app)).id);

    const response = await patchJob(closed.id, { title: 'Intento de edición' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(conflict('Una oferta cerrada no se puede editar.'));
  });

  it('DELETE de un borrador → 204', async () => {
    const draft = await createJob(app, { title: 'Borrador desechable' });

    const response = await deleteJob(draft.id);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it('DELETE de una publicada → 409 «publicada»', async () => {
    const published = await createPublishedJob(app);

    const response = await deleteJob(published.id);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(conflict('Una oferta publicada no se puede borrar.'));
  });

  it('DELETE de una cerrada → 409 «cerrada»', async () => {
    const closed = await closeJob(app, (await createPublishedJob(app)).id);

    const response = await deleteJob(closed.id);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(conflict('Una oferta cerrada no se puede borrar.'));
  });

  it('PATCH de una inexistente → 404', async () => {
    const response = await patchJob(9999, { title: 'No existe' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
  });

  it('DELETE de una inexistente → 404', async () => {
    const response = await deleteJob(9999);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
  });
});

const EDIT_FIELDS = {
  title: 'Título nuevo',
  description: 'Descripción nueva.',
  location: 'Bilbao',
  workMode: 'remota',
  salaryMin: 20000,
  salaryMax: 30000,
  enrollmentDeadline: null,
} as const;

/** Servicio con las dependencias de `buildApp`, sobre un repositorio real cuyo `findById` miente sobre el estado. */
function serviceSeeing(repository: JobsRepository, status: JobStatus) {
  const lying: JobsRepository = {
    ...repository,
    findById: (id) => {
      const job = repository.findById(id);
      return job && { ...job, status };
    },
  };
  return createJobsService({
    repository: lying,
    now: createTestClock(NOW).now,
    transaction: (fn) => withTransaction(db, fn),
    applications: noJobApplications,
  });
}

describe('CA-22 la guarda de estado también está en el SQL', () => {
  it('CA-22 el repositorio no edita una cerrada: undefined y la fila intacta', async () => {
    const closed = await closeJob(app, (await createPublishedJob(app)).id);
    const repository = createJobsRepository(db);
    const before = repository.findById(closed.id);

    expect(repository.update(closed.id, EDIT_FIELDS)).toBeUndefined();

    expect(repository.findById(closed.id)).toEqual(before);
  });

  it('CA-22 el repositorio no borra una publicada: 0 filas y la fila intacta', async () => {
    const published = await createPublishedJob(app);
    const repository = createJobsRepository(db);
    const before = repository.findById(published.id);

    expect(repository.deleteById(published.id)).toBe(0);

    expect(repository.findById(published.id)).toEqual(before);
  });

  it('CA-22 el repositorio sí edita borradores y publicadas, y borra borradores', async () => {
    const repository = createJobsRepository(db);
    const draft = await createJob(app, { title: 'Borrador' });
    const published = await createPublishedJob(app);

    expect(repository.update(draft.id, EDIT_FIELDS)?.title).toBe('Título nuevo');
    expect(repository.update(published.id, EDIT_FIELDS)?.location).toBe('Bilbao');
    expect(repository.deleteById(draft.id)).toBe(1);
  });

  it('CA-22 update con estado leído obsoleto (published, en la base closed) → 409 y sin cambios', async () => {
    const closed = await closeJob(app, (await createPublishedJob(app)).id);
    const before = createJobsRepository(db).findById(closed.id);
    const service = serviceSeeing(createJobsRepository(db), 'published');

    expect(() => service.update(closed.id, { title: 'Edición tardía' })).toThrowError(
      expect.objectContaining({
        code: 'INVALID_TRANSITION',
        statusCode: 409,
        message: STATE_CHANGED,
      }),
    );

    expect(createJobsRepository(db).findById(closed.id)).toEqual(before);
  });

  it('CA-22 remove con estado leído obsoleto (draft, en la base published) → 409 y sin cambios', async () => {
    const published: Job = await createPublishedJob(app);
    const service = serviceSeeing(createJobsRepository(db), 'draft');

    expect(() => service.remove(published.id)).toThrowError(
      expect.objectContaining({
        code: 'INVALID_TRANSITION',
        statusCode: 409,
        message: STATE_CHANGED,
      }),
    );

    expect(createJobsRepository(db).findById(published.id)).toEqual(published);
  });
});
