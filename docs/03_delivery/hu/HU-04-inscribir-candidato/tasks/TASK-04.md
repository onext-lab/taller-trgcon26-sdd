# TASK-04 — Inscribir por API (`POST /api/applications`)

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-01, RF-03, RF-10)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
El endpoint de inscribir, de punta a punta: JSON Schema, servicio transaccional, traducción del duplicado, plugin de
rutas, composición en `buildApp` y sus tests de camino feliz y de reglas.

1. **`applications/schemas.ts`**: `ID = { type: 'integer', minimum: 1, maximum: 9007199254740991 }`;
   `enrollBodySchema = { type: 'object', additionalProperties: false, required: ['jobId', 'candidateId'], properties:
   { jobId: ID, candidateId: ID } }`; `applicationSchema` (respuesta 201) con exactamente los 6 campos de `Application`,
   `required` completos y `additionalProperties: false`. `stage`, `id` o las fechas **no** se declaran con
   `forbiddenFields`: EC-01 pide que salgan agrupadas en `{ field: 'body', message: 'Hay campos no permitidos.' }`.
2. **`applications/repository.ts`**: `findIdByPair(candidateId, jobId): number | undefined` e
   `isDuplicatePairError(error)`: `errcode === 2067` **y** `'applications.candidate_id'` en el mensaje (patrón de
   `isDuplicateEmailError` de `apps/api/src/modules/candidates/repository.ts`).
3. **`applications/service.ts`** (nuevo): `createApplicationsService(deps)` con `enroll({ jobId, candidateId })`.
   `ApplicationsServiceDeps = { repository, now, transaction, jobStatus, candidates, recalculateRetention }`. **Todo
   dentro de `transaction` (`withTransaction`, `BEGIN IMMEDIATE`), en este orden:**
   1. `jobStatus.getJobStatus(jobId)` → `null` = 404 «La oferta no existe.»;
   2. `candidates.exists(candidateId)` → `false` = 404 «El candidato no existe.»;
   3. estado ≠ `published` → 409 `INVALID_TRANSITION` «La oferta no está publicada: no admite inscripciones.» (el mismo
      en `draft` y `closed`, CA-05);
   4. `now()` **una sola vez**; `repository.insert` en `received` con `createdAt = lastChangeAt = now`; si
      `isDuplicatePairError` → `findIdByPair` en la misma transacción y `duplicate({ field: 'candidateId', message:
      'Este candidato ya está inscrito en la oferta.', existingId })` (`apps/api/src/errors.ts`);
   5. `insertStageChange` `NULL → received` con el mismo instante, sin motivo ni nota;
   6. `recalculateRetention(candidateId)`.
   Cualquier error hace `ROLLBACK` de todo (DT-08, DEC-06). Ni el servicio ni los puertos añaden logs ni envuelven
   errores con datos de contexto (DP-01).
4. **`applications/routes.ts`** (nuevo): plugin `applicationsRoutes` con `POST /applications` (prefijo `/api`), `body:
   enrollBodySchema`, `response: { 201: applicationSchema }`, `reply.code(201)`.
5. **`apps/api/src/app.ts`**: `AppOptions.jobStatus?: JobStatusPort` (solo para tests, DD-08); composición del TD:
   ```ts
   const jobStatusPort: JobStatusPort = jobStatus ?? createJobStatusReader(jobsRepository); // comprobación estructural
   const applicationsService = createApplicationsService({ repository: applicationsRepository, now,
     transaction: (fn) => withTransaction(db, fn), jobStatus: jobStatusPort,
     candidates: { exists: (id) => candidatesService.exists(id), findNames: (ids) => candidatesService.findNames(ids) },
     recalculateRetention: (id) => { candidatesService.recalculateRetention(id); } });
   app.register(applicationsRoutes, { prefix: '/api', service: applicationsService });
   ```
   Reutiliza el `jobsRepository` que ya crea `buildApp` (no crees otro). La guarda `CROSS_SITE_REQUEST` (DEC-12) es
   global: el `POST` la hereda sin código nuevo.
6. **Helpers**: `jobStatus` en `createTestApp` (`apps/api/test/helpers/test-app.ts`) y `enroll(app, jobId,
   candidateId)` en `apps/api/test/helpers/applications.ts` (devuelve la respuesta del `inject`).
7. **Tests** (dos ficheros hermanos, ≤ 300 líneas cada uno):
   - `apps/api/test/applications/enroll.test.ts`:
     - «CA-01 inscribir → 201 received con exactamente 6 claves, StageChange NULL→received con el reloj y
       retentionEndsAt null en GET /api/candidates/:id»;
     - «CA-04 draft → 409 INVALID_TRANSITION, nada creado, retención igual»; «CA-05 closed → 409 con el mismo mensaje»;
     - «CA-06 repetir en received y en rejected → 409 DUPLICATE con existingId, retención igual» (la `rejected`, con
       `insertApplicationWithHistory`; cubre EC-04);
     - «CA-09 oferta y candidato inexistentes → 404 con su mensaje, sin datos» (con los dos inexistentes, gana la oferta);
     - «EC-11 reintento de una inscripción creada → 409 con el ID; 1 StageChange; retención igual»;
     - «EC-17 draft 409, published 201, closed 409, inexistente y borrador borrado 404».
   - `apps/api/test/applications/enroll-retention.test.ts`:
     - «EC-08 retención vencida (reloj adelantado con `createTestClock`) → 201 y retentionEndsAt null»;
     - «EC-23 consentimiento vigente + inscripción → null (la inscripción abierta prevalece)»;
     - «EC-53 consentimiento retirado + inscripción → null».

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/applications/schemas.ts` | modificar | `enrollBodySchema`, `applicationSchema` |
| `apps/api/src/modules/applications/repository.ts` | modificar | `findIdByPair`, `isDuplicatePairError` |
| `apps/api/src/modules/applications/service.ts` | crear | `createApplicationsService` con `enroll` |
| `apps/api/src/modules/applications/routes.ts` | crear | Plugin `applicationsRoutes` con `POST /applications` |
| `apps/api/src/app.ts` | modificar | `jobStatus?`, servicio de `applications` y registro del plugin |
| `apps/api/test/helpers/test-app.ts` | modificar | `jobStatus` en `createTestApp` |
| `apps/api/test/helpers/applications.ts` | modificar | `enroll(app, jobId, candidateId)` |
| `apps/api/test/applications/enroll.test.ts` | crear | CA-01, CA-04, CA-05, CA-06, CA-09, EC-04, EC-11, EC-17 |
| `apps/api/test/applications/enroll-retention.test.ts` | crear | EC-08, EC-23, EC-53 |

## Implementa
- RF: RF-01, RF-03 (guarda en la transacción), RF-10 (API) · CA: CA-01, CA-04, CA-05, CA-06, CA-09, CA-19 (parte API)
  · Edge cases: EC-04, EC-08, EC-11, EC-17, EC-23, EC-53
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (Endpoints, Orden de comprobación del `POST`, Errores
  específicos, Firmas internas, Composición), § Diagrama de secuencia, DD-02, DD-03, DD-08, § Checklist B-04

## Dependencias
- **Depende de:** TASK-03
- **Bloquea:** TASK-05, TASK-06, TASK-07, TASK-08, TASK-13

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/enroll` en verde, con **2** ficheros de test.
- [ ] `npm test -w @ats/api -- candidates jobs applications/ports` en verde sin tocar sus tests.
- [ ] El 201 lleva exactamente `id`, `jobId`, `candidateId`, `stage`, `createdAt` y `lastChangeAt`; ningún `message` ni
      `details` de error lleva nombre, email ni teléfono (el 409 `DUPLICATE` solo `existingId`).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/applications/schemas.ts apps/api/src/modules/applications/repository.ts apps/api/src/modules/applications/service.ts apps/api/src/modules/applications/routes.ts apps/api/src/app.ts apps/api/test/helpers/test-app.ts apps/api/test/helpers/applications.ts apps/api/test/applications/enroll.test.ts apps/api/test/applications/enroll-retention.test.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier; ninguna función de más de 50 líneas.
- [ ] Commit único `feat(api): enroll a candidate in a published job (POST /api/applications) [HU-04 TASK-04]`.

## Notas de implementación
- **DD-02:** la guarda es leer el puerto dentro del mismo `BEGIN IMMEDIATE` que el `INSERT`; nada de `INSERT … SELECT`
  sobre `job_openings` ni de trigger `BEFORE INSERT` (DEC-06, DT-07).
- **DD-03:** sin `SELECT` previo de la pareja: decide el índice único (DEC-08).
- `recalculateRetention` de `candidates` se une a la transacción en curso y es el único escritor de
  `retention_ends_at`; con una inscripción abierta deja `NULL` aunque la fecha anterior hubiera vencido (DT-06).
- `withTransaction` (`apps/api/src/db/transaction.ts`), `Clock` (`apps/api/src/clock.ts`), `ajvOptions` y el envelope
  de `apps/api/src/http/error-handler.ts` se reutilizan; no se crean equivalentes.
- Ventana de INV-05 (DT-10): `JobApplicationsPort` **no** se conecta (`noJobApplications` sigue). Ningún test de esta
  tarea cierra una oferta con inscripciones.
- Helpers existentes: `createTestApp`, `createTestClock`, `createPublishedJob`, `closeJob`, `createJob`,
  `createCandidate`, `createProcessesStub`. Datos inventados (`@example.com`, `+34 600 000 0xx`).
