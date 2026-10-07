# TASK-03 — Puertos entre módulos, lecturas de candidatos y puerto de procesos real en `buildApp` [setup]

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-03, RF-04; base de RF-01, RF-05 y RF-11)
- **Complejidad:** L (2–4 h; estimada 4 h)

## Descripción
Nace `apps/api/src/modules/applications/` con sus puertos, su repositorio (la parte que no depende de ninguna ruta) y
el lector que implementa `CandidateProcessesPort`. `jobs` implementa el puerto «estado de la oferta» y `candidates`
gana dos lecturas con columnas explícitas. `buildApp` usa el puerto de procesos real por defecto. **Ningún módulo
importa a otro** (DD-01): cada implementación cumple el puerto por tipado estructural y `app.ts` lo comprueba al
asignarla.

1. **`applications/ports.ts`** (nuevo), los define `applications` (DEC-06):
   ```ts
   export type JobStatus = 'draft' | 'published' | 'closed';
   export interface JobStatusPort { getJobStatus(jobId: number): JobStatus | null }      // null = no existe
   export interface CandidateLookupPort {
     exists(candidateId: number): boolean;
     findNames(candidateIds: readonly number[]): Map<number, string>;                    // solo id → full_name
   }
   ```
2. **`applications/schemas.ts`** (nuevo, solo la parte de tipos; los JSON Schema llegan en TASK-04 y TASK-05):
   `STAGES` (`received`, `screening`, `interview`, `offer`, `hired`, `rejected`), `REJECTION_REASONS` (`not_a_fit`,
   `candidate_withdrew`, `other`, `job_closed`), `Stage`, `RejectionReason` y `Application`
   (`{ id, jobId, candidateId, stage, createdAt, lastChangeAt }`).
3. **`applications/repository.ts`** (nuevo), `createApplicationsRepository(db)` con SQL preparado y columnas explícitas:
   - `insert(row: { candidateId, jobId, stage, createdAt, lastChangeAt }): Application` (`RETURNING` con columnas
     explícitas);
   - `insertStageChange({ applicationId, fromStage, toStage, changedAt, reason, note }): void`;
   - `getProcessFacts(candidateId): { total: number; open: number; lastClosedAt: string | null }`: una sola consulta
     sobre `applications` (DD-06): `COUNT(*)`, número de etapas no finales y `MAX(last_change_at)` de las finales
     (`hired`, `rejected`), con `COALESCE` para que 0 inscripciones den `0`, `0`, `null`.
4. **`applications/candidate-processes.ts`** (nuevo): `createCandidateProcessesReader(repo: Pick<ApplicationsRepository,
   'getProcessFacts'>)` → `{ getProcesses(id) }` con `hasOpenApplication: open > 0`, `hadAnyApplication: total > 0` y
   `lastProcessClosedAt: open > 0 ? null : lastClosedAt`. No importa `CandidateProcessesPort`.
5. **`jobs`**: `findStatusById(id): JobStatus | undefined` en `apps/api/src/modules/jobs/repository.ts`
   (`SELECT status FROM job_openings WHERE id = ?`), y `apps/api/src/modules/jobs/job-status.ts` (nuevo) con
   `createJobStatusReader(repo: Pick<JobsRepository, 'findStatusById'>)` → `{ getJobStatus(id) }` (`undefined` →
   `null`). `jobs` declara su propio tipo de estado; no importa `JobStatusPort`.
6. **`candidates`**: en `apps/api/src/modules/candidates/repository.ts`, `existsById(id): boolean`
   (`SELECT 1 FROM candidates WHERE id = ?`) y `findNamesByIds(ids): Map<number, string>`
   (`SELECT id, full_name FROM candidates WHERE id IN (SELECT value FROM json_each(?))`, con `JSON.stringify(ids)` como
   único parámetro); en `apps/api/src/modules/candidates/service.ts`, `exists(id)` y `findNames(ids)` en
   `CandidatesService`, que delegan (`findNames([])` devuelve un `Map` vacío **sin consultar**).
7. **`apps/api/src/db/seed-applications.ts`** (nuevo), solo `insertApplicationWithHistory`: escribe una inscripción con
   su etapa final, `created_at` = fecha del primer paso y `last_change_at` = fecha del último, y un `StageChange` por
   paso (`from_stage` = etapa anterior o `NULL` en el inicial). La usan los tests de esta HU y, en TASK-06,
   `seedApplications`. Firma sugerida: `insertApplicationWithHistory(repo, { candidateId, jobId, steps: [{ stage, at,
   reason?, note? }] }): Application`.
8. **`apps/api/src/app.ts`**: crea `applicationsRepository` y `candidateProcesses` deja de valer `noCandidateProcesses`
   por defecto: `candidateProcesses ?? createCandidateProcessesReader(applicationsRepository)`. `noCandidateProcesses`
   se conserva (lo usan tests y `seed-candidates.ts`).
9. **Helpers de test**: `apps/api/test/helpers/test-app.ts` (solo el JSDoc de `createTestApp`: sin `candidateProcesses`
   se usa el lector real) y `apps/api/test/helpers/applications.ts` (nuevo) con `createJobStatusStub({ status, fail })`
   (puerto que devuelve `status` o lanza un `Error` sin datos personales) y un espía del puerto que registra
   `db.isTransaction` en cada llamada a `getJobStatus` (lo usa EC-19 en TASK-07).
10. **Tests**:
    - `apps/api/test/applications/ports.test.ts`: «CA-20 buildApp por defecto: con una abierta → true/true y la retención
      pasa a null; sin inscripciones → false/false/null y conserva su fecha» (con `createTestApp()`, la inscripción con
      `insertApplicationWithHistory` y una operación que llame a `recalculateRetention`, p. ej. registrar el
      consentimiento); «EC-21» con los 4 casos (sin inscripciones; una abierta; dos finales de fechas distintas → la más
      reciente; una final y otra abierta); «EC-25 dos llamadas seguidas → mismo resultado y `total_changes` igual»;
      `createJobStatusReader` con `draft`, `published`, `closed` e inexistente (`null`); `exists` y `findNames` de
      `candidates` (incluido `findNames([])` sin consulta y un ID inexistente que no sale en el `Map`).
    - `apps/api/test/module-boundaries.test.ts` (nuevo): «CA-21 ningún import entre módulos; sin SQL sobre tablas
      ajenas»: recorre `apps/api/src/modules/{applications,candidates,jobs}/` y falla si un fichero importa de otra
      carpeta de `modules/`, si `applications/` contiene `job_openings` o `candidates` en un SQL, o si `candidates/` o
      `jobs/` contienen `applications` o `stage_changes` en un SQL (EC-20).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/applications/ports.ts` | crear | `JobStatus`, `JobStatusPort`, `CandidateLookupPort` |
| `apps/api/src/modules/applications/schemas.ts` | crear | Constantes y tipos (`STAGES`, `REJECTION_REASONS`, `Stage`, `RejectionReason`, `Application`) |
| `apps/api/src/modules/applications/repository.ts` | crear | `insert`, `insertStageChange`, `getProcessFacts` |
| `apps/api/src/modules/applications/candidate-processes.ts` | crear | `createCandidateProcessesReader` |
| `apps/api/src/modules/jobs/job-status.ts` | crear | `createJobStatusReader` |
| `apps/api/src/modules/jobs/repository.ts` | modificar | `findStatusById` |
| `apps/api/src/modules/candidates/repository.ts` | modificar | `existsById`, `findNamesByIds` (columnas explícitas, DP-02) |
| `apps/api/src/modules/candidates/service.ts` | modificar | `exists`, `findNames` |
| `apps/api/src/db/seed-applications.ts` | crear | `insertApplicationWithHistory` |
| `apps/api/src/app.ts` | modificar | `applicationsRepository` y `candidateProcesses` real por defecto |
| `apps/api/test/helpers/test-app.ts` | modificar | JSDoc de `createTestApp` (lector real por defecto) |
| `apps/api/test/helpers/applications.ts` | crear | `createJobStatusStub({ status, fail })` y espía de `db.isTransaction` |
| `apps/api/test/applications/ports.test.ts` | crear | CA-20, EC-21, EC-25, lecturas de `jobs` y `candidates` |
| `apps/api/test/module-boundaries.test.ts` | crear | CA-21, EC-20 |

## Implementa
- RF: RF-03, RF-04 (y la parte de RF-10 que depende del puerto real) · CA: CA-20, CA-21 · Edge cases: EC-20, EC-21,
  EC-25
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (piezas 3 y 4), § Firmas internas, § Composición en
  `apps/api/src/app.ts`, DD-01, DD-06, § Checklist B-03

## Dependencias
- **Depende de:** TASK-01 (tablas), TASK-02 (comparten `apps/api/src/modules/jobs/repository.ts`)
- **Bloquea:** TASK-04, TASK-06

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/ports module-boundaries` en verde, con **2** ficheros de test.
- [ ] `npm test -w @ats/api -- candidates jobs` en verde **sin tocar** sus tests (el lector real sin inscripciones
      responde lo mismo que `noCandidateProcesses`).
- [ ] `grep -rnE "from '\.\./(jobs|candidates|applications)/" apps/api/src/modules` vacío.
- [ ] Ningún `SELECT *` nuevo sobre `candidates` (DP-02).
- [ ] `npm run typecheck` sin errores (incluida la asignación estructural de los puertos en `app.ts`).
- [ ] `npx eslint apps/api/src/modules/applications/ports.ts apps/api/src/modules/applications/schemas.ts apps/api/src/modules/applications/repository.ts apps/api/src/modules/applications/candidate-processes.ts apps/api/src/modules/jobs/job-status.ts apps/api/src/modules/jobs/repository.ts apps/api/src/modules/candidates/repository.ts apps/api/src/modules/candidates/service.ts apps/api/src/db/seed-applications.ts apps/api/src/app.ts apps/api/test/helpers/test-app.ts apps/api/test/helpers/applications.ts apps/api/test/applications/ports.test.ts apps/api/test/module-boundaries.test.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier. Si `ports.test.ts` pasara, las lecturas de `jobs` y
      `candidates` van a un hermano `apps/api/test/applications/lookups.test.ts`.
- [ ] Commit único `feat(api): add cross-module ports and the real candidate processes reader [HU-04 TASK-03]`.

## Notas de implementación
- **`jobStatus?` de `buildApp` no va aquí:** se conecta en TASK-04, que es quien lo consume (aquí sería una variable sin
  uso). Esta tarea solo prueba `createJobStatusReader` directamente.
- DD-06: por INV-06, el `last_change_at` de una inscripción final es la fecha de su `StageChange` final; por eso basta
  con `applications`. El índice `applications_candidate_job_uq` empieza por `candidate_id` y sirve a esta consulta.
- Contrato de `apps/api/src/modules/candidates/processes-port.ts`: nunca `hadAnyApplication && !hasOpenApplication` con
  `lastProcessClosedAt` nulo. EC-21 lo comprueba.
- El lector se ejecuta dentro de la transacción del iniciador (síncrono, una conexión): no abre transacción propia.
- `recalculateRetention` sigue usando su `findById` (que no se copia ni se cambia).
- Formas duplicadas (DD-01): `JobStatus` existe en `applications` y en `jobs`; un desfase no compila en `app.ts`.
- Los errores del puerto o del lector no se envuelven con datos de contexto ni se registran (DP-01).
