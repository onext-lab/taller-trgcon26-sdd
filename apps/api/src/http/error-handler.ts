import type { FastifyError, FastifyInstance, FastifySchemaValidationError } from 'fastify';
import { AppError, notFound, type ErrorDetail } from '../errors.ts';

/**
 * Único sitio que construye el envelope de error `{ error: { code, message, details? } }` (DEC-01, DEC-07, DEC-11).
 * Ningún mensaje repite el valor recibido ni lleva SQL, rutas de fichero o stack traces, y nunca se registra el cuerpo:
 * solo los 500, con el objeto de error (docs/RGPD.md).
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const appError = toAppError(error);
    if (appError.statusCode >= 500) request.log.error({ err: error }, 'Error no controlado');
    return reply.code(appError.statusCode).send(toEnvelope(appError));
  });
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(toEnvelope(notFound('El recurso no existe.'))),
  );
}

function toEnvelope({ code, message, details }: AppError) {
  return { error: details ? { code, message, details } : { code, message } };
}

const INVALID_JSON_CODES = new Set([
  'FST_ERR_CTP_INVALID_JSON_BODY',
  'FST_ERR_CTP_EMPTY_JSON_BODY',
]);

function toAppError(error: FastifyError): AppError {
  if (error instanceof AppError) return error;
  if (error.validation) {
    const details = toDetails(error.validation, error.validationContext ?? 'body');
    return new AppError('VALIDATION_ERROR', 400, 'Hay campos con errores.', details);
  }
  if (INVALID_JSON_CODES.has(error.code)) {
    return new AppError('VALIDATION_ERROR', 400, 'El cuerpo de la petición no es JSON válido.', [
      { field: 'body', message: 'Debe ser un objeto JSON.' },
    ]);
  }
  const statusCode = error.statusCode ?? 500;
  if (statusCode === 413) {
    return new AppError('PAYLOAD_TOO_LARGE', 413, 'El cuerpo de la petición es demasiado grande.');
  }
  if (statusCode === 415) {
    return new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Tipo de contenido no admitido.');
  }
  if (statusCode >= 400 && statusCode < 500) {
    return new AppError('BAD_REQUEST', statusCode, 'La petición no es válida.');
  }
  return new AppError('INTERNAL_ERROR', 500, 'Error interno. Inténtalo de nuevo.');
}

/** Un elemento por campo: el primer error de Ajv de ese campo. */
function toDetails(issues: FastifySchemaValidationError[], context: string): ErrorDetail[] {
  const byField = new Map<string, string>();
  for (const issue of issues) {
    const field = fieldOf(issue, context);
    if (!byField.has(field)) byField.set(field, messageOf(issue));
  }
  return [...byField].map(([field, message]) => ({ field, message }));
}

function fieldOf({ keyword, params, instancePath }: FastifySchemaValidationError, context: string) {
  if (keyword === 'additionalProperties' && typeof params.additionalProperty === 'string') {
    return params.additionalProperty;
  }
  if (keyword === 'required' && typeof params.missingProperty === 'string') {
    return params.missingProperty;
  }
  return instancePath.split('/')[1] || context;
}

function messageOf({ keyword, params }: FastifySchemaValidationError): string {
  const limit = String(params.limit);
  switch (keyword) {
    case 'required':
      return 'Es obligatorio.';
    case 'additionalProperties':
      return 'Campo no permitido.';
    case 'minLength':
      return `Debe tener al menos ${limit} caracteres.`;
    case 'maxLength':
      return `Debe tener como máximo ${limit} caracteres.`;
    case 'enum':
      return `Debe ser uno de estos valores: ${allowedValues(params.allowedValues)}.`;
    case 'type':
      return typeMessage(params.type);
    case 'exclusiveMinimum':
      return `Debe ser mayor que ${limit}.`;
    case 'minimum':
      return `Debe ser mayor o igual que ${limit}.`;
    case 'maximum':
      return `Debe ser menor o igual que ${limit}.`;
    case 'minProperties':
      return 'Envía al menos un campo.';
    case 'pattern':
    case 'format':
      return 'Formato no válido.';
    default:
      return 'Valor no válido.';
  }
}

function allowedValues(values: unknown): string {
  const list = Array.isArray(values) ? values : [];
  return list
    .filter((value) => value !== null)
    .map(String)
    .join(', ');
}

/** Con `type: ["integer", "null"]` Ajv da el tipo como lista (array o texto con comas): manda el primero no nulo. */
function typeMessage(expected: unknown): string {
  const types = Array.isArray(expected) ? expected.map(String) : String(expected).split(',');
  switch (types.find((type) => type !== 'null')) {
    case 'integer':
      return 'Debe ser un número entero.';
    case 'string':
      return 'Debe ser un texto.';
    case 'object':
      return 'Debe ser un objeto JSON.';
    default:
      return 'Tipo de dato no válido.';
  }
}
