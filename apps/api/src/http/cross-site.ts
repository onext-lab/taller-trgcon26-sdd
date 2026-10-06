import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SAME_ORIGIN_VALUES = new Set(['same-origin', 'none']);

function isForeignSite(header: string | string[] | undefined): boolean {
  if (header === undefined) return false;
  const value = (Array.isArray(header) ? header.join(',') : header).trim().toLowerCase();
  return !SAME_ORIGIN_VALUES.has(value);
}

/**
 * Escrituras entre sitios (DEC-12 enmendada, DD-06): hook `onRequest` global, antes de parsear el cuerpo y de validar.
 * Rechaza con 403 `CROSS_SITE_REQUEST` toda petición cuyo método no sea `GET`, `HEAD` ni `OPTIONS` si `Sec-Fetch-Site`
 * (en minúsculas y recortado) no vale `same-origin` ni `none`; `same-site` también se rechaza (otro puerto local). Sin la
 * cabecera pasa (`inject` no la envía y la web va por el proxy de Vite, `same-origin`). Una lista de métodos seguros
 * protege también los métodos que añadan otras HU. El 403 no lleva `details` ni datos de la petición.
 */
export function registerCrossSiteGuard(app: FastifyInstance): void {
  app.addHook('onRequest', (request, _reply, done) => {
    if (!SAFE_METHODS.has(request.method) && isForeignSite(request.headers['sec-fetch-site'])) {
      done(new AppError('CROSS_SITE_REQUEST', 403, 'Petición no permitida desde otro sitio.'));
      return;
    }
    done();
  });
}
