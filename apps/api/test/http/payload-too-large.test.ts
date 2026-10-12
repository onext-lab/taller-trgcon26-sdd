import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/test-app.ts';

// Rutas auxiliares con un `bodyLimit` pequeño: el 413 lo genera Fastify y el manejador único pone el texto.
const CUSTOM_MESSAGE = 'El fichero ocupa más de 1 MiB. Divídelo en ficheros más pequeños.';
const GENERIC_MESSAGE = 'El cuerpo de la petición es demasiado grande.';
const csv = { 'content-type': 'text/csv' };

function addTestRoutes(app: FastifyInstance): void {
  app.addContentTypeParser(
    'text/csv',
    { parseAs: 'buffer', bodyLimit: 16 },
    (_request, body, done) => done(null, body),
  );
  app.post(
    '/test/with-message',
    { bodyLimit: 16, config: { payloadTooLargeMessage: CUSTOM_MESSAGE } },
    () => ({ ok: true }),
  );
  app.post('/test/without-message', { bodyLimit: 16 }, () => ({ ok: true }));
}

describe('413 con texto propio de la ruta (DD-02)', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  function setup(): void {
    app = createTestApp().app;
    addTestRoutes(app);
  }

  it('413 con config.payloadTooLargeMessage usa ese texto; sin él, el genérico', async () => {
    setup();
    const payload = 'a'.repeat(17);

    const custom = await app.inject({
      method: 'POST',
      url: '/test/with-message',
      headers: csv,
      payload,
    });
    const generic = await app.inject({
      method: 'POST',
      url: '/test/without-message',
      headers: csv,
      payload,
    });

    expect(custom.statusCode).toBe(413);
    expect(custom.json()).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: CUSTOM_MESSAGE },
    });
    expect(generic.statusCode).toBe(413);
    expect(generic.json()).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: GENERIC_MESSAGE },
    });
  });

  it('dentro del límite la ruta responde con normalidad, con o sin texto propio', async () => {
    setup();

    const responses = await Promise.all(
      ['/test/with-message', '/test/without-message'].map((url) =>
        app.inject({ method: 'POST', url, headers: csv, payload: 'a'.repeat(16) }),
      ),
    );

    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    }
  });

  it('otros errores de una ruta con texto propio no lo usan', async () => {
    setup();

    const response = await app.inject({
      method: 'POST',
      url: '/test/with-message',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'a=b',
    });

    expect(response.statusCode).toBe(415);
    expect(response.json().error.message).toBe('Tipo de contenido no admitido.');
  });
});
