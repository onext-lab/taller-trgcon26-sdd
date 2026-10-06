// Contrato del módulo candidates (TECHNICAL_DOC-backend § Contrato de API). Longitudes en puntos de código: Ajv cuenta
// con `unicode: true` (su valor por defecto), igual que `length()` de SQLite.

import {
  NO_CONTROL_CHARS,
  NO_CONTROL_CHARS_EXCEPT_WHITESPACE,
  forbiddenFields,
} from '../../http/validation.ts';

/** Versión del texto de consentimiento vigente (DD-07): la API solo guarda la versión, el texto es de la web. */
export const CONSENT_TEXT_VERSION = 'v1';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

/** Ficha completa: 11 campos siempre presentes; los opcionales sin valor salen como `null`. */
export interface Candidate {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  summary: string | null;
  skills: string[];
  /** ISO 8601 UTC con milisegundos. */
  createdAt: string;
  consentGivenAt: string | null;
  consentVersion: string | null;
  consentWithdrawnAt: string | null;
  /** 'AAAA-MM-DD' en Europe/Madrid; `null` = «mientras dure el proceso». */
  retentionEndsAt: string | null;
}

/** Elemento del listado: exactamente 4 campos (RNF-04). */
export interface CandidateListItem {
  id: number;
  fullName: string;
  email: string;
  skills: string[];
}

export interface CandidatePage {
  items: CandidateListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Cuerpo del alta ya normalizado y validado. `consent: true` registra el consentimiento con el alta. */
export interface CandidateInput {
  fullName: string;
  email: string;
  phone?: string | null;
  summary?: string | null;
  skills?: string[];
  consent?: boolean;
}

/** Cuerpo de la edición (TASK-04): campo ausente = sin cambios; sin `consent`. */
export type CandidatePatch = Partial<Omit<CandidateInput, 'consent'>>;

/** Reglas por campo (alta y edición). `pattern` rechaza los caracteres de control (DEC-11.8). */
export const candidateFieldsSchema = {
  fullName: { type: 'string', minLength: 2, maxLength: 100, pattern: NO_CONTROL_CHARS },
  email: { type: 'string', maxLength: 254, format: 'email', pattern: NO_CONTROL_CHARS },
  // DT-05: de 6 a 20 caracteres con al menos 6 dígitos y «+» opcional delante; el conjunto excluye los controles.
  phone: {
    type: ['string', 'null'],
    pattern: '^\\+?(?=(?:[^0-9]*[0-9]){6})[0-9 ()-]{6,20}$',
  },
  summary: {
    type: ['string', 'null'],
    maxLength: 2000,
    pattern: NO_CONTROL_CHARS_EXCEPT_WHITESPACE,
  },
  skills: {
    type: 'array',
    maxItems: 20,
    items: { type: 'string', minLength: 1, maxLength: 40, pattern: NO_CONTROL_CHARS },
  },
} as const;

/** Campos de solo lectura que la API nombra con «Campo no permitido.» (DEC-11.4); el resto sale sin nombre. */
export const READ_ONLY = [
  'id',
  'createdAt',
  'consentGivenAt',
  'consentVersion',
  'consentWithdrawnAt',
  'retentionEndsAt',
] as const;

/** Cuerpo de `POST /api/candidates`. */
export const createCandidateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['fullName', 'email'],
  properties: {
    ...candidateFieldsSchema,
    consent: { type: 'boolean' },
    ...forbiddenFields(READ_ONLY),
  },
} as const;

/**
 * Cuerpo de `PATCH /api/candidates/:id`: al menos un campo; un campo ausente no cambia. `fullName` y `email` no
 * admiten `null`; `consent` se nombra como campo no permitido: el consentimiento tiene sus propias acciones.
 */
export const updateCandidateBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    ...candidateFieldsSchema,
    ...forbiddenFields(READ_ONLY),
    ...forbiddenFields(['consent']),
  },
} as const;

/** Ficha completa en las respuestas: 11 campos, nunca ausentes. */
export const candidateSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'fullName',
    'email',
    'phone',
    'summary',
    'skills',
    'createdAt',
    'consentGivenAt',
    'consentVersion',
    'consentWithdrawnAt',
    'retentionEndsAt',
  ],
  properties: {
    id: { type: 'integer' },
    fullName: { type: 'string' },
    email: { type: 'string' },
    phone: { type: ['string', 'null'] },
    summary: { type: ['string', 'null'] },
    skills: { type: 'array', items: { type: 'string' } },
    createdAt: { type: 'string' },
    consentGivenAt: { type: ['string', 'null'] },
    consentVersion: { type: ['string', 'null'] },
    consentWithdrawnAt: { type: ['string', 'null'] },
    retentionEndsAt: { type: ['string', 'null'] },
  },
} as const;
