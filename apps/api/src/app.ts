import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';

export interface AppOptions {
  db: DatabaseSync;
  logger?: FastifyServerOptions['logger'];
}

export function buildApp({ db, logger = false }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

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

  return app;
}
