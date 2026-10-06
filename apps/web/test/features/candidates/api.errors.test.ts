import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../src/components/http.ts';
import {
  createCandidate,
  getCandidate,
  listCandidates,
  registerConsent,
  updateCandidate,
  withdrawConsent,
} from '../../../src/features/candidates/api.ts';
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

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba un error y la promesa se resolvió');
}

describe('errores de la API de candidatos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
      createCandidate({ fullName: 'Ana Gil', email: 'ana@example.com', consent: false }),
    );
    await expectBadResponse(updateCandidate(7, { phone: null }));
    await expectBadResponse(registerConsent(7));
    await expectBadResponse(withdrawConsent(7));
  });

  it('RF-04 una página sin items, con un elemento incompleto o con totales no enteros da CLIENT_BAD_RESPONSE', async () => {
    const cases: unknown[] = [
      { total: 0, page: 1, pageSize: 20 },
      { ...PAGE, items: [{ id: 7, fullName: 'Ana', email: 'ana@example.com' }] },
      { ...PAGE, items: [{ id: 7, fullName: 'Ana', email: 'ana@example.com', skills: 'sql' }] },
      { ...PAGE, items: [{ id: 0, fullName: 'Ana', email: 'ana@example.com', skills: [] }] },
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
