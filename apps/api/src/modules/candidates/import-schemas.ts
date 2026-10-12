// Contrato de la importación por CSV (TECHNICAL_DOC-backend § Contrato de API, DD-03 y DD-08 de HU-07).

import { candidateFieldsSchema } from './schemas.ts';

/** Columnas del informe (nombres del CSV, no de la API) y `fila` para la fila entera (DD-08). */
export type ImportField = 'nombre' | 'email' | 'telefono' | 'fila';

export type NotImportedReason = 'invalid' | 'duplicate' | 'repeated';

export interface ImportError {
  field: ImportField;
  message: string;
}

/** Fila válida del fichero, ya normalizada con las reglas del alta; `row` es su línea física. */
export interface ImportRow {
  row: number;
  fullName: string;
  email: string;
  phone: string | null;
}

export interface NotImportedRow {
  row: number;
  reason: NotImportedReason;
  errors: ImportError[];
  /** Solo en `duplicate`: el ID del candidato que ya existía. */
  existingId?: number;
  /** Solo en `repeated`: la fila de la primera fila válida con ese email. */
  firstRow?: number;
}

export interface ImportReport {
  dataRows: number;
  created: number;
  duplicates: number;
  invalid: number;
  notImported: NotImportedRow[];
}

/** Reglas de una fila: las propiedades del alta por referencia, así que no pueden divergir (RF-03). */
export const importRowSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['fullName', 'email'],
  properties: {
    fullName: candidateFieldsSchema.fullName,
    email: candidateFieldsSchema.email,
    phone: candidateFieldsSchema.phone,
  },
} as const;

const importErrorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['field', 'message'],
  properties: {
    field: { type: 'string', enum: ['nombre', 'email', 'telefono', 'fila'] },
    message: { type: 'string' },
  },
} as const;

const notImportedRowSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['row', 'reason', 'errors'],
  properties: {
    row: { type: 'integer' },
    reason: { type: 'string', enum: ['invalid', 'duplicate', 'repeated'] },
    errors: { type: 'array', items: importErrorSchema },
    existingId: { type: 'integer' },
    firstRow: { type: 'integer' },
  },
} as const;

/** Respuesta 200 de la importación: el esquema filtra cualquier campo de más en todos los niveles. */
export const importReportSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['dataRows', 'created', 'duplicates', 'invalid', 'notImported'],
  properties: {
    dataRows: { type: 'integer' },
    created: { type: 'integer' },
    duplicates: { type: 'integer' },
    invalid: { type: 'integer' },
    notImported: { type: 'array', items: notImportedRowSchema },
  },
} as const;
