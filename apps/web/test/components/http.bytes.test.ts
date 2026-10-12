import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, CONNECTION_MESSAGE, postBytes, userMessage } from '../../src/components/http.ts';
import { mockFetch } from '../helpers/fetch.ts';

const URL_IMPORT = '/api/candidates/import';
const CSV = 'nombre,email,telefono\r\nLucía Ferrer,lucia.ferrer@example.com,+34 600 000 011\r\n';

function toBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

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

describe('postBytes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía POST con el Content-Type dado y los bytes intactos', async () => {
    const mock = mockFetch({ [`POST ${URL_IMPORT}`]: { status: 200, json: { ok: true } } });
    const original = new Uint8Array([0xef, 0xbb, 0xbf, 0x6e, 0x3b, 0x0d, 0x0a, 0xff, 0x00]);

    await postBytes(URL_IMPORT, original.buffer, { contentType: 'text/csv' });

    expect(mock.calls).toHaveLength(1);
    const [call] = mock.calls;
    expect(call?.method).toBe('POST');
    expect(call?.headers['content-type']).toBe('text/csv');
    expect(call?.body).toBeUndefined();
    expect(Array.from(call?.bytes ?? [])).toEqual(Array.from(original));
  });

  it('usa el Content-Type que se le da, sea cual sea', async () => {
    const mock = mockFetch({ [`POST ${URL_IMPORT}`]: { status: 200, json: {} } });

    await postBytes(URL_IMPORT, toBuffer(CSV), { contentType: 'application/octet-stream' });

    expect(mock.calls[0]?.headers['content-type']).toBe('application/octet-stream');
  });

  it('devuelve el JSON de una respuesta 2xx', async () => {
    mockFetch({ [`POST ${URL_IMPORT}`]: { status: 200, json: { dataRows: 1 } } });

    expect(await postBytes(URL_IMPORT, toBuffer(CSV), { contentType: 'text/csv' })).toEqual({
      dataRows: 1,
    });
  });

  it('un 400 con envelope → ApiError con su message y details', async () => {
    const message = 'La primera línea debe ser la cabecera.';
    mockFetch({
      [`POST ${URL_IMPORT}`]: {
        status: 400,
        json: {
          error: { code: 'VALIDATION_ERROR', message, details: [{ field: 'file', message }] },
        },
      },
    });

    const error = await expectApiError(
      postBytes(URL_IMPORT, toBuffer(CSV), { contentType: 'text/csv' }),
    );

    expect([error.status, error.code, error.message]).toEqual([400, 'VALIDATION_ERROR', message]);
    expect(error.details).toEqual([{ field: 'file', message }]);
  });

  it('un 413 con envelope → ApiError con su message', async () => {
    const message = 'El fichero ocupa más de 1 MiB. Divídelo en ficheros más pequeños.';
    mockFetch({
      [`POST ${URL_IMPORT}`]: {
        status: 413,
        json: { error: { code: 'PAYLOAD_TOO_LARGE', message } },
      },
    });

    const error = await expectApiError(
      postBytes(URL_IMPORT, toBuffer(CSV), { contentType: 'text/csv' }),
    );

    expect([error.status, error.code, userMessage(error)]).toEqual([
      413,
      'PAYLOAD_TOO_LARGE',
      message,
    ]);
  });

  it('un 500 con envelope → ApiError con su message', async () => {
    mockFetch({
      [`POST ${URL_IMPORT}`]: {
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' } },
      },
    });

    const error = await expectApiError(
      postBytes(URL_IMPORT, toBuffer(CSV), { contentType: 'text/csv' }),
    );

    expect([error.status, error.code]).toEqual([500, 'INTERNAL_ERROR']);
    expect(userMessage(error)).toBe('Error interno. Inténtalo de nuevo.');
  });

  it('un 5xx sin envelope → CLIENT_NETWORK con el mensaje de conexión', async () => {
    mockFetch({ [`POST ${URL_IMPORT}`]: { status: 502, text: '<html>Bad Gateway</html>' } });

    const error = await expectApiError(
      postBytes(URL_IMPORT, toBuffer(CSV), { contentType: 'text/csv' }),
    );

    expect([error.status, error.code]).toEqual([0, 'CLIENT_NETWORK']);
    expect(userMessage(error)).toBe(CONNECTION_MESSAGE);
  });

  it('red caída → CLIENT_NETWORK', async () => {
    mockFetch({ [`POST ${URL_IMPORT}`]: { networkError: true } });

    const error = await expectApiError(
      postBytes(URL_IMPORT, toBuffer(CSV), { contentType: 'text/csv' }),
    );

    expect([error.status, error.code]).toEqual([0, 'CLIENT_NETWORK']);
  });

  it('timeout corto → CLIENT_TIMEOUT', async () => {
    mockFetch({ [`POST ${URL_IMPORT}`]: { hang: true } });

    const error = await expectApiError(
      postBytes(URL_IMPORT, toBuffer(CSV), { contentType: 'text/csv', timeoutMs: 20 }),
    );

    expect([error.status, error.code]).toEqual([0, 'CLIENT_TIMEOUT']);
    expect(userMessage(error)).toBe(CONNECTION_MESSAGE);
  });

  it('el aborto propio se relanza tal cual, sin convertirlo en ApiError', async () => {
    mockFetch({ [`POST ${URL_IMPORT}`]: { hang: true } });
    const controller = new AbortController();

    const pending = postBytes(URL_IMPORT, toBuffer(CSV), {
      contentType: 'text/csv',
      signal: controller.signal,
    });
    controller.abort();
    const error = await catchError(pending);

    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe('AbortError');
  });
});
