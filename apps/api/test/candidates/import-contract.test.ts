import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CA01_ROWS, csvBytes, importCsv } from '../helpers/csv.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';

// Hora y retención de la importación y su contrato con el alta (HU-07 TASK-03). Datos inventados.

const NOW = '2026-10-12T09:00:00.000Z';
const HEADER = 'nombre,email,telefono';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

function lines(rows: string[][]): string[] {
  return [HEADER, ...rows.map((cells) => cells.join(','))];
}

/** Importa en una app nueva con ese reloj y devuelve las filas guardadas. */
async function savedAfterImport(now: string) {
  const fresh = createTestApp({ now: createTestClock(now).now });
  try {
    await importCsv(fresh.app, csvBytes(lines(CA01_ROWS)));
    return fresh.db.prepare('SELECT * FROM candidates ORDER BY id').all();
  } finally {
    await fresh.app.close();
  }
}

describe('POST /api/candidates/import · hora y retención', () => {
  it('EC-36 retención 22:30Z y 31/08', async () => {
    const lateNight = await savedAfterImport('2026-10-12T22:30:00.000Z');
    const endOfAugust = await savedAfterImport('2026-08-31T09:00:00.000Z');

    expect(lateNight.map((row) => row.retention_ends_at)).toEqual(Array(3).fill('2027-04-13'));
    expect(endOfAugust.map((row) => row.retention_ends_at)).toEqual(Array(3).fill('2027-02-28'));
  });

  it('EC-36 un solo now() por importación y ninguno sin filas válidas', async () => {
    const clock = createTestClock(NOW);
    let calls = 0;
    const counted = createTestApp({
      now: () => {
        calls += 1;
        return clock.now();
      },
    });
    try {
      await importCsv(counted.app, csvBytes(lines([['Ana Gil', 'sin-arroba', '']])));
      expect(calls).toBe(0);
      await importCsv(counted.app, csvBytes(lines(CA01_ROWS)));
      expect(calls).toBe(1);
    } finally {
      await counted.app.close();
    }
  });
});

describe('POST /api/candidates/import · contrato con el alta', () => {
  const longEmail = `${'a'.repeat(250)}@example.com`;
  const cases: [string, 'fullName' | 'email' | 'phone', string][] = [
    ['nombre de 1 carácter', 'fullName', 'A'],
    ['nombre de 101 caracteres', 'fullName', 'a'.repeat(101)],
    ['nombre con tabulador en medio', 'fullName', 'Ana\tGil'],
    ['email sin arroba', 'email', 'sin-arroba'],
    ['email de 262 caracteres', 'email', longEmail],
    ['teléfono abc123', 'phone', 'abc123'],
    ['teléfono de 5 cifras', 'phone', '12345'],
  ];
  const COLUMN = { fullName: 'nombre', email: 'email', phone: 'telefono' } as const;
  const BASE = { fullName: 'Ana Gil', email: 'ana.contrato@example.com', phone: '600000001' };

  async function createMessage(
    field: keyof typeof BASE,
    value: string,
  ): Promise<string | undefined> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      payload: { ...BASE, [field]: value },
    });
    expect(response.statusCode).toBe(400);
    const details = response.json().error.details as { field: string; message: string }[];
    return details.find((detail) => detail.field === field)?.message;
  }

  async function importMessage(
    field: keyof typeof BASE,
    value: string,
  ): Promise<string | undefined> {
    const row = { ...BASE, [field]: value };
    const response = await importCsv(
      app,
      csvBytes([HEADER, `${row.fullName},${row.email},${row.phone}`]),
    );
    expect(response.statusCode).toBe(200);
    const [item] = response.json().notImported as {
      errors: { field: string; message: string }[];
    }[];
    return item?.errors.find((error) => error.field === COLUMN[field])?.message;
  }

  it('contrato: los mensajes de fila son los del 400 del alta para los mismos valores', async () => {
    for (const [, field, value] of cases) {
      const fromCreate = await createMessage(field, value);
      expect(fromCreate).toBeTypeOf('string');
      expect(await importMessage(field, value)).toBe(fromCreate);
    }
    expect(Number(db.prepare('SELECT COUNT(*) AS total FROM candidates').get()?.total)).toBe(0);
  });

  it('contrato: excepción de DD-04, el nombre vacío es «obligatorio» en el fichero y «mínimo 2» en el alta', async () => {
    expect(await createMessage('fullName', '')).toBe('Debe tener al menos 2 caracteres.');
    expect(await importMessage('fullName', '')).toBe('Es obligatorio.');
  });
});
