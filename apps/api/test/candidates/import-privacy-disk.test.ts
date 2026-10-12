import type { FastifyInstance } from 'fastify';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { csvBytes, importCsv } from '../helpers/csv.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';

// TASK-05 [adversarial] (CA-17, RNF-02, RNF-03 API): nada del fichero va a disco, ni en `os.tmpdir()` ni en la carpeta
// `data/` de la raíz del repo, tras una importación válida y otra rechazada. Datos inventados.
const NOW = '2026-10-12T09:00:00.000Z';
const HEADER = 'nombre,email,telefono';
const MARKER = 'marcador-csv-unico-7f3a9c';
const DATA_DIR = fileURLToPath(new URL('../../../../data/', import.meta.url));

let app: FastifyInstance;

beforeEach(() => {
  ({ app } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

/** Nombres de la carpeta `data/` de la raíz del repo (vacío si no existe todavía). */
function listDataDir(): string[] {
  return existsSync(DATA_DIR) ? readdirSync(DATA_DIR).sort() : [];
}

describe('RNF-02 · RNF-03 · nada del fichero va a disco', () => {
  it('RNF-03 ningún fichero nuevo de os.tmpdir() ni de data/ gana el CSV tras una importación válida y otra rechazada', async () => {
    const tmpBefore = new Set(readdirSync(tmpdir()));
    const dataBefore = listDataDir();
    const good = csvBytes([HEADER, `Persona ${MARKER},${MARKER}@example.com,`]);
    const broken = csvBytes([HEADER, `"${MARKER}`]);

    expect((await importCsv(app, good)).statusCode).toBe(200);
    expect((await importCsv(app, broken)).statusCode).toBe(400);

    const created = readdirSync(tmpdir()).filter((name) => !tmpBefore.has(name));
    for (const name of created) {
      expect(name).not.toContain(MARKER);
      expect(filesContaining(join(tmpdir(), name), MARKER)).toEqual([]);
    }
    // DP-01: la carpeta `data/` no gana ficheros (listado antes y después).
    expect(listDataDir()).toEqual(dataBefore);
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
