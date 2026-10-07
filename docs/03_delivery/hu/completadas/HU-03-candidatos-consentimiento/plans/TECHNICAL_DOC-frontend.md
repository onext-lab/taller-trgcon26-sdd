# HU-03 — Alta, edición y búsqueda de candidatos, con consentimiento — Diseño técnico (frontend)

- **Origen:** `specs/PRD.md` (estado Ready, v2, 2026-10-06)
- **Generado por:** frontend-architect
- **Scope cubierto:** RF-01 a RF-06 (parte web) y RNF-06, RNF-07 y RNF-09. RF-07 (fórmula) y RF-08 (seed) son solo
  backend; aquí solo afectan a lo que muestra la ficha y a los e2e.

## Enfoque técnico

Nace `apps/web/src/features/candidates/` con el mismo patrón que `jobs` tras HU-02 (contenedor → presentacionales,
cliente `api.ts` sobre `requestJson`, `useResource`, `FormField`, `ConfirmDialog`, `StatusMessages`), **sin
dependencias nuevas**. Tres pantallas: listado con búsqueda, formulario (alta y edición) y ficha con la sección de
consentimiento.

Lo que cambia respecto a ofertas, por DT-10:

- **Filtros fuera de la URL (DT-10 c):** el listado guarda su búsqueda aplicada (`q`, skill, página y tamaño) en un
  almacén **en memoria del módulo** (`list-state.ts`), no en la URL, ni en `history.state`, ni en `sessionStorage`.
  Al volver a la lista (enlace de la navegación, «Atrás», «Volver a los candidatos») se restaura la última búsqueda;
  al recargar la página o abrir otra pestaña empieza vacía (DD-01). La paginación usa **botones**, no enlaces, porque
  no navega (DD-02).
- **Título genérico (DT-10 a):** cada pantalla fija su título con un texto constante (`useDocumentTitle`), nunca el
  nombre del candidato; el nombre sí puede ir en el `h1` de la ficha, que no sale de la pantalla (DD-08).
- **Rutas solo con ID (DT-10 c):** `/candidates`, `/candidates/new`, `/candidates/:id` y `/candidates/:id/edit`.
- **Duplicado por email (DT-10 b):** el 409 se pinta junto al email con el `message` de la API y un enlace por ID a la
  ficha existente, sin pedir ni mostrar nada de ella (DD-06).

Antes de crear la feature, se **mueven a `apps/web/src/components/`** las piezas de `jobs` que candidatos necesita tal
cual o con un parámetro (DD-03): validación de texto de filtro y tamaños de página, `Pagination`, `PageSizeSelect`,
reparto de `details` por campo, `useDocumentTitle`, `useLifetimeSignal` y `parseRouteId`. `jobs` las importa desde
allí y conserva sus nombres públicos (re-exportados), así que sus tests no cambian.

**Alternativa principal descartada:** copiar el patrón de ofertas con los filtros en la URL. Es lo que ya funciona,
pero DT-10 lo prohíbe: la URL va al historial del navegador y `q` puede ser un nombre o un email.

## Dependencias

- **Contrato de API:** lo fija la sección «Contrato de API» de
  `docs/03_delivery/hu/HU-03-candidatos-consentimiento/plans/TECHNICAL_DOC-backend.md`, y la web lo consume tal cual.
  Este documento se diseñó contra el PRD (§Interfaces, DT-09, DT-10, RF-01 a RF-06) con los supuestos S1-S10, que se
  **cruzaron con el TD-backend el 2026-10-06: todos casan**; la columna «Supuesto» resume lo que usa la web (manda el
  backend). Si cambia, solo se tocan `apps/web/src/features/candidates/types.ts`, `api.ts`, `consent.ts` y, para S5,
  `apps/web/src/components/http.ts`.

| # | Elemento | Supuesto de la web | Estado |
|---|---|---|---|
| S1 | Ficha `Candidate` (201 del alta, 200 de `GET /:id`, `PATCH` y consentimiento) | 11 campos, siempre presentes: `id` (entero > 0), `fullName`, `email`, `phone` (`string \| null`), `summary` (`string \| null`), `skills` (`string[]`, quizá vacío), `createdAt` (ISO UTC), `consentGivenAt` (ISO UTC \| `null`), `consentVersion` (`string \| null`), `consentWithdrawnAt` (ISO UTC \| `null`), `retentionEndsAt` (`AAAA-MM-DD` \| `null`; el PRD fija este nombre) | Casa («Tipos de respuesta») |
| S2 | `POST /api/candidates` | Cuerpo `{ fullName, email, phone?, summary?, skills?, consent }`, con `consent` booleano; un opcional vacío se omite. 201 `Candidate` · 400 `VALIDATION_ERROR` · 403 `CROSS_SITE_REQUEST` · 409 `DUPLICATE` (S5) · 413 · 415 · 500 `INTERNAL_ERROR` | Casa (`consent` sin coerción: «Debe ser verdadero o falso.») |
| S3 | `GET /api/candidates` | Query `q`, `skill`, `page`, `pageSize` (texto). 200 `{ items, total, page, pageSize }`, con cada elemento **exactamente** `{ id, fullName, email, skills }` (RNF-04) · 400 · 500 | Casa |
| S4 | `PATCH /api/candidates/:id` | Subconjunto de `fullName`, `email`, `phone`, `summary`, `skills`; `null` vacía `phone` o `summary`; `skills: []` las vacía; `{}` → 400. 200 `Candidate` · 400 · 403 · 404 · 409 `DUPLICATE` · 413 · 415 · 500 | Casa (`fullName`/`email` no admiten `null`; `consent` prohibido en `PATCH`) |
| S5 | 409 `DUPLICATE` | `details: [{ field: 'email', message: 'Ya existe un candidato con este email.', existingId: 42 }]`: un único elemento en `email` con el ID del existente en una clave numérica `existingId`. El `message` no repite el email | Casa: «Errores específicos» del backend fija exactamente esta forma (`ErrorDetail.existingId`, su tarea B-01) |
| S6 | `POST /api/candidates/:id/consent` | Sin cuerpo ni `Content-Type` (como las acciones de ofertas). 200 `Candidate` con fecha y versión nuevas · 400 · 403 · 404 · 500 | Casa (`rejectBody`) |
| S7 | `POST /api/candidates/:id/consent/withdrawal` | Sin cuerpo. 200 `Candidate` (también sin cambios si no había consentimiento vigente) · 400 · 403 · 404 · 500 | Casa (DD-09 del backend) |
| S8 | Límites de `skill` en el listado | Recortado; ≤ 40 caracteres y sin caracteres de control (los de una skill, RF-02); `q` ≤ 100 y sin control (RF-04) | Casa |
| S9 | `details` acotado (DEC-11.4 enmendada, RNF-08) | Un elemento por campo del esquema con `field` = nombre del campo (`skills` para cualquier `skills/N`); las claves desconocidas, en un solo elemento cuyo `field` **no** es un campo del formulario | Casa: los de solo lectura salen con su nombre y «Campo no permitido.»; el resto, en `{ field: 'body', message: 'Hay campos no permitidos.' }`. Ninguno es campo del formulario → alerta |
| S10 | Texto y versión del consentimiento | El texto de DT-01 y la versión `v1`, iguales a la constante de la API (DD-04) | Casa (DD-07 del backend) |

- **DEC-12:** la web va al mismo origen por el *proxy* de Vite (`same-origin`), así que no cambia nada; un 403
  `CROSS_SITE_REQUEST` inesperado se muestra como cualquier error con envelope (alerta con su `message`), sin perder
  lo escrito.
- **Los e2e dependen del backend completo** (rutas, migración y seed de DT-08: 10 ofertas y 30 candidatos); los tests
  de Vitest, no (simulan `fetch`).

## Módulos y ficheros afectados

Líneas: estimación tras el cambio (umbral ≤ 300 por fichero y ≤ 50 por función).

| Módulo | Fichero | Cambio |
|---|---|---|
| transversal | `apps/web/src/components/list-controls.ts` | **nuevo** (~70): `DEFAULT_PAGE_SIZE`, `PAGE_SIZES`, `totalPages`, `hasControlCharacter`, `validateFilterText(raw, { maxLength, tooLong, control })` y `validateSearchText` con sus textos (salen de `jobs/list-query.ts`) |
| transversal | `apps/web/src/components/Pagination.tsx` | **nuevo** (~45): `<nav aria-label="Paginación">` con «Página N de M (X {noun})»; los pasos «Anterior»/«Siguiente» los pinta `renderStep(target, label)` (enlace en ofertas, botón en candidatos) |
| transversal | `apps/web/src/components/PageSizeSelect.tsx` | **nuevo** (~30): selector «Por página» (20, 50, 100) con `value` y `onChange(size)`; sale de `JobFilters.tsx` |
| transversal | `apps/web/src/components/form-errors.ts` | **nuevo** (~45): `splitValidationDetails(error, isField)` (400 → errores por campo + alerta del resto) y `focusFirstError(form, order, errors)`, genéricos |
| transversal | `apps/web/src/components/use-document-title.ts` | **nuevo** (~15): `useDocumentTitle(title \| null)` → «{title} · ATS»; sale de `JobDetailScreen.tsx` |
| transversal | `apps/web/src/components/use-lifetime-signal.ts` | **nuevo** (~20): sale de `use-job-actions.ts` sin cambios |
| transversal | `apps/web/src/components/router.tsx` | modificar (~110): `'Candidato creado.'` en `NoticeText`/`NOTICES`; `parseRouteId(text)` (regla de `parseJobId`) |
| transversal | `apps/web/src/components/http.ts` | modificar (~150): `ApiErrorDetail.existingId?: number`, que `toEnvelopeError` conserva solo si es entero seguro > 0 (S5) |
| transversal | `apps/web/src/components/format.ts` | modificar (~40): `formatCalendarDate('2027-04-06')` → «06/04/2027», sin zona horaria; otro formato → «Fecha no válida» |
| transversal | `apps/web/src/App.tsx` | modificar (~115): 4 rutas de candidatos (`/candidates/new` antes de `/candidates/:id`) con títulos fijos y el enlace «Candidatos» en la navegación, con `aria-current` en el listado |
| transversal | `apps/web/src/styles.css` | modificar: sección de consentimiento y casilla junto a su texto |
| jobs | `apps/web/src/features/jobs/list-query.ts` | modificar (~110): importa y re-exporta lo movido a `list-controls.ts` (mismos nombres públicos) |
| jobs | `apps/web/src/features/jobs/JobPagination.tsx` | modificar (~25): envoltorio de `Pagination` con enlaces; mismo texto y props |
| jobs | `apps/web/src/features/jobs/JobFilters.tsx` | modificar (~85): usa `PageSizeSelect` |
| jobs | `apps/web/src/features/jobs/job-form-errors.ts` | modificar (~35): delega en `components/form-errors.ts`; misma API pública |
| jobs | `apps/web/src/features/jobs/use-job-actions.ts` · `JobDetailScreen.tsx` · `JobFormScreen.tsx` · `paths.ts` | modificar: importan `useLifetimeSignal`, `useDocumentTitle` y `parseRouteId` de `components/`; sin cambio de comportamiento |
| candidates | `apps/web/src/features/candidates/types.ts` | **nuevo** (~70): `Candidate`, `CandidateListItem`, `CandidatePage`, `CandidateInput`, `CandidatePatch` (S1-S4) |
| candidates | `apps/web/src/features/candidates/api.ts` | **nuevo** (~150): `listCandidates`, `getCandidate`, `createCandidate`, `updateCandidate`, `registerConsent`, `withdrawConsent`; `isCandidate`, `isCandidatePage`; `candidateListUrl(query)` |
| candidates | `apps/web/src/features/candidates/paths.ts` | **nuevo** (~15): `candidatePaths` y `parseCandidateId` (sobre `parseRouteId`) |
| candidates | `apps/web/src/features/candidates/consent.ts` | **nuevo** (~40): `CONSENT_TEXT` (DT-01), `CONSENT_VERSION = 'v1'`, `consentStatus(c)` → `'active' \| 'withdrawn' \| 'none'` y `consentSummary(c)` |
| candidates | `apps/web/src/features/candidates/list-state.ts` | **nuevo** (~30): `CandidateListQuery`, `INITIAL_LIST_QUERY`, `readListState()`, `saveListState(q)` (DD-01) |
| candidates | `apps/web/src/features/candidates/CandidateListScreen.tsx` | **nuevo** (~170): contenedor del listado |
| candidates | `apps/web/src/features/candidates/CandidateFilters.tsx` | **nuevo** (~110): formulario `role="search"` y «Por página» |
| candidates | `apps/web/src/features/candidates/CandidateTable.tsx` | **nuevo** (~45): tabla «Candidatos» |
| candidates | `apps/web/src/features/candidates/candidate-form-model.ts` | **nuevo** (~210): valores, `validateCandidateForm`, `parseSkills`, `toCreateInput`, `candidateToForm`, `toPatch` |
| candidates | `apps/web/src/features/candidates/candidate-form-errors.ts` | **nuevo** (~50): `splitCandidateServerError` → `{ fields, form?, duplicateId? }` |
| candidates | `apps/web/src/features/candidates/CandidateForm.tsx` | **nuevo** (~190): formulario presentacional (alta y edición) |
| candidates | `apps/web/src/features/candidates/CandidateFormScreen.tsx` | **nuevo** (~200): contenedores de alta y edición y `useCandidateSubmission` |
| candidates | `apps/web/src/features/candidates/CandidateDetailScreen.tsx` | **nuevo** (~140): contenedor de la ficha y `CandidateNotFound` |
| candidates | `apps/web/src/features/candidates/CandidateDetails.tsx` | **nuevo** (~70): `h1` y `<dl>` de la ficha |
| candidates | `apps/web/src/features/candidates/ConsentSection.tsx` | **nuevo** (~130): sección «Consentimiento para futuros procesos» con casilla, «Renovar consentimiento» y `ConfirmDialog` |
| candidates | `apps/web/src/features/candidates/use-consent-actions.ts` | **nuevo** (~130): registrar, renovar y retirar; estado, guarda de doble envío, errores y foco |
| tests | `apps/web/test/components/list-controls.test.ts` · `Pagination.test.tsx` · `form-errors.test.ts` (**nuevos**) · `http.test.ts` · `format.test.ts` · `router.test.tsx` | piezas compartidas, `existingId`, `formatCalendarDate`, aviso nuevo y `parseRouteId` |
| tests | `apps/web/test/features/candidates/api.test.ts` · `candidate-form-model.test.ts` (**nuevos**) | cliente y modelo del formulario |
| tests | `apps/web/test/features/candidates/CandidateListScreen.test.tsx` · `CandidateListScreen.filters.test.tsx` · `CandidateListScreen.adversarial.test.tsx` (**nuevos**) | listado |
| tests | `apps/web/test/features/candidates/CandidateFormScreen.test.tsx` · `CandidateFormScreen.edit.test.tsx` · `CandidateFormScreen.adversarial.test.tsx` (**nuevos**) | formulario |
| tests | `apps/web/test/features/candidates/CandidateDetailScreen.test.tsx` · `CandidateDetailScreen.consent.test.tsx` · `CandidateDetailScreen.adversarial.test.tsx` (**nuevos**) | ficha y consentimiento |
| tests | `apps/web/test/App.test.tsx` | modificar: enlace «Candidatos» y título de las rutas nuevas |
| e2e | `e2e/candidates.spec.ts` · `e2e/candidates-list.spec.ts` | **nuevos** (DD-11) |

## Pantallas y estados

Rutas y títulos del documento (los fija `resolveScreen` al navegar y cada pantalla con `useDocumentTitle` en la
carga directa; **nunca** llevan el nombre):

| Ruta | Pantalla | `document.title` |
|---|---|---|
| `/candidates` | `CandidateListScreen` | «Candidatos · ATS» |
| `/candidates/new` | `CandidateFormScreen mode="create"` | «Nuevo candidato · ATS» |
| `/candidates/:id` | `CandidateDetailScreen` | «Ficha de candidato · ATS» (también cargando y con error); «Candidato no encontrado · ATS» si no existe |
| `/candidates/:id/edit` | `CandidateFormScreen mode="edit"` | «Editar candidato · ATS» (siempre) |

Navegación: `<nav aria-label="Principal">` gana el enlace «Candidatos» tras «Ofertas»; `aria-current="page"` en
`/candidates`.

### Listado (`/candidates`, sin query)

`CandidateListScreen` (contenedor: lee `list-state.ts`, pide con `useResource`, guarda cada búsqueda aplicada) →
`CandidateFilters`, `CandidateTable`, `Pagination`, `StatusMessages`.

| Estado | Qué se ve |
|---|---|
| Siempre | h1 «Candidatos» (`tabIndex={-1}`), aviso de llegada si lo hay, enlace «Nuevo candidato», formulario de búsqueda y «Por página» con los valores de la búsqueda aplicada |
| Cargando | `role="status"` «Cargando candidatos…»; ni tabla ni paginación |
| Vacío sin filtros (`total` 0, sin `q` ni skill) | «Todavía no hay candidatos.» |
| Vacío con filtros (`total` 0 con `q` o skill) | «Ningún candidato coincide con la búsqueda.» (CA-18) |
| Error (red, *timeout*, 4xx, 5xx, forma inesperada) | `ErrorMessage`: `role="alert"` con `userMessage(error)` + «Reintentar», que repite la **misma** búsqueda aplicada; los campos conservan lo escrito (CA-21, EC-30) |
| Con datos | `<table>` con `<caption>` «Candidatos» y columnas «Nombre y apellidos» (enlace a la ficha), «Email» y «Skills» (unidas por «, »; vacías → «Sin indicar»), en el orden recibido; debajo `Pagination` |

**Búsqueda** (`CandidateFilters`, `<form role="search" aria-label="Buscar candidatos" noValidate>`; guarda los
borradores de los dos campos; no hace `fetch`):

| Control | Nombre accesible | Regla | Error (en `<p id="…-error">` con `aria-describedby`, `aria-invalid` y foco en el campo; no se pide nada) |
|---|---|---|---|
| `<input type="search" name="q" autoComplete="off">` | «Buscar por nombre o email» | Recortado; ≤ 100 puntos de código; sin C0 ni DEL (`validateSearchText`). Vacío = sin filtro | «La búsqueda no puede pasar de 100 caracteres.» · «La búsqueda no puede tener caracteres de control.» |
| `<input type="search" name="skill" autoComplete="off">` | «Skill» | Recortada; ≤ 40; sin control (`validateFilterText`, S8). Vacía = sin filtro. Se envía tal cual (la API la pasa a minúsculas) | «La skill no puede pasar de 40 caracteres.» · «La skill no puede tener caracteres de control.» |
| `<button type="submit">` | «Buscar» | Aplica los dos a la vez, página 1 y el tamaño actual (DT-04) | — |
| `PageSizeSelect` (fuera del `<form>`) | «Por página» | 20, 50 o 100; al cambiar aplica la página 1 con la búsqueda **aplicada** (no los borradores) | — |

**Paginación** (`Pagination` con `renderStep` → `<button type="button">`): «Anterior» si `page > 1`, «Página
{page} de {M} ({total} candidatos)» y «Siguiente» si `page < M`, con `page`, `pageSize` y `total` **de la
respuesta**. Tras pulsar un paso, cuando termina la carga el foco va al h1 (los botones desaparecen en los extremos).
Una página más allá de la última no se alcanza desde la interfaz: solo se pide la anterior o la siguiente de una
respuesta, y los candidatos no se borran (RN-13).

**Estado de la búsqueda (DD-01):** `{ q, skill, page, pageSize }` aplicados viven en `list-state.ts` (variable del
módulo). El contenedor arranca con `readListState()` y llama a `saveListState()` en cada búsqueda, cambio de página o
de tamaño. Volver al listado restaura la búsqueda y la página; recargar la página la pierde. Nada llega a la URL, a
`history.state` ni al almacenamiento del navegador.

### Formulario (`/candidates/new` y `/candidates/:id/edit`)

`CandidateFormScreen` (contenedor: valores, envío, errores; en edición carga el candidato) → `CandidateForm`
(presentacional, `noValidate`). Mismo patrón que `JobFormScreen`.

| Estado | Qué se ve |
|---|---|
| Edición, cargando | `role="status"` «Cargando el candidato…» |
| Edición, 404 o 400 al cargar | `CandidateNotFound` (como la ficha) |
| Edición, otro error | `ErrorMessage` + «Reintentar» |
| Formulario | h1 «Nuevo candidato» / «Editar candidato»; campos; alerta del formulario si la hay; «Guardar» (`Guardando…` y `disabled` en curso) y enlace «Cancelar» (al listado en el alta, a la ficha en la edición) |

| Campo | Control (`FormField`, `autoComplete="off"`) | Validación en cliente (refleja RF-02; manda la API) | Mensaje |
|---|---|---|---|
| `fullName` | `input type="text"` «Nombre y apellidos (obligatorio)» | Recortado: no vacío; 2-100 puntos de código; sin C0/DEL | «Escribe el nombre y los apellidos.» · «El nombre y los apellidos deben tener entre 2 y 100 caracteres.» · «No puede tener caracteres de control.» |
| `email` | `input type="text" inputMode="email"` «Email (obligatorio)» | Recortado: no vacío; ≤ 254; `^[^\s@]+@[^\s@]+\.[^\s@]+$` (laxo: la API tiene la última palabra); sin control | «Escribe el email.» · «El email no puede pasar de 254 caracteres.» · «Escribe un email válido, como nombre@example.com.» |
| `phone` | `input type="text" inputMode="tel"` «Teléfono» | Vacío = sin valor. Si no: `^\+?[0-9 ()-]{6,20}$` y ≥ 6 dígitos (DT-05) | «Escribe entre 6 y 20 dígitos, espacios, guiones o paréntesis, con al menos 6 dígitos y un «+» opcional delante.» |
| `summary` | `textarea` «Resumen», ayuda «Hasta 2 000 caracteres.» | ≤ 2 000; admite `\n`, `\r`, `\t`; resto de C0/DEL no | «El resumen no puede pasar de 2 000 caracteres.» · «No puede tener caracteres de control.» |
| `skills` | `input type="text"` «Skills», ayuda «Separadas por comas. Hasta 20, de 40 caracteres como máximo cada una.» | `parseSkills`: separa por comas, recorta y quita vacías. Cuenta y mide **tras** pasar a minúsculas y deduplicar (21 que se quedan en 20 → válido); sin control | «Indica como máximo 20 skills distintas.» · «Cada skill puede tener como máximo 40 caracteres.» · «No puede tener caracteres de control.» |
| `consent` (solo alta) | `<fieldset><legend>Consentimiento para futuros procesos</legend>` con `input type="checkbox"` «El candidato da su consentimiento», desmarcada por defecto; ayuda (`aria-describedby`): el texto de DT-01 y «Versión del texto: v1.» | — | — |

- Longitudes en puntos de código (`Array.from`), sin `maxLength` nativo (gotcha de ofertas).
- **Cuerpo del alta** (`toCreateInput`): textos recortados; `phone` y `summary` vacíos se omiten; `skills` = tokens
  recortados y no vacíos en su orden, **sin** minúsculas ni deduplicar (la normalización es del servidor, DD-10);
  `consent` siempre booleano. Nunca `retentionEndsAt`, fechas, versión ni `id`.
- **Cuerpo de la edición** (`toPatch`): solo los campos cuyo valor recortado difiere del original; `phone`/`summary`
  vaciados → `null`; `skills` si la lista de tokens difiere (`[]` si se vacía). Sin cambios → **no hay petición** y se
  vuelve a la ficha sin aviso (como ofertas; CA-10 lo prueba la API). Nunca el consentimiento.
- **Al enviar:** validación en cliente → si falla, errores por campo y foco en el primero, sin petición. Si pasa, una
  sola petición (guarda con `useRef` + `disabled`, EC-08). Éxito del alta → `navigate(detail(id), { notice:
  'Candidato creado.' })`; de la edición → `{ notice: 'Cambios guardados.' }`.
- **Errores del servidor** (`splitCandidateServerError`), **siempre conservando lo escrito**:

| Respuesta | Dónde se ve |
|---|---|
| 400 `VALIDATION_ERROR` | Cada `details[i]` de un campo del formulario, junto a ese campo con su `message`; el resto (clave desconocida, `body`, sin `details`) en la alerta del formulario con su `message`; foco en el primer campo con error |
| 409 `DUPLICATE` | Junto al email, el `message` de la API («Ya existe un candidato con este email.») y, debajo, el enlace «Ver el candidato existente» a `/candidates/{existingId}` (solo si `existingId` es un ID válido); foco en el email (DD-06) |
| 404 (edición) | Alerta con el `message` de la API («El candidato no existe.») y enlace «Volver a los candidatos» |
| 403, 413, 415, 500, red, *timeout*, forma inesperada | Alerta del formulario (`role="alert"`) con `userMessage(error)` |

### Ficha (`/candidates/:id`)

`CandidateDetailScreen` (valida el ID antes de pedir nada; `key={id}` en el cargador) → `CandidateDetails`,
`ConsentSection`; acciones de consentimiento en `useConsentActions`.

| Estado | Qué se ve |
|---|---|
| ID no válido, 404 o 400 | `CandidateNotFound`: h1 «Candidato no encontrado», «El candidato que buscas no existe.», enlace «Volver a los candidatos» (CA-23, EC-35) |
| Cargando | `role="status"` «Cargando el candidato…» |
| Error (red, 5xx, forma inesperada) | `ErrorMessage` + «Reintentar», sin datos a medias (CA-24, EC-37) |
| Con datos | Aviso de llegada; h1 = `fullName` (`tabIndex={-1}`); `<dl>`; enlace «Editar»; sección de consentimiento; enlace «Volver a los candidatos» |

`<dl>` de `CandidateDetails` (todo como texto JSX, nunca HTML):

| `dt` | `dd` |
|---|---|
| Email | `email` |
| Teléfono | `phone` o «Sin indicar» |
| Resumen | `summary` (clase `pre-wrap`) o «Sin indicar» |
| Skills | `skills.join(', ')` o «Sin indicar» |
| Fecha de alta | `formatDate(createdAt)` en `<time>` |
| Fin de retención | `formatCalendarDate(retentionEndsAt)` en `<time>`; `null` → «Mientras dure el proceso» (texto de UC-12 · A1; el flujo lo prueba HU-04) |

**Sección de consentimiento** (`ConsentSection`, `<section aria-labelledby>` con h2 «Consentimiento para futuros
procesos», `tabIndex={-1}`):

| Estado del consentimiento | Resumen (`consentSummary`) | Casilla | «Renovar consentimiento» |
|---|---|---|---|
| Vigente (`consentGivenAt` y sin `consentWithdrawnAt`) | «Vigente: otorgado el {dd/mm/aaaa} con la versión {v} del texto.» | Marcada | Visible |
| Retirado (las dos fechas) | «Retirado el {dd/mm/aaaa}. Se otorgó el {dd/mm/aaaa} con la versión {v} del texto.» | Desmarcada | No |
| Nunca dado | «No consta consentimiento para futuros procesos.» | Desmarcada | No |

- Debajo del resumen, el texto de DT-01 y «Versión del texto: v1.»; la casilla «El candidato da su consentimiento»
  (`aria-describedby` → ese texto) **refleja siempre lo guardado**, sin actualización optimista (DD-05).
- **Marcar** (vigente no) → `POST …/consent` al momento: casilla `disabled` y `role="status"` «Registrando el
  consentimiento…». **«Renovar consentimiento»** → `POST …/consent`, botón «Renovando…» `disabled`. **Desmarcar**
  (vigente) → `ConfirmDialog`:
  - título «¿Retirar el consentimiento?»; descripción «Se guardará la fecha de retirada y se conservarán la de
    otorgamiento y la versión. La fecha de fin de retención se recalculará sin el consentimiento y puede quedar ya
    vencida.» (EC-43); botones «Cancelar» (foco inicial) y «Retirar»; `busy` mientras se envía.
  - «Cancelar» o `Escape` → nada cambia y no hay petición. «Retirar» → `POST …/consent/withdrawal`; un error se
    queda dentro del diálogo (`error`), como el cierre de ofertas.
- **Éxito** → `setData(respuesta)` (resumen, casilla y fin de retención nuevos) y `role="status"` en la sección:
  «Consentimiento registrado.», «Consentimiento renovado.» o «Consentimiento retirado.».
- **Error de registrar o renovar** → `role="alert"` en la sección con `userMessage(error)` (también 404, 403 y 500);
  la ficha no cambia (CA-30).
- **Foco:** al terminar (éxito o error, y al cerrar el diálogo) vuelve al control que lanzó la acción, por `ref`
  (casilla o «Renovar consentimiento»; si este desaparece, la casilla), sin leer `document.activeElement` (DD-12).

### Accesibilidad que usan los tests

| Elemento | Consulta |
|---|---|
| Navegación | `getByRole('navigation', { name: 'Principal' })` → `link` «Candidatos» |
| Búsqueda | `getByRole('search', { name: 'Buscar candidatos' })`, `getByLabelText('Buscar por nombre o email')`, `getByLabelText('Skill')`, `button` «Buscar», `combobox` «Por página» |
| Tabla | `getByRole('table', { name: 'Candidatos' })`; `link` con el nombre |
| Paginación | `getByRole('navigation', { name: 'Paginación' })` → `button` «Anterior» / «Siguiente» |
| Formulario | `textbox` «Nombre y apellidos (obligatorio)», «Email (obligatorio)», «Teléfono», «Resumen», «Skills»; `group` «Consentimiento para futuros procesos» → `checkbox` «El candidato da su consentimiento»; `button` «Guardar»; `link` «Ver el candidato existente» |
| Ficha | `heading` nivel 1 con el nombre; `region` «Consentimiento para futuros procesos» → `checkbox` «El candidato da su consentimiento», `button` «Renovar consentimiento»; `dialog` «¿Retirar el consentimiento?» → `button` «Cancelar» / «Retirar» |
| Mensajes | `role="status"` (cargando, avisos), `role="alert"` (errores) |

Teclado: todo es `button`, `a`, `input` o `select` nativos; el diálogo es `<dialog>` modal (`showModal`: trampa de
foco y `Escape` del navegador, probados en e2e). Contraste: los estilos existentes de `styles.css` (sin colores nuevos
salvo los de la sección, ≥ 4,5:1).

## Migración de datos

N/A en la web — sin almacenamiento propio. La migración `002` y el seed de 30 candidatos (DT-08) son del backend; los
e2e cuentan con ellos (DD-11).

## Diagrama de secuencia

Alta con email duplicado y doble clic, y retirada del consentimiento:

```mermaid
sequenceDiagram
  participant R as Reclutador
  participant W as Web
  participant A as API
  participant D as SQLite
  R->>W: Rellena el alta y pulsa «Guardar» dos veces
  W->>W: validateCandidateForm OK; guarda inFlight, «Guardar» disabled
  W->>A: POST /api/candidates { fullName, email, phone?, summary?, skills, consent }
  A->>D: INSERT (índice único del email)
  D-->>A: violación de unicidad
  A-->>W: 409 DUPLICATE details[{ field: email, message, existingId }]
  W-->>R: Error junto al email + enlace «Ver el candidato existente» (/candidates/{id}); lo escrito se conserva
  Note over W: El segundo clic no envía nada (inFlight)
  R->>W: En la ficha, desmarca la casilla
  W-->>R: ConfirmDialog, foco en «Cancelar»
  R->>W: «Retirar»
  W->>A: POST /api/candidates/{id}/consent/withdrawal (sin cuerpo)
  A->>D: BEGIN; fecha de retirada; recálculo de la retención; COMMIT
  A-->>W: 200 Candidate
  W-->>R: setData; «Consentimiento retirado.»; nuevo fin de retención; foco en la casilla
```

## Error paths

| Edge case (PRD) | Dónde se detecta | Estrategia | Respuesta o efecto observable | Test |
|---|---|---|---|---|
| EC-03 nombre con tildes y emoji | `candidate-form-model.ts` | contar puntos de código | «Íñigo Núñez Peñalver 🎯» es válido; el email se envía recortado | `candidate-form-model.test.ts` |
| EC-04 / CA-06 fallo de la base en el alta | `splitCandidateServerError` | alerta | 500 → alerta con el `message`; campos intactos; sigue en el formulario | `CandidateFormScreen.test.tsx` |
| EC-07 duplicado sin datos del existente | `candidate-form-errors.ts` | mostrar `message` + enlace por ID | Ninguna petición a `/api/candidates/{existingId}` hasta pulsar el enlace; no se muestra ningún dato suyo | `CandidateFormScreen.adversarial.test.tsx` |
| EC-08 doble clic en «Guardar» | `useCandidateSubmission` | `useRef` + `disabled` | Un solo `POST` | `CandidateFormScreen.adversarial.test.tsx` |
| EC-09, EC-10, EC-11, EC-12, EC-13 formato y fronteras | `validateCandidateForm` (y 400 de la API) | rechazar en cliente; si la API discrepa, su `details` junto al campo | Error junto al campo, sin petición; 2/100, 2 000, 40, 20 y «21 → 20» pasan | `candidate-form-model.test.ts`, `CandidateFormScreen.test.tsx` |
| EC-58 caracteres de control | `validateCandidateForm` | rechazar salvo `\n\r\t` en el resumen | Error junto al campo; el resumen con salto de línea pasa | `CandidateFormScreen.adversarial.test.tsx` |
| EC-02, EC-19, EC-59 campos desconocidos o de solo lectura | `toCreateInput`, `toPatch`; 400 de la API | no enviarlos nunca; un `details` ajeno al formulario va a la alerta | El cuerpo solo lleva las claves de S2/S4; un 400 con `field` desconocido → alerta | `CandidateFormScreen.adversarial.test.tsx` |
| EC-17 resumen enorme o con `<script>` | cliente (> 2 000) · React | rechazar · escapar | Error junto al campo; `<script>` se ve como texto en la ficha | `CandidateFormScreen.adversarial.test.tsx`, `CandidateDetailScreen.adversarial.test.tsx` |
| EC-21 vaciar teléfono, resumen y skills | `toPatch` | `null` / `[]` | `PATCH { phone: null, summary: null, skills: [] }`; la ficha muestra «Sin indicar» | `CandidateFormScreen.edit.test.tsx` |
| EC-22 / CA-12 email de otro al editar | `splitCandidateServerError` | como EC-07 | Error junto al email + enlace; nada cambia | `CandidateFormScreen.edit.test.tsx` |
| EC-23 / CA-14 fallo al editar | ídem | alerta | Lo escrito se conserva | `CandidateFormScreen.edit.test.tsx` |
| EC-25 / RNF-09 título y URL de la edición | `useDocumentTitle` | título fijo | «Editar candidato · ATS»; la URL solo lleva el ID | `CandidateFormScreen.adversarial.test.tsx` |
| EC-26 guardar sin cambios | `toPatch` → `{}` | no enviar | Ninguna petición; vuelve a la ficha | `CandidateFormScreen.edit.test.tsx` |
| EC-28 vacío, 20 y 21; `q` solo con espacios | contenedor del listado · `validateSearchText` | estados y recorte | Vacío con mensaje; 20 sin «Siguiente»; 21 «Página 1 de 2»; espacios → sin `q` | `CandidateListScreen.test.tsx` |
| EC-30 / CA-21 API caída al buscar | `useResource` | `ErrorMessage` + «Reintentar» | Los campos conservan lo escrito; «Reintentar» repite la misma URL | `CandidateListScreen.test.tsx` |
| EC-33 `q` hostil y fuera de la URL | `candidateListUrl` (`encodeURIComponent`) · DD-01 | literal y en memoria | `' OR 1=1 --` sale codificado; `location.search` vacío, `history.state` sin `q`; título «Candidatos · ATS»; `<img onerror>` en un nombre se ve como texto | `CandidateListScreen.adversarial.test.tsx` |
| CA-20 `q` de 101 o con control; skill de 41 | `CandidateFilters` | rechazar en cliente | Error junto al campo, sin petición; 100 pasa | `CandidateListScreen.adversarial.test.tsx` |
| EC-35 ID no entero | `parseCandidateId` · 400 de la API | como inexistente | «Candidato no encontrado» sin petición (`/candidates/abc`) o tras el 400 | `CandidateDetailScreen.test.tsx` |
| EC-36 solo nombre y email; consentimiento a las 22:30Z | `CandidateDetails` · `formatDate` | «Sin indicar»; Europe/Madrid | Sin `null` ni huecos; 2026-10-06T22:30:00Z → 07/10/2026 | `CandidateDetailScreen.test.tsx` |
| EC-37 / CA-24 API caída en la ficha | `useResource` | `ErrorMessage` | «Reintentar», sin datos a medias | `CandidateDetailScreen.test.tsx` |
| EC-38 editada en otra pestaña | remontaje | volver a pedir | Al volver de «Editar» o al reintentar se pide de nuevo | `CandidateFormScreen.edit.test.tsx` (vuelve a la ficha) |
| EC-40 / RNF-06 HTML en resumen, nombre o skills; título | React · `useDocumentTitle` | escapar; título fijo | Texto literal (0 elementos `script`, `b`, `i`); título «Ficha de candidato · ATS» con el nombre en pantalla | `CandidateDetailScreen.adversarial.test.tsx` |
| EC-43 retirar con la retención ya pasada | `ConsentSection` | aviso previo | El diálogo lo avisa; tras «Retirar», la fecha pasada se muestra igual | `CandidateDetailScreen.consent.test.tsx` |
| EC-48 / CA-29 consentimiento de un ID que no existe | `useConsentActions` | alerta | 404 → alerta con el `message`; la ficha no cambia | `CandidateDetailScreen.adversarial.test.tsx` |
| EC-49 doble clic en la casilla o en «Renovar» | `useConsentActions` | `useRef` + `disabled` | Un solo `POST` | `CandidateDetailScreen.adversarial.test.tsx` |
| EC-45 / CA-30 fallo al cambiar el consentimiento | `useConsentActions` | alerta (o error en el diálogo al retirar) | Casilla, resumen y fin de retención como estaban | `CandidateDetailScreen.adversarial.test.tsx` |
| CA-28 retirar sin consentimiento vigente | `ConsentSection` | no se ofrece | Sin vigente, la casilla está desmarcada: marcarla registra (`/consent`), nunca retira | `CandidateDetailScreen.consent.test.tsx` |
| Respuesta 2xx con forma inesperada | `isCandidate`, `isCandidatePage` | `CLIENT_BAD_RESPONSE` | Estado de error con «Reintentar» o alerta | `api.test.ts`, `CandidateDetailScreen.adversarial.test.tsx` |
| 403 `CROSS_SITE_REQUEST` (DEC-12) | `splitCandidateServerError` | alerta | Alerta con su `message`; lo escrito se conserva | `CandidateFormScreen.adversarial.test.tsx` |
| EC-15 concurrencia en la validación | — | N/A | Sin efecto en la web: la validación en cliente es pura y sin estado compartido; la unicidad del email la resuelve la API (TD-backend) y la web solo pinta el 409 (EC-07, EC-22) | — |
| EC-51 fronteras de fecha de la fórmula | API (`retention.ts`) | — | Sin efecto en la web: lo resuelve la API (TD-backend); la ficha muestra con `formatCalendarDate` la `retentionEndsAt` que devuelve, sin recalcular ni aplicar zona horaria | `format.test.ts` (`formatCalendarDate`) |
| EC-52 varias filas a la vez | API (`retention.ts`) | — | Sin efecto en la web: lo resuelve la API (TD-backend); la ficha muestra la fecha que devuelve | — |
| EC-53 el puerto de procesos falla | API → 500 `INTERNAL_ERROR` | alerta | En el alta, `CandidateFormScreen` muestra el `message` genérico del envelope en la alerta del formulario y conserva lo escrito; en el consentimiento, `ConsentSection` lo muestra en su alerta (o dentro del diálogo al retirar) y la ficha no cambia, como cualquier `INTERNAL_ERROR` | `CandidateFormScreen.test.tsx` (500), `CandidateDetailScreen.adversarial.test.tsx` (500) |
| EC-54 concurrencia del recálculo | — | N/A | Sin efecto en la web: función pura en una transacción de la API (TD-backend) | — |
| EC-55 inscripción no final y cierre anterior | API (`retention.ts`) | — | Sin efecto en la web: lo resuelve la API (TD-backend); la ficha muestra el vacío que devuelve como «Mientras dure el proceso» (su flujo es de HU-04) | `CandidateDetailScreen.test.tsx` (`retentionEndsAt: null`) |
| EC-56 fallo del recálculo hasta el cliente | API → 500 `INTERNAL_ERROR` | alerta | Igual que EC-53: `CandidateFormScreen` o `ConsentSection` pintan el `message` genérico del envelope (sin datos personales ni *stack trace*), como cualquier `INTERNAL_ERROR` | `CandidateFormScreen.test.tsx`, `CandidateDetailScreen.adversarial.test.tsx` |
| EC-01, EC-05, EC-06, EC-14, EC-16, EC-18, EC-20, EC-24, EC-27, EC-29, EC-31, EC-32, EC-34, EC-39, EC-41, EC-42, EC-44, EC-46, EC-47, EC-50, EC-57 | API (ver TD-backend) | — | La web no los alcanza: no envía JSON malformado, IDs no enteros (los valida antes), fechas, versión ni parámetros desconocidos; lo concurrente, la fórmula y los `CHECK` son del servidor | `apps/api/test/candidates/…` |

## Threat modeling

| STRIDE | Amenaza en la web | Mitigación |
|---|---|---|
| Suplantación | — | N/A: sin login (DEC-04) |
| Manipulación | Otra web lanza escrituras contra la API (CSRF) | DEC-12 en la API; la web va `same-origin` por el *proxy*. La web nunca envía fechas, versión ni `retentionEndsAt` (`toCreateInput`/`toPatch`) |
| Repudio | Discutir cuándo se dio el consentimiento | La fecha la pone el servidor y la ficha muestra fecha y versión guardadas (art. 7.1); la web no envía ninguna fecha |
| Exposición de datos | Nombre, email o `q` en el historial, la URL, el título, `history.state`, el autocompletado o el almacenamiento del navegador | Rutas solo con ID; título fijo (DD-08); filtros en memoria (DD-01); avisos de `history.state` con texto fijo («Candidato creado.»); `autoComplete="off"` (DD-07); sin `localStorage`/`sessionStorage`; sin `console.*`. El 409 muestra solo un enlace por ID (DD-06) |
| Exposición de datos | XSS con nombre, resumen o skills | Solo interpolación JSX; nunca `dangerouslySetInnerHTML` (RNF-06) |
| Denegación de servicio | Doble envío, textos enormes | Guarda `useRef` + `disabled`; validación de longitudes en cliente; *timeout* de 10 s de `requestJson` |
| Elevación de privilegios | — | N/A: rol único (DEC-04) |

## Datos personales

- **Entran (formulario):** nombre y apellidos, email, teléfono, resumen, skills y la casilla de consentimiento. **Se
  muestran:** el listado, solo nombre, email y skills (RNF-04, la web no pide más); la ficha, todo lo de S1.
- **Dónde viven en el navegador:** en memoria de React mientras la pantalla está montada; la búsqueda aplicada
  (`q`, skill), en la variable de `list-state.ts` hasta recargar o cerrar la pestaña (DD-01). **Nunca** en la URL, el
  título, `history.state`, `localStorage`, `sessionStorage`, el autocompletado (DD-07) ni la consola.
- **Qué no aparece nunca:** el nombre o el email en `document.title` (RNF-09); datos del candidato existente en el 409;
  `q` en la URL de la web (sí en la de `fetch` a `/api/candidates`, que el logger de la API recorta).
- **Retención:** la web no guarda nada; muestra el fin de retención calculado por el servidor, en solo lectura.
- **Tests y e2e:** datos inventados con `@example.com`.

## Decisiones de diseño

### DD-01: Búsqueda del listado en memoria del módulo, no en la URL
- **Contexto:** DT-10 c prohíbe los filtros en la URL; el flujo «buscar → ficha → volver» es el habitual (Flujos 3).
- **Opciones consideradas:** A) `useState` en la pantalla (se pierde al ir a la ficha); B) variable del módulo
  `list-state.ts` leída al montar y escrita al aplicar; C) `history.state` (el navegador lo guarda en el historial de
  sesión y lo restaura incluso tras recargar o reabrir: dato personal fuera de la pantalla); D) `sessionStorage`
  (almacenamiento del navegador: regla de seguridad).
- **Elegida:** B. Se restauran `q`, skill, página y tamaño al volver por cualquier vía; recargar empieza de cero.
- **Razón:** conserva la búsqueda sin escribirla en ningún sitio del navegador y sin librería de estado.
- **Tradeoff:** no hay enlace compartible a una búsqueda, «Atrás» no deshace búsquedas (solo navegación) y F5 la
  pierde. Test: `CandidateListScreen.filters.test.tsx` («restaura la búsqueda al volver y no la escribe en la URL»).

### DD-02: Paginación con botones y foco al h1
- **Contexto:** sin URL, cambiar de página es una acción, no una navegación.
- **Opciones consideradas:** A) enlaces como ofertas (`href` sin destino real); B) `button`.
- **Elegida:** B, sobre `components/Pagination.tsx` compartido con ofertas (`renderStep`).
- **Razón:** `a` para navegar y `button` para acciones (WCAG, principio 2).
- **Tradeoff:** no se abre una página en otra pestaña.

### DD-03: Piezas de `jobs` que pasan a `components/`
- **Contexto:** candidatos necesita lo mismo que ofertas en listado, formulario y acciones.
- **Opciones consideradas:** A) copiarlas en `candidates/`; B) moverlas a `components/` y que `jobs` las importe;
  C) importar de `features/jobs/` desde `candidates/` (acopla dos features).
- **Elegida:** B, en la primera tarea web: `list-controls.ts` (de `jobs/list-query.ts`), `Pagination.tsx` (de
  `JobPagination.tsx`), `PageSizeSelect.tsx` (de `JobFilters.tsx`), `form-errors.ts` (de `job-form-errors.ts`),
  `use-document-title.ts` (de `JobDetailScreen.tsx`), `use-lifetime-signal.ts` (de `use-job-actions.ts`) y
  `parseRouteId` (de `jobs/paths.ts`, a `router.tsx`). `jobs` re-exporta los nombres públicos; sus tests no cambian.
  **No se mueven** `useReturnFocus` (deuda HU-02 §9.3), `splitServerError` de ofertas (404/409 propios),
  `NotFound`, `ConfirmDialog` ni `StatusMessages` (ya son compartidos).
- **Razón:** una sola implementación de las reglas de `q`, de la paginación y del reparto de `details`.
- **Tradeoff:** la tarea toca ficheros de `jobs` (riesgo de regresión, cubierto por su suite actual).

### DD-04: Texto y versión del consentimiento como constante de la web
- **Contexto:** DT-01 fija el texto y `v1` como «constante versionada en el código»; el contrato no tiene un endpoint
  que lo sirva.
- **Opciones consideradas:** A) constante en `candidates/consent.ts`, igual a la de la API; B) endpoint nuevo (fuera
  del PRD); C) importar desde `apps/api` (cruza *workspaces*).
- **Elegida:** A. Lo que la ficha muestra como **aceptado** es siempre la versión guardada (`consentVersion`).
- **Razón:** sin contrato nuevo ni acoplamiento entre *workspaces*.
- **Tradeoff:** dos copias que pueden divergir. Lo vigila el e2e: la versión junto a la casilla del alta coincide con
  la `consentVersion` que devuelve la API tras marcarla (`e2e/candidates.spec.ts`).

### DD-05: La casilla de la ficha refleja lo guardado
- **Contexto:** marcar registra al momento y desmarcar pide confirmación (DT-02).
- **Opciones consideradas:** A) actualización optimista y revertir si falla; B) estado del servidor + `disabled` y
  «Registrando el consentimiento…» mientras tanto.
- **Elegida:** B.
- **Razón:** nunca muestra un consentimiento que no consta; un fallo no deja nada que revertir (CA-30).
- **Tradeoff:** durante la petición la casilla no cambia de aspecto; lo compensa el mensaje de estado.

### DD-06: 409 de email duplicado con enlace por ID
- **Contexto:** DT-10 b y EC-07: el mensaje no revela nada; la web enlaza a la ficha existente por su ID.
- **Opciones consideradas:** A) `existingId` en el elemento `email` de `details` (S5) y `http.ts` lo conserva;
  B) un elemento aparte `{ field: 'existingId', message: '42' }` (no exige cambiar `http.ts`, pero mezcla un ID con
  los campos); C) cargar la ficha existente para mostrar su nombre (expone datos: descartada).
- **Elegida:** A, la misma que fija el TD-backend (S5). La web pinta el `message` de la API y «Ver el candidato
  existente».
- **Razón:** el ID queda junto al campo que choca y tipado como número.
- **Tradeoff:** pulsar el enlace abandona el formulario y lo escrito (mismo tratamiento que «Cancelar»).

### DD-07: `autoComplete="off"` en los formularios de candidatos
- **Contexto:** el navegador guarda lo enviado en formularios para autocompletar: nombres y emails de terceros.
- **Opciones consideradas:** A) por defecto; B) `autoComplete="off"` en los 5 campos del formulario y en «Buscar por
  nombre o email» y «Skill».
- **Elegida:** B.
- **Razón:** minimización (RGPD §6): ningún dato del candidato fuera de la pantalla.
- **Tradeoff:** sin sugerencias al escribir; algún navegador puede ignorarlo (riesgo aceptado).

### DD-08: Título fijo por pantalla; el nombre solo en el h1
- **Contexto:** RNF-09 y DT-10 a; `App.tsx` solo pone el título al navegar, no en la carga directa.
- **Opciones consideradas:** A) h1 genérico «Ficha de candidato»; B) título genérico con `useDocumentTitle` y h1 con
  el nombre.
- **Elegida:** B.
- **Razón:** el título va al historial y a las pestañas; el h1 no sale de la pantalla y orienta al lector de pantalla.
- **Tradeoff:** ninguno funcional; el test fija que `document.title` nunca contiene el nombre.

### DD-09: La edición envía solo lo cambiado
- **Contexto:** `PATCH {}` da 400 (DT-09) y editar no recalcula nada.
- **Opciones consideradas:** A) enviar todo; B) `toPatch` como ofertas.
- **Elegida:** B; sin cambios no hay petición.
- **Razón:** coherencia con ofertas y sin 400 evitables.
- **Tradeoff:** «Guardar» sin cambios no ejercita CA-10 desde la web (lo prueba la API).

### DD-10: Skills como texto separado por comas; normaliza el servidor
- **Contexto:** DT-09: la web las escribe separadas por comas y la API recibe un array.
- **Opciones consideradas:** A) enviar los tokens recortados en su orden; B) enviarlos ya en minúsculas y sin
  duplicados.
- **Elegida:** A; la validación en cliente sí cuenta tras normalizar, para no rechazar «21 → 20».
- **Razón:** una sola normalización, la del servidor (RN-04); el e2e de CA-01 la comprueba de punta a punta.
- **Tradeoff:** una skill no puede contener comas.

### DD-11: e2e con datos propios y el seed solo para el volumen
- **Contexto:** la base de e2e es compartida en la ejecución (`workers: 1`) y los nombres del seed no están fijados.
- **Opciones consideradas:** A) depender de nombres del seed; B) crear los candidatos de cada prueba por la API (o por
  la interfaz si es el flujo probado) con nombres inventados únicos, y usar el seed solo para «hay ≥ 30».
- **Elegida:** B.
- **Razón:** el seed puede cambiar sin romper los e2e; cada aserción del listado va filtrada por un texto único,
  salvo la de paginación sin filtros (≥ 30 → 20 filas y «Siguiente»).
- **Tradeoff:** no se comprueba en e2e la mezcla 10/4/16 del seed (lo hace `apps/api/test/…/seed`).

### DD-12: Foco tras las acciones de consentimiento por `ref`
- **Contexto:** la deuda HU-02 §9.3: `document.activeElement` falla en Safari, donde los botones y casillas no
  reciben foco al hacer clic.
- **Opciones consideradas:** A) `useReturnFocus` de ofertas; B) `ref` al control que lanzó la acción.
- **Elegida:** B.
- **Razón:** el control es conocido de antemano; no depende del navegador.
- **Tradeoff:** un `ref` más por control.

## Impacto en decisiones

- **Aplica:** DEC-01 (envelope), DEC-04 (sin permisos), DEC-05 (**sin dependencias nuevas**), DEC-07 (409
  `DUPLICATE` con el ID), DEC-09 (`formatDate` para instantes y `formatCalendarDate` para el fin de retención, que es
  fecha de calendario), DEC-10 (forma del listado), DEC-11.4 (`details` por campo; la enmienda de RNF-08 la diseña el
  backend y la web solo exige S9) y DEC-12 (sin cambios en la web).
- **Ninguna DEC nueva.** Para `/module-sync`: anotar en el `technical.md` de candidatos que el listado **no** usa la
  URL (DD-01), a diferencia de ofertas.

## Estrategia de tests

Vitest + Testing Library en `apps/web/test/` (jsdom): consultas por rol y *label*, `mockFetch`
(`apps/web/test/helpers/fetch.ts`, URL exacta con query), polyfill de `<dialog>` (`apps/web/test/helpers/dialog.ts`).
Se simula solo la red; datos inventados con `@example.com`. `beforeEach` del listado:
`saveListState(INITIAL_LIST_QUERY)`.

| RF | Vitest (fichero → qué) | Playwright |
|---|---|---|
| RF-01 | `CandidateFormScreen.test.tsx` → alta: cuerpo `{ fullName, email, skills: ['TypeScript','sql','typescript'], consent: false }` y navegación a la ficha con «Candidato creado.» (CA-01); casilla desmarcada con texto y «Versión del texto: v1.» y `consent: true` (CA-03); 500 conserva lo escrito (CA-06). `CandidateFormScreen.adversarial.test.tsx` → `[adversarial]` 409 con enlace sin pedir la ficha existente y doble clic = 1 `POST` (CA-05, EC-07, EC-08); 403 y 413 → alerta | `candidates.spec.ts`: CA-01 completo (ficha con email y skills normalizados y fin de retención esperado); CA-03 con consentimiento; CA-05 duplicado con enlace |
| RF-02 | `candidate-form-model.test.ts` → reglas, fronteras (1/2/100/101, 2 000/2 001, 40/41, 20/21/«21 → 20», teléfonos de EC-13, emoji) y cuerpos (CA-04, EC-03, EC-09 a EC-13). `CandidateFormScreen.test.tsx` → error en cliente junto al campo sin petición y 400 del servidor junto al campo (CA-04). `[adversarial]` control (EC-58), claves nunca enviadas y `details` desconocido → alerta (EC-02, EC-59) | — |
| RF-03 | `CandidateFormScreen.edit.test.tsx` → valores actuales sin consentimiento; `PATCH` solo con lo cambiado y «Cambios guardados.» (CA-07, CA-08); mismo email con otra forma se envía sin error (CA-09); sin cambios no pide (EC-26); vaciados → `null`/`[]` (EC-21); 400 resumen 2 001 (CA-11); 409 con enlace (CA-12); 404 al cargar → «Candidato no encontrado» (CA-13); 500 (CA-14). `[adversarial]` título «Editar candidato · ATS» (EC-25) | `candidates.spec.ts`: CA-07 (teléfono, resumen y skills) y fin de retención sin cambios |
| RF-04 | `CandidateListScreen.test.tsx` → cargando; sin filtros pide `/api/candidates` (CA-16); 3 columnas (CA-15); vacío sin y con filtros (CA-18); red → «Reintentar» con los campos intactos y la misma URL (CA-21). `CandidateListScreen.filters.test.tsx` → `q` + skill → `?q=jose&skill=SQL` (CA-17); «Siguiente» → `page=2`, «Página 2 de 2», foco al h1; «Por página» 100 → `pageSize=100` y página 1 (CA-19); **restaura la búsqueda al volver** (desmontar y montar) **y `location.search` y `history.state` siguen vacíos** (DD-01, RNF-09). `CandidateListScreen.adversarial.test.tsx` → `[adversarial]` `q` 101/100/control y skill 41 (CA-20); `' OR 1=1 --` codificado (EC-33); nombre `<img onerror>` como texto | `candidates-list.spec.ts`: búsqueda por apellido único + skill (CA-17); sin filtros 20 filas y «Siguiente» con el seed; ida a la ficha y vuelta con la búsqueda restaurada y la URL `/candidates` sin query (DD-01, RNF-09); `page.route` abortado → «Reintentar» (CA-21) |
| RF-05 | `CandidateDetailScreen.test.tsx` → ficha completa; tres estados del consentimiento; «Sin indicar»; 22:30Z → 07/10/2026; fin de retención 06/04/2027 (CA-22, EC-36); 404 y `/candidates/abc` (CA-23, EC-35); red (CA-24). `CandidateDetailScreen.adversarial.test.tsx` → `[adversarial]` `<script>`/`<b>` como texto y `document.title` sin el nombre (EC-40, RNF-06, RNF-09) | `candidates.spec.ts`: título «Ficha de candidato · ATS» y URL `/candidates/{id}` |
| RF-06 | `CandidateDetailScreen.consent.test.tsx` → marcar → `POST …/consent`, «Consentimiento registrado.», fecha, versión y nuevo fin (CA-25); desmarcar → diálogo con foco en «Cancelar», `simulateCancel` y «Cancelar» sin petición, «Retirar» → `POST …/withdrawal` (CA-26, EC-43); «Renovar consentimiento» (CA-27); sin vigente no hay retirada (CA-28). `CandidateDetailScreen.adversarial.test.tsx` → `[adversarial]` doble clic = 1 `POST` (EC-49); 500 y 404 → alerta y ficha intacta (CA-29, CA-30); error dentro del diálogo; respuesta con forma inesperada | `candidates.spec.ts`: marcar → renovar → retirar con `Escape` primero (sigue vigente) y trampa de foco (`Tab` no sale del diálogo); versión mostrada = `consentVersion` de la API (DD-04) |

**Piezas compartidas** (`list-controls.test.ts`, `Pagination.test.tsx`, `form-errors.test.ts`, `http.test.ts`
`existingId` válido, ausente y no válido, `format.test.ts` `formatCalendarDate`, `router.test.tsx` aviso «Candidato
creado.» y `parseRouteId`) y **toda la suite de `jobs` sin cambios** (prueba de que el movimiento no rompe nada).
`App.test.tsx` → enlace «Candidatos» y título «Candidatos · ATS» al navegar.

**De API pura** (los prueba el backend con `fastify.inject`): CA-02, CA-10, CA-13 (parte API), CA-20 (parte API),
CA-28 (parte API), CA-29, CA-31, CA-32 y RNF-01 a RNF-05, RNF-08.

**Criterio → test (parte web):** CA-01 → `CandidateFormScreen.test.tsx` + `CandidateDetailScreen.test.tsx` + e2e ·
CA-03 → `CandidateFormScreen.test.tsx` + e2e · CA-04 → `candidate-form-model.test.ts` + `CandidateFormScreen.test.tsx`
· CA-05 → `CandidateFormScreen.adversarial.test.tsx` + e2e · CA-06 → `CandidateFormScreen.test.tsx` · CA-07 a CA-09,
CA-11 a CA-14 → `CandidateFormScreen.edit.test.tsx` (+ e2e CA-07) · CA-15 a CA-19, CA-21 →
`CandidateListScreen.test.tsx` / `.filters.test.tsx` + e2e (CA-17, CA-21) · CA-20 →
`CandidateListScreen.adversarial.test.tsx` · CA-22 a CA-24 → `CandidateDetailScreen.test.tsx` / `.adversarial` + e2e
(CA-22) · CA-25 a CA-28 → `CandidateDetailScreen.consent.test.tsx` + e2e · CA-29, CA-30 →
`CandidateDetailScreen.adversarial.test.tsx`.

## Checklist de implementación

Orden: tipos y cliente → presentacionales → contenedores → tests. Base para `/task-planner` (6 tareas web, DD-03 en
la primera).

1. **W1 `[setup]` Piezas compartidas y cliente de candidatos** (L, ~3,5 h): `list-controls.ts`, `Pagination.tsx`,
   `PageSizeSelect.tsx`, `form-errors.ts`, `use-document-title.ts`, `use-lifetime-signal.ts`; `router.tsx`
   (`parseRouteId`, «Candidato creado.»), `http.ts` (`existingId`), `format.ts` (`formatCalendarDate`); `jobs` pasa a
   importarlos; `candidates/types.ts`, `api.ts`, `paths.ts`, `consent.ts` + tests de componentes y `api.test.ts`;
   suite de `jobs` en verde.
2. **W2 Listado y búsqueda** (L, ~3 h): `list-state.ts`, `CandidateTable.tsx`, `CandidateFilters.tsx`,
   `CandidateListScreen.tsx`; ruta `/candidates` y enlace «Candidatos» en `App.tsx` + `CandidateListScreen.test.tsx`,
   `.filters.test.tsx`, `App.test.tsx`.
3. **W3 Formulario de alta y edición** (L, ~4 h): `candidate-form-model.ts`, `candidate-form-errors.ts`,
   `CandidateForm.tsx`, `CandidateFormScreen.tsx`; rutas `/candidates/new` y `/candidates/:id/edit` +
   `candidate-form-model.test.ts`, `CandidateFormScreen.test.tsx`, `.edit.test.tsx`.
4. **W4 Ficha y consentimiento** (L, ~4 h): `CandidateDetails.tsx`, `ConsentSection.tsx`, `use-consent-actions.ts`,
   `CandidateDetailScreen.tsx`; ruta `/candidates/:id`; estilos + `CandidateDetailScreen.test.tsx`,
   `.consent.test.tsx`.
5. **W5 `[adversarial]` Candidatos en la web frente a hostiles y fallos** (M, ~2,5 h):
   `CandidateFormScreen.adversarial.test.tsx`, `CandidateListScreen.adversarial.test.tsx`,
   `CandidateDetailScreen.adversarial.test.tsx` (y los arreglos que destapen).
6. **W6 `[e2e]` Recorridos de candidatos** (L, ~3 h): `e2e/candidates.spec.ts` y `e2e/candidates-list.spec.ts`
   (depende de todas las tareas de API).

## Riesgos

| Riesgo | Probabilidad (1–5) | Impacto (1–5) | Mitigación |
|---|---|---|---|
| El plan roza el techo de 15 tareas: backend 8 (B-01 a B-08) + web 6 (W1-W6) = **14**, con W3 y W4 al límite de 4 h | 3 | 4 | Margen de una tarea. Si `/task-planner` necesita partir W3 (alta / edición) o W4 (ficha / consentimiento) y pasa de 15, **propuesta (no aplicada), la misma que el TD-backend:** sacar a otra HU «Consentimiento desde la ficha» (UC-13 · P, A1-A3, E1-E2: los `POST /consent*`, `ConsentSection`, `use-consent-actions.ts` y su parte de W5 y W6). HU-03 conservaría el alta con consentimiento (UC-09 · A1), la fórmula y el recálculo que necesita HU-04 |
| W1 mezcla el movimiento de piezas de `jobs` con el cliente nuevo | 3 | 2 | Si se pasa de 4 h, el cliente de candidatos (`types.ts`, `api.ts`, `paths.ts`, `consent.ts`) se va al principio de W2 sin crear tarea nueva |
| El contrato del backend cambia tras este cruce (S1-S10) | 2 | 3 | Los cambios se quedan en `types.ts`, `api.ts`, `consent.ts` y `http.ts` |
| Texto o versión del consentimiento distintos entre web y API (DD-04) | 2 | 4 | Aserción e2e versión mostrada = `consentVersion`; constante única por *workspace* |
| Mover piezas de `jobs` rompe ofertas | 2 | 3 | Re-exportar los nombres públicos; la suite de `jobs` y sus e2e, en verde en W1 |
| e2e frágiles por la base compartida | 2 | 2 | DD-11: nombres únicos y aserciones filtradas |

## Open Decisions

No hay decisiones abiertas. S1-S10 casan con `plans/TECHNICAL_DOC-backend.md`.

La OD-01 del TD-backend (aplicar la enmienda de DEC-11.4 también a ofertas) **no cambia la web**: ofertas nunca envía
claves no declaradas y sus campos de solo lectura conservan su nombre en `details`; con cualquiera de las dos
opciones, este diseño sigue igual.

## Fuera de scope

- UC-12 · A1 («Mientras dure el proceso»): la ficha ya pinta ese texto si `retentionEndsAt` es `null`, pero el flujo
  y su test son de HU-04.
- Inscripciones del candidato en la ficha (HU-04 y siguientes).
- Desplegable de skills existentes (DT-04), «Quitar filtros» y enlaces compartibles a una búsqueda (DD-01).
- Anonimización, exportación de la ficha, importación CSV e historial de consentimientos (DT-03).
- Cabeceras de endurecimiento (auditoría de sprint).
