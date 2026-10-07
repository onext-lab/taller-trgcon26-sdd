# TASK-04 — Rechazar por API (`POST /api/applications/:id/reject`)

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-02)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
Rebanada vertical del rechazo manual sobre la escritura compartida de TASK-03.

1. **Esquema** en `apps/api/src/modules/applications/schemas.ts`:
   ```ts
   export const MANUAL_REJECTION_REASONS = ['not_a_fit', 'candidate_withdrew', 'other'] as const; // S-15: nunca job_closed
   export const rejectBodySchema = {
     type: 'object', additionalProperties: false, required: ['expectedStage', 'reason'],
     properties: {
       expectedStage: STAGE,
       reason: { type: 'string', enum: MANUAL_REJECTION_REASONS },
       // Tras trimNote: recortada y "" → null (DEC-11.3). Ajv cuenta puntos de código, como length() de SQLite.
       note: { type: ['string', 'null'], maxLength: 500, pattern: NO_CONTROL_CHARS_EXCEPT_WHITESPACE }, // DEC-11.8
     },
   } as const;
   export type RejectInput = { expectedStage: Stage; reason: ManualRejectionReason; note?: string | null };
   ```
   `NO_CONTROL_CHARS_EXCEPT_WHITESPACE` viene de `apps/api/src/http/validation.ts`.
2. **Hook** `trimNote` en `routes.ts` (`preValidation`, solo en esta ruta):
   ```ts
   const trimNote: preValidationHookHandler = (request, _reply, done) => {
     trimTextFields(request.body, { trim: ['note'], emptyToNull: ['note'] });
     done();
   };
   ```
3. **Servicio:** `reject(deps, id, input)`: `findById` (404 «La inscripción no existe.») → `decideReject(stage,
   input.expectedStage)` → `'noop'` devuelve la `Application` leída sin escrituras (motivo y nota originales intactos,
   UC-16 · A1) → `'apply'` → `applyStageChange(deps, application, { toStage: 'rejected', reason: input.reason, note:
   input.note ?? null })`, que recalcula la retención (`isFinal`). **No llama a `jobStatus`** (DT-09). Factoría:
   `reject: (id, input) => deps.transaction(() => reject(deps, id, input))`.
4. **Ruta** `POST /applications/:id/reject` con `preValidation: trimNote`, `schema: { params: idParamsSchema, body:
   rejectBodySchema, response: { 200: applicationSchema } }`. `note` ausente ≡ `null`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/applications/schemas.ts` | modificar | `MANUAL_REJECTION_REASONS`, `rejectBodySchema`, `RejectInput` |
| `apps/api/src/modules/applications/service.ts` | modificar | `reject` y su entrada en la factoría |
| `apps/api/src/modules/applications/routes.ts` | modificar | Hook `trimNote` y ruta `POST /applications/:id/reject` |
| `apps/api/test/applications/reject.test.ts` | crear | Camino feliz, reintento, 400 de motivo, 409, 404, RV-23 y DT-09 |
| `apps/api/test/applications/reject-note.test.ts` | crear | Límites y recorte de la nota (hermano para no pasar de 300 líneas) |

## Implementa
- RF: RF-02 · CA: CA-12, CA-14, CA-15, CA-16, CA-17, CA-18, CA-19, CA-39 (rechazo) · EC: EC-13, EC-16, EC-18 ·
  DD-03, DD-05, DD-07
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (`rejectBodySchema`, `trimNote`, tabla de rechazo),
  § Firmas internas, DD-03, DD-05, § Estrategia de tests, § Checklist B-04

## Dependencias
- **Depende de:** TASK-03 (`applyStageChange`; mismos ficheros de producción)
- **Bloquea:** TASK-05, TASK-06, TASK-07, TASK-08, TASK-13, TASK-15

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/reject` en verde con **2** ficheros. En `reject.test.ts`:
  - «CA-12 interview rechazada con not_a_fit y nota → 200 (6 claves, sin nota), StageChange con ambos, retención
    recalculada».
  - «CA-14 reintento con otro motivo y otra nota → 200 sin StageChange, originales intactos».
  - **«RV-23 (DT-13) ya rejected con not_a_fit y nota, esperada interview (desactualizada), motivo other y otra nota →
    200 sin escrituras: motivo y nota guardados intactos, 0 StageChange nuevos, Application idéntica a la guardada»**
    (prueba explícita del aprobador).
  - «EC-16 rejected con job_closed (insertApplicationAt) → 200; conserva job_closed y note null».
  - «CA-15 sin motivo, foo, job_closed → 400 y nada cambia».
  - «CA-17 esperada screening sobre interview → 409 STAGE_MISMATCH, sigue en interview».
  - «CA-18 hired con esperada hired → 409 INVALID_TRANSITION».
  - «CA-19 inexistente → 404 sin datos».
  - **«DT-09 (HU-06 lo revisa) rechazar una activa de una closed → 200 y StageChange interview → rejected»** (oferta
    cerrada vacía + `insertApplicationAt`, DD-09).
  - **«DT-09 (HU-06 lo revisa) ni advance ni reject llaman al puerto de estado: espía sin llamadas»**
    (`createJobStatusSpy` sobre el lector real; `insideTransaction` vacío tras un avance y un rechazo aplicados).
- [ ] En `reject-note.test.ts`:
  - «CA-16 nota de 501 tras recortar → 400 sin la nota en el cuerpo; nada cambia».
  - «CA-16 nota solo de espacios → 200 y note null».
  - «EC-13 500 → 200; 500 emojis → 200 (puntos de código); espacios alrededor → recortada; note ausente → null».
- [ ] Con los tres tests de DT-09 (uno en TASK-03 y dos aquí), `grep -h "it(.*HU-06 lo revisa" apps/api/test/applications/*.test.ts | wc -l`
      da **3**.
- [ ] `npm test -w @ats/api -- applications/ module-boundaries` en verde con **22** ficheros.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/applications/schemas.ts apps/api/src/modules/applications/service.ts apps/api/src/modules/applications/routes.ts apps/api/test/applications/reject.test.ts apps/api/test/applications/reject-note.test.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`); ninguna función > 50 líneas.
- [ ] Commit único `feat(api): reject an application with reason and optional note [HU-05 TASK-04]`.

## Notas de implementación
- El 400 de la nota **no** repite la nota (DEC-11.4): el manejador ya construye `details` sin el valor recibido;
  compruébalo en CA-16 buscando el texto en el cuerpo.
- `job_closed` solo lo escriben el seed y HU-06: aquí siempre 400 (S-15).
- El reintento sobre una `rejected` da 200 **con cualquier esperada** (DT-13): el test RV-23 lo fija con una esperada
  distinta de `rejected` y de la etapa anterior.
- Notas de prueba no sensibles («Prefiere jornada parcial.»); datos inventados.
