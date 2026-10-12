import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { loggerOptions } from '../../src/logger.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { CA01_ROWS, csvBytes, excelSpanishCsv, importCsv } from '../helpers/csv.ts';
import { createTestClock, failWrites } from '../helpers/test-app.ts';

// TASK-05 [adversarial] (CA-17, RNF-02, RNF-03 API, RNF-04, RNF-06, EC-33, EC-40, EC-47): con el logger de la app
// capturado, ni las líneas de log ni los cuerpos de respuesta (informe, `message`, `details`) llevan valores del
// fichero ni datos del existente, y nada del fichero va a disco. Datos inventados.
const NOW = '2026-10-12T09:00:00.000Z';
const HEADER = 'nombre,email,telefono';
const MARKER = 'marcador-csv-unico-7f3a9c';
// Valores que no pueden salir en ningún log ni respuesta, de todos los ficheros de este test.
const CA01_VALUES = CA01_ROWS.flat()
  .filter(Boolean)
  .map((value) => value.trim());
const PERSONAL = [
  ...CA01_VALUES,
  ...CA01_VALUES.map((value) => value.toLowerCase()),
  'Ana Casas Vera',
  'ana.casas@example.com',
  '+34 600 000 021',
  'Resumen inventado reservado',
  'Otra Ana',
  'no-es-email',
  'abc-hostil',
  'nombre;email;telefono',
  'consentimiento',
  'Correo,Móvil',
  'José Núñez',
  'jose.nunez@example.com',
  'Marta Pons Sala',
  'marta.pons@example.com',
  'relleno.grande@example.com',
  MARKER,
];

let app: FastifyInstance;
let db: DatabaseSync;
let logLines: string[];

beforeEach(() => {
  logLines = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      logLines.push(String(chunk));
      done();
    },
  });
  db = openDatabase(':memory:');
  migrate(db);
  app = buildApp({ db, now: createTestClock(NOW).now, logger: { ...loggerOptions, stream } });
});

afterEach(async () => {
  await app.close();
});

function logs(): string {
  return logLines.join('');
}

function lines(rows: string[][]): string[] {
  return [HEADER, ...rows.map((cells) => cells.join(','))];
}

/** Estado esperado y ningún valor del fichero ni del existente en el cuerpo ni en los logs. */
function expectClean(response: LightMyRequestResponse, status: number): void {
  expect(response.statusCode).toBe(status);
  for (const personal of PERSONAL) {
    expect(response.body).not.toContain(personal);
    expect(logs()).not.toContain(personal);
  }
  expect(response.body).not.toContain('stack');
  expect(response.body).not.toContain('SQLITE');
}

describe('CA-17 · ni logs ni respuestas llevan valores del fichero', () => {
  it('CA-01 importación correcta → informe y logs sin valores, solo método y ruta', async () => {
    const response = await importCsv(app, csvBytes(lines(CA01_ROWS)));

    expectClean(response, 200);
    expect(response.json()).toMatchObject({ dataRows: 3, created: 3 });
    expect(logs()).toContain('"path":"/api/candidates/import"');
  });

  it('CA-04 duplicado de un existente → solo existingId, sin nombre, email, teléfono ni resumen de Ana', async () => {
    const ana = await createCandidate(app, {
      fullName: 'Ana Casas Vera',
      email: 'ana.casas@example.com',
      phone: '+34 600 000 021',
      summary: 'Resumen inventado reservado',
    });

    const response = await importCsv(
      app,
      csvBytes(lines([['Otra Ana', ' ANA.Casas@Example.com ', '']])),
    );

    expectClean(response, 200);
    expect(response.json<{ notImported: { existingId: number }[] }>().notImported[0]).toMatchObject(
      {
        reason: 'duplicate',
        existingId: ana.id,
      },
    );
  });

  it('CA-08 filas inválidas → columna y motivo fijos, sin el valor recibido', async () => {
    const rows = [
      ['', 'no-es-email', 'abc-hostil'],
      ['Persona Válida', 'persona.valida@example.com', ''],
      ['Marcos Vidal Roca', 'marcos.vidal@example.com'],
    ];

    const response = await importCsv(app, csvBytes(lines(rows)));

    expectClean(response, 200);
    expect(response.json()).toMatchObject({ dataRows: 3, created: 1, invalid: 2 });
  });

  it('CA-11 cabecera distinta, también la de Excel en español → 400 sin repetir la cabecera recibida', async () => {
    const files = [
      excelSpanishCsv(),
      csvBytes(['nombre;email;telefono', 'Lucía Ferrer Prat;lucia.ferrer@example.com;']),
      csvBytes(['Nombre completo,Correo,Móvil', 'Noa Serra Gil,noa.serra@example.com,']),
      csvBytes([`${HEADER},consentimiento`, 'Noa Serra Gil,noa.serra@example.com,,sí']),
    ];

    for (const file of files) expectClean(await importCsv(app, file), 400);
    expect(Number(db.prepare('SELECT COUNT(*) AS n FROM candidates').get()?.n)).toBe(0);
  });

  it('CA-12 Latin-1, PNG y comillas sin cerrar → 400 sin texto del fichero', async () => {
    const latin1 = Buffer.from(`${HEADER}\nJosé Núñez,jose.nunez@example.com,\n`, 'latin1');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe]);
    const unclosed = csvBytes([
      ...lines(CA01_ROWS.slice(0, 2)),
      '"Marta Pons Sala,marta.pons@example.com,+34 600 000 032',
    ]);

    for (const file of [latin1, png, unclosed]) expectClean(await importCsv(app, file), 400);
  });

  it('CA-13 sin candidatos (vacío, solo BOM, solo cabecera, cabecera y blancos) → 400 sin texto del fichero', async () => {
    const files = [
      csvBytes([]),
      csvBytes([], { bom: true }),
      csvBytes([HEADER]),
      csvBytes([HEADER, '', '   ', '\t'], { eol: '\r\n', finalEol: true }),
    ];

    for (const file of files) expectClean(await importCsv(app, file), 400);
  });

  it('CA-14 501 filas y más de 1 MiB → 400 y 413 sin texto del fichero', async () => {
    const tooManyRows = csvBytes(
      lines(Array.from({ length: 501 }, (_, i) => [`Candidata ${i}`, `c${i}@example.com`, ''])),
    );
    const padding = 'x'.repeat(1_048_577);
    const tooBig = csvBytes(lines([['Persona 1 Prueba', 'relleno.grande@example.com', padding]]));

    expectClean(await importCsv(app, tooManyRows), 400);
    expectClean(await importCsv(app, tooBig), 413);
  });

  it('CA-15 fallo de la base a mitad → 500 genérico, el log lleva el error de SQLite y ningún valor del fichero', async () => {
    failWrites(db, 'UPDATE', {
      table: 'candidates',
      column: 'retention_ends_at',
      whenNew: { column: 'id', equals: 2 },
    });

    const response = await importCsv(app, csvBytes(lines(CA01_ROWS)));

    expectClean(response, 500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
    });
    const entries = logLines.map(
      (line) => JSON.parse(line) as { level: number; err?: { message: string } },
    );
    expect(entries.find((entry) => entry.level >= 50)?.err?.message).toContain('fallo simulado');
  });
});

describe('RNF-04 · RNF-06 · EC-33 · EC-47 · el informe y el 500', () => {
  it('RNF-04/EC-33/EC-47 el informe solo tiene claves del esquema y existingId de los existentes', async () => {
    const ana = await createCandidate(app, {
      fullName: 'Ana Casas Vera',
      email: 'ana.casas@example.com',
    });
    const file = csvBytes(
      lines([
        ['Lucía Ferrer Prat', 'lucia.ferrer@example.com', ''],
        ['Otra Ana', 'ana.casas@example.com', ''],
        ['', 'no-es-email', ''],
        ['Lucía Ferrer Prat', 'lucia.ferrer@example.com', ''],
      ]),
    );

    const response = await importCsv(app, file);

    expectClean(response, 200);
    const report = response.json<{ notImported: Record<string, unknown>[] }>();
    expect(Object.keys(report).sort()).toEqual(
      ['created', 'dataRows', 'duplicates', 'invalid', 'notImported'].sort(),
    );
    // La fila 2 se creó: no aparece. Quedan las filas 3 (duplicate), 4 (invalid) y 5 (repeated).
    expect(report.notImported.map((entry) => entry.row)).toEqual([3, 4, 5]);
    const keysByReason: Record<string, string[]> = {
      duplicate: ['errors', 'existingId', 'reason', 'row'],
      invalid: ['errors', 'reason', 'row'],
      repeated: ['errors', 'firstRow', 'reason', 'row'],
    };
    for (const entry of report.notImported) {
      expect(Object.keys(entry).sort()).toEqual(keysByReason[String(entry.reason)]);
      for (const error of entry.errors as Record<string, unknown>[]) {
        expect(Object.keys(error).sort()).toEqual(['field', 'message']);
      }
    }
    expect(report.notImported[0]?.existingId).toBe(ana.id);
    expect(report.notImported[2]?.firstRow).toBe(2);
  });

  it('RNF-06 500 sin stack trace ni rutas de fichero en la respuesta', async () => {
    failWrites(db, 'INSERT', { table: 'candidates' });

    const response = await importCsv(app, csvBytes(lines(CA01_ROWS)));

    expectClean(response, 500);
    expect(response.body).not.toMatch(/\bat\s+\S+\s*\(|\.ts:\d|node:|fallo simulado/);
    expect(Object.keys(response.json<{ error: object }>().error).sort()).toEqual([
      'code',
      'message',
    ]);
  });
});

describe('RNF-02 · RNF-03 · nada del fichero va a disco', () => {
  it('RNF-03 ningún fichero nuevo de os.tmpdir() contiene el marcador del CSV', async () => {
    const before = new Set(readdirSync(tmpdir()));
    const good = csvBytes(lines([[`Persona ${MARKER}`, `${MARKER}@example.com`, '']]));
    const broken = csvBytes([HEADER, `"${MARKER}`]);

    expect((await importCsv(app, good)).statusCode).toBe(200);
    expect((await importCsv(app, broken)).statusCode).toBe(400);

    const created = readdirSync(tmpdir()).filter((name) => !before.has(name));
    for (const name of created) {
      expect(name).not.toContain(MARKER);
      expect(filesContaining(join(tmpdir(), name), MARKER)).toEqual([]);
    }
  });

  it('ningún fichero de apps/api/src/modules/candidates/ importa node:fs', () => {
    const dir = fileURLToPath(new URL('../../src/modules/candidates/', import.meta.url));
    const sources = readdirSync(dir).filter((name) => name.endsWith('.ts'));

    expect(sources.length).toBeGreaterThanOrEqual(10);
    for (const name of sources) {
      const source = readFileSync(join(dir, name), 'utf8');
      expect(source, name).not.toMatch(/['"](node:)?fs(\/promises)?['"]/);
    }
  });
});

/** Rutas de ficheros regulares bajo `path` (o `path` mismo) cuyo contenido incluye `marker`. */
function filesContaining(path: string, marker: string): string[] {
  try {
    const info = statSync(path);
    if (info.isDirectory()) {
      return readdirSync(path).flatMap((child) => filesContaining(join(path, child), marker));
    }
    return info.isFile() && readFileSync(path).includes(marker) ? [path] : [];
  } catch {
    return []; // desaparece o no se puede leer: no es un fichero del CSV
  }
}
