import type { FastifyPluginAsync, preValidationHookHandler } from 'fastify';
import { idParamsSchema, trimTextFields, type IdParams } from '../../http/validation.ts';
import {
  advanceBodySchema,
  applicationSchema,
  enrollBodySchema,
  pipelineParamsSchema,
  pipelineQuerySchema,
  pipelineSchema,
  rejectBodySchema,
  type AdvanceInput,
  type EnrollInput,
  type RejectInput,
} from './schemas.ts';
import type { ApplicationsService } from './service.ts';

/** Recorta la nota y pasa `""` a `null` antes del esquema (DEC-11.3); solo en el rechazo. */
const trimNote: preValidationHookHandler = (request, _reply, done) => {
  trimTextFields(request.body, { trim: ['note'], emptyToNull: ['note'] });
  done();
};

/**
 * Plugin del módulo applications: recibe el servicio ya compuesto en `buildApp`. Sin try/catch: errores al manejador.
 * Orden: guarda entre sitios (403) → parser (415, 413, 400) → JSON Schema del cuerpo (400) → servicio (404, 409).
 */
export const applicationsRoutes: FastifyPluginAsync<{ service: ApplicationsService }> = async (
  app,
  { service },
) => {
  app.post<{ Body: EnrollInput }>(
    '/applications',
    { schema: { body: enrollBodySchema, response: { 201: applicationSchema } } },
    (request, reply) => reply.code(201).send(service.enroll(request.body)),
  );

  app.post<{ Params: IdParams; Body: AdvanceInput }>(
    '/applications/:id/advance',
    {
      schema: {
        params: idParamsSchema,
        body: advanceBodySchema,
        response: { 200: applicationSchema },
      },
    },
    (request) => service.advance(Number(request.params.id), request.body),
  );

  app.post<{ Params: IdParams; Body: RejectInput }>(
    '/applications/:id/reject',
    {
      preValidation: trimNote,
      schema: {
        params: idParamsSchema,
        body: rejectBodySchema,
        response: { 200: applicationSchema },
      },
    },
    (request) => service.reject(Number(request.params.id), request.body),
  );

  app.get<{ Params: { jobId: string } }>(
    '/jobs/:jobId/applications',
    {
      schema: {
        params: pipelineParamsSchema,
        querystring: pipelineQuerySchema,
        response: { 200: pipelineSchema },
      },
    },
    (request) => service.getPipeline(Number(request.params.jobId)),
  );
};
