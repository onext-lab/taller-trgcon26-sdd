import { ApiError } from '../../components/http.ts';

export type EnrollErrorKind = 'duplicate' | 'not-published' | 'not-found' | 'other';

/** Fixed texts of the product (DD-05): they do not depend on the wording of the API. */
export const DUPLICATE_MESSAGE = 'Este candidato ya está inscrito en la oferta.';
export const NOT_PUBLISHED_MESSAGE = 'La oferta ya no está publicada: no admite inscripciones.';

/** Tells the outcome of a failed enrollment by the stable `code` of the envelope (DEC-07). */
export function classifyEnrollError(error: unknown): EnrollErrorKind {
  if (!(error instanceof ApiError)) return 'other';
  switch (error.code) {
    case 'DUPLICATE':
      return 'duplicate';
    case 'INVALID_TRANSITION':
      return 'not-published';
    case 'NOT_FOUND':
      return 'not-found';
    default:
      return 'other';
  }
}
