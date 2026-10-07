# Módulo `inscripciones` (código `applications`) — Foto técnica

Estado de `main` sincronizado hasta **HU-05** (2026-10-07, review «Aprobado con observaciones», ronda 1). Lo mantiene
`/module-sync`; la parte funcional y el % MVP están en [functional.md](functional.md). Decisiones que lo condicionan:
DEC-01, DEC-03, DEC-04, DEC-06 (aclarada en HU-04) a DEC-12 de
[DECISIONS.md](../../07_architecture_principles/DECISIONS.md) y [RGPD.md](../../RGPD.md) §1, §3, §5 y §6.

**Está hecho inscribir, avanzar, contratar y rechazar, el pipeline y el detalle con su historial** (HU-04 y HU-05). Lo
**latente**: `JobApplicationsPort` de `jobs` sigue con el stub `noJobApplications` hasta HU-06, así que cerrar una
oferta no rechaza sus inscripciones y la API todavía las mueve (DT-09; ver «Puertos»).

## Estructura de código

| Capa | Ruta | Contenido |
|---|---|---|
| Rutas | `apps/api/src/modules/applications/routes.ts` | Plugin `applicationsRoutes` con prefijo `/api` (registra `POST /applications`, `POST /applications/:id/advance`, `POST /applications/:id/reject`, `GET /applications/:id` y `GET /jobs/:jobId/applications`), sin `try/catch`; `trimNote` recorta la nota antes de validar |
| Servicio | `apps/api/src/modules/applications/service.ts` | `createApplicationsService(deps)` (6 líneas) reúne casos de uso que son funciones del módulo: `enroll`, `getPipeline`, `advance`, `reject` y `getDetail`; `applyStageChange` escribe la guarda, el `StageChange` y el recálculo en la transacción |
| Repositorio | `apps/api/src/modules/applications/repository.ts` | `createApplicationsRepository(db)`: SQL preparado (`insert`, `insertStageChange`, `findIdByPair`, `isDuplicatePairError`, `listByJob`, `getProcessFacts`, `findById`, `updateStage` con la guarda `WHERE id = ? AND stage = ?` y `RETURNING`, `listHistory`); sin `SELECT *` |
| Esquemas | `apps/api/src/modules/applications/schemas.ts` | `STAGES`, `REJECTION_REASONS`, tipos (`Application`, `PipelineItem`, `Pipeline`, `EnrollInput`) y JSON Schema (`enrollBodySchema`, `applicationSchema`, `pipelineParamsSchema`, `pipelineQuerySchema`, `pipelineSchema`); desde HU-05, `MANUAL_REJECTION_REASONS`, `advanceBodySchema`, `rejectBodySchema`, `applicationDetailSchema` y los tipos `StageChangeEntry` y `ApplicationDetail` |
| Transiciones | `apps/api/src/modules/applications/transitions.ts` | Funciones puras: `NEXT_STAGE`, `isFinal`, `decideAdvance` y `decideReject` (`noop` para el reintento, o lanzan `STAGE_MISMATCH` o `INVALID_TRANSITION` en ese orden) |
| Puertos | `apps/api/src/modules/applications/ports.ts` | `JobStatus`, `JobSummary`, `JobStatusPort` (`getJobStatus` y, desde HU-05, `getJobSummary`) y `CandidateLookupPort`: los **define** `applications` |
| Lector de procesos | `apps/api/src/modules/applications/candidate-processes.ts` | `createCandidateProcessesReader(repo)`: implementa el `CandidateProcessesPort` de `candidates` sin importarlo |
| Composición | `apps/api/src/app.ts` | `buildApp({ db, logger?, now?, jobApplications?, candidateProcesses?, jobStatus? })` crea el repositorio y el servicio, conecta los tres puertos y registra el plugin |
| Migración · seed | `apps/api/src/db/migrations/003-create-applications.sql` · `apps/api/src/db/seed-applications.ts` | Tablas `applications` y `stage_changes` · 40 inscripciones con historial (`insertApplicationWithHistory` y `seedApplications`) que `seed(db, now)` carga en la misma transacción que ofertas y candidatos |
| Web | `apps/web/src/features/applications/` | `api.ts`, `types.ts`, `paths.ts`, `labels.ts`, `enroll-errors.ts`, `PipelineScreen.tsx`, `PipelineBoard.tsx`, `EnrollPanel.tsx`, `use-pipeline-feedback.ts`, `use-enroll-panel.ts`, `use-candidate-search.ts`, `use-enrollment.ts`; desde HU-05, `stage-errors.ts`, `reject-form.ts`, `use-stage-change.ts`, `use-stage-actions.ts`, `use-reject-form.ts`, `StageDialogs.tsx`, `ApplicationDetailScreen.tsx` y `ApplicationDetails.tsx` |
| Tests API | `apps/api/test/applications/` · `apps/api/test/helpers/applications.ts` · `apps/api/test/module-boundaries.test.ts` | `enroll`, `enroll-adversarial`, `enroll-failures-adversarial`, `enroll-retention`, `pipeline`, `pipeline-adversarial`, `ports`, `migration`, `migration-triggers`, `integrity-adversarial`, `seed`, `seed-invariants`, `privacy-logs`, `performance`; desde HU-05, `transitions`, `stage-repository`, `advance`, `advance-hire`, `reject`, `reject-note`, `detail`, `detail-adversarial`, `stage-change-adversarial`, `stage-change-failures-adversarial`, `stage-change-privacy` y `migration-triggers-replace` · `createJobStatusStub`, `createJobStatusSpy`, `enroll`, `advance`, `reject`, `getApplication` e `insertApplicationAt` · ningún `import` entre módulos |
| Tests web · e2e | `apps/web/test/features/applications/` · `e2e/applications.spec.ts` | Testing Library con `fetch` simulado (`api`, `api.stage`, `labels`, `reject-form`, `PipelineScreen`, `.states`, `.search`, `.enroll`, `.adversarial`, `.advance`, `.hire`, `.reject`, `.reject-form`, `.links`, `.stage-adversarial`, `ApplicationDetailScreen` y `.adversarial`; `fixtures.ts`, `enroll-fixtures.ts`, `stage-fixtures.ts` y `reject-fixtures.ts`) · Playwright sobre `data/e2e.db`: `e2e/applications.spec.ts`, `e2e/pipeline-stages.spec.ts` y `e2e/pipeline-closed.spec.ts`, con `e2e/support/applications.ts` |

Piezas transversales que usa: `apps/api/src/http/` (`error-handler.ts`, `validation.ts`, `cross-site.ts`),
`apps/api/src/errors.ts` (`notFound`, `invalidTransition`, `duplicate`, `stageMismatch`), `apps/api/src/clock.ts`,
`apps/api/src/db/transaction.ts` y, en la web, `apps/web/src/components/` (`http.ts`, `router.tsx`, `StatusMessages.tsx`,
`use-resource.ts`, `use-lifetime-signal.ts`, `use-document-title.ts`, `list-controls.ts`, `FormField`, `format.ts`).
HU-04 añadió a lo compartido `reload()` en `use-resource.ts` y el `ref` opcional de `Notice`; HU-05, la `description`
opcional de `ConfirmDialog` (ver «Pantallas»).

## Tablas y migraciones

Migración `003-create-applications.sql` (la `001` es de ofertas y la `002`, de candidatos; ninguna se tocó). Instantes en
ISO 8601 UTC con milisegundos (`GLOB`). `PRAGMA foreign_keys = ON` en `apps/api/src/db/connection.ts`.

`applications`:

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Sin borrado: no hay ruta ni operación (INV-08) |
| `candidate_id` · `job_id` | `INTEGER NOT NULL` | FK a `candidates (id)` y `job_openings (id)`, ambas `ON DELETE RESTRICT` |
| `stage` | `TEXT NOT NULL` | `received`, `screening`, `interview`, `offer`, `hired`, `rejected` |
| `created_at` · `last_change_at` | `TEXT NOT NULL` | `GLOB` ISO con ms; `CHECK (last_change_at >= created_at)` |

`stage_changes` (historial; un registro por paso):

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | — |
| `application_id` | `INTEGER NOT NULL` | FK a `applications (id)`, `ON DELETE RESTRICT` |
| `from_stage` · `to_stage` | `TEXT` · `TEXT NOT NULL` | `from_stage` nulo solo en el cambio inicial; la pareja cumple la tabla de transiciones (abajo) |
| `changed_at` | `TEXT NOT NULL` | `GLOB` ISO con ms |
| `reason` | `TEXT` | Nulo o `not_a_fit`, `candidate_withdrew`, `other`, `job_closed` |
| `note` | `TEXT` | Nulo o `length` 1-500 |

- **Índices.** `applications_candidate_job_uq`, **único** sobre `(candidate_id, job_id)` (INV-01, DEC-08): decide el
  duplicado y, al empezar por `candidate_id`, sirve también al lector de procesos. `applications_job_pipeline_idx`
  sobre `(job_id, last_change_at DESC, id DESC)`: el orden del pipeline. `stage_changes_application_idx` sobre
  `(application_id, id)`. Dos únicos **parciales**: `stage_changes_one_initial_uq` (`WHERE from_stage IS NULL`) y
  `stage_changes_one_final_uq` (`WHERE to_stage IN ('hired','rejected')`): como mucho un cambio inicial y uno final por
  inscripción, así que el `LEFT JOIN` del pipeline no duplica filas.
- **`CHECK` de transiciones (INV-04)**, con `IS` y no `=`: `(NULL → received)`, `received → screening | rejected`,
  `screening → interview | rejected`, `interview → offer | rejected`, `offer → hired | rejected`. Con `=`, un
  `(NULL, 'screening')` daría `NULL` en cada término y SQLite **acepta** un `CHECK` que vale `NULL` (EC-13).
- **`CHECK` de motivo y nota:** `(reason IS NOT NULL) = (to_stage = 'rejected')` (INV-07) y `note IS NULL OR to_stage =
  'rejected'` (INV-10). Ningún `CHECK` exige nota en un rechazo: es opcional.
- **Dos triggers, los únicos del esquema (DT-07, INV-03):** `stage_changes_no_delete` aborta todo `DELETE` sin excepción;
  `stage_changes_no_update` aborta todo `UPDATE` salvo **`SET note = NULL`** (excepción de RGPD §5, decisión del responsable técnico,
  para anonimizar el texto libre: la usará la feature A). Aborta si cambia cualquier otra columna (`id`,
  `application_id`, `from_stage`, `to_stage`, `changed_at`, `reason`, comparadas con `IS NOT`) o si la nota nueva no es
  `NULL`. El `UPDATE` de `applications` queda libre: HU-05 lo necesita para avanzar.
- **INV-08 sin trigger en `applications`:** toda inscripción nace con su `StageChange` inicial (misma transacción), la FK
  `RESTRICT` de `stage_changes` impide borrar la inscripción y el trigger impide borrar el cambio. Una inscripción sin
  `StageChange` (imposible por el servicio) sí se podría borrar con SQL directo.
- **Integridad entre módulos:** las FK a `candidates` y `job_openings` son **integridad de la base, no acoplamiento de
  código** (DEC-06 aclarada). Impiden borrar un candidato o una oferta con inscripciones; un borrador nunca las tiene
  (INV-02), así que `DELETE /api/jobs/:id` no cambia.
- **No están en la base** (los garantiza la transacción de `enroll` y los comprueba el seed): INV-02 (solo se inscribe
  en `published`), INV-05 (una oferta cerrada no tiene inscripciones no finales), INV-06 (`stage` = destino del
  último cambio, `last_change_at` = su fecha, `created_at` = la del inicial).

**Seed** (`apps/api/src/db/seed-applications.ts`): exactamente **40** inscripciones, cada una con su historial paso a
paso (`insertApplicationWithHistory` escribe la inscripción con su etapa final y un `StageChange` por paso).

| Oferta (posición en `SEED_JOBS`) | Estado | N | Etapas (motivo) |
|---|---|---|---|
| Desarrollador/a backend (Node.js) (4) | `published` | 10 | 3 `received`, 2 `screening`, 2 `interview`, 1 `offer`, 1 `hired`, 1 `rejected` (`not_a_fit`, con nota) |
| Administrativo/a contable (5) | `published` | 0 | Sin inscripciones: estado vacío del pipeline |
| Técnico/a de selección de personal (6) | `published` | 10 | Todas las etapas; `hired` 1 y 3 `rejected` (`candidate_withdrew`; `other` con nota; `not_a_fit`) |
| Responsable de gestión de nóminas (7) | `published` | 10 | Sin `hired`; 2 `rejected` (`other`, `candidate_withdrew`) |
| Becario/a de marketing digital (8) · Auxiliar de logística (9) | `closed` | 5 + 5 | En cada una, 1 `hired`, 1 rechazo manual previo al cierre y 3 `rejected` con `job_closed`, sin nota y en la fecha de cierre de la oferta (INV-05, INV-07) |
| Borradores (0-3) | `draft` | 0 | — |

- **Candidatos:** las publicadas usan las posiciones 1-20 de `SEED_CANDIDATES` (las 1-10 están en dos ofertas; las 11-20,
  en una, con un `hired` y tres rechazos para EC-51); las cerradas, 25-29 (cada uno en las dos). Las posiciones 0 y 21-24
  no tienen inscripciones.
- **Fechas:** las publicadas, **relativas al reset** (todos los pasos en `(now − 90 h, now − 1 h]`, crecientes); las
  cerradas, **ancladas** a las fechas fijas de la oferta en `seed.ts` (`job_closed` justo en `closed_at`, INV-07). Con un
  reset posterior a ~2026-12-26, el alta de los candidatos 25-29 quedaría después de sus inscripciones en las cerradas:
  no rompe ninguna invariante.
- **Retención:** al final, `seedApplications` llama a `recalculateRetention` de un `createCandidatesService` con
  `createCandidateProcessesReader` para cada candidato inscrito (una abierta → `null`; todas finales → la fórmula con
  `lastProcessClosedAt`); no duplica la fórmula.
- **Orden de carga:** `seed.ts` → ofertas → `seedCandidates` (devuelve los IDs; calcula la retención con
  `noCandidateProcesses`, porque aún no hay inscripciones) → `seedApplications`, todo en una transacción.
- Notas inventadas y no sensibles (`SEED_NOTES`); candidatos con `@example.com` y teléfonos de la serie `+34 600 000 0xx`.

## Endpoints

| Método y ruta | Entrada | Éxito | Errores |
|---|---|---|---|
| `POST /api/applications` | `{ jobId, candidateId }`, enteros JSON de 1 a `Number.MAX_SAFE_INTEGER`, sin coerción; cualquier otra clave da 400 | 201 `Application` (6 campos) en `received` | 400 · 403 · 404 · 409 `INVALID_TRANSITION` · 409 `DUPLICATE` · 413 · 415 · 500 |
| `GET /api/jobs/:jobId/applications` | `jobId` texto `^[1-9][0-9]{0,14}$`; sin parámetros de consulta (cualquiera da 400) | 200 `Pipeline` para una oferta existente **en cualquier estado**; sin inscripciones, `items: []` | 400 · 404 · 500 |
| `POST /api/applications/:id/advance` | `id` como texto con `pattern`; `{ expectedStage, toStage }`, etapas de las 6 | 200 `Application`, también en el reintento | 400 · 403 · 404 · 409 `STAGE_MISMATCH` · 409 `INVALID_TRANSITION` · 500 |
| `POST /api/applications/:id/reject` | `{ expectedStage, reason, note? }`; `reason` en `not_a_fit`, `candidate_withdrew` u `other`; nota recortada, vacía → `null`, ≤ 500 puntos de código, admite `\n\r\t` y rechaza el resto de C0 y DEL | 200 `Application`, también en el reintento (conserva motivo y nota originales) | 400 · 403 · 404 · 409 `STAGE_MISMATCH` · 409 `INVALID_TRANSITION` · 500 |
| `GET /api/applications/:id` | `id` como texto con `pattern`; sin consulta | 200 `ApplicationDetail` | 400 · 404 · 500 |

- `Application` = `{ id, jobId, candidateId, stage, createdAt, lastChangeAt }`, sin datos del candidato.
- `Pipeline` = `{ job: { id, status }, items }`; cada `item` lleva exactamente `{ id, candidateName, stage, lastChangeAt,
  rejectionReason }` (RNF-04): nunca `email`, `phone` ni `note`. `rejectionReason` es no nulo si y solo si `stage ===
  'rejected'`. Lista plana ordenada por `last_change_at DESC, id DESC`, **sin paginar** (S-18, excepción declarada de
  DEC-10); la web agrupa por etapa. Los dos esquemas de respuesta llevan `additionalProperties: false`.
- **Orden de comprobación del `POST`:** guarda entre sitios (403, `onRequest`) → parser (415, 413, JSON mal formado 400) →
  JSON Schema (400) → **dentro de `withTransaction`** (`BEGIN IMMEDIATE`): estado de la oferta por el puerto (`null` →
  404 «La oferta no existe.») → `candidates.exists` (404 «El candidato no existe.») → estado ≠ `published` (409
  `INVALID_TRANSITION` «La oferta no está publicada: no admite inscripciones.», igual en `draft` y `closed`) → `INSERT`
  de la inscripción (el índice único decide el duplicado) → `INSERT` del `StageChange` inicial → `recalculateRetention`
  (500 y `ROLLBACK` si falla). `now()` se llama **una sola vez**, tras las guardas, para la inscripción y el cambio.
- **409 `DUPLICATE`:** `message` «Este candidato ya está inscrito en la oferta.» y `details: [{ field: 'candidateId',
  message, existingId: <ID de la inscripción> }]`; solo el ID, nunca un dato del candidato. Aplica a cualquier etapa,
  también `rejected` (INV-01).
- **400:** un elemento por campo declarado (`jobId`, `candidateId`) más uno `{ field: 'body', message: 'Hay campos no
  permitidos.' }` para todas las claves no declaradas, sin nombrarlas (`stage`, `id`, fechas **no** se declaran con
  `forbiddenFields`: EC-01 pide agruparlas). En el pipeline, `{ field: 'jobId' }` o `{ field: 'querystring' }`.
- El pipeline **no** lleva guarda de estado: un borrador da 200 con `status: 'draft'` e `items: []` (DT-03).
- **Orden de comprobación de avanzar y rechazar** (DT-02, DT-13): 403 → 400 → dentro de `withTransaction`, `findById`
  (404) → **reintento** (destino = etapa actual en `screening`, `interview`, `offer` o `hired`, o rechazar una ya
  `rejected`: 200 con la fila leída, sin escrituras, RV-23) → esperada ≠ actual (409 `STAGE_MISMATCH` «La inscripción
  ha cambiado de etapa: recarga e inténtalo de nuevo.») → transición no permitida (409 `INVALID_TRANSITION`: salto,
  retroceso, `received` o `rejected` por avance, etapa final o rechazar una `hired`) → `updateStage` con la guarda en el
  `WHERE` (0 filas → `STAGE_MISMATCH`) → `StageChange` → recálculo de la retención si el destino es final. Un solo `now()`.
  No comprueban el estado de la oferta (DT-09, hasta HU-06).
- `ApplicationDetail` = `{ id, stage, createdAt, lastChangeAt, candidate: { id, fullName }, job: { id, title, status },
  history: [{ fromStage, toStage, changedAt, reason, note }] }`, historial del más antiguo al más reciente, con
  `additionalProperties: false`. Es la **única** respuesta que lleva la nota. Sin transacción (lecturas síncronas); si
  `getJobSummary` o `findNames` no devuelven la oferta o el nombre, 500 genérico sin datos (EC-21, EC-22).
- Códigos que emite: `VALIDATION_ERROR`, `NOT_FOUND`, `INVALID_TRANSITION`, `STAGE_MISMATCH`, `DUPLICATE`,
  `CROSS_SITE_REQUEST` (403, DEC-12, heredada por los tres `POST`), `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `BAD_REQUEST`, `INTERNAL_ERROR`.
- No existe `PATCH`, `PUT` ni `DELETE` de inscripciones; cae en el `setNotFoundHandler` (404 `NOT_FOUND`).

## Puertos y composición (DEC-06)

**Ningún módulo importa a otro, tampoco sus tipos** (aclaración de DEC-06 en HU-04): cada puerto lo **define** el módulo
que lo necesita y lo **implementa** el módulo que tiene los datos; la implementación cumple la forma del puerto por
**tipado estructural** y `apps/api/src/app.ts` lo comprueba al conectarla (una forma desfasada no compila).
`apps/api/test/module-boundaries.test.ts` falla si aparece un `import` cruzado o SQL sobre tablas ajenas.

| Puerto | Lo define | Lo implementa | Se conecta en `app.ts` |
|---|---|---|---|
| `JobStatusPort` (`getJobStatus(jobId)` → `draft`, `published`, `closed` o `null`; `getJobSummary(jobId)` → `{ status, title }` o `null`) | `applications` (`ports.ts`) | `jobs`: `createJobStatusReader(repo)` en `apps/api/src/modules/jobs/job-status.ts`, sobre `findStatusById` y `findSummaryById` | `const jobStatusPort: JobStatusPort = jobStatus ?? createJobStatusReader(jobsRepository)` |
| `CandidateLookupPort` (`exists(id)`, `findNames(ids)` → `id` → `full_name`) | `applications` (`ports.ts`) | `candidates`: `exists` y `findNames` en `CandidatesService` (`existsById` y `findNamesByIds`, columnas explícitas) | Un objeto con dos funciones que delegan en `candidatesService` |
| `CandidateProcessesPort` (`getProcesses(candidateId)`) | `candidates` (`processes-port.ts`) | `applications`: `createCandidateProcessesReader(repo)` (`candidate-processes.ts`) | `processesPort: CandidateProcessesPort = candidateProcesses ?? createCandidateProcessesReader(applicationsRepository)`; sustituye al stub como valor por defecto |
| `JobApplicationsPort` (`countActiveApplications`, `rejectActiveApplications`) | `jobs` (`applications-port.ts`) | **Nadie aún**: HU-06 | `jobApplications = noJobApplications` por defecto |

- **Dirección de las llamadas:** `ofertas → inscripciones → candidatos` (la compone `app.ts`, sin ciclos). `buildApp` acepta
  `jobApplications?`, `candidateProcesses?` y `jobStatus?` para inyectar dobles; `jobStatus?` existe solo para provocar
  fallos del puerto en tests (EC-18, DD-08).
- **Guarda de inscribir = lectura del puerto en el mismo `BEGIN IMMEDIATE`** (DD-02): no hay `INSERT … SELECT … WHERE
  status = 'published'`, un `JOIN` con otro módulo ni trigger (DEC-06 y DT-07 lo prohíben). SQLite serializa a los
  escritores, así que un cierre no puede intercalarse entre la lectura y el `INSERT`. La garantía depende de que toda
  escritura del estado de una oferta vaya en transacción y de una conexión síncrona; lo fija el test del puerto espía
  (`db.isTransaction === true`, `createJobStatusSpy`).
- **Lector de procesos** (DD-06): una sola consulta sobre `applications` (`COUNT`, `SUM(stage NOT IN ('hired','rejected'))` y
  `MAX(last_change_at)` de las finales). `hasOpenApplication` = hay alguna no final; `hadAnyApplication` = hay alguna;
  `lastProcessClosedAt` = el último cierre si no hay abiertas, si no `null`. Depende de INV-06 (el `last_change_at` de
  una final es la fecha de su cambio final). No abre transacción y es idempotente.
- **Pipeline:** estado por el puerto, inscripciones por SQL propio (`LEFT JOIN` a `stage_changes` solo para el motivo de
  rechazo) y nombres por `findNames` (una operación de `candidates` con `json_each(?)`, dos sentencias fijas para
  cualquier tamaño). Sin transacción: son lecturas síncronas en una sola conexión (DD-07). Si un nombre no saliera, el
  elemento se omite en vez de inventarlo (la FK lo impide).
- **Recálculo:** `enroll` llama a `candidatesService.recalculateRetention` (operación interna de `candidates`, único
  escritor de `retention_ends_at`), que se une a la transacción en curso. Con una inscripción abierta, la retención pasa
  a `NULL` («mientras dure el proceso»), también si ya había vencido (DT-06) o si el consentimiento está vigente o
  retirado. Desde HU-05, `applyStageChange` también lo llama al pasar a `hired` o `rejected` (destino final), dentro de
  la misma transacción; el reintento no recalcula. Rechazar al **cerrar** una oferta es de HU-06.
- **Ventana de INV-05 (DT-10), hasta HU-06:** con `noJobApplications`, `GET /api/jobs/:id/close-preview` dice 0 y
  `POST /api/jobs/:id/close` deja abiertas las inscripciones de la oferta (INV-05 roto en datos creados a mano, con la
  retención del candidato en `null`), y avanzar y rechazar mueven esas inscripciones (DT-09: no leen el estado de la
  oferta; lo fijan tres tests con «HU-06 lo revisa» en el nombre). El seed lo respeta, ningún test de la web cierra
  ofertas con inscripciones, y tras el merge de HU-06 hay que hacer `npm run db:reset`.

## Pantallas y componentes

| Ruta | Contenedor → presentacionales | `document.title` · notas |
|---|---|---|
| `/jobs/:id` (de `jobs`) | `JobActions` | «Ver pipeline» (`Link` a `pipelinePath(job.id)`) como primer control de una oferta `published` y de una `closed` (que además duplica); `draft`, sin cambios |
| `/jobs/:id/pipeline` | `PipelineScreen` (`PipelineLoader`, `PipelineContent`) → `PipelineBoard`, `EnrollPanel` | «Pipeline de la oferta · ATS» en **todos** los estados. ID no válido en la URL o 400/404 de la API → «Página no encontrada» (el `NotFoundScreen` de `App.tsx`, recibido por prop) sin petición en el primer caso |
| `/applications/:id` | `ApplicationDetailScreen` (`ApplicationLoader`) → `ApplicationDetails` | «Inscripción · ATS». Cabecera (`dl`) con el candidato (enlace a su ficha), la oferta (enlace a su pipeline) y la etapa; historial en un `ol` con un `HistoryItem` por cambio: fecha `dd/mm/aaaa`, origen («—» si es el inicial), destino, motivo y nota como texto (`pre-wrap`). ID no válido o 404 → «Página no encontrada»; error con «Reintentar»; respuesta que no cumple `isApplicationDetail` → error |

- **Estados del pipeline** (por `pipeline.job.status`, DT-03): `draft` → solo «Esta oferta es un borrador: publícala para
  inscribir candidatos.»; `published` → «Inscribir candidato» y columnas (o «Todavía no hay candidatos inscritos en esta
  oferta.»); `closed` → columnas o vacío, **sin** la acción. Cargando, error con `userMessage` y «Reintentar».
- **Pipeline:** `groupByStage` agrupa la lista de la API **conservando su orden** (la web no reordena, DD-08) en seis
  `section` con `h2`: Recibida, Cribado, Entrevista, Oferta, Contratado y Rechazado; una columna vacía dice «Sin
  candidatos.». Cada tarjeta lleva el nombre como enlace a `/applications/:id` (`applicationPath`), «Último cambio: dd/mm/aaaa»
  (`formatDate`, Europe/Madrid) y, en «Rechazado», «Motivo: {etiqueta}» (No encaja con el perfil, Retirada del candidato,
  Otro, Oferta cerrada). Si la respuesta no cumple el contrato (`isPipeline`: etapa o motivo desconocidos, `job.id`
  distinto del pedido), es un error.
- **Acciones de etapa** (HU-05, solo en una oferta `published` y en las 4 etapas no finales): «Avanzar a {siguiente}» y
  «Rechazar», con el nombre del candidato en un `span` `visually-hidden` para que cada botón tenga nombre accesible
  propio. Avanzar envía la etapa de la tarjeta como esperada; «Avanzar a Contratado» abre antes `ConfirmDialog`
  («¿Contratar a este candidato?», «No se puede deshacer.»). «Rechazar» abre `RejectDialog`: motivo como grupo de radios
  con `legend`, nota con contador de 500 y el aviso de no escribir datos sensibles; `validateRejectForm` valida antes de
  enviar y un 400 de la API pone cada mensaje junto a su campo. Una petición por clic (`pendingId`); `Cancelar` y
  `Escape` no cierran en vuelo. Resultado (`use-stage-actions.ts`, DT-06): éxito o tarjeta desfasada (409, 404) cierran
  el diálogo, muestran el aviso o la alerta con el foco y recargan; cualquier otro fallo deja el diálogo abierto con
  motivo y nota y la alerta dentro. `classifyStageError` (`stage-errors.ts`) distingue por `code`, con textos fijos
  de la web: «La inscripción ha cambiado de etapa: revisa el pipeline actualizado.», «La inscripción ya no admite ese
  cambio.» y «La inscripción ya no existe.». Un 200 de reintento es éxito. La nota solo vive en el estado del
  formulario (`use-reject-form.ts`) y se descarta al cerrar.
- **Panel «Inscribir candidato»** (DD-02): `section` en línea con `aria-expanded` y `aria-controls`, **no modal** y sin
  trampa de foco. Campo «Nombre o email» con `autoComplete="off"`, validado con `validateSearchText` (≤ 100, sin
  controles; error junto al campo y sin petición). Busca con `listCandidates` de `candidates` y `pageSize=10`
  (`GET /api/candidates?q=…&pageSize=10`, sin endpoint nuevo; la búsqueda vacía lista los 10 más recientes). Resultados
  en una tabla con «Inscribir» por fila (`aria-describedby` a la celda del nombre); «Hay más resultados: afina la
  búsqueda.» si `total > 10`; «Ningún candidato coincide con la búsqueda.» si no hay; sin marca de «ya inscrito». Una
  búsqueda nueva aborta la anterior. «Cerrar», `Escape` o el disparador descartan texto y resultados y devuelven el foco
  al disparador; abrir lleva el foco al campo.
- **Inscribir** (`use-enrollment.ts`): una petición por clic (guarda `inFlight` por `ref` + botones `disabled`; `Escape`
  no cierra mientras vuela). `classifyEnrollError` distingue por `code` (DEC-07):

| Respuesta | Panel | Página | Pipeline |
|---|---|---|---|
| 201 | Se cierra y se descarta | Aviso «Candidato inscrito.» con el foco | `reload()`: la tarjeta aparece la primera de «Recibida» |
| 409 `DUPLICATE` | Sigue abierto con alerta «Este candidato ya está inscrito en la oferta.» y el enlace «Ver la inscripción» a `/applications/{existingId}` | — | `reload()` |
| 409 `INVALID_TRANSITION` | Se cierra | Alerta «La oferta ya no está publicada: no admite inscripciones.» con el foco | `reload()`: desaparece «Inscribir candidato» |
| 404 | Sigue abierto con el `message` de la API | — | `reload()` (si la oferta ya no existe, «Página no encontrada») |
| Red, *timeout*, 400, 403, 413, 415, 500 o respuesta no válida | Sigue abierto con `userMessage(error)` | — | Sin recarga |

- Los textos del 409 viven en la web (`enroll-errors.ts`), no dependen de la redacción de la API; `existingId` solo se
  usa para el enlace.
- **Foco tras cada resultado** (DD-10): al mensaje que produce la acción (aviso o alerta), porque el botón pulsado queda
  `disabled` o desaparece.
- **Piezas compartidas que tocó HU-04:** `useResource` gana `reload()` (vuelve a pedir **sin** pasar por `loading`: los datos
  siguen hasta que llega la respuesta y un error pasa a `error`; reutiliza el `AbortController`, así que una respuesta
  vieja nunca pisa a la nueva); `Notice` acepta `ref` y, si lo recibe, `tabIndex={-1}`; `App.tsx` añade la ruta a `ROUTES`.
- **Dirección entre features** (DD-01, DEC-06 por analogía): `jobs → applications → candidates`. `jobs` importa
  `pipelinePath` de `apps/web/src/features/applications/paths.ts`; `applications` importa solo el cliente público de `candidates` (`api.ts`,
  `types.ts`); lo que el pipeline y el detalle necesitan de `jobs` y `candidates` (los enlaces a la ficha y la pantalla
  «Página no encontrada») se lo pasa `App.tsx` por props (`jobPath`, `notFound`). Ningún componente de una feature se importa desde otra.

## Validación y errores

- Esquema estricto con Ajv sin coerción ni `removeAdditional` (DEC-11.1): `"7"` o `1.5` como ID dan 400; en `params`, el ID
  como texto con `pattern` (DEC-11.2). DEC-11.3 y DEC-11.8 aplican a la nota del rechazo (recorte, vacía → `null`,
  `\n\r\t` admitidos); su 400 no repite el valor recibido («Formato no válido.» o el límite).
- Un 500 registra el objeto de error y los mensajes de SQLite de `CHECK` y `UNIQUE` llevan nombres de columna, no valores;
  ni el servicio ni los puertos envuelven errores con datos de contexto ni añaden logs. El logger quita la query.
- `isDuplicatePairError` mira el texto de SQLite: `errcode === 2067` y `applications.candidate_id` en el mensaje. Tras el
  fallo, la transacción sigue abierta y `findIdByPair` devuelve el ID coherente con lo que decidió el índice.

## Convenciones del módulo

- Capas `routes` → `service` → `repository`; el servicio lanza `AppError` y nunca construye respuestas (DEC-06).
- Toda escritura que cruza módulos va en **una** `withTransaction`: guarda del puerto, `INSERT`, `StageChange` y recálculo.
- El duplicado lo decide el índice único, sin `SELECT` previo (patrón de `candidates`).
- Una inscripción nace en `received` con su `StageChange` inicial; `stage`, las fechas y el motivo **nunca** llegan del
  cliente. Un historial se escribe paso a paso con `insertApplicationWithHistory` (seed y tests): la base rechaza
  cualquier historial que incumpla INV-04, INV-07 o INV-10.
- Lo que `applications` lee de otro módulo, solo por un puerto con columnas explícitas (`id`, `full_name`, `status`): nunca
  `SELECT *` ni SQL sobre tablas ajenas.
- El pipeline devuelve exactamente 5 campos por elemento; el nombre del candidato es el único dato personal que sale.
  La nota del rechazo solo sale en el detalle; avanzar y rechazar devuelven la `Application` de 6 campos.
- Todo cambio de etapa lleva la etapa esperada y su guarda en el `WHERE` del `UPDATE`; las reglas de transición viven
  en funciones puras (`transitions.ts`) y se prueban en tabla.
- Web: nombres, email y texto de búsqueda nunca van a la URL, al título, a `history.state` ni al almacenamiento; el estado
  de la búsqueda vive solo en el panel y se descarta al cerrarlo o al salir (sin almacén de módulo, a diferencia de
  `apps/web/src/features/candidates/list-state.ts`). Textos libres siempre como texto JSX.

## Gotchas

- **El foco movido por un efecto pasivo se aserta con `expectFocusOn`** (`apps/web/test/helpers/focus.ts`): un `findBy*` puede
  resolver antes de que corra el efecto y, con la CPU cargada, el test falla a veces. Los tests del panel y del aviso lo usan
  (22 usos en `apps/web/test/features/applications/`); sin tiempos fijos ni *timeouts* más largos. Lo mismo vale para
  `document.title` y el cierre de un `dialog`: se asertan con `await waitFor` (T-03: EC-46 falló en 1 de 10 semillas de
  `--sequence.shuffle` antes del arreglo).
- **El tsconfig de `e2e/` no incluye `dom`:** `history` o `document` no existen como tipos. `e2e/applications.spec.ts`
  lee `history.state` con `page.evaluate` y un cast mínimo de `globalThis`.
- **`recursive_triggers` está encendido** (`apps/api/src/db/connection.ts`, T-05 del sprint, SEC-09 de la review de
  HU-04): sin él, un `INSERT OR REPLACE` con SQL directo borraría un `StageChange` sin disparar
  `stage_changes_no_delete`. Lo fija `apps/api/test/applications/migration-triggers-replace.test.ts` (en rojo antes,
  en verde después).
- **Un `UNIQUE` (también el parcial) no nombra su índice en el error, sino tabla y columnas:** por eso `isDuplicatePairError`
  reconoce el duplicado por `applications.candidate_id`, y los dos únicos parciales de `stage_changes` (`one_initial` y
  `one_final`) comparten columna y dan el mismo mensaje. `integrity-adversarial.test.ts` fija el error con
  `/UNIQUE constraint failed/` y comprueba **cuál** de los dos es leyendo su SQL en `sqlite_master`.
- **`failWrites` se crea después de dar de alta candidato y oferta:** el alta del candidato ya escribe `retention_ends_at`, así
  que un trigger `failWrites(db, 'UPDATE', { table: 'candidates', column: 'retention_ends_at' })` previo rompería el alta
  (`apps/api/test/applications/enroll-failures-adversarial.test.ts`, `privacy-logs.test.ts`). Los triggers `fail_*` son
  fixtures de test sobre bases `:memory:`, no parte del esquema.
- **La carga de CPU alarga los tests y agota sus *timeouts*:** con la suite web y los e2e a la vez, 16 tests web
  superaron su tiempo de 5 s (tardaban 6-21 s) y 3 e2e fallaron aislados en 1 de 4 pasadas con la máquina saturada; en serie
  y sin carga, todo en verde (review §7). Se acepta como deuda de demo (ver «Deuda técnica»); no se arregla subiendo
  *timeouts* sin justificarlos.
- **`CHECK` con `IS`, no `=`**, para la pareja `(from_stage, to_stage)`: con `=`, un origen `NULL` evalúa a `NULL` y el `CHECK`
  lo acepta (comprobado en SQLite; `migration.test.ts`, EC-13).
- **Las fechas de las ofertas del seed son fijas y las de los candidatos, relativas:** los e2e crean su propia oferta y su
  candidato con *token* único, solo usan del seed las ofertas `closed` (buscadas con `GET /api/jobs?status=closed`, sin IDs
  fijos) y **no cierran ofertas con inscripciones** (DT-10).
- **Los TD de HU-04 citan ficheros de test previos al reparto en hermanos** (≤ 300 líneas tras Prettier): la fuente es el
  `ROADMAP.md` de la HU, no el TD.

## Deuda técnica

Observaciones aceptadas de las reviews de HU-04 y HU-05 (§9) y avisos para HU-06.

| Deuda | Estado | Origen |
|---|---|---|
| El pipeline no tiene `LIMIT` en `apps/api/src/modules/applications/repository.ts` (`LIST_BY_JOB_SQL`) | Aceptada (S-18); RNF-01 con 200 inscripciones | SEC-08 · §9.1 |
| `recursive_triggers` apagado: un `INSERT OR REPLACE` directo esquivaría el trigger de `DELETE` | **Resuelta** en T-05 (encendido y con test) | SEC-09 de HU-04 |
| `recalculateRetention` lee la ficha con `SELECT *` (`findById` de `apps/api/src/modules/candidates/repository.ts`); sin fuga, el retorno se descarta. HU-05 añade dos llamadas (contratar y rechazar) | Abierta: leer solo las columnas necesarias cuando la feature A lo toque | DP-02 de HU-04 · DP-01 de HU-05 |
| El buscador trae `skills` (no se pintan) y la búsqueda viaja como `?q=`; el logger quita la query (`apps/api/src/logger.ts`) | Aceptada (PRD, RF-08) | DP-03, DP-04 · §9.4 |
| UC-17 · E1 y UC-18 · E1 dicen «estado de error»; los PRD (CA-15 de HU-04; DT-08 y CA-27 de HU-05) y el código muestran «Página no encontrada» | Aceptada: decisión del responsable técnico de no tocar los UC | DD-02 de HU-04 · DD-06 de HU-05 |
| Los TD de HU-04 citan ficheros de test previos al reparto y la redacción de DEC-06 anterior a la aclaración; los de HU-05 citan el PRD v1.1 (es v1.2) | Aceptada (nota en cada `ROADMAP.md`) | DD-04, DD-08 de HU-04 · DD-08 de HU-05 |
| Sin decidir en `docs/RGPD.md` §7 (feature A): seis cuestiones sobre retención vencida, marca de anonimizado (puertos, avanzar y rechazar, detalle) y vaciado de la nota | Abierta: para el *shaping* de la feature A | §9 de HU-04 y HU-05 |
| Deuda de demo: (a) integración con unitarios y e2e en serie, y e2e con *workers* acotados; (b) *timeout* por test de la web fijado y justificado; (c) medir la pasada completa en una máquina modesta | Abierta: va al `/audit-sprint` (decisión del responsable técnico) | §9.8 |
| `createApplicationsService` medía 54 líneas | **Resuelta** en HU-05 (TASK-01): 6 líneas, casos de uso como funciones del módulo | Review de HU-04 §6 |
| `JobApplicationsPort` sin implementación real; la ventana de INV-05 sigue abierta y avanzar y rechazar no miran el estado de la oferta | Aviso para HU-06: conectarlo (con retención y `StageChange` de `job_closed`), recalcular al cerrar y **revisar DT-09** a propósito | DT-10 de HU-04 · DT-09 y SEC-01 de HU-05 |
| Las tarjetas y el 409 `DUPLICATE` iban sin enlace | **Resuelta** en HU-05 | DT-01, DT-02, DT-11 de HU-04 |
| `apps/api/test/applications/advance.test.ts` y `reject.test.ts` están en 300 líneas | Aviso para HU-06: los tests nuevos van a ficheros hermanos | Review de HU-05 §9 |
| Nombre accesible «Rechazar : Nombre» con un espacio antes de los dos puntos en Chromium; el `fieldset` de motivos no se deshabilita en vuelo; ~30 aserciones síncronas de `activeElement` tras efectos | Abierta: va al `/audit-sprint` | Review de HU-05 §8 y §9.8 |

## Requisitos no funcionales

| RNF | Métrica | Test |
|---|---|---|
| Lectura del pipeline | `GET /api/jobs/:jobId/applications` < 200 ms con 200 inscripciones en la oferta, 1 000 candidatos y 2 000 inscripciones (`inject`, local) | `apps/api/test/applications/performance.test.ts` |
| Inscribir | `POST /api/applications` < 500 ms con 1 000 candidatos y 2 000 inscripciones | `apps/api/test/applications/performance.test.ts` |
| Avanzar y rechazar | Cada `POST` < 500 ms con 1 000 candidatos y 2 000 inscripciones | `apps/api/test/applications/performance.test.ts` |
| Detalle | `GET /api/applications/:id` < 200 ms con 5 cambios | `apps/api/test/applications/performance.test.ts` |
| Logs y errores | 0 apariciones de nombre, email, teléfono o nota, también en los 500 del puerto de estado, el de procesos y el recálculo, y en avanzar, rechazar y el detalle | `apps/api/test/applications/privacy-logs.test.ts` · `stage-change-privacy.test.ts` |
| Minimización | Cada elemento del pipeline con exactamente 5 campos y 0 claves `email`, `phone` o `note` | `apps/api/test/applications/pipeline.test.ts` · `pipeline-adversarial.test.ts` |
| Navegador | Sin nombre, email, nota ni texto de búsqueda en `document.title`, URL, `history.state` ni almacenamiento | `apps/web/test/features/applications/PipelineScreen.adversarial.test.tsx` · `PipelineScreen.stage-adversarial.test.tsx` · `e2e/applications.spec.ts` · `e2e/pipeline-stages.spec.ts` |
| HTML | Nombre del candidato y nota siempre como texto; 0 `dangerouslySetInnerHTML` en `apps/web/src/features/applications/` | `apps/web/test/features/applications/PipelineScreen.adversarial.test.tsx` · `ApplicationDetailScreen.adversarial.test.tsx` |
| Accesibilidad | 6 columnas con nombre accesible; controles del buscador con `<label>`; avisos con `role="status"` y errores con `role="alert"`; foco al aviso y de vuelta al disparador | `apps/web/test/features/applications/PipelineScreen.test.tsx`, `.search.test.tsx` y `.enroll.test.tsx` |
