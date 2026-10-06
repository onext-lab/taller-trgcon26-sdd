import { WORK_MODES, type Job, type JobInput, type JobPatch, type WorkMode } from './types.ts';

/**
 * Pure model of the job form (DD-04): the state is kept as strings, validation mirrors RF-02 (the API
 * has the last word) and `toCreateInput` builds the body of `POST /api/jobs`; `jobToForm` and `toPatch` serve the edit mode.
 */

export const FIELD_ORDER = [
  'title',
  'description',
  'location',
  'workMode',
  'salaryMin',
  'salaryMax',
] as const;
export type FieldName = (typeof FIELD_ORDER)[number];

export type JobFormValues = Record<FieldName, string>;
export type JobFormErrors = Partial<Record<FieldName, string>>;

export const EMPTY_FORM: JobFormValues = {
  title: '',
  description: '',
  location: '',
  workMode: '',
  salaryMin: '',
  salaryMax: '',
};

export function isFieldName(value: string): value is FieldName {
  return (FIELD_ORDER as readonly string[]).includes(value);
}

const TITLE_RANGE = { min: 3, max: 120 };
const LOCATION_RANGE = { min: 2, max: 120 };
const DESCRIPTION_MAX = 5000;
const SALARY_PATTERN = /^\d+$/;

const MESSAGES = {
  titleEmpty: 'Escribe un título.',
  titleRange: 'El título debe tener entre 3 y 120 caracteres.',
  description: 'La descripción no puede pasar de 5 000 caracteres.',
  location: 'La ubicación debe tener entre 2 y 120 caracteres.',
  workMode: 'Elige presencial, híbrida o remota.',
  salary: 'Escribe un número entero mayor que 0, sin puntos ni espacios.',
  salaryOrder: 'El salario mínimo no puede ser mayor que el máximo.',
} as const;

// Length in code points (EC-04): `text.length` counts UTF-16 units and would reject valid emoji titles.
function length(text: string): number {
  return [...text].length;
}

function isWorkMode(value: string): value is WorkMode {
  return (WORK_MODES as readonly string[]).includes(value);
}

function titleError(raw: string): string | undefined {
  const size = length(raw.trim());
  if (size === 0) return MESSAGES.titleEmpty;
  return size < TITLE_RANGE.min || size > TITLE_RANGE.max ? MESSAGES.titleRange : undefined;
}

function locationError(raw: string): string | undefined {
  const text = raw.trim();
  if (text === '') return undefined;
  const size = length(text);
  return size < LOCATION_RANGE.min || size > LOCATION_RANGE.max ? MESSAGES.location : undefined;
}

// A salary is empty (`null`) or a positive safe integer written with digits only.
function parseSalary(raw: string): number | null | 'invalid' {
  const text = raw.trim();
  if (text === '') return null;
  if (!SALARY_PATTERN.test(text)) return 'invalid';
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 ? value : 'invalid';
}

function salaryErrors(values: JobFormValues): JobFormErrors {
  const min = parseSalary(values.salaryMin);
  const max = parseSalary(values.salaryMax);
  const errors: JobFormErrors = {};
  if (min === 'invalid') errors.salaryMin = MESSAGES.salary;
  if (max === 'invalid') errors.salaryMax = MESSAGES.salary;
  if (typeof min === 'number' && typeof max === 'number' && min > max) {
    errors.salaryMin = MESSAGES.salaryOrder;
  }
  return errors;
}

/** Errors by field, with the messages of RF-02; an empty object means the form is valid. */
export function validateJobForm(values: JobFormValues): JobFormErrors {
  const errors: JobFormErrors = {};
  const title = titleError(values.title);
  if (title) errors.title = title;
  if (length(values.description.trim()) > DESCRIPTION_MAX)
    errors.description = MESSAGES.description;
  const location = locationError(values.location);
  if (location) errors.location = location;
  if (values.workMode !== '' && !isWorkMode(values.workMode)) errors.workMode = MESSAGES.workMode;
  return { ...errors, ...salaryErrors(values) };
}

/**
 * Body of `POST /api/jobs` from a valid form: trimmed texts, empty optionals omitted, and never
 * `status`, `createdAt` or `id` (EC-02, EC-03).
 */
export function toCreateInput(values: JobFormValues): JobInput {
  const input: JobInput = { title: values.title.trim() };
  const description = values.description.trim();
  if (description !== '') input.description = description;
  const location = values.location.trim();
  if (location !== '') input.location = location;
  if (isWorkMode(values.workMode)) input.workMode = values.workMode;
  const min = parseSalary(values.salaryMin);
  if (typeof min === 'number') input.salaryMin = min;
  const max = parseSalary(values.salaryMax);
  if (typeof max === 'number') input.salaryMax = max;
  return input;
}

/** Form values of an existing job: `null` becomes an empty string, numbers become text. */
export function jobToForm(job: Job): JobFormValues {
  return {
    title: job.title,
    description: job.description ?? '',
    location: job.location ?? '',
    workMode: job.workMode ?? '',
    salaryMin: job.salaryMin === null ? '' : String(job.salaryMin),
    salaryMax: job.salaryMax === null ? '' : String(job.salaryMax),
  };
}

// Text fields are compared already trimmed; an empty optional is `null`, never `""`.
function textOrNull(raw: string): string | null {
  const text = raw.trim();
  return text === '' ? null : text;
}

/**
 * Body of `PATCH /api/jobs/:id` from a valid form (DD-04): only the editable fields whose normalized
 * value differs from `original`; an emptied optional goes as `null`, `title` never does. `{}` means
 * nothing changed (the caller sends no request). Never `status`, `createdAt` or `id` (EC-25).
 */
export function toPatch(original: Job, values: JobFormValues): JobPatch {
  const patch: JobPatch = {};
  const title = values.title.trim();
  if (title !== original.title) patch.title = title;
  const description = textOrNull(values.description);
  if (description !== original.description) patch.description = description;
  const location = textOrNull(values.location);
  if (location !== original.location) patch.location = location;
  const workMode = isWorkMode(values.workMode) ? values.workMode : null;
  if (workMode !== original.workMode) patch.workMode = workMode;
  const min = parseSalary(values.salaryMin);
  if (min !== 'invalid' && min !== original.salaryMin) patch.salaryMin = min;
  const max = parseSalary(values.salaryMax);
  if (max !== 'invalid' && max !== original.salaryMax) patch.salaryMax = max;
  return patch;
}
