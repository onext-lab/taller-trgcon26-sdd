import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, BAD_RESPONSE_MESSAGE } from '../../../src/components/http.ts';
import {
  createJob,
  deleteJob,
  getJob,
  listJobs,
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

    expect(await listJobs()).toEqual(PAGE);

    expect(summary(mock)).toEqual([
      { method: 'GET', url: '/api/jobs', contentType: undefined, body: undefined },
    ]);
    expect(mock.unmatched).toEqual([]);
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

  it('nunca construye /api/jobs/{id} con un ID no válido', async () => {
    const mock = mockFetch({});

    await expect(getJob(0)).rejects.toThrow(RangeError);
    await expect(deleteJob(1.5)).rejects.toThrow(RangeError);

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
