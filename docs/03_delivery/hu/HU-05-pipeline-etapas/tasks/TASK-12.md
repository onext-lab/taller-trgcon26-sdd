# TASK-12 — Avanzar y contratar desde las tarjetas del pipeline

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (RF-05)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
W4 del diseño: la acción de avanzar, con su confirmación hacia `hired`, conectada al aviso y a la recarga de HU-04.

1. **`use-stage-change.ts`** (nuevo, ~90; patrón de `use-enrollment.ts`): `pendingId`, guarda `inFlight` por `ref` (una
   acción de etapa a la vez en toda la pantalla, DD-01), `useLifetimeSignal` (salir de la pantalla aborta y descarta);
   `advance(item, toStage, callbacks)` envía `advanceApplication(item.id, { expectedStage: item.stage, toStage })` y
   reparte el resultado por `classifyStageError`. `reject(item, input, callbacks)` se deja con la misma forma para
   TASK-13.
2. **`use-stage-actions.ts`** (nuevo; en esta tarea solo la parte de avanzar, ~60 de ~120): diálogo abierto (`none` ·
   `hire`, con la tarjeta objetivo; `reject` llega en TASK-13) y conexión con `usePipelineFeedback` y
   `pipeline.reload`:
   | Respuesta | Página (`PageMessage`) | Pipeline | Foco |
   |---|---|---|---|
   | 200 (también reintento) | `Notice` «Inscripción avanzada a {stageLabel(etapa)}.» | `reload()` | El aviso |
   | 409 `STAGE_MISMATCH` · 409 `INVALID_TRANSITION` · 404 | Alerta con el texto de DT-06 | `reload()` | La alerta |
   | Red, *timeout*, otro 400, 403, 413, 415, 500, forma no válida | Alerta `userMessage(error)`; botones activos | Sin recarga | La alerta |
   Al empezar se limpia el mensaje (`feedback.clear()`). En «Contratar», los fallos genéricos dejan el `HireDialog`
   abierto con `error` (`role="alert"`) y sin mover el foco (DD-06); los 409/404 lo cierran.
3. **`PipelineBoard.tsx`:** prop `actions: CardActions | null`; si `actions !== null` y `nextStage(item.stage) !==
   null`, `CardActionButtons` en `<div className="card-actions">`: `button` «Avanzar a {etapa siguiente}» y `button`
   «Rechazar», cada uno con el sufijo `<span className="visually-hidden">: {candidateName}</span>` (DD-04). Con
   `pendingId !== null`, **todos** los botones de tarjeta `disabled` y el pulsado dice «Avanzando…» (más el sufijo).
   «Rechazar» se pinta pero su manejador llega en TASK-13 (hasta entonces, sin efecto).
4. **`StageDialogs.tsx`** (nuevo; en esta tarea `HireDialog`): `ConfirmDialog` con `title` «¿Contratar a este
   candidato?», `description` «No se puede deshacer.», `confirmLabel` «Contratar», foco inicial en «Cancelar», `busy`
   mientras vuela. «Cancelar»/`Escape` → sin petición y foco de vuelta a «Avanzar a Contratado» (lo hace
   `ConfirmDialog`). «Contratar» → `POST advance { expectedStage: 'offer', toStage: 'hired' }`. Un diálogo por pantalla
   (DD-02).
5. **`PipelineScreen.tsx`:** `PipelineLoader` crea `useStageActions(feedback, pipeline.reload)`; `PipelineContent` pasa
   `actions` **solo** en `published` (en `closed`, `null`: DT-09) y pinta `StageDialogs`. El contenedor solo conecta
   (`PipelineLoader` ≤ 50 líneas).
6. **Estilo** `.card-actions` en `apps/web/src/styles.css` (botones en fila que se parte).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/applications/use-stage-change.ts` | crear | Petición en vuelo única, `pendingId`, `useLifetimeSignal` |
| `apps/web/src/features/applications/use-stage-actions.ts` | crear | Diálogo de contratar y reparto de resultados (parte de avanzar) |
| `apps/web/src/features/applications/StageDialogs.tsx` | crear | `HireDialog` |
| `apps/web/src/features/applications/PipelineBoard.tsx` | modificar | `actions` y `CardActionButtons` |
| `apps/web/src/features/applications/PipelineScreen.tsx` | modificar | Conexión de `useStageActions` y `StageDialogs` |
| `apps/web/src/styles.css` | modificar | `.card-actions` |
| `apps/web/test/features/applications/PipelineScreen.advance.test.tsx` | crear | Acciones por etapa, avanzar y sus resultados |
| `apps/web/test/features/applications/PipelineScreen.hire.test.tsx` | crear | Diálogo de contratar (hermano para no pasar de 300 líneas) |

## Implementa
- RF: RF-05 · CA: CA-02, CA-22 (acciones), CA-40 · EC: EC-05 (web), EC-06 (web), EC-31, EC-32, EC-33 · RNF: RNF-08
  (nombres distintos, foco al aviso) · DD-01, DD-02, DD-04, DD-05, DD-06
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pipeline (tarjeta, acciones por etapa, `HireDialog`, resultado de avanzar
  y rechazar), DD-01, DD-02, DD-04, DD-05, DD-06, § Checklist W4

## Dependencias
- **Depende de:** TASK-09, TASK-11 (`PipelineBoard.tsx` y `PipelineScreen.test.tsx` ya adaptados), TASK-03 (endpoint de
  avanzar)
- **Bloquea:** TASK-13

## Criterios de done
- [ ] `npm test -w @ats/web -- features/applications/PipelineScreen.advance features/applications/PipelineScreen.hire`
      en verde con **2** ficheros. En `PipelineScreen.advance.test.tsx`:
  - «CA-22/EC-31 published: Avanzar y Rechazar solo en las 4 no finales, con nombres accesibles distintos (Avanzar a
    Entrevista: Oriol Mas Puig)».
  - «CA-02 Avanzar a Entrevista → cuerpo {"expectedStage":"screening","toStage":"interview"}, aviso con foco
    (expectFocusOn) y tarjeta en Entrevista tras la recarga».
  - «EC-33 409 STAGE_MISMATCH, 409 INVALID_TRANSITION y 404 → texto de DT-06, foco en la alerta y recarga».
  - «EC-32/EC-05 red y 500 → alerta userMessage sin recarga y botones activos de nuevo».
  - «con una acción en vuelo todos los botones de tarjeta disabled y el pulsado dice Avanzando…».
  - «salir de la pantalla con el avance en vuelo → sin aviso ni error» (movido de W6 al dueño de `useLifetimeSignal`).
- [ ] En `PipelineScreen.hire.test.tsx`:
  - «CA-40 Avanzar a Contratado abre el diálogo con foco en Cancelar; Contratar → tarjeta en Contratado sin acciones».
  - «CA-40 Cancelar y Escape → 0 POST y foco de vuelta a Avanzar a Contratado».
  - «DD-06 500 al contratar → diálogo abierto con role=alert, sin recarga».
- [ ] `npm test -w @ats/web -- features/applications` en verde (los tests de HU-04 del pipeline siguen en verde sin
      tocarlos: TASK-11 ya los dejó por `<p>`).
- [ ] `npx playwright test e2e/applications.spec.ts` en verde (la pantalla del pipeline la cubre ese spec).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/applications/use-stage-change.ts apps/web/src/features/applications/use-stage-actions.ts apps/web/src/features/applications/StageDialogs.tsx apps/web/src/features/applications/PipelineBoard.tsx apps/web/src/features/applications/PipelineScreen.tsx apps/web/test/features/applications/PipelineScreen.advance.test.tsx apps/web/test/features/applications/PipelineScreen.hire.test.tsx`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`); `PipelineScreen.tsx` previsto en ~195;
      ninguna función > 50 líneas.
- [ ] Commit único `feat(web): advance and hire from the pipeline cards [HU-05 TASK-12]`.

## Notas de implementación
- Todo foco movido por un efecto se aserta con `expectFocusOn` (`apps/web/test/helpers/focus.ts`); diálogos con
  `installDialogPolyfill` y `simulateCancel` (`apps/web/test/helpers/dialog.ts`); red con `mockFetch` (`hang` para «en
  curso»).
- El foco al aviso tras cerrar un diálogo funciona porque la limpieza del efecto de `ConfirmDialog` (foco al
  disparador) corre antes que el efecto de `usePipelineFeedback`. Si fuera intermitente, `useLayoutEffect` (DD-10 de
  HU-04).
- Un 200 de reintento es éxito (EC-35): «Inscripción avanzada a {etapa}.».
- Los casos hostiles (HTML en el nombre, doble clic, 400/403, forma no válida) son de TASK-14.
