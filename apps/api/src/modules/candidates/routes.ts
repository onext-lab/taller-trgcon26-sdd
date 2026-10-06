import type { FastifyPluginAsync, preValidationHookHandler } from 'fastify';
import { idParamsSchema, rejectBody, type IdParams } from '../../http/validation.ts';
import { normalizeCandidateBody } from './normalize.ts';
import {
  candidateSchema,
  createCandidateBodySchema,
  updateCandidateBodySchema,
  type CandidateInput,
  type CandidatePatch,
} from './schemas.ts';
import type { CandidatesService } from './service.ts';

/**
 * Normalización previa al esquema (DD-03): el JSON Schema valida lo que se guardará, así que `maxItems` cuenta las
 * skills ya deduplicadas.
 */
const normalizeBody: preValidationHookHandler = (request, _reply, done) => {
  request.body = normalizeCandidateBody(request.body);
  done();
};

/** Plugin del módulo candidates: recibe el servicio ya compuesto en `buildApp`. Sin try/catch: errores al manejador. */
export const candidatesRoutes: FastifyPluginAsync<{ service: CandidatesService }> = async (
  app,
  { service },
) => {
  app.post<{ Body: CandidateInput }>(
    '/',
    {
      preValidation: normalizeBody,
      schema: { body: createCandidateBodySchema, response: { 201: candidateSchema } },
    },
    (request, reply) => reply.code(201).send(service.create(request.body)),
  );

  // Orden: JSON Schema de `params` (400) → existencia en el servicio (404).
  app.get<{ Params: IdParams }>(
    '/:id',
    { schema: { params: idParamsSchema, response: { 200: candidateSchema } } },
    (request) => service.get(Number(request.params.id)),
  );

  // Orden: JSON Schema de `params` y `body` (400) → existencia (404) → email de otro (409).
  app.patch<{ Params: IdParams; Body: CandidatePatch }>(
    '/:id',
    {
      preValidation: normalizeBody,
      schema: {
        params: idParamsSchema,
        body: updateCandidateBodySchema,
        response: { 200: candidateSchema },
      },
    },
    (request) => service.update(Number(request.params.id), request.body),
  );

  // Acciones sin cuerpo (DD-01): `rejectBody` → `params` (400) → existencia (404).
  app.post<{ Params: IdParams }>(
    '/:id/consent',
    {
      preValidation: rejectBody,
      schema: { params: idParamsSchema, response: { 200: candidateSchema } },
    },
    (request) => service.giveConsent(Number(request.params.id)),
  );

  app.post<{ Params: IdParams }>(
    '/:id/consent/withdrawal',
    {
      preValidation: rejectBody,
      schema: { params: idParamsSchema, response: { 200: candidateSchema } },
    },
    (request) => service.withdrawConsent(Number(request.params.id)),
  );
};
