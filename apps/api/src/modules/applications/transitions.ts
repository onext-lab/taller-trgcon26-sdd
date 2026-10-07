import { invalidTransition, stageMismatch } from '../../errors.ts';
import type { Stage } from './schemas.ts';

// Reglas puras de las transiciones de etapa (DD-01, DD-05). Sin HTTP ni SQL: solo decisiones.

/** Mensaje de `STAGE_MISMATCH` (DT-02); también lo usa la guarda del `UPDATE` (TASK-03). */
export const STAGE_MISMATCH_MESSAGE =
  'La inscripción ha cambiado de etapa: recarga e inténtalo de nuevo.';
const FINAL_STAGE_MESSAGE = 'La inscripción está en una etapa final: no admite cambios.';
const ONLY_NEXT_MESSAGE = 'Solo se puede avanzar a la etapa siguiente.';
const HIRED_REJECT_MESSAGE = 'Una inscripción contratada no se puede rechazar.';

/** Etapa siguiente de cada etapa no final: received → screening → interview → offer → hired. */
export const NEXT_STAGE: Readonly<Partial<Record<Stage, Stage>>> = {
  received: 'screening',
  screening: 'interview',
  interview: 'offer',
  offer: 'hired',
};

/** Etapas a las que se puede «avanzar»: repetir una de ellas es un no-op (RV-23). */
const ADVANCE_TARGETS: readonly Stage[] = ['screening', 'interview', 'offer', 'hired'];

export function isFinal(stage: Stage): boolean {
  return stage === 'hired' || stage === 'rejected';
}

/**
 * Avanzar a la etapa siguiente. Orden (DT-02, DT-13, DD-05): destino ya alcanzado → `noop`; esperada desactualizada →
 * `STAGE_MISMATCH`; etapa final → `INVALID_TRANSITION`; destino distinto del siguiente → `INVALID_TRANSITION`.
 */
export function decideAdvance(
  current: Stage,
  input: { expectedStage: Stage; toStage: Stage },
): 'apply' | 'noop' {
  const { expectedStage, toStage } = input;
  if (toStage === current && ADVANCE_TARGETS.includes(toStage)) return 'noop';
  if (expectedStage !== current) throw stageMismatch(STAGE_MISMATCH_MESSAGE);
  if (isFinal(current)) throw invalidTransition(FINAL_STAGE_MESSAGE);
  if (toStage !== NEXT_STAGE[current]) throw invalidTransition(ONLY_NEXT_MESSAGE);
  return 'apply';
}

/** Rechazar. Orden: ya rechazada → `noop` (con cualquier esperada) → esperada desactualizada → contratada → aplica. */
export function decideReject(current: Stage, expectedStage: Stage): 'apply' | 'noop' {
  if (current === 'rejected') return 'noop';
  if (expectedStage !== current) throw stageMismatch(STAGE_MISMATCH_MESSAGE);
  if (current === 'hired') throw invalidTransition(HIRED_REJECT_MESSAGE);
  return 'apply';
}
