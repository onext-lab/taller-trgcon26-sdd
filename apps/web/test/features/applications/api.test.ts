import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enrollCandidate,
  getPipeline,
  isApplication,
  isPipeline,
  pipelineUrl,
  searchCandidates,
} from '../../../src/features/applications/api.ts';
import {
  DUPLICATE_MESSAGE,
  NOT_PUBLISHED_MESSAGE,
  classifyEnrollError,
} from '../../../src/features/applications/enroll-errors.ts';
import {
  PIPELINE_ROUTE,
  parsePipelineJobId,
  pipelinePath,
} from '../../../src/features/applications/paths.ts';
import type { Application } from '../../../src/features/applications/types.ts';
import { ApiError } from '../../../src/components/http.ts';
import { mockFetch } from '../../helpers/fetch.ts';
import { ELEVEN_CANDIDATES_PAGE, JOB_ID, PUBLISHED_PIPELINE } from './fixtures.ts';

const APPLICATION: Application = {
  id: 40,
  jobId: 7,
  candidateId: 12,
  stage: 'received',
  createdAt: '2026-10-07T09:00:00.000Z',
  lastChangeAt: '2026-10-07T09:00:00.000Z',
};

const PIPELINE_URL = '/api/jobs/7/applications';

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba un error y la promesa se resolvió');
}

function withItem(patch: Record<string, unknown>): unknown {
  const [first] = PUBLISHED_PIPELINE.items;
  return { ...PUBLISHED_PIPELINE, items: [{ ...first, ...patch }] };
}

describe('rutas del pipeline', () => {
  it('pipelinePath y parsePipelineJobId son inversas y rechazan IDs no válidos', () => {
    expect(PIPELINE_ROUTE).toBe('/jobs/:id/pipeline');
    expect(pipelinePath(7)).toBe('/jobs/7/pipeline');
    expect(parsePipelineJobId('/jobs/7/pipeline')).toBe(7);
    expect(parsePipelineJobId('/jobs/abc/pipeline')).toBeNull();
    expect(parsePipelineJobId('/jobs/07/pipeline')).toBeNull();
    expect(parsePipelineJobId('/jobs/7')).toBeNull();
  });
});

describe('cliente del pipeline', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pipelineUrl da la URL exacta y lanza RangeError con un ID no válido', () => {
    expect(pipelineUrl(7)).toBe(PIPELINE_URL);
    for (const id of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => pipelineUrl(id)).toThrow(RangeError);
    }
  });

  it('getPipeline pide la URL exacta con GET y sin Content-Type', async () => {
    const mock = mockFetch({ [`GET ${PIPELINE_URL}`]: { status: 200, json: PUBLISHED_PIPELINE } });

    await expect(getPipeline(JOB_ID)).resolves.toEqual(PUBLISHED_PIPELINE);

    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.headers['content-type']).toBeUndefined();
  });

  it('EC-37: isPipeline acepta un pipeline válido y vacío', () => {
    expect(isPipeline(PUBLISHED_PIPELINE)).toBe(true);
    expect(isPipeline({ job: { id: 7, status: 'closed' }, items: [] })).toBe(true);
  });

  it('EC-37: isPipeline rechaza etapa o motivo desconocidos', () => {
    expect(isPipeline(withItem({ stage: 'archived' }))).toBe(false);
    expect(isPipeline(withItem({ stage: 'rejected', rejectionReason: 'bored' }))).toBe(false);
    expect(isPipeline(withItem({ stage: 'rejected', rejectionReason: null }))).toBe(false);
  });

  it('EC-37: isPipeline exige motivo nulo salvo en rejected', () => {
    expect(isPipeline(withItem({ stage: 'received', rejectionReason: 'other' }))).toBe(false);
  });

  it('EC-37: isPipeline rechaza la falta de items, de job o un estado de oferta desconocido', () => {
    expect(isPipeline({ job: { id: 7, status: 'published' } })).toBe(false);
    expect(isPipeline({ items: [] })).toBe(false);
    expect(isPipeline({ job: { id: 7, status: 'archived' }, items: [] })).toBe(false);
    expect(isPipeline({ job: { id: 0, status: 'draft' }, items: [] })).toBe(false);
    expect(isPipeline({ job: { id: 7, status: 'draft' }, applications: [] })).toBe(false);
    expect(isPipeline(null)).toBe(false);
  });

  it('EC-37: getPipeline con un job.id distinto del pedido es una respuesta no válida', async () => {
    mockFetch({
      [`GET ${PIPELINE_URL}`]: {
        status: 200,
        json: { job: { id: 8, status: 'draft' }, items: [] },
      },
    });

    const error = await rejection(getPipeline(JOB_ID));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('CLIENT_BAD_RESPONSE');
  });

  it('EC-37: getPipeline con forma inesperada es una respuesta no válida', async () => {
    mockFetch({ [`GET ${PIPELINE_URL}`]: { status: 200, json: withItem({ stage: 'archived' }) } });

    const error = await rejection(getPipeline(JOB_ID));

    expect((error as ApiError).code).toBe('CLIENT_BAD_RESPONSE');
  });
});

describe('cliente de inscripción', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('EC-01, EC-02: enrollCandidate envía POST con el cuerpo exacto y Content-Type JSON', async () => {
    const mock = mockFetch({ 'POST /api/applications': { status: 201, json: APPLICATION } });

    const result = await enrollCandidate({ jobId: 7, candidateId: 12 });

    expect(result).toEqual(APPLICATION);
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.body).toBe('{"jobId":7,"candidateId":12}');
    expect(mock.calls[0]?.headers['content-type']).toBe('application/json');
  });

  it('EC-01: enrollCandidate no envía campos de más aunque el objeto los traiga', async () => {
    const mock = mockFetch({ 'POST /api/applications': { status: 201, json: APPLICATION } });
    const input = { jobId: 7, candidateId: 12, name: 'No debe viajar' };

    await enrollCandidate(input);

    expect(mock.calls[0]?.body).toBe('{"jobId":7,"candidateId":12}');
  });

  it('EC-37: un 201 con forma inesperada es una respuesta no válida', async () => {
    mockFetch({ 'POST /api/applications': { status: 201, json: { id: 40 } } });

    const error = await rejection(enrollCandidate({ jobId: 7, candidateId: 12 }));

    expect((error as ApiError).code).toBe('CLIENT_BAD_RESPONSE');
  });

  it('isApplication exige los 6 campos', () => {
    expect(isApplication(APPLICATION)).toBe(true);
    for (const field of Object.keys(APPLICATION)) {
      const { [field as keyof Application]: _omitted, ...rest } = APPLICATION;
      expect(isApplication(rest)).toBe(false);
    }
    expect(isApplication({ ...APPLICATION, stage: 'archived' })).toBe(false);
    expect(isApplication({ ...APPLICATION, jobId: '7' })).toBe(false);
    expect(isApplication(null)).toBe(false);
  });
});

describe('búsqueda de candidatos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searchCandidates("ana") pide /api/candidates?q=ana&pageSize=10', async () => {
    const mock = mockFetch({
      'GET /api/candidates?q=ana&pageSize=10': { status: 200, json: ELEVEN_CANDIDATES_PAGE },
    });

    await expect(searchCandidates('ana')).resolves.toEqual(ELEVEN_CANDIDATES_PAGE);

    expect(mock.unmatched).toEqual([]);
  });

  it('searchCandidates("") pide /api/candidates?pageSize=10', async () => {
    const mock = mockFetch({
      'GET /api/candidates?pageSize=10': { status: 200, json: ELEVEN_CANDIDATES_PAGE },
    });

    await searchCandidates('');

    expect(mock.calls.map((call) => call.url)).toEqual(['/api/candidates?pageSize=10']);
  });
});

describe('classifyEnrollError', () => {
  it('distingue los dos 409 y el 404 por code', () => {
    const duplicate = new ApiError(409, 'DUPLICATE', 'texto de la API');
    const closed = new ApiError(409, 'INVALID_TRANSITION', 'texto de la API');
    const missing = new ApiError(404, 'NOT_FOUND', 'El candidato no existe.');

    expect(classifyEnrollError(duplicate)).toBe('duplicate');
    expect(classifyEnrollError(closed)).toBe('not-published');
    expect(classifyEnrollError(missing)).toBe('not-found');
  });

  it('cualquier otro error (envelope, cliente o desconocido) es other', () => {
    expect(classifyEnrollError(new ApiError(400, 'VALIDATION_ERROR', 'x'))).toBe('other');
    expect(classifyEnrollError(new ApiError(0, 'CLIENT_TIMEOUT', 'x'))).toBe('other');
    expect(classifyEnrollError(new Error('DUPLICATE'))).toBe('other');
    expect(classifyEnrollError(undefined)).toBe('other');
  });

  it('los textos fijos son los del PRD (DD-05)', () => {
    expect(DUPLICATE_MESSAGE).toBe('Este candidato ya está inscrito en la oferta.');
    expect(NOT_PUBLISHED_MESSAGE).toBe('La oferta ya no está publicada: no admite inscripciones.');
  });
});
