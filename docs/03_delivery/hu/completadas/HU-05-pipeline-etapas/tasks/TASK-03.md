# TASK-03 — Avanzar por API (`POST /api/applications/:id/advance`)

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-01)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Rebanada vertical del avance: esquema, servicio con la escritura compartida y ruta, con sus tests.

1. **Esquema** en `apps/api/src/modules/applications/schemas.ts`:
   ```ts
   const STAGE = { type: 'string', enum: STAGES } as const;
   export const advanceBodySchema = {
     type: 'object', additionalProperties: false, required: ['expectedStage', 'toStage'],
     properties: { expectedStage: STAGE, toStage: STAGE },
   } as const;
   export type AdvanceInput = { expectedStage: Stage; toStage: Stage };
   ```
2. **Servicio** (`service.ts`, funciones de módulo de TASK-01):
   - `applyStageChange(deps, application, { toStage, reason, note }): Application` (interna, la reutiliza TASK-04):
     `changedAt = now().toISOString()` **una vez** → `repository.updateStage({ id, fromStage: application.stage, toStage,
     changedAt }) ?? throw stageMismatch(<mensaje de transitions.ts>)` (DD-02) → `repository.insertStageChange({
     applicationId, fromStage, toStage, changedAt, reason, note })` → `if (isFinal(toStage))
     deps.recalculateRetention(application.candidateId)` (DD-07). Devuelve la `Application` del `RETURNING`.
   - `advance(deps, id, input)`: `findById(id) ?? throw notFound('La inscripción no existe.')` →
     `decideAdvance(application.stage, input)` → `'noop'` devuelve la `Application` leída **sin escrituras ni `now()`**;
     `'apply'` → `applyStageChange(deps, application, { toStage: input.toStage, reason: null, note: null })`.
   - **No llama a `jobStatus`** (DT-09, DD-03).
   - La factoría añade `advance: (id, input) => deps.transaction(() => advance(deps, id, input))` (`BEGIN IMMEDIATE`,
     DEC-11.7) y la interfaz `ApplicationsService` gana `advance(id: number, input: AdvanceInput): Application`.
3. **Ruta** en `routes.ts`: `POST /applications/:id/advance` con `schema: { params: idParamsSchema (de
   apps/api/src/http/validation.ts), body: advanceBodySchema, response: { 200: applicationSchema } }` →
   `service.advance(Number(request.params.id), request.body)`. Sin try/catch: los errores van al manejador.

Orden observable (DT-02, DT-13): 403 → parser (415, 413, 400) → `params` y luego `body` (400) → 404 → reintento (200)
→ esperada (409 `STAGE_MISMATCH`) → transición (409 `INVALID_TRANSITION`) → escrituras.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/applications/schemas.ts` | modificar | `advanceBodySchema`, `AdvanceInput` |
| `apps/api/src/modules/applications/service.ts` | modificar | `applyStageChange`, `advance` y su entrada en la factoría |
| `apps/api/src/modules/applications/routes.ts` | modificar | Ruta `POST /applications/:id/advance` |
| `apps/api/test/applications/advance.test.ts` | crear | Camino feliz, reintento, 409, 404, límites, RV-23 y CA-39 |
| `apps/api/test/applications/advance-hire.test.ts` | crear | Contratar: retención y segundo `hired` (hermano para no pasar de 300 líneas) |

## Implementa
- RF: RF-01 · CA: CA-01, CA-03, CA-04, CA-05, CA-06, CA-07, CA-08, CA-10, CA-39 · EC: EC-03, EC-04, EC-08, EC-10 ·
  DD-02, DD-03, DD-05, DD-07, DD-09, DD-10
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (Endpoints, Orden de comprobación), § Firmas internas,
  § Diagrama de secuencia, DD-02, DD-03, DD-05, DD-07, DD-09, DD-10, § Estrategia de tests, § Checklist B-03

## Dependencias
- **Depende de:** TASK-01, TASK-02
- **Bloquea:** TASK-04, TASK-06, TASK-07, TASK-08, TASK-12, TASK-15

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/advance` en verde con **2** ficheros. En `advance.test.ts`, con reloj
      `createTestClock` y estas pruebas por nombre:
  - «CA-01 screening → interview: 200 Application, lastChangeAt = reloj, StageChange sin motivo ni nota» (respuesta con
    exactamente 6 claves).
  - «CA-03 reintento a interview con esperada screening → 200 sin StageChange, lastChangeAt y retención iguales».
  - **«RV-23 (DT-13) en interview, esperada screening (desactualizada) y destino interview → 200 sin escrituras: 0
    StageChange nuevos, lastChangeAt y retención iguales, Application idéntica a la guardada»** (prueba explícita del
    aprobador: la `Application` del 200 es igual, campo a campo, a la leída antes; `total_changes` sin cambios).
  - «CA-06 interview con esperada screening y destino offer → 409 STAGE_MISMATCH, nada cambia».
  - «CA-07 screening → offer, received, rejected → 409 INVALID_TRANSITION» (`it.each`).
  - «EC-04 received→received y rejected→rejected con la esperada al día → 409 INVALID_TRANSITION».
  - «CA-08 hired y rejected con su etapa como esperada → 409 INVALID_TRANSITION».
  - «CA-10 inexistente → 404 sin datos».
  - «EC-03 recorrido completo received → hired: 4 StageChange con fechas crecientes».
  - «EC-03 999999999999999 inexistente → 404 sin datos; MAX_SAFE_INTEGER → 400 { field: 'id' }» (DD-10).
  - **«CA-39 (DT-09, HU-06 lo revisa) activa de una oferta closed → advance 200 y StageChange interview → offer»**:
    oferta cerrada **vacía** por la API y después la inscripción con `insertApplicationAt` (DD-09); además, con
    `createJobStatusSpy` sobre el lector real, `insideTransaction` queda vacío.
- [ ] En `advance-hire.test.ts`:
  - «CA-04 offer → hired: oferta sigue published, retentionEndsAt = día Madrid + 6 meses».
  - «CA-05 otra abierta en otra oferta no cambia y retención null; segundo hired en la misma oferta».
  - «EC-10 reintento a hired → 200 sin StageChange y retención igual».
- [ ] `npm test -w @ats/api -- applications/ module-boundaries` en verde con **20** ficheros.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/applications/schemas.ts apps/api/src/modules/applications/service.ts apps/api/src/modules/applications/routes.ts apps/api/test/applications/advance.test.ts apps/api/test/applications/advance-hire.test.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`); ninguna función > 50 líneas.
- [ ] Commit único `feat(api): advance an application to the next stage [HU-05 TASK-03]`.

## Notas de implementación
- La retención la calcula `recalculateRetention` de `candidates` (dentro de la transacción en curso): **no** se duplica
  la fórmula. Para el valor esperado de CA-04, sigue el estilo de `apps/api/test/applications/enroll-retention.test.ts`
  (leer `retentionEndsAt` con `GET /api/candidates/:id`).
- CA-04: candidato **sin consentimiento** y sin otras inscripciones abiertas; el día del cambio en Europe/Madrid.
- La esperada desactualizada con destino `rejected` da `STAGE_MISMATCH` (DD-05): es correcto, no es un bug.
- Ningún test cierra ofertas **con** inscripciones activas (DT-10 de HU-04): para CA-39, oferta cerrada vacía + SQL de
  fixture (DD-09).
- El test RV-23 y el CA-39 son los que pidió el aprobador; si cambian de nombre, se rompe la trazabilidad con HU-06.
