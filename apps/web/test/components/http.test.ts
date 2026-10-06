import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  BAD_RESPONSE_MESSAGE,
  CONNECTION_MESSAGE,
  requestJson,
  userMessage,
} from '../../src/components/http.ts';
import { mockFetch } from '../helpers/fetch.ts';

const JOB = { id: 7, title: 'Desarrollador/a backend (Node.js)' };

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba un error y la promesa se resolvió');
}

async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  const error = await catchError(promise);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('requestJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve el JSON de una respuesta 2xx', async () => {
    mockFetch({ 'GET /api/jobs/7': { status: 200, json: JOB } });

    expect(await requestJson('/api/jobs/7')).toEqual(JOB);
  });

  it('devuelve undefined en un 204', async () => {
    mockFetch({ 'DELETE /api/jobs/7': { status: 204 } });

    expect(await requestJson('/api/jobs/7', { method: 'DELETE' })).toBeUndefined();
  });

  it('GET y DELETE van sin cuerpo y sin Content-Type', async () => {
    const mock = mockFetch({
      'GET /api/jobs': { status: 200, json: {} },
      'DELETE /api/jobs/7': { status: 204 },
    });

    await requestJson('/api/jobs');
    await requestJson('/api/jobs/7', { method: 'DELETE' });

    for (const call of mock.calls) {
      expect(call.body).toBeUndefined();
      expect(call.headers['content-type']).toBeUndefined();
    }
  });

  it('POST y PATCH llevan el cuerpo en JSON con Content-Type: application/json', async () => {
    const mock = mockFetch({
      'POST /api/jobs': { status: 201, json: JOB },
      'PATCH /api/jobs/7': { status: 200, json: JOB },
    });

    await requestJson('/api/jobs', { method: 'POST', body: { title: 'Técnica/o de selección' } });
    await requestJson('/api/jobs/7', { method: 'PATCH', body: { location: null } });

    expect(
      mock.calls.map((call) => [call.method, call.headers['content-type'], call.body]),
    ).toEqual([
      ['POST', 'application/json', '{"title":"Técnica/o de selección"}'],
      ['PATCH', 'application/json', '{"location":null}'],
    ]);
  });

  it('un error con envelope lanza ApiError con status, code, message y details', async () => {
    const details = [{ field: 'title', message: 'El título debe tener entre 3 y 120 caracteres.' }];
    mockFetch({
      'POST /api/jobs': {
        status: 400,
        json: { error: { code: 'VALIDATION_ERROR', message: 'Hay campos con errores.', details } },
      },
    });

    const error = await expectApiError(
      requestJson('/api/jobs', { method: 'POST', body: { title: 'ab' } }),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Hay campos con errores.');
    expect(error.details).toEqual(details);
    expect(userMessage(error)).toBe('Hay campos con errores.');
  });

  it('un 500 con envelope muestra su message', async () => {
    mockFetch({
      'GET /api/jobs': {
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' } },
      },
    });

    const error = await expectApiError(requestJson('/api/jobs'));

    expect([error.status, error.code, error.details]).toEqual([500, 'INTERNAL_ERROR', undefined]);
    expect(userMessage(error)).toBe('Error interno. Inténtalo de nuevo.');
  });

  it('red caída → mensaje de conexión', async () => {
    mockFetch({ 'GET /api/jobs': { networkError: true } });

    const error = await expectApiError(requestJson('/api/jobs'));

    expect(error.status).toBe(0);
    expect(error.code).toBe('CLIENT_NETWORK');
    expect(userMessage(error)).toBe(CONNECTION_MESSAGE);
    expect(CONNECTION_MESSAGE).toBe(
      'No se ha podido conectar con el servidor. Vuelve a intentarlo en unos segundos.',
    );
  });

  it('timeout (timeoutMs corto) → mensaje de conexión', async () => {
    mockFetch({ 'GET /api/jobs': { hang: true } });

    const error = await expectApiError(requestJson('/api/jobs', { timeoutMs: 20 }));

    expect([error.status, error.code]).toEqual([0, 'CLIENT_TIMEOUT']);
    expect(userMessage(error)).toBe(CONNECTION_MESSAGE);
  });

  it('5xx sin envelope → mensaje de conexión', async () => {
    mockFetch({ 'GET /api/jobs': { status: 502, text: '<html>Bad Gateway</html>' } });

    const error = await expectApiError(requestJson('/api/jobs'));

    expect([error.status, error.code]).toEqual([0, 'CLIENT_NETWORK']);
    expect(userMessage(error)).toBe(CONNECTION_MESSAGE);
  });

  it('2xx con cuerpo no JSON → respuesta no válida', async () => {
    mockFetch({ 'GET /api/jobs': { status: 200, text: '<!doctype html><title>ATS</title>' } });

    const error = await expectApiError(requestJson('/api/jobs'));

    expect([error.status, error.code]).toEqual([0, 'CLIENT_BAD_RESPONSE']);
    expect(userMessage(error)).toBe(BAD_RESPONSE_MESSAGE);
    expect(BAD_RESPONSE_MESSAGE).toBe(
      'La respuesta del servidor no es válida. Vuelve a intentarlo.',
    );
  });

  it('4xx sin envelope válido → respuesta no válida, nunca el cuerpo crudo', async () => {
    mockFetch({ 'GET /api/jobs/7': { status: 404, json: { error: 'Not Found' } } });

    const error = await expectApiError(requestJson('/api/jobs/7'));

    expect([error.status, error.message]).toEqual([0, BAD_RESPONSE_MESSAGE]);
  });

  it('la cancelación propia se relanza tal cual, sin convertirse en mensaje', async () => {
    const mock = mockFetch({ 'GET /api/jobs': { hang: true } });
    const controller = new AbortController();

    const pending = requestJson('/api/jobs', { signal: controller.signal });
    controller.abort();
    const error = await catchError(pending);

    expect(mock.calls).toHaveLength(1);
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe('AbortError');
  });

  it('no reintenta solo tras un error de red (EC-09)', async () => {
    const mock = mockFetch({ 'POST /api/jobs': { networkError: true } });

    await catchError(requestJson('/api/jobs', { method: 'POST', body: { title: 'Valencia' } }));

    expect(mock.calls).toHaveLength(1);
  });
});
