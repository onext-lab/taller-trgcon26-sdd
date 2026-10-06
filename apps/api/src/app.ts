import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { systemClock, type Clock } from './clock.ts';
import { withTransaction } from './db/transaction.ts';
import { registerErrorHandling } from './http/error-handler.ts';
import { ajvOptions } from './http/validation.ts';
import { createJobsRepository } from './modules/jobs/repository.ts';
import { jobsRoutes } from './modules/jobs/routes.ts';
import { createJobsService } from './modules/jobs/service.ts';

export interface AppOptions {
  db: DatabaseSync;
  logger?: FastifyServerOptions['logger'];
  /** Reloj inyectado (DEC-09) que reciben los servicios; `systemClock` por defecto. */
  now?: Clock;
}

export function buildApp({ db, logger = false, now = systemClock }: AppOptions): FastifyInstance {
  const app = Fastify({ logger, ajv: ajvOptions });
  // Antes de cualquier ruta o módulo, para que todos hereden el envelope de error.
  registerErrorHandling(app);

  app.addHook('onClose', () => {
    if (db.isOpen) db.close();
  });

  app.get(
    '/api/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: { status: { type: 'string', const: 'ok' } },
            required: ['status'],
          },
        },
      },
    },
    () => {
      db.prepare('SELECT 1').get();
      return { status: 'ok' };
    },
  );

  // Único punto de composición (DD-09): sin singletons, cada módulo recibe sus dependencias.
  const jobsService = createJobsService({
    repository: createJobsRepository(db),
    now,
    transaction: (fn) => withTransaction(db, fn),
  });
  app.register(jobsRoutes, { prefix: '/api/jobs', service: jobsService });

  return app;
}
