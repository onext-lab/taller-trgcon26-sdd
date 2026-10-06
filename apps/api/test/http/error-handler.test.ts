import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import type { ErrorDetail } from '../../src/errors.ts';
import { idParamsSchema } from '../../src/http/validation.ts';
import { loggerOptions } from '../../src/logger.ts';
import { createTestApp } from '../helpers/test-app.ts';

// Rutas auxiliares: aún no hay rutas de negocio, así que el test registra las suyas tras `buildApp`.
const keywordSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title'],
  properties: {
    title: { type: 'string', minLength: 3, maxLength: 5 },
    shortText: { type: 'string', maxLength: 2 },
    workMode: { type: ['string', 'null'], enum: ['presencial', 'híbrida', 'remota', null] },
    count: { type: ['integer', 'null'], exclusiveMinimum: 0 },
    min: { type: 'integer', minimum: 1 },
    max: { type: 'integer', maximum: 10 },
    code: { type: 'string', minLength: 3, pattern: '^[A-Z]+$' },
    when: { type: 'string', format: 'date-time' },
    nested: { type: 'object' },
    flag: { type: 'boolean' },
    even: { type: 'integer', multipleOf: 2 },
  },
} as const;

function addTestRoutes(app: FastifyInstance): void {
  app.post('/test/echo', { schema: { body: { type: 'object' } } }, (request) => request.body);
  app.post('/test/keywords', { schema: { body: keywordSchema } }, () => ({ ok: true }));
  app.patch(
    '/test/patch',
    {
      schema: {
        body: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: { title: { type: 'string' } },
        },
      },
    },
    () => ({ ok: true }),
  );
  app.get(
    '/test/items/:id',
    {
      schema: {
        params: idParamsSchema,
        querystring: { type: 'object', additionalProperties: false },
      },
    },
    (request) => request.params,
  );
  app.post('/test/boom', () => {
    throw new Error('detalle interno');
  });
  app.get('/test/conflict', () => {
    throw Object.assign(new Error('detalle interno'), { statusCode: 409 });
  });
}

const json = { 'content-type': 'application/json' };

/** `details` como mapa campo → mensaje; comprueba antes que no repite ningún campo. */
function detailsByField(details: ErrorDetail[]): Record<string, string> {
  expect(new Set(details.map(({ field }) => field)).size).toBe(details.length);
  return Object.fromEntries(details.map(({ field, message }) => [field, message]));
}

describe('envelope de error (RNF-03)', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  function setup(): void {
    app = createTestApp().app;
    addTestRoutes(app);
  }

  it('ruta /api inexistente → 404', async () => {
    setup();

    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/api/no-existe' }),
      app.inject({ method: 'DELETE', url: '/api/health' }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'El recurso no existe.' },
      });
    }
  });

  it('JSON malformado → 400', async () => {
    setup();

    const responses = await Promise.all([
      app.inject({ method: 'POST', url: '/test/echo', headers: json, payload: '{"title": "Ana' }),
      app.inject({ method: 'POST', url: '/test/echo', headers: json, payload: '' }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'El cuerpo de la petición no es JSON válido.',
          details: [{ field: 'body', message: 'Debe ser un objeto JSON.' }],
        },
      });
    }
  });

  it('Content-Type no admitido → 415', async () => {
    setup();

    const response = await app.inject({
      method: 'POST',
      url: '/test/echo',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'title=Analista',
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toEqual({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Tipo de contenido no admitido.' },
    });
  });

  it('cuerpo de más de 1 MiB → 413', async () => {
    setup();

    const response = await app.inject({
      method: 'POST',
      url: '/test/echo',
      headers: json,
      payload: JSON.stringify({ description: 'a'.repeat(1024 * 1024) }),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'El cuerpo de la petición es demasiado grande.',
      },
    });
  });

  it('otro 4xx de Fastify → BAD_REQUEST con el mismo código y sin el texto interno', async () => {
    setup();

    const response = await app.inject({ method: 'GET', url: '/test/conflict' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: { code: 'BAD_REQUEST', message: 'La petición no es válida.' },
    });
  });

  it('error no controlado → 500 sin stack ni mensaje interno y registrado en el log', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, done) {
        lines.push(String(chunk));
        done();
      },
    });
    app = buildApp({ db: openDatabase(':memory:'), logger: { ...loggerOptions, stream } });
    addTestRoutes(app);

    const response = await app.inject({
      method: 'POST',
      url: '/test/boom',
      payload: { email: 'ana.inventada@example.com' },
    });
    await app.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
    });
    expect(response.body).not.toContain('detalle interno');
    expect(response.body).not.toContain('stack');
    expect(response.body).not.toContain('.ts');

    const errorLogs = lines.map((line) => JSON.parse(line)).filter((log) => log.level === 50);
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].err.message).toBe('detalle interno');
    expect(lines.join('')).not.toContain('ana.inventada@example.com');
  });

  it('mensajes por keyword', async () => {
    setup();

    const response = await app.inject({
      method: 'POST',
      url: '/test/keywords',
      payload: {
        title: 'ab',
        shortText: 'abc',
        workMode: 'hibrida',
        count: 0,
        min: 0,
        max: 11,
        code: 'ab',
        when: 'ayer-inventado',
        nested: [],
        flag: 'quizá',
        even: 3,
        extra: 'sobrante',
      },
    });

    expect(response.statusCode).toBe(400);
    const { error } = response.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Hay campos con errores.');
    expect(detailsByField(error.details)).toEqual({
      title: 'Debe tener al menos 3 caracteres.',
      shortText: 'Debe tener como máximo 2 caracteres.',
      workMode: 'Debe ser uno de estos valores: presencial, híbrida, remota.',
      count: 'Debe ser mayor que 0.',
      min: 'Debe ser mayor o igual que 1.',
      max: 'Debe ser menor o igual que 10.',
      code: 'Debe tener al menos 3 caracteres.',
      when: 'Formato no válido.',
      nested: 'Debe ser un objeto JSON.',
      flag: 'Debe ser verdadero o falso.',
      even: 'Valor no válido.',
      body: 'Hay campos no permitidos.',
    });
    // Ningún mensaje repite el valor recibido.
    for (const received of ['hibrida', 'ayer-inventado', 'quizá', 'sobrante']) {
      expect(response.body).not.toContain(received);
    }
  });

  it('mensajes por keyword: obligatorio, tipos sin coerción y un elemento por campo', async () => {
    setup();

    const missing = await app.inject({ method: 'POST', url: '/test/keywords', payload: {} });
    const types = await app.inject({
      method: 'POST',
      url: '/test/keywords',
      payload: { title: 12345, count: '40000', min: 1.5, code: 'ab' },
    });

    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.details).toEqual([{ field: 'title', message: 'Es obligatorio.' }]);
    expect(types.statusCode).toBe(400);
    expect(detailsByField(types.json().error.details)).toEqual({
      title: 'Debe ser un texto.',
      count: 'Debe ser un número entero.',
      min: 'Debe ser un número entero.',
      code: 'Debe tener al menos 3 caracteres.',
    });
    expect(types.body).not.toContain('40000');
  });

  it('mensajes por keyword: cuerpo entero, params y querystring', async () => {
    setup();

    const responses = await Promise.all([
      app.inject({ method: 'POST', url: '/test/echo', payload: [] }),
      app.inject({ method: 'POST', url: '/test/echo', headers: json, payload: '"x"' }),
      app.inject({ method: 'PATCH', url: '/test/patch', payload: {} }),
      app.inject({ method: 'GET', url: '/test/items/abc' }),
      app.inject({ method: 'GET', url: '/test/items/007' }),
      app.inject({ method: 'GET', url: '/test/items/1234567890123456' }),
      app.inject({ method: 'GET', url: '/test/items/12?page=2' }),
    ]);
    const details = responses.map((response) => {
      expect(response.statusCode).toBe(400);
      return response.json().error.details;
    });

    expect(details).toEqual([
      [{ field: 'body', message: 'Debe ser un objeto JSON.' }],
      [{ field: 'body', message: 'Debe ser un objeto JSON.' }],
      [{ field: 'body', message: 'Envía al menos un campo.' }],
      [{ field: 'id', message: 'Formato no válido.' }],
      [{ field: 'id', message: 'Formato no válido.' }],
      [{ field: 'id', message: 'Formato no válido.' }],
      [{ field: 'querystring', message: 'Hay campos no permitidos.' }],
    ]);

    const valid = await app.inject({ method: 'GET', url: '/test/items/12' });
    expect(valid.statusCode).toBe(200);
    expect(valid.json()).toEqual({ id: '12' });
  });
});
