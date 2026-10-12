// Validación del fichero entero de la importación (DT-03, DT-08 y DD-07 de HU-07): un solo error por fichero, en un
// orden fijo, con textos que nunca llevan nada del fichero (RF-06, EC-16).

import { AppError } from '../../errors.ts';
import { decodeUtf8, parseCsv, type CsvRecord } from './csv.ts';

export const MAX_IMPORT_BYTES = 1_048_576;
export const MAX_IMPORT_ROWS = 500;
export const EXPECTED_HEADER = ['nombre', 'email', 'telefono'] as const;

export const INVALID_CSV_MESSAGE =
  'Formato CSV inválido: el fichero debe estar en UTF-8 y separado por comas.';
export const NO_CANDIDATES_MESSAGE = 'El fichero no tiene candidatos.';
export const INVALID_HEADER_MESSAGE =
  'La cabecera no es válida. La primera línea debe ser exactamente: nombre,email,telefono';
export const SEMICOLON_SEPARATOR_MESSAGE =
  'El fichero está separado por «;». Guárdalo separado por comas (CSV UTF-8) y vuelve a importarlo.';
export const TOO_MANY_ROWS_MESSAGE =
  'El fichero tiene más de 500 filas de candidatos. Divídelo en ficheros más pequeños.';
export const FILE_TOO_LARGE_MESSAGE =
  'El fichero ocupa más de 1 MiB. Divídelo en ficheros más pequeños.';

/** 400 del fichero entero: `message` y el único `details` llevan el mismo texto (DEC-11.4). */
function fileError(message: string): AppError {
  return new AppError('VALIDATION_ERROR', 400, message, [{ field: 'file', message }]);
}

function normalizeCell(cell: string): string {
  return cell.trim().toLowerCase();
}

function matchesExpectedHeader(cells: string[]): boolean {
  return (
    cells.length === EXPECTED_HEADER.length &&
    cells.every((cell, index) => normalizeCell(cell) === EXPECTED_HEADER[index])
  );
}

/** DT-08: la cabecera entera es una sola celda que, partida por «;», es la esperada (Excel en español). */
function isSemicolonHeader({ fields }: CsvRecord): boolean {
  return fields.length === 1 && matchesExpectedHeader((fields[0] ?? '').split(';'));
}

/** La cabecera es la línea física 1 (DD-07 a) con exactamente las 3 columnas esperadas (EC-10). */
function checkHeader(first: CsvRecord): void {
  if (first.line === 1 && matchesExpectedHeader(first.fields)) return;
  if (first.line === 1 && isSemicolonHeader(first)) throw fileError(SEMICOLON_SEPARATOR_MESSAGE);
  throw fileError(INVALID_HEADER_MESSAGE);
}

/**
 * Las filas de datos (sin la cabecera) o un `AppError`. Orden de comprobación: tamaño, codificación, formato, sin
 * ninguna línea con contenido, cabecera, solo cabecera y más de 500 filas.
 */
export function readImportFile(bytes: Uint8Array): CsvRecord[] {
  if (bytes.length > MAX_IMPORT_BYTES) {
    throw new AppError('PAYLOAD_TOO_LARGE', 413, FILE_TOO_LARGE_MESSAGE);
  }
  const text = decodeUtf8(bytes);
  if (text === null) throw fileError(INVALID_CSV_MESSAGE);
  const parsed = parseCsv(text, MAX_IMPORT_ROWS + 2);
  if (!parsed.ok) throw fileError(`${INVALID_CSV_MESSAGE} Revisa la línea ${parsed.line}.`);
  const [first, ...rows] = parsed.records;
  if (parsed.recordCount === 0 || first === undefined) throw fileError(NO_CANDIDATES_MESSAGE);
  checkHeader(first);
  if (parsed.recordCount === 1) throw fileError(NO_CANDIDATES_MESSAGE);
  if (parsed.recordCount - 1 > MAX_IMPORT_ROWS) throw fileError(TOO_MANY_ROWS_MESSAGE);
  return rows;
}
