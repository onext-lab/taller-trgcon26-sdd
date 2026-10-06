import type { FastifyServerOptions, preValidationHookHandler } from 'fastify';
import { validationError } from '../errors.ts';

/**
 * Ajv estricto de verdad (DEC-11.1): sin coerción (`"40000"` no es un entero), sin quitar en silencio los campos
 * sobrantes y con todos los errores, para dar un elemento de `details` por campo.
 */
export const ajvOptions = {
  customOptions: { coerceTypes: false, removeAdditional: false, allErrors: true },
} satisfies FastifyServerOptions['ajv'];

/** Sin coerción el ID de la ruta llega como texto (DEC-11.2): se valida con `pattern` y la ruta lo pasa a `Number()`. */
export const idParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', pattern: '^[1-9][0-9]{0,14}$' } },
} as const;

export type IdParams = { id: string };

/**
 * Caracteres de control (DEC-11.8, EC-50). Ajv compila `pattern` con el flag `u`, así que `\uXXXX` basta; se escriben
 * como secuencias de escape para no llevar caracteres crudos en el código.
 * - `NO_CONTROL_CHARS`: ni C0 (U+0000-U+001F) ni DEL (U+007F). Para textos de una línea (título, ubicación).
 * - `NO_CONTROL_CHARS_EXCEPT_WHITESPACE`: lo mismo salvo tabulador (U+0009), salto de línea (U+000A) y retorno de
 *   carro (U+000D). Para textos largos (descripción de una oferta, resumen de un candidato).
 */
export const NO_CONTROL_CHARS = '^[^\\u0000-\\u001F\\u007F]*$';
export const NO_CONTROL_CHARS_EXCEPT_WHITESPACE =
  '^[^\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]*$';

export interface TrimOptions {
  trim: readonly string[];
  emptyToNull: readonly string[];
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recorte previo a la validación (DEC-11.3), para un hook `preValidation`: muta el cuerpo si es un objeto JSON.
 * Recorta las claves de `trim` que sean texto y pasa a `null` las de `emptyToNull` que queden `""`.
 */
export function trimTextFields(body: unknown, { trim, emptyToNull }: TrimOptions): void {
  if (!isJsonObject(body)) return;
  for (const key of trim) {
    const value = Object.hasOwn(body, key) ? body[key] : undefined;
    if (typeof value === 'string') body[key] = value.trim();
  }
  for (const key of emptyToNull) {
    if (Object.hasOwn(body, key) && body[key] === '') body[key] = null;
  }
}

/**
 * Hook `preValidation` de las acciones sin cuerpo (DD-01): cualquier cuerpo, también `{}`, `null` o un texto, es un 400.
 * Corre antes que el esquema de `params`: con ID inválido y cuerpo, `details` solo trae `body`.
 */
export const rejectBody: preValidationHookHandler = (request, _reply, done) => {
  if (request.body !== undefined) {
    done(validationError([{ field: 'body', message: 'Esta acción no admite cuerpo.' }]));
    return;
  }
  done();
};
