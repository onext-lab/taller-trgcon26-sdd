# HU-02 — Publicar, cerrar, duplicar y listar ofertas con filtros — Diseño técnico (frontend)

- **Origen:** `specs/PRD.md` (estado Ready, v1.3, 2026-10-06)
- **Generado por:** frontend-architect
- **Scope cubierto:** RF-01 a RF-06 (parte web). RF-07 (seed) es solo backend; aquí solo afecta a los e2e.

## Enfoque técnico

Se amplía lo que dejó HU-01, **sin dependencias nuevas** y sin rediseñar sus piezas (router, `requestJson`,
`useResource`, `ConfirmDialog`, `FormField`, `StatusMessages`, `format.ts`):

- **Ficha por estado (RF-06):** `JobDetails` pasa a ser solo presentación (h1, `<dl>` con las tres fechas, aviso de
  solo lectura) y las acciones salen a un `JobActions` nuevo que decide por `status`. Publicar y duplicar los lleva el
  hook `useJobActions`; cerrar, el componente `CloseJobAction` (botón + diálogo), como `DeleteJobAction` en HU-01.
- **Acciones en sitio:** publicar y cerrar sustituyen la oferta de la ficha por la que devuelve la API
  (`useResource` gana `setData`), con un aviso local; duplicar navega a la ficha nueva con aviso en `history.state`.
  Un 409 en cualquier acción o al guardar muestra el `message` de la API y recarga la oferta (DT-08).
- **Diálogo de cierre (RF-02):** `ConfirmDialog` se abre al instante y pide el número de inscripciones activas a la
  API; «Cerrar oferta» queda deshabilitado hasta tenerlo (`confirmDisabled` y `children`, dos props nuevas).
- **Listado (RF-05):** los filtros viven en la URL (`/jobs?status=…&q=…&page=…&pageSize=…`), que el router expone con
  un `useSearch()` nuevo. Un módulo puro, `list-query.ts`, lee la URL, construye las rutas y la query de la API; la
  pantalla añade un formulario de búsqueda, el selector «Por página» y un `<nav>` de paginación.
- **Edición de una publicada (RF-03):** el formulario marca y valida en cliente los cuatro obligatorios; una oferta
  cerrada no muestra el formulario.

**Alternativa principal descartada:** mantener el estado del listado en memoria (`useState`) y no en la URL. Es más
simple, pero DT-06 pide que «Atrás» y recargar conserven los filtros, y la URL permite los e2e con `page.goto`.

## Dependencias

- **Contrato de API:** lo fija la sección «Contrato de API» de
  `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/plans/TECHNICAL_DOC-backend.md`, y la web lo consume tal cual. Los
  supuestos S1-S8 de la primera versión de este documento se **cruzaron con él el 2026-10-06: todos casan**; la
  columna «Contrato» resume lo que usa la web (manda el backend). Si cambia, solo se tocan
  `apps/web/src/features/jobs/types.ts`, `api.ts` y `labels.ts`.

| # | Elemento | Contrato (backend, «Contrato de API») | Estado |
|---|---|---|---|
| S1 | Número de inscripciones activas | `GET /api/jobs/:id/close-preview` → 200 `{ "activeApplications": 0 }` (entero ≥ 0, `additionalProperties: false`) **en cualquier estado**, sin 409 (DD-11 del backend) · 400 · 404 · 500 | Casa |
| S2 | Publicar | `POST /api/jobs/:id/publish` **sin cuerpo ni `Content-Type`** → 200 `Job` (también al repetir, sin escribir) · 400 `VALIDATION_ERROR` «Hay campos con errores.» con `details` «Obligatorio para publicar.» uno por campo en el orden `title`, `description`, `location`, `workMode` (nunca la banda) · 404 · 409 `INVALID_TRANSITION` «Una oferta cerrada no se puede publicar.» (sin `details`) · 415 · 500 | Casa |
| S3 | Cerrar | `POST /api/jobs/:id/close` sin cuerpo ni `Content-Type` → 200 `Job` (también al repetir) · 400 · 404 · 409 «Un borrador no se puede cerrar: publícalo primero.» · 415 · 500 `INTERNAL_ERROR` | Casa |
| S4 | Duplicar | `POST /api/jobs/:id/duplicate` sin cuerpo ni `Content-Type` → **201** `Job` nuevo en `draft` · 400 · 404 · 415 · 500 | Casa |
| S5 | Listado | `GET /api/jobs` con `status`, `q`, `page`, `pageSize` (`ListQuery`, todo texto) → 200 `JobPage` con `page` y `pageSize` aplicados. 400 `VALIDATION_ERROR` con `details[i].field` = **nombre del parámetro**: `status` «Debe ser uno de estos valores: draft, published, closed.» (también `status=` vacío) o «Debe ser un texto.» (repetido); `page`/`pageSize` «Formato no válido.» (también vacíos); `q` «Debe tener como máximo 100 caracteres.» o «Formato no válido.» (control). Un parámetro desconocido → su nombre con «Campo no permitido.» (la web no los reenvía, DD-01) | Casa. El backend no fija `+` frente a `%20`: la web usa `encodeURIComponent` (`%20`), que decodifica cualquier parser de query |
| S6 | `PATCH` | 409 «Una oferta cerrada no se puede editar.» · 400 «Obligatorio en una oferta publicada.» por campo vacío tras la fusión; si además falla la banda, `salaryMin` va en el mismo `details` (la web ya pinta varios campos a la vez) | Casa |
| S7 | `DELETE` | 409 «Una oferta publicada no se puede borrar.» / «Una oferta cerrada no se puede borrar.» | Casa |
| S8 | Seed (RF-07) | 10 ofertas: los 4 borradores de HU-01 sin cambios y en el mismo orden relativo, más 4 `published` y 2 `closed` con títulos fijos (entre ellos «Responsable de gestión de nóminas», `published`, y «Desarrollador/a backend (Node.js)», `published`, la primera del listado) | Casa |

- **`Content-Type`:** `requestJson` (`apps/web/src/components/http.ts`) ya lo pone solo cuando hay `body`, así que las
  tres acciones salen sin cuerpo ni `Content-Type`, como el `DELETE` de HU-01. `api.test.ts` lo fija (EC-01, EC-10).
- **DEC-12 (CSRF, enmendada):** la API responde 403 `CROSS_SITE_REQUEST` a toda petición fuera de su lista de métodos
  seguros con `Sec-Fetch-Site` `cross-site` **o `same-site`**; solo pasan `same-origin`, `none` y la ausencia de la
  cabecera. **La web no cambia:** va al mismo origen a través del *proxy* de Vite, así que el navegador envía
  `same-origin`; un 403 inesperado se mostraría como cualquier error con envelope (`role="alert"` con su `message`).

- **HU-01 en `main`:** todo lo citado de `apps/web/src/` existe hoy en la rama.
- **Los e2e dependen del backend completo** (rutas nuevas y seed); los tests de Vitest, no (simulan `fetch`).

## Módulos y ficheros afectados

Líneas: estimación tras el cambio (umbral ≤ 300 por fichero y ≤ 50 por función).

| Módulo | Fichero | Cambio |
|---|---|---|
| transversal | `apps/web/src/components/router.tsx` | modificar (~95): `useSearch()`; `'Oferta duplicada.'` en `NoticeText`/`NOTICES` |
| transversal | `apps/web/src/components/use-resource.ts` | modificar (~60): `setData(data: T)` en `Resource<T>` (pasa a `success` sin petición) |
| transversal | `apps/web/src/components/ConfirmDialog.tsx` | modificar (~100): props opcionales `confirmDisabled?: boolean` (solo el botón de confirmar) y `children?: ReactNode` (entre la descripción y el error). Sin ellas, se comporta como hoy |
| transversal | `apps/web/src/styles.css` | modificar: filtros en línea, `<nav>` de paginación, `.actions` con separación |
| jobs | `apps/web/src/features/jobs/types.ts` | modificar: `ClosePreview { activeApplications: number }` |
| jobs | `apps/web/src/features/jobs/api.ts` | modificar (~150): `listJobs(query, signal)`, `publishJob`, `closeJob`, `duplicateJob`, `getClosePreview`, `isClosePreview` |
| jobs | `apps/web/src/features/jobs/list-query.ts` | **nuevo** (~110): lectura de la URL, rutas y query de la API, validación de `q` (DD-01) |
| jobs | `apps/web/src/features/jobs/labels.ts` | modificar (~60): `jobFieldLabel(field)`, `missingFieldsText(fields)`, `activeApplicationsText(n)` |
| jobs | `apps/web/src/features/jobs/JobListScreen.tsx` | modificar (~150): lee `useSearch()`, estados vacíos por caso, error 400 con «Quitar filtros», foco tras paginar |
| jobs | `apps/web/src/features/jobs/JobFilters.tsx` | **nuevo** (~120): formulario `role="search"` (Estado, Buscar por título, «Buscar») y selector «Por página» |
| jobs | `apps/web/src/features/jobs/JobPagination.tsx` | **nuevo** (~50): `<nav aria-label="Paginación">` con «Anterior», «Página X de Y» y «Siguiente» |
| jobs | `apps/web/src/features/jobs/JobTable.tsx` | sin cambios |
| jobs | `apps/web/src/features/jobs/JobDetails.tsx` | modificar (~60): solo presentación; fechas de publicación y cierre; aviso de solo lectura; h1 con `tabIndex={-1}` y `headingRef`. `JobActions` sale de aquí |
| jobs | `apps/web/src/features/jobs/JobActions.tsx` | **nuevo** (~80): acciones por estado (RF-06) |
| jobs | `apps/web/src/features/jobs/use-job-actions.ts` | **nuevo** (~120): publicar y duplicar (guarda con `useRef`, estado, clasificación de errores) |
| jobs | `apps/web/src/features/jobs/CloseJobAction.tsx` | **nuevo** (~140): botón «Cerrar» + `ConfirmDialog`; hooks internos `useClosePreview` y `useCloseJob` |
| jobs | `apps/web/src/features/jobs/JobDetailScreen.tsx` | modificar (~120): `key={id}` en el cargador; aviso local, alerta de acción, «ya no existe», foco en el h1 |
| jobs | `apps/web/src/features/jobs/DeleteJobAction.tsx` | modificar (~95): prop `onConflict(message)` para el 409 |
| jobs | `apps/web/src/features/jobs/job-form-model.ts` | modificar (~185): `validateJobForm(values, { published })` con «Obligatorio en una oferta publicada.» |
| jobs | `apps/web/src/features/jobs/JobForm.tsx` | modificar (~145): prop `published`; etiquetas «(obligatorio)» y `required` en Descripción, Ubicación y Modalidad |
| jobs | `apps/web/src/features/jobs/job-form-errors.ts` | **nuevo** (~70): `splitServerError` y `focusFirstError` salen de `JobFormScreen.tsx`, con la rama 409 |
| jobs | `apps/web/src/features/jobs/JobFormScreen.tsx` | modificar (~230): `published` al formulario; 409 → alerta + recarga; oferta cerrada → `ClosedJobNotice` |
| tests | `apps/web/test/components/router.test.tsx` · `use-resource.test.tsx` (**nuevo**) · `ConfirmDialog.test.tsx` | `useSearch`, `setData`, `confirmDisabled` y `children` |
| tests | `apps/web/test/features/jobs/api.test.ts` · `list-query.test.ts` (**nuevo**) · `labels.test.ts` | cliente, URL y textos |
| tests | `apps/web/test/features/jobs/JobListScreen.test.tsx` · `JobListScreen.filters.test.tsx` (**nuevo**) · `JobListScreen.pagination.test.tsx` (**nuevo**) · `JobListScreen.filters-adversarial.test.tsx` (**nuevo**) | listado |
| tests | `apps/web/test/features/jobs/JobDetailScreen.test.tsx` · `JobDetailScreen.states.test.tsx` (**nuevo**) · `JobDetailScreen.actions.test.tsx` (**nuevo**) · `CloseJobAction.test.tsx` (**nuevo**) · `CloseJobAction.adversarial.test.tsx` (**nuevo**) · `DeleteJobAction.test.tsx` | ficha y acciones |
| tests | `apps/web/test/features/jobs/job-form-model.published.test.ts` (**nuevo**) · `JobFormScreen.published.test.tsx` (**nuevo**) | edición de una publicada |
| e2e | `e2e/jobs.spec.ts` | modificar: comprobaciones del seed con `?status=draft&pageSize=100` y `?pageSize=100` (DD-09) |
| e2e | `e2e/jobs-lifecycle.spec.ts` · `e2e/jobs-list.spec.ts` | **nuevos**: ciclo de vida y listado (DD-09) |

`apps/web/src/App.tsx` no cambia: las rutas son las mismas y `resolveScreen` casa por `pathname`, así que cambiar la
query no desmonta `JobListScreen` ni mueve el foco a `<main>` (`useNavigationFocus` compara el `pathname`).

## Pantallas y estados

### Listado (`/jobs`, con `?status&q&page&pageSize` opcionales)

`JobListScreen` (contenedor) → `JobFilters`, `JobTable`, `JobPagination`, `StatusMessages`.

| Estado | Qué se ve |
|---|---|
| Siempre | h1 «Ofertas» (`tabIndex={-1}`), aviso de llegada si lo hay, formulario de búsqueda y «Por página» con los valores de la URL |
| Cargando | `role="status"` «Cargando ofertas…»; ni tabla ni `<nav>` |
| Vacío sin filtros (`total` 0, sin `status` ni `q`) | «Todavía no hay ofertas.» + enlace «Nueva oferta» (igual que HU-01) |
| Vacío con filtros (`total` 0 con `status` o `q`) | «Ninguna oferta cumple los filtros.» + enlace «Quitar filtros» (DT-06) |
| Página más allá de la última (`items` vacío, `total` > 0) | «Esta página no tiene ofertas.» + enlace «Ir a la primera página» (mismos filtros, `page` 1) |
| Error 400 (URL con parámetros inválidos) | `role="alert"` con el `message` de la API y, debajo, un `<ul>` con cada `details[i]` como «{etiqueta}: {message}» (`status` → «Estado», `q` → «Buscar por título», `page` → «Página», `pageSize` → «Por página»); enlace «Quitar filtros»; **sin** «Reintentar» (repetir no lo arregla) |
| Error de red, *timeout*, 5xx, forma inesperada | `ErrorMessage` de HU-01: `role="alert"` + «Reintentar»; los controles conservan sus valores (EC-36) |
| Con datos | enlace «Nueva oferta», `<table>` «Ofertas» (sin cambios) y `<nav aria-label="Paginación">`. Desaparece «Se muestran las 20 más recientes de N.» |

**Formulario de búsqueda** (`JobFilters`, `<form role="search" aria-label="Filtrar ofertas" noValidate>`):

| Control | Nombre accesible | Valores y regla | Error |
|---|---|---|---|
| `<select name="status">` | «Estado» | «Todos» (`''`), «Borrador» (`draft`), «Publicada» (`published`), «Cerrada» (`closed`). Un `status` de la URL que no es ninguno → «Todos» en el control (la API ya dio 400) | — |
| `<input type="search" name="q">` | «Buscar por título» | recortado; ≤ 100 caracteres contados con `Array.from()`; sin C0 ni DEL (refleja DT-05). Vacío tras recortar = sin filtro. Sin `maxLength` nativo (EC-04 de HU-01) | «La búsqueda no puede pasar de 100 caracteres.» · «La búsqueda no puede tener caracteres de control.» en `<p id="q-error">` con `aria-describedby`, `aria-invalid` y foco en el campo; no se navega |
| `<button type="submit">` | «Buscar» | Aplica Estado y texto (DD-02): `navigate(listPath({ status, q, pageSize }))`, siempre página 1 | — |
| `<select name="pageSize">` (fuera del `<form>`) | «Por página» | **Solo** 20, 50 y 100 (DT-07, CA-18); al cambiar navega a la página 1 con los mismos filtros (DD-02). Un `pageSize` válido de la URL que no sea uno de los tres (p. ej. 7) se pide a la API como 20 y el selector muestra 20; la URL no se reescribe (`listRequest` y `PAGE_SIZES` en `list-query.ts`) | — |

- Los valores de los controles se inicializan desde la URL y se **resincronizan** cuando cambia (p. ej., «Atrás»), con
  el patrón «ajustar el estado durante el render» que ya usa `useResource` (comparar la query anterior), no con
  `setState` en un efecto (`react-hooks/set-state-in-effect` está en las reglas recomendadas de la v7).
- El formulario y «Por página» están **fuera** del bloque que cambia con la carga: al enviar, el foco sigue donde estaba.

**Paginación** (`JobPagination`, presentacional; props `page`, `pageSize`, `total`, `pathFor(page)`, `onNavigate`):
`<nav aria-label="Paginación">` con un enlace «Anterior» (solo si `page > 1`), el texto «Página {page} de {totalPages}
({total} ofertas)» y un enlace «Siguiente» (solo si `page < totalPages`); `totalPages = max(1, ceil(total / pageSize))`
con los `page`, `pageSize` y `total` **de la respuesta**. Con exactamente 20 ofertas y tamaño 20 no hay «Siguiente»
(EC-34). Tras navegar con estos enlaces, «Quitar filtros» o «Ir a la primera página», cuando termina la carga el foco
va al h1 «Ofertas» (DD-03).

**URL** (DD-01): la escriben `listPath`/`pagePath` en orden canónico `status`, `q`, `page`, `pageSize`, con
`encodeURIComponent` y **omitiendo los valores por defecto** (`status` vacío, `q` vacío, `page` 1, `pageSize` 20). Así
CA-18 da `/jobs?status=published&page=2` y, al elegir 50, `/jobs?status=published&pageSize=50`.

### Ficha (`/jobs/:id`)

`JobDetailScreen` → `JobDetailLoader key={id}` (contenedor) → `JobDetails`, `JobActions` (→ `CloseJobAction`,
`DeleteJobAction`), `StatusMessages`. Estados de HU-01 sin cambios (cargando, «Oferta no encontrada», error +
«Reintentar»). **Con datos:**

| Estado de la oferta | `<dl>` (fechas en `<time>`, `dd/mm/aaaa`, Europe/Madrid) | Acciones, en este orden | Extra |
|---|---|---|---|
| `draft` | …, «Fecha de creación» | enlace «Editar», botón «Publicar», botón «Borrar», botón «Duplicar» (CA-23) | — |
| `published` | …, «Fecha de creación», «Fecha de publicación» | enlace «Editar», botón «Cerrar», botón «Duplicar» (CA-01) | — |
| `closed` | …, «Fecha de creación», «Fecha de publicación», «Fecha de cierre» (EC-42) | botón «Duplicar» (CA-22) | párrafo «Esta oferta está cerrada y no se puede modificar. Para volver a publicarla, duplícala.» |

- Una fecha `null` no se pinta (ni «Sin indicar»): un `draft` solo muestra la de creación (CA-23).
- **En curso:** mientras publica o duplica, «Publicar», «Duplicar», «Cerrar» y «Borrar» quedan `disabled`; el botón
  pulsado cambia a «Publicando…» o «Duplicando…». Guarda con `useRef` contra el doble clic (EC-09, EC-31).
- **Avisos** (`Notice`, `role="status"`): «Oferta publicada.» y «Oferta cerrada.» son **locales** (estado del
  contenedor) y sustituyen al aviso de llegada; «Oferta duplicada.» viaja en `history.state` hacia la ficha nueva.
- **Alerta de acción** (`role="alert"`, bajo las acciones):
  - 400 al publicar con campos de la lista → «Para publicar falta: Descripción, Modalidad.» (etiquetas en el orden de
    `details`) + enlace «Editar» (DT-08). Otro 400 → su `message`.
  - 409 (publicar, cerrar o borrar) → el `message` de la API; se recarga la oferta (`retry`) y la alerta se mantiene.
  - 404 → «Esta oferta ya no existe.» + enlace «Volver a las ofertas»; se ocultan las acciones (igual que
    `DeleteJobAction` en HU-01).
  - Red, *timeout* o 500 → `userMessage(error)`; la ficha no cambia y el botón se reactiva.
- **Foco** (DD-07): tras publicar, cerrar o recargar por un 409, al h1 de la ficha; tras un error que deja el botón,
  vuelve a ese botón. Duplicar cambia de ruta: el foco va a `<main>` (`useNavigationFocus` de HU-01).

### Diálogo de cierre (`CloseJobAction`, sobre `ConfirmDialog`)

| Momento | Contenido |
|---|---|
| Al pulsar «Cerrar» | `showModal()`, foco en «Cancelar» (DT-08); título «¿Cerrar la oferta?»; descripción (`aria-describedby`) «Una oferta cerrada no se puede reabrir: para volver a publicarla, duplícala.»; `children`: `<p role="status">` «Comprobando las inscripciones activas…»; «Cerrar oferta» `disabled` (`confirmDisabled`) |
| Número recibido | el `<p role="status">` pasa a «Se rechazarán 0 inscripciones activas.» (`activeApplicationsText`; 1 → «Se rechazará 1 inscripción activa.»); «Cerrar oferta» se habilita |
| Error al pedir el número | `error` del diálogo (`role="alert"`) con `userMessage`; «Cerrar oferta» sigue `disabled`; «Cancelar» disponible (para reintentar, se cierra y se vuelve a pulsar «Cerrar»). Un 404 cierra el diálogo y muestra «Esta oferta ya no existe.» en la ficha |
| «Cancelar» o `Escape` (CA-06) | se cierra sin `POST`; se aborta la lectura del número; el foco vuelve a «Cerrar» |
| «Cerrar oferta» | los dos botones `disabled` (`busy`); `POST …/close` |
| 200 | se cierra el diálogo; la ficha pasa a `closed` con «Oferta cerrada.»; foco al h1 |
| 500 o red (CA-09, EC-12) | `role="alert"` dentro del diálogo; botones reactivados; la ficha sigue «Publicada» |
| 409 | se cierra el diálogo; alerta de acción con el `message` y recarga de la oferta |

El diálogo **no nombra la oferta** (DT-08 no lo pide): el título de la API no entra en él (EC-15).

### Editar (`/jobs/:id/edit`)

| Oferta cargada | Qué se ve |
|---|---|
| `draft` | formulario de HU-01, sin cambios |
| `published` | mismo formulario con «Título (obligatorio)», «Descripción (obligatorio)», «Ubicación (obligatorio)» y «Modalidad (obligatorio)» (`required`). Vaciar uno (o dejarlo en espacios) → «Obligatorio en una oferta publicada.» junto al campo, foco en él, sin `PATCH` (CA-11, EC-17). Un 400 del servidor con ese `details` se pinta igual |
| `closed` (URL directa o tras un 409) | `ClosedJobNotice`: h1 «Editar oferta», `role="alert"` con el `message` del 409 si viene de guardar o, si no, «Esta oferta está cerrada y no se puede editar.», y enlace «Ver la oferta» (`/jobs/:id`). Sin formulario |

Al guardar, un 409 (CA-12, EC-44) muestra el `message` y recarga la oferta (DD-06): como ya está cerrada, se ve
`ClosedJobNotice`. Lo escrito se pierde (tradeoff de DD-06).

### Accesibilidad que usan los tests

`heading` «Ofertas» / {título} / «Editar oferta»; `search` «Filtrar ofertas»; `combobox` «Estado» y «Por página»;
`searchbox` «Buscar por título»; `button` «Buscar», «Publicar», «Cerrar», «Duplicar», «Borrar», «Cerrar oferta»,
«Cancelar», «Reintentar»; `link` «Editar», «Anterior», «Siguiente», «Quitar filtros», «Ir a la primera página»,
«Ver la oferta»; `navigation` «Paginación»; `dialog` «¿Cerrar la oferta?»; `status` y `alert`. Todo operable con
teclado (enlaces y botones nativos, `<dialog>` modal con `Escape`); foco visible de HU-01 (`:focus-visible`);
contraste AA con los colores de `styles.css`.

## Migración de datos

N/A — esta parte es solo web: no hay esquema ni seed en el frontend. El seed de RF-07 (10 ofertas) y cualquier
migración son del `TECHNICAL_DOC-backend.md`. La web sigue sin guardar nada en `localStorage`, `sessionStorage` ni
*cookies*; solo cambia lo que viaja en la URL (filtros del listado de ofertas, sin datos personales).

## Diagrama de secuencia

RF-01 (publicar) y RF-04 (duplicar):

```mermaid
sequenceDiagram
  participant R as Reclutador
  participant W as Web (JobDetailLoader + useJobActions)
  participant A as API
  R->>W: «Publicar» (o «Duplicar»)
  W->>W: guarda useRef + acciones disabled
  W->>A: POST /api/jobs/:id/publish  |  /duplicate (sin cuerpo)
  alt 200 publish
    W-->>R: setData(job) + «Oferta publicada.» + foco al h1 (Editar, Cerrar, Duplicar)
  else 201 duplicate
    W-->>R: navigate /jobs/:nuevoId + «Oferta duplicada.»
  else 400 con campos
    W-->>R: role="alert" «Para publicar falta: …» + «Editar»; sigue en Borrador
  else 409
    W-->>R: role="alert" message + retry() de la oferta
  else 404
    W-->>R: «Esta oferta ya no existe.» + «Volver a las ofertas»
  else 500 / red
    W-->>R: role="alert"; botón reactivado y con el foco
  end
```

RF-02 (cerrar):

```mermaid
sequenceDiagram
  participant R as Reclutador
  participant W as Web (CloseJobAction)
  participant A as API
  R->>W: «Cerrar»
  W-->>R: showModal(), foco en «Cancelar», «Cerrar oferta» disabled
  W->>A: GET /api/jobs/:id/close-preview (AbortController)
  A-->>W: { activeApplications: 0 }
  W-->>R: «Se rechazarán 0 inscripciones activas.»; «Cerrar oferta» habilitado
  alt «Cancelar» o Escape
    W-->>R: cierra, aborta la lectura, foco a «Cerrar»; sin POST
  else «Cerrar oferta»
    W->>A: POST /api/jobs/:id/close (botones disabled)
    alt 200
      W-->>R: cierra; ficha closed (solo lectura, fecha de cierre) + «Oferta cerrada.»
    else 500 / red
      W-->>R: role="alert" en el diálogo; ficha sigue Publicada
    else 409 / 404
      W-->>R: cierra; alerta + recarga  |  «Esta oferta ya no existe.»
    end
  end
```

RF-03 (editar y borrar según el estado):

```mermaid
sequenceDiagram
  participant R as Reclutador
  participant W as Web (JobFormScreen / DeleteJobAction)
  participant A as API
  W->>A: GET /api/jobs/:id
  alt closed
    W-->>R: ClosedJobNotice (sin formulario)
  else published
    W-->>R: formulario con 4 obligatorios marcados
    R->>W: vacía Descripción y «Guardar»
    W-->>R: «Obligatorio en una oferta publicada.» junto al campo; sin PATCH
    R->>W: corrige y «Guardar»
    W->>A: PATCH /api/jobs/:id (solo lo cambiado)
    alt 200
      W-->>R: ficha + «Cambios guardados.»
    else 409 (cerrada en otra pestaña)
      W->>A: GET /api/jobs/:id (retry)
      W-->>R: ClosedJobNotice con el message del 409
    end
  end
  Note over W,A: Borrar un draft publicado en otra pestaña: DELETE → 409 → se cierra el diálogo, alerta y recarga (sin «Borrar»)
```

RF-05 (listado) y RF-06 (ficha por estado):

```mermaid
sequenceDiagram
  participant R as Reclutador
  participant W as Web (JobListScreen / JobDetailLoader)
  participant A as API
  R->>W: Estado «Publicada», «gestion», «Buscar»
  W->>W: validateSearchText(q); con error → junto al campo, sin navegar
  W->>W: navigate /jobs?status=published&q=gestion (página 1)
  W->>A: GET /api/jobs?status=published&q=gestion
  alt 200
    W-->>R: tabla + «Página 1 de N» | «Ninguna oferta cumple los filtros.»
  else 400 (URL manipulada)
    W-->>R: role="alert" message + details + «Quitar filtros»
  else red / 5xx
    W-->>R: role="alert" + «Reintentar»; controles con sus valores
  end
  R->>W: «Siguiente»
  W->>A: GET /api/jobs?status=published&q=gestion&page=2
  W-->>R: página 2; foco al h1
  R->>W: abre /jobs/:id
  W->>A: GET /api/jobs/:id
  W-->>R: fechas que tenga + acciones según status (draft 4, published 3, closed 1)
```

## Error paths

«API: ver TECHNICAL_DOC-backend» = el comportamiento lo fija y lo prueba el backend; la columna dice qué hace la web.
Ficheros de test en `apps/web/test/features/jobs/` salvo que se indique.

| Edge case (PRD) | Dónde se detecta | Estrategia | Respuesta o efecto observable en la web | Test |
|---|---|---|---|---|
| EC-01 | `api.ts` + API | API: ver TECHNICAL_DOC-backend; la web nunca envía cuerpo ni construye un ID inválido (`jobUrl`) | `POST …/publish` sin cuerpo ni `Content-Type` | `api.test.ts` |
| EC-02 | API → `useJobActions` | mostrar los pendientes | «Para publicar falta: Descripción, Ubicación, Modalidad.» + «Editar»; sigue «Borrador» y «Publicar» habilitado | `JobDetailScreen.actions.test.tsx` |
| EC-03 | API | API: ver TECHNICAL_DOC-backend | Sin reacción específica: publica como CA-01 | — (backend) |
| EC-04 | `formatDate` | Europe/Madrid | `publishedAt` 2026-10-06T22:30:00Z → «Fecha de publicación 07/10/2026» | `JobDetailScreen.states.test.tsx` |
| EC-05 | `requestJson` (500) | mostrar y rehabilitar | `role="alert"` con el `message`; sigue «Borrador»; «Publicar» habilitado y con el foco | `JobDetailScreen.actions.test.tsx` |
| EC-06 | `ApiError` 404 | salida | «Esta oferta ya no existe.» + «Volver a las ofertas»; sin acciones | `JobDetailScreen.actions.test.tsx` |
| EC-07 | API/BD | API: ver TECHNICAL_DOC-backend | Sin reacción en la web | — (backend) |
| EC-08 | API | API: ver TECHNICAL_DOC-backend | El 404 se muestra con el texto fijo de la web; la URL solo lleva el ID | — (backend) |
| EC-09 | `useJobActions` | `disabled` + guarda `useRef` | Doble clic en «Publicar» → **1** `POST` | `JobDetailScreen.actions.test.tsx` `[adversarial]` |
| EC-10 | `api.ts` + API | API: ver TECHNICAL_DOC-backend | `POST …/close` sin cuerpo ni `Content-Type` | `api.test.ts` |
| EC-11 | `CloseJobAction` + `formatDate` | número de la API; Europe/Madrid | Diálogo «Se rechazarán 0 inscripciones activas.»; `closedAt` 22:30Z → «07/10/2026» | `CloseJobAction.test.tsx`, `JobDetailScreen.states.test.tsx` |
| EC-12 | `requestJson` (500) en el cierre | mostrar en el diálogo | `role="alert"` en el diálogo; ficha «Publicada», sin «Fecha de cierre» | `CloseJobAction.test.tsx` |
| EC-13 | API (200 idempotente) | tratar el 200 igual | La ficha muestra `closed` con la fecha que devuelve la API (la de la primera) | `CloseJobAction.test.tsx`, `e2e/jobs-lifecycle.spec.ts` |
| EC-14 | API | API: ver TECHNICAL_DOC-backend (ventana tolerada de INV-05) | La web muestra el número que dé la API; nada más | — |
| EC-15 | React (escapado) | el diálogo no incluye el título; solo texto JSX | Con título `<img src=x onerror=alert(1)>`, 0 `img` en la página con el diálogo abierto; el error solo muestra `message` | `CloseJobAction.adversarial.test.tsx` `[adversarial]` |
| EC-16 | `useCloseJob` | `busy` + guarda `useRef` | Doble clic en «Cerrar oferta» → **1** `POST` | `CloseJobAction.adversarial.test.tsx` `[adversarial]` |
| EC-17 | `validateJobForm({ published })` + API | validar en cliente; un 400 va junto al campo | «Obligatorio en una oferta publicada.» junto a Descripción (vacía o espacios), Ubicación o Modalidad; sin `PATCH` | `job-form-model.published.test.ts`, `JobFormScreen.published.test.tsx` |
| EC-18 | API | API: ver TECHNICAL_DOC-backend | Inalcanzable desde la web (una cerrada no muestra formulario) | — (backend) |
| EC-19 | `toPatch` | solo lo cambiado | Cambiar solo la banda de una publicada → `PATCH { salaryMin }`; vuelve a la ficha «Publicada» | `JobFormScreen.published.test.tsx` |
| EC-20 | `requestJson` (500) | como EC-22 de HU-01 | `role="alert"`; lo escrito se conserva | `JobFormScreen.published.test.tsx` |
| EC-21 | `job-form-errors.ts` · `DeleteJobAction` (409) | mensaje + recarga (DD-06) | Guardar: `ClosedJobNotice` con el `message`. Borrar: se cierra el diálogo, alerta en la ficha y recarga (ya sin «Borrar») | `JobFormScreen.published.test.tsx`, `DeleteJobAction.test.tsx` `[adversarial]` |
| EC-22 | API/BD | API: ver TECHNICAL_DOC-backend | Sin reacción en la web | — (backend) |
| EC-23 | `toPatch` + API | la web nunca envía `status` ni fechas | `PATCH` sin `status`, `publishedAt` ni `closedAt` | `job-form-model.published.test.ts` |
| EC-24 | `JobActions` + API | no se ofrece «Borrar» fuera de `draft` | Publicada y cerrada sin «Borrar» | `JobDetailScreen.states.test.tsx` |
| EC-25 | `jobUrl` + `ApiError` 404 | nunca un ID inválido; salida en 404 | «Esta oferta ya no existe.» al duplicar | `JobDetailScreen.actions.test.tsx`, `api.test.ts` |
| EC-26 | API | API: ver TECHNICAL_DOC-backend | La ficha nueva muestra el título tal cual lo devuelve la API | `JobDetailScreen.actions.test.tsx` (navega a `/jobs/{nuevo}`) |
| EC-27 | `requestJson` (500) | mostrar y rehabilitar | `role="alert"`; sigue en la ficha original; «Duplicar» habilitado | `JobDetailScreen.actions.test.tsx` |
| EC-28 | API | API: ver TECHNICAL_DOC-backend | Navega a la copia como en CA-14 | — |
| EC-29 | — | N/A — el PRD lo declara N/A | — | — |
| EC-30 | React (escapado) | texto JSX, `pre-wrap` | La descripción con `<script>` se ve literal (test EC-48 de HU-01) | `JobDetailScreen.test.tsx` |
| EC-31 | `useJobActions` | `disabled` + guarda `useRef` | Doble clic en «Duplicar» → **1** `POST` | `JobDetailScreen.actions.test.tsx` `[adversarial]` |
| EC-32 | `list-query.ts` + API | reenviar las 4 claves conocidas en bruto; ignorar las demás (DD-01) | `/jobs?pageSize=abc` → `role="alert"` + «Por página: …» + «Quitar filtros»; `/jobs?sort=title` → listado normal sin `sort` en la petición | `list-query.test.ts`, `JobListScreen.filters-adversarial.test.tsx` |
| EC-33 | `validateSearchText` + API | validar al enviar | `q` con tabulador pegado → «La búsqueda no puede tener caracteres de control.»; sin navegación ni petición | `list-query.test.ts`, `JobListScreen.filters-adversarial.test.tsx` |
| EC-34 | `JobPagination` · `validateSearchText` | `totalPages` con la respuesta | 20 de 20 → sin «Siguiente»; 21 → «Página 1 de 2»; opción 100; `q` de 100 se envía y de 101 da error; página 9 de 2 → «Esta página no tiene ofertas.» | `JobListScreen.pagination.test.tsx`, `list-query.test.ts` |
| EC-35 | API | API: ver TECHNICAL_DOC-backend; la web no normaliza | `q` se envía tal cual (recortado): `GESTIÓN` → `q=GESTI%C3%93N` | `list-query.test.ts` |
| EC-36 | `requestJson` | estado «error»; controles desde la URL | `role="alert"` + «Reintentar»; Estado y texto conservan lo elegido | `JobListScreen.filters-adversarial.test.tsx`, `e2e/jobs-list.spec.ts` |
| EC-37 | API | aceptado (DEC-10) | Pinta en el orden recibido (test EC-37 de HU-01) | `JobListScreen.test.tsx` |
| EC-38 | API | API: ver TECHNICAL_DOC-backend | Sin reacción en la web | — (backend) |
| EC-39 | `toSearch` | `encodeURIComponent` por valor | `%` → `q=%25`; `a&status=closed` → `q=a%26status%3Dclosed` (no inyecta parámetros) | `list-query.test.ts` `[adversarial]` |
| EC-40 | — | N/A — `GET` sin efectos | — | — |
| EC-41 | — | N/A — la ficha no recibe entrada | — | — |
| EC-42 | `JobDetails` | pintar solo las fechas no nulas | `closed`: tres fechas; `draft`: solo creación | `JobDetailScreen.states.test.tsx:82,120` |
| EC-43 | `requestJson` (red) | mostrar y rehabilitar | En «Publicar», «Cerrar oferta» y «Duplicar»: `role="alert"`, estado anterior, botón habilitado | `JobDetailScreen.actions.test.tsx`, `CloseJobAction.adversarial.test.tsx`, `e2e/jobs-lifecycle.spec.ts` |
| EC-44 | `job-form-errors.ts` (409) | mensaje + recarga (DD-06) | `ClosedJobNotice` con el `message`; «Ver la oferta» lleva a la ficha en solo lectura | `JobFormScreen.published.test.tsx`, `e2e/jobs-lifecycle.spec.ts` |
| EC-45 | — | N/A — la base impone la coherencia estado-fechas | — | — |
| EC-46 | React (escapado) | texto JSX | Título con HTML en una `closed`: texto literal, 0 `b` | `JobDetailScreen.states.test.tsx:82,120` `[adversarial]` |
| EC-47 | — | N/A — `GET` | — | — |
| EC-48 | API | API: ver TECHNICAL_DOC-backend; la web no normaliza ni filtra en cliente | `Pena` se envía tal cual; la web pinta lo que devuelva | — (backend) |
| EC-49 | API (DEC-12) | API: ver TECHNICAL_DOC-backend; la web no puede provocarlo (mismo origen por el *proxy* de Vite) | Si llegara un 403 `CROSS_SITE_REQUEST`, se muestra su `message` («Petición no permitida desde otro sitio.») en el `role="alert"` de la acción | — (backend) |

Errores de `useClosePreview`: los mismos textos de `userMessage`; una respuesta 200 sin `activeApplications` entero
≥ 0 → «La respuesta del servidor no es válida. Vuelve a intentarlo.» en el diálogo.

## Threat modeling

| STRIDE | Amenaza concreta en la web | Mitigación | Riesgo residual |
|---|---|---|---|
| Suplantación | — | N/A — sin login (DEC-04) | Ninguno nuevo |
| Suplantación (CSRF) | Otra web abierta en el navegador lanza `POST …/close` sin cuerpo contra la API (lo detalla el backend) | En la API: **DEC-12** (403 a toda petición fuera de los métodos seguros con `Sec-Fetch-Site` `cross-site` o `same-site`). La web llama siempre por el *proxy* de Vite (mismo origen), así que no le afecta | Bajo (DEC-12) |
| Manipulación | XSS con título o descripción en el listado filtrado, la ficha cerrada, el diálogo o el valor de búsqueda (RNF-04) | Solo interpolación JSX; el diálogo no incluye el título; prohibido `dangerouslySetInnerHTML`; tests `[adversarial]` | Bajo (depende de la review) |
| Manipulación | Inyección de parámetros en la query de la API con `q` (`&`, `=`, `%`) | `encodeURIComponent` por valor; solo las 4 claves conocidas (DD-01) | Ninguno |
| Manipulación | URL manipulada (`?pageSize=100000`, `?status=x`, claves repetidas) | La web no confía en la URL: la reenvía y la API valida (400 → alerta); una vista con valores raros se arregla con «Quitar filtros» | Ninguno |
| Repudio | — | N/A — sin usuarios | — |
| Exposición de información | Detalles internos en un 409 o en el 500 del cierre | Solo `error.message` o textos fijos; nunca cuerpo crudo ni `stack` | Ninguno |
| Denegación de servicio | `pageSize` grande o búsquedas largas | La API limita a 100 filas; la web valida `q` ≤ 100 antes de navegar; un doble clic no duplica peticiones | Bajo |
| Elevación de privilegios | Saltarse el estado desde la web (editar una cerrada, borrar una publicada) | La web oculta las acciones, pero **la API decide** con 409 (RF-03); la web muestra el 409 | Ninguno |

## Datos personales

No toca datos personales: la oferta no los contiene (PRD, «Datos personales»; `docs/RGPD.md` §1). Lo nuevo en el
navegador es la query del listado de ofertas (`status`, `q`, `page`, `pageSize`): `q` es texto de búsqueda sobre
títulos de ofertas, no un dato personal, y la API no registra query strings (RNF-06). El diálogo de cierre muestra un
**número agregado** (hoy 0), sin identificar a nadie. `history.state` sigue llevando solo textos fijos (se añade
«Oferta duplicada.»).

**Aviso para HU-03 (candidatos):** `list-query.ts` es de `jobs`. Un buscador de candidatos por nombre o email **no**
puede llevar el texto a la URL (regla de la web: nada de datos personales en la URL); su diseño tendrá que decidirlo.

## Decisiones de diseño

### DD-01: Filtros en la URL; la web reenvía a la API solo las claves conocidas, en bruto
- **Contexto:** DT-06 quiere los filtros en la URL y que una URL inválida muestre el `message` de la API; la web no
  debe inventar parámetros ni dejar que `q` inyecte otros.
- **Opciones consideradas:** A) Validar y normalizar en el cliente todos los parámetros y no llamar a la API si son
  inválidos. B) Reenviar la query string de la URL entera, tal cual. C) Leer solo `status`, `q`, `page` y `pageSize`
  (repetidas incluidas), en orden canónico y con `encodeURIComponent`, y reenviarlas sin validar; ignorar el resto.
- **Elegida:** C, en `apps/web/src/features/jobs/list-query.ts`: `readListQuery(search)`, `toSearch(query)`,
  `listView(query)` (valores tolerantes para los controles), `listPath(change)`, `pagePath(query, page)`,
  `clearFiltersPath(query)`, `hasFilters(query)`, `validateSearchText(raw)`, `totalPages(total, pageSize)`.
  `listRequest(query)` construye la petición a la API: un `pageSize` **válido** que no sea 20, 50 ni 100 (p. ej. 7) se
  pide como 20 (CA-18, `PAGE_SIZES`); uno **inválido** (`abc`, `101`, vacío) va en bruto y la API responde 400.
- **Razón:** una sola fuente de verdad de las reglas (la API, DT-05); la web solo valida `q` al enviar, que es lo que
  escribe la persona; el mismo `toSearch` sirve para la URL de la web y la de la API, y los tests de `fetch` simulado
  casan con una URL exacta.
- **Tradeoff:** `/jobs?sort=title` muestra el listado sin aviso (la API sí da 400 a una llamada directa); con A
  ahorraríamos una petición en URLs inválidas, pero duplicaríamos todas las reglas de DT-05 en el cliente.

### DD-02: Estado y texto se aplican con «Buscar»; «Por página», al cambiar
- **Contexto:** DT-06 fija la búsqueda al enviar; no dice cuándo se aplica el estado ni el tamaño. CA-18 elige 50 y
  espera el cambio.
- **Opciones consideradas:** A) Todo al cambiar (estado y tamaño) y el texto al enviar. B) Todo con «Buscar». C) Estado
  y texto en el `<form>` con «Buscar»; «Por página», fuera del formulario, al cambiar.
- **Elegida:** C.
- **Razón:** un solo momento de aplicar los filtros (no se pierde un texto a medio escribir al cambiar el estado);
  «Por página» es una preferencia de vista, como la paginación, y cambiarla no cambia de contexto (WCAG 3.2.2).
- **Tradeoff:** cambiar solo el estado exige pulsar «Buscar» o Enter: un paso más que A.

### DD-03: Paginación con enlaces y foco al h1 tras cargar
- **Contexto:** cambiar de página es navegar (cambia la URL). `useResource` vuelve a «cargando» al cambiar la query
  (decisión de HU-01: nunca pinta datos viejos), así que el `<nav>` desaparece durante la carga y el foco se perdería.
- **Opciones consideradas:** A) Botones que cambian estado local. B) Enlaces `<Link>` que no se pintan en los bordes y,
  al terminar la carga que ellos provocan, foco al h1 «Ofertas» (`tabIndex={-1}`). C) Mantener la página anterior
  mientras carga (cambiar `useResource`).
- **Elegida:** B. `JobPagination` recibe `onNavigate`, que marca en un `useRef` del contenedor «enfocar tras cargar».
- **Razón:** enlaces reales (abrir en pestaña nueva, «Atrás»), sin tocar la semántica de `useResource`.
- **Tradeoff:** con teclado, tras cada página hay que volver a tabular hasta «Siguiente»; C lo evitaría a costa de
  pintar datos viejos con la URL nueva.

### DD-04: El diálogo de cierre se abre al instante y pide el número dentro
- **Contexto:** DT-01 da el número en una lectura propia; DT-08 fija textos y foco inicial en «Cancelar».
- **Opciones consideradas:** A) Pedir el número antes de abrir y abrir con él. B) Abrir al instante; el número en un
  `<p role="status">` dentro del diálogo y «Cerrar oferta» deshabilitado hasta tenerlo; `ConfirmDialog` gana
  `confirmDisabled` y `children` (opcionales, sin cambiar el borrado).
- **Elegida:** B.
- **Razón:** en A, el botón «Cerrar» se deshabilita mientras pide y el navegador le quita el foco, así que
  `ConfirmDialog` no sabría a quién devolverlo; en B el disparador sigue enfocado al abrir. «Cancelar» funciona desde el
  primer momento y la lectura se aborta al cancelar.
- **Tradeoff:** el número no va en la descripción que se lee al abrir: llega como `status` un instante después. El
  texto pone singular para 1 («Se rechazará 1 inscripción activa.»), un ajuste gramatical sobre DT-08 que hoy no se ve
  (siempre 0).

### DD-05: Publicar y cerrar actualizan la ficha con la respuesta; duplicar navega
- **Contexto:** publicar y cerrar devuelven el `Job` actualizado (S2, S3); duplicar devuelve otro (S4).
- **Opciones consideradas:** A) Tras la acción, volver a pedir `GET /api/jobs/:id` (`retry`). B) `navigate` con
  `replace` y aviso en `history.state`. C) `setData(job)` en `useResource` + aviso local en el contenedor; duplicar,
  `navigate(detail(nuevo), { notice: 'Oferta duplicada.' })` con `push`.
- **Elegida:** C. `JobDetailScreen` monta `JobDetailLoader key={id}` para que el aviso, la alerta y el estado local no
  pasen de una oferta a su copia.
- **Razón:** sin petición extra ni parpadeo de «Cargando»; «Atrás» desde la copia vuelve a la original; un aviso local
  no reaparece al recargar.
- **Tradeoff:** `useResource` (transversal) crece con `setData`; la ficha muestra lo que dijo la respuesta de la acción,
  no una lectura nueva.

### DD-06: Un 409 muestra el `message` de la API y recarga; una cerrada no muestra formulario
- **Contexto:** DT-08: «tras un 409 en una acción o al guardar, se muestra el `message` y se vuelve a cargar la
  ficha». El PRD no dice qué ve quien abre `/jobs/:id/edit` de una cerrada.
- **Opciones consideradas:** A) Al guardar con 409, quedarse en el formulario con lo escrito y un enlace a la ficha.
  B) Navegar a la ficha con un aviso fijo (el `message` de la API no puede ir en `history.state`, que solo lleva textos
  fijos). C) Alerta con el `message` y `retry()` de la oferta en la misma pantalla; en la ficha, las acciones se
  recalculan; en la edición, una oferta `closed` se ve como `ClosedJobNotice`.
- **Elegida:** C (la alerta vive en el contenedor, por encima del recurso, y sobrevive a la recarga).
- **Razón:** cumple DT-08 con el `message` real; cubre también la URL directa de editar una cerrada.
- **Tradeoff:** al guardar, lo escrito se pierde (excepción a «conservar lo escrito»: ya no se puede guardar); A lo
  conservaría pero dejaría un formulario inútil.

### DD-07: Gestión del foco tras las acciones de la ficha
- **Contexto:** el botón pulsado desaparece al publicar o cerrar, y un botón `disabled` pierde el foco.
- **Opciones consideradas:** A) No gestionar el foco. B) `aria-disabled` en vez de `disabled`. C) `disabled` (como
  «Guardar» y el borrado de HU-01); éxito o recarga → foco al h1 de la ficha (`tabIndex={-1}`, `headingRef`); error →
  foco de vuelta al botón (ref en `useJobActions`); al cancelar el diálogo, `ConfirmDialog` ya lo devuelve.
- **Elegida:** C. Los efectos de foco no llaman a `setState`.
- **Razón:** el foco nunca acaba en `<body>`; coherente con HU-01.
- **Tradeoff:** más código de refs; B sería más simple, pero los botones seguirían pareciendo activos sin estilos
  extra y rompería la convención de HU-01.

### DD-08: Obligatorios de una publicada validados también en el cliente
- **Contexto:** RF-03 pide marcar como obligatorios título, descripción, ubicación y modalidad al editar una publicada;
  la API responde 400 con «Obligatorio en una oferta publicada.».
- **Opciones consideradas:** A) Solo marcarlos y confiar en el 400. B) `validateJobForm(values, { published: true })`
  con el mismo mensaje que la API, etiquetas «(obligatorio)» y `required`.
- **Elegida:** B.
- **Razón:** error junto al campo sin ida y vuelta; el 400 del servidor sigue pintándose igual (mismo camino de HU-01).
- **Tradeoff:** el mensaje está en dos sitios (API y `job-form-model.ts`); si el backend lo cambia, hay que cambiar los
  dos (supuesto S6).

### DD-09: e2e sobre la base regenerada, con títulos fijos, datos propios creados por la API y sin depender de la paginación
- **Contexto:** `data/e2e.db` se regenera en **cada ejecución** en el comando del `webServer` de la API (DD-08 de
  HU-01), con el seed nuevo de 10 ofertas (S8). En HU-01 el aprobador descartó depender de títulos únicos (generados o
  aleatorios): los e2e usan **títulos fijos** y el estado de partida es conocido. Los ficheros nuevos se ejecutan antes
  que `jobs.spec.ts` (orden alfabético, `workers: 1`) y crean ofertas; con más de 20 en total, lo que un test busca en
  la página 1 del listado sin filtros puede pasar a la página 2.
- **Opciones consideradas:** A) Crear todo por la interfaz. B) Regenerar la base antes de cada test. C) Títulos fijos
  (constantes en cada *spec*); los datos que el flujo no prueba se preparan con `page.request` (`POST /api/jobs` y
  `…/publish`, `…/close`); toda comprobación sobre el listado usa un filtro (`status`, `q`) o `pageSize=100`, nunca la
  página 1 por defecto.
- **Elegida:** C. Concretamente:
  - `e2e/jobs.spec.ts`: el test del seed va a `/jobs?status=draft&pageSize=100`; EC-08 comprueba «Analista de datos
    junior» en `/jobs?pageSize=100`.
  - `e2e/jobs-list.spec.ts`, CA-16: crea por la API «GESTIÓN de proveedores» (publicada), «Técnico/a de gestión
    administrativa» (borrador) y «Coordinador/a de gestión de eventos» (cerrada); en la interfaz, Estado «Publicada» y
    «gestion» → exactamente «GESTIÓN de proveedores» y la del seed «Responsable de gestión de nóminas», en ese orden.
    Ningún otro *spec* usa «gestión» en un título.
  - `e2e/jobs-list.spec.ts`, CA-18: crea y publica por la API «Oferta de paginación 01» a «Oferta de paginación 21»;
    con Estado «Publicada» y «Oferta de paginación» hay 21 resultados: «Página 1 de 2», «Siguiente» (1 fila), «Por
    página» 50 (21 filas, página 1) y «Atrás».
  - `e2e/jobs-lifecycle.spec.ts`: crea sus ofertas por la interfaz (el flujo es lo que se prueba) con títulos fijos.
  - Total al final de la ejecución: ~47 ofertas (10 del seed + 21 + 3 + las de los flujos), por debajo de 100.
- **Razón:** determinista en cualquier portátil (base regenerada + títulos fijos + un *worker*), sin depender del orden
  de los ficheros ni del tamaño de página; 21 ofertas por la interfaz harían el test lento; B choca con DD-08 de HU-01
  (la API tiene la base abierta).
- **Tradeoff:** algunos e2e dependen de las rutas de la API para preparar datos, y los títulos fijos obligan a no
  reutilizar palabras de filtro («gestión», «Oferta de paginación») entre *specs*. Los totales del listado sin filtros
  no se afirman en e2e (los prueban el backend y Vitest).

## Impacto en decisiones

| DEC | Cómo se aplica |
|---|---|
| DEC-01 | El cliente interpreta el envelope también en los 409 y en el 500 del cierre |
| DEC-04 | Sin login; la seguridad se centra en XSS, la query y no confiar en la web para el estado |
| DEC-05 | **Sin dependencias nuevas**: no hace falta `DEC-NN` |
| DEC-06 | La web no sabe nada de `inscripciones`: solo pinta el número que da la API (DT-01) |
| DEC-07 | La web distingue 400 (campo o «falta»), 404 (ya no existe), 409 (mensaje + recarga) y 5xx (alerta) |
| DEC-08 | Doble clic bloqueado en todas las acciones; un 200 repetido se trata como éxito |
| DEC-09 | Fechas de publicación y cierre con `formatDate` (Europe/Madrid) |
| DEC-10 | `page`, `pageSize` 20/50/100 y `{ items, total, page, pageSize }`; la web no busca ni normaliza en el cliente |
| DEC-11 | La web envía los numéricos de la query como texto, tal cual la URL (punto 2) |
| DEC-12 | La web no cambia: mismo origen por el *proxy* de Vite |

Sin contradicciones. `/module-sync` recogerá en `docs/05_modules/ofertas/technical.md` las pantallas nuevas,
`list-query.ts`, `useSearch`, `setData` y las props nuevas de `ConfirmDialog`.

## Estrategia de tests

Vitest + Testing Library en `apps/web/test/` (jsdom), como HU-01: consultas por rol y *label*, `fetch` simulado con
`mockFetch` (`apps/web/test/helpers/fetch.ts`, URL exacta con query), `fireEvent`, *polyfill* de `<dialog>`
(`apps/web/test/helpers/dialog.ts`). Datos inventados. Se simula solo la red.

| RF | Vitest (fichero → qué) | Playwright |
|---|---|---|
| RF-01 | `JobDetailScreen.actions.test.tsx` → publicar: 200 → «Oferta publicada.», «Publicada», fecha 06/10/2026, acciones Editar/Cerrar/Duplicar y foco al h1 (CA-01); 400 → «Para publicar falta: Descripción, Modalidad.» + «Editar», sigue Borrador (CA-03, EC-02); 409 → alerta + recarga; 404 (EC-06); 500 y red (EC-05, EC-43); `[adversarial]` doble clic = 1 `POST` (EC-09). `api.test.ts` → `publishJob` sin cuerpo (EC-01) | `jobs-lifecycle.spec.ts`: CA-01 completo (híbrida, Valencia, 32 000-40 000); CA-03 solo título; EC-43 con `page.route('**/publish', abort)` |
| RF-02 | `CloseJobAction.test.tsx` → foco en «Cancelar», «Comprobando…» y confirmar deshabilitado, «Se rechazarán 0 inscripciones activas.» (CA-05, EC-11); cancelar y `simulateCancel` sin `POST` y con la lectura abortada (CA-06); 200 → ficha cerrada (CA-05, EC-13); 500 → alerta en el diálogo, sigue publicada (CA-09, EC-12); error de la lectura; 409 y 404; `CloseJobAction.adversarial.test.tsx` → `[adversarial]` doble clic = 1 `POST` (EC-16), título hostil (EC-15) y red al confirmar (EC-43). `ConfirmDialog.test.tsx` → `confirmDisabled` y `children`. `labels.test.ts` → `activeApplicationsText` 0/1/2 | `jobs-lifecycle.spec.ts`: «Cerrar» → foco en «Cancelar» → `Escape` (sigue publicada) → «Cerrar oferta» → solo lectura con fecha de cierre (CA-05, CA-06) |
| RF-03 | `JobFormScreen.published.test.tsx` → etiquetas «(obligatorio)»; descripción en espacios → error sin `PATCH` (CA-11, EC-17); 400 del servidor junto al campo; solo banda (EC-19); 500 (EC-20); 409 → `ClosedJobNotice` con el `message` (CA-12, EC-21, EC-44); URL de una cerrada → `ClosedJobNotice` sin formulario (CA-10). `job-form-model.published.test.ts` → reglas y `toPatch` sin `status` (EC-23). `DeleteJobAction.test.tsx` → `[adversarial]` 409 → `onConflict` (EC-21) | `jobs-lifecycle.spec.ts`: CA-11 en la interfaz; CA-12/EC-44 con dos páginas (una cierra, la otra guarda) |
| RF-04 | `JobDetailScreen.actions.test.tsx` → 201 → navega a `/jobs/{nuevo}` con «Oferta duplicada.» y la original no se toca (CA-14, CA-15, EC-26); 404 (EC-25); 500 (EC-27); `[adversarial]` doble clic = 1 `POST` (EC-31). `api.test.ts` → `duplicateJob` | `jobs-lifecycle.spec.ts`: duplicar la cerrada → ficha nueva «Borrador», mismo título, sin fecha de publicación; la original sigue cerrada (`page.request`) (CA-14) |
| RF-05 | `list-query.test.ts` → lectura, orden canónico, omisión de valores por defecto, claves desconocidas fuera (EC-32), `encodeURIComponent` `[adversarial]` (EC-39), `q` 100/101 y control (EC-33, EC-34), sin normalizar (EC-35), `totalPages`. `JobListScreen.filters.test.tsx` → enviar Estado + texto navega a `/jobs?status=published&q=gestion` y pide esa URL (CA-16); solo opciones 20/50/100 y `pageSize=7` en la URL → petición con 20 y selector en 20 (CA-18, `:94`, `:123`); 400 con `details` + «Quitar filtros» sin «Reintentar» (CA-19 a CA-21 vistos desde la web, `:166`); vacío con filtros + «Quitar filtros»; «Atrás» resincroniza los controles. `JobListScreen.pagination.test.tsx` → «Siguiente» → `page=2`, foco al h1 (CA-18); «Por página» 50 → página 1 y mismo filtro (CA-18); 20 de 20 sin «Siguiente», 21 con «Página 1 de 2» (EC-34); página más allá (CA-17). `JobListScreen.filters-adversarial.test.tsx` → `[adversarial]` URL hostil (EC-32); `q` con control (EC-33); red con controles conservados (EC-36). `router.test.tsx` → `useSearch` | `jobs-list.spec.ts` (DD-09): CA-16 con Estado «Publicada» y «gestion» → «GESTIÓN de proveedores» y la del seed; CA-18 con «Oferta de paginación 01-21» publicadas (siguiente, 50 por página, «Atrás»); EC-36 con `page.route` abortado al filtrar; `/jobs?pageSize=101` → alerta + «Quitar filtros» |
| RF-06 | `JobDetailScreen.test.tsx` → draft: 4 acciones y solo fecha de creación (CA-23). `JobDetailScreen.states.test.tsx:82,120` → sin «Editar» en una cerrada (CA-10); published: 3 acciones, dos fechas y sin «Borrar» (EC-24); closed: solo «Duplicar», tres fechas y aviso de solo lectura (CA-22, EC-42); 22:30Z → 07/10/2026 (EC-04, EC-11); `[adversarial]` HTML en una cerrada (EC-46). `use-resource.test.tsx` → `setData` | `jobs-lifecycle.spec.ts`: acciones por estado a lo largo del ciclo (CA-22, CA-23) |

**Tests de HU-01 que cambian:**

- `apps/web/test/features/jobs/JobDetailScreen.test.tsx:69` («solo «Editar» y «Borrar»», CA-19 de HU-01): el borrador
  gana «Publicar» y «Duplicar»; pasa a esperar 4 controles en ese orden (CA-23). El test de 404 sigue sin «Borrar».
- `apps/web/test/features/jobs/JobListScreen.test.tsx`: el test de 21 ofertas («Se muestran las 20 más recientes de
  21.») se sustituye por «Página 1 de 2» y «Siguiente»; el de 20 comprueba que no hay «Siguiente». El resto sigue con
  `GET /api/jobs` sin query (URL por defecto).
- `apps/web/test/features/jobs/api.test.ts:49` («sin parámetros (EC-34)»): `listJobs([])` sigue llamando a
  `/api/jobs`; se añade el caso con query.
- `e2e/jobs.spec.ts`: el test del seed va a `/jobs?status=draft&pageSize=100` y EC-08 comprueba «Analista de datos
  junior» en `/jobs?pageSize=100` (DD-09). `SEED_TITLES` no cambia: el backend conserva los 4 borradores y su orden
  relativo (S8).

**E2E deterministas:** cada `npm run e2e` regenera `data/e2e.db` con el seed nuevo (10 ofertas: 4 borradores, 4
publicadas y 2 cerradas). Los tests usan títulos fijos y crean sus datos (por la interfaz o, si no es el flujo
probado, por la API); toda comprobación del listado va con filtro o `pageSize=100`, nunca sobre la página 1 sin
filtros (DD-09). La fecha esperada de publicación o cierre se calcula en el test con
`Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid' })` sobre el `publishedAt`/`closedAt` que devuelve la API, no
con el reloj del portátil. CA-02, CA-04, CA-07, CA-08, CA-13 (parte API), CA-19 a CA-21 (parte API) y CA-24 son de API
pura: los prueba el backend con `fastify.inject`.

**Criterio → test (parte web):** CA-01 → `JobDetailScreen.actions.test.tsx` + e2e; CA-03 → `JobDetailScreen.actions`
+ e2e; CA-05, CA-06, CA-09 → `CloseJobAction.test.tsx` + e2e (CA-05, CA-06); CA-10 → `JobDetailScreen.states.test.tsx:82` (sin
«Editar») + `JobFormScreen.published.test.tsx`; CA-11, CA-12 → `JobFormScreen.published.test.tsx` + e2e; CA-13 →
`JobDetailScreen.states.test.tsx` (sin «Borrar») + `DeleteJobAction.test.tsx` (409); CA-14, CA-15 →
`JobDetailScreen.actions.test.tsx` + e2e (CA-14); CA-16 → `JobListScreen.filters.test.tsx` + e2e; CA-17 →
`JobListScreen.pagination.test.tsx`; CA-18 → `JobListScreen.pagination.test.tsx` y
`JobListScreen.filters.test.tsx:94,123` + e2e; CA-19 a CA-21 → `JobListScreen.filters.test.tsx:166` (400 mostrado) +
e2e (`pageSize=101`); CA-22 → `JobDetailScreen.states.test.tsx:82,120` + e2e; CA-23 → `JobDetailScreen.test.tsx` + e2e.

## Checklist de implementación

Orden: tipos y cliente → presentacionales → contenedores → tests (cada paso con sus tests de Vitest).

1. **Transversal:** `router.tsx` (`useSearch`, «Oferta duplicada.»), `use-resource.ts` (`setData`),
   `ConfirmDialog.tsx` (`confirmDisabled`, `children`) + `router.test.tsx`, `use-resource.test.tsx`,
   `ConfirmDialog.test.tsx`.
2. **Cliente y URL:** `types.ts` (`ClosePreview`), `api.ts` (5 funciones), `list-query.ts`, `labels.ts` +
   `api.test.ts`, `list-query.test.ts`, `labels.test.ts`.
3. **Ficha por estado:** `JobDetails.tsx` (fechas, aviso, `headingRef`) y `JobActions.tsx` con botones sin lógica +
   cambios en `JobDetailScreen.test.tsx` (CA-23) y `JobDetailScreen.states.test.tsx` (CA-10, CA-22, EC-42, EC-46).
4. **Publicar y duplicar:** `use-job-actions.ts` + contenedor `JobDetailScreen.tsx` (`key`, aviso local, alerta,
   «ya no existe», foco) + `JobDetailScreen.actions.test.tsx` `[adversarial]`.
5. **Cerrar:** `CloseJobAction.tsx` + `CloseJobAction.test.tsx` y `CloseJobAction.adversarial.test.tsx`
   `[adversarial]`.
6. **Editar y borrar según el estado:** `job-form-model.ts` (`published`), `JobForm.tsx`, `job-form-errors.ts`
   (extraído), `JobFormScreen.tsx` (409, `ClosedJobNotice`), `DeleteJobAction.tsx` (`onConflict`) + tests
   `job-form-model.published.test.ts`, `JobFormScreen.published.test.tsx`, `DeleteJobAction.test.tsx` `[adversarial]`.
7. **Listado:** `JobFilters.tsx`, `JobPagination.tsx`, `JobListScreen.tsx`, `styles.css` + cambios en
   `JobListScreen.test.tsx`, `JobListScreen.filters.test.tsx`, `JobListScreen.pagination.test.tsx` y
   `JobListScreen.filters-adversarial.test.tsx` `[adversarial]` (URL manipulada).
8. **E2E** (cuando el backend esté integrado): ajustes de `e2e/jobs.spec.ts`, `e2e/jobs-lifecycle.spec.ts` y
   `e2e/jobs-list.spec.ts`; dos `npm run e2e` seguidos con el mismo resultado.

Umbrales: `JobFormScreen.tsx` baja de 194 líneas al extraer `job-form-errors.ts` antes de crecer; los tests nuevos van
en ficheros hermanos para que ninguno pase de 300 (`JobListScreen.test.tsx` 205, `job-form-model.test.ts` 258,
`JobFormScreen.test.tsx` 282 ya están cerca).

## Riesgos

| Riesgo | Probabilidad (1–5) | Impacto (1–5) | Mitigación |
|---|---|---|---|
| El contrato del backend cambia durante la implementación (mensajes de los 409 o de los 400 del listado) | 2 | 2 | Contrato cruzado (S1-S8 casan); la web muestra el `message` que llegue y no compara textos salvo «Obligatorio en una oferta publicada.» (DD-08); un cambio se queda en `api.ts`, `types.ts`, `labels.ts` y `job-form-model.ts` |
| DEC-12 bloquea una escritura legítima de la web (403) | 1 | 3 | La web va por el *proxy* de Vite (`same-origin`); un 403 se muestra con su `message` en `role="alert"`; los e2e de escritura lo detectarían |
| Los e2e de HU-01 fallan porque el seed nuevo o los ficheros nuevos empujan los borradores a la página 2 | 4 | 3 | DD-09: `?status=draft&pageSize=100` y `?pageSize=100`; las comprobaciones del listado siempre con filtro |
| El backend cambia los títulos o fechas de los 4 borradores del seed (S8) | 2 | 2 | `SEED_TITLES` en `e2e/jobs.spec.ts` se actualiza junto a `apps/api/src/db/seed.ts` |
| Fecha de publicación o cierre en e2e distinta cerca de medianoche (UTC vs Madrid) | 2 | 2 | El test calcula la fecha esperada desde la respuesta de la API con `Intl` y Europe/Madrid |
| El aviso local y el de `history.state` se mezclan al pasar de una oferta a su copia | 2 | 2 | `key={id}` en `JobDetailLoader` (DD-05) y test de duplicar que comprueba solo «Oferta duplicada.» |
| Pérdida de foco en lectores de pantalla al paginar o tras una acción | 2 | 2 | DD-03 y DD-07 con tests de `document.activeElement`; revisión manual en `/qa-e2e` |
| `setState` en efectos al resincronizar el formulario con la URL (lint de hooks v7) | 3 | 1 | Patrón «ajustar el estado durante el render», ya usado en `use-resource.ts` |

## Open Decisions

No hay decisiones abiertas.

## Fuera de scope

- Rechazo de inscripciones al cerrar y número real de inscripciones activas (HU-05); la web ya pinta el número de la API.
- Reabrir o despublicar; enlace entre una copia y su original.
- Filtrar por ubicación o modalidad, ordenar por otra columna, buscar en la descripción.
- Aviso de cambios sin guardar al salir del formulario (como en HU-01).
- Listado de candidatos y su buscador (HU-03): ver el aviso de «Datos personales».
