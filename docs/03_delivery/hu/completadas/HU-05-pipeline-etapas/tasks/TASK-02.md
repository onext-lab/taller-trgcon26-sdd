# TASK-02 — Lecturas, guarda de la escritura y `getJobSummary` en el puerto de ofertas [setup]

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (base de RF-01, RF-02 y RF-03)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Prepara todo lo que leen y escriben los tres endpoints, sin rutas todavía:

1. **Repositorio** `apps/api/src/modules/applications/repository.ts` (sentencias preparadas, columnas explícitas):
   ```ts
   findById(id: number): Application | undefined
   //   SELECT id, job_id, candidate_id, stage, created_at, last_change_at FROM applications WHERE id = ?
   updateStage(c: { id: number; fromStage: Stage; toStage: Stage; changedAt: string }): Application | undefined
   //   UPDATE applications SET stage = ?, last_change_at = ? WHERE id = ? AND stage = ?
   //   RETURNING id, job_id, candidate_id, stage, created_at, last_change_at        (undefined = 0 filas, DD-02)
   listHistory(applicationId: number): StageChangeEntry[]
   //   SELECT from_stage, to_stage, changed_at, reason, note FROM stage_changes
   //   WHERE application_id = ? ORDER BY id                (índice stage_changes_application_idx)
   ```
2. **Tipos** en `apps/api/src/modules/applications/schemas.ts`, **solo tipos** (los JSON Schema llegan en TASK-03 a
   TASK-05): `ManualRejectionReason`, `RejectionReason` (si no existe ya) y `StageChangeEntry { fromStage: Stage | null;
   toStage: Stage; changedAt: string; reason: RejectionReason | null; note: string | null }`.
3. **Puerto** (DD-04, DT-07): en `apps/api/src/modules/applications/ports.ts`, `export interface JobSummary { status:
   JobStatus; title: string }` y el método `getJobSummary(jobId: number): JobSummary | null` en el `JobStatusPort`
   existente (`null` = la oferta no existe).
4. **Implementación en `jobs`**, sin importar el puerto (tipado estructural, DEC-06):
   `apps/api/src/modules/jobs/repository.ts` añade `findSummaryById(id)` (`SELECT status, title FROM job_openings WHERE
   id = ?`) y `apps/api/src/modules/jobs/job-status.ts` pasa a `createJobStatusReader(repo: Pick<JobsRepository,
   'findStatusById' | 'findSummaryById'>)` con `getJobSummary(id) { return repo.findSummaryById(id) ?? null }`.
   `apps/api/src/app.ts` **no cambia**: la asignación tipada comprueba la forma nueva.
5. **Helpers de test** en `apps/api/test/helpers/applications.ts`:
   - `createJobStatusStub({ status, title = 'Oferta de prueba', fail, failSummary })`: implementa los dos métodos;
     `failSummary` lanza un error fijo sin datos en `getJobSummary` (EC-21).
   - `createJobStatusSpy(db, inner)`: sigue registrando `getJobStatus` en `insideTransaction` y **delega**
     `getJobSummary` sin registrarlo.
   - `advance(app, id, body, headers?)`, `reject(app, id, body, headers?)` y `getApplication(app, id, query?)`: `inject`
     de `POST /api/applications/:id/advance`, `POST /api/applications/:id/reject` y `GET /api/applications/:id`, sin
     interpretar la respuesta (`id` como `number | string` para probar IDs no válidos).
   - `insertApplicationAt(db, { jobId, candidateId, path, startAt, reason?, note? })`: escribe una inscripción ya en
     cualquier etapa con `insertApplicationWithHistory` (`apps/api/src/db/seed-applications.ts`) sobre
     `createApplicationsRepository(db)`; `path` es la lista de etapas desde `received`, `startAt` el instante del
     primero (cada paso, +1 min) y `reason`/`note` van en el paso `rejected`. Devuelve la `Application`.
6. **Test existente que cambia:** `apps/api/test/applications/privacy-logs.test.ts:43` — el literal `statusPort`
   implementa también `getJobSummary` (si no, no compila): lee `status, title` con el mismo `failStatus`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/applications/repository.ts` | modificar | `findById`, `updateStage` (guarda + `RETURNING`), `listHistory` |
| `apps/api/src/modules/applications/schemas.ts` | modificar | Solo tipos: `ManualRejectionReason`, `RejectionReason`, `StageChangeEntry` |
| `apps/api/src/modules/applications/ports.ts` | modificar | `JobSummary` y `getJobSummary` en `JobStatusPort` |
| `apps/api/src/modules/jobs/repository.ts` | modificar | `findSummaryById` |
| `apps/api/src/modules/jobs/job-status.ts` | modificar | `getJobSummary` en el lector |
| `apps/api/test/helpers/applications.ts` | modificar | Stub y espía con `getJobSummary`; `advance`, `reject`, `getApplication`, `insertApplicationAt` |
| `apps/api/test/applications/privacy-logs.test.ts` | modificar | Solo el literal `statusPort` de la línea 43 |
| `apps/api/test/applications/ports.test.ts` | modificar | Test del lector real `getJobSummary` dentro del `describe` de la línea 192 |
| `apps/api/test/applications/stage-repository.test.ts` | crear | `findById`, `updateStage`, `listHistory` |

## Implementa
- RF: RF-01, RF-02 (lectura y guarda), RF-03 (historial y `getJobSummary`), RF-09 (DP-02: columnas explícitas) ·
  CA-37 (parte del puerto) · DD-02, DD-04
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Firmas internas, § Módulos y ficheros afectados, DD-02, DD-04,
  § Estrategia de tests (`insertApplicationAt`), § Checklist B-02

## Dependencias
- **Depende de:** TASK-01 (orden del diseño y decisión del aprobador: el refactor va primero; no comparten ficheros)
- **Bloquea:** TASK-03, TASK-05, TASK-06, TASK-07, TASK-08

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/stage-repository` en verde con **1** fichero:
  - «findById devuelve la inscripción con 6 campos; inexistente → undefined».
  - «DD-02 updateStage con stage desfasado → undefined y fila intacta».
  - «updateStage con la etapa actual → la fila con stage y lastChangeAt nuevos».
  - «listHistory en orden de id: 1 cambio sin origen; 5 cambios de una contratada; rechazo con motivo y nota».
- [ ] `npm test -w @ats/api -- applications/ports applications/privacy-logs` en verde con **2** ficheros, con el test
      nuevo «DT-07 lector real: getJobSummary → status y title; inexistente → null».
- [ ] `npm test -w @ats/api -- applications/ module-boundaries` en verde con **18** ficheros (sin regresiones).
- [ ] `npm run typecheck` sin errores (incluido `app.ts`, que comprueba el lector contra el puerto).
- [ ] `npx eslint apps/api/src/modules/applications/repository.ts apps/api/src/modules/applications/schemas.ts apps/api/src/modules/applications/ports.ts apps/api/src/modules/jobs/repository.ts apps/api/src/modules/jobs/job-status.ts apps/api/test/helpers/applications.ts apps/api/test/applications/privacy-logs.test.ts apps/api/test/applications/ports.test.ts apps/api/test/applications/stage-repository.test.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`; `ports.test.ts` está en 249).
- [ ] Commit único `feat(api): application reads, guarded stage update and job summary port [HU-05 TASK-02]` cuyo
      cuerpo cita `apps/api/test/applications/privacy-logs.test.ts:43`.

## Notas de implementación
- `updateStage` **no** decide nada: la regla está en `transitions.ts`; aquí solo la guarda del `WHERE` (SEC-02 de HU-04).
- `listHistory` no hace `SELECT *`; `note` sale tal cual (con `\n`, `\r`, `\t`).
- Ningún `SELECT` nuevo sobre `candidates` (DP-02); el nombre del detalle llega por `findNames` (TASK-05).
- Los helpers `advance`/`reject`/`getApplication` nacen aquí para que TASK-06, TASK-07 y TASK-08 no toquen el helper y
  puedan ir en paralelo (como A-10 de HU-04).
- Datos inventados (`@example.com`, `+34 600 000 0xx`).
