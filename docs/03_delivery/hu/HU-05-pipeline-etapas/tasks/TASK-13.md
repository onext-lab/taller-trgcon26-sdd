# TASK-13 — Rechazar desde el pipeline: diálogo con motivo y nota

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (RF-06)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
W5 del diseño: el formulario de rechazo sobre `ConfirmDialog` y su reparto de resultados.

1. **`StageDialogs.tsx`:** `RejectDialog` (presentacional): `ConfirmDialog` **sin `description`**, `title` «Rechazar la
   inscripción», `confirmLabel` «Rechazar» (`type="button"`), `busy` mientras vuela, `error` = error del diálogo
   (`role="alert"`). Dentro:
   - `ReasonFieldset`: `<fieldset>` + `<legend>Motivo</legend>`, 3 `input type="radio" name="reject-reason"` con su
     `<label>` desde `REASON_OPTIONS`: «No encaja con el perfil», «Retirada del candidato», «Otro»; ninguno marcado;
     nunca «Oferta cerrada». Error → `<p id="reject-reason-error" className="error-text">` y cada radio con
     `aria-invalid` y `aria-describedby="reject-reason-error"`.
   - `NoteField`: `FormField id="reject-note"`, label «Nota (opcional)», `help` «No incluyas datos sensibles (salud,
     origen, ideología, religión…) ni nada que no sea necesario para la decisión.»; `<textarea rows={4}
     autoComplete="off">` controlado, **sin `maxLength`**; contador `<p id="reject-note-counter"
     className="field-help">{noteLength}/500</p>` en el `aria-describedby` del control, sin `aria-live`.
2. **`use-stage-actions.ts`:** diálogo `reject` con la tarjeta, valores, errores por campo, error del diálogo y refs
   para el foco. Al pulsar «Rechazar»: `validateRejectForm` (TASK-09); si falla, error junto al campo, foco en el primer
   radio o en el `textarea` y **ninguna petición** (EC-36, EC-37). Si pasa, `stageChange.reject(item, { expectedStage:
   item.stage, reason, note? })`:
   | Respuesta | Diálogo | Página | Pipeline | Foco |
   |---|---|---|---|---|
   | 200 (también reintento) | Se cierra; motivo y nota se descartan | `Notice` «Inscripción rechazada.» | `reload()` | El aviso |
   | 409 ×2 · 404 | Se cierra y se descarta | Alerta con el texto de DT-06 | `reload()` | La alerta |
   | 400 con `details` de `reason` o `note` | Sigue abierto; error junto al campo (`splitValidationDetails`), el resto al `error` del diálogo | — | Sin recarga | El campo |
   | Red, *timeout*, otro 400, 403, 413, 415, 500, forma no válida | Sigue abierto con lo escrito; `error` = `userMessage(error)` | — | Sin recarga | No se mueve (DD-06) |
   «Cancelar»/`Escape` descartan motivo y nota y el foco vuelve a «Rechazar» (lo hace `ConfirmDialog`).
3. **`PipelineScreen.tsx`:** solo si hace falta pasar las props del `RejectDialog` a `StageDialogs` (la conexión es de
   TASK-12).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/applications/StageDialogs.tsx` | modificar | `RejectDialog`, `ReasonFieldset`, `NoteField` |
| `apps/web/src/features/applications/use-stage-actions.ts` | modificar | Estado del formulario y resultados del rechazo |
| `apps/web/src/features/applications/PipelineScreen.tsx` | modificar (si hace falta) | Props del `RejectDialog` |
| `apps/web/test/features/applications/PipelineScreen.reject.test.tsx` | crear | Diálogo, envío, resultados y foco |
| `apps/web/test/features/applications/PipelineScreen.reject-form.test.tsx` | crear | Validación en el cliente y contador (hermano para no pasar de 300 líneas) |

## Implementa
- RF: RF-06 · CA: CA-13 · EC: EC-12 (web), EC-14 (web), EC-36, EC-37, EC-38, EC-39 · RNF: RNF-08 (`label`, `legend`,
  foco al cancelar) · DD-02, DD-03, DD-06, DD-07
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § `RejectDialog`, § Validación en el cliente, § Resultado de avanzar y
  rechazar, DD-03, DD-06, DD-07, § Estrategia de tests (RF-06), § Checklist W5

## Dependencias
- **Depende de:** TASK-12 (mismos ficheros: `StageDialogs.tsx`, `use-stage-actions.ts`), TASK-04 (endpoint de rechazar)
- **Bloquea:** TASK-14, TASK-15

## Criterios de done
- [ ] `npm test -w @ats/web -- features/applications/PipelineScreen.reject` en verde con **2** ficheros. En
      `PipelineScreen.reject.test.tsx`:
  - «CA-13 diálogo Rechazar la inscripción: group Motivo con 3 radio sin marcar, textbox Nota (opcional) con el aviso y
    0/500 en su descripción, foco en Cancelar».
  - «CA-13 No encaja con el perfil + nota → aviso Inscripción rechazada. con foco y tarjeta en Rechazado con Motivo: No
    encaja con el perfil y sin la nota».
  - «RNF-08 Cancelar y Escape descartan y devuelven el foco a Rechazar».
  - «EC-38/EC-14 red y 500 → diálogo abierto con motivo y nota y role=alert dentro del dialog, sin recarga».
  - «EC-39 409 → diálogo cerrado, alerta con foco y recarga».
  - «400 con details de note → error junto a la nota y diálogo abierto».
- [ ] En `PipelineScreen.reject-form.test.tsx`: «EC-36 sin motivo → Elige un motivo., foco en el primer radio y 0 POST»;
      «EC-36/EC-12 nota con U+0007 → error de control y 0 POST; \n y \t se envían»; «EC-37 501 → error y 501/500;
      500 y 500 emojis se envían; solo espacios → cuerpo sin note».
- [ ] `npm test -w @ats/web -- features/applications` en verde (sin regresiones).
- [ ] `npx playwright test e2e/applications.spec.ts` en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/applications/StageDialogs.tsx apps/web/src/features/applications/use-stage-actions.ts apps/web/src/features/applications/PipelineScreen.tsx apps/web/test/features/applications/PipelineScreen.reject.test.tsx apps/web/test/features/applications/PipelineScreen.reject-form.test.tsx`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`); `use-stage-actions.ts` ~120 y
      `StageDialogs.tsx` ~140; ninguna función > 50 líneas.
- [ ] Commit único `feat(web): reject an application from the pipeline with reason and note [HU-05 TASK-13]`.

## Notas de implementación
- La nota solo vive en el estado del diálogo (DD-05 del TD-frontend, RNF-06): nada en URL, `history.state` ni
  almacenamiento; se descarta al cancelar, cerrar con éxito o conflicto, salir o recargar.
- Enter en el `textarea` hace salto de línea; «Rechazar» es `type="button"` (tradeoff de DD-03).
- El contador cuenta lo mismo que la regla (texto recortado, puntos de código): nunca se contradicen.
- `expectFocusOn` en todos los asertos de foco.
