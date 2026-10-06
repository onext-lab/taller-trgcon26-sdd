import type { FastifyServerOptions } from 'fastify';

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
