import { isCalendarDate, isDeadlinePassed } from '../../calendar.ts';
import { invalidTransition, validationError, type ErrorDetail } from '../../errors.ts';
import type { JobEditableFields } from './repository.ts';
import type { JobStatus } from './schemas.ts';

// Reglas de estado y de campos de la oferta (DD-02, DD-07). Sin HTTP ni SQL: solo decisiones.

export type JobAction = 'publish' | 'close' | 'update' | 'remove';
type Outcome = 'apply' | 'noop' | { conflict: string };

/** Tabla acción × estado (DD-02): aplica, no hace nada (idempotencia, DEC-08) o es un conflicto 409. */
const RULES: Record<JobAction, Record<JobStatus, Outcome>> = {
  publish: {
    draft: 'apply',
    published: 'noop',
    closed: { conflict: 'Una oferta cerrada no se puede publicar.' },
  },
  close: {
    draft: { conflict: 'Un borrador no se puede cerrar: publícalo primero.' },
    published: 'apply',
    closed: 'noop',
  },
  update: {
    draft: 'apply',
    published: 'apply',
    closed: { conflict: 'Una oferta cerrada no se puede editar.' },
  },
  remove: {
    draft: 'apply',
    published: { conflict: 'Una oferta publicada no se puede borrar.' },
    closed: { conflict: 'Una oferta cerrada no se puede borrar.' },
  },
};

const SALARY_RANGE_MESSAGE = 'El salario mínimo no puede ser mayor que el máximo.';
// DT-01 del PRD: textos exactos, sin repetir el valor recibido (DEC-11.4).
const INVALID_DATE_MESSAGE = 'Introduce una fecha válida.';
const PAST_DEADLINE_MESSAGE = 'La fecha límite no puede ser anterior a hoy.';
const EXPIRED_DEADLINE_MESSAGE = 'La fecha límite de inscripción ya ha pasado.';

/** `'apply'` o `'noop'`; un conflicto lanza `INVALID_TRANSITION` (409) sin `details`. */
export function checkAction(action: JobAction, status: JobStatus): 'apply' | 'noop' {
  const outcome = RULES[action][status];
  if (typeof outcome === 'string') return outcome;
  throw invalidTransition(outcome.conflict);
}

function isEmpty(value: string | null): boolean {
  return value === null || value === '';
}

/** Un elemento por campo obligatorio vacío, en el orden title, description, location, workMode; la banda nunca. */
export function missingRequiredDetails(fields: JobEditableFields, message: string): ErrorDetail[] {
  const required: [string, string | null][] = [
    ['title', fields.title],
    ['description', fields.description],
    ['location', fields.location],
    ['workMode', fields.workMode],
  ];
  return required.filter(([, value]) => isEmpty(value)).map(([field]) => ({ field, message }));
}

/** DD-04: mínimo ≤ máximo solo si vienen los dos; el CHECK de la migración 001 es la última defensa. */
export function salaryRangeDetails(
  min: number | null | undefined,
  max: number | null | undefined,
): ErrorDetail[] {
  if (min != null && max != null && min > max) {
    return [{ field: 'salaryMin', message: SALARY_RANGE_MESSAGE }];
  }
  return [];
}

/** RF-01: un día real y no anterior a `today`. `[]` si es `null`; quien llama decide si la fecha cambia (DD-04). */
export function enrollmentDeadlineDetails(value: string | null, today: string): ErrorDetail[] {
  if (value === null) return [];
  if (!isCalendarDate(value))
    return [{ field: 'enrollmentDeadline', message: INVALID_DATE_MESSAGE }];
  if (value < today) return [{ field: 'enrollmentDeadline', message: PAST_DEADLINE_MESSAGE }];
  return [];
}

/** Al publicar (RN-04, DD-10): un borrador con el plazo ya vencido no se publica. */
export function expiredDeadlineDetails(deadline: string | null, today: string): ErrorDetail[] {
  if (!isDeadlinePassed(deadline, today)) return [];
  return [{ field: 'enrollmentDeadline', message: EXPIRED_DEADLINE_MESSAGE }];
}

export function assertNoDetails(details: ErrorDetail[]): void {
  if (details.length > 0) throw validationError(details);
}
