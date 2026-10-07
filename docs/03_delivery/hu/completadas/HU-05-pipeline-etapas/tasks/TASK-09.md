# TASK-09 — Contrato de etapas en la web y piezas puras [setup]

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (base de RF-05, RF-06 y RF-07)
- **Complejidad:** L (2–4 h; estimada 2,5 h). El TD-frontend la marca «M, ~2,5 h»: por horas es L (M = 1–2 h)

## Descripción
W1 del diseño: tipos, rutas, cliente y validaciones sin pantallas, más el único cambio en un componente compartido. Sin
dependencias nuevas. Contrato cruzado con el TD-backend (S1-S8).

1. **`apps/web/src/features/applications/types.ts`:** `MANUAL_REJECTION_REASONS` (`not_a_fit`, `candidate_withdrew`,
   `other`; nunca `job_closed`) y `ManualRejectionReason`; `AdvanceInput { expectedStage; toStage }`; `RejectInput {
   expectedStage; reason; note? }`; `HistoryEntry { fromStage: Stage | null; toStage; changedAt; reason:
   RejectionReason | null; note: string | null }`; `ApplicationDetail { id; stage; createdAt; lastChangeAt; candidate:
   { id; fullName }; job: { id; title; status: PipelineJobStatus }; history: HistoryEntry[] }`.
2. **`paths.ts`:** `APPLICATION_ROUTE = '/applications/:id'`, `applicationPath(id)` y `parseApplicationId(path)` (mismo
   patrón que `parsePipelineJobId`, con `parseRouteId`).
3. **`labels.ts`:** `nextStage(stage)` → `screening`, `interview`, `offer`, `hired` o `null` en `hired`/`rejected`
   (tabla de INV-04).
4. **`api.ts`:** `applicationUrl(id)` (`RangeError` con un ID que no pasa `parseRouteId`, sin petición);
   `advanceApplication(id, input, signal)` → `POST …/advance` con cuerpo **exacto** `{ expectedStage, toStage }`;
   `rejectApplication(id, input, signal)` → `POST …/reject` con `{ expectedStage, reason }` o `{ expectedStage, reason,
   note }` (**omite `note`** si queda vacía tras recortar); ambos comprueban `isApplication` y que `id` sea el pedido;
   `isApplicationDetail` (DD-09: `id` pedido, etapas y motivos conocidos, `history` no vacío, `fromStage` nulo solo en el
   primero, `reason` no nulo si y solo si `toStage === 'rejected'`, `note` texto o nulo y solo en el de rechazo);
   `getApplicationDetail(id, signal)`.
5. **`stage-errors.ts`** (nuevo): `classifyStageError(error)` → `'stage-mismatch' | 'invalid-transition' | 'not-found'
   | 'other'` por `code` (DD-05) y los textos de DT-06: «La inscripción ha cambiado de etapa: revisa el pipeline
   actualizado.», «La inscripción ya no admite ese cambio.», «La inscripción ya no existe.».
6. **`reject-form.ts`** (nuevo): `REASON_OPTIONS` (código + etiqueta, sin `job_closed`), `NOTE_MAX = 500`,
   `noteLength(text)` = `Array.from(text.trim()).length` (DD-07), `validateRejectForm(values)` → `{ ok: true, input: {
   reason, note? } } | { ok: false, errors }` con «Elige un motivo.», «La nota no puede pasar de 500 caracteres.» y «La
   nota no puede tener caracteres de control.» (C0 y DEL salvo `\n`, `\r`, `\t`); solo espacios → válida y sin `note`.
7. **`apps/web/src/components/ConfirmDialog.tsx`:** `description` pasa a **opcional**; sin ella no se pinta el `<p>` ni
   `aria-describedby` (DD-03). Nada más cambia (lo usan cerrar y borrar oferta).
8. **Fixtures** `apps/web/test/features/applications/stage-fixtures.ts` (nuevo): **solo datos** inventados — detalles de
   1, 3 y 5 cambios, rechazo con nota multilínea, `job_closed` sin nota, y respuestas `advanced(...)`/`rejected(...)`.
   `renderDetail(path, routes)` llega en TASK-10 (necesita la pantalla).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/applications/types.ts` | modificar | Tipos de avanzar, rechazar y detalle |
| `apps/web/src/features/applications/paths.ts` | modificar | `APPLICATION_ROUTE`, `applicationPath`, `parseApplicationId` |
| `apps/web/src/features/applications/labels.ts` | modificar | `nextStage` |
| `apps/web/src/features/applications/api.ts` | modificar | `applicationUrl`, `advanceApplication`, `rejectApplication`, `isApplicationDetail`, `getApplicationDetail` |
| `apps/web/src/features/applications/stage-errors.ts` | crear | `classifyStageError` y textos de DT-06 |
| `apps/web/src/features/applications/reject-form.ts` | crear | Opciones, contador y validación del rechazo |
| `apps/web/src/components/ConfirmDialog.tsx` | modificar | `description` opcional |
| `apps/web/test/features/applications/api.stage.test.ts` | crear | URL, cuerpos exactos, forma de la respuesta, errores y `classifyStageError` (hermano de `api.test.ts`, 222 líneas) |
| `apps/web/test/features/applications/labels.test.ts` | modificar | `nextStage` en las 6 etapas |
| `apps/web/test/features/applications/reject-form.test.ts` | crear | Límites 500/501, emojis, controles, espacios |
| `apps/web/test/components/ConfirmDialog.test.tsx` | modificar | Sin `description` no hay `aria-describedby` |
| `apps/web/test/features/applications/stage-fixtures.ts` | crear | Solo datos inventados |

## Implementa
- RF: RF-05, RF-06, RF-07 (contrato) · EC: EC-01, EC-02, EC-04, EC-11, EC-12, EC-13, EC-37, EC-45 (cliente) · DD-03,
  DD-05, DD-07, DD-09
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Dependencias (S1-S8), § Módulos y ficheros afectados, § Pantallas y
  estados (validación en el cliente), DD-03, DD-05, DD-07, DD-09, § Checklist W1

## Dependencias
- **Depende de:** nada (el contrato está fijado en `plans/TECHNICAL_DOC-backend.md`; los tests simulan `fetch`)
- **Bloquea:** TASK-10, TASK-11, TASK-12, TASK-13

## Criterios de done
- [ ] `npm test -w @ats/web -- features/applications/api.stage features/applications/labels features/applications/reject-form components/ConfirmDialog`
      en verde con **4** ficheros, entre ellos:
  - `api.stage.test.ts`: cuerpo exacto `{"expectedStage":"screening","toStage":"interview"}` (EC-01); rechazo sin `note`
    con nota de espacios y con `note` si la hay (EC-11); `applicationUrl('abc')`/`0`/16 dígitos → `RangeError` sin
    petición (EC-02); 200 con forma no válida o con otro `id` → error; `isApplicationDetail` rechaza etapa o motivo
    desconocidos, `history` vacío, `id` distinto, **`note` en un cambio no final y `reason` en uno no rechazado**
    (EC-45); `classifyStageError` con los 4 resultados.
  - `reject-form.test.ts`: 500 → ok; 501 → error y `noteLength` 501; 500 emojis → ok; NUL y U+0007 → error; `\n` y `\t`
    → ok; solo espacios → ok sin `note`; sin motivo → «Elige un motivo.» (EC-12, EC-13, EC-36, EC-37).
  - `labels.test.ts`: «EC-04 nextStage nunca devuelve received ni rejected; null en hired y rejected».
  - `ConfirmDialog.test.tsx`: «sin description no pinta el párrafo ni aria-describedby».
- [ ] `npm test -w @ats/web -- features/jobs` en verde (lo compartido no rompe cerrar ni borrar oferta).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/applications/types.ts apps/web/src/features/applications/paths.ts apps/web/src/features/applications/labels.ts apps/web/src/features/applications/api.ts apps/web/src/features/applications/stage-errors.ts apps/web/src/features/applications/reject-form.ts apps/web/src/components/ConfirmDialog.tsx apps/web/test/features/applications/api.stage.test.ts apps/web/test/features/applications/labels.test.ts apps/web/test/features/applications/reject-form.test.ts apps/web/test/components/ConfirmDialog.test.tsx apps/web/test/features/applications/stage-fixtures.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`); `api.ts` previsto en ~190.
- [ ] Commit único `feat(web): stage change contract, reject form rules and optional dialog description [HU-05 TASK-09]`.

## Notas de implementación
- Si el contrato de la API cambiara, solo se tocan `types.ts`, `api.ts` y `stage-errors.ts` (TD-frontend, riesgos).
- `applications` no importa nada de `features/jobs/` (DD-01 de HU-04).
- El `<textarea>` no lleva `maxLength`: cuenta UTF-16; la regla cuenta puntos de código.
- Datos de las fixtures inventados (`@example.com`); notas no sensibles («Prefiere jornada parcial.»).
