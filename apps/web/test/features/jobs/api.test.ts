import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, BAD_RESPONSE_MESSAGE } from '../../../src/components/http.ts';
import {
  closeJob,
  createJob,
  deleteJob,
  duplicateJob,
  getClosePreview,
  getJob,
  isClosePreview,
  listJobs,
  publishJob,
  updateJob,
} from '../../../src/features/jobs/api.ts';
import { jobPaths, parseJobId } from '../../../src/features/jobs/paths.ts';
import type { Job, JobPage } from '../../../src/features/jobs/types.ts';
import { mockFetch } from '../../helpers/fetch.ts';

const JOB: Job = {
  id: 7,
  title: 'Desarrollador/a backend (Node.js)',
  description: null,
  location: 'Valencia',
  workMode: 'híbrida',
  salaryMin: 32000,
  salaryMax: 40000,
  status: 'draft',
  createdAt: '2026-10-06T22:30:00.000Z',
  publishedAt: null,
  closedAt: null,
  enrollmentDeadline: null,
};

const PAGE: JobPage = {
  items: [{ id: 7, title: JOB.title, status: 'draft', referenceDate: JOB.createdAt }],
  total: 1,
  page: 1,
  pageSize: 20,
};

function summary(mock: ReturnType<typeof mockFetch>) {
  return mock.calls.map(({ method, url, headers, body }) => ({
    method,
    url,
    contentType: headers['content-type'],
    body,
  }));
}

describe('API de ofertas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listJobs llama exactamente a GET /api/jobs, sin parámetros (EC-34)', async () => {
    const mock = mockFetch({ 'GET /api/jobs': { status: 200, json: PAGE } });

    expect(await listJobs([])).toEqual(PAGE);

    expect(summary(mock)).toEqual([
      { method: 'GET', url: '/api/jobs', contentType: undefined, body: undefined },
    ]);
    expect(mock.unmatched).toEqual([]);
  });

  it('listJobs con query llama a la URL exacta en orden canónico', async () => {
    const url = '/api/jobs?status=published&q=gesti%C3%B3n&page=2&pageSize=50';
    const mock = mockFetch({ [`GET ${url}`]: { status: 200, json: PAGE } });

    await listJobs([
      ['pageSize', '50'],
      ['page', '2'],
      ['q', 'gestión'],
      ['status', 'published'],
    ]);

    expect(summary(mock)).toEqual([
      { method: 'GET', url, contentType: undefined, body: undefined },
    ]);
    expect(mock.unmatched).toEqual([]);
  });

  it.each([
    ['publishJob', publishJob, 'publish', 200, 'EC-01'],
    ['closeJob', closeJob, 'close', 200, 'EC-10'],
    ['duplicateJob', duplicateJob, 'duplicate', 201, 'CA-14'],
  ])(
    '%s hace POST /api/jobs/7/%s sin cuerpo ni Content-Type y valida la forma Job (%s %s)',
    async (_name, action, path, status) => {
      const mock = mockFetch({ [`POST /api/jobs/7/${path}`]: { status, json: JOB } });

      expect(await action(7)).toEqual(JOB);

      expect(summary(mock)).toEqual([
        { method: 'POST', url: `/api/jobs/7/${path}`, contentType: undefined, body: undefined },
      ]);
    },
  );

  it.each([
    ['publishJob', publishJob, 'publish'],
    ['closeJob', closeJob, 'close'],
    ['duplicateJob', duplicateJob, 'duplicate'],
  ])(
    '%s con una respuesta que no es un Job → ApiError de respuesta no válida',
    async (_n, action, path) => {
      mockFetch({ [`POST /api/jobs/7/${path}`]: { status: 200, json: { ...JOB, id: 'x' } } });

      const error = await action(7).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe(BAD_RESPONSE_MESSAGE);
    },
  );

  it('las acciones muestran el envelope de un 409 tal cual', async () => {
    mockFetch({
      'POST /api/jobs/7/close': {
        status: 409,
        json: {
          error: {
            code: 'INVALID_TRANSITION',
            message: 'Un borrador no se puede cerrar: publícalo primero.',
          },
        },
      },
    });

    const error = await closeJob(7).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).message).toBe('Un borrador no se puede cerrar: publícalo primero.');
  });

  it('getClosePreview hace GET /api/jobs/{id}/close-preview sin cuerpo', async () => {
    const mock = mockFetch({
      'GET /api/jobs/7/close-preview': { status: 200, json: { activeApplications: 0 } },
    });

    expect(await getClosePreview(7)).toEqual({ activeApplications: 0 });

    expect(summary(mock)).toEqual([
      { method: 'GET', url: '/api/jobs/7/close-preview', contentType: undefined, body: undefined },
    ]);
  });

  it.each([
    ['sin activeApplications', {}],
    ['negativo', { activeApplications: -1 }],
    ['decimal', { activeApplications: 1.5 }],
    ['texto', { activeApplications: '0' }],
    ['null', null],
  ])('getClosePreview con %s → ApiError de respuesta no válida', async (_name, body) => {
    mockFetch({ 'GET /api/jobs/7/close-preview': { status: 200, json: body } });

    const error = await getClosePreview(7).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe(BAD_RESPONSE_MESSAGE);
  });

  it('isClosePreview acepta un entero ≥ 0', () => {
    expect(isClosePreview({ activeApplications: 0 })).toBe(true);
    expect(isClosePreview({ activeApplications: 3 })).toBe(true);
    expect(isClosePreview({ activeApplications: -1 })).toBe(false);
  });

  it('getJob llama a GET /api/jobs/{id} sin cuerpo', async () => {
    const mock = mockFetch({ 'GET /api/jobs/7': { status: 200, json: JOB } });

    expect(await getJob(7)).toEqual(JOB);

    expect(summary(mock)).toEqual([
      { method: 'GET', url: '/api/jobs/7', contentType: undefined, body: undefined },
    ]);
  });

  it('createJob hace POST /api/jobs con el cuerpo en JSON', async () => {
    const mock = mockFetch({ 'POST /api/jobs': { status: 201, json: JOB } });

    await createJob({ title: JOB.title, location: 'Valencia', workMode: 'híbrida' });

    expect(summary(mock)).toEqual([
      {
        method: 'POST',
        url: '/api/jobs',
        contentType: 'application/json',
        body: '{"title":"Desarrollador/a backend (Node.js)","location":"Valencia","workMode":"híbrida"}',
      },
    ]);
  });

  it('updateJob hace PATCH /api/jobs/{id} solo con lo enviado (null vacía)', async () => {
    const mock = mockFetch({ 'PATCH /api/jobs/7': { status: 200, json: JOB } });

    expect(await updateJob(7, { description: null })).toEqual(JOB);

    expect(summary(mock)).toEqual([
      {
        method: 'PATCH',
        url: '/api/jobs/7',
        contentType: 'application/json',
        body: '{"description":null}',
      },
    ]);
  });

  it('deleteJob hace DELETE /api/jobs/{id} sin cuerpo ni Content-Type y devuelve undefined', async () => {
    const mock = mockFetch({ 'DELETE /api/jobs/7': { status: 204 } });

    expect(await deleteJob(7)).toBeUndefined();

    expect(summary(mock)).toEqual([
      { method: 'DELETE', url: '/api/jobs/7', contentType: undefined, body: undefined },
    ]);
  });

  it('una oferta con forma inesperada → ApiError de respuesta no válida', async () => {
    mockFetch({ 'GET /api/jobs/7': { status: 200, json: { ...JOB, status: 'archived' } } });

    const error = await getJob(7).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe(BAD_RESPONSE_MESSAGE);
  });

  it.each([
    ['items no es un array', { ...PAGE, items: 'x' }],
    [
      'un item sin id',
      { ...PAGE, items: [{ title: 'Sin id', status: 'draft', referenceDate: JOB.createdAt }] },
    ],
    ['un item con id negativo', { ...PAGE, items: [{ ...PAGE.items[0], id: -1 }] }],
    ['total no numérico', { ...PAGE, total: '1' }],
    ['total decimal', { ...PAGE, total: 1.5 }],
    ['sin items', { total: 1, page: 1, pageSize: 20 }],
    ['null', null],
    ['un array', []],
  ])('EC-40 isJobPage rechaza una página con %s → ApiError', async (_name, body) => {
    mockFetch({ 'GET /api/jobs': { status: 200, json: body } });

    const error = await listJobs([]).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe(BAD_RESPONSE_MESSAGE);
  });

  it('nunca construye /api/jobs/{id} con un ID no válido', async () => {
    const mock = mockFetch({});

    await expect(getJob(0)).rejects.toThrow(RangeError);
    await expect(deleteJob(1.5)).rejects.toThrow(RangeError);
    await expect(publishJob(0)).rejects.toThrow(RangeError);
    await expect(getClosePreview(-1)).rejects.toThrow(RangeError);

    expect(mock.calls).toEqual([]);
  });
});

describe('rutas de la web', () => {
  it('jobPaths', () => {
    expect([jobPaths.list, jobPaths.create, jobPaths.detail(7), jobPaths.edit(7)]).toEqual([
      '/jobs',
      '/jobs/new',
      '/jobs/7',
      '/jobs/7/edit',
    ]);
  });

  it('parseJobId usa la misma regla que la API', () => {
    expect(parseJobId('7')).toBe(7);
    expect(parseJobId('999999999999999')).toBe(999999999999999);
    for (const text of ['0', '07', 'abc', '1.5', '-1', '', 'new', '1000000000000000']) {
      expect(parseJobId(text)).toBeNull();
    }
  });
});
