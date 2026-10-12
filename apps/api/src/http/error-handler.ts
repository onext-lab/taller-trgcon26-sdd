import type { FastifyError, FastifyInstance, FastifySchemaValidationError } from 'fastify';
import { AppError, notFound, type ErrorDetail } from '../errors.ts';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Texto del 413 de la ruta (DD-02 de HU-07, DEC-13); sin él, el genérico. */
    payloadTooLargeMessage?: string;
  }
}

const PAYLOAD_TOO_LARGE_MESSAGE = 'El cuerpo de la petición es demasiado grande.';

/**
 * Único sitio que construye el envelope de error `{ error: { code, message, details? } }` (DEC-01, DEC-07, DEC-11).
 * Ningún mensaje repite el valor recibido ni lleva SQL, rutas de fichero o stack traces, y nunca se registra el cuerpo:
 * solo los 500, con el objeto de error (docs/RGPD.md).
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const tooLargeMessage =
      request.routeOptions?.config?.payloadTooLargeMessage ?? PAYLOAD_TOO_LARGE_MESSAGE;
    const appError = toAppError(error, tooLargeMessage);
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

function toAppError(error: FastifyError, payloadTooLargeMessage: string): AppError {
  if (error instanceof AppError) return error;
  if (error.validation) {
    const details = toValidationDetails(error.validation, error.validationContext ?? 'body');
    return new AppError('VALIDATION_ERROR', 400, 'Hay campos con errores.', details);
  }
  if (INVALID_JSON_CODES.has(error.code)) {
    return new AppError('VALIDATION_ERROR', 400, 'El cuerpo de la petición no es JSON válido.', [
      { field: 'body', message: 'Debe ser un objeto JSON.' },
    ]);
  }
  const statusCode = error.statusCode ?? 500;
  if (statusCode === 413) {
    return new AppError('PAYLOAD_TOO_LARGE', 413, payloadTooLargeMessage);
  }
  if (statusCode === 415) {
    return new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Tipo de contenido no admitido.');
  }
  if (statusCode >= 400 && statusCode < 500) {
    return new AppError('BAD_REQUEST', statusCode, 'La petición no es válida.');
  }
  return new AppError('INTERNAL_ERROR', 500, 'Error interno. Inténtalo de nuevo.');
}

/**
 * Un elemento por campo declarado: el primer error de Ajv de ese campo (DEC-11.4). Las claves no declaradas
 * (`additionalProperties`) no se nombran: `fieldOf` las agrupa todas bajo el contexto (`body`, `querystring` o `params`),
 * así que `details` tiene como mucho «propiedades declaradas + 1» elementos, entren las claves que entren.
 */
export function toValidationDetails(
  issues: FastifySchemaValidationError[],
  context: string,
): ErrorDetail[] {
  const byField = new Map<string, string>();
  for (const issue of issues) {
    const field = fieldOf(issue, context);
    if (!byField.has(field)) byField.set(field, messageOf(issue));
  }
  return [...byField].map(([field, message]) => ({ field, message }));
}

function fieldOf({ keyword, params, instancePath }: FastifySchemaValidationError, context: string) {
  if (keyword === 'required' && typeof params.missingProperty === 'string') {
    return params.missingProperty;
  }
  return instancePath.split('/')[1] || context;
}

type Params = FastifySchemaValidationError['params'];

const DEFAULT_MESSAGE = 'Valor no válido.';
const INVALID_FORMAT = 'Formato no válido.';

/** Mensaje en castellano por keyword de Ajv (DD-03); cualquier keyword ausente usa `DEFAULT_MESSAGE`. */
const MESSAGE_BY_KEYWORD: Record<string, (params: Params) => string> = {
  required: () => 'Es obligatorio.',
  additionalProperties: () => 'Hay campos no permitidos.',
  'false schema': () => 'Campo no permitido.',
  minLength: (params) => `Debe tener al menos ${String(params.limit)} caracteres.`,
  maxLength: (params) => `Debe tener como máximo ${String(params.limit)} caracteres.`,
  maxItems: (params) => `Debe tener como máximo ${String(params.limit)} elementos.`,
  enum: (params) => `Debe ser uno de estos valores: ${allowedValues(params.allowedValues)}.`,
  type: (params) => typeMessage(params.type),
  exclusiveMinimum: (params) => `Debe ser mayor que ${String(params.limit)}.`,
  minimum: (params) => `Debe ser mayor o igual que ${String(params.limit)}.`,
  maximum: (params) => `Debe ser menor o igual que ${String(params.limit)}.`,
  minProperties: () => 'Envía al menos un campo.',
  pattern: () => INVALID_FORMAT,
  format: () => INVALID_FORMAT,
};

function messageOf({ keyword, params }: FastifySchemaValidationError): string {
  const build = Object.hasOwn(MESSAGE_BY_KEYWORD, keyword)
    ? MESSAGE_BY_KEYWORD[keyword]
    : undefined;
  return build ? build(params) : DEFAULT_MESSAGE;
}

function allowedValues(values: unknown): string {
  const list = Array.isArray(values) ? values : [];
  return list
    .filter((value) => value !== null)
    .map(String)
    .join(', ');
}

const TYPE_MESSAGES: Record<string, string> = {
  integer: 'Debe ser un número entero.',
  string: 'Debe ser un texto.',
  object: 'Debe ser un objeto JSON.',
  boolean: 'Debe ser verdadero o falso.',
  array: 'Debe ser una lista.',
};

/** Con `type: ["integer", "null"]` Ajv da el tipo como lista (array o texto con comas): manda el primero no nulo. */
function typeMessage(expected: unknown): string {
  const types = Array.isArray(expected) ? expected.map(String) : String(expected).split(',');
  const first = types.find((type) => type !== 'null') ?? '';
  return Object.hasOwn(TYPE_MESSAGES, first) ? TYPE_MESSAGES[first]! : 'Tipo de dato no válido.';
}
