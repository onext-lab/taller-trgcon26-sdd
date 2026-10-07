# TASK-01 — Recuento y rechazo de las inscripciones activas de una oferta en `applications` [setup]

## Metadata
- **HU:** HU-06 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-01, RF-02)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Núcleo de la HU: `inscripciones` aporta la implementación real de las dos operaciones de `JobApplicationsPort`, **sin
conectarla todavía** (la conexión en `app.ts` es TASK-02). Ni migración ni cambios en `jobs`, `candidates`, rutas o
esquemas. Tres piezas, en este orden:

1. **Repositorio** (`apps/api/src/modules/applications/repository.ts`, 203 → ~235 líneas). Fuera de la factoría:
   ```ts
   /** Inscripción activa de una oferta: lo mínimo para rechazarla por cierre (sin datos del candidato). */
   export interface ActiveApplicationRow { id: number; candidateId: number; stage: Stage }
   const COUNT_ACTIVE_BY_JOB_SQL = `SELECT COUNT(*) AS active FROM applications
     WHERE job_id = ? AND stage NOT IN ('hired', 'rejected')`;
   const LIST_ACTIVE_BY_JOB_SQL = `SELECT id, candidate_id, stage FROM applications
     WHERE job_id = ? AND stage NOT IN ('hired', 'rejected') ORDER BY id`;
   function createActiveByJobQueries(db: DatabaseSync) {
     return {
       countActiveByJob(jobId: number): number { … },          // Number(row?.active ?? 0)
       listActiveByJob(jobId: number): ActiveApplicationRow[] { … },
     };
   }
   ```
   Dentro de `createApplicationsRepository` se añade **una sola línea**, `...createActiveByJobQueries(db),` (como
   `...createStageOperations(db),`): la función pasa de 49 a **50** líneas y no admite nada más.
2. **Casos de uso** en `apps/api/src/modules/applications/job-closing.ts` (**nuevo**, ~55 líneas), como funciones de
   módulo que reciben `deps` (patrón de `enroll`/`advance` de HU-05, DD-01):
   ```ts
   export interface JobClosingDeps {
     repository: Pick<ApplicationsRepository, 'countActiveByJob' | 'listActiveByJob' | 'updateStage' | 'insertStageChange'>;
     recalculateRetention: (candidateId: number) => void;
   }
   export function countActiveApplications(deps: JobClosingDeps, jobId: number): number;
   export function rejectActiveApplications(deps: JobClosingDeps, input: { jobId: number; closedAt: string }): number;
   ```
   - `countActiveApplications` = `deps.repository.countActiveByJob(jobId)`: una sola consulta de agregado, sin traer
     filas (RF-02).
   - `rejectActiveApplications` (DD-02, DD-03): `listActiveByJob(jobId)` y, **por cada fila en orden de `id`**:
     1. `updateStage({ id, fromStage: stage, toStage: 'rejected', changedAt: closedAt })` (guarda de la etapa leída en
        el `WHERE`, SQL de HU-05). Si devuelve `undefined` → `throw new Error('Inscripción activa sin actualizar al
        cerrar la oferta')` (DD-05: 500 con `ROLLBACK`, **no** `stageMismatch`).
     2. `insertStageChange({ applicationId: id, fromStage: stage, toStage: 'rejected', changedAt: closedAt, reason:
        'job_closed', note: null })`.
     3. `deps.recalculateRetention(candidateId)` (para todos: cada candidato aparece una vez por oferta, DD-03).

     Devuelve el número de filas; 0 sin escribir nada si no hay activas. No lee nombre, email, teléfono ni nota; los
     errores son textos fijos.
   - `job-closing.ts` importa solo **tipos** de `./repository.ts` (y, si hace falta, de `./schemas.ts`); nunca
     `service.ts` (sin ciclo) ni otro módulo.
3. **Servicio** (`apps/api/src/modules/applications/service.ts`, 232 → ~248): dos métodos más en `ApplicationsService`,
   con su comentario, y dos líneas en `createApplicationsService` (`ApplicationsServiceDeps` cumple `JobClosingDeps` por
   forma):
   ```ts
   countActiveApplications: (jobId) => countActiveApplications(deps, jobId),                         // sin transacción
   rejectActiveApplications: (input) => deps.transaction(() => rejectActiveApplications(deps, input)), // se une (DEC-11.7)
   ```
   Dentro del cierre, `withTransaction` ve `db.isTransaction` y **se une** a la de `jobs` (no abre otra); en una llamada
   directa abre la suya y sigue siendo todo o nada (DD-04).

**Tests** en `apps/api/test/applications/close-operation.test.ts` (nuevo): llamadas directas a
`createApplicationsService` compuesto a mano sobre la misma base de `createTestApp` (repositorio real,
`transaction: (fn) => withTransaction(db, fn)`, `createJobStatusStub` para `jobStatus`, un doble mínimo de
`candidates` y un **espía de `recalculateRetention`** que guarda los `candidateId` en orden). Datos: oferta publicada y
candidatos por la API (`createPublishedJob`, `createCandidate`) e inscripciones en cualquier etapa con
`insertApplicationAt` (`apps/api/test/helpers/applications.ts`).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/applications/repository.ts` | modificar | `ActiveApplicationRow`, `COUNT_ACTIVE_BY_JOB_SQL`, `LIST_ACTIVE_BY_JOB_SQL`, `createActiveByJobQueries`; 1 línea en la factoría (→ 50) |
| `apps/api/src/modules/applications/job-closing.ts` | crear | `JobClosingDeps`, `countActiveApplications`, `rejectActiveApplications` |
| `apps/api/src/modules/applications/service.ts` | modificar | 2 métodos en `ApplicationsService`; 2 líneas en `createApplicationsService` |
| `apps/api/test/applications/close-operation.test.ts` | crear | EC-01, EC-07 y DD-04 con llamadas directas |

## Implementa
- RF: RF-01 (operación interna), RF-02 (recuento) · RF-06 (sin `SELECT *`, umbrales) · Edge cases: EC-01, EC-07 ·
  DD-01 a DD-05
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (1 y 2), § Contrato de API (*Interfaces internas*),
  § Decisiones de diseño DD-01 a DD-05, § Estrategia de tests (`close-operation.test.ts`), § Checklist 1

## Dependencias
- **Depende de:** nada
- **Bloquea:** TASK-02

## Criterios de done
- [ ] `npm test -w apps/api -- applications/close-operation` en verde con **1** fichero y estos tests:
  - `EC-01 closedAt no ISO → error y nada escrito; jobId sin inscripciones o inexistente → 0`: con 2 activas y
    `closedAt = '2026-10-06 22:30'`, la llamada lanza; las inscripciones siguen en su etapa con su `last_change_at`, el
    número de `stage_changes` no cambia y el espía no tiene llamadas. Con una oferta sin inscripciones y con `999999`,
    devuelve 0, sin `StageChange` ni llamadas al espía.
  - `EC-07 segunda llamada → 0 sin StageChange ni recálculo`: oferta con 2 activas (`received`, `offer`) y 1 `hired`;
    `countActiveApplications` da **2** antes; la primera llamada devuelve 2, deja las dos en `rejected` con un
    `StageChange` cada una (origen su etapa, `job_closed`, nota `null`, `changed_at = closedAt`) y el espía recibe los
    dos `candidateId` en orden de `id`; después `countActiveApplications` da **0**, la segunda llamada devuelve 0, no
    añade `StageChange` y el espía sigue con 2 llamadas; la `hired` no cambia.
  - `DD-04 dentro de una transacción se une: ROLLBACK exterior lo deshace`: `withTransaction(db, () => {
    service.rejectActiveApplications(…); throw new Error('fallo exterior') })` lanza ese error (no uno de transacción
    anidada) y nada queda escrito.
- [ ] `npm test -w apps/api -- applications/ module-boundaries` en verde: `job-closing.ts` no importa otro módulo ni
      hace SQL ajeno, y ningún test de HU-04/HU-05 cambia.
- [ ] `createApplicationsRepository` = **50** líneas exactas; `job-closing.ts` sin `SELECT *` ni SQL concatenado.
- [ ] Ningún fichero tocado pasa de 300 líneas ni ninguna función nueva o modificada de 50 (`wc -l` tras Prettier).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/applications/repository.ts apps/api/src/modules/applications/job-closing.ts apps/api/src/modules/applications/service.ts apps/api/test/applications/close-operation.test.ts`
      sin errores.
- [ ] Commit único `feat(api): count and reject the active applications of a job [HU-06 TASK-01]` con los 4 ficheros.

## Notas de implementación
- **Mutación M2 de la review** (`countActiveByJob` cuenta también las finales): ya la detecta aquí `EC-07 …` (daría
  3 antes y 1 después). La detectan además `close-preview-count.test.ts › CA-08 …` y `close-reject.test.ts › CA-01 …`
  (TASK-02).
- El `CHECK` de `applications.last_change_at` (`GLOB` ISO con milisegundos y `>= created_at`) salta en el `UPDATE`,
  antes que el de `stage_changes`: por eso EC-01 no deja nada a medias. El `closedAt` válido de los tests tiene que ser
  **posterior** al `created_at` de todas las inscripciones (`insertApplicationAt` con `startAt` anterior).
- `ORDER BY id` hace determinista el «segundo de tres» de EC-03 (TASK-04): no lo cambies.
- Sin `SELECT *` (RF-06, RNF-05). El `SELECT *` de `recalculateRetention` en `candidates` no se toca (DT-02).
- No toques `apps/api/src/app.ts` ni `apps/api/src/modules/jobs/`: la conexión es TASK-02.
