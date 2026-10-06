import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { duplicate, type ErrorDetail } from '../../src/errors.ts';
import { forbiddenFields, idParamsSchema } from '../../src/http/validation.ts';
import { createTestApp } from '../helpers/test-app.ts';

// Enmienda de DEC-11.4 (HU-03 TASK-01): `details` acotado al esquema. Rutas auxiliares registradas tras `buildApp`.
// Datos inventados.

const DECLARED = ['title', 'tags', 'flag', 'count', 'id', 'createdAt'] as const;

const bodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title'],
  properties: {
    title: { type: 'string', minLength: 3 },
    tags: { type: 'array', maxItems: 2, items: { type: 'string' } },
    flag: { type: 'boolean' },
    count: { type: 'number' },
    ...forbiddenFields(['id', 'createdAt']),
  },
} as const;

const querySchema = {
  type: 'object',
  additionalProperties: false,
  properties: { page: { type: 'string', pattern: '^[1-9][0-9]{0,8}$' } },
} as const;

let app: FastifyInstance;

beforeEach(() => {
  ({ app } = createTestApp());
  app.post('/test/strict', { schema: { body: bodySchema } }, () => ({ ok: true }));
  app.get('/test/query', { schema: { querystring: querySchema } }, () => ({ ok: true }));
  app.get('/test/params/:id', { schema: { params: idParamsSchema } }, () => ({ ok: true }));
  app.post('/test/duplicate', () => {
    throw duplicate({
      field: 'email',
      message: 'Ya existe un registro con este valor.',
      existingId: 42,
    });
  });
});

afterEach(async () => {
  await app.close();
});

const post = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/test/strict', payload });

function detailsOf(response: LightMyRequestResponse): ErrorDetail[] {
  expect(response.statusCode).toBe(400);
  return response.json<{ error: { details: ErrorDetail[] } }>().error.details;
}

describe('details acotado al esquema (DEC-11.4)', () => {
  it('RNF-08/EC-59 claves no declaradas → un elemento body sin nombres', async () => {
    const extra = Object.fromEntries(
      Array.from({ length: 1000 }, (_, index) => [`clave${index}`, 'x']),
    );

    const response = await post({ title: 'Título inventado', ...extra });

    expect(detailsOf(response)).toEqual([{ field: 'body', message: 'Hay campos no permitidos.' }]);
    expect(response.body).not.toContain('clave');
  });

  it('RNF-08 querystring desconocido → un elemento querystring sin nombres', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test/query?secreto=1&otro=2&page=3',
    });

    expect(detailsOf(response)).toEqual([
      { field: 'querystring', message: 'Hay campos no permitidos.' },
    ]);
    expect(response.body).not.toContain('secreto');
  });

  it('RF-01 params inválido sigue nombrando el campo declarado', async () => {
    const valid = await app.inject({ method: 'GET', url: '/test/params/12' });
    const invalid = await app.inject({ method: 'GET', url: '/test/params/abc' });

    expect(valid.statusCode).toBe(200);
    expect(detailsOf(invalid)).toEqual([{ field: 'id', message: 'Formato no válido.' }]);
  });

  it('RF-01 esquema false → campo nombrado con «Campo no permitido.»', async () => {
    const response = await post({ title: 'Título inventado', id: 7, createdAt: 'ayer' });

    const details = detailsOf(response);
    expect(details).toHaveLength(2);
    expect(details).toEqual(
      expect.arrayContaining([
        { field: 'id', message: 'Campo no permitido.' },
        { field: 'createdAt', message: 'Campo no permitido.' },
      ]),
    );
  });

  it('RNF-08 details.length ≤ propiedades + 1 con errores mezclados', async () => {
    const extra = Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`x${index}`, 1]));

    const response = await post({
      title: 'ab',
      tags: ['a', 'b', 'c'],
      flag: 'quizá',
      count: 'tres',
      id: 1,
      createdAt: 'ayer',
      ...extra,
    });

    const details = detailsOf(response);
    const fields = details.map(({ field }) => field);
    expect(new Set(fields).size).toBe(fields.length);
    expect(details.length).toBeLessThanOrEqual(DECLARED.length + 1);
    expect(new Set(fields)).toEqual(new Set([...DECLARED, 'body']));
  });

  it('mensajes nuevos: maxItems, array, boolean y tipo sin mensaje propio', async () => {
    const response = await post({ title: 'Título inventado', tags: ['a', 'b', 'c'], flag: 1 });
    const array = await post({ title: 'Título inventado', tags: 'a' });
    const fallback = await post({ title: 'Título inventado', count: 'tres' });

    expect(detailsOf(response)).toEqual(
      expect.arrayContaining([
        { field: 'tags', message: 'Debe tener como máximo 2 elementos.' },
        { field: 'flag', message: 'Debe ser verdadero o falso.' },
      ]),
    );
    expect(detailsOf(array)).toEqual([{ field: 'tags', message: 'Debe ser una lista.' }]);
    expect(detailsOf(fallback)).toEqual([{ field: 'count', message: 'Tipo de dato no válido.' }]);
  });

  it('RF-01 un elemento de un array inválido sale como el campo del array', async () => {
    const response = await post({ title: 'Título inventado', tags: ['a', 7] });

    expect(detailsOf(response)).toEqual([{ field: 'tags', message: 'Debe ser un texto.' }]);
  });

  it('RF-01 existingId pasa al envelope en un 409 DUPLICATE', async () => {
    const response = await app.inject({ method: 'POST', url: '/test/duplicate' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'DUPLICATE',
        message: 'Ya existe un registro con este valor.',
        details: [
          { field: 'email', message: 'Ya existe un registro con este valor.', existingId: 42 },
        ],
      },
    });
  });
});
