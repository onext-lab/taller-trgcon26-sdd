# TASK-01 — RF-09: casos de uso como funciones de módulo, reglas de transición puras y `stageMismatch` [refactor] [setup]

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Should (RF-09); base de RF-01 y RF-02 (Must)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Primera tarea de la HU (decisión del aprobador: el refactor de RF-09 va **antes** que nada). Tres piezas, en este orden:

1. **Refactor sin cambio de comportamiento** de `apps/api/src/modules/applications/service.ts` (DD-06).
   `createApplicationsService` (líneas 52-112; supera el umbral de 50, review de HU-04) pasa a ser una factoría de **≤ 15 líneas** que solo compone:
   - `assertCanEnroll`, `insertReceived`, `enroll` y `getPipeline` pasan a **funciones de módulo** que reciben `deps`
     explícito: `enroll(deps: ApplicationsServiceDeps, input: EnrollInput): Application`,
     `getPipeline(deps, jobId): Pipeline`, etc. Ninguna pasa de 50 líneas.
   - La factoría devuelve `{ enroll: (input) => deps.transaction(() => enroll(deps, input)), getPipeline: (jobId) =>
     getPipeline(deps, jobId) }`. La interfaz `ApplicationsService` y `ApplicationsServiceDeps` **no cambian** en esta
     tarea (`advance`, `reject` y `getDetail` llegan en TASK-03, TASK-04 y TASK-05).
   - **Antes de seguir con los pasos 2 y 3**, las 15 suites de HU-04 de `apps/api/test/applications/` y
     `apps/api/test/module-boundaries.test.ts` en verde **sin tocar ningún test**.
2. **Reglas de transición puras** en `apps/api/src/modules/applications/transitions.ts` (nuevo; DD-01, DD-05), como
   `apps/api/src/modules/jobs/rules.ts`: sin HTTP ni SQL.
   ```ts
   export const NEXT_STAGE: Readonly<Partial<Record<Stage, Stage>>>; // received→screening→interview→offer→hired
   export function isFinal(stage: Stage): boolean;                     // hired | rejected
   export function decideAdvance(current: Stage, input: { expectedStage: Stage; toStage: Stage }): 'apply' | 'noop';
   export function decideReject(current: Stage, expectedStage: Stage): 'apply' | 'noop';
   ```
   `decideAdvance`, en este orden exacto (DT-02, DT-13, DD-05):
   1. `toStage === current` y `toStage` ∈ {`screening`, `interview`, `offer`, `hired`} → `'noop'` (RV-23; **aunque la
      esperada esté desactualizada**).
   2. `expectedStage !== current` → lanza `stageMismatch(...)`.
   3. `current` ∈ {`hired`, `rejected`} → lanza `invalidTransition('La inscripción está en una etapa final: no admite
      cambios.')`.
   4. `toStage !== NEXT_STAGE[current]` (salto, retroceso, `received`, `rejected`) → lanza `invalidTransition('Solo se
      puede avanzar a la etapa siguiente.')`.
   5. Si no → `'apply'`.

   `decideReject`, en este orden: `current === 'rejected'` → `'noop'` (con cualquier esperada) → esperada ≠ actual →
   `stageMismatch` → `current === 'hired'` → `invalidTransition('Una inscripción contratada no se puede rechazar.')` →
   `'apply'`.
3. **Error nuevo** en `apps/api/src/errors.ts`: `stageMismatch(message: string): AppError` →
   `new AppError('STAGE_MISMATCH', 409, message)`, sin `details`. El mensaje de las reglas es la constante
   «La inscripción ha cambiado de etapa: recarga e inténtalo de nuevo.» (DT-02), exportada desde `transitions.ts` para
   reutilizarla en la guarda del `UPDATE` (TASK-03).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/applications/service.ts` | modificar | Funciones de módulo con `deps`; factoría ≤ 15 líneas; sin cambio de comportamiento |
| `apps/api/src/modules/applications/transitions.ts` | crear | `NEXT_STAGE`, `isFinal`, `decideAdvance`, `decideReject`, mensaje de `STAGE_MISMATCH` |
| `apps/api/src/errors.ts` | modificar | `stageMismatch(message)` |
| `apps/api/test/applications/transitions.test.ts` | crear | Tablas completas de `decideAdvance` (6 × 6 × 6) y `decideReject` (6 × 6) |

## Implementa
- RF: RF-09 (primer punto) · base de RF-01 y RF-02 · CA: CA-38 (factoría) · DD-01, DD-05, DD-06
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (1 y 2), § Orden de comprobación (DT-02, DD-05),
  § Firmas internas, DD-01, DD-05, DD-06, § Checklist B-01

## Dependencias
- **Depende de:** nada
- **Bloquea:** TASK-02, TASK-03

## Criterios de done
- [ ] Antes de crear `transitions.ts`: `npm test -w @ats/api -- applications/ module-boundaries` en verde con **16**
      ficheros (15 de HU-04 + `module-boundaries.test.ts`) y **ningún test modificado**.
- [ ] `npm test -w @ats/api -- applications/transitions` en verde con **1** fichero:
  - «decideAdvance: tabla completa etapa actual × esperada × destino» (`it.each` sobre las 216 combinaciones; la tabla
    esperada se escribe como **datos**, no recalculando la regla): incluye `interview`/esperada `screening`/destino
    `interview` → `noop` (RV-23 con esperada desactualizada), `received → received` y `rejected → rejected` con la
    esperada al día → `INVALID_TRANSITION` (EC-04), `hired`/`rejected` con su etapa como esperada → `INVALID_TRANSITION`
    con el mensaje de etapa final (CA-08), y esperada desactualizada con destino `rejected` → `STAGE_MISMATCH` (DD-05).
  - «decideReject: tabla completa 6 × 6»: `rejected` con cualquier esperada → `noop`; `hired` con esperada `hired` →
    `INVALID_TRANSITION`; esperada ≠ actual en las no finales → `STAGE_MISMATCH`.
  - Cada error comprobado por `code`, `statusCode` (409) y `message` exacto.
- [ ] `npm test -w @ats/api -- applications/ module-boundaries` en verde con **17** ficheros al terminar.
- [ ] `createApplicationsService` ≤ 15 líneas; ninguna función nueva o modificada > 50 líneas; `service.ts` ≤ 300.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/applications/service.ts apps/api/src/modules/applications/transitions.ts apps/api/src/errors.ts apps/api/test/applications/transitions.test.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`).
- [ ] Commit único `refactor(api): applications use cases as module functions; pure stage transitions [HU-05 TASK-01]`.

## Notas de implementación
- `transitions.ts` importa `Stage` de `./schemas.ts` y los errores de `../../errors.ts`; nada más.
- La máquina de estados queda en dos sitios (aquí y el `CHECK` de `003-create-applications.sql`): es el tradeoff de
  DD-01; **no** se toca la migración.
- `isFinal` lo usa TASK-03 para decidir el `recalculateRetention` (DD-07).
- Si al repartir el servicio un test de HU-04 se pone en rojo, el refactor **no** es correcto: no se adapta el test.
