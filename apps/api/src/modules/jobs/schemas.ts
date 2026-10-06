// Contrato del módulo jobs (TECHNICAL_DOC-backend § Esquemas compartidos). Longitudes en puntos de código: Ajv cuenta
// con `unicode: true` (su valor por defecto), igual que `length()` de SQLite.

import {
  NO_CONTROL_CHARS,
  NO_CONTROL_CHARS_EXCEPT_WHITESPACE,
  forbiddenFields,
} from '../../http/validation.ts';

export const WORK_MODES = ['presencial', 'híbrida', 'remota'] as const;
export const JOB_STATUSES = ['draft', 'published', 'closed'] as const;

export type WorkMode = (typeof WORK_MODES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface Job {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  workMode: WorkMode | null;
  salaryMin: number | null;
  salaryMax: number | null;
  status: JobStatus;
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
}

/** Cuerpo del alta ya recortado y validado. `status` y `createdAt` solo los fija el servicio. */
export interface JobInput {
  title: string;
  description?: string | null;
  location?: string | null;
  workMode?: WorkMode | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
}

/** Cuerpo de la edición (TASK-05): campo ausente = sin cambios; `title` no admite `null`. */
export type JobPatch = Partial<JobInput>;

/** Lectura previa al cierre (DD-11): inscripciones activas que se rechazarían. */
export interface ClosePreview {
  activeApplications: number;
}

/** Elemento del listado (TASK-04): `referenceDate = publishedAt ?? createdAt`. */
export interface JobListItem {
  id: number;
  title: string;
  status: JobStatus;
  referenceDate: string;
}

export interface JobPage {
  items: JobListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** DD-12: sin `maximum`, `1e300` pasaría por entero, SQLite lo guardaría como REAL, fallaría el CHECK y daría 500. */
const MAX_SALARY = Number.MAX_SAFE_INTEGER;

/**
 * Reglas de entrada por campo (alta y edición). `pattern` rechaza los caracteres de control (EC-50, DEC-11.8): título
 * y ubicación, todos; descripción, todos salvo `\n`, `\r` y `\t`.
 */
export const jobFieldsSchema = {
  title: { type: 'string', minLength: 3, maxLength: 120, pattern: NO_CONTROL_CHARS },
  description: {
    type: ['string', 'null'],
    maxLength: 5000,
    pattern: NO_CONTROL_CHARS_EXCEPT_WHITESPACE,
  },
  location: {
    type: ['string', 'null'],
    minLength: 2,
    maxLength: 120,
    pattern: NO_CONTROL_CHARS,
  },
  workMode: { type: ['string', 'null'], enum: [...WORK_MODES, null] },
  salaryMin: { type: ['integer', 'null'], exclusiveMinimum: 0, maximum: MAX_SALARY },
  salaryMax: { type: ['integer', 'null'], exclusiveMinimum: 0, maximum: MAX_SALARY },
} as const;

/** Oferta completa en las respuestas: los opcionales sin valor salen como `null`, nunca ausentes. */
export const jobSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'title',
    'description',
    'location',
    'workMode',
    'salaryMin',
    'salaryMax',
    'status',
    'createdAt',
    'publishedAt',
    'closedAt',
  ],
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    location: { type: ['string', 'null'] },
    workMode: { type: ['string', 'null'] },
    salaryMin: { type: ['integer', 'null'] },
    salaryMax: { type: ['integer', 'null'] },
    status: { type: 'string', enum: JOB_STATUSES },
    createdAt: { type: 'string' },
    publishedAt: { type: ['string', 'null'] },
    closedAt: { type: ['string', 'null'] },
  },
} as const;

/** Elemento del listado: solo estos 4 campos (DEC-10, RGPD §6.2); el esquema de respuesta filtra cualquier otro. */
export const jobListItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'status', 'referenceDate'],
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    status: { type: 'string', enum: JOB_STATUSES },
    referenceDate: { type: 'string' },
  },
} as const;

/** Página del listado (DEC-10): `total` es el del resultado filtrado. */
export const jobPageSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'total', 'page', 'pageSize'],
  properties: {
    items: { type: 'array', items: jobListItemSchema },
    total: { type: 'integer' },
    page: { type: 'integer' },
    pageSize: { type: 'integer' },
  },
} as const;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

/** Parámetros del listado ya validados y convertidos (TECHNICAL_DOC-backend § Firmas internas). */
export interface JobListQuery {
  status?: JobStatus;
  q?: string;
  page: number;
  pageSize: number;
}

/** Querystring tal como llega: sin coerción (DEC-11.2) todo es texto; `toListQuery` la convierte. */
export interface JobListQuerystring {
  status?: JobStatus;
  q?: string;
  page?: string;
  pageSize?: string;
}

/**
 * Querystring de `GET /api/jobs` (DD-05): `page` y `pageSize` como texto con `pattern` (`pageSize` de 1 a 100);
 * `q` se recorta antes de validar. Cualquier otro parámetro da 400 «Campo no permitido.».
 */
export const listQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: JOB_STATUSES },
    q: { type: 'string', maxLength: 100, pattern: NO_CONTROL_CHARS },
    page: { type: 'string', pattern: '^[1-9][0-9]{0,8}$' },
    pageSize: { type: 'string', pattern: '^(?:[1-9][0-9]?|100)$' },
  },
} as const;

/** Solo lectura que el alta y la edición nombran con «Campo no permitido.» (DEC-11.4); el resto sale sin nombre. */
const readOnlyFields = forbiddenFields(['id', 'status', 'createdAt', 'publishedAt', 'closedAt']);

/** Cuerpo de `POST /api/jobs`. */
export const createJobBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title'],
  properties: { ...jobFieldsSchema, ...readOnlyFields },
} as const;

/** Cuerpo de `PATCH /api/jobs/:id`: al menos un campo; un campo ausente no cambia. `title` no admite `null`. */
export const updateJobBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: { ...jobFieldsSchema, ...readOnlyFields },
} as const;

/** Respuesta de `GET /api/jobs/:id/close-preview`. */
export const closePreviewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['activeApplications'],
  properties: { activeApplications: { type: 'integer', minimum: 0 } },
} as const;
