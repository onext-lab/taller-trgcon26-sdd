import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../src/components/http.ts';
import {
  candidateListUrl,
  createCandidate,
  getCandidate,
  isCandidate,
  isCandidatePage,
  listCandidates,
  registerConsent,
  updateCandidate,
  withdrawConsent,
} from '../../../src/features/candidates/api.ts';
import { candidatePaths, parseCandidateId } from '../../../src/features/candidates/paths.ts';
import type { Candidate, CandidatePage } from '../../../src/features/candidates/types.ts';
import { mockFetch } from '../../helpers/fetch.ts';

const CANDIDATE: Candidate = {
  id: 7,
  fullName: 'Lucía Ferrer Soler',
  email: 'lucia.ferrer@example.com',
  phone: null,
  summary: null,
  skills: ['sql', 'typescript'],
  createdAt: '2026-10-06T09:00:00.000Z',
  consentGivenAt: null,
  consentVersion: null,
  consentWithdrawnAt: null,
  retentionEndsAt: null,
};

const PAGE: CandidatePage = {
  items: [{ id: 7, fullName: CANDIDATE.fullName, email: CANDIDATE.email, skills: ['sql'] }],
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

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba un error y la promesa se resolvió');
}

describe('API de candidatos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('RF-04 listCandidates pide GET /api/candidates sin parámetros por defecto', async () => {
    const mock = mockFetch({ 'GET /api/candidates': { status: 200, json: PAGE } });

    const page = await listCandidates({});

    expect(page).toEqual(PAGE);
    expect(summary(mock)).toEqual([
      { method: 'GET', url: '/api/candidates', contentType: undefined, body: undefined },
    ]);
  });

  it('RF-04 listCandidates envía q y skill con encodeURIComponent', async () => {
    const url = `/api/candidates?q=${encodeURIComponent('josé ruiz&x=1')}&skill=c%2B%2B`;
    const mock = mockFetch({ [`GET ${url}`]: { status: 200, json: PAGE } });

    await listCandidates({ q: 'josé ruiz&x=1', skill: 'c++' });

    expect(mock.unmatched).toEqual([]);
    expect(mock.calls[0]?.url).toBe('/api/candidates?q=jos%C3%A9%20ruiz%26x%3D1&skill=c%2B%2B');
  });

  it('RF-02 getCandidate pide GET /api/candidates/7', async () => {
    const mock = mockFetch({ 'GET /api/candidates/7': { status: 200, json: CANDIDATE } });

    expect(await getCandidate(7)).toEqual(CANDIDATE);
    expect(mock.calls).toHaveLength(1);
  });

  it('RF-01 createCandidate envía POST con el cuerpo tal cual y Content-Type JSON', async () => {
    const input = {
      fullName: 'Lucía Ferrer Soler',
      email: 'lucia.ferrer@example.com',
      consent: true,
    };
    const mock = mockFetch({ 'POST /api/candidates': { status: 201, json: CANDIDATE } });

    expect(await createCandidate(input)).toEqual(CANDIDATE);

    expect(summary(mock)).toEqual([
      {
        method: 'POST',
        url: '/api/candidates',
        contentType: 'application/json',
        body: JSON.stringify(input),
      },
    ]);
  });

  it('RF-03 updateCandidate envía PATCH con solo el parche', async () => {
    const patch = { phone: null, skills: [] };
    const mock = mockFetch({ 'PATCH /api/candidates/7': { status: 200, json: CANDIDATE } });

    await updateCandidate(7, patch);

    expect(summary(mock)).toEqual([
      {
        method: 'PATCH',
        url: '/api/candidates/7',
        contentType: 'application/json',
        body: '{"phone":null,"skills":[]}',
      },
    ]);
  });

  it('S6 registerConsent y S7 withdrawConsent: POST sin cuerpo ni Content-Type', async () => {
    const mock = mockFetch({
      'POST /api/candidates/7/consent': { status: 200, json: CANDIDATE },
      'POST /api/candidates/7/consent/withdrawal': { status: 200, json: CANDIDATE },
    });

    await registerConsent(7);
    await withdrawConsent(7);

    expect(summary(mock)).toEqual([
      { method: 'POST', url: '/api/candidates/7/consent', contentType: undefined, body: undefined },
      {
        method: 'POST',
        url: '/api/candidates/7/consent/withdrawal',
        contentType: undefined,
        body: undefined,
      },
    ]);
  });

  it('pasa la señal de cancelación a la petición', async () => {
    mockFetch({ 'GET /api/candidates/7': { hang: true } });
    const controller = new AbortController();

    const pending = rejection(getCandidate(7, controller.signal));
    controller.abort();

    expect(((await pending) as Error).name).toBe('AbortError');
  });

  it('EC-35 un ID no válido no llega a la red', async () => {
    const mock = mockFetch({});

    for (const id of [0, -1, 1.5, Number.NaN, 2 ** 53]) {
      await expect(getCandidate(id)).rejects.toBeInstanceOf(RangeError);
    }
    await expect(registerConsent(0)).rejects.toBeInstanceOf(RangeError);
    await expect(withdrawConsent(-1)).rejects.toBeInstanceOf(RangeError);
    expect(mock.calls).toEqual([]);
  });

  it('un error con envelope llega como ApiError con su status, code y details (409 con existingId)', async () => {
    mockFetch({
      'POST /api/candidates': {
        status: 409,
        json: {
          error: {
            code: 'DUPLICATE',
            message: 'Registro duplicado.',
            details: [
              { field: 'email', message: 'Ya existe un candidato con este email.', existingId: 42 },
            ],
          },
        },
      },
    });

    const error = (await rejection(
      createCandidate({ fullName: 'Ana Gil', email: 'ana.gil@example.com', consent: false }),
    )) as ApiError;

    expect([error.status, error.code, error.details?.[0]?.existingId]).toEqual([
      409,
      'DUPLICATE',
      42,
    ]);
  });
});

describe('respuestas 2xx con forma inesperada', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function expectBadResponse(promise: Promise<unknown>): Promise<void> {
    const error = await rejection(promise);
    expect(error).toBeInstanceOf(ApiError);
    expect([(error as ApiError).status, (error as ApiError).code]).toEqual([
      0,
      'CLIENT_BAD_RESPONSE',
    ]);
  }

  it('EC-37 una ficha con un campo que falta, de otro tipo o sin objeto da CLIENT_BAD_RESPONSE', async () => {
    const { retentionEndsAt: _removed, ...incomplete } = CANDIDATE;
    const cases: unknown[] = [
      incomplete,
      { ...CANDIDATE, id: '7' },
      { ...CANDIDATE, id: 0 },
      { ...CANDIDATE, skills: 'sql' },
      { ...CANDIDATE, skills: [1] },
      { ...CANDIDATE, phone: 5 },
      { ...CANDIDATE, consentGivenAt: undefined },
      [],
      null,
      'texto',
    ];
    for (const json of cases) {
      mockFetch({ 'GET /api/candidates/7': { status: 200, json } });
      await expectBadResponse(getCandidate(7));
    }
  });

  it('el alta, la edición y las dos acciones de consentimiento validan también la respuesta', async () => {
    mockFetch({
      'POST /api/candidates': { status: 201, json: { id: 7 } },
      'PATCH /api/candidates/7': { status: 200, json: { id: 7 } },
      'POST /api/candidates/7/consent': { status: 200, json: { id: 7 } },
      'POST /api/candidates/7/consent/withdrawal': { status: 200, json: { id: 7 } },
    });

    await expectBadResponse(
      createCandidate({ fullName: 'Ana Gil', email: 'a@b.es', consent: false }),
    );
    await expectBadResponse(updateCandidate(7, { phone: null }));
    await expectBadResponse(registerConsent(7));
    await expectBadResponse(withdrawConsent(7));
  });

  it('CA-24 una página sin items, con un elemento incompleto o con totales no enteros da CLIENT_BAD_RESPONSE', async () => {
    const cases: unknown[] = [
      { total: 0, page: 1, pageSize: 20 },
      { ...PAGE, items: [{ id: 7, fullName: 'Ana', email: 'a@b.es' }] },
      { ...PAGE, items: [{ id: 7, fullName: 'Ana', email: 'a@b.es', skills: 'sql' }] },
      { ...PAGE, items: [{ id: 0, fullName: 'Ana', email: 'a@b.es', skills: [] }] },
      { ...PAGE, total: '1' },
      { ...PAGE, page: 1.5 },
      { ...PAGE, pageSize: null },
      [],
    ];
    for (const json of cases) {
      mockFetch({ 'GET /api/candidates': { status: 200, json } });
      await expectBadResponse(listCandidates({}));
    }
  });

  it('una respuesta que no es JSON da CLIENT_BAD_RESPONSE', async () => {
    mockFetch({ 'GET /api/candidates/7': { status: 200, text: '<html></html>' } });
    await expectBadResponse(getCandidate(7));
  });
});

describe('guardas de forma', () => {
  it('isCandidate acepta la ficha completa y una con todos los opcionales informados', () => {
    expect(isCandidate(CANDIDATE)).toBe(true);
    expect(
      isCandidate({
        ...CANDIDATE,
        phone: '+34 600 000 001',
        summary: 'Resumen',
        consentGivenAt: '2026-10-06T09:00:00.000Z',
        consentVersion: 'v1',
        consentWithdrawnAt: '2026-10-07T09:00:00.000Z',
        retentionEndsAt: '2027-04-07',
      }),
    ).toBe(true);
  });

  it('isCandidatePage acepta una página vacía y una con elementos de cuatro campos', () => {
    expect(isCandidatePage({ items: [], total: 0, page: 1, pageSize: 20 })).toBe(true);
    expect(isCandidatePage(PAGE)).toBe(true);
  });
});

describe('candidateListUrl', () => {
  it('omite q y skill vacíos y page y pageSize por defecto', () => {
    expect(candidateListUrl({})).toBe('/api/candidates');
    expect(candidateListUrl({ q: '', skill: '', page: 1, pageSize: 20 })).toBe('/api/candidates');
  });

  it('escribe en orden q, skill, page, pageSize lo que no es por defecto', () => {
    expect(candidateListUrl({ pageSize: 50, page: 3, skill: 'sql', q: 'jose' })).toBe(
      '/api/candidates?q=jose&skill=sql&page=3&pageSize=50',
    );
    expect(candidateListUrl({ page: 2 })).toBe('/api/candidates?page=2');
    expect(candidateListUrl({ pageSize: 100 })).toBe('/api/candidates?pageSize=100');
  });

  it('EC-33 codifica con encodeURIComponent lo que podría romper la URL', () => {
    expect(candidateListUrl({ q: "' OR 1=1 --" })).toBe(
      `/api/candidates?q=${encodeURIComponent("' OR 1=1 --")}`,
    );
    expect(candidateListUrl({ q: '%', skill: '#' })).toBe('/api/candidates?q=%25&skill=%23');
    expect(candidateListUrl({ q: 'a@b.es' })).toBe('/api/candidates?q=a%40b.es');
  });
});

describe('rutas de candidatos', () => {
  it('candidatePaths solo lleva IDs, nunca datos personales', () => {
    expect(candidatePaths.list).toBe('/candidates');
    expect(candidatePaths.create).toBe('/candidates/new');
    expect(candidatePaths.detail(7)).toBe('/candidates/7');
    expect(candidatePaths.edit(7)).toBe('/candidates/7/edit');
  });

  it('parseCandidateId usa la misma regla que la API', () => {
    expect(parseCandidateId('7')).toBe(7);
    for (const text of ['', '0', '007', 'abc', '1.5', '-1', 'new']) {
      expect(parseCandidateId(text)).toBeNull();
    }
  });
});
