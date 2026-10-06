import type { FastifyPluginAsync, preValidationHookHandler } from 'fastify';
import { idParamsSchema, trimTextFields, type IdParams } from '../../http/validation.ts';
import {
  createJobBodySchema,
  jobPageSchema,
  jobSchema,
  listQuerySchema,
  type JobInput,
} from './schemas.ts';
import type { JobsService } from './service.ts';

/**
 * Recorte previo a la validación (DD-01, DEC-11.3): el JSON Schema no ve el cuerpo original. `title`, `description` y
 * `location` se recortan; `description` y `location` que quedan `""` pasan a `null`. `title` no pasa a `null` (un `""`
 * lo rechaza `minLength`). `workMode` y los salarios no se tocan: solo valen los literales exactos.
 */
const trimJobText: preValidationHookHandler = (request, _reply, done) => {
  trimTextFields(request.body, {
    trim: ['title', 'description', 'location'],
    emptyToNull: ['description', 'location'],
  });
  done();
};

/** Plugin del módulo jobs (DD-09): recibe el servicio ya compuesto en `buildApp`. Sin try/catch: errores al manejador. */
export const jobsRoutes: FastifyPluginAsync<{ service: JobsService }> = async (
  app,
  { service },
) => {
  app.post<{ Body: JobInput }>(
    '/',
    {
      preValidation: trimJobText,
      schema: { body: createJobBodySchema, response: { 201: jobSchema } },
    },
    (request, reply) => reply.code(201).send(service.create(request.body)),
  );

  app.get('/', { schema: { querystring: listQuerySchema, response: { 200: jobPageSchema } } }, () =>
    service.list(),
  );

  // Orden: JSON Schema de `params` (400) → existencia en el servicio (404).
  app.get<{ Params: IdParams }>(
    '/:id',
    { schema: { params: idParamsSchema, response: { 200: jobSchema } } },
    (request) => service.get(Number(request.params.id)),
  );
};
