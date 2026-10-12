import { ApiError } from '../../components/http.ts';
import type { ImportReport } from './types.ts';

/** Pure model of the CSV import screen (DD-04, DD-06). The web never validates the CSV itself (RN-15). */

export const EXPECTED_HEADER = 'nombre,email,telefono';
export const MAX_FILE_BYTES = 1_048_576;

// Same text as the API's 413 (DT-03); the web repeats it only for the check before sending.
export const FILE_TOO_LARGE_MESSAGE =
  'El fichero ocupa más de 1 MiB. Divídelo en ficheros más pequeños.';
export const FILE_UNREADABLE_MESSAGE = 'No se ha podido leer el fichero. Vuelve a elegirlo.';

export function isFileTooLarge(file: { size: number }): boolean {
  return file.size > MAX_FILE_BYTES;
}

/** A 400 about the file (`details[].field === 'file'`) or a 413: the selector is the invalid control. */
export function isFileError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 413) return true;
  return error.status === 400 && (error.details ?? []).some((detail) => detail.field === 'file');
}

function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** «3 creados, 0 duplicados, 0 filas con error.»; singular with 1 (DD-06). */
export function reportSummary(report: ImportReport): string {
  const created = count(report.created, 'creado', 'creados');
  const duplicates = count(report.duplicates, 'duplicado', 'duplicados');
  const invalid = count(report.invalid, 'fila con error', 'filas con error');
  return `${created}, ${duplicates}, ${invalid}.`;
}

/** `fila` (the whole row) reads «Toda la fila»; the CSV column names go as they come. */
export function columnLabel(field: string): string {
  return field === 'fila' ? 'Toda la fila' : field;
}
