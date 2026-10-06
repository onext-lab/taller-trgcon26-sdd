export interface ErrorDetail {
  field: string;
  message: string;
  /** Solo en un 409 `DUPLICATE` (DEC-07, DEC-11.4): el ID del existente, nunca otro dato suyo. */
  existingId?: number;
}

/**
 * Error de dominio con `code` estable (DEC-01, DEC-07). Lo lanza el servicio y lo traduce al envelope el único
 * manejador de errores (`apps/api/src/http/error-handler.ts`). El `message` nunca repite el valor recibido.
 */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: ErrorDetail[] | undefined;

  constructor(code: string, statusCode: number, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(message: string): AppError {
  return new AppError('NOT_FOUND', 404, message);
}

/** 409 de estado (DEC-07): la transición pedida no es posible desde el estado actual. Sin `details`. */
export function invalidTransition(message: string): AppError {
  return new AppError('INVALID_TRANSITION', 409, message);
}

export function validationError(details: ErrorDetail[]): AppError {
  return new AppError('VALIDATION_ERROR', 400, 'Hay campos con errores.', details);
}

/** 409 de unicidad (DEC-07): el elemento lleva `existingId`; el `message` es fijo y nunca lleva el valor repetido. */
export function duplicate({ field, message, existingId }: Required<ErrorDetail>): AppError {
  return new AppError('DUPLICATE', 409, message, [{ field, message, existingId }]);
}
