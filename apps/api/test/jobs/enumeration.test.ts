import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listenOptions } from '../../src/listen-options.ts';
import { jobSchema } from '../../src/modules/jobs/schemas.ts';
import { createJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// EC-32 (RF-04, categoría 6): la enumeración de IDs es un riesgo aceptado porque la API solo escucha en loopback y la
// ficha solo devuelve campos de oferta. Datos inventados.
const NOW = '2026-10-06T22:30:00.000Z';
const JOB_KEYS = Object.keys(jobSchema.properties).sort();

let app: FastifyInstance;

beforeEach(() => {
  ({ app } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

describe('EC-32 la API escucha solo en loopback por defecto', () => {
  it('EC-32 sin variables de entorno → 127.0.0.1:3001', () => {
    expect(listenOptions({})).toEqual({ host: '127.0.0.1', port: 3001 });
  });

  it('EC-32 las variables ajenas no cambian el host', () => {
    expect(listenOptions({ HOST: '0.0.0.0', PORT: '8080' })).toEqual({
      host: '127.0.0.1',
      port: 3001,
    });
  });

  it('EC-32 solo API_HOST y API_PORT, explícitos, cambian dónde escucha', () => {
    expect(listenOptions({ API_HOST: '0.0.0.0', API_PORT: '4000' })).toEqual({
      host: '0.0.0.0',
      port: 4000,
    });
  });
});

describe('EC-32 recorrer IDs secuenciales no destapa más que ofertas', () => {
  it('EC-32 GET /api/jobs/1..N → campos exactos de oferta o 404 en el envelope', async () => {
    const titles = ['Oferta inventada uno', 'Oferta inventada dos', 'Oferta inventada tres'];
    const created = [];
    for (const title of titles) {
      created.push(await createJob(app, { title, description: 'Texto inventado', salaryMin: 1 }));
    }
    // Un hueco en la secuencia: se borra la segunda.
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/jobs/${created[1]!.id}` })).statusCode,
    ).toBe(204);

    const maxId = created.length + 3;
    const found: number[] = [];
    for (let id = 1; id <= maxId; id += 1) {
      const response = await app.inject({ method: 'GET', url: `/api/jobs/${id}` });
      if (response.statusCode === 200) {
        found.push(id);
        expect(Object.keys(response.json<object>()).sort()).toEqual(JOB_KEYS);
      } else {
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
          error: { code: 'NOT_FOUND', message: 'La oferta no existe.' },
        });
      }
    }

    expect(found).toEqual([created[0]!.id, created[2]!.id]);
  });
});
