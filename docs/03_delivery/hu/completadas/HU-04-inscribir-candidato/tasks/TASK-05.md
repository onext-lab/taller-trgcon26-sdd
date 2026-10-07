# TASK-05 — Pipeline por API (`GET /api/jobs/:jobId/applications`)

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-05; RNF-04)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
La lectura del pipeline de una oferta, registrada por el plugin de `applications` (DT-07): estado de la oferta por su
puerto, inscripciones por SQL propio y nombres por la operación de `candidates` que solo lee `id` y `full_name`. Lista
plana ordenada; la web agrupa por etapa (DD-07).

1. **`applications/repository.ts`**: `listByJob(jobId)` → `{ id, candidateId, stage, lastChangeAt, rejectionReason }[]`
   con `applications` y un `LEFT JOIN` a `stage_changes` del cambio a `rejected` (el motivo), `WHERE job_id = ?` y
   `ORDER BY last_change_at DESC, id DESC`. `stage_changes_one_final_uq` garantiza como mucho una fila por inscripción.
   Sin `JOIN` con `candidates` (DEC-06).
2. **`applications/service.ts`**: `getPipeline(jobId): Pipeline`: `jobStatus.getJobStatus(jobId)` → `null` = 404
   «La oferta no existe.»; `listByJob`; `candidates.findNames(ids)`; respuesta `{ job: { id, status }, items }` con
   `items` de exactamente 5 campos (`id`, `candidateName`, `stage`, `lastChangeAt`, `rejectionReason`). Sin transacción
   (DD-07: lecturas síncronas en una conexión) y **sin guarda de estado**: 200 en `draft`, `published` y `closed`
   (DT-03).
3. **`applications/schemas.ts`**: `pipelineParamsSchema` = `{ jobId: { type: 'string', pattern:
   idParamsSchema.properties.id.pattern } }` (reutiliza el `pattern` de `apps/api/src/http/validation.ts`),
   `querystring` vacío con `additionalProperties: false`, y `pipelineSchema` (respuesta 200: `job` con `status` en los
   3 valores e `items` con los 5 campos, `rejectionReason` como `RejectionReason | null`, todo con `required` completos
   y `additionalProperties: false`).
4. **`applications/routes.ts`**: `GET /jobs/:jobId/applications` en el mismo plugin, con `response: { 200:
   pipelineSchema }`. Convive sin conflicto con `/api/jobs/:id` del plugin `jobs` (comprobado en el TD).
5. **Test** `apps/api/test/applications/pipeline.test.ts` (inscripciones con `insertApplicationWithHistory`):
   - «CA-12 orden last_change desc + id desc, motivo solo en rejected, sin paginar»;
   - «CA-13 cada item con exactamente 5 claves; 0 email, phone ni note» (candidato con teléfono y rechazo con nota);
   - «CA-14 publicada sin inscripciones → 200 con items []»; «CA-15 inexistente → 404 «La oferta no existe.» sin datos»;
   - «EC-27 0, 1 y 200 inscripciones sin paginar; empate de fecha resuelto por ID desc»;
   - «EC-28 draft → 200 con status draft e items []»; una `closed` con inscripciones → 200 con sus `items`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/applications/repository.ts` | modificar | `listByJob` |
| `apps/api/src/modules/applications/service.ts` | modificar | `getPipeline` |
| `apps/api/src/modules/applications/schemas.ts` | modificar | `params`, `querystring` y `pipelineSchema` |
| `apps/api/src/modules/applications/routes.ts` | modificar | `GET /jobs/:jobId/applications` |
| `apps/api/test/applications/pipeline.test.ts` | crear | CA-12 a CA-15, EC-27, EC-28 |

## Implementa
- RF: RF-05 · RNF: RNF-04 · CA: CA-12, CA-13, CA-14, CA-15, CA-26 (parte API) · Edge cases: EC-27, EC-28
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Tipos de respuesta, § Endpoints, § Errores específicos, DD-07,
  § Checklist B-05

## Dependencias
- **Depende de:** TASK-04 (comparten `schemas.ts`, `service.ts`, `routes.ts` y `repository.ts`)
- **Bloquea:** TASK-06, TASK-09, TASK-11

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/pipeline` en verde, con **1** fichero de test.
- [ ] `npm test -w @ats/api -- applications jobs` en verde (las rutas de `jobs` y la nueva conviven).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/applications/repository.ts apps/api/src/modules/applications/service.ts apps/api/src/modules/applications/schemas.ts apps/api/src/modules/applications/routes.ts apps/api/test/applications/pipeline.test.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier.
- [ ] Commit único `feat(api): job pipeline endpoint (GET /api/jobs/:jobId/applications) [HU-04 TASK-05]`.

## Notas de implementación
- `rejectionReason` es no nulo si y solo si `stage === 'rejected'`; instantes en ISO 8601 UTC con milisegundos.
- `findNames` usa `json_each(?)` con la lista como JSON en **un** parámetro: dos sentencias preparadas fijas para
  cualquier tamaño, nunca SQL concatenado.
- El `response` schema es la red de seguridad de RNF-04: nada que no esté declarado puede salir.
- Errores de `params` (`jobId`) y de `querystring` los prueba TASK-09 (EC-26); el 500 de la base, también (EC-29).
- Sin paginación (S-18, excepción declarada a DEC-10). RNF-01 lo mide TASK-06.

## Reapertura · review ronda 1 (curado) (2026-10-06)
- **Origen:** `review/REVIEW.md` (ronda 1, curado de observaciones antes del merge), §9.
- **Qué hay que hacer:** DP-01 (medio): `apps/api/test/applications/pipeline.test.ts:114-115` usa los teléfonos `+34 600 111 222` y `+34 600 333 444`, fuera de la serie de ficción `+34 600 000 0xx` (`docs/RGPD.md` §6). Cámbialos (p. ej. `+34 600 000 041` y `+34 600 000 042`), también en las aserciones que los citen.
- **Ficheros:** `apps/api/test/applications/pipeline.test.ts`
- **Criterios de done:** `npm test -w @ats/api -- applications/pipeline` en verde; ningún `600 111` ni `600 333` en `apps/api/test`; eslint a 0.
