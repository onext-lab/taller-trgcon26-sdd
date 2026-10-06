import type { FastifyPluginAsync, preValidationHookHandler } from 'fastify';
import {
  idParamsSchema,
  rejectBody,
  trimTextFields,
  type IdParams,
} from '../../http/validation.ts';
import {
  closePreviewSchema,
  createJobBodySchema,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  jobPageSchema,
  jobSchema,
  listQuerySchema,
  updateJobBodySchema,
  type JobInput,
  type JobListQuery,
  type JobListQuerystring,
  type JobPatch,
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

/** Recorte de `q` antes de validar (DD-05): un tabulador o salto de línea en el borde se recorta; dentro, 400. */
const trimSearchText: preValidationHookHandler = (request, _reply, done) => {
  trimTextFields(request.query, { trim: ['q'], emptyToNull: [] });
  done();
};

/** `page` y `pageSize` llegan como texto validado por `pattern`; `q` vacío = sin filtro. */
function toListQuery({ status, q, page, pageSize }: JobListQuerystring): JobListQuery {
  return {
    status,
    q: q || undefined,
    page: page === undefined ? DEFAULT_PAGE : Number(page),
    pageSize: pageSize === undefined ? DEFAULT_PAGE_SIZE : Number(pageSize),
  };
}

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

  app.get<{ Querystring: JobListQuerystring }>(
    '/',
    {
      preValidation: trimSearchText,
      schema: { querystring: listQuerySchema, response: { 200: jobPageSchema } },
    },
    (request) => service.list(toListQuery(request.query)),
  );

  // Orden: JSON Schema de `params` (400) → existencia en el servicio (404).
  app.get<{ Params: IdParams }>(
    '/:id',
    { schema: { params: idParamsSchema, response: { 200: jobSchema } } },
    (request) => service.get(Number(request.params.id)),
  );

  // Orden: JSON Schema de `params` y `body` (400) → existencia (404) → reglas del servicio (400).
  app.patch<{ Params: IdParams; Body: JobPatch }>(
    '/:id',
    {
      preValidation: trimJobText,
      schema: { params: idParamsSchema, body: updateJobBodySchema, response: { 200: jobSchema } },
    },
    (request) => service.update(Number(request.params.id), request.body),
  );

  // Sin cuerpo: 204 vacío.
  app.delete<{ Params: IdParams }>(
    '/:id',
    { schema: { params: idParamsSchema } },
    (request, reply) => {
      service.remove(Number(request.params.id));
      return reply.code(204).send();
    },
  );

  // Lectura previa al cierre (DD-11): no cambia nada, en cualquier estado.
  app.get<{ Params: IdParams }>(
    '/:id/close-preview',
    { schema: { params: idParamsSchema, response: { 200: closePreviewSchema } } },
    (request) => service.closePreview(Number(request.params.id)),
  );

  // Acciones sin cuerpo (DD-01): `rejectBody` → `params` (400) → existencia (404) → estado (409) → campos (400).
  app.post<{ Params: IdParams }>(
    '/:id/publish',
    { preValidation: rejectBody, schema: { params: idParamsSchema, response: { 200: jobSchema } } },
    (request) => service.publish(Number(request.params.id)),
  );

  app.post<{ Params: IdParams }>(
    '/:id/close',
    { preValidation: rejectBody, schema: { params: idParamsSchema, response: { 200: jobSchema } } },
    (request) => service.close(Number(request.params.id)),
  );

  app.post<{ Params: IdParams }>(
    '/:id/duplicate',
    { preValidation: rejectBody, schema: { params: idParamsSchema, response: { 201: jobSchema } } },
    (request, reply) => reply.code(201).send(service.duplicate(Number(request.params.id))),
  );
};
