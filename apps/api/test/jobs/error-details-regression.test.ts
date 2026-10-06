import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJob, createTestApp } from '../helpers/test-app.ts';

// Regresión de la enmienda de DEC-11.4 (HU-03 TASK-01). Se escribió y se ejecutó en verde ANTES de tocar el manejador
// de errores, y debe seguir en verde después: fija el mapa `field → message` COMPLETO de tres respuestas de ofertas
// (alta, edición y listado). Los solo lectura siguen saliendo con su nombre; los errores de formato, longitud y valor
// no cambian. Datos inventados.

let app: FastifyInstance;

beforeEach(() => {
  ({ app } = createTestApp());
});

afterEach(async () => {
  await app.close();
});

interface ErrorBody {
  error: { code: string; message: string; details: { field: string; message: string }[] };
}

/** `details` como mapa campo → mensaje; comprueba antes que ningún campo se repite. */
function detailsMap(response: { statusCode: number; json: <T>() => T }): Record<string, string> {
  expect(response.statusCode).toBe(400);
  const { error } = response.json<ErrorBody>();
  expect(error.code).toBe('VALIDATION_ERROR');
  expect(error.message).toBe('Hay campos con errores.');
  expect(new Set(error.details.map(({ field }) => field)).size).toBe(error.details.length);
  return Object.fromEntries(error.details.map(({ field, message }) => [field, message]));
}

describe('regresión de details en ofertas (DEC-11.4)', () => {
  it('RNF-08 alta con varios campos inválidos más status y createdAt → mapa completo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        title: 'ab',
        description: 'x'.repeat(5001),
        location: 'a',
        workMode: 'teletrabajo',
        salaryMin: 0,
        salaryMax: '40000',
        status: 'published',
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    });

    expect(detailsMap(response)).toEqual({
      title: 'Debe tener al menos 3 caracteres.',
      description: 'Debe tener como máximo 5000 caracteres.',
      location: 'Debe tener al menos 2 caracteres.',
      workMode: 'Debe ser uno de estos valores: presencial, híbrida, remota.',
      salaryMin: 'Debe ser mayor que 0.',
      salaryMax: 'Debe ser un número entero.',
      status: 'Campo no permitido.',
      createdAt: 'Campo no permitido.',
    });
  });

  it('RNF-08 edición con varios campos inválidos más publishedAt → mapa completo', async () => {
    const created = await createJob(app, { title: 'Responsable de nóminas' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/jobs/${created.id}`,
      payload: {
        title: 'ab',
        location: 'a',
        workMode: 'teletrabajo',
        salaryMin: -5,
        publishedAt: '2020-01-01T00:00:00.000Z',
      },
    });

    expect(detailsMap(response)).toEqual({
      title: 'Debe tener al menos 3 caracteres.',
      location: 'Debe tener al menos 2 caracteres.',
      workMode: 'Debe ser uno de estos valores: presencial, híbrida, remota.',
      salaryMin: 'Debe ser mayor que 0.',
      publishedAt: 'Campo no permitido.',
    });
  });

  it('RNF-08 listado con page=0, pageSize=101, status=x y q de 101 caracteres → mapa completo', async () => {
    const q = 'a'.repeat(101);

    const response = await app.inject({
      method: 'GET',
      url: `/api/jobs?page=0&pageSize=101&status=x&q=${q}`,
    });

    expect(detailsMap(response)).toEqual({
      page: 'Formato no válido.',
      pageSize: 'Formato no válido.',
      status: 'Debe ser uno de estos valores: draft, published, closed.',
      q: 'Debe tener como máximo 100 caracteres.',
    });
  });
});
