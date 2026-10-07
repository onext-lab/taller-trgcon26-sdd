import { ApiError } from '../../components/http.ts';

export type StageErrorKind = 'stage-mismatch' | 'invalid-transition' | 'not-found' | 'other';

/** Fixed texts of the product (DT-06, DD-05): they do not depend on the wording of the API. */
export const STAGE_MISMATCH_MESSAGE =
  'La inscripción ha cambiado de etapa: revisa el pipeline actualizado.';
export const INVALID_TRANSITION_MESSAGE = 'La inscripción ya no admite ese cambio.';
export const NOT_FOUND_MESSAGE = 'La inscripción ya no existe.';

/** Tells the outcome of a failed advance or reject by the stable `code` of the envelope (DEC-07). */
export function classifyStageError(error: unknown): StageErrorKind {
  if (!(error instanceof ApiError)) return 'other';
  switch (error.code) {
    case 'STAGE_MISMATCH':
      return 'stage-mismatch';
    case 'INVALID_TRANSITION':
      return 'invalid-transition';
    case 'NOT_FOUND':
      return 'not-found';
    default:
      return 'other';
  }
}
