import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { AppError } from '../../errors.ts';
import { toValidationDetails } from '../../http/error-handler.ts';
import { FILE_TOO_LARGE_MESSAGE, MAX_IMPORT_BYTES } from './import-file.ts';
import type { RowValidator } from './import-rows.ts';
import { importReportSchema, importRowSchema } from './import-schemas.ts';
import type { CandidatesService } from './service.ts';

const UNSUPPORTED_MEDIA_TYPE_MESSAGE = 'Tipo de contenido no admitido.';

/** Validador de fila: el esquema del alta compilado por el Ajv de la app y traducido con los mismos mensajes (DD-03). */
function rowValidator(request: FastifyRequest): RowValidator {
  const validate = request.compileValidationSchema(importRowSchema);
  return (row) => (validate(row) ? [] : toValidationDetails(validate.errors ?? [], 'row'));
}

/**
 * Importación por CSV (DEC-13, DD-01): plugin **encapsulado** (sin `fastify-plugin`) cuyo único parser es `text/csv`
 * en bruto. El resto de la API sigue sin aceptarlo y esta ruta no acepta JSON, `multipart` ni `urlencoded` (415).
 */
export const candidateImportRoutes: FastifyPluginAsync<{ service: CandidatesService }> = async (
  app,
  { service },
) => {
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('text/csv', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  app.post(
    '/import',
    {
      bodyLimit: MAX_IMPORT_BYTES,
      config: { payloadTooLargeMessage: FILE_TOO_LARGE_MESSAGE },
      schema: { response: { 200: importReportSchema } },
    },
    (request) => {
      // Sin `Content-Type` Fastify llega aquí con el cuerpo `undefined` (DD-10).
      if (!Buffer.isBuffer(request.body)) {
        throw new AppError('UNSUPPORTED_MEDIA_TYPE', 415, UNSUPPORTED_MEDIA_TYPE_MESSAGE);
      }
      return service.importCsv(new Uint8Array(request.body), rowValidator(request));
    },
  );
};
