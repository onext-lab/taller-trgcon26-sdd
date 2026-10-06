import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCandidateBodySchema } from '../../src/modules/candidates/schemas.ts';
import { createProcessesStub } from '../helpers/candidates.ts';
import { createTestApp, createTestClock, failWrites } from '../helpers/test-app.ts';

// TASK-06 [adversarial]: entradas hostiles y fallos en POST /api/candidates. Datos inventados.
// «No se crea nada» = `SELECT COUNT(*) FROM candidates` sigue a 0.
const NOW = '2026-10-06T09:00:00.000Z';
const GENERIC_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};
const INVALID_FORMAT = 'Formato no válido.';
const DUPLICATE_MESSAGE = 'Ya existe un candidato con este email.';

let app: FastifyInstance;
let db: DatabaseSync;

function start(options: Parameters<typeof createTestApp>[0] = {}): void {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now, ...options }));
}

beforeEach(() => start());

afterEach(async () => {
  await app.close();
});

function post(payload: unknown) {
  return app.inject({ method: 'POST', url: '/api/candidates', payload: payload as object });
}

function postRaw(payload: string) {
  const headers = { 'content-type': 'application/json' };
  return app.inject({ method: 'POST', url: '/api/candidates', headers, payload });
}

function countRows(): number {
  return Number(db.prepare('SELECT COUNT(*) AS total FROM candidates').get()?.total);
}

/** Cuerpo mínimo válido; `overrides` pisa los campos. */
function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { fullName: 'Ana Gil', email: 'ana.gil@example.com', ...overrides };
}

interface ErrorBody {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
}

function expectNoLeak(response: LightMyRequestResponse, leaked: string[]): void {
  for (const text of [...leaked, 'stack', 'SQLITE', 'fallo simulado']) {
    expect(response.body).not.toContain(text);
  }
}

/** 400 con `details` exactamente `[{ field, message }]`, sin el valor enviado y sin filas nuevas. */
function expectRejected(res: LightMyRequestResponse, field: string, message: string, sent = '') {
  expect(res.statusCode).toBe(400);
  const { error } = res.json<ErrorBody>();
  expect(error.code).toBe('VALIDATION_ERROR');
  expect(error.details).toEqual([{ field, message }]);
  expectNoLeak(res, sent.length >= 5 ? [sent] : []);
  expect(countRows()).toBe(0);
}

describe('POST /api/candidates — cuerpos que no son un objeto JSON (EC-01, RNF-05)', () => {
  it('EC-01 cuerpo no JSON → 400 «no es JSON válido» sin filas ni stack', async () => {
    const response = await postRaw('no es json');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'El cuerpo de la petición no es JSON válido.',
        details: [{ field: 'body', message: 'Debe ser un objeto JSON.' }],
      },
    });
    expectNoLeak(response, []);
    expect(countRows()).toBe(0);
  });

  it.each(['[]', '"x"', 'null', '42'])('EC-01 cuerpo %s → 400 en body', async (raw) => {
    expectRejected(await postRaw(raw), 'body', 'Debe ser un objeto JSON.');
  });
});

describe('POST /api/candidates — tipos y mass assignment (EC-02)', () => {
  it('EC-02 consent "sí" → 400 en consent', async () => {
    expectRejected(await post(valid({ consent: 'sí' })), 'consent', 'Debe ser verdadero o falso.');
  });

  it.each(['retentionEndsAt', 'createdAt', 'consentGivenAt', 'consentVersion'])(
    'EC-02 campo de solo lectura %s → 400 con su nombre',
    async (field) => {
      const response = await post(valid({ [field]: 'valor-hostil-99' }));
      expectRejected(response, field, 'Campo no permitido.', 'valor-hostil-99');
    },
  );

  it.each(['consentWithdrawnAt', 'id'])('EC-02 campo de solo lectura %s → 400', async (field) => {
    expectRejected(await post(valid({ [field]: 7 })), field, 'Campo no permitido.');
  });
});

describe('POST /api/candidates — fuera de rango o con formato inválido (CA-04, EC-09 a EC-13)', () => {
  const min = (n: number) => `Debe tener al menos ${n} caracteres.`;
  const max = (n: number) => `Debe tener como máximo ${n} caracteres.`;
  const skills21 = Array.from({ length: 21 }, (_, i) => `skill-${i}`);
  const email255 = `${'a'.repeat(243)}@example.com`;

  it.each<[string, Record<string, unknown>, string, string]>([
    ['nombre de 1 carácter', { fullName: 'A' }, 'fullName', min(2)],
    ['nombre de 101 caracteres', { fullName: 'a'.repeat(101) }, 'fullName', max(100)],
    ['nombre de solo espacios', { fullName: '   ' }, 'fullName', min(2)],
    ['nombre que no es texto', { fullName: 12345678 }, 'fullName', 'Debe ser un texto.'],
    ['email ana.gil', { email: 'ana.gil' }, 'email', INVALID_FORMAT],
    ['email ana.gil@', { email: 'ana.gil@' }, 'email', INVALID_FORMAT],
    ['email de 255 caracteres', { email: email255 }, 'email', max(254)],
    ['teléfono abc123', { phone: 'abc123' }, 'phone', INVALID_FORMAT],
    ['teléfono 12345', { phone: '12345' }, 'phone', INVALID_FORMAT],
    ['teléfono ------', { phone: '------' }, 'phone', INVALID_FORMAT],
    ['teléfono con 21 cifras tras el +', { phone: `+${'1'.repeat(21)}` }, 'phone', INVALID_FORMAT],
    ['21 skills distintas', { skills: skills21 }, 'skills', 'Debe tener como máximo 20 elementos.'],
    ['skill de 41 caracteres', { skills: ['a'.repeat(41)] }, 'skills', max(40)],
    ['skill numérica 42', { skills: [42] }, 'skills', 'Debe ser un texto.'],
    ['skills que no es lista', { skills: 'sql' }, 'skills', 'Debe ser una lista.'],
  ])('CA-04 %s → 400 en su campo', async (_description, override, field, message) => {
    const sent = String(Object.values(override)[0]);
    expectRejected(await post(valid(override)), field, message, sent);
  });
});

describe('POST /api/candidates — caracteres de control (EC-58)', () => {
  it.each<[string, Record<string, unknown>, string]>([
    ['NUL en el nombre', { fullName: 'Ana\u0000Gil' }, 'fullName'],
    ['salto de línea en el nombre', { fullName: 'Ana\nGil' }, 'fullName'],
    ['tabulador interior en una skill', { skills: ['sq\tl'] }, 'skills'],
    ['DEL en el email', { email: 'ana\u007Fgil@example.com' }, 'email'],
    ['DEL en el teléfono', { phone: '600\u007F000001' }, 'phone'],
    ['BEL (U+0007) en el resumen', { summary: 'Resumen\u0007inventado' }, 'summary'],
  ])('EC-58 %s → 400 en su campo', async (_description, override, field) => {
    expectRejected(await post(valid(override)), field, INVALID_FORMAT);
  });

  it('EC-58 resumen con \\n, \\r y \\t → 201 y se guarda tal cual', async () => {
    const summary = 'Línea 1\n\r\tLínea 2';
    const response = await post(valid({ summary }));

    expect(response.statusCode).toBe(201);
    expect(response.json<{ summary: string }>().summary).toBe(summary);
  });
});

describe('POST /api/candidates — email duplicado (CA-05, EC-05, EC-07, EC-08)', () => {
  const existing = {
    fullName: 'Lucía Ferrer Soler',
    email: 'lucia.ferrer@example.com',
    phone: '600 000 001',
    summary: 'Resumen inventado del existente',
    skills: ['typescript'],
  };

  const conflict = (existingId: number | undefined) => ({
    error: {
      code: 'DUPLICATE',
      message: expect.any(String),
      details: [{ field: 'email', message: DUPLICATE_MESSAGE, existingId }],
    },
  });

  it('CA-05/EC-05/EC-07 mismo email en otras mayúsculas → 409 DUPLICATE sin datos del existente', async () => {
    const first = await post(existing);
    const response = await post(valid({ email: 'LUCIA.FERRER@example.com' }));

    expect(first.statusCode).toBe(201);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(conflict(first.json<{ id: number }>().id));
    expectNoLeak(response, ['lucia', 'Lucía', 'Ferrer', '600', 'Resumen', 'typescript']);
    expect(countRows()).toBe(1);
  });

  it('EC-08 dos altas iguales a la vez → un 201 y un 409 con el ID del primero, y una fila', async () => {
    const responses = await Promise.all([post(existing), post(existing)]);

    const created = responses.find((response) => response.statusCode === 201);
    const rejected = responses.find((response) => response.statusCode === 409);
    expect(created).toBeDefined();
    expect(rejected?.json()).toEqual(conflict(created?.json<{ id: number }>().id));
    expect(countRows()).toBe(1);
  });
});

describe('POST /api/candidates — fallos de dependencia (CA-06, EC-04, EC-53)', () => {
  it('CA-06/EC-04 fallo de SQLite en el INSERT → 500 genérico, sin datos personales y sin filas', async () => {
    failWrites(db, 'INSERT', { table: 'candidates' });

    const response = await post(valid({ phone: '600 000 002', summary: 'Resumen inventado' }));

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(GENERIC_ERROR);
    expectNoLeak(response, ['ana.gil', 'Ana', '600', 'Resumen']);
    expect(countRows()).toBe(0);
  });

  it('EC-53 fallo del puerto de procesos → 500 y el INSERT se deshace (0 filas)', async () => {
    await app.close();
    start({ candidateProcesses: createProcessesStub({ fail: true }) });

    const response = await post(valid());

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(GENERIC_ERROR);
    expectNoLeak(response, ['ana.gil']);
    expect(countRows()).toBe(0);
  });
});

describe('POST /api/candidates — cuerpos enormes y texto hostil (EC-17)', () => {
  it('EC-17 resumen de 1 MB (< 1 MiB) → 400 en summary sin repetir el valor', async () => {
    const response = await post(valid({ summary: 'a'.repeat(1_000_000) }));

    expectRejected(response, 'summary', 'Debe tener como máximo 2000 caracteres.', 'a'.repeat(50));
    expect(response.body.length).toBeLessThan(2000);
  });

  it('EC-17 cuerpo de más de 1 MiB → 413 PAYLOAD_TOO_LARGE', async () => {
    const response = await postRaw(JSON.stringify(valid({ summary: 'a'.repeat(1_048_576) })));

    expect(response.statusCode).toBe(413);
    expect(response.json<ErrorBody>().error).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'El cuerpo de la petición es demasiado grande.',
    });
    expect(countRows()).toBe(0);
  });

  it('EC-17 resumen <script>alert(1)</script> → 201 y se devuelve literal', async () => {
    const summary = '<script>alert(1)</script>';
    const response = await post(valid({ summary }));

    expect(response.statusCode).toBe(201);
    expect(response.json<{ summary: string }>().summary).toBe(summary);
  });
});

describe('POST /api/candidates — details acotado (EC-59, RNF-08)', () => {
  const unknownKeys = (count: number): Record<string, string> =>
    Object.fromEntries(Array.from({ length: count }, (_, i) => [`extra${i}`, 'x']));

  it('EC-59 1 000 claves desconocidas, una con un email ajeno → un solo detalle sin nombrarlas', async () => {
    const response = await post(valid({ ...unknownKeys(1000), 'lucia.ferrer@example.com': 'x' }));

    expectRejected(response, 'body', 'Hay campos no permitidos.', 'lucia.ferrer@example.com');
    expectNoLeak(response, ['lucia', 'extra']);
  });

  it('RNF-08 errores mezclados + 1 000 claves → details.length ≤ propiedades del esquema + 1', async () => {
    const readOnly = ['id', 'createdAt', 'retentionEndsAt', 'consentGivenAt', 'consentVersion'];
    const response = await post({
      ...unknownKeys(1000),
      ...Object.fromEntries(readOnly.map((field) => [field, 'x'])),
      consentWithdrawnAt: 'x',
      fullName: 'A',
      email: 'ana.gil',
      phone: 'abc123',
      summary: 'Resumen\u0007inventado',
      skills: [42],
      consent: 'sí',
    });

    expect(response.statusCode).toBe(400);
    const { details = [] } = response.json<ErrorBody>().error;
    const declared = Object.keys(createCandidateBodySchema.properties).length;
    expect(details.length).toBeGreaterThan(1);
    expect(details.length).toBeLessThanOrEqual(declared + 1);
    expect(new Set(details.map((detail) => detail.field)).size).toBe(details.length);
    expect(countRows()).toBe(0);
  });
});
