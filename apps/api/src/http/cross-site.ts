import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.ts';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

/**
 * Escrituras entre sitios (DEC-12, DD-06): hook `onRequest` global, antes de parsear el cuerpo y de validar. Rechaza con
 * 403 `CROSS_SITE_REQUEST` las escrituras con `Sec-Fetch-Site: cross-site`; sin la cabecera pasa (`inject` no la envía y
 * la web va por el proxy de Vite, `same-origin`). El 403 no lleva `details` ni datos de la petición.
 */
export function registerCrossSiteGuard(app: FastifyInstance): void {
  app.addHook('onRequest', (request, _reply, done) => {
    if (WRITE_METHODS.has(request.method) && request.headers['sec-fetch-site'] === 'cross-site') {
      done(new AppError('CROSS_SITE_REQUEST', 403, 'Petición no permitida desde otro sitio.'));
      return;
    }
    done();
  });
}
