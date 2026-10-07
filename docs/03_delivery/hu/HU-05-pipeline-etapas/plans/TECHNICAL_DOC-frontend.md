# HU-05 — Pipeline con cambio de etapa e historial — Diseño técnico (frontend)

- **Origen:** `specs/PRD.md` (estado Ready, v1.1, 2026-10-07; DT-01 a DT-11)
- **Generado por:** frontend-architect
- **Scope cubierto:** RF-05, RF-06, RF-07, RF-08 y la parte web de RF-09; RNF-06, RNF-07 y RNF-08. RF-01 a RF-03 son
  solo backend: aquí se consumen (contrato) y se recorren en los e2e. RF-04 y RNF-03 pasaron a HU-06 (DT-01).

## Enfoque técnico

Todo vive en `apps/web/src/features/applications/` con el patrón de HU-04 (contenedor → presentacionales, cliente
`api.ts` sobre `requestJson`, `useResource`, `FormField`, `ConfirmDialog`, `StatusMessages`), **sin dependencias
nuevas**. Cuatro piezas:

- **Acciones en las tarjetas (RF-05):** en una oferta `published`, cada tarjeta no final lleva «Avanzar a {etapa
  siguiente}» y «Rechazar». «Avanzar» envía `POST /api/applications/:id/advance { expectedStage: <etapa de la tarjeta>,
  toStage: <siguiente> }` **sin confirmación**; si la siguiente es `hired`, antes abre un `ConfirmDialog` (DT-04). Una
  acción de etapa a la vez en toda la pantalla (guarda por `ref` + botones `disabled`, DD-01). El resultado va al aviso
  o a la alerta de la página que ya existe (`usePipelineFeedback`, foco incluido) y, salvo en los fallos genéricos, se
  recarga el pipeline con `useResource.reload()` (DT-06).
- **Rechazo (RF-06):** un único diálogo modal por pantalla sobre `ConfirmDialog` (trampa de foco nativa de
  `showModal()`, `Escape`, foco inicial en «Cancelar» y vuelta al disparador), con los 3 motivos en radios, la nota en un
  `<textarea>` con contador «N/500» y el aviso como ayuda del campo (DD-03). Validación en el cliente con
  `reject-form.ts` (puntos de código y controles salvo `\n`, `\r`, `\t`, como la API).
- **Detalle (RF-07):** pantalla nueva `/applications/:id` (`ApplicationDetailScreen` → `ApplicationDetails`), título
  constante «Inscripción · ATS», cabecera con candidato y oferta enlazados, etapa e historial en `<ol>`. ID no válido,
  400 o 404 → «Página no encontrada» (el `NotFoundScreen` de `App.tsx` por prop, DD-09 de HU-04).
- **Enlaces y oferta cerrada (RF-07, RF-08):** el nombre de cada tarjeta pasa a `<Link>` al detalle (también en
  `closed`); el 409 `DUPLICATE` del panel «Inscribir candidato» añade «Ver la inscripción» con `existingId`; en `closed`
  el tablero no recibe acciones (dependen del estado de la oferta, DT-09) y la ficha ofrece «Ver pipeline».

**Dirección entre features (DD-01 de HU-04, se mantiene):** `jobs → applications → candidates`. `applications` no
importa nada de `features/jobs/`; `App.tsx` pasa `notFound` (y, como hoy, `jobPath`) por props; el enlace a la ficha del
candidato usa `candidatePaths` de `apps/web/src/features/candidates/paths.ts` (API pública de `candidates`, DD-08).

**Alternativa principal descartada:** un formulario de rechazo propio (componente `<dialog>` nuevo con su ciclo de vida).
Duplicaba `useModalDialog` de `ConfirmDialog` (trampa, `Escape`, foco inicial y de vuelta) para ganar solo un botón
`submit`; con `ConfirmDialog` + `children` el cambio en lo compartido es hacer opcional `description` (DD-03).

## Dependencias

- **Contrato de API:** lo fija la sección «Contrato de API» de `plans/TECHNICAL_DOC-backend.md` (manda el backend). Este
  documento se diseñó contra el PRD (RF-01 a RF-03, Interfaces, DT-02, DT-03, DT-07) con los supuestos S1-S8, **cruzados
  con el TD-backend el 2026-10-07**: casan todos, sin ajustes. Si cambian, solo se tocan
  `apps/web/src/features/applications/types.ts`, `api.ts` y `stage-errors.ts`.

| # | Elemento | Supuesto de la web | Estado |
|---|---|---|---|
| S1 | `POST /api/applications/:id/advance` | Cuerpo exacto `{ expectedStage, toStage }` (las 6 etapas); 200 `Application` = exactamente `{ id, jobId, candidateId, stage, createdAt, lastChangeAt }`, `stage === toStage`, **también en el reintento** (DT-02) | **Cruzado con el TD-backend** («Tipos», «Endpoints») |
| S2 | `POST /api/applications/:id/reject` | Cuerpo exacto `{ expectedStage, reason }` o `{ expectedStage, reason, note }`; `reason` ∈ `not_a_fit`, `candidate_withdrew`, `other`; la web **omite `note`** si queda vacía tras recortar (la API la trataría como `null`, DEC-11.3); 200 `Application` (6 campos, sin nota) | **Cruzado con el TD-backend** (`note` ausente ≡ `null`; `trimNote` recorta y vacía → `null`) |
| S3 | Errores de los dos `POST` | 409 `STAGE_MISMATCH` · 409 `INVALID_TRANSITION` · 404 `NOT_FOUND` · 400 `VALIDATION_ERROR` con `details[].field` ∈ `expectedStage`, `toStage`, `reason`, `note`, `id`, `body` (sin el valor recibido, DEC-11.4) · 403 `CROSS_SITE_REQUEST` · 413 · 415 · 500 `INTERNAL_ERROR`. La web **no** muestra el `message` de los 409 ni del 404: usa sus textos (DT-06) | **Cruzado con el TD-backend** («Errores específicos»; JSON roto → 400 con su propio `message`) |
| S4 | `GET /api/applications/:id` | 200 `{ id, stage, createdAt, lastChangeAt, candidate: { id, fullName }, job: { id, title, status }, history: [{ fromStage, toStage, changedAt, reason, note }] }` (DT-07); `history` no vacío, del más antiguo al más reciente; `fromStage` nulo solo en el primero; `reason` no nulo si y solo si `toStage === 'rejected'` (incluido `job_closed`); `note` nulo o texto (con `\n`, `\r`, `\t`) y solo en el de rechazo. 400 (`:id` no válido o con query) · 404 `NOT_FOUND` · 500 | **Cruzado con el TD-backend** (`history` de 1 a 5; query → 400 `{ field: 'querystring' }`) |
| S5 | `job.status` del detalle | `draft`, `published` o `closed` (la web no lo pinta; solo lo valida) | **Cruzado con el TD-backend** |
| S6 | 409 `DUPLICATE` de `POST /api/applications` | Sin cambios de HU-04: `details: [{ field: 'candidateId', message, existingId }]`; `http.ts` ya conserva `existingId` si es un ID válido | Casa (`docs/05_modules/inscripciones/technical.md`, «Endpoints») |
| S7 | `GET /api/jobs/:jobId/applications` | Sin cambios (5 campos por elemento, RNF-05); el `id` del elemento es el de la inscripción | Casa (HU-04) |
| S8 | `/api/applications/:id` con `:id` de la web | La web solo construye URL con IDs que pasan `parseRouteId` (mismo patrón que la API); con otro, `RangeError` sin petición | Casa (`apps/web/src/components/router.tsx`) |

- **DEC-12:** la web va por el *proxy* de Vite (`same-origin`); un 403 inesperado se pinta como cualquier fallo genérico.
- **Los e2e dependen del backend completo** (las tres rutas nuevas y el seed actual con ofertas `closed` y rechazos
  `job_closed`); los tests de Vitest, no (simulan `fetch`).

## Módulos y ficheros afectados

Líneas: estimación tras el cambio (≤ 300 por fichero tras Prettier, ≤ 50 por función, complejidad ≤ 10).

| Módulo | Fichero | Cambio |
|---|---|---|
| transversal | `apps/web/src/components/ConfirmDialog.tsx` | modificar (~102): `description` pasa a opcional; sin ella no se pinta el `<p>` ni `aria-describedby` (DD-03) |
| transversal | `apps/web/src/App.tsx` | modificar (~132): ruta `{ pattern: APPLICATION_ROUTE, title: 'Inscripción', element: <ApplicationDetailScreen notFound={<NotFoundScreen />} /> }` |
| transversal | `apps/web/src/styles.css` | modificar (~240): `.card-actions` (botones de la tarjeta en fila que se parte) y `.history` (lista del historial) |
| jobs | `apps/web/src/features/jobs/JobActions.tsx` | modificar (~70): en `closed`, `<Link to={pipelinePath(job.id)}>Ver pipeline</Link>` como primer control antes de «Duplicar» (DT-08 b) |
| applications | `apps/web/src/features/applications/types.ts` | modificar (~100): `MANUAL_REJECTION_REASONS` (3) y `ManualRejectionReason`, `AdvanceInput`, `RejectInput`, `HistoryEntry`, `ApplicationDetail` (S1, S2, S4) |
| applications | `apps/web/src/features/applications/paths.ts` | modificar (~28): `APPLICATION_ROUTE = '/applications/:id'`, `applicationPath(id)`, `parseApplicationId(path)` |
| applications | `apps/web/src/features/applications/labels.ts` | modificar (~55): `nextStage(stage)` → `screening`, `interview`, `offer`, `hired` o `null` en `hired`/`rejected` (tabla de INV-04) |
| applications | `apps/web/src/features/applications/api.ts` | modificar (~190): `applicationUrl(id)` (`RangeError` con ID no válido), `advanceApplication(id, input, signal)`, `rejectApplication(id, input, signal)` (comprueban `isApplication` e `id`), `isApplicationDetail`, `getApplicationDetail(id, signal)` (comprueba también `id`) |
| applications | `apps/web/src/features/applications/stage-errors.ts` | **nuevo** (~40): `classifyStageError(error)` → `'stage-mismatch' \| 'invalid-transition' \| 'not-found' \| 'other'` y los tres textos de DT-06 |
| applications | `apps/web/src/features/applications/reject-form.ts` | **nuevo** (~75): `REASON_OPTIONS` (código + etiqueta, sin `job_closed`), `NOTE_MAX = 500`, `noteLength(text)` (puntos de código del texto recortado), `validateRejectForm(values)` → `{ ok: true, input: { reason, note? } } \| { ok: false, errors }` y los mensajes |
| applications | `apps/web/src/features/applications/use-stage-change.ts` | **nuevo** (~90): `pendingId`, guarda `inFlight` por `ref`, `useLifetimeSignal`; `advance(item, toStage, callbacks)` y `reject(item, input, callbacks)` con el reparto de resultados (patrón de `use-enrollment.ts`) |
| applications | `apps/web/src/features/applications/use-stage-actions.ts` | **nuevo** (~120): diálogo abierto (`none` · `hire` · `reject`, con la tarjeta), estado del formulario de rechazo (valores, errores por campo, error del diálogo, refs para el foco; en la implementación, en `use-reject-form.ts` por el umbral de 50 líneas, TASK-13) y conexión con `usePipelineFeedback` y `reload` |
| applications | `apps/web/src/features/applications/StageDialogs.tsx` | **nuevo** (~140): `HireDialog` y `RejectDialog` (presentacionales sobre `ConfirmDialog`), `ReasonFieldset` y `NoteField` |
| applications | `apps/web/src/features/applications/PipelineBoard.tsx` | modificar (~110): nombre como `<Link to={applicationPath(item.id)}>` dentro del primer `<p>`; prop `actions: CardActions \| null` → `CardActionButtons` en tarjetas no finales |
| applications | `apps/web/src/features/applications/PipelineScreen.tsx` | modificar (~195): `PipelineLoader` crea `useStageActions`; `PipelineContent` pasa `actions` solo en `published` y pinta `StageDialogs` |
| applications | `apps/web/src/features/applications/use-enrollment.ts` | modificar (~75): `onDuplicate(existingId: number \| undefined)`, leído del primer `details[]` con `existingId` |
| applications | `apps/web/src/features/applications/use-enroll-panel.ts` | modificar (~108): `showAlert(text, existingId?)`; expone `alertLinkId` |
| applications | `apps/web/src/features/applications/EnrollPanel.tsx` | modificar (~158): tras el `<p role="alert">`, `<p><Link to={applicationPath(id)}>Ver la inscripción</Link></p>` si hay `alertLinkId` (DD-10) |
| applications | `apps/web/src/features/applications/ApplicationDetailScreen.tsx` | **nuevo** (~80): `ApplicationDetailScreen` (ruta; prop `notFound`) y `ApplicationLoader` (`useResource(getApplicationDetail)`, estados) |
| applications | `apps/web/src/features/applications/ApplicationDetails.tsx` | **nuevo** (~90): cabecera (`dl`), etapa e historial (`ol` con un `HistoryItem` por cambio), presentacional |
| tests | `apps/web/test/components/ConfirmDialog.test.tsx` | modificar (~195): sin `description` no hay `aria-describedby` |
| tests | `apps/web/test/features/applications/stage-fixtures.ts` | **nuevo** (~90): detalles inventados (1, 3 y 5 cambios; rechazo con nota; `job_closed`), `renderDetail(path, routes)`, respuestas `advanced(...)`/`rejected(...)` |
| tests | `apps/web/test/features/applications/api.stage.test.ts` | **nuevo** (~220): URL, cuerpos exactos, forma de la respuesta, errores (hermano de `api.test.ts`, 222) |
| tests | `apps/web/test/features/applications/labels.test.ts` · `reject-form.test.ts` | modificar (~70) · **nuevo** (~120) |
| tests | `apps/web/test/features/applications/PipelineScreen.advance.test.tsx` | **nuevo** (~270): RF-05 |
| tests | `apps/web/test/features/applications/PipelineScreen.reject.test.tsx` | **nuevo** (~280): RF-06 |
| tests | `apps/web/test/features/applications/PipelineScreen.links.test.tsx` | **nuevo** (~160): enlaces de las tarjetas, «Ver la inscripción» y `closed` en solo lectura (RF-07, RF-08) |
| tests | `apps/web/test/features/applications/PipelineScreen.stage-adversarial.test.tsx` | **nuevo** `[adversarial]` (~260) |
| tests | `apps/web/test/features/applications/ApplicationDetailScreen.test.tsx` · `ApplicationDetailScreen.adversarial.test.tsx` | **nuevo** (~250) · **nuevo** `[adversarial]` (~130) |
| tests | `apps/web/test/features/applications/PipelineScreen.test.tsx` | modificar: CA-12 (líneas 59-79) y EC-30 (133-147) pasan de `card.textContent` a los `<p>` de la tarjeta, y la lista de `link` incluye los nombres; el título del test deja de decir «sin link» |
| tests | `apps/web/test/features/jobs/JobDetailScreen.closed.test.tsx` | **nuevo** (~80), hermano de `JobDetailScreen.actions.test.tsx` (300 líneas, no se toca): «Ver pipeline» en `closed` |
| tests | `apps/web/test/features/jobs/JobDetailScreen.states.test.tsx` | modificar: línea 82 (el test pasa a «solo `draft` sin enlace»), 105 y 141 → `['Ver pipeline', 'Duplicar']` |
| tests | `apps/web/test/App.test.tsx` | modificar (~210): `/applications/32` con título «Inscripción · ATS» y foco en `<main>`; `/applications/abc` → «Página no encontrada» sin petición |
| e2e | `e2e/support/applications.ts` | **nuevo** (~80): `uniqueToken`, `createJobByApi`, `createCandidateByApi`, `enrollByApi`, `pipelinePath`, `stageRegion`, sacados de `e2e/applications.spec.ts` (no es `*.spec.ts`: Playwright no lo ejecuta) |
| e2e | `e2e/applications.spec.ts` | modificar (~175): importa los *helpers*; el test CA-08 pasa a CA-36 (enlace «Ver la inscripción» → detalle) |
| e2e | `e2e/jobs-lifecycle.spec.ts` | modificar: líneas 160 y 246 → `['Ver pipeline', 'Duplicar']` |
| e2e | `e2e/pipeline-stages.spec.ts` | **nuevo** (~260): recorridos de RF-05 a RF-08 |

**No se tocan:** `apps/web/src/components/use-resource.ts` (`reload()` de HU-04 basta), `StatusMessages.tsx` (`Notice`
con `ref` ya existe), `http.ts` (`existingId` ya existe), `use-pipeline-feedback.ts` (se reutiliza tal cual) y
`apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx`.

## Pantallas y estados

### Rutas y títulos

| Ruta | Pantalla | `document.title` |
|---|---|---|
| `/jobs/:id` (modificada) | `JobDetailScreen` → `JobActions`: «Ver pipeline» también en `closed` | Sin cambios (título de la oferta) |
| `/jobs/:id/pipeline` (modificada) | `PipelineScreen`: acciones, diálogos y nombres enlazados | «Pipeline de la oferta · ATS», sin cambios |
| `/applications/:id` (**nueva**) | `ApplicationDetailScreen` | «Inscripción · ATS» **en todos los estados** (`ROUTES` + `useDocumentTitle`); nunca un nombre ni la nota |

### Pipeline (`/jobs/:id/pipeline`)

```
PipelineScreen                 (sin cambios: parsePipelineJobId; id no válido → props.notFound)
└─ PipelineLoader key=id       useResource(getPipeline) · usePipelineFeedback · useEnrollment · useEnrollPanel
   │                           · useStageActions(feedback, pipeline.reload)            ← nuevo
   ├─ h1 · «Volver a la oferta» · PageMessage (aviso/alerta con foco: inscribir, avanzar y rechazar)
   └─ success → PipelineContent
      ├─ draft     → mensaje de borrador (sin cambios)
      ├─ published → «Inscribir candidato» · EnrollPanel · PipelineBoard actions={stageActions}
      │              · StageDialogs (HireDialog + RejectDialog, uno de cada por pantalla)
      └─ closed    → PipelineBoard actions={null}  (solo lectura, DT-09)
```

**Tarjeta (`PipelineCard`):**

| Pieza | Detalle |
|---|---|
| Nombre | `<p><Link to={applicationPath(item.id)}>{item.candidateName}</Link></p>` (texto JSX), en `published` y `closed`; el primer `<p>` sigue siendo el nombre (tests existentes) |
| Fecha y motivo | Sin cambios: «Último cambio: dd/mm/aaaa» y, en «Rechazado», «Motivo: {etiqueta}». **Nunca la nota** (la API no la da) |
| Acciones | Solo si `actions !== null` y `nextStage(item.stage) !== null`: `<div className="card-actions">` con `button` «Avanzar a {stageLabel(siguiente)}» y `button` «Rechazar» |
| Nombre accesible | Texto visible + sufijo `<span className="visually-hidden">: {candidateName}</span>` → «Avanzar a Entrevista: Oriol Mas Puig», «Rechazar: Oriol Mas Puig» (DD-04) |
| En curso | Con `pendingId !== null`, **todos** los botones de las tarjetas `disabled`; el pulsado dice «Avanzando…» (más el sufijo) |

**Acciones por etapa (EC-31, CA-22):**

| Etapa de la tarjeta | `published` | `closed` |
|---|---|---|
| `received` · `screening` · `interview` | «Avanzar a Cribado / Entrevista / Oferta» (sin diálogo) + «Rechazar» | Solo el nombre enlazado |
| `offer` | «Avanzar a Contratado» (abre `HireDialog`) + «Rechazar» | Solo el nombre enlazado (EC-49) |
| `hired` · `rejected` | Solo el nombre enlazado | Solo el nombre enlazado |

**`HireDialog` (DT-04, CA-40):** `ConfirmDialog` con `title` «¿Contratar a este candidato?», `description` «No se puede
deshacer.», `confirmLabel` «Contratar»; foco inicial en «Cancelar». «Cancelar» o `Escape` → sin petición, el foco
vuelve a «Avanzar a Contratado» (lo hace `ConfirmDialog`). «Contratar» → `POST advance { expectedStage: 'offer',
toStage: 'hired' }` con el diálogo `busy`.

**`RejectDialog` (DT-05, RF-06):** `ConfirmDialog` **sin `description`**, `title` «Rechazar la inscripción»,
`confirmLabel` «Rechazar», `busy` mientras vuela, `error` = error del diálogo (`role="alert"`).

| Campo | Marcado y reglas |
|---|---|
| Motivo | `<fieldset>` + `<legend>Motivo</legend>`; 3 `input type="radio" name="reject-reason"` con su `<label>`: «No encaja con el perfil», «Retirada del candidato», «Otro»; **ninguno marcado**; nunca «Oferta cerrada». Error → `<p id="reject-reason-error" className="error-text">` y cada radio con `aria-invalid` y `aria-describedby="reject-reason-error"` |
| Nota | `FormField id="reject-note"`, *label* «Nota (opcional)», `help` = «No incluyas datos sensibles (salud, origen, ideología, religión…) ni nada que no sea necesario para la decisión.»; `<textarea rows={4} autoComplete="off">` controlado, **sin `maxLength`** (cuenta UTF-16); contador `<p id="reject-note-counter" className="field-help">{noteLength}/500</p>` añadido al `aria-describedby` del control; sin `aria-live` (no se anuncia cada tecla) |
| Botones | «Cancelar» (foco inicial) y «Rechazar» (`type="button"`, de `ConfirmDialog`); Enter en el `textarea` hace salto de línea |

**Validación en el cliente (`validateRejectForm`, al pulsar «Rechazar», sin petición si falla — EC-36, EC-37):**

| Regla | Mensaje (junto al campo) | Foco |
|---|---|---|
| Sin motivo | «Elige un motivo.» | Primer radio |
| Nota recortada > 500 puntos de código (`Array.from`) | «La nota no puede pasar de 500 caracteres.» | `textarea` |
| Nota con C0 o DEL salvo `\n`, `\r`, `\t` | «La nota no puede tener caracteres de control.» | `textarea` |
| Nota solo de espacios | Válida: se envía **sin** `note` | — |

El contador cuenta lo mismo que la regla (texto recortado, puntos de código; DD-07): 500 emojis → «500/500» y se envía.

**Resultado de avanzar y rechazar** (`classifyStageError` por `code`, DEC-07; textos de DT-06 en la web):

| Respuesta | Avanzar (sin diálogo) | Contratar · Rechazar (diálogo) | Página (`PageMessage`) | Pipeline | Foco |
|---|---|---|---|---|---|
| 200 (también reintento, EC-35) | — | Se cierra; motivo y nota se descartan | `Notice` «Inscripción avanzada a {etapa}.» · «Inscripción rechazada.» | `reload()` | El aviso |
| 409 `STAGE_MISMATCH` | — | Se cierra y se descarta | Alerta «La inscripción ha cambiado de etapa: revisa el pipeline actualizado.» | `reload()` | La alerta |
| 409 `INVALID_TRANSITION` | — | Se cierra y se descarta | Alerta «La inscripción ya no admite ese cambio.» | `reload()` | La alerta |
| 404 `NOT_FOUND` | — | Se cierra y se descarta | Alerta «La inscripción ya no existe.» | `reload()` | La alerta |
| 400 con `details` de `reason` o `note` (solo rechazar) | — | Sigue abierto; error junto al campo (`splitValidationDetails`), lo demás al `error` del diálogo | — | Sin recarga | El campo |
| Red, *timeout*, otro 400, 403, 413, 415, 500, 200 con forma no válida | Alerta `userMessage(error)`; botones de nuevo activos | Sigue abierto con lo escrito; `error` = `userMessage(error)` (`role="alert"`) | Solo en avanzar | Sin recarga | Avanzar: la alerta. Diálogo: no se mueve (DD-06) |

- Al empezar una acción se limpia el mensaje de la página (`feedback.clear()`); cada `show` es un objeto nuevo, así que
  el mismo texto dos veces mueve el foco dos veces (comportamiento de HU-04).
- El foco al aviso o a la alerta tras cerrar un diálogo funciona porque, en el mismo *commit*, la limpieza del efecto de
  `ConfirmDialog` (foco al disparador) corre **antes** que el efecto de `usePipelineFeedback` (foco al mensaje). Se
  aserta con `expectFocusOn`.
- Si la recarga trae la oferta `closed` (EC-48), el tablero pierde las acciones y los diálogos dejan de pintarse.
- Salir de la pantalla aborta la petición en vuelo (`useLifetimeSignal`) y descarta su resultado.

### Detalle de la inscripción (`/applications/:id`)

```
ApplicationDetailScreen        (parseApplicationId(usePath()); null → props.notFound, sin petición; useDocumentTitle('Inscripción'))
└─ ApplicationLoader key=id    useResource(signal => getApplicationDetail(id, signal))
   ├─ loading → h1 «Inscripción» + LoadingMessage «Cargando la inscripción…»
   ├─ error 400/404 → props.notFound
   ├─ otro error → h1 + ErrorMessage(userMessage) + «Reintentar» (retry)
   └─ success → ApplicationDetails { detail }
```

| Estado | Qué se ve | Rol / nombre accesible |
|---|---|---|
| Cargando | «Cargando la inscripción…» | `status` |
| Error (red, 5xx, no JSON, forma no válida) | `userMessage(error)` + «Reintentar» (repite el `GET`) (CA-28, EC-44, EC-45) | `alert`; `button` «Reintentar» |
| No existe (ID no válido, 400, 404) | «Página no encontrada» + «Ir a las ofertas» (CA-27, EC-42) | `heading` «Página no encontrada» |
| Vacío | N/A — toda inscripción tiene al menos su cambio inicial (INV-08); un `history` vacío es respuesta no válida → error | — |
| Con datos | Ver abajo | — |

**`ApplicationDetails` (DT-04 de HU-04):**

- `h1` «Inscripción» (`tabIndex -1`), sin nombre.
- `<dl>`: «Candidato» → `<Link to={candidatePaths.detail(candidate.id)}>{fullName}</Link>`; «Oferta» →
  `<Link to={pipelinePath(job.id)}>{job.title}</Link>`; «Etapa actual» → `stageLabel(stage)`.
- `h2 id="history-title"` «Historial» y `<ol className="history" aria-labelledby="history-title">`, en el orden de la API
  (la web no reordena). Cada `<li>`:
  - `<p>{fromStage ? stageLabel(fromStage) : '—'} → {stageLabel(toStage)}</p>`
  - `<p>Fecha: <time dateTime={changedAt}>{formatDate(changedAt)}</time></p>` (`dd/mm/aaaa`, Europe/Madrid, sin hora)
  - si `reason`: `<p>Motivo: {rejectionReasonLabel(reason)}</p>` (incluye «Oferta cerrada»)
  - si `note`: `<p>Nota:</p><p className="pre-wrap long-text">{note}</p>` (texto JSX; los saltos de línea se ven)
- Sin email ni teléfono (la API no los da); `job.status` no se pinta.

### Panel «Inscribir candidato» (cambio mínimo, CA-36)

| Respuesta | Antes (HU-04) | Ahora |
|---|---|---|
| 409 `DUPLICATE` con `existingId` | Alerta «Este candidato ya está inscrito en la oferta.» sin enlace | La misma alerta (mismo texto exacto en el `<p role="alert">`) y, justo después, `<p><Link>Ver la inscripción</Link></p>` a `/applications/{existingId}` |
| 409 `DUPLICATE` sin `existingId` (EC-43) | Igual | Igual: sin enlace |

El resto del panel no cambia (foco a la alerta, recarga, texto y resultados intactos).

### Ficha de la oferta (`JobActions`)

| Estado | Controles, en orden |
|---|---|
| `draft` | `Editar`, `Publicar`, `Borrar`, `Duplicar` (sin cambios) |
| `published` | `Ver pipeline`, `Editar`, `Cerrar`, `Duplicar` (sin cambios) |
| `closed` | **`Ver pipeline`**, `Duplicar` (DT-08 b) |

## Migración de datos

N/A en la web — sin almacenamiento propio. Sin migración ni cambios en el seed (PRD, «Modelo de datos»); los e2e usan las
ofertas `closed` del seed (con rechazos `job_closed`) y crean el resto.

## Diagrama de secuencia

Rechazar con éxito, con conflicto y con la API caída; contratar con confirmación (RF-05, RF-06):

```mermaid
sequenceDiagram
  participant R as Reclutador
  participant W as Web
  participant A as API
  participant D as SQLite
  R->>W: Tarjeta en «Entrevista» → «Rechazar: Oriol Mas Puig»
  W-->>R: RejectDialog (foco en «Cancelar»), motivos sin marcar, nota 0/500 y aviso
  R->>W: «No encaja con el perfil» + nota → «Rechazar» (doble clic)
  W->>W: validateRejectForm OK; inFlight = true; diálogo busy (el 2.º clic no envía)
  W->>A: POST /api/applications/28/reject { expectedStage: interview, reason: not_a_fit, note }
  A->>D: BEGIN IMMEDIATE; guarda de etapa; UPDATE; INSERT StageChange; recalculateRetention; COMMIT
  A-->>W: 200 Application (6 campos, sin nota)
  W-->>R: Diálogo cerrado; «Inscripción rechazada.» (foco)
  W->>A: GET /api/jobs/7/applications (reload, sin «Cargando»)
  A-->>W: 200: tarjeta en «Rechazado» con «Motivo: No encaja con el perfil», sin nota
  alt Otra pestaña ya la movió
    A-->>W: 409 STAGE_MISMATCH
    W-->>R: Diálogo cerrado; alerta «La inscripción ha cambiado de etapa…» (foco); reload
  else API caída o 500
    A-->>W: error de red / 500
    W-->>R: Diálogo abierto con motivo y nota; error role=alert; sin reload
  end
  R->>W: Tarjeta en «Oferta» → «Avanzar a Contratado»
  W-->>R: HireDialog «¿Contratar a este candidato?» «No se puede deshacer.»
  R->>W: «Contratar»
  W->>A: POST /api/applications/27/advance { expectedStage: offer, toStage: hired }
  A-->>W: 200 Application
  W-->>R: «Inscripción avanzada a Contratado.» (foco); reload → tarjeta en «Contratado» sin acciones
```

## Error paths

EC de solo API: la web no los provoca (envía cuerpos exactos con etapas de los datos cargados e IDs validados) y los
prueba el backend; se listan para que estén todos.

| Edge case (PRD) | Dónde se detecta | Estrategia | Respuesta o efecto observable | Test |
|---|---|---|---|---|
| EC-01 | API (esquema) | La web envía exactamente `{ expectedStage, toStage }`; un 400 → alerta genérica | `userMessage`, sin recarga | `api.stage.test.ts` (cuerpo exacto) · `PipelineScreen.stage-adversarial.test.tsx` (400) |
| EC-02 | API / `applicationUrl` | Solo IDs válidos (`parseRouteId`); otro → `RangeError` sin petición | — | `api.stage.test.ts` |
| EC-03 | API | Solo API; la web lo recorre en e2e (4 avances) | Tarjeta en «Contratado» | Backend · `e2e/pipeline-stages.spec.ts` |
| EC-04 | API | La web nunca pide `received` ni `rejected` como destino (`nextStage`) | — | `labels.test.ts` (`nextStage`) · backend |
| EC-05 | API (transacción) | 500 → alerta, sin recarga | `userMessage` | Backend · `PipelineScreen.advance.test.tsx` (500) |
| EC-06 | API (etapa esperada) | 409 `STAGE_MISMATCH` → texto de DT-06 + `reload()` | Alerta con foco; pipeline actualizado | Backend · `PipelineScreen.advance.test.tsx` |
| EC-07 | — | Movido a HU-06 (DT-01) | — | — |
| EC-08 | API | La web no ofrece acciones en `closed` (ver EC-49) | — | Backend (CA-39) |
| EC-09 | API | La web no pinta el `message` de 404/409; un 403 → alerta genérica | Textos fijos sin datos | Backend · `PipelineScreen.stage-adversarial.test.tsx` (403) |
| EC-10 | API (RV-23) | Un 200 de reintento es éxito | «Inscripción avanzada a {etapa}.» | Backend · `PipelineScreen.stage-adversarial.test.tsx` |
| EC-11 | API (esquema) | La web solo envía uno de los 3 motivos y nunca `toStage` | — | `api.stage.test.ts` · backend |
| EC-12 | `validateRejectForm` + API | Mismas reglas de control que la API | NUL/U+0007 → error junto a la nota, sin petición; `\n`/`\t` → se envía | `reject-form.test.ts` · `PipelineScreen.reject.test.tsx` |
| EC-13 | `validateRejectForm` + API | Recorte y puntos de código | Ver EC-37 | `reject-form.test.ts` · backend |
| EC-14 | API | 500 → diálogo abierto con lo escrito | Ver EC-38 | Backend · `PipelineScreen.reject.test.tsx` |
| EC-15 | API | 409 `STAGE_MISMATCH` → como EC-39 | Ver EC-39 | Backend |
| EC-16 | API | 200 de reintento sobre un rechazo `job_closed` (no se da desde la web: no hay acciones en `closed`) | — | Backend |
| EC-17 | API + render JSX | La nota se envía tal cual (recortada) y solo se pinta en el detalle como texto | Ver EC-40 y EC-46 | Backend · `ApplicationDetailScreen.adversarial.test.tsx` |
| EC-18 | `use-stage-change.ts` + API | Una petición por envío (EC-41); si llegaran dos, la segunda es 200 | Éxito | Backend · `PipelineScreen.stage-adversarial.test.tsx` |
| EC-19 | API | La web nunca añade query; `/applications/abc` no pide | Ver EC-42 | Backend · `ApplicationDetailScreen.test.tsx` |
| EC-20 | API + `ApplicationDetails` | 1 y 5 cambios en orden; 404 → «Página no encontrada» | Lista de 1 y 5 `listitem` | `ApplicationDetailScreen.test.tsx` · backend |
| EC-21 | API | 500 → estado de error | Ver EC-44 | Backend · `ApplicationDetailScreen.test.tsx` |
| EC-22 | API + `ApplicationDetails` | `job_closed` con nota `null` → «Motivo: Oferta cerrada», sin «Nota» | Texto | `ApplicationDetailScreen.test.tsx` · e2e |
| EC-23 | API | La web no pide ni pinta email ni teléfono; si llegaran, no se pintan | Sin `@` en el DOM | Backend · `ApplicationDetailScreen.adversarial.test.tsx` |
| EC-24 a EC-30 | — | Movidos a HU-06 (DT-01) | — | — |
| EC-31 | `PipelineCard` + `nextStage` | Acciones solo en las 4 no finales; `offer` → «Avanzar a Contratado» con diálogo | 4 tarjetas con 2 botones; `hired`/`rejected` sin botones | `PipelineScreen.advance.test.tsx` |
| EC-32 | `use-stage-change.ts` | Red → alerta en la página, sin recarga; botones activos de nuevo | `alert` con `userMessage`; 1 solo `GET` del pipeline | `PipelineScreen.advance.test.tsx` |
| EC-33 | `classifyStageError` | 409 → texto de DT-06 + `reload()` | Alerta con foco; tarjeta en su columna real | `PipelineScreen.advance.test.tsx` |
| EC-34 | Render JSX | Nombre como texto en el enlace y en el sufijo oculto | Nombre accesible con el HTML literal; ningún `img` | `PipelineScreen.stage-adversarial.test.tsx` |
| EC-35 | Guarda `inFlight` + `disabled` | Una petición por clic; un 200 de reintento es éxito | 1 `POST` ante doble clic | `PipelineScreen.stage-adversarial.test.tsx` |
| EC-36 | `validateRejectForm` | Antes de pedir | Error junto al campo, foco en él, 0 `POST` | `PipelineScreen.reject.test.tsx` |
| EC-37 | `validateRejectForm` + contador | Recortado, puntos de código | 500 → se envía; 501 → error y «501/500»; 500 emojis → se envía; solo espacios → cuerpo sin `note` | `reject-form.test.ts` · `PipelineScreen.reject.test.tsx` |
| EC-38 | `use-stage-actions.ts` | Diálogo abierto, valores intactos, `error` con `role="alert"` | Motivo marcado y nota intacta; `alert` dentro del `dialog` | `PipelineScreen.reject.test.tsx` |
| EC-39 | `classifyStageError` | Diálogo cerrado + alerta + `reload()` | Alerta con foco; tarjeta en su columna real | `PipelineScreen.reject.test.tsx` |
| EC-40 | Diseño (DD-05) | La nota solo vive en el estado del diálogo | URL, `document.title`, `history.state`, `localStorage` y `sessionStorage` sin la nota ni el nombre; la tarjeta no la pinta | `PipelineScreen.stage-adversarial.test.tsx` · e2e |
| EC-41 | Guarda `inFlight` + `busy` | Una petición por envío | 1 `POST` ante doble clic en «Rechazar» | `PipelineScreen.stage-adversarial.test.tsx` |
| EC-42 | `parseApplicationId` | Sin petición | «Página no encontrada»; 0 llamadas | `ApplicationDetailScreen.test.tsx` · `App.test.tsx` |
| EC-43 | `formatDate` · `ApplicationDetails` · `EnrollPanel` | Europe/Madrid; «—» como origen; sin `existingId` no hay enlace | `2026-12-31T23:30:00.000Z` → «01/01/2027»; «— → Recibida»; alerta sin `link` | `ApplicationDetailScreen.test.tsx` · `PipelineScreen.links.test.tsx` |
| EC-44 | `requestJson` | Red o no JSON → error | Mensaje útil + «Reintentar» que repite el `GET` | `ApplicationDetailScreen.test.tsx` |
| EC-45 | `isApplicationDetail` | Etapa o motivo desconocidos, `history` vacío, `id` distinto → `badResponseError` | Error con «Reintentar» | `ApplicationDetailScreen.test.tsx` · `api.stage.test.ts` |
| EC-46 | Render JSX + título constante | Texto, nunca HTML | `<img src=x onerror=alert(1)>` literal en nombre y nota; ningún `img`; título «Inscripción · ATS» | `ApplicationDetailScreen.adversarial.test.tsx` |
| EC-47 | `PipelineContent` | `closed` vacía → mensaje de vacío, sin botón | Sin `button` | `PipelineScreen.states.test.tsx:79` (existente) · `PipelineScreen.links.test.tsx` |
| EC-48 | `reload()` + `actions` por estado | La recarga que trae `closed` quita acciones y diálogos | 0 botones de tarjeta tras la recarga | `PipelineScreen.stage-adversarial.test.tsx` |
| EC-49 | `PipelineContent` (`actions={null}` si no `published`) | Acciones por estado de la oferta | Tarjeta `interview` de una `closed` sin «Avanzar» ni «Rechazar» | `PipelineScreen.links.test.tsx` |
| EC-50 | Ruta + `useDocumentTitle` | Solo el ID de la oferta en la URL; título genérico | `/jobs/{id}/pipeline`, «Pipeline de la oferta · ATS» | `e2e/pipeline-stages.spec.ts` |

## Threat modeling

DEC-04: sin login; la superficie es el navegador del reclutador.

| STRIDE | Amenaza concreta | Mitigación | Riesgo residual |
|---|---|---|---|
| Suplantación | Otra web lanza `advance` o `reject` con el navegador del reclutador | DEC-12 en la API (`Sec-Fetch-Site`); la web va `same-origin` | DNS rebinding (deuda SEC-06) |
| Manipulación | Nombre o nota con HTML/*script* en tarjeta, nombre accesible o detalle | Solo texto JSX; 0 `dangerouslySetInnerHTML` en `features/applications/` (RNF-07) | Bajo |
| Manipulación | Avanzar con una etapa esperada vieja (otra pestaña) | `expectedStage` sale de la tarjeta cargada; 409 + recarga (DEC-08) | Bajo |
| Repudio | — | N/A — un único rol sin identidad (DEC-04); el `StageChange` registra el cuándo | — |
| Exposición de datos | Nota o nombre en URL, título, `history.state`, almacenamiento o consola | Rutas solo con IDs, títulos constantes, nota solo en el estado del diálogo (DD-05), `autoComplete="off"`, sin `console.*` | Bajo: nombre y nota están en el DOM mientras la pantalla está abierta |
| Exposición de datos | La nota en el pipeline o en el aviso | La web no la pinta fuera del detalle; los avisos son textos fijos sin datos | Bajo |
| Denegación de servicio | Doble clic o ráfagas de acciones | Una acción de etapa a la vez (DD-01); sin reintentos automáticos | Bajo (local) |
| Elevación de privilegios | Acciones en una oferta `closed` forzadas por la UI | N/A en la web (un rol, DEC-04); la UI no las ofrece y la API no comprueba el estado (DT-09, la revisa HU-06) | Aceptado hasta HU-06 |

## Datos personales

- **Qué lee la web:** en el pipeline, el **nombre** (sin cambios); en el detalle, **nombre**, título de la oferta,
  historial y la **nota de rechazo** (RGPD §1; RV-20). Nunca email ni teléfono.
- **Qué escribe:** etapa esperada y destino (avanzar); motivo y nota opcional (rechazar). Nada más.
- **Dónde vive:** en el estado de React del recurso y del diálogo; la nota se descarta al cancelar, cerrar con éxito o
  conflicto, salir de la pantalla o recargar. Sin almacén de módulo, sin `history.state` (los `Link` hacen `pushState`
  con `null`) y sin `localStorage`/`sessionStorage`.
- **Minimización:** la nota tiene el aviso de DT-05 junto al campo, es opcional y ≤ 500; solo se muestra en el detalle
  (RGPD §6.2, RNF-05).
- **Qué NO aparece:** nombre ni nota en la URL, `document.title`, `history.state`, el almacenamiento, la consola ni los
  mensajes que construye la web (RNF-06). Los avisos y alertas de DT-06 no llevan nombre ni etapa del candidato más allá
  de la etiqueta de la etapa.
- **Retención:** la recalcula el backend al pasar a `hired` o `rejected`; la web no la pinta en estas pantallas.
- **Datos de prueba:** inventados, `@example.com`; notas no sensibles («Prefiere jornada parcial.»); en el e2e,
  candidatos con *token* único y sin teléfono.

## Decisiones de diseño

### DD-01: Una acción de etapa a la vez en toda la pantalla
- **Contexto:** RF-05 pide una petición por clic; EC-35, EC-41.
- **Opciones consideradas:** A) guarda por tarjeta (varias tarjetas en vuelo a la vez); B) `use-stage-change.ts` con
  `pendingId` y guarda `inFlight` por `ref` (patrón de `use-enrollment.ts`): todos los botones de tarjeta `disabled`
  mientras vuela una acción.
- **Elegida:** B.
- **Razón:** un solo resultado que mostrar y una sola recarga; el segundo clic no envía aunque llegue antes del render.
- **Tradeoff:** no se pueden encadenar acciones en dos tarjetas sin esperar la respuesta de la primera (< 500 ms, RNF-01).

### DD-02: Un `HireDialog` y un `RejectDialog` por pantalla, no uno por tarjeta
- **Contexto:** con 200 tarjetas, un `<dialog>` por tarjeta son 400 nodos ocultos.
- **Opciones consideradas:** A) diálogo dentro de cada tarjeta; B) estado `dialog: none | hire | reject` con la tarjeta
  objetivo en `use-stage-actions.ts` y los dos diálogos en `PipelineContent`.
- **Elegida:** B.
- **Razón:** menos DOM; `ConfirmDialog` guarda el disparador al abrir (`document.activeElement`), así que el foco vuelve a
  la tarjeta correcta igual.
- **Tradeoff:** el estado del formulario vive en el contenedor y el diálogo no sabe «de quién» es (no nombra al
  candidato, como el de cerrar oferta).

### DD-03: Rechazo sobre `ConfirmDialog` con `description` opcional
- **Contexto:** DT-05 pide `<dialog>` modal «como `ConfirmDialog`»; el aviso va junto a la nota (CA-13), no arriba.
- **Opciones consideradas:** A) componente de diálogo nuevo con formulario `submit`; B) `ConfirmDialog` con `children`
  (radios y nota), el aviso como `help` del campo y `description` opcional en lo compartido; C) usar el aviso como
  `description`.
- **Elegida:** B.
- **Razón:** reutiliza trampa de foco, `Escape`, foco inicial, vuelta del foco, `busy` y `error`; el cambio compartido
  es una prop opcional con un test; C dejaría el aviso lejos del campo.
- **Tradeoff:** «Rechazar» es `type="button"`: Enter no envía el formulario (en el `textarea` es salto de línea).

### DD-04: Nombre accesible de las acciones con sufijo oculto
- **Contexto:** RNF-08 pide nombres distintos por tarjeta, sin el nombre en URL ni título; WCAG 2.5.3.
- **Opciones consideradas:** A) `aria-describedby` al nombre (patrón de DD-11 de HU-04; el nombre accesible no cambia);
  B) `aria-label` «Avanzar a Entrevista a {nombre}»; C) texto visible + `<span className="visually-hidden">: {nombre}</span>`.
- **Elegida:** C.
- **Razón:** nombre distinto que empieza por el texto visible (2.5.3), sin duplicar el texto en un atributo; la clase
  `.visually-hidden` ya existe en `apps/web/src/styles.css`.
- **Tradeoff:** los tests y los e2e seleccionan con el nombre completo («Rechazar: Oriol Mas Puig»).

### DD-05: Textos de resultado en la web, por `code`
- **Contexto:** DT-06 fija los textos; DEC-07 fija los `code`.
- **Opciones consideradas:** A) el `message` de la API; B) `classifyStageError` con los tres textos fijos y
  `userMessage` para el resto.
- **Elegida:** B (como `enroll-errors.ts`, DD-05 de HU-04).
- **Razón:** textos de producto estables, sin datos del candidato; los 409/404 se distinguen sin leer el `message`.
- **Tradeoff:** si el backend cambia un `code`, cae en «otro error» (alerta genérica sin recarga).

### DD-06: Los fallos genéricos dejan el diálogo abierto y no mueven el foco
- **Contexto:** RF-06 pide diálogo abierto con lo escrito ante red o 500; DT-04 no dice nada de los fallos al contratar.
- **Opciones consideradas:** A) cerrar el diálogo y alertar en la página; B) diálogo abierto con `error` (`role="alert"`),
  como `CloseJobAction`, también en «Contratar».
- **Elegida:** B.
- **Razón:** no se pierde lo escrito; mismo comportamiento en los dos diálogos y en el de cerrar oferta.
- **Tradeoff:** `ConfirmDialog` no expone `ref` del error: el foco no se mueve al mensaje (lo anuncia `role="alert"`).

### DD-07: El contador cuenta lo que se valida
- **Contexto:** la regla es «≤ 500 puntos de código tras recortar» (DEC-11.3).
- **Opciones consideradas:** A) contar el texto bruto; B) `noteLength` = `Array.from(note.trim()).length`.
- **Elegida:** B.
- **Razón:** el contador y el error nunca se contradicen (EC-37: «501/500» con el error).
- **Tradeoff:** los espacios al principio o al final no suman mientras se escribe.

### DD-08: Enlaces del detalle sin props nuevas
- **Contexto:** el detalle enlaza a la ficha del candidato y al pipeline; DD-01 de HU-04.
- **Opciones consideradas:** A) `candidatePath` y `pipelinePath` por props desde `App.tsx`; B) `candidatePaths` de
  `apps/web/src/features/candidates/paths.ts` (dirección permitida `applications → candidates`) y `pipelinePath` propio;
  solo `notFound` por prop.
- **Elegida:** B.
- **Razón:** respeta la dirección de dependencias sin props que no aportan nada; `paths.ts` es API pública de la
  feature.
- **Tradeoff:** `applications` conoce la forma de la URL de la ficha del candidato (como ya conoce su cliente).

### DD-09: Contrato del detalle validado en la web
- **Contexto:** EC-45 pide error ante etapa o motivo desconocidos.
- **Opciones consideradas:** A) confiar en la API; B) `isApplicationDetail` (como `isPipeline`): `id` pedido, etapas y
  motivos conocidos, `history` no vacío, `reason` no nulo si y solo si `toStage === 'rejected'`, `note` texto o nulo.
- **Elegida:** B.
- **Razón:** un dato imposible no se pinta como si fuera válido; misma pieza que el pipeline.
- **Tradeoff:** un campo nuevo legítimo de la API no rompe (no se exige `additionalProperties`), pero uno renombrado sí.

### DD-10: «Ver la inscripción» fuera del párrafo de la alerta
- **Contexto:** CA-36; los tests de HU-04 asertan el texto exacto de la alerta del 409.
- **Opciones consideradas:** A) enlace dentro del `<p role="alert">`; B) `<p>` con el enlace justo después, como
  «Ver el candidato existente» de `CandidateForm.tsx`.
- **Elegida:** B.
- **Razón:** el lector anuncia el texto sin el enlace y el siguiente *Tab* desde la alerta enfocada llega al enlace;
  los asertos de HU-04 siguen valiendo.
- **Tradeoff:** el enlace no forma parte del anuncio de la alerta.

### DD-11: *Helpers* de e2e compartidos
- **Contexto:** `e2e/pipeline-stages.spec.ts` necesita crear oferta, candidato e inscripción como
  `e2e/applications.spec.ts`, que además cambia (CA-36).
- **Opciones consideradas:** A) copiar los *helpers*; B) moverlos a `e2e/support/applications.ts`.
- **Elegida:** B.
- **Razón:** una sola versión de las altas por API con *token* único.
- **Tradeoff:** toca un spec que ya pasa; se mitiga ejecutando los dos ficheros en la misma tarea.

## Impacto en decisiones

- **DEC-01:** React 19 + Vite, TypeScript estricto, Vitest y Playwright; sin librerías nuevas.
- **DEC-04:** sin permisos; las acciones se ocultan por **estado de la oferta y etapa**, no por rol.
- **DEC-06:** se mantiene por analogía en la web (DD-01 de HU-04, DD-08): `jobs → applications → candidates`.
- **DEC-07:** la web distingue `STAGE_MISMATCH`, `INVALID_TRANSITION` y `NOT_FOUND` por `code` (DD-05).
- **DEC-08:** etapa esperada de la tarjeta; un 200 de reintento es éxito; una petición por clic (DD-01).
- **DEC-09:** `formatDate` (Europe/Madrid, `dd/mm/aaaa`) en el historial.
- **DEC-11:** la validación de la nota replica 11.3 y 11.8 en el cliente (`reject-form.ts`).
- **DEC-12:** sin cambios en la web.
- No se propone `DEC-NN` nueva.

## Estrategia de tests

Vitest + Testing Library (jsdom) en `apps/web/test/`: consultas por rol y *label*; `mockFetch`
(`apps/web/test/helpers/fetch.ts`, `hang` para «en curso»); `installDialogPolyfill` y `simulateCancel`
(`apps/web/test/helpers/dialog.ts`) para los diálogos; **todo foco movido por un efecto se aserta con `expectFocusOn`**
(`apps/web/test/helpers/focus.ts`): aviso y alertas de la página, vuelta del foco a «Rechazar»/«Avanzar a Contratado» y
foco inicial en «Cancelar». Solo se simula la red; datos inventados. Cada fichero ≤ 300 líneas **tras Prettier**;
`JobDetailScreen.actions.test.tsx` no se toca.

| RF | Vitest (fichero → qué) | Playwright |
|---|---|---|
| RF-05 | `PipelineScreen.advance.test.tsx` → acciones por etapa y nombres accesibles distintos (CA-22, EC-31); «Avanzar a Entrevista» → cuerpo `{"expectedStage":"screening","toStage":"interview"}`, aviso con foco y tarjeta en «Entrevista» tras la recarga (CA-02); «Avanzar a Contratado» → diálogo con foco en «Cancelar»; «Cancelar» y `Escape` → 0 `POST` y foco de vuelta; «Contratar» → tarjeta en «Contratado» (CA-40); 409 ×2 y 404 → textos, foco y recarga (EC-33); red y 500 → alerta sin recarga y botones activos (EC-32, EC-05) | `pipeline-stages.spec.ts`: avanzar de `received` a `hired` con confirmación y cancelación reales (CA-02, CA-40, EC-03) |
| RF-06 | `PipelineScreen.reject.test.tsx` → diálogo «Rechazar la inscripción» con `group` «Motivo», 3 `radio` sin marcar, `textbox` «Nota (opcional)» con el aviso y «0/500» en su descripción, foco en «Cancelar» (CA-13); sin motivo, 501, control → error junto al campo y 0 `POST`; 500 y 500 emojis se envían; solo espacios → cuerpo sin `note`; `\n` y `\t` se envían (EC-36, EC-37, EC-12); éxito → aviso con foco, tarjeta en «Rechazado» con «Motivo: No encaja con el perfil» y sin la nota (CA-13); «Cancelar»/`Escape` descartan y devuelven el foco a «Rechazar» (RNF-08); red/500 → abierto con lo escrito y `alert` (EC-38); 409 → cerrado, alerta y recarga (EC-39); 400 con `details` de `note` → junto al campo | `pipeline-stages.spec.ts`: rechazar con motivo y nota de dos líneas (CA-13) |
| RF-07 | `ApplicationDetailScreen.test.tsx` → cargando; cabecera con `link` al candidato (`/candidates/40`) y a la oferta (`/jobs/7/pipeline`); «Etapa actual: Entrevista» y 3 `listitem` en orden con «dd/mm/aaaa» (CA-24); recién creada «— → Recibida» (CA-25); rechazo con motivo y nota multilínea; `job_closed` sin «Nota» (CA-26); 404 y 400 → «Página no encontrada» (CA-27); `/applications/abc` sin petición (EC-42); red → «Reintentar» que repite el `GET` (CA-28, EC-44); forma no válida (EC-45); 23:30Z del 31/12 → 01/01 (EC-43); 5 cambios (EC-20); título constante. `PipelineScreen.links.test.tsx` → nombre de cada tarjeta `link` a `/applications/{id}` en `published` y `closed` (CA-22); 409 `DUPLICATE` con `existingId` → «Ver la inscripción» a `/applications/91` (CA-36); sin `existingId`, sin enlace (EC-43). `App.test.tsx` → ruta, título y foco | `pipeline-stages.spec.ts`: tarjeta → detalle con el rechazo, su motivo y su nota (CA-24, CA-26); `/applications/999999999` → «Página no encontrada» (CA-27). `applications.spec.ts`: duplicado → «Ver la inscripción» → detalle (CA-36) |
| RF-08 | `PipelineScreen.links.test.tsx` → `closed` con una tarjeta en `interview`: sin «Avanzar», «Rechazar» ni «Inscribir candidato», con nombres enlazados (CA-23, EC-49). `JobDetailScreen.closed.test.tsx` → `['Ver pipeline', 'Duplicar']` con `href="/jobs/7/pipeline"` | `pipeline-stages.spec.ts`: oferta `closed` del seed (`GET /api/jobs?status=closed`) → «Ver pipeline» → solo lectura → detalle de un rechazo «Oferta cerrada» sin nota (CA-23, CA-26, EC-50) |
| RF-09 (web) | Umbrales: ningún fichero de `apps/web/` > 300 líneas tras Prettier; tests nuevos de la ficha en el hermano | — |
| `[adversarial]` | `PipelineScreen.stage-adversarial.test.tsx` → nombre `<img src=x onerror=alert(1)>` en el enlace y los nombres accesibles, ningún `img` (EC-34); doble clic en «Avanzar» y en «Rechazar» del diálogo = 1 `POST` (EC-35, EC-41); 200 de reintento = éxito (EC-10); 400, 403 y 200 con forma inesperada → alerta, sin recarga (EC-01, EC-09); nota con email inventado y HTML: ni URL, ni `document.title`, ni `history.state`, ni `localStorage`/`sessionStorage`, ni la tarjeta tras recargar (EC-40, RNF-06); recarga que trae `closed` → sin acciones ni diálogos (EC-48); salir de la pantalla con la petición en vuelo → sin aviso ni error. `ApplicationDetailScreen.adversarial.test.tsx` → nombre y nota con HTML como texto, ningún `img`, título «Inscripción · ATS» (EC-46, RNF-07); campos `email`/`phone` de más no se pintan (EC-23); `note` en un cambio no final o `reason` en uno no rechazado → error (EC-45) | `pipeline-stages.spec.ts`: la nota no está en la URL, el título ni `history.state` (EC-40) |

**Piezas compartidas:** `api.stage.test.ts`, `labels.test.ts` (`nextStage`), `reject-form.test.ts` (límites 500/501,
emojis, controles, espacios), `ConfirmDialog.test.tsx` (`description` opcional).

**De API pura** (backend con `fastify.inject`): CA-01, CA-03 a CA-12, CA-14 a CA-21, CA-37 a CA-39; RNF-01 a RNF-05.

**Criterio → test (parte web):**

| CA | Test |
|---|---|
| CA-02 | `PipelineScreen.advance.test.tsx` + `e2e/pipeline-stages.spec.ts` |
| CA-13 | `PipelineScreen.reject.test.tsx` + `e2e/pipeline-stages.spec.ts` |
| CA-22 | `PipelineScreen.advance.test.tsx` (acciones) + `PipelineScreen.links.test.tsx` (enlaces) |
| CA-23 | `PipelineScreen.links.test.tsx` + `JobDetailScreen.closed.test.tsx` + `e2e/pipeline-stages.spec.ts` |
| CA-24 | `ApplicationDetailScreen.test.tsx` + `e2e/pipeline-stages.spec.ts` |
| CA-25 | `ApplicationDetailScreen.test.tsx` |
| CA-26 | `ApplicationDetailScreen.test.tsx` + `e2e/pipeline-stages.spec.ts` |
| CA-27 | `ApplicationDetailScreen.test.tsx` + `App.test.tsx` + `e2e/pipeline-stages.spec.ts` |
| CA-28 | `ApplicationDetailScreen.test.tsx` |
| CA-36 | `PipelineScreen.links.test.tsx` + `e2e/applications.spec.ts` |
| CA-38 (web) | Revisión de umbrales en la review (líneas tras Prettier) |
| CA-40 | `PipelineScreen.advance.test.tsx` + `e2e/pipeline-stages.spec.ts` |
| RNF-06 | `PipelineScreen.stage-adversarial.test.tsx` + `e2e/pipeline-stages.spec.ts` |
| RNF-07 | `PipelineScreen.stage-adversarial.test.tsx` + `ApplicationDetailScreen.adversarial.test.tsx` |
| RNF-08 | `PipelineScreen.reject.test.tsx` (labels, `legend`, foco al cancelar) + `PipelineScreen.advance.test.tsx` (nombres distintos, foco al aviso) + `ApplicationDetailScreen.test.tsx` (`ol`) |

**e2e (`e2e/pipeline-stages.spec.ts`):** prepara por API (`page.request`) su oferta publicada, su candidato y su
inscripción con *token* único (`e2e/support/applications.ts`); la `closed` se busca con `GET /api/jobs?status=closed`,
sin IDs fijos; **ningún e2e cierra ofertas con inscripciones** (DT-10 de HU-04, hasta HU-06). El `tsconfig` raíz que
incluye `e2e/` no tiene `dom`: URL con `page.url()`, título con `page.title()`, `history.state` con `page.evaluate` y el
*cast* mínimo de `globalThis` de `e2e/applications.spec.ts`; nada de `window`/`document` tipados.

## Checklist de implementación

Orden: tipos y cliente → presentacionales → contenedor → tests. Base para `/task-planner`: **7 tareas web** (5 + 1
`[adversarial]` + 1 `[e2e]`).

1. **W1 `[setup]` Contrato y piezas puras** (M, ~2,5 h): `types.ts`, `paths.ts`, `labels.ts` (`nextStage`), `api.ts`
   (avanzar, rechazar, detalle), `stage-errors.ts`, `reject-form.ts`; `ConfirmDialog.tsx` (`description` opcional) +
   `api.stage.test.ts`, `labels.test.ts`, `reject-form.test.ts`, `ConfirmDialog.test.tsx`, `stage-fixtures.ts`.
   S1-S8 ya cruzados.
2. **W2 Detalle de la inscripción** (M, ~2 h): `ApplicationDetails.tsx`, `ApplicationDetailScreen.tsx`, ruta en
   `App.tsx`, estilos `.history` + `ApplicationDetailScreen.test.tsx`, `App.test.tsx`.
3. **W3 Enlaces y oferta cerrada** (M, ~2 h): nombre enlazado en `PipelineBoard.tsx`; `existingId` en
   `use-enrollment.ts`, `use-enroll-panel.ts` y `EnrollPanel.tsx`; «Ver pipeline» en `closed` (`JobActions.tsx`) +
   `PipelineScreen.links.test.tsx`, `JobDetailScreen.closed.test.tsx`, asertos de `PipelineScreen.test.tsx` y
   `JobDetailScreen.states.test.tsx`.
4. **W4 Avanzar y contratar** (L, ~3,5 h): `use-stage-change.ts`, parte de avanzar de `use-stage-actions.ts`,
   `CardActionButtons` en `PipelineBoard.tsx`, `HireDialog` en `StageDialogs.tsx`, conexión en `PipelineScreen.tsx`,
   `.card-actions` + `PipelineScreen.advance.test.tsx`.
5. **W5 Rechazar** (L, ~3 h): `RejectDialog`, `ReasonFieldset` y `NoteField` en `StageDialogs.tsx`; formulario y
   resultados en `use-stage-actions.ts` + `PipelineScreen.reject.test.tsx`.
6. **W6 `[adversarial]` Pipeline y detalle frente a hostiles y fallos** (M, ~2,5 h; cubre RF-05 a RF-08):
   `PipelineScreen.stage-adversarial.test.tsx`, `ApplicationDetailScreen.adversarial.test.tsx` y los arreglos que
   destapen.
7. **W7 `[e2e]` Recorridos de etapas, detalle y cerrada** (L, ~3 h): `e2e/support/applications.ts`,
   `e2e/pipeline-stages.spec.ts`, cambios en `e2e/applications.spec.ts` (CA-36) y `e2e/jobs-lifecycle.spec.ts`
   (160, 246). Depende de todas las tareas de API.

## Riesgos

| Riesgo | Probabilidad (1–5) | Impacto (1–5) | Mitigación |
|---|---|---|---|
| Techo de 15 tareas: web = 7 (5 + 1 `[adversarial]` + 1 `[e2e]`) + backend = 7 (B-01..B-07, 5 + 2 `[adversarial]`) = **14**; queda 1 de margen | 3 | 4 | Si hiciera falta otra, fusionar W2 y W3 en una L de ~4 h («Detalle y enlaces») → 6 web, o B-01 con B-02 (TD-backend); no hay piezas especulativas que quitar |
| El contrato cambia tras este cruce (S1-S8) | 2 | 2 | Los cambios se quedan en `types.ts`, `api.ts` y `stage-errors.ts` |
| Los botones nuevos de las tarjetas rompen asertos de HU-04 (`card.textContent` exacto) | 4 | 2 | Listados en «Módulos y ficheros» (`PipelineScreen.test.tsx` 59-79 y 133-147); el primer `<p>` sigue siendo el nombre |
| Foco tras cerrar un diálogo (orden de efectos `ConfirmDialog` → `usePipelineFeedback`) intermitente | 2 | 3 | `expectFocusOn` en todos los asertos; si fallara, mover el foco al mensaje en un `useLayoutEffect` (DD-10 de HU-04) |
| `ConfirmDialog` es compartido (cerrar y borrar oferta) | 2 | 3 | Solo `description` opcional; suites de `jobs` en verde |
| e2e sobre la base compartida: contratar cambia la retención del candidato | 2 | 2 | Candidato y oferta propios con *token*; la `closed` del seed solo se lee |
| `PipelineScreen.tsx` crece hacia ~195 líneas y `PipelineLoader` hacia el umbral de 50 | 2 | 2 | La lógica de etapas vive en `use-stage-actions.ts`; el contenedor solo conecta |

## Open Decisions

No hay decisiones abiertas. S1-S8 están cruzados con `plans/TECHNICAL_DOC-backend.md` (2026-10-07) sin ajustes. La
OD-01 del TD-backend (EC-03 con `Number.MAX_SAFE_INTEGER`) no afecta a la web: `parseRouteId` ya rechaza 16 dígitos sin
petición, con el mismo patrón que la API.

## Fuera de scope

- Avanzar o rechazar desde el detalle de la inscripción (los disparadores son las tarjetas, PRD «Fuera de scope»).
- Retroceder, deshacer, editar motivo o nota, notas en los avances (RV-19, RV-21).
- Aviso tras cerrar una oferta con inscripciones y rechazo `job_closed` real (HU-06, DT-01, DT-10).
- «Candidato anonimizado» en tarjeta y detalle, y vaciar la nota al anonimizar (feature A, S-05, RGPD §7).
- Paginar el pipeline o el historial (S-18).
- Marcar a los ya inscritos en el buscador o inscribir desde la ficha del candidato (S-19).
