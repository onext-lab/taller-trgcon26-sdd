import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  advanceApplication,
  applicationUrl,
  getApplicationDetail,
  isApplicationDetail,
  rejectApplication,
} from '../../../src/features/applications/api.ts';
import {
  APPLICATION_ROUTE,
  applicationPath,
  parseApplicationId,
} from '../../../src/features/applications/paths.ts';
import {
  INVALID_TRANSITION_MESSAGE,
  NOT_FOUND_MESSAGE,
  STAGE_MISMATCH_MESSAGE,
  classifyStageError,
} from '../../../src/features/applications/stage-errors.ts';
import { ApiError } from '../../../src/components/http.ts';
import { mockFetch } from '../../helpers/fetch.ts';
import {
  APPLICATION_ID,
  DETAIL_FIVE_CHANGES,
  DETAIL_ONE_CHANGE,
  DETAIL_REJECTED_JOB_CLOSED,
  DETAIL_REJECTED_WITH_NOTE,
  DETAIL_THREE_CHANGES,
  MULTILINE_NOTE,
  advanced,
  rejected,
} from './stage-fixtures.ts';

const ADVANCE_URL = `/api/applications/${APPLICATION_ID}/advance`;
const REJECT_URL = `/api/applications/${APPLICATION_ID}/reject`;
const DETAIL_URL = `/api/applications/${APPLICATION_ID}`;

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba un error y la promesa se resolvió');
}

function withHistory(patch: Record<number, Record<string, unknown>>, base = DETAIL_THREE_CHANGES) {
  return {
    ...base,
    history: base.history.map((entry, index) => ({ ...entry, ...patch[index] })),
  };
}

describe('rutas de la inscripción', () => {
  it('applicationPath y parseApplicationId son inversas y rechazan IDs no válidos', () => {
    expect(APPLICATION_ROUTE).toBe('/applications/:id');
    expect(applicationPath(28)).toBe('/applications/28');
    expect(parseApplicationId('/applications/28')).toBe(28);
    expect(parseApplicationId('/applications/abc')).toBeNull();
    expect(parseApplicationId('/applications/028')).toBeNull();
    expect(parseApplicationId('/applications/0')).toBeNull();
    expect(parseApplicationId('/applications')).toBeNull();
    expect(parseApplicationId('/jobs/28/pipeline')).toBeNull();
  });
});

describe('applicationUrl', () => {
  it('EC-02: da la URL exacta y con un ID no válido lanza RangeError', () => {
    expect(applicationUrl(28)).toBe(DETAIL_URL);
    for (const id of [0, -1, 1.5, Number.NaN, 10 ** 15]) {
      expect(() => applicationUrl(id)).toThrow(RangeError);
    }
  });

  it('EC-02: ni avanzar, ni rechazar ni pedir el detalle hacen petición con un ID no válido', async () => {
    const mock = mockFetch({});
    const advance = { expectedStage: 'received', toStage: 'screening' } as const;
    const reject = { expectedStage: 'received', reason: 'other' } as const;

    await expect(advanceApplication(0, advance)).rejects.toBeInstanceOf(RangeError);
    await expect(rejectApplication(10 ** 15, reject)).rejects.toBeInstanceOf(RangeError);
    await expect(getApplicationDetail(Number.NaN)).rejects.toBeInstanceOf(RangeError);

    expect(mock.calls).toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe('advanceApplication', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('EC-01: envía POST con el cuerpo exacto y Content-Type JSON', async () => {
    const mock = mockFetch({
      [`POST ${ADVANCE_URL}`]: { status: 200, json: advanced('interview') },
    });

    const result = await advanceApplication(APPLICATION_ID, {
      expectedStage: 'screening',
      toStage: 'interview',
    });

    expect(result).toEqual(advanced('interview'));
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.body).toBe('{"expectedStage":"screening","toStage":"interview"}');
    expect(mock.calls[0]?.headers['content-type']).toBe('application/json');
  });

  it('EC-01: no envía campos de más aunque el objeto los traiga', async () => {
    const mock = mockFetch({
      [`POST ${ADVANCE_URL}`]: { status: 200, json: advanced('screening') },
    });
    const input = {
      expectedStage: 'received',
      toStage: 'screening',
      name: 'No debe viajar',
    } as const;

    await advanceApplication(APPLICATION_ID, input);

    expect(mock.calls[0]?.body).toBe('{"expectedStage":"received","toStage":"screening"}');
  });

  it('EC-45: un 200 con forma no válida o con otro id es una respuesta no válida', async () => {
    const input = { expectedStage: 'received', toStage: 'screening' } as const;
    for (const json of [
      { id: APPLICATION_ID },
      advanced('screening', 99),
      advanced('archived' as never),
    ]) {
      mockFetch({ [`POST ${ADVANCE_URL}`]: { status: 200, json } });

      const error = await rejection(advanceApplication(APPLICATION_ID, input));

      expect((error as ApiError).code).toBe('CLIENT_BAD_RESPONSE');
      vi.unstubAllGlobals();
    }
  });
});

describe('rejectApplication', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function rejectBody(note: string | undefined): Promise<string | undefined> {
    const mock = mockFetch({ [`POST ${REJECT_URL}`]: { status: 200, json: rejected() } });
    await rejectApplication(APPLICATION_ID, { expectedStage: 'screening', reason: 'other', note });
    vi.unstubAllGlobals();
    return mock.calls[0]?.body;
  }

  it('EC-11: sin note el cuerpo es exactamente { expectedStage, reason }', async () => {
    const mock = mockFetch({ [`POST ${REJECT_URL}`]: { status: 200, json: rejected() } });

    const result = await rejectApplication(APPLICATION_ID, {
      expectedStage: 'screening',
      reason: 'not_a_fit',
    });

    expect(result).toEqual(rejected());
    expect(mock.calls[0]?.body).toBe('{"expectedStage":"screening","reason":"not_a_fit"}');
    expect(mock.calls[0]?.headers['content-type']).toBe('application/json');
  });

  it('EC-11: una nota vacía o de solo espacios se omite', async () => {
    const expected = '{"expectedStage":"screening","reason":"other"}';

    expect(await rejectBody(undefined)).toBe(expected);
    expect(await rejectBody('')).toBe(expected);
    expect(await rejectBody('   \n\t ')).toBe(expected);
  });

  it('EC-11: con nota la envía recortada y con sus saltos de línea', async () => {
    const body = await rejectBody(`  ${MULTILINE_NOTE}  `);

    expect(JSON.parse(body ?? '{}')).toEqual({
      expectedStage: 'screening',
      reason: 'other',
      note: MULTILINE_NOTE,
    });
  });

  it('EC-45: un 200 con forma no válida o con otro id es una respuesta no válida', async () => {
    for (const json of [{ id: APPLICATION_ID }, rejected(99), null]) {
      mockFetch({ [`POST ${REJECT_URL}`]: { status: 200, json } });

      const error = await rejection(
        rejectApplication(APPLICATION_ID, { expectedStage: 'received', reason: 'other' }),
      );

      expect((error as ApiError).code).toBe('CLIENT_BAD_RESPONSE');
      vi.unstubAllGlobals();
    }
  });
});

describe('getApplicationDetail e isApplicationDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getApplicationDetail pide la URL exacta con GET y sin Content-Type', async () => {
    const mock = mockFetch({ [`GET ${DETAIL_URL}`]: { status: 200, json: DETAIL_FIVE_CHANGES } });

    await expect(getApplicationDetail(APPLICATION_ID)).resolves.toEqual(DETAIL_FIVE_CHANGES);

    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.headers['content-type']).toBeUndefined();
  });

  it('EC-45: un 200 con otro id o con forma no válida es una respuesta no válida', async () => {
    for (const json of [{ ...DETAIL_ONE_CHANGE, id: 99 }, { id: APPLICATION_ID }]) {
      mockFetch({ [`GET ${DETAIL_URL}`]: { status: 200, json } });

      const error = await rejection(getApplicationDetail(APPLICATION_ID));

      expect((error as ApiError).code).toBe('CLIENT_BAD_RESPONSE');
      vi.unstubAllGlobals();
    }
  });

  it('acepta los detalles válidos: 1, 3 y 5 cambios, rechazo con nota y por cierre de oferta', () => {
    for (const detail of [
      DETAIL_ONE_CHANGE,
      DETAIL_THREE_CHANGES,
      DETAIL_FIVE_CHANGES,
      DETAIL_REJECTED_WITH_NOTE,
      DETAIL_REJECTED_JOB_CLOSED,
    ]) {
      expect(isApplicationDetail(detail)).toBe(true);
    }
  });

  it('un rechazo manual sin nota (note nulo) también es válido', () => {
    expect(
      isApplicationDetail(
        withHistory({ 2: { reason: 'other', note: null } }, DETAIL_REJECTED_WITH_NOTE),
      ),
    ).toBe(true);
  });

  const REJECTED = DETAIL_REJECTED_WITH_NOTE;
  const ONE = DETAIL_ONE_CHANGE;
  const invalidDetails: [string, unknown][] = [
    ['etapa desconocida', { ...DETAIL_THREE_CHANGES, stage: 'archived' }],
    ['toStage desconocido', withHistory({ 1: { toStage: 'archived' } })],
    ['fromStage desconocido', withHistory({ 1: { fromStage: 'archived' } })],
    ['motivo desconocido', withHistory({ 2: { reason: 'bored' } }, REJECTED)],
    ['estado de oferta desconocido', { ...ONE, job: { ...ONE.job, status: 'archived' } }],
    ['history vacío', { ...ONE, history: [] }],
    ['history ausente', { ...ONE, history: undefined }],
    ['history que no es una lista', { ...ONE, history: {} }],
    ['id no numérico', { ...ONE, id: '28' }],
    ['candidato sin nombre', { ...ONE, candidate: { id: 12 } }],
    ['oferta sin título', { ...ONE, job: { id: 7, status: 'draft' } }],
    ['valor nulo', null],
    ['fromStage no nulo en el primero', withHistory({ 0: { fromStage: 'received' } })],
    ['fromStage nulo en un cambio posterior', withHistory({ 2: { fromStage: null } })],
    ['note en un cambio no rechazado', withHistory({ 1: { note: 'Prefiere jornada parcial.' } })],
    ['reason en un cambio no rechazado', withHistory({ 1: { reason: 'other' } })],
    ['rechazo sin reason', withHistory({ 2: { reason: null } }, REJECTED)],
    ['note que no es texto ni nulo', withHistory({ 2: { note: 5 } }, REJECTED)],
    ['note ausente en el rechazo', withHistory({ 2: { note: undefined } }, REJECTED)],
  ];

  it.each(invalidDetails)('EC-45: isApplicationDetail rechaza %s', (_name, value) => {
    expect(isApplicationDetail(value)).toBe(false);
  });
});

describe('classifyStageError', () => {
  it('distingue los dos 409 y el 404 por code', () => {
    const mismatch = new ApiError(409, 'STAGE_MISMATCH', 'texto de la API');
    const invalid = new ApiError(409, 'INVALID_TRANSITION', 'texto de la API');
    const missing = new ApiError(404, 'NOT_FOUND', 'texto de la API');

    expect(classifyStageError(mismatch)).toBe('stage-mismatch');
    expect(classifyStageError(invalid)).toBe('invalid-transition');
    expect(classifyStageError(missing)).toBe('not-found');
  });

  it('cualquier otro error (envelope, cliente o desconocido) es other', () => {
    expect(classifyStageError(new ApiError(400, 'VALIDATION_ERROR', 'x'))).toBe('other');
    expect(classifyStageError(new ApiError(403, 'CROSS_SITE_REQUEST', 'x'))).toBe('other');
    expect(classifyStageError(new ApiError(0, 'CLIENT_TIMEOUT', 'x'))).toBe('other');
    expect(classifyStageError(new Error('STAGE_MISMATCH'))).toBe('other');
    expect(classifyStageError(undefined)).toBe('other');
  });

  it('los textos fijos son los de DT-06', () => {
    expect(STAGE_MISMATCH_MESSAGE).toBe(
      'La inscripción ha cambiado de etapa: revisa el pipeline actualizado.',
    );
    expect(INVALID_TRANSITION_MESSAGE).toBe('La inscripción ya no admite ese cambio.');
    expect(NOT_FOUND_MESSAGE).toBe('La inscripción ya no existe.');
  });
});
