import type { FastifyServerOptions } from 'fastify';

/**
 * Logs sin datos personales (docs/RGPD.md §6): de cada petición solo se registran el método y la ruta.
 * La query se quita porque un `?q=` puede llevar el nombre o el email de un candidato, y tampoco se
 * registran la IP de origen, las cabeceras ni el cuerpo.
 */
export const loggerOptions = {
  serializers: {
    req(request: { method: string; url: string; id?: string }) {
      return { method: request.method, path: request.url.split('?')[0], reqId: request.id };
    },
  },
} satisfies Exclude<FastifyServerOptions['logger'], boolean | undefined>;
