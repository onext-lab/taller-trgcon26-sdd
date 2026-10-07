import type { FastifyPluginAsync } from 'fastify';
import { applicationSchema, enrollBodySchema, type EnrollInput } from './schemas.ts';
import type { ApplicationsService } from './service.ts';

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
};
