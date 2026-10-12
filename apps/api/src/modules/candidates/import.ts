// Importación de candidatos desde un CSV (DD-05, DD-08 y DD-09 de HU-07): lectura del fichero, clasificación de filas,
// alta todo o nada en una sola transacción e informe. El índice único decide el duplicado; las repeticiones dentro del
// propio fichero las resuelve un mapa en memoria. Nada del fichero se guarda ni se registra (RN-13, RGPD).

import type { Clock } from '../../clock.ts';
import { readImportFile } from './import-file.ts';
import { classifyRows, type RowValidator } from './import-rows.ts';
import type { ImportReport, ImportRow, NotImportedRow } from './import-schemas.ts';
import type { CandidatesRepository } from './repository.ts';

export interface ImportDeps {
  repository: CandidatesRepository;
  /** Reloj inyectado (DEC-09): se pide una sola vez por importación. */
  now: Clock;
  /** `(fn) => withTransaction(db, fn)` (DEC-06). */
  transaction: <T>(fn: () => T) => T;
  /** `recalculateRetention` del servicio: único escritor de `retention_ends_at` (DD-09). */
  recalculate: (id: number) => void;
}

const DUPLICATE_MESSAGE = 'Duplicado.';

/** Filas válidas que no entraron (`duplicate` y `repeated`) y cuántas sí. */
interface InsertOutcome {
  created: number;
  skipped: NotImportedRow[];
}

function duplicateRow(row: number, existingId: number): NotImportedRow {
  return {
    row,
    reason: 'duplicate',
    existingId,
    errors: [{ field: 'email', message: DUPLICATE_MESSAGE }],
  };
}

function repeatedRow(row: number, firstRow: number): NotImportedRow {
  return {
    row,
    reason: 'repeated',
    firstRow,
    errors: [{ field: 'email', message: `Repetido en el fichero (fila ${firstRow}).` }],
  };
}

/**
 * `INSERT` de una fila: el ID creado o, si el índice único lo rechaza, la fila `duplicate` con el ID existente. Tras un
 * `UNIQUE`, SQLite deshace solo la sentencia y la transacción sigue abierta: no hay `ROLLBACK` aquí (DD-05). Cualquier
 * otro error se relanza (→ `ROLLBACK` y 500).
 */
function insertRow(
  repository: CandidatesRepository,
  createdAt: string,
  { row, fullName, email, phone }: ImportRow,
): number | NotImportedRow {
  try {
    return repository.insert(
      { fullName, email, phone, summary: null, skills: [] },
      createdAt,
      null,
    );
  } catch (error) {
    const existingId = repository.existingIdOnDuplicate(error, email);
    if (existingId === undefined) throw error;
    return duplicateRow(row, existingId);
  }
}

/** Da de alta las filas válidas, en orden, dentro de la transacción en curso. */
function insertRows(deps: ImportDeps, rows: ImportRow[]): InsertOutcome {
  const createdAt = deps.now().toISOString();
  const firstRowByEmail = new Map<string, number>();
  const skipped: NotImportedRow[] = [];
  for (const candidate of rows) {
    const firstRow = firstRowByEmail.get(candidate.email);
    if (firstRow !== undefined) {
      skipped.push(repeatedRow(candidate.row, firstRow));
      continue;
    }
    const inserted = insertRow(deps.repository, createdAt, candidate);
    if (typeof inserted !== 'number') {
      skipped.push(inserted);
      continue;
    }
    firstRowByEmail.set(candidate.email, candidate.row);
    deps.recalculate(inserted);
  }
  return { created: firstRowByEmail.size, skipped };
}

function byRow(a: NotImportedRow, b: NotImportedRow): number {
  return a.row - b.row;
}

/** Lee el fichero, da de alta las filas válidas todo o nada y devuelve el informe (nunca valores del fichero). */
export function importCandidates(
  deps: ImportDeps,
  bytes: Uint8Array,
  validateRow: RowValidator,
): ImportReport {
  const records = readImportFile(bytes);
  const { valid, invalid } = classifyRows(records, validateRow);
  // Con 0 filas válidas no se abre transacción (DD-09).
  const { created, skipped } =
    valid.length === 0
      ? { created: 0, skipped: [] }
      : deps.transaction(() => insertRows(deps, valid));
  return {
    dataRows: records.length,
    created,
    duplicates: skipped.length,
    invalid: invalid.length,
    notImported: [...invalid, ...skipped].sort(byRow),
  };
}
