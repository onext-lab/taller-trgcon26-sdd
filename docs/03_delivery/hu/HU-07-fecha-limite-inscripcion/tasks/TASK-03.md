# TASK-03 — Inscribir fuera de plazo: 409 `ENROLLMENT_DEADLINE_PASSED`

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-02)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
`inscripciones` lee la fecha límite de la oferta por el puerto «estado de la oferta» (DEC-06) y rechaza inscribir
cuando el plazo terminó antes de hoy en Europe/Madrid, **dentro** de la transacción de la inscripción (DEC-08) y con el
mismo instante que la fecharía.

1. **Error** (`apps/api/src/errors.ts`): factoría `enrollmentDeadlinePassed(message: string): AppError` → 409,
   `code: 'ENROLLMENT_DEADLINE_PASSED'`, **sin** `details` (DD-09; igual que `invalidTransition`).
2. **Puerto** (`apps/api/src/modules/applications/ports.ts`), método **aditivo** (DD-06; `getJobStatus` y
   `getJobSummary` no cambian):

   ```ts
   /** 'AAAA-MM-DD' o null (sin plazo u oferta inexistente). Se llama tras getJobStatus, en la misma transacción. */
   getEnrollmentDeadline(jobId: number): string | null;
   ```

3. **Implementación en `jobs`**: `apps/api/src/modules/jobs/repository.ts` añade a `createJobQueries` (no a
   `createJobWriteOperations`, que está cerca de 50 líneas) `findEnrollmentDeadlineById(id): string | null | undefined`
   (`SELECT enrollment_deadline FROM job_openings WHERE id = ?`); `apps/api/src/modules/jobs/job-status.ts` añade
   `getEnrollmentDeadline(jobId)` → `repo.findEnrollmentDeadlineById(jobId) ?? null` y amplía el `Pick` del parámetro.
   `apps/api/src/app.ts` **no cambia**: su asignación tipada comprueba la forma nueva al compilar.
4. **Servicio** (`apps/api/src/modules/applications/service.ts`), en `enroll` (DD-07). Orden final, todo dentro de
   `BEGIN IMMEDIATE`: 404 oferta → 404 candidato → 409 `INVALID_TRANSITION` (no `published`) → `instant = now()` (una
   vez) y `today = madridCalendarDate(instant)` → `getEnrollmentDeadline(jobId)` → si `isDeadlinePassed(deadline,
   today)`, `throw enrollmentDeadlinePassed(\`El plazo de inscripción de esta oferta terminó el
   ${formatCalendarDate(deadline)}.\`)` → `INSERT` (409 `DUPLICATE` al chocar con el índice) → `StageChange` →
   `recalculateRetention`. El 409 sale **antes de cualquier escritura**: ni inscripción, ni `StageChange`, ni retención
   recalculada (RN-06), y reintentar da lo mismo (EC-16). Importa `madridCalendarDate`, `formatCalendarDate` e
   `isDeadlinePassed` de `../../calendar.ts`.
5. **Dobles de test** del puerto:
   - `apps/api/test/helpers/applications.ts`: `createJobStatusStub({ enrollmentDeadline?, failDeadline? })` implementa
     `getEnrollmentDeadline` (por defecto `null`; con `failDeadline`, lanza un error real sin datos personales, como
     `failSummary`); `createJobStatusSpy` delega el
     método nuevo y registra `deadlineInsideTransaction: boolean[]` (`db.isTransaction` en cada llamada), junto a
     `insideTransaction`.
   - `apps/api/test/applications/privacy-logs.test.ts`: el `statusPort` en línea implementa `getEnrollmentDeadline`
     (lee la fecha real; lanza con `failStatus`).
6. **Tests**:
   - `apps/api/test/applications/enroll-deadline.test.ts` (**crear**; reloj `createTestClock`, ofertas creadas por la
     API con el reloj días antes y luego `clock.set(...)`, DD-12):
     - «CA-09 plazo hoy a las 23:59:59 de Madrid y oferta sin plazo → 201» (EC-14).
     - «CA-10 00:00:00 del 14 → 409 ENROLLMENT_DEADLINE_PASSED «El plazo de inscripción de esta oferta terminó el
       13/10/2026.» dos veces; 0 inscripciones, 0 StageChange, retención igual» (EC-16).
     - «CA-11 vencida con el candidato ya inscrito → 409 ENROLLMENT_DEADLINE_PASSED (no DUPLICATE); closed vencida →
       INVALID_TRANSITION; draft vencida → INVALID_TRANSITION» (RN-07, EC-28 parte de inscribir).
     - «CA-06 ampliar a hoy o quitar el plazo vencido → sigue published e inscribir da 201».
     - `it.each` «RNF-01 frontera %s → %i» con la tabla de abajo (EC-11).
   - `apps/api/test/applications/ports.test.ts` (**modificar**, 271 → ~285): «HU-07 lector real:
     getEnrollmentDeadline → fecha, null sin plazo, null si no existe».

**RNF-01** (plazo = el día indicado; instantes comprobados con `Intl` en Node 24.21):

| Plazo | Reloj (UTC) | Madrid | Esperado |
|---|---|---|---|
| 2026-10-13 | `2026-10-13T21:59:59Z` | 13/10 23:59:59 | 201 |
| 2026-10-13 | `2026-10-13T22:00:00Z` | 14/10 00:00:00 | 409 |
| 2026-10-13 | `2026-10-13T23:30:00Z` (UTC aún 13) | 14/10 01:30 | 409 |
| 2026-03-29 (cambio a verano) | `2026-03-29T21:59:59Z` | 29/03 23:59:59 | 201 |
| 2026-03-29 | `2026-03-29T22:00:00Z` | 30/03 00:00:00 | 409 |
| 2026-03-28 | `2026-03-28T22:59:59Z` / `2026-03-28T23:00:00Z` | 28/03 23:59:59 / 29/03 00:00 | 201 / 409 |
| 2026-10-25 (cambio a invierno) | `2026-10-25T22:59:59Z` | 25/10 23:59:59 | 201 |
| 2026-10-25 | `2026-10-25T23:00:00Z` | 26/10 00:00:00 | 409 |
| 2026-10-24 | `2026-10-24T21:59:59Z` / `2026-10-24T22:00:00Z` | 24/10 23:59:59 / 25/10 00:00 | 201 / 409 |

## Archivos afectados

| Archivo | Acción | Descripción |
|---|---|---|
| `apps/api/src/errors.ts` | Modificar | Factoría `enrollmentDeadlinePassed(message)` (409, sin `details`) |
| `apps/api/src/modules/applications/ports.ts` | Modificar | `getEnrollmentDeadline` en `JobStatusPort` |
| `apps/api/src/modules/jobs/repository.ts` | Modificar | `findEnrollmentDeadlineById` en `createJobQueries` |
| `apps/api/src/modules/jobs/job-status.ts` | Modificar | `getEnrollmentDeadline` y `Pick` ampliado |
| `apps/api/src/modules/applications/service.ts` | Modificar | Guarda del plazo en `enroll` con un solo `now()` |
| `apps/api/test/helpers/applications.ts` | Modificar | Stub con `enrollmentDeadline?` y espía con `deadlineInsideTransaction` |
| `apps/api/test/applications/privacy-logs.test.ts` | Modificar | `statusPort` con `getEnrollmentDeadline` |
| `apps/api/test/applications/enroll-deadline.test.ts` | Crear | CA-06, CA-09, CA-10, CA-11, RNF-01 |
| `apps/api/test/applications/ports.test.ts` | Modificar | Lector real de `getEnrollmentDeadline` |

## Implementa
- RF: RF-02 · CA: CA-06 (inscribir tras ampliar o quitar), CA-09, CA-10 (API), CA-11 · RNF-01 · Edge cases: EC-11,
  EC-14, EC-16, EC-28 (parte de inscribir)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (`POST /api/applications`, «409 nuevo»), § Firmas
  internas, § Diagrama de secuencia, DD-06, DD-07, DD-09, § Estrategia de tests (RNF-01), § Checklist de
  implementación (punto 5, parte de inscribir)

## Dependencias
- **Depende de:** TASK-02 (`calendar.ts`; la oferta guarda la fecha desde TASK-01)
- **Bloquea:** TASK-04, TASK-05

## Criterios de done
- [ ] `npm test -w apps/api -- applications/enroll-deadline applications/ports applications/privacy-logs` en verde
      (3 ficheros de test).
- [ ] `npm test -w apps/api -- applications/enroll` en verde (los de HU-04 siguen igual: orden 404 → 404 → 409).
- [ ] `npm run typecheck` sin errores (incluido `app.ts` sin tocarlo).
- [ ] `npx eslint apps/api/src/errors.ts apps/api/src/modules/applications/ports.ts apps/api/src/modules/jobs/repository.ts apps/api/src/modules/jobs/job-status.ts apps/api/src/modules/applications/service.ts apps/api/test/helpers/applications.ts apps/api/test/applications/privacy-logs.test.ts apps/api/test/applications/enroll-deadline.test.ts apps/api/test/applications/ports.test.ts`
      sin errores.
- [ ] Ningún fichero pasa de 300 líneas ni ninguna función de 50.
- [ ] Commit único `feat(api): reject enrollment after the job's deadline (409 ENROLLMENT_DEADLINE_PASSED) [HU-07 TASK-03]`.

## Notas de implementación
- El `now()` de `enroll` ya se llama una vez tras las guardas (línea 124): muévelo **antes** de la guarda del plazo y
  reutilízalo en el `INSERT` y el `StageChange`; no llames dos veces al reloj.
- Con plazo vencido y candidato inexistente sale el 404, no el 409 (DD-07, tradeoff aceptado).
- `getPipeline` todavía no usa el método nuevo: lo hace TASK-04.
- El 409 no se registra en el log (solo los 500, `apps/api/src/http/error-handler.ts`); el mensaje solo lleva la fecha.
  Lo prueba TASK-05 (EC-15).
- `module-boundaries.test.ts` no cambia: `applications` importa `../../calendar.ts`, no `modules/jobs`.
