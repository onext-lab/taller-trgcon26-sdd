# TASK-05 — Detalle de la inscripción por API (`GET /api/applications/:id`) y rendimiento

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-03)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
1. **Esquema de respuesta** `applicationDetailSchema` en `schemas.ts` (DT-07), con `additionalProperties: false` y
   `required` completos en el objeto, en `candidate`, en `job` y en cada elemento de `history`:
   ```ts
   interface ApplicationDetail {
     id: number; stage: Stage; createdAt: string; lastChangeAt: string;
     candidate: { id: number; fullName: string };                       // nunca email ni teléfono
     job: { id: number; title: string; status: 'draft' | 'published' | 'closed' };
     history: { fromStage: Stage | null; toStage: Stage; changedAt: string;
                reason: RejectionReason | null; note: string | null }[];  // 1 a 5, orden por id
   }
   ```
   `reason` admite los **4** motivos (incluido `job_closed`); `fromStage` y `reason` con `type: ['string', 'null']`.
2. **Servicio** `getDetail(deps, id)`, **sin transacción** (DD-08), como `getPipeline`: `findById` (404 «La inscripción
   no existe.») → `listHistory(id)` → `deps.jobStatus.getJobSummary(application.jobId)` (si `null`, `throw new
   Error('Inscripción sin oferta')`) → `deps.candidates.findNames([application.candidateId])` (si no está, `throw new
   Error('Inscripción sin candidato')`) → objeto `ApplicationDetail`. Ambos errores llegan como 500 `INTERNAL_ERROR`
   sin datos; nunca se inventa un nombre. Factoría: `getDetail: (id) => getDetail(deps, id)`.
3. **Ruta** `GET /applications/:id` con `schema: { params: idParamsSchema, querystring: pipelineQuerySchema, response:
   { 200: applicationDetailSchema } }`.
4. **Rendimiento** (RNF-01, RNF-02) en `apps/api/test/applications/performance.test.ts`, dentro del `describe` de la
   línea 115 que ya siembra 1 000 candidatos y 2 000 inscripciones.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/applications/schemas.ts` | modificar | `applicationDetailSchema` y el tipo `ApplicationDetail` |
| `apps/api/src/modules/applications/service.ts` | modificar | `getDetail` (DD-08) y su entrada en la factoría |
| `apps/api/src/modules/applications/routes.ts` | modificar | Ruta `GET /applications/:id` |
| `apps/api/test/applications/detail.test.ts` | crear | CA-24 a CA-27 (API), CA-37, EC-20, EC-22 (`job_closed`) |
| `apps/api/test/applications/performance.test.ts` | modificar | RNF-01 (avanzar y rechazar) y RNF-02 (detalle), en el `describe` de la línea 115 |

## Implementa
- RF: RF-03, RF-09 (DP-02) · CA: CA-24, CA-25, CA-26, CA-27 (API), CA-37 · EC: EC-20, EC-22 (`job_closed`) ·
  RNF: RNF-01, RNF-02 · DD-04, DD-08
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Tipos, § Endpoints, § Firmas internas, DD-04, DD-08, § Estrategia de
  tests, § Checklist B-05

## Dependencias
- **Depende de:** TASK-02 (`listHistory`, `getJobSummary`), TASK-04 (mismos ficheros de producción; el rechazo crea el
  historial de CA-26)
- **Bloquea:** TASK-08, TASK-10, TASK-15

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/detail.test applications/performance` en verde con **2** ficheros. En
      `detail.test.ts`:
  - «CA-24 3 cambios en orden con candidate, job.title y job.status».
  - «CA-25 recién creada: 1 cambio sin origen».
  - «CA-26 rechazo manual con motivo y nota (con \n); job_closed sin nota» (el `job_closed` con `insertApplicationAt`).
  - «EC-20 contratada: 5 cambios en orden».
  - «CA-27 inexistente → 404 NOT_FOUND sin datos».
  - «CA-37 job.title sale de getJobSummary (stub con título propio)».
- [ ] En `performance.test.ts`: «RNF-01 advance y reject < 500 ms con 1 000 candidatos y 2 000 inscripciones» y
      «RNF-02 detalle con 5 cambios < 200 ms» (varias repeticiones y el peor caso contra el umbral, como los de HU-04).
- [ ] `npm test -w @ats/api -- applications/ module-boundaries` en verde con **23** ficheros (`module-boundaries.test.ts`
      sin cambios: CA-37).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/applications/schemas.ts apps/api/src/modules/applications/service.ts apps/api/src/modules/applications/routes.ts apps/api/test/applications/detail.test.ts apps/api/test/applications/performance.test.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`): `service.ts` previsto en ~210, `schemas.ts`
      ~235, `repository.ts` ~190, `routes.ts` ~90. Si `service.ts` pasara de 300, `advance` y `reject` van a
      `apps/api/src/modules/applications/stage-change.ts` (DD-06).
- [ ] Commit único `feat(api): application detail with stage history [HU-05 TASK-05]`.

## Notas de implementación
- La nota **solo** sale en este endpoint (RNF-05); el pipeline sigue con 5 campos (no se toca).
- El nombre llega por `findNames` (solo `id` y `full_name`): ninguna lectura nueva sobre `candidates` (DP-02).
- La query vacía se valida con `pipelineQuerySchema` (`additionalProperties: false`): `?x=1` → 400 (EC-19, lo prueba
  TASK-08).
- Los casos hostiles del detalle (EC-19, EC-21, EC-22 sin nombre, EC-23) son de TASK-08.
