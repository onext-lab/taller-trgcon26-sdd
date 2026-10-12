// Reglas de fila de la importación (DD-03, DD-04, DD-08 de HU-07): cada registro pasa por la misma normalización y el
// mismo esquema que el alta; aquí solo se traduce el CSV al cuerpo del alta y los errores a las columnas del fichero.

import type { ErrorDetail } from '../../errors.ts';
import type { CsvRecord } from './csv.ts';
import type { ImportError, ImportField, ImportRow, NotImportedRow } from './import-schemas.ts';
import { normalizeCandidateBody } from './normalize.ts';

/** Valida una fila con el esquema del alta compilado por la app; `[]` = válida. */
export type RowValidator = (row: Record<string, unknown>) => ErrorDetail[];

/** Propiedad del alta → columna del CSV (DD-08). El orden de las claves es el de las columnas. */
export const FIELD_BY_PROPERTY: Record<string, ImportField> = {
  fullName: 'nombre',
  email: 'email',
  phone: 'telefono',
};

const COLUMN_ORDER: ImportField[] = ['nombre', 'email', 'telefono'];
const COLUMN_COUNT = COLUMN_ORDER.length;
const WRONG_COLUMNS_MESSAGE = 'Número de columnas incorrecto.';

/** Cuerpo del alta de una fila: la celda vacía de `nombre` o `email` es campo ausente (DD-04). */
function toRowBody([fullName = '', email = '', phone = '']: string[]): Record<string, unknown> {
  const body: Record<string, unknown> = { phone };
  if (fullName.trim() !== '') body.fullName = fullName;
  if (email.trim() !== '') body.email = email;
  return body;
}

function toImportErrors(details: ErrorDetail[]): ImportError[] {
  const errors = details.map(({ field, message }): ImportError => {
    const column = Object.hasOwn(FIELD_BY_PROPERTY, field) ? FIELD_BY_PROPERTY[field] : undefined;
    return { field: column ?? 'fila', message };
  });
  return errors.sort((a, b) => columnIndex(a.field) - columnIndex(b.field));
}

function columnIndex(field: ImportField): number {
  const index = COLUMN_ORDER.indexOf(field);
  return index === -1 ? COLUMN_COUNT : index;
}

function invalidRow(row: number, errors: ImportError[]): NotImportedRow {
  return { row, reason: 'invalid', errors };
}

/** Separa los registros en filas válidas (normalizadas, en orden) e inválidas (con sus errores por columna). */
export function classifyRows(
  records: CsvRecord[],
  validateRow: RowValidator,
): { valid: ImportRow[]; invalid: NotImportedRow[] } {
  const valid: ImportRow[] = [];
  const invalid: NotImportedRow[] = [];
  for (const { line, fields } of records) {
    if (fields.length !== COLUMN_COUNT) {
      invalid.push(invalidRow(line, [{ field: 'fila', message: WRONG_COLUMNS_MESSAGE }]));
      continue;
    }
    const body = normalizeCandidateBody(toRowBody(fields)) as Record<string, unknown>;
    const errors = validateRow(body);
    if (errors.length > 0) {
      invalid.push(invalidRow(line, toImportErrors(errors)));
      continue;
    }
    valid.push({
      row: line,
      fullName: body.fullName as string,
      email: body.email as string,
      phone: body.phone as string | null,
    });
  }
  return { valid, invalid };
}
