# HU-04 — Inscribir en una oferta publicada, sin duplicados — Diseño técnico (frontend)

- **Origen:** `specs/PRD.md` (estado Ready, 2026-10-06; DT-01 a DT-11)
- **Generado por:** frontend-architect
- **Scope cubierto:** RF-07, RF-08 y la parte web de RF-10; RNF-05, RNF-06 y RNF-07. RF-01 a RF-05, RF-11 y RF-12 son
  solo backend: aquí solo se consumen (contrato) o se usan en los e2e (seed).

## Enfoque técnico

Nace `apps/web/src/features/applications/` (nueva) con el patrón de `jobs` y `candidates` (contenedor →
presentacionales, cliente `api.ts` sobre `requestJson`, `useResource`, `FormField`, `StatusMessages`), **sin
dependencias nuevas**. Una sola pantalla, el **pipeline** (`/jobs/:id/pipeline`, DT-01), con un **panel en línea** (no
modal, DT-02) para buscar e inscribir candidatos. La ficha de la oferta gana el enlace «Ver pipeline» en una
`published`.

- **Pipeline:** `GET /api/jobs/:jobId/applications` → la web agrupa los elementos por etapa **conservando el orden de
  la API** (DD-08) y pinta 6 columnas (`section` con `h2`); cada tarjeta, nombre como texto **sin enlace** (DT-01), fecha
  `formatDate` y, en «Rechazado», la etiqueta del motivo. Por estado de la oferta (DT-03): `draft` → solo el mensaje de
  borrador; `published` → columnas (o vacío) y «Inscribir candidato»; `closed` → columnas (o vacío) sin la acción.
- **Buscador:** reutiliza `listCandidates` de `apps/web/src/features/candidates/api.ts` con `pageSize: 10`
  (`GET /api/candidates?q=…&pageSize=10`, sin endpoint nuevo); «Hay más resultados…» si `total > 10`. La búsqueda vive
  **solo en el estado del panel**: ni URL, ni título, ni `history.state`, ni almacenamiento; se descarta al cerrar el
  panel o salir de la pantalla (DD-03, DT-10 de HU-03).
- **Inscribir:** `POST /api/applications { jobId, candidateId }`, una petición por clic (guarda por `ref` + botones
  deshabilitados, DD-06). Éxito → aviso «Candidato inscrito.» con el foco, panel cerrado y **recarga silenciosa** del
  pipeline (`useResource.reload()`, nuevo, DD-04). Los dos 409 se distinguen por `code` con los textos fijos del PRD
  (DD-05).
- **Dirección de dependencias entre features = DEC-06** (`jobs → applications → candidates`): `jobs` importa la ruta del
  pipeline de `applications/paths.ts`; `applications` importa solo el cliente público de `candidates`; lo que el
  pipeline necesita de `jobs` (enlace a la ficha y la pantalla «Página no encontrada») se lo pasa `App.tsx` por props
  (DD-01).
- **UC-12 · A1:** sin cambios de código. `CandidateDetails.tsx` ya pinta «Mientras dure el proceso» con
  `retentionEndsAt: null` (test `apps/web/test/features/candidates/CandidateDetailScreen.test.tsx:183`); lo que faltaba
  era el dato real, que da el backend, y se cierra con el recorrido e2e.

**Alternativa principal descartada:** el buscador en un `ConfirmDialog`/`<dialog>` modal. Daba la trampa de foco hecha,
pero DT-02 pide un panel en la propia pantalla, y un modal tapa el pipeline donde aparece la tarjeta nueva.

## Dependencias

- **Contrato de API:** lo fija la sección «Contrato de API» de `plans/TECHNICAL_DOC-backend.md`, y la web lo consume
  tal cual. Este documento se diseñó contra el PRD (Interfaces, RF-01, RF-05, DT-07) con los supuestos S1-S6, que se
  **cruzaron con el TD-backend el 2026-10-07** (manda el backend). Si cambia, solo se tocan
  `apps/web/src/features/applications/types.ts`, `api.ts` y `labels.ts`.

| # | Elemento | Supuesto de la web | Estado |
|---|---|---|---|
| S1 | `GET /api/jobs/:jobId/applications` (RF-05) | 200 `Pipeline` = `{ job: { id, status }, items: PipelineItem[] }`; `status` ∈ `draft`, `published`, `closed`; cada elemento **exactamente** `{ id, candidateName, stage, lastChangeAt, rejectionReason }` (5 campos, RNF-04), `rejectionReason` no nulo si y solo si `stage === 'rejected'`; lista plana ordenada por `lastChangeAt` DESC e `id` DESC (así, al agrupar conservando el orden, cada columna queda ordenada); sin inscripciones, `items: []`. 400 · 404 `NOT_FOUND` · 500 | **Cruzado con el TD-backend** (la clave es `items`, no `applications`) |
| S2 | `POST /api/applications` (RF-01) | Cuerpo `{ jobId, candidateId }` (enteros JSON de 1 a `MAX_SAFE_INTEGER`). 201 `Application` con exactamente `id`, `jobId`, `candidateId`, `stage` (`received`), `createdAt` y `lastChangeAt`; la web comprueba los 6 y no usa más que el éxito | **Cruzado con el TD-backend** |
| S3 | Errores del `POST` | 409 `INVALID_TRANSITION` con el `message` del backend («La oferta no está publicada: no admite inscripciones.»; la web pinta su texto fijo de DT-02, DD-05) · 409 `DUPLICATE` con `details: [{ field: 'candidateId', message, existingId }]` · 404 `NOT_FOUND` («La oferta no existe.» / «El candidato no existe.») · 400 `VALIDATION_ERROR` · 403 `CROSS_SITE_REQUEST` · 413 · 415 · 500 `INTERNAL_ERROR` | **Cruzado con el TD-backend** |
| S4 | Códigos de etapa | `received`, `screening`, `interview`, `offer`, `hired`, `rejected` (RF-02) | **Cruzado con el TD-backend** |
| S5 | Códigos de motivo | `not_a_fit`, `candidate_withdrew`, `other`, `job_closed` → «No encaja con el perfil», «Retirada del candidato», «Otro», «Oferta cerrada» (DT-07 g) | **Cruzado con el TD-backend** |
| S6 | `GET /api/candidates?q=&pageSize=10` | Sin cambios (HU-03): `{ items, total, page, pageSize }`, elemento de 4 campos; `q` ≤ 100 sin controles; `pageSize` 1-100 | Casa (`docs/05_modules/candidatos/technical.md`) |

- **DEC-12:** la web va por el *proxy* de Vite (`same-origin`); un 403 inesperado se muestra como cualquier error con
  envelope.
- **Los e2e dependen del backend completo** (rutas, migración `003`, seed de DT-05 y puerto de procesos real); los
  tests de Vitest, no (simulan `fetch`).

## Módulos y ficheros afectados

Líneas: estimación tras el cambio (umbral ≤ 300 por fichero, ≤ 50 por función, complejidad ≤ 10).

| Módulo | Fichero | Cambio |
|---|---|---|
| transversal | `apps/web/src/components/use-resource.ts` | modificar (~70): `reload()` vuelve a pedir **sin** pasar por `loading` (los datos siguen hasta que llega la respuesta; un error pasa a `error`), DD-04 |
| transversal | `apps/web/src/components/StatusMessages.tsx` | modificar (~35): `Notice` acepta `ref` opcional (prop de React 19) y, si lo recibe, `tabIndex={-1}` para poder enfocarlo |
| transversal | `apps/web/src/App.tsx` | modificar (~125): ruta `{ pattern: PIPELINE_ROUTE, title: 'Pipeline de la oferta', element: <PipelineScreen jobPath={jobPaths.detail} notFound={<NotFoundScreen />} /> }` tras `/jobs/:id/edit` (el orden no importa: `matchPath` compara segmentos) |
| transversal | `apps/web/src/styles.css` | modificar (~190): `.pipeline` (rejilla de 6 columnas con `overflow-x: auto`), `.pipeline-card`, `.enroll-panel` |
| jobs | `apps/web/src/features/jobs/JobActions.tsx` | modificar (~65): en `published`, `<Link to={pipelinePath(job.id)}>Ver pipeline</Link>` como primer control de `.actions` |
| applications | `apps/web/src/features/applications/types.ts` | **nuevo** (~55): `STAGES`, `Stage`, `REJECTION_REASONS`, `RejectionReason`, `PipelineJobStatus`, `PipelineItem`, `Pipeline` (`{ job: { id, status }, items: PipelineItem[] }`), `EnrollmentInput`, `Application` (6 campos del 201) (S1, S2, S4, S5) |
| applications | `apps/web/src/features/applications/paths.ts` | **nuevo** (~15): `PIPELINE_ROUTE = '/jobs/:id/pipeline'`, `pipelinePath(jobId)` y `parsePipelineJobId(path)` (sobre `matchPath` y `parseRouteId`) |
| applications | `apps/web/src/features/applications/labels.ts` | **nuevo** (~50): `stageLabel`, `rejectionReasonLabel`, `groupByStage(items)` → `Record<Stage, PipelineItem[]>` en el orden recibido |
| applications | `apps/web/src/features/applications/api.ts` | **nuevo** (~110): `pipelineUrl(jobId)` (RangeError con ID no válido), `isPipeline` (comprueba `job` e `items`), `getPipeline(jobId, signal)`, `isApplication`, `enrollCandidate(input, signal)`, `SEARCH_LIMIT = 10` y `searchCandidates(q, signal)` = `listCandidates({ q, pageSize: SEARCH_LIMIT })` |
| applications | `apps/web/src/features/applications/enroll-errors.ts` | **nuevo** (~35): `classifyEnrollError(error)` → `'duplicate' \| 'not-published' \| 'not-found' \| 'other'` y los textos fijos (DD-05) |
| applications | `apps/web/src/features/applications/PipelineScreen.tsx` | **nuevo** (~160): `PipelineScreen` (ruta; props `jobPath`, `notFound`), `PipelineLoader` (recurso, feedback, estados) y `PipelineContent` (por estado de la oferta) |
| applications | `apps/web/src/features/applications/use-pipeline-feedback.ts` | **nuevo** (~60): aviso o alerta de la página tras inscribir y el foco sobre ellos (DD-10) |
| applications | `apps/web/src/features/applications/PipelineBoard.tsx` | **nuevo** (~75): 6 columnas y `PipelineCard`, presentacional |
| applications | `apps/web/src/features/applications/EnrollPanel.tsx` | **nuevo** (~170): panel presentacional: formulario de búsqueda, mensajes y `EnrollResults` (tabla) |
| applications | `apps/web/src/features/applications/use-candidate-search.ts` | **nuevo** (~85): texto, error de campo, estado de la búsqueda (`idle`, `loading`, `success`, `error`), un `AbortController` por búsqueda, `reset()` |
| applications | `apps/web/src/features/applications/use-enroll-panel.ts` | **nuevo** (~90): abrir y cerrar (botón, «Cerrar», `Escape`), foco (refs del botón «Inscribir candidato» y del campo), alerta del panel; compone búsqueda e inscripción |
| applications | `apps/web/src/features/applications/use-enrollment.ts` | **nuevo** (~85): `pendingId`, guarda `inFlight` por `ref`, `useLifetimeSignal`, `POST` y reparto del resultado en callbacks |
| tests | `apps/web/test/components/use-resource.test.tsx` | modificar (~100): `reload` mantiene el dato mientras pide y luego lo sustituye; un error pasa a `error` |
| tests | `apps/web/test/features/applications/fixtures.ts` | **nuevo** (~70): pipelines y páginas de candidatos inventados (`@example.com`) y `renderPipeline(path, routes)` |
| tests | `apps/web/test/features/applications/api.test.ts` · `labels.test.ts` | **nuevos**: cliente, forma, URL, errores; etiquetas y agrupación |
| tests | `apps/web/test/features/applications/PipelineScreen.test.tsx` | **nuevo**: estados y columnas (RF-07) |
| tests | `apps/web/test/features/applications/PipelineScreen.search.test.tsx` | **nuevo**: panel y búsqueda (RF-08, primera mitad) |
| tests | `apps/web/test/features/applications/PipelineScreen.enroll.test.tsx` | **nuevo**: inscribir y sus resultados (RF-08, segunda mitad) |
| tests | `apps/web/test/features/applications/PipelineScreen.adversarial.test.tsx` | **nuevo** `[adversarial]` |
| tests | `apps/web/test/features/jobs/JobDetailScreen.states.test.tsx` · `JobDetailScreen.actions.test.tsx` | modificar: `controls()` de una `published` pasa a `['Ver pipeline', 'Editar', 'Cerrar', 'Duplicar']` (`states:77`, `actions:77`, `actions:215`; mismas líneas); en `states`, un test nuevo del `href` y de su ausencia en `draft` y `closed` |
| tests | `apps/web/test/App.test.tsx` | modificar (~150): «Ver pipeline» desde la ficha abre `/jobs/7/pipeline` con título «Pipeline de la oferta · ATS»; `/jobs/abc/pipeline` → «Página no encontrada» sin petición |
| e2e | `e2e/jobs-lifecycle.spec.ts` | modificar: línea 108 → `['Ver pipeline', 'Editar', 'Cerrar', 'Duplicar']` |
| e2e | `e2e/applications.spec.ts` | **nuevo** (~200): recorridos de RF-08 y RF-10 |

**No se tocan:** `apps/web/src/features/candidates/` (ni `CandidateDetails.tsx`, que ya cumple UC-12 · A1, ni
`CandidateFormScreen.tsx`: la copia local de `CandidateNotFound` sigue como deuda, porque este diseño no toca esa
pantalla) y `apps/web/src/components/http.ts` (`existingId` ya existe; la web no lo usa en esta HU).

## Pantallas y estados

### Rutas y títulos

| Ruta | Pantalla | `document.title` |
|---|---|---|
| `/jobs/:id` (modificada) | `JobDetailScreen` → `JobActions` gana «Ver pipeline» (solo `published`) | Sin cambios (título de la oferta, que no es dato personal) |
| `/jobs/:id/pipeline` (nueva) | `PipelineScreen` | «Pipeline de la oferta · ATS» **en todos los estados** (constante, `useDocumentTitle` + `ROUTES`); nunca un nombre ni la búsqueda |

### Pipeline (`/jobs/:id/pipeline`)

Árbol de componentes:

```
PipelineScreen            (ruta: parsePipelineJobId; id no válido → props.notFound, sin petición)
└─ PipelineLoader key=id  (useResource(getPipeline) · usePipelineFeedback · useEnrollPanel)
   ├─ h1 «Pipeline de la oferta» (tabIndex -1) · Link «Volver a la oferta» (props.jobPath(id))
   ├─ Notice «Candidato inscrito.» (ref, foco)  |  p role=alert (ref, foco)      ← usePipelineFeedback
   └─ estado del recurso:
      loading → LoadingMessage «Cargando el pipeline…»
      error 404/400 → props.notFound   ·   otro error → ErrorMessage(userMessage) + «Reintentar»
      success → PipelineContent { pipeline, panel }
                ├─ draft     → p «Esta oferta es un borrador: publícala para inscribir candidatos.»
                ├─ published → button «Inscribir candidato» (aria-expanded, aria-controls)
                │              EnrollPanel (si abierto) · vacío o PipelineBoard
                └─ closed    → vacío o PipelineBoard (sin botón ni panel)
```

| Estado | Qué se ve | Rol / nombre accesible (para los tests) |
|---|---|---|
| Cargando | «Cargando el pipeline…» | `status` |
| Error (red, 5xx, respuesta no válida) | `userMessage(error)` + «Reintentar» (repite `GET`) | `alert`; `button` «Reintentar» |
| No existe (404, 400 o ID no válido en la URL) | `NotFoundScreen` de `App.tsx`: «Página no encontrada» + «Ir a las ofertas» (EC-35; CA-15) | `heading` «Página no encontrada» |
| `draft` | «Esta oferta es un borrador: publícala para inscribir candidatos.»; sin columnas ni acción (DT-03) | sin `region`; sin `button` «Inscribir candidato» |
| `published` vacío | «Todavía no hay candidatos inscritos en esta oferta.» + «Inscribir candidato» (CA-14) | `button` «Inscribir candidato» |
| `closed` vacío | El mismo texto, sin acción | sin `button` «Inscribir candidato» |
| Con datos (`published` o `closed`) | 6 columnas en orden: Recibida, Cribado, Entrevista, Oferta, Contratado, Rechazado; columna sin tarjetas → «Sin candidatos.»; `published` añade «Inscribir candidato» encima (CA-12, CA-26) | 6 `region` con esos nombres (`section aria-labelledby` → `h2`); tarjetas `listitem` |

- **Tarjeta (`PipelineCard`):** `<li>` con el nombre en un `<p>` (texto JSX, nunca HTML; **sin `<a>`**, DT-01),
  «Último cambio: `<time dateTime>`dd/mm/aaaa`</time>`» (`formatDate`, Europe/Madrid) y, solo en `rejected`,
  «Motivo: {etiqueta}». Sin email, teléfono ni nota (la API no los da).
- **Orden:** el de la API dentro de cada columna; la web no reordena (DD-08).
- **Navegación:** `h1` único; `h2` por columna y por el panel; «Volver a la oferta» es `a` (navega); «Inscribir
  candidato», «Buscar», «Cerrar» e «Inscribir» son `button`.

### Panel «Inscribir candidato» (`EnrollPanel`, en la propia pantalla)

`<section id="enroll-panel" aria-labelledby>` con `h2` «Inscribir candidato» (DT-02, no modal):

| Pieza | Detalle |
|---|---|
| Disparador | `button` «Inscribir candidato» con `aria-expanded` y `aria-controls="enroll-panel"`; abre y cierra. Al abrir, el foco va al campo (`expectFocusOn`) y se limpia el aviso o la alerta de la página |
| Formulario | `<form role="search" aria-label="Buscar candidatos para inscribir" noValidate>`; `FormField` id `enroll-q`, *label* «Nombre o email», `input type="search" autoComplete="off"` controlado; `button type="submit"` «Buscar» (Enter envía); `button type="button"` «Cerrar» |
| Validación | `validateSearchText` (≤ 100 puntos de código, sin controles). Error → junto al campo (`aria-invalid`, `aria-describedby` de `FormField`), foco al campo, **sin petición** (EC-40). Vacío es válido: lista los 10 más recientes (DD-07) |
| Buscando | «Buscando candidatos…» (`status`); una búsqueda nueva aborta la anterior (`AbortController`) |
| Resultados | `<table>` con `caption` «Resultados de la búsqueda»: Nombre, Email, Acción; hasta 10 filas, en el orden de la API; cada fila con `button` «Inscribir» y `aria-describedby` → id de la celda del nombre (DD-11). Sin marca de «ya inscrito» (DT-02) |
| 0 resultados | «Ningún candidato coincide con la búsqueda.» (`status`) |
| Más de 10 | Las 10 filas y «Hay más resultados: afina la búsqueda.» (`status`) si `total > 10` |
| Error de búsqueda | 400 con `details` en `q` → junto al campo; resto → `userMessage` con `role="alert"` dentro del panel; el texto escrito se conserva (EC-42) |
| Inscribiendo | Todos los «Inscribir», «Buscar» y «Cerrar» `disabled`; el pulsado dice «Inscribiendo…»; `Escape` no cierra |
| Cerrar | «Cerrar», `Escape` dentro del panel o el disparador → se descartan texto y resultados y el foco vuelve a «Inscribir candidato» (RNF-07, `expectFocusOn`) |

**Resultado de inscribir** (`classifyEnrollError` + `use-enrollment.ts`, DD-05):

| Respuesta | Panel | Página | Pipeline | Foco |
|---|---|---|---|---|
| 201 | Se cierra y se descarta | `Notice` «Candidato inscrito.» | `reload()` → la tarjeta aparece la primera de «Recibida» | El aviso |
| 409 `DUPLICATE` | Sigue abierto, con texto y resultados; alerta «Este candidato ya está inscrito en la oferta.» **sin enlace** (DT-02) | — | `reload()` (EC-43) | La alerta del panel |
| 409 `INVALID_TRANSITION` | Se cierra | Alerta «La oferta ya no está publicada: no admite inscripciones.» | `reload()` → sin «Inscribir candidato» (EC-44) | La alerta de la página |
| 404 `NOT_FOUND` | Sigue abierto; alerta con el `message` de la API | — | `reload()` (si la oferta ya no existe, pasa a «Página no encontrada») | La alerta del panel |
| Red, *timeout*, 400, 403, 413, 415, 500, respuesta no válida | Sigue abierto; alerta `userMessage(error)` (sin *stack*) | — | Sin recarga | La alerta del panel |

Si un `reload()` posterior devuelve una oferta no `published`, el panel deja de pintarse y su estado se descarta
(`open && status === 'published'`).

### Ficha de la oferta y ficha del candidato

- **Oferta (`JobActions`):** `published` → `['Ver pipeline', 'Editar', 'Cerrar', 'Duplicar']`; `draft` y `closed`, sin
  cambios (el enlace desde una cerrada es de HU-05).
- **Candidato:** sin cambios; «Fin de retención: Mientras dure el proceso» con `retentionEndsAt: null` (CA-19).

## Migración de datos

N/A en la web — sin almacenamiento propio. La migración `003` y el seed de 40 inscripciones (DT-05) son del backend;
el e2e solo cuenta con que haya ofertas `closed` en el seed y crea su propia oferta publicada y su candidato.

## Diagrama de secuencia

Inscribir con éxito, con duplicado y con la oferta cerrada en otra pestaña (RF-07, RF-08):

```mermaid
sequenceDiagram
  participant R as Reclutador
  participant W as Web
  participant A as API
  participant D as SQLite
  R->>W: Ficha de oferta published → «Ver pipeline»
  W->>A: GET /api/jobs/7/applications
  A-->>W: 200 { job: { id: 7, status: published }, items: [...] }
  W-->>R: 6 columnas + «Inscribir candidato»
  R->>W: «Inscribir candidato» → «Nombre o email» = «ana» → Enter
  W->>W: validateSearchText OK (nada a la URL ni al título)
  W->>A: GET /api/candidates?q=ana&pageSize=10
  A-->>W: 200 { items (≤10), total }
  R->>W: «Inscribir» (doble clic)
  W->>W: inFlight = true; botones disabled (el 2.º clic no envía)
  W->>A: POST /api/applications { jobId: 7, candidateId: 12 }
  A->>D: BEGIN IMMEDIATE; estado de la oferta; INSERT; StageChange; retención; COMMIT
  A-->>W: 201
  W-->>R: Panel cerrado; «Candidato inscrito.» (foco)
  W->>A: GET /api/jobs/7/applications (reload, sin «Cargando»)
  A-->>W: 200 con la tarjeta en received
  alt Pareja ya inscrita
    A-->>W: 409 DUPLICATE details[{ candidateId, existingId }]
    W-->>R: Alerta en el panel, sin enlace; reload del pipeline
  else Oferta cerrada en otra pestaña
    A-->>W: 409 INVALID_TRANSITION
    W-->>R: Panel cerrado; alerta en la página; reload → columnas sin «Inscribir candidato»
  end
```

## Error paths

EC de solo API: la web no los provoca (envía enteros de un ID validado) y los prueba el backend; se listan para que
estén todos.

| Edge case (PRD) | Dónde se detecta | Estrategia | Respuesta o efecto observable | Test |
|---|---|---|---|---|
| EC-01 | API (esquema) | La web solo envía `{ jobId, candidateId }` enteros de IDs validados; un 400 → alerta en el panel | `userMessage`, panel abierto | `api.test.ts` (cuerpo exacto) · `PipelineScreen.adversarial.test.tsx` (400 → alerta) |
| EC-02 | API (parser) | `requestJson` pone `Content-Type: application/json` y `JSON.stringify` | — (no se da desde la web) | `api.test.ts` (cabecera y cuerpo) |
| EC-03 | API | Solo API | — | Backend |
| EC-04 | API (índice único) | 409 `DUPLICATE` → texto fijo | Alerta «Este candidato ya está inscrito en la oferta.» | `PipelineScreen.enroll.test.tsx` · e2e |
| EC-05 | API (transacción) | 500 → alerta, sin recarga | `userMessage`, panel abierto con lo escrito | `PipelineScreen.adversarial.test.tsx` |
| EC-06 | API (índice único) | La web envía una petición por clic (DD-06) | — | Backend · `PipelineScreen.adversarial.test.tsx` (1 `POST`) |
| EC-07 | API (estado en la transacción) | 409 `INVALID_TRANSITION` → texto fijo, panel cerrado, `reload()` | Alerta en la página; sin «Inscribir candidato» tras recargar | `PipelineScreen.enroll.test.tsx` |
| EC-08 | API | Solo API (la retención la pinta la ficha) | — | Backend |
| EC-09 | API | La web pinta el `message` del 404 tal cual, que no lleva datos | Alerta en el panel | Backend · `PipelineScreen.enroll.test.tsx` (404) |
| EC-10 | API (DEC-12) | La web va `same-origin` por el *proxy*; un 403 → alerta | `userMessage` | `PipelineScreen.adversarial.test.tsx` (403) |
| EC-11 | API | Reintento tras *timeout* → 409 `DUPLICATE` verídico + `reload()` que muestra la tarjeta (DD-06) | Alerta en el panel y tarjeta en «Recibida» | `PipelineScreen.adversarial.test.tsx` |
| EC-12, EC-13, EC-14, EC-15, EC-16 | Base de datos | Solo API | — | Backend |
| EC-17 | API (puerto) | 409/404 según estado; la web los trata como EC-07/EC-09 | Ver EC-07 y EC-09 | Backend |
| EC-18 | API | 500 → como EC-05 | Ver EC-05 | Backend |
| EC-19 | API | Como EC-07 | Ver EC-07 | Backend |
| EC-20 | Estructura | La web replica la dirección de DEC-06 entre features (DD-01) | `applications` no importa `features/jobs/`; `candidates` no importa `applications` ni `jobs` | Revisión de imports en la review (`grep`) |
| EC-21, EC-22, EC-23, EC-24, EC-25 | Puerto de procesos | Solo API | — | Backend |
| EC-26 | Web (`parseRouteId`) y API | Un ID no válido no llega a pedirse; un 400 del `GET` → «Página no encontrada» | Ver EC-35 | `PipelineScreen.test.tsx` |
| EC-27 | API / web | Sin paginación: la web pinta todas las tarjetas que lleguen; empate resuelto por la API, la web no reordena (DD-08) | 0 → vacío; 1; 200 tarjetas | `PipelineScreen.test.tsx` (vacío, 1 y orden recibido) · `PipelineScreen.adversarial.test.tsx` (200) |
| EC-28 | `PipelineContent` | `status === 'draft'` → solo el mensaje | Mensaje de borrador, sin `region` ni botón | `PipelineScreen.test.tsx` · e2e |
| EC-29 | Web (`requestJson`) | 500 → error con «Reintentar» | `alert` + «Reintentar» | `PipelineScreen.test.tsx` |
| EC-30 | API | La web no pide ni pinta email, teléfono ni nota en el pipeline | Tarjeta solo con nombre, fecha y motivo | Backend · `PipelineScreen.adversarial.test.tsx` (campos extra no se pintan) |
| EC-31, EC-32, EC-33, EC-34 | — | Movidos a HU-05 (DT-11) | — | — |
| EC-35 | `PipelineScreen` (`parsePipelineJobId`) | Sin petición | «Página no encontrada» | `PipelineScreen.test.tsx` · `App.test.tsx` |
| EC-36 | `formatDate` | Europe/Madrid | `2026-12-31T23:30:00.000Z` → «01/01/2027» | `PipelineScreen.test.tsx` |
| EC-37 | `requestJson` + `isPipeline` | Red, 5xx sin envelope, no JSON o forma inesperada (etapa o motivo desconocidos, `job.id` distinto) → error | Mensaje útil + «Reintentar», sin *stack* | `PipelineScreen.test.tsx` · `api.test.ts` |
| EC-38 | Render JSX | Texto, nunca HTML; sin `dangerouslySetInnerHTML` | `<img src=x onerror=alert(1)>` visible como texto en tarjeta y resultados; ningún `img` | `PipelineScreen.adversarial.test.tsx` |
| EC-39 | `useDocumentTitle` + ruta | Título constante; URL solo con el ID | «Pipeline de la oferta · ATS»; `/jobs/7/pipeline` | `PipelineScreen.adversarial.test.tsx` · `App.test.tsx` · e2e |
| EC-40 | `use-candidate-search.ts` | `validateSearchText` antes de pedir | Error junto al campo, foco en él, 0 peticiones | `PipelineScreen.search.test.tsx` |
| EC-41 | `EnrollPanel` | `pageSize=10`; `total > 10` → nota | 0 → «Ningún candidato coincide con la búsqueda.»; 10 sin nota; 10 + «Hay más resultados: afina la búsqueda.» | `PipelineScreen.search.test.tsx` |
| EC-42 | Hooks del panel | Alerta en el panel; estado conservado | `alert`; campo con lo escrito; resultados intactos | `PipelineScreen.search.test.tsx` (buscar) · `PipelineScreen.adversarial.test.tsx` (inscribir) |
| EC-43 | `classifyEnrollError` | `DUPLICATE` → texto fijo sin enlace + `reload()` | Alerta sin `link`; tarjetas sin cambios | `PipelineScreen.enroll.test.tsx` |
| EC-44 | `classifyEnrollError` | `INVALID_TRANSITION` → panel cerrado + alerta + `reload()` | Sin «Inscribir candidato» tras recargar | `PipelineScreen.enroll.test.tsx` |
| EC-45 | Diseño (DD-03) | La búsqueda solo vive en el estado del panel | `location.href`, `document.title`, `history.state`, `localStorage` y `sessionStorage` sin el email buscado | `PipelineScreen.adversarial.test.tsx` · e2e |
| EC-46 | `use-enrollment.ts` | Guarda `inFlight` + `disabled`; tras el éxito el panel se cierra (DD-06) | 1 `POST` ante doble clic; nunca un «ya inscrito» sobre la inscripción propia salvo tras *timeout* (EC-11) | `PipelineScreen.adversarial.test.tsx` |
| EC-47, EC-48, EC-49, EC-50 | — | Movidos a HU-05 (DT-11) | — | — |
| EC-51 | API | La ficha pinta la fecha que llegue | `dd/mm/aaaa` | Backend (la ficha ya lo cubre en HU-03) |
| EC-52 | API | La ficha pinta la fecha que llegue | Fecha anterior | Backend |
| EC-53 | API + `CandidateDetails` | `retentionEndsAt: null` → texto | «Mientras dure el proceso» | Backend · `CandidateDetailScreen.test.tsx:183` |
| EC-54, EC-55, EC-56, EC-57 | Seed | Solo API | — | Backend |

## Threat modeling

DEC-04: sin login; la superficie es el propio navegador del reclutador.

| STRIDE | Amenaza concreta | Mitigación | Riesgo residual |
|---|---|---|---|
| Suplantación | Otra web lanza el `POST` de inscripción con el navegador del reclutador | DEC-12 en la API (`Sec-Fetch-Site`); la web va `same-origin` | DNS rebinding (deuda SEC-06, auditoría de sprint) |
| Manipulación | Nombre de candidato con HTML o *script* en tarjeta o resultados | Solo texto JSX; 0 `dangerouslySetInnerHTML` en `features/applications/` (RNF-06) | Bajo |
| Repudio | — | N/A — un único rol sin identidad (DEC-04); el `StageChange` registra el cuándo | — |
| Exposición de datos | Búsqueda (email o nombre) en URL, título, historial o almacenamiento; nombres en el título | DD-03 (solo estado del panel), título constante, rutas con ID, `autoComplete="off"`, sin `console.*` | Bajo: el nombre está en el DOM mientras la pantalla está abierta |
| Exposición de datos | El pipeline mostrara email, teléfono o nota | La web no los pide ni los pinta; los filtra la API (RNF-04) | Bajo |
| Denegación de servicio | Ráfagas de búsqueda o doble clic | Una búsqueda aborta la anterior; una inscripción a la vez; sin reintentos automáticos | Bajo (local) |
| Elevación de privilegios | — | N/A — un único rol (DEC-04) | — |

## Datos personales

- **Qué lee la web:** en el pipeline, solo el **nombre** del candidato (S1); en el buscador, **nombre y email** (y
  `skills`, que llegan con `GET /api/candidates` pero **no se pintan**) de hasta 10 candidatos (RGPD §6.2, UC-14 · P).
- **Qué escribe:** el vínculo candidato-oferta por `POST /api/applications` con dos IDs; nada más.
- **Dónde vive:** en el estado de React del panel y del recurso; se descarta al cerrar el panel, al desmontar la
  pantalla o al recargar. Sin almacén de módulo (a diferencia de `candidates/list-state.ts`), sin `history.state` y sin
  `localStorage`/`sessionStorage`.
- **Qué NO aparece:** nombre, email ni texto de búsqueda en la URL, `document.title`, `history.state`, el
  almacenamiento, la consola ni los mensajes de error que construye la web (RNF-05, EC-45). La alerta del 409
  `DUPLICATE` no incluye ni el nombre ni el `existingId`.
- **Retención:** la decide el backend; la web solo pinta «Mientras dure el proceso» cuando `retentionEndsAt` es `null`
  (RGPD §3, UC-12 · A1).
- **Datos de prueba:** inventados, `@example.com`; en el e2e, candidato propio con *token* único y sin teléfono.

## Decisiones de diseño

### DD-01: Dirección de dependencias entre features = DEC-06, composición en `App.tsx`
- **Contexto:** «Ver pipeline» (en `jobs`) necesita la ruta del pipeline; el pipeline necesita el enlace a la ficha de
  la oferta y la pantalla «Página no encontrada»; el buscador necesita el cliente de `candidates`. HU-05 añadirá
  enlaces del pipeline a la ficha del candidato y de vuelta a la oferta.
- **Opciones consideradas:** A) `applications` importa `features/jobs/paths.ts` y `jobs` define `jobPaths.pipeline`;
  B) `jobs → applications → candidates` como en la API: `jobs` importa `pipelinePath` de `applications/paths.ts`,
  `applications` importa `listCandidates` y `CandidateListItem` de `candidates`, y `App.tsx` pasa a `PipelineScreen`
  `jobPath={jobPaths.detail}` y `notFound={<NotFoundScreen />}`.
- **Elegida:** B.
- **Razón:** misma dirección que DEC-06, sin ciclos ahora ni cuando HU-05 enlace en los dos sentidos; `App.tsx` ya es
  el punto de composición (como `apps/api/src/app.ts`). La API pública de una feature es `api.ts`, `types.ts` y
  `paths.ts`; nada de sus componentes.
- **Tradeoff:** `PipelineScreen` recibe dos props que las demás pantallas no tienen, y la forma de la URL del pipeline
  la conoce `applications` aunque viva bajo `/jobs/`.

### DD-02: Panel en línea tipo «disclosure», no `ConfirmDialog`
- **Contexto:** DT-02 pide un panel en la propia pantalla; RNF-07 pide foco al aviso tras inscribir y de vuelta a
  «Inscribir candidato» al cerrar.
- **Opciones consideradas:** A) `<dialog>` modal (`ConfirmDialog` o uno nuevo); B) `section` con `aria-expanded` /
  `aria-controls` en el disparador, foco gestionado por `ref`, `Escape` para cerrar.
- **Elegida:** B.
- **Razón:** lo pide DT-02; el pipeline sigue visible y la tarjeta nueva aparece a la vista.
- **Tradeoff:** sin trampa de foco: el *Tab* puede salir del panel (es lo esperado en un panel no modal) y el foco al
  abrir y cerrar se gestiona a mano.

### DD-03: La búsqueda solo vive en el estado del panel
- **Contexto:** DT-10 de HU-03 y RNF-05: la búsqueda puede ser un email.
- **Opciones consideradas:** A) reutilizar un almacén de módulo como `candidates/list-state.ts` para restaurarla;
  B) estado local del hook, descartado al cerrar el panel o al salir.
- **Elegida:** B.
- **Razón:** minimización (RGPD §6): el dato no sobrevive a la tarea; además, `list-state.ts` es interno de
  `candidates`.
- **Tradeoff:** al reabrir el panel hay que volver a escribir la búsqueda.

### DD-04: Recarga silenciosa con `useResource.reload()`
- **Contexto:** tras inscribir (y en los 409) el pipeline se recarga; `retry()` pasa por `loading` y desmontaría el
  panel, que en el 409 `DUPLICATE` debe seguir abierto con lo escrito.
- **Opciones consideradas:** A) `retry()`; B) recarga a mano con `getPipeline` + `setData` en el contenedor;
  C) `reload()` en `apps/web/src/components/use-resource.ts`: incrementa el intento sin poner `loading`.
- **Elegida:** C.
- **Razón:** 3 líneas en la pieza compartida, reutiliza su `AbortController` (una respuesta vieja nunca pisa a la nueva)
  y lo aprovechará HU-05 al avanzar y rechazar.
- **Tradeoff:** durante la recarga se ven los datos anteriores sin indicador; un fallo de la recarga sí pasa a `error`
  (con «Reintentar»).

### DD-05: Los 409 se distinguen por `code` y usan los textos fijos del PRD
- **Contexto:** DT-02 fija «Este candidato ya está inscrito en la oferta.» y «La oferta ya no está publicada: no admite
  inscripciones.».
- **Opciones consideradas:** A) mostrar el `message` de la API; B) `classifyEnrollError`: `DUPLICATE` y
  `INVALID_TRANSITION` → texto fijo de la web; `NOT_FOUND` → `message` de la API; resto → `userMessage`.
- **Elegida:** B.
- **Razón:** los textos y su comportamiento (panel abierto o cerrado, recarga) son de producto y estables, y no
  dependen de la redacción del backend; los `code` son estables (DEC-07).
- **Tradeoff:** dos textos viven en la web y no en la API; si el backend cambia el `code`, cae en «otro error».
  `existingId` se ignora en esta HU (el enlace es de HU-05).

### DD-06: Una petición por clic y cierre del panel al inscribir (EC-46)
- **Contexto:** doble clic en «Inscribir» y reintento.
- **Opciones consideradas:** A) solo `disabled`; B) guarda `inFlight` por `ref` (como `use-consent-actions.ts`) +
  `disabled` de todos los «Inscribir», «Buscar» y «Cerrar»; tras el 201 el panel se cierra; C) además, recordar los IDs
  creados para silenciar un 409 propio.
- **Elegida:** B.
- **Razón:** el segundo clic no envía nada aunque llegue antes del render; tras el éxito ya no existe el botón. El único
  409 «propio» posible es tras un *timeout* del cliente, y entonces el mensaje es verídico y la recarga muestra la
  tarjeta (EC-11).
- **Tradeoff:** sin C, tras un *timeout* el reclutador ve «ya está inscrito» en lugar de «Candidato inscrito.».

### DD-07: Búsqueda vacía permitida
- **Contexto:** RF-08 fija `validateSearchText`, que acepta el texto vacío (sin filtro).
- **Opciones consideradas:** A) campo obligatorio con un error propio; B) vacío = los 10 candidatos más recientes y,
  si hay más, «Hay más resultados: afina la búsqueda.».
- **Elegida:** B.
- **Razón:** es lo que define el validador que fija el PRD y el comportamiento de `GET /api/candidates`; no inventa un
  texto de error.
- **Tradeoff:** «Buscar» sin texto enseña 10 nombres y emails que el reclutador no ha pedido (los mismos que ve en el
  listado de candidatos).

### DD-08: Agrupar por etapa en el cliente, conservando el orden de la API
- **Contexto:** S1 da una lista plana ya ordenada (RF-05).
- **Opciones consideradas:** A) reordenar en la web por `lastChangeAt`; B) `groupByStage` estable, sin reordenar.
- **Elegida:** B.
- **Razón:** una sola fuente del orden (con el desempate por ID que la web no podría reproducir sin duplicar la regla).
- **Tradeoff:** si la API rompe el orden, la web lo muestra roto (lo detectan los tests del backend).

### DD-09: «No existe» = «Página no encontrada» y título constante
- **Contexto:** EC-35 pide «Página no encontrada» para `/jobs/abc/pipeline`; CA-15, estado de error para un 404.
- **Opciones consideradas:** A) un `PipelineNotFound` propio («Oferta no encontrada»); B) el `NotFoundScreen` de
  `App.tsx`, recibido por prop, para ID no válido, 400 y 404 (como `jobs` y `candidates` tratan 400 y 404 igual que un ID
  no válido).
- **Elegida:** B.
- **Razón:** el texto que pide el PRD y sin duplicar el componente; el título queda «Pipeline de la oferta · ATS».
- **Tradeoff:** un 404 no dice «la oferta no existe» con esas palabras.

### DD-10: Foco tras cada resultado
- **Contexto:** RNF-07; un botón que pasa a `disabled` pierde el foco.
- **Opciones consideradas:** A) devolver el foco al botón pulsado; B) llevarlo al mensaje que produce la acción.
- **Elegida:** B: 201 → `Notice` (con `ref`, `tabIndex -1`); 409 de estado → alerta de la página; resto → alerta del
  panel; cerrar sin inscribir → «Inscribir candidato»; abrir → «Nombre o email».
- **Razón:** el botón puede desaparecer (panel cerrado o recarga) y el mensaje es lo que hay que leer.
- **Tradeoff:** el lector de pantalla puede anunciar dos veces el aviso (`role="status"` + foco).

### DD-11: Resultados en tabla con descripción en cada «Inscribir»
- **Contexto:** varios botones «Inscribir» iguales.
- **Opciones consideradas:** A) nombre accesible «Inscribir a {nombre}»; B) nombre «Inscribir» y `aria-describedby` a
  la celda del nombre, dentro de una tabla con `caption`.
- **Elegida:** B.
- **Razón:** el texto visible coincide con el nombre accesible (WCAG 2.5.3) y la fila da el contexto.
- **Tradeoff:** los tests seleccionan el botón con `within(row)` o por `description`.

## Impacto en decisiones

- **DEC-01:** React 19 + Vite, TypeScript estricto, Vitest y Playwright; sin librerías nuevas.
- **DEC-04:** sin permisos en la web; la acción se oculta por **estado** de la oferta, no por rol.
- **DEC-06:** se **aplica por analogía** a la web (DD-01): `jobs → applications → candidates`. No se propone `DEC-NN`
  nueva; si la review quiere fijarlo, bastaría una línea en DEC-06 («la web sigue la misma dirección entre features»),
  que se deja como sugerencia, no como decisión abierta.
- **DEC-07:** la web distingue los dos 409 por `code` (DD-05).
- **DEC-08:** el doble clic no envía dos peticiones; la unicidad la garantiza la API (DD-06).
- **DEC-09:** `formatDate` (Europe/Madrid, `dd/mm/aaaa`).
- **DEC-10:** el buscador usa `pageSize=10` del listado; el pipeline, sin paginación (excepción declarada en el PRD).
- **DEC-12:** sin cambios en la web.

## Estrategia de tests

Vitest + Testing Library en `apps/web/test/` (jsdom): consultas por rol y *label*; `mockFetch`
(`apps/web/test/helpers/fetch.ts`, URL exacta con query, `hang` para «en curso»); **todo foco movido por un efecto se
aserta con `expectFocusOn`** (`apps/web/test/helpers/focus.ts`). Solo se simula la red; datos inventados con
`@example.com`. Fixtures compartidos en `apps/web/test/features/applications/fixtures.ts`. Cada fichero ≤ 300 líneas
**tras Prettier**.

| RF | Vitest (fichero → qué) | Playwright |
|---|---|---|
| RF-07 | `PipelineScreen.test.tsx` → cargando; 6 `region` en orden con sus nombres; tarjeta con nombre sin `link`, fecha y motivo con etiqueta solo en «Rechazado»; «Sin candidatos.» en columna vacía; orden recibido (CA-12); vacío `published` con botón (CA-14); `draft` mensaje sin `region` ni botón y `closed` sin botón (CA-26); 404 y `/jobs/abc/pipeline` sin petición → «Página no encontrada» (CA-15, EC-35); red y respuesta no válida → «Reintentar» que repite el `GET` (CA-16, EC-37); 23:30Z del 31/12 → 01/01 (EC-36). `JobDetailScreen.states.test.tsx` → «Ver pipeline» con `href="/jobs/7/pipeline"` solo en `published`. `App.test.tsx` → navegación y título | `applications.spec.ts`: ficha → «Ver pipeline» → URL y título; `draft` por URL y `closed` del seed (CA-26) |
| RF-08 | `PipelineScreen.search.test.tsx` → abrir con foco en el campo; Enter y «Buscar» → `GET /api/candidates?q=ana&pageSize=10`; vacío → `?pageSize=10`; 10 sin nota, 11 → nota, 0 → mensaje (EC-41); 101 y control sin petición (EC-40); error de red con texto conservado (EC-42); «Cerrar» y `Escape` devuelven el foco a «Inscribir candidato» (RNF-07). `PipelineScreen.enroll.test.tsx` → `POST` con `{"jobId":7,"candidateId":12}`; aviso con foco, panel cerrado, recarga y tarjeta primera en «Recibida» (CA-02); un `candidateId` por petición (CA-03); `DUPLICATE` sin enlace y sin tarjeta nueva (CA-08, EC-43); `INVALID_TRANSITION` → recarga sin botón (EC-44); 404 → alerta en el panel | `applications.spec.ts`: inscribir un candidato creado en el test (CA-02), duplicado (CA-08) |
| RF-10 | `CandidateDetailScreen.test.tsx:183` (existente) | `applications.spec.ts`: ficha del candidato inscrito → «Mientras dure el proceso» (CA-19) |
| `[adversarial]` | `PipelineScreen.adversarial.test.tsx` → `<img src=x onerror=alert(1)>` como texto en tarjeta y resultados, sin `img` (EC-38, RNF-06); doble clic = 1 `POST` (EC-46); *timeout* + reintento → 409 + tarjeta (EC-11); 400, 403, 500 y 201 con forma inesperada → alerta, panel abierto con lo escrito (EC-01, EC-05, EC-10); búsqueda con email: `location.href`, `document.title`, `history.state` (`null`), `localStorage` y `sessionStorage` vacíos tras buscar e inscribir (EC-45, RNF-05); 200 tarjetas en una columna; elemento con `email`/`phone`/`note` extra → no se pinta (EC-30) | — |

**Piezas compartidas:** `use-resource.test.tsx` (`reload`), `api.test.ts` y `labels.test.ts` de `applications`. La suite
de `jobs` y `candidates` sigue en verde con los 3 cambios de asserts de DD-01/«Ver pipeline».

**De API pura** (backend con `fastify.inject`): CA-01, CA-04 a CA-07, CA-09 a CA-11, CA-13, CA-20 a CA-22, CA-25 y
CA-27; RNF-01 a RNF-04.

**Criterio → test (parte web):**

| CA | Test |
|---|---|
| CA-02 | `PipelineScreen.enroll.test.tsx` + `e2e/applications.spec.ts` |
| CA-03 (web) | `PipelineScreen.enroll.test.tsx` (cuerpo con un `candidateId`) |
| CA-08 | `PipelineScreen.enroll.test.tsx` + `e2e/applications.spec.ts` |
| CA-12 | `PipelineScreen.test.tsx` |
| CA-14 | `PipelineScreen.test.tsx` + `e2e/applications.spec.ts` (oferta nueva vacía) |
| CA-15 | `PipelineScreen.test.tsx` |
| CA-16 | `PipelineScreen.test.tsx` |
| CA-19 | `CandidateDetailScreen.test.tsx:183` + `e2e/applications.spec.ts` |
| CA-26 | `PipelineScreen.test.tsx` + `e2e/applications.spec.ts` |
| RNF-05 | `PipelineScreen.adversarial.test.tsx` + `e2e/applications.spec.ts` |
| RNF-06 | `PipelineScreen.adversarial.test.tsx` |
| RNF-07 | `PipelineScreen.test.tsx` (6 `region`), `.search.test.tsx` (labels, foco al cerrar), `.enroll.test.tsx` (foco al aviso) |

**e2e (`e2e/applications.spec.ts`):** prepara por API (`page.request`) una oferta publicada y un candidato con *token*
único (`@example.com`), como `e2e/candidates.spec.ts`; **no cierra ofertas con inscripciones** (DT-10). El `tsconfig`
de `e2e/` no tiene `dom`: URL con `page.url()`, título con `page.title()`, `history.state` con `page.evaluate` y un
cast mínimo de `globalThis` (patrón de `e2e/candidates-list.spec.ts`); nada de `window`/`document` tipados.

## Checklist de implementación

Orden: tipos y cliente → presentacionales → contenedor → tests. Base para `/task-planner`: **6 tareas web** (5 + 1
`[adversarial]`).

1. **W1 `[setup]` Contrato y piezas compartidas** (M, ~2 h): `applications/types.ts`, `paths.ts`, `labels.ts`,
   `enroll-errors.ts`, `api.ts`; `use-resource.ts` (`reload`); `StatusMessages.tsx` (`Notice` con `ref`) +
   `api.test.ts`, `labels.test.ts`, `use-resource.test.tsx`, `fixtures.ts` (S1-S6, cruzados con el TD-backend).
2. **W2 Pipeline y «Ver pipeline»** (L, ~3 h): `PipelineBoard.tsx`, `PipelineScreen.tsx` (sin panel: botón presente,
   estados `draft`/`closed`/vacío/error/no existe), ruta en `App.tsx`, enlace en `JobActions.tsx`, estilos +
   `PipelineScreen.test.tsx`, `App.test.tsx`, asserts de `JobDetailScreen.*.test.tsx` y `e2e/jobs-lifecycle.spec.ts:108`.
3. **W3 Panel y búsqueda** (L, ~3 h): `use-candidate-search.ts`, `use-enroll-panel.ts` (abrir, cerrar, `Escape`, foco),
   `EnrollPanel.tsx` (formulario, mensajes, tabla) + `PipelineScreen.search.test.tsx`.
4. **W4 Inscribir** (M, ~2 h): `use-enrollment.ts`, `use-pipeline-feedback.ts`, conexión en `PipelineLoader` (aviso,
   alertas, `reload`, foco) + `PipelineScreen.enroll.test.tsx`.
5. **W5 `[adversarial]` Pipeline frente a hostiles y fallos** (M, ~2,5 h): `PipelineScreen.adversarial.test.tsx` y los
   arreglos que destape.
6. **W6 `[e2e]` Recorrido de inscripción** (M, ~2 h): `e2e/applications.spec.ts` (depende de todas las tareas de API).

## Riesgos

| Riesgo | Probabilidad (1–5) | Impacto (1–5) | Mitigación |
|---|---|---|---|
| Techo de 15 tareas: web = 5 + 1 `[adversarial]`; si el backend pasa de 10 no adversariales, el total no cabe | 3 | 4 | Fusionar W3 y W4 en una L de ~4 h (panel + inscribir) o W1 dentro de W2; sin piezas especulativas que quitar |
| El contrato del backend cambia tras este cruce (S1-S6) | 2 | 2 | Los cambios se quedan en `types.ts`, `api.ts` y `labels.ts` |
| Foco movido por efectos (aviso, alertas, campo, botón) intermitente en CI | 3 | 2 | `expectFocusOn` en todos los asertos de foco; sin tiempos fijos |
| `reload()` en `useResource` cambia una pieza que usan `jobs` y `candidates` | 2 | 3 | Método nuevo, sin tocar `retry`/`setData`; suites de `jobs` y `candidates` en verde |
| Los tests de `JobDetailScreen.actions.test.tsx` (300 líneas) no admiten más líneas | 2 | 2 | Solo cambian 2 asserts en sus líneas; el test nuevo de «Ver pipeline» va en `JobDetailScreen.states.test.tsx` |
| e2e dependiente de la base compartida | 2 | 2 | Oferta y candidato propios con *token* único; la `closed` se busca por `GET /api/jobs?status=closed`, sin IDs fijos |

## Open Decisions

No hay decisiones abiertas. S1-S6 están cruzados con `plans/TECHNICAL_DOC-backend.md` (2026-10-07): el único ajuste
fue la clave del pipeline, `items` (no `applications`), que no afecta a ninguna DD.

## Fuera de scope

- Enlace de cada tarjeta al detalle, ruta `/applications/:id`, «Ver la inscripción» en el 409 `DUPLICATE` y el
  historial (UC-18, DT-01, DT-11): HU-05.
- «Avanzar» y «Rechazar» en las tarjetas (UC-15, UC-16) y el enlace «Ver pipeline» desde una oferta `closed`
  (UC-17 · A1): HU-05.
- Marcar en el buscador a los ya inscritos (DT-02), inscribir desde la ficha del candidato o varios a la vez (S-19).
- «Candidato anonimizado» en la tarjeta (UC-17 · A3): feature A.
- Quitar la copia de `CandidateNotFound` de `apps/web/src/features/candidates/CandidateFormScreen.tsx`: este diseño no
  toca esa pantalla; sigue como deuda en `docs/05_modules/candidatos/technical.md`.
