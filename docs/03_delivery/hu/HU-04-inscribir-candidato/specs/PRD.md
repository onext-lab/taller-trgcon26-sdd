# HU-04 — Inscribir en una oferta publicada, sin duplicados — PRD

## Info
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** fullstack
- **Módulos:** `inscripciones` (código `applications`, nuevo), `candidatos` (código `candidates`) y `ofertas` (código
  `jobs`: puerto «estado de la oferta», enlace «Ver pipeline» y guardas de SEC-02; DT-09)
- **Fecha:** 2026-10-06 (Open Questions resueltas el 2026-10-06)
- **Estado:** Ready

## Contexto

### Problema
Ofertas y candidatos existen, pero no hay forma de unirlos: el reclutador no puede meter a un candidato en el proceso de
selección de una oferta ni ver en qué etapa está cada uno (IDEA-003, FEAT-03). Además, mientras no haya inscripciones,
la retención de los datos de un candidato nunca puede quedar «mientras dure el proceso» (RGPD §3, S-06): el puerto de
procesos del candidato responde siempre «sin inscripciones».

### Situación actual
HU-04 va en secuencia tras HU-01, HU-02 y HU-03, ya integradas en `main` y en la rama `hu/HU-04-inscribir-candidato`.
- **Módulo `inscripciones`:** no existe código. No hay `apps/api/src/modules/applications/` ni
  `apps/web/src/features/applications/` (nuevos en esta HU). La documentación del módulo es solo
  `docs/05_modules/inscripciones/README.md` y su catálogo de casos de uso.
- **Base de datos:** migraciones `apps/api/src/db/migrations/001-create-job-openings.sql` y
  `apps/api/src/db/migrations/002-create-candidates.sql`; la siguiente es la `003` (nueva). `PRAGMA foreign_keys = ON`
  en `apps/api/src/db/connection.ts`. Seed en `apps/api/src/db/seed.ts` (10 ofertas: 4 `draft`, 4 `published` y 2
  `closed`) y `apps/api/src/db/seed-candidates.ts` (30 candidatos); ninguna inscripción.
- **Puerto de procesos del candidato** (`apps/api/src/modules/candidates/processes-port.ts`):
  `CandidateProcessesPort.getProcesses(candidateId)`, síncrono, devuelve `{ hasOpenApplication, hadAnyApplication,
  lastProcessClosedAt }`; contrato: `lastProcessClosedAt` no es nulo si `hadAnyApplication && !hasOpenApplication`.
  `buildApp` (`apps/api/src/app.ts`) lo recibe como `candidateProcesses?` y usa el stub `noCandidateProcesses`. La
  operación interna `recalculateRetention(id)` de `apps/api/src/modules/candidates/service.ts` se une a la transacción en
  curso y es el único escritor de `retention_ends_at`.
- **Puerto de `jobs` hacia `inscripciones`** (`apps/api/src/modules/jobs/applications-port.ts`): `JobApplicationsPort`
  con `countActiveApplications` (lo usa `GET /api/jobs/:id/close-preview`, el diálogo de cierre de
  `apps/web/src/features/jobs/CloseJobAction.tsx`) y `rejectActiveApplications` (lo usa el cierre, dentro de su
  transacción). Stub `noJobApplications`; HU-02 (DT-01, DT-02) asignó su implementación a HU-05.
- **Puerto «estado de la oferta»:** no existe; DEC-06 lo define en `inscripciones` y lo implementa `ofertas`.
- **SEC-02** (review de HU-02 §9.1): en `apps/api/src/modules/jobs/repository.ts`, `MARK_PUBLISHED_SQL` y
  `MARK_CLOSED_SQL` llevan la guarda de estado en el `WHERE`; el `UPDATE` de edición y el `DELETE` solo filtran por `id`
  (el estado lo comprueba antes el servicio con `checkAction`, dentro de la transacción).
- **Piezas reutilizables (API):** `withTransaction` (`apps/api/src/db/transaction.ts`, `BEGIN IMMEDIATE` o se une a la
  abierta), `foldSearchText` y `registerTextSearch` (`apps/api/src/db/text-search.ts`), `forbiddenFields` y `rejectBody`
  (`apps/api/src/http/validation.ts`), el manejador único de errores (`apps/api/src/http/error-handler.ts`), los
  errores tipados (`apps/api/src/errors.ts`: `NOT_FOUND`, `INVALID_TRANSITION`, `VALIDATION_ERROR`, `DUPLICATE` con
  `existingId`), la guarda entre sitios (`apps/api/src/http/cross-site.ts`, DEC-12) y los dobles de test
  `createProcessesStub` (`apps/api/test/helpers/candidates.ts`). `findById` de candidatos y de ofertas usa `SELECT *`.
- **Web:** la tabla `ROUTES` de `apps/web/src/App.tsx` tiene `/jobs`, `/jobs/new`, `/jobs/:id/edit`, `/jobs/:id`,
  `/candidates`, `/candidates/new`, `/candidates/:id/edit` y `/candidates/:id`; no hay pipeline ni enlace a él desde la
  ficha de la oferta (`apps/web/src/features/jobs/JobActions.tsx`: una `published` ofrece Editar, Cerrar y Duplicar).
  La ficha del candidato (`apps/web/src/features/candidates/CandidateDetails.tsx`) ya pinta «Mientras dure el proceso»
  cuando `retentionEndsAt` es `null`, cubierto con datos simulados; con la API real nunca ocurre. Piezas reutilizables en
  `apps/web/src/components/`: `http.ts` (`requestJson`, `ApiError` con `existingId`), `format.ts` (`formatDate` a
  `dd/mm/aaaa` en Europe/Madrid), `StatusMessages.tsx`, `use-resource.ts`, `ConfirmDialog.tsx`, `Pagination.tsx`,
  `list-controls.ts` (`validateSearchText`), `form-errors.ts`, `use-document-title.ts`, `use-lifetime-signal.ts` y
  `router.tsx` (`parseRouteId`); el helper de foco de los tests es `apps/web/test/helpers/focus.ts` (`expectFocusOn`).
- **Deuda de HU-03:** la tarea T-04 del sprint ya cerró el test que ata `CONSENT_VERSION` con `CONSENT_TEXT_VERSION`
  (`apps/api/test/candidates/consent-version.test.ts`) y los teléfonos de ficción de la serie `+34 600 000 0xx`
  (RGPD §6.3). Sigue abierta la copia local de `CandidateNotFound` en
  `apps/web/src/features/candidates/CandidateFormScreen.tsx` (`docs/05_modules/candidatos/technical.md`, «Deuda
  técnica»), fuera de esta HU. De la review de HU-02 (`docs/05_modules/ofertas/technical.md`, DP-01/DP-02): los errores
  de un puerto no llevan datos del candidato al log, y no se copia el `SELECT *` de `findById`.

### Resultado esperado
Nace el módulo `inscripciones` en API y web, con su migración `003` y un seed de 40 inscripciones inventadas. Desde la
ficha de una oferta publicada, el reclutador abre su pipeline con «Ver pipeline»: una columna por etapa, cada tarjeta con
solo el nombre del candidato (sin enlace en esta HU) y la fecha del último cambio (y el motivo en «rechazado»). Desde
allí busca un candidato por nombre o email y lo inscribe, uno cada vez: la inscripción nace en `received` con su
`StageChange` inicial y, en la misma transacción, `candidatos` recalcula la retención con el puerto de procesos ya real,
así que la ficha del candidato muestra «Mientras dure el proceso». Inscribir en una oferta que no está publicada o
repetir la pareja da 409 sin crear nada. Las escrituras de `jobs` que dependen del estado llevan la guarda en el SQL
(SEC-02). El detalle de la inscripción con su historial llega en HU-05 (DT-11).

## Casos de uso

| UC · flujo | Descripción corta | CA |
|---|---|---|
| UC-14 · P | Inscribir desde el pipeline, buscando por nombre o email: `received`, `StageChange` inicial y retención sin fecha, en una transacción | CA-01, CA-02 |
| UC-14 · P | Un solo candidato por inscripción | CA-03 |
| UC-14 · E1 | Oferta en `draft` o `closed` → 409, no se crea nada | CA-04, CA-05 |
| UC-14 · E2 | Pareja ya inscrita (también `rejected`) o dos peticiones simultáneas → 409 con el ID existente | CA-06, CA-07, CA-08 |
| UC-14 · E3 | Oferta o candidato inexistente → 404 sin datos personales | CA-09 |
| UC-14 · E4 | Petición mal formada → 400 en el envelope | CA-10 |
| UC-14 · E5 | Falla una escritura → no queda nada y la retención no cambia | CA-11 |
| UC-17 · P (pasos 1-4 y «Inscribir candidato») | Pipeline por etapas, solo el nombre, orden por último cambio, sin paginación | CA-12, CA-13 |
| UC-17 · A2 | Pipeline sin inscripciones: estado vacío con «Inscribir candidato» | CA-14 |
| UC-17 · E1 | Oferta inexistente → 404 y estado de error | CA-15 |
| UC-17 · E2 | API no disponible → estado de error útil | CA-16 |
| UC-12 · A1 | Ficha con «Mientras dure el proceso» y puerto de procesos real | CA-19, CA-20 |

Ficheros: `docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md`,
`docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` y
`docs/05_modules/candidatos/casos-de-uso/UC-12-ver-ficha.md`. La columna CA de su «Trazabilidad» se rellena con el PRD
aprobado.

Flujos de esos UC que **no** cubre esta HU (de `hu.md`): UC-17 · P, acciones «Avanzar» y «Rechazar» y acceso al
historial desde cada tarjeta; UC-17 · A1 y A3; UC-12 · P, E1 y E2. **UC-18**
(`docs/05_modules/inscripciones/casos-de-uso/UC-18-consultar-historial.md`), todos sus flujos, es de HU-05 (DT-11); por
eso CA-17 y CA-18 figuran como «movido a HU-05».

## Requisitos funcionales

| ID | Descripción | Prioridad | Scope | Criterios de aceptación |
|----|-------------|-----------|-------|-------------------------|
| RF-01 | Inscribir por API: un candidato en una oferta, con la transacción completa de UC-14 | Must | backend | - [ ] `POST /api/applications` con `{ jobId, candidateId }`, enteros JSON de `1` a `Number.MAX_SAFE_INTEGER` (DT-07); éxito 201 con la inscripción creada en `received`<br>- [ ] Orden de comprobación: guarda entre sitios (403) → cuerpo y esquema (400) → existencia de la oferta y después del candidato (404, «La oferta no existe.» / «El candidato no existe.») → estado de la oferta (409 `INVALID_TRANSITION`) → unicidad de la pareja (409 `DUPLICATE` con `details: [{ field: 'candidateId', message, existingId }]`, por el índice único, sin `SELECT` previo; DEC-08)<br>- [ ] Dentro de una sola `withTransaction` (`BEGIN IMMEDIATE`): lectura del estado de la oferta por su puerto (RF-03, DT-08), `INSERT` de la inscripción, `INSERT` del `StageChange` sin origen → `received` con el instante del reloj inyectado en UTC, y `recalculateRetention(candidateId)` de `candidatos`; cualquier error hace `ROLLBACK` de todo<br>- [ ] La existencia del candidato se comprueba con una operación de `candidatos` que lee columnas explícitas, sin `SELECT *` (DP-02)<br>- [ ] Ningún `message` ni `details` de error lleva nombre, email ni teléfono del candidato; un error del puerto o del recálculo registra en el log el objeto de error sin datos del candidato (DP-01) |
| RF-02 | Persistencia de `Application` y `StageChange` (migración `003`, nueva) | Must | backend | - [ ] Tabla de inscripciones con candidato, oferta, etapa actual (`received`, `screening`, `interview`, `offer`, `hired`, `rejected`, por `CHECK`), fecha de creación y fecha del último cambio en ISO UTC con milisegundos (`GLOB`)<br>- [ ] Claves foráneas a `candidates` y `job_openings` con `ON DELETE RESTRICT` (DT-07; aclaración de DEC-06 que anota el diseño: «la integridad referencial es de la base, no un acoplamiento de código»)<br>- [ ] Índice **único** sobre (candidato, oferta) (INV-01, DEC-08)<br>- [ ] Tabla de `StageChange` con inscripción, etapa origen (nula solo en el inicial), destino, fecha, y motivo y nota (solo si el destino es `rejected`; motivo de la lista cerrada, nota ≤ 500), por `CHECK` (INV-07, INV-10)<br>- [ ] *Triggers* que abortan `UPDATE` y `DELETE` sobre `StageChange` (INV-03), salvo `SET note = NULL` (DT-12); ningún otro *trigger* (DT-07). No existe ninguna ruta ni operación que modifique o borre un `StageChange` ni una inscripción (INV-03, INV-08)<br>- [ ] `npm run db:reset` aplica `001`-`003` y el seed sin errores |
| RF-03 | Puerto «estado de la oferta» (DEC-06): lo define `inscripciones`, lo implementa `ofertas` y se conecta en `apps/api/src/app.ts` | Must | backend | - [ ] Devuelve el estado de una oferta (`draft`, `published`, `closed`) o «no existe», leyendo columnas explícitas<br>- [ ] `inscripciones` lo lee dentro de la misma transacción `BEGIN IMMEDIATE` que el `INSERT`: es la guarda de estado de la escritura (DT-08); `inscripciones` no ejecuta SQL sobre `job_openings`<br>- [ ] Ningún fichero de `apps/api/src/modules/applications/` importa de `apps/api/src/modules/jobs/` ni ejecuta SQL sobre `job_openings`; `candidates` no importa de `applications` ni de `jobs` (DEC-06), comprobado por un test<br>- [ ] Si el puerto lanza, 500 `INTERNAL_ERROR` y no se crea nada |
| RF-04 | Puerto de procesos del candidato real: lo implementa `inscripciones` y sustituye al stub en `buildApp` | Must | backend | - [ ] `buildApp` inyecta la implementación de `inscripciones` como `candidateProcesses` por defecto; el stub `noCandidateProcesses` solo queda para tests<br>- [ ] `getProcesses(id)`: `hasOpenApplication` = alguna inscripción en etapa no final; `hadAnyApplication` = alguna inscripción; `lastProcessClosedAt` = el instante del último `StageChange` a etapa final si no hay ninguna abierta, si no `null`<br>- [ ] Cumple el contrato de `apps/api/src/modules/candidates/processes-port.ts`: nunca `hadAnyApplication && !hasOpenApplication` con `lastProcessClosedAt` nulo<br>- [ ] Se ejecuta dentro de la transacción del iniciador (síncrono) y sin `SELECT *` |
| RF-05 | API del pipeline de una oferta (UC-17 · P, A2, E1) | Must | backend | - [ ] `GET /api/jobs/:jobId/applications`, registrada por el plugin de `applications` (DT-07)<br>- [ ] Devuelve la oferta (ID y estado) y sus inscripciones agrupables por etapa: ID de la inscripción, nombre del candidato, etapa, fecha del último cambio y, en `rejected`, el motivo; **nada más** (ni email, ni teléfono, ni nota)<br>- [ ] Cada etapa ordenada por fecha del último cambio descendente, con desempate por ID descendente; sin paginación<br>- [ ] Oferta inexistente → 404 `NOT_FOUND` sin datos; oferta existente sin inscripciones, en cualquier estado (también `draft`), → 200 con su estado y todo vacío (DT-03)<br>- [ ] El nombre del candidato se obtiene de `candidatos` por una operación que solo lee ID y nombre |
| RF-06 (movido a HU-05) | API del detalle de una inscripción con su historial (UC-18 · P, A1) | — | — | Movido a HU-05 por el corte de DT-11 |
| RF-07 | Pantalla del pipeline en la web | Must | frontend | - [ ] Enlace «Ver pipeline» en la ficha de una oferta `published` y ruta `/jobs/:id/pipeline` en la tabla `ROUTES` (DT-01)<br>- [ ] Seis columnas con nombre accesible, en orden: recibida, cribado, entrevista, oferta, contratado y rechazado; cada tarjeta con el nombre como texto (nunca HTML) y **sin enlace** (el acceso al detalle es de HU-05, DT-01), y la fecha del último cambio en `dd/mm/aaaa` (Europe/Madrid, `formatDate`); en «rechazado», el motivo con su etiqueta en castellano (DT-07 g)<br>- [ ] Estados cargando, vacío (con mensaje y «Inscribir candidato» si la oferta está `published`), error con mensaje útil y «Reintentar», y con datos (principio de diseño 3)<br>- [ ] «Inscribir candidato» solo si la oferta está `published`. En `draft`: «Esta oferta es un borrador: publícala para inscribir candidatos.», sin columnas ni acción. En `closed`: las mismas columnas sin «Inscribir candidato» (DT-03)<br>- [ ] `document.title` genérico y la URL solo con el ID de la oferta (sin nombres) |
| RF-08 | Inscribir desde el pipeline en la web (UC-14 · P, S-19) | Must | frontend | - [ ] «Inscribir candidato» abre un panel en la propia pantalla (no un diálogo modal) con el campo «Nombre o email» y «Buscar» (también con Enter), sobre `GET /api/candidates?q=` (sin endpoint nuevo de búsqueda), con `q` validado en el cliente (`validateSearchText`) (DT-02)<br>- [ ] Hasta 10 resultados con nombre y email y un botón «Inscribir» por fila; con más de 10, «Hay más resultados: afina la búsqueda.»; los ya inscritos no se marcan (DT-02)<br>- [ ] Cada resultado inscribe a un solo candidato; el control queda deshabilitado mientras la petición está en curso (un doble clic envía una sola petición)<br>- [ ] Éxito: aviso «Candidato inscrito.» con `role="status"`, el panel se cierra, el pipeline se recarga, el candidato aparece en «recibida» y el foco va al aviso<br>- [ ] 409 duplicado: «Este candidato ya está inscrito en la oferta.», **sin enlace** en esta HU (DT-02); 409 de estado: «La oferta ya no está publicada: no admite inscripciones.» y recarga del pipeline; 404 o error de red: mensaje con `role="alert"`, sin *stack trace*<br>- [ ] La búsqueda no va a la URL, al título, a `history.state` ni al almacenamiento del navegador; campo con `autoComplete="off"`<br>- [ ] Un recorrido e2e (Playwright) inscribe a un candidato creado en el test, lo ve en «recibida» y comprueba «Mientras dure el proceso» en su ficha; no cierra ofertas con inscripciones (DT-10) |
| RF-09 (movido a HU-05) | Pantalla del detalle de una inscripción en la web (UC-18 · P, A1) | — | — | Movido a HU-05 por el corte de DT-11 |
| RF-10 | Fin de retención «Mientras dure el proceso» de punta a punta (UC-12 · A1) | Must | fullstack | - [ ] Tras inscribir, `GET /api/candidates/:id` devuelve `retentionEndsAt: null` y la ficha muestra «Mientras dure el proceso», también si la fecha anterior ya había vencido (DT-06)<br>- [ ] Un candidato sin inscripciones conserva su fecha (sin cambios respecto a HU-03)<br>- [ ] Un candidato cuyas inscripciones son todas finales (seed) tiene la fecha que da la fórmula con `lastProcessClosedAt` |
| RF-11 | Seed de inscripciones (RV-26) | Must | backend | - [ ] Exactamente 40 inscripciones inventadas con su historial paso a paso y fechas relativas al `db:reset` (DT-05)<br>- [ ] En las 4 ofertas publicadas: todas las etapas, rechazos con cada uno de los 3 motivos manuales (2 con nota inventada no sensible) y al menos un `hired`; **una oferta publicada sin inscripciones**; en las 2 cerradas, solo `hired` y `rejected` («oferta cerrada» sin nota y con la fecha del cierre, más algún rechazo manual previo); varios candidatos con 2 inscripciones abiertas; ninguna en borradores (DT-05)<br>- [ ] Cumplen INV-04, INV-05, INV-06 e INV-07 (comprobado por un test del seed)<br>- [ ] La retención de cada candidato del seed es la que da `computeRetentionEndsAt` con el puerto real (con inscripción abierta, `null`) |
| RF-12 | Guarda de estado en el SQL de las escrituras de `jobs` que dependen del estado (SEC-02, defensa en profundidad) | Should | backend | - [ ] El `UPDATE` de edición de `apps/api/src/modules/jobs/repository.ts` solo afecta a filas en `draft` o `published`, y el `DELETE` solo a filas en `draft`, en el propio `WHERE` (DT-08)<br>- [ ] Un test llama al repositorio directamente con una oferta en el estado no permitido y comprueba 0 filas afectadas y la fila intacta<br>- [ ] El servicio traduce 0 filas afectadas a 409 `INVALID_TRANSITION` (no a un 200 ni a un 500); los tests de `apps/api/test/jobs/` siguen en verde |
| RF-13 (hecho en T-04) | Arrastre de deuda de HU-03 | — | — | Hecho en la tarea T-04 del sprint (test de versiones del consentimiento y teléfonos de ficción); `CandidateNotFound`, en «Fuera de scope» |

## Requisitos no funcionales

| ID | Descripción | Categoría | Métrica concreta |
|----|-------------|-----------|------------------|
| RNF-01 | Lectura del pipeline | Rendimiento | `GET` del pipeline < 200 ms con una oferta de 200 inscripciones, 1 000 candidatos y 2 000 inscripciones en total (`fastify.inject`, local; DT-07 e) |
| RNF-02 | Inscribir | Rendimiento | `POST` de inscripción < 500 ms con 1 000 candidatos y 2 000 inscripciones (`inject`, local) |
| RNF-03 | Datos personales en logs y errores | Privacidad | 0 apariciones de nombre, email, teléfono o nota de un candidato en los logs y en los cuerpos de error de los tests de `inscripciones`, incluidos los 500 provocados en el puerto de estado de la oferta, en el de procesos y en el recálculo (DP-01) |
| RNF-04 | Minimización del pipeline | Privacidad | Cada elemento del pipeline lleva exactamente los 5 campos de RF-05 (ID, nombre, etapa, fecha del último cambio y motivo o `null`); 0 claves `email`, `phone` o `note` en la respuesta |
| RNF-05 | Datos en el navegador | Privacidad | 0 nombres, emails o textos de búsqueda en `document.title`, en la URL o en `history.state` en las pantallas de pipeline y buscador |
| RNF-06 | HTML escapado | Seguridad | 0 usos de `dangerouslySetInnerHTML` en `apps/web/src/features/applications/` (nueva); un nombre con `<img onerror>` se pinta como texto en la tarjeta y en los resultados del buscador (test) |
| RNF-07 | Accesibilidad | Accesibilidad | 6 columnas con nombre accesible; 100 % de los controles del buscador con `<label>`; avisos con `role="status"` y errores con `role="alert"`; tras inscribir, el foco va al aviso, y al cerrar el panel sin inscribir, vuelve a «Inscribir candidato» (aserción con `expectFocusOn`) |

## Modelo de datos
Migración nueva `apps/api/src/db/migrations/003-create-applications.sql` (nombre exacto en el diseño; nunca se edita una
comiteada, DEC-03). Dueño: `inscripciones` (DEC-06). Nombres de columna orientativos; los fija el diseño.

**Inscripciones (`Application`)**
| Columna | Contenido | Restricción |
|---|---|---|
| `id` | Entero autoincremental | Sin borrado (INV-08) |
| `candidate_id` | ID del candidato | No nulo; clave foránea a `candidates` con `ON DELETE RESTRICT` (DT-07) |
| `job_id` | ID de la oferta | No nulo; clave foránea a `job_openings` con `ON DELETE RESTRICT` (DT-07) |
| `stage` | Etapa actual | `CHECK` en las 6 etapas; nace `received` |
| `created_at` · `last_change_at` | Instantes ISO UTC con milisegundos | `GLOB`; `last_change_at` = fecha del último `StageChange` (INV-06) |

- Índice **único** (`candidate_id`, `job_id`) (INV-01). Índice para el pipeline por (`job_id`, `stage`, `last_change_at`
  DESC, `id` DESC) e índice por `candidate_id` para el puerto de procesos (detalle en el diseño).
- Las claves foráneas entre tablas de módulos distintos son integridad referencial de la base, no un acoplamiento de
  código; el diseño lo anota como aclaración de DEC-06 (DT-07).

**Cambios de etapa (`StageChange`)**
| Columna | Contenido | Restricción |
|---|---|---|
| `id` | Entero autoincremental | Inmutable (INV-03): *triggers* que abortan `UPDATE` y `DELETE`, salvo `SET note = NULL` (DT-07, DT-12) |
| `application_id` | Inscripción | No nulo; clave foránea a inscripciones |
| `from_stage` | Etapa origen | Nula solo en el inicial (`to_stage = 'received'`) |
| `to_stage` | Etapa destino | `CHECK` en las 6 etapas |
| `changed_at` | Instante ISO UTC con milisegundos | `GLOB` |
| `reason` | Motivo de rechazo | No nulo si y solo si `to_stage = 'rejected'`; valor de la lista cerrada (los tres manuales y «oferta cerrada»), con códigos que fija el diseño |
| `note` | Nota de rechazo | Nula salvo en `rejected`; ≤ 500 caracteres (INV-10) |

- **Datos personales:** el vínculo candidato-oferta y su historial (RGPD §1) y la nota, texto libre que puede identificar
  a la persona. El nombre del candidato no se copia: se lee de `candidatos`.
- `candidates.retention_ends_at` ya admite `NULL` desde la migración `002` (HU-04 no migra `candidates`).
- `job_openings` no cambia de esquema; RF-12 solo cambia el SQL del repositorio.

## Interfaces / endpoints / pantallas
Errores en el envelope `{ error: { code, message, details? } }`. Rutas decididas en DT-01 y DT-07.

| Tipo | Ruta o pantalla | Cambio | Descripción |
|------|-----------------|--------|-------------|
| POST | `/api/applications` | Nuevo | Cuerpo `{ jobId, candidateId }`. 201 inscripción en `received` · 400 `VALIDATION_ERROR` · 403 `CROSS_SITE_REQUEST` · 404 `NOT_FOUND` (oferta o candidato) · 409 `INVALID_TRANSITION` (oferta no publicada) · 409 `DUPLICATE` (`details: [{ field: 'candidateId', message, existingId }]`) · 413 · 415 · 500 `INTERNAL_ERROR` |
| GET | `/api/jobs/:jobId/applications` | Nuevo | Pipeline (RF-05), registrada por el plugin de `applications`. 200 · 400 · 404 · 500 |
| GET | `/api/applications/:id` | Movido a HU-05 | Detalle e historial (UC-18, DT-11) |
| GET | `/api/candidates` | Sin cambios | Lo reutiliza el buscador (`q`, `pageSize`): 4 campos por elemento |
| GET | `/api/candidates/:id` | Sin cambios de contrato | `retentionEndsAt: null` con una inscripción abierta |
| Interno | Puerto «estado de la oferta» | Nuevo | Definido en `apps/api/src/modules/applications/` (nuevo), implementado en `apps/api/src/modules/jobs/`, conectado en `apps/api/src/app.ts` |
| Interno | `CandidateProcessesPort` | Implementación nueva | En `apps/api/src/modules/applications/`; sustituye a `noCandidateProcesses` en `buildApp` |
| Interno | Lecturas de `candidatos` | Nuevo | Existencia y nombre por ID, con columnas explícitas (sin `SELECT *`) |
| Pantalla | Pipeline (`/jobs/:id/pipeline`) | Nueva | RF-07 y RF-08, en `apps/web/src/features/applications/` (nueva) |
| Pantalla | Detalle de la inscripción (`/applications/:id`) | Movido a HU-05 | Ruta y cabecera ya decididas para HU-05 (DT-01, DT-04) |
| Pantalla | Ficha de la oferta (`/jobs/:id`) | Modificar | Enlace «Ver pipeline» solo en una oferta `published` (DT-01), en `apps/web/src/features/jobs/JobActions.tsx` o en la ficha |
| Pantalla | Ficha del candidato (`/candidates/:id`) | Sin cambios de código previstos | Ya pinta «Mientras dure el proceso» con `retentionEndsAt: null` |
| Rutas web | `apps/web/src/App.tsx` (tabla `ROUTES`) | Modificar | Una ruta nueva, `/jobs/:id/pipeline`, antes de `/jobs/:id` si hiciera falta por el orden de coincidencia |

## Flujos de usuario
1. **Abrir el pipeline:** ficha de una oferta `published` → «Ver pipeline» → seis columnas con las tarjetas (nombre sin
   enlace); si no hay inscripciones, estado vacío con «Inscribir candidato».
2. **Inscribir:** «Inscribir candidato» → panel con «Nombre o email» → escribe parte del nombre o del email y pulsa
   «Buscar» (o Enter) → hasta 10 resultados → «Inscribir» en uno → aviso «Candidato inscrito.» con el foco en él, el
   panel se cierra, el pipeline se recarga y la tarjeta aparece la primera en «recibida».
3. **Inscribir a uno ya inscrito:** → «Este candidato ya está inscrito en la oferta.», sin enlace; no cambia nada.
4. **Oferta cerrada en otra pestaña:** al inscribir → «La oferta ya no está publicada: no admite inscripciones.»; el
   pipeline se recarga sin «Inscribir candidato».
5. **Comprobar la retención:** ficha del candidato → «Fin de retención: Mientras dure el proceso».

## Datos personales
- **Qué toca:** el vínculo candidato-oferta y su historial de etapas (`Application`, `StageChange`), la nota de rechazo
  (solo existe en el seed en esta HU y ninguna pantalla de HU-04 la muestra), el nombre del candidato (lo lee, no lo
  copia) y, en el buscador, el nombre y el email que ya devuelve `GET /api/candidates` (RV-14, UC-14 · P). Escribe
  `candidates.retention_ends_at` a través de `recalculateRetention`, la operación de `candidatos` (no duplica la fórmula).
- **Para qué y base jurídica:** seguir el proceso de selección, con medidas precontractuales (art. 6.1.b) mientras haya
  una inscripción abierta (RGPD §2).
- **Cuánto tiempo:** la fórmula de retención de `candidatos` (RGPD §3, S-06): con una inscripción no final, «mientras
  dure el proceso» (`retentionEndsAt: null`), también si la fecha anterior ya había vencido (DT-06). Cerrar inscripciones
  y su recálculo llega en HU-05.
- **Qué devuelve cada respuesta:** el pipeline, solo el nombre (S-18, RGPD §6.2; RNF-04); el `POST`, la inscripción sin
  datos del candidato.
- **Qué NO aparece:** nombre, email, teléfono ni nota en logs, en mensajes de error, en `details`, en `document.title`, en
  la URL ni en `history.state` (RGPD §6.1; RNF-03, RNF-05). El 409 `DUPLICATE` solo lleva el ID de la inscripción
  existente; el 404 no dice nada del candidato.
- **Datos de ejemplo:** inventados, con `@example.com` y teléfonos de la serie `+34 600 000 0xx` (RGPD §6.3).

## Edge cases
Categorías de `docs/07_architecture_principles/QUALITY-GATES.md` §3: 1 Input inválido · 2 Boundary · 3 Fallo de
dependencia · 4 Concurrencia · 5 Datos corruptos o legacy · 6 Seguridad · 7 Idempotencia. EC-31 a EC-34 y EC-47 a
EC-50 eran de RF-06 y RF-09 y se movieron a HU-05 (DT-11).

| ID | RF | Categoría | Situación | Comportamiento esperado |
|----|----|-----------|-----------|-------------------------|
| EC-01 | RF-01 | 1 Input inválido | Cuerpo sin `candidateId`, con `candidateId: "12"` (texto), `0`, `-3`, `1.5`, una lista de IDs o un campo desconocido (`stage: "hired"`) | 400 `VALIDATION_ERROR`; la clave desconocida sale agrupada como `{ field: 'body' }` sin nombrarla (DEC-11.4); no se crea nada |
| EC-02 | RF-01 | 1 Input inválido | Cuerpo que no es JSON, vacío o `text/plain`; `application/x-www-form-urlencoded` | 400 / 415 en el envelope; no se crea nada |
| EC-03 | RF-01 | 2 Boundary | `candidateId` o `jobId` igual a `Number.MAX_SAFE_INTEGER` que no existe; y `MAX_SAFE_INTEGER + 1` | 404 sin datos / 400 (rango de DT-07 a) |
| EC-04 | RF-01 | 2 Boundary | Pareja con inscripción `rejected` del seed (RV-18, «para siempre») | 409 `DUPLICATE` con el ID existente; no se crea nada |
| EC-05 | RF-01 | 3 Fallo de dependencia | Falla el `INSERT` de la inscripción, el del `StageChange` o el `UPDATE` de la retención (trigger de fallo en el test) | 500 `INTERNAL_ERROR` sin *stack*; ni inscripción ni `StageChange`, y `retention_ends_at` igual que antes (UC-14 · E5) |
| EC-06 | RF-01 | 4 Concurrencia | Dos `POST` simultáneos de la misma pareja | Uno 201 y otro 409 `DUPLICATE` con el ID del primero; la base tiene una sola inscripción y un solo `StageChange` (DEC-08) |
| EC-07 | RF-01 | 4 Concurrencia | La oferta se cierra entre que la web pinta el pipeline y el reclutador inscribe | 409 `INVALID_TRANSITION`; no se crea nada (RV-17) |
| EC-08 | RF-01 | 5 Datos corruptos | Candidato cuya fecha de retención ya pasó (pendiente de anonimizar; la anonimización es de la feature A) | Se inscribe (201) y su retención pasa a `null` (DT-06) |
| EC-09 | RF-01 | 6 Seguridad | 404 de oferta o de candidato, 409 de duplicado y 500 del recálculo | Ningún `message`, `details` ni línea de log lleva nombre, email o teléfono; el 409 solo lleva `existingId` (RNF-03) |
| EC-10 | RF-01 | 6 Seguridad | `POST` con `Sec-Fetch-Site: cross-site` o `same-site` | 403 `CROSS_SITE_REQUEST`; no se crea nada (DEC-12) |
| EC-11 | RF-01 | 7 Idempotencia | Reintento de una inscripción ya creada | 409 `DUPLICATE` con el ID existente; sin `StageChange` nuevo ni recálculo que cambie la retención (S-14) |
| EC-12 | RF-02 | 1 Input inválido | Inserción directa en la base con etapa `foo`, motivo en un destino distinto de `rejected` o nota de 501 caracteres | Falla el `CHECK` |
| EC-13 | RF-02 | 2 Boundary | `StageChange` inicial: origen nulo con destino `received`; origen nulo con destino `screening` | El primero se acepta; el segundo falla el `CHECK` |
| EC-14 | RF-02 | 4 Concurrencia | Dos inserciones de la misma pareja que se saltan el servicio | El índice único rechaza la segunda (INV-01) |
| EC-15 | RF-02 | 5 Datos corruptos | `UPDATE` o `DELETE` directo sobre un `StageChange`; `DELETE` de un candidato o de una oferta con inscripciones | El *trigger* aborta el primero (INV-03, DT-07); la clave foránea `RESTRICT` rechaza el segundo |
| EC-16 | RF-02 | 7 Idempotencia | Aplicar las migraciones dos veces (`schema_migrations`) | La `003` no se reaplica; sin errores |
| EC-17 | RF-03 | 2 Boundary | Oferta en `draft`, `published`, `closed` e inexistente (también un borrador borrado) | 409, 201, 409 y 404 respectivamente; mensajes distintos para `draft`/`closed` y para «no existe» |
| EC-18 | RF-03 | 3 Fallo de dependencia | La implementación del puerto lanza | 500 `INTERNAL_ERROR`, `ROLLBACK`, no se crea nada |
| EC-19 | RF-03 | 4 Concurrencia | Cierre de la oferta e inscripción en la misma pareja de transacciones | La lectura del estado y el `INSERT` van en la misma transacción `BEGIN IMMEDIATE` (DT-08): si el cierre se confirma antes, 409; nunca queda una inscripción en una oferta `closed` creada después del cierre (INV-02) |
| EC-20 | RF-03 | 6 Seguridad | Acoplamiento entre módulos | Un test falla si `apps/api/src/modules/applications/` importa de `jobs` o contiene SQL sobre `job_openings`, o si `candidates` importa de `applications` o `jobs` |
| EC-21 | RF-04 | 2 Boundary | Candidato sin inscripciones; con una abierta; con dos finales de fechas distintas; con una final y otra abierta | `{false,false,null}`; `{true,true,null}`; `{false,true,<la más reciente>}`; `{true,true,null}` |
| EC-22 | RF-04 | 3 Fallo de dependencia | La lectura del puerto falla durante el recálculo de una inscripción | 500, `ROLLBACK` de la inscripción y de su `StageChange` |
| EC-23 | RF-04 | 5 Datos corruptos | Candidato con consentimiento vigente (+ 24 meses) y una inscripción abierta | `retentionEndsAt: null`: la inscripción abierta prevalece (S-06) |
| EC-24 | RF-04 | 6 Seguridad | Un error en el puerto | El log registra el error sin nombre, email ni teléfono (DP-01) |
| EC-25 | RF-04 | 7 Idempotencia | `getProcesses` dos veces seguidas sin cambios | Mismo resultado; no escribe |
| EC-26 | RF-05 | 1 Input inválido | `jobId` `abc`, `0`, `01` o con 16 dígitos | 400 `VALIDATION_ERROR` |
| EC-27 | RF-05 | 2 Boundary | Oferta con 0, 1 y 200 inscripciones; dos con la misma fecha de último cambio | Vacío; una; las 200 sin paginar (RNF-01); empate resuelto por ID descendente |
| EC-28 | RF-05 | 2 Boundary | Pipeline de una oferta `draft` (por URL) | API: 200 con estado `draft` y todo vacío; web: el mensaje de borrador, sin columnas ni acción (DT-03) |
| EC-29 | RF-05 | 3 Fallo de dependencia | Error de la base al leer | 500 en el envelope, sin *stack* |
| EC-30 | RF-05 | 6 Seguridad | Respuesta del pipeline con candidatos con teléfono y notas en el seed | Sin `email`, `phone` ni `note` (RNF-04) |
| EC-31 (movido a HU-05) | — | — | — | — |
| EC-32 (movido a HU-05) | — | — | — | — |
| EC-33 (movido a HU-05) | — | — | — | — |
| EC-34 (movido a HU-05) | — | — | — | — |
| EC-35 | RF-07 | 1 Input inválido | URL `/jobs/abc/pipeline` | «Página no encontrada» (`parseRouteId`), sin petición |
| EC-36 | RF-07 | 2 Boundary | Cambio registrado a las 23:30 UTC del 31/12 | La tarjeta muestra la fecha de Europe/Madrid (01/01 del año siguiente) |
| EC-37 | RF-07 | 3 Fallo de dependencia | API caída o respuesta no JSON | Estado de error con mensaje útil y «Reintentar», sin *stack* (UC-17 · E2) |
| EC-38 | RF-07 | 6 Seguridad | Nombre `<img src=x onerror=alert(1)>` | Se ve como texto (RNF-06) |
| EC-39 | RF-07 | 6 Seguridad | Título del documento y URL del pipeline | Genérico; solo el ID de la oferta (RNF-05) |
| EC-40 | RF-08 | 1 Input inválido | Búsqueda de 101 caracteres o con un carácter de control | Error junto al campo, sin petición (`validateSearchText`) |
| EC-41 | RF-08 | 2 Boundary | Búsqueda sin resultados; con 10 resultados; con 11 o más | Mensaje de que ningún candidato coincide; los 10 sin aviso; 10 y «Hay más resultados: afina la búsqueda.» (DT-02) |
| EC-42 | RF-08 | 3 Fallo de dependencia | La API no responde al buscar o al inscribir | Mensaje con `role="alert"`; el panel sigue abierto y no se pierde lo escrito |
| EC-43 | RF-08 | 4 Concurrencia | Otra pestaña inscribe al mismo candidato antes | 409: «Este candidato ya está inscrito en la oferta.» sin enlace; el pipeline se recarga |
| EC-44 | RF-08 | 4 Concurrencia | Otra pestaña cierra la oferta antes de inscribir | 409: «La oferta ya no está publicada: no admite inscripciones.»; recarga sin «Inscribir candidato» |
| EC-45 | RF-08 | 6 Seguridad | Texto de búsqueda con un email | No aparece en la URL, el título, `history.state` ni el almacenamiento (RNF-05) |
| EC-46 | RF-08 | 7 Idempotencia | Doble clic en «Inscribir» | Una sola petición (control deshabilitado en curso); si llegaran dos, la segunda da 409 y la web no muestra error de duplicado sobre su propia inscripción recién creada (detalle en el diseño) |
| EC-47 (movido a HU-05) | — | — | — | — |
| EC-48 (movido a HU-05) | — | — | — | — |
| EC-49 (movido a HU-05) | — | — | — | — |
| EC-50 (movido a HU-05) | — | — | — | — |
| EC-51 | RF-10 | 2 Boundary | Candidato cuya única inscripción es `rejected` del seed | Fecha calculada con `lastProcessClosedAt` (no «Mientras dure el proceso») |
| EC-52 | RF-10 | 3 Fallo de dependencia | El recálculo falla al inscribir | La ficha conserva su fecha anterior (UC-14 · E5) |
| EC-53 | RF-10 | 5 Datos corruptos | Candidato con consentimiento retirado y una inscripción abierta | «Mientras dure el proceso» |
| EC-54 | RF-11 | 2 Boundary | Composición del seed | Exactamente 40; las 6 etapas presentes en ofertas publicadas; una oferta publicada sin inscripciones (DT-05) |
| EC-55 | RF-11 | 5 Datos corruptos | Ofertas `closed` del seed | Solo `hired` y `rejected` (INV-05); «oferta cerrada» solo en rechazos con la fecha del cierre (INV-07) |
| EC-56 | RF-11 | 6 Seguridad | Datos del seed | Inventados, `@example.com`, notas sin datos sensibles, teléfonos de la serie `+34 600 000 0xx` |
| EC-57 | RF-11 | 7 Idempotencia | `npm run db:reset` dos veces | Mismos recuentos y mismas invariantes |

**Evaluación de las 7 categorías por RF Must** (EC o `N/A — motivo`):

| RF | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|----|---|---|---|---|---|---|---|
| RF-01 | EC-01, EC-02 | EC-03, EC-04 | EC-05 | EC-06, EC-07 | EC-08 | EC-09, EC-10 | EC-11 |
| RF-02 | EC-12 | EC-13 | N/A — la migración corre en `db:reset` sobre una base nueva; un fallo de SQLite aborta el reset entero | EC-14 | EC-15 | N/A — sin entrada de usuario: lo cubren EC-09 y EC-30 en las rutas | EC-16 |
| RF-03 | N/A — recibe un ID ya validado por el esquema de RF-01/RF-05 | EC-17 | EC-18 | EC-19 | EC-17 (borrador borrado) | EC-20 | N/A — lectura pura, sin efectos |
| RF-04 | N/A — recibe un ID interno, nunca entrada de usuario | EC-21 | EC-22 | N/A — síncrono dentro de la transacción del iniciador (`node:sqlite`, una conexión) | EC-23 | EC-24 | EC-25 |
| RF-05 | EC-26 | EC-27, EC-28 | EC-29 | N/A — una sola lectura; el reclutador ve la foto del momento | N/A — INV-06 lo garantiza la transacción de RF-01 y lo prueba EC-55 | EC-30 | N/A — `GET` sin efectos |
| RF-07 | EC-35 | EC-36 | EC-37 | N/A — recarga tras inscribir; otra pestaña ve el cambio al recargar (EC-43) | N/A — la web pinta lo que valida la API; etapa desconocida imposible por `CHECK` (EC-12) | EC-38, EC-39 | N/A — solo lectura |
| RF-08 | EC-40 | EC-41 | EC-42 | EC-43, EC-44 | N/A — no persiste nada en el cliente | EC-45 | EC-46 |
| RF-10 | N/A — no hay entrada nueva: es el `GET` de HU-03 | EC-51 | EC-52 | EC-06 (una sola inscripción, un recálculo) | EC-53 | EC-09 | EC-11 |
| RF-11 | N/A — datos fijos del repositorio, sin entrada | EC-54 | N/A — corre en `db:reset`; si falla, el reset falla entero | N/A — proceso único sin concurrencia | EC-55 | EC-56 | EC-57 |

RF-06 y RF-09 (movidos a HU-05) no se evalúan aquí.

## Decisiones aplicables
- **DEC-01:** envelope de error en todas las rutas nuevas; TypeScript estricto; Vitest y Playwright (RF-01, RF-05).
- **DEC-03:** migración nueva `003`, sin editar `001` ni `002`; seed con datos inventados (RF-02, RF-11).
- **DEC-04:** sin login, un único rol «reclutador»; el PRD no declara permisos. La seguridad se centra en datos
  personales, inyección y enumeración (EC-09, EC-30).
- **DEC-06:** `inscripciones` es dueño de sus tablas; lee el estado de la oferta por el puerto que define e implementa
  `ofertas`, dentro de la transacción del `INSERT` (DT-08); implementa el puerto de procesos de `candidatos` e invoca su
  operación interna `recalculateRetention` en la misma transacción; dirección `ofertas → inscripciones → candidatos`,
  conexión en `apps/api/src/app.ts`. Test de fallo inyectado por cada efecto cruzado (RF-01, RF-03, RF-04; EC-05, EC-18,
  EC-22). Las claves foráneas entre tablas de módulos son una aclaración de DEC-06 que anota el diseño (DT-07).
- **DEC-07:** 400 validación, 404 inexistente sin datos, 409 duplicado con `existingId` y precondición de estado, 201 al
  crear (RF-01).
- **DEC-08:** estado comprobado dentro de la transacción; unicidad de la pareja por índice único traducido a 409
  (RF-01, RF-02; EC-06, EC-19).
- **DEC-09:** instantes en UTC con el reloj inyectado; la web muestra `dd/mm/aaaa` en Europe/Madrid (RF-01, RF-07;
  EC-36).
- **DEC-10:** el buscador reutiliza `GET /api/candidates` (búsqueda sin tildes ni mayúsculas, 4 campos). El pipeline,
  sin paginación por S-18 (excepción declarada a DEC-10, que solo regula listados paginados).
- **DEC-11:** Ajv sin coerción ni `removeAdditional`; `params` numéricos como texto con `pattern`; `details` acotado;
  códigos adicionales; reloj en `buildApp({ now })`; `withTransaction`; caracteres de control (RF-01, RF-05).
- **DEC-12:** el `POST` de inscripción hereda la guarda `CROSS_SITE_REQUEST` (EC-10).
- **Avisos de review:** SEC-02 de HU-02 (RF-12), DP-01/DP-02 de HU-02 (RF-01, RF-04, RNF-03). Los avisos de HU-03
  (versión del consentimiento y teléfonos) los cerró la tarea T-04.

## Fuera de scope
- **UC-18 entero** (P, A1, A2, E1 y E2): API `GET /api/applications/:id`, pantalla del detalle con su historial
  (`/applications/:id`, cabecera de DT-04) y el enlace de cada tarjeta al detalle: HU-05 (DT-11, DT-01). En HU-04 la
  tarjeta muestra el nombre sin enlace y el 409 duplicado no enlaza a la inscripción existente (DT-02).
- Avanzar etapas, rechazar a mano, sus formularios y las acciones «Avanzar» y «Rechazar» de las tarjetas (UC-15, UC-16,
  UC-17 · P paso 5): HU-05.
- Implementar `JobApplicationsPort` (`countActiveApplications` y `rejectActiveApplications`), el rechazo al cerrar una
  oferta (UC-19) y UC-04 · A1: HU-05 (DT-01 y DT-02 del PRD de HU-02; CA de UC-04 · A1 en `hu.md` de HU-05). Se acepta la
  ventana de INV-05 hasta entonces (DT-10).
- Pipeline de solo lectura de una oferta `closed` como flujo probado (UC-17 · A1) y su enlace desde la ficha de una
  oferta cerrada: HU-05. Aquí solo se garantiza que una `closed` no ofrece «Inscribir candidato» (DT-03).
- Recalcular la retención al cerrar inscripciones (paso a `hired` o `rejected`): HU-05.
- El arrastre de deuda de HU-03 (test de versiones del consentimiento y teléfonos de ficción): hecho en la tarea T-04 del
  sprint. La copia local de `CandidateNotFound` en `apps/web/src/features/candidates/CandidateFormScreen.tsx` sigue como
  deuda abierta en `docs/05_modules/candidatos/technical.md`.
- Inscribir desde la ficha del candidato o varios a la vez (S-19); retroceder, deshacer o borrar inscripciones
  (RV-18, RV-21).
- Estado «anonimizado», bloqueo de inscripción de anonimizados y etiqueta «Candidato anonimizado» (UC-17 · A3, S-05):
  feature A.
- Exportación por derecho de acceso y la importación CSV (features A y C).
- Paginación del pipeline (S-18).
- Cambios de esquema en `job_openings` o `candidates`.

## Open Questions

No hay preguntas abiertas.

## Decisiones tomadas

| ID | Decisión | Razón | Impacto en el PRD | Fecha |
|----|----------|-------|-------------------|-------|
| DT-01 | (OQ-01, producto; decide el responsable técnico: «todo según recomendación») **En HU-04:** enlace «Ver pipeline» en la ficha de una oferta `published` y ruta `/jobs/:id/pipeline`. **Decidido para HU-05** (por el corte de DT-11): ruta `/applications/:id` y nombre de cada tarjeta como enlace a su detalle. En HU-04 la tarjeta muestra el nombre sin enlace | `hu.md` dejaba al PRD el acceso al pipeline y al detalle; el detalle pasa a HU-05 | RF-07, Interfaces, Flujos 1, Fuera de scope | 2026-10-06 |
| DT-02 | (OQ-02, producto; el responsable técnico) Panel en el pipeline (no modal) con «Nombre o email» y «Buscar» (Enter); hasta 10 resultados con nombre y email y «Inscribir» por fila; con más, «Hay más resultados: afina la búsqueda.»; los ya inscritos no se marcan. Éxito: «Candidato inscrito.», se cierra el panel, se recarga el pipeline y el foco va al aviso. 409 duplicado: «Este candidato ya está inscrito en la oferta.»; 409 de estado: «La oferta ya no está publicada: no admite inscripciones.». **Consecuencia del corte (DT-11):** el enlace «Ver la inscripción» del 409 duplicado no tiene destino en HU-04 (el detalle es de HU-05), así que en esta HU el mensaje va sin enlace; no se inventa otro destino | UC-14 · P y S-19 no fijaban la interfaz | RF-08, RNF-07, Flujos 2-4, EC-41, EC-43, EC-44, CA-02, CA-08 | 2026-10-06 |
| DT-03 | (OQ-03, producto; el responsable técnico) La API del pipeline da 200 con el estado para cualquier oferta existente. Web: en `draft`, «Esta oferta es un borrador: publícala para inscribir candidatos.» sin columnas ni acción; en `closed`, las mismas columnas sin «Inscribir candidato» | UC-17 no cubre el borrador por URL; A1 es de HU-05 | RF-05, RF-07, EC-28 | 2026-10-06 |
| DT-04 | (OQ-04, producto; el responsable técnico) **Decidido para HU-05** (por el corte de DT-11): cabecera del detalle con el nombre del candidato (enlace a su ficha) y el título de la oferta (enlace a su pipeline), etapa actual, historial en lista ordenada con fecha `dd/mm/aaaa` sin hora, «—» como origen del inicial, motivo y nota bajo el cambio de rechazo, y título del documento «Inscripción · ATS» | UC-18 no fijaba la cabecera ni la hora | Ninguno en HU-04 (Fuera de scope); lo hereda el PRD de HU-05 | 2026-10-06 |
| DT-05 | (OQ-05, producto; el responsable técnico) Seed: exactamente 40 inscripciones con fechas relativas al reset; en las 4 publicadas, todas las etapas, rechazos con los 3 motivos manuales (2 con nota inventada no sensible) y al menos un `hired`; una oferta publicada sin inscripciones; en las 2 cerradas, solo `hired` y `rejected` («oferta cerrada» sin nota con la fecha del cierre, más algún rechazo manual previo); varios candidatos con 2 inscripciones abiertas; ninguna en borradores; historial coherente paso a paso | RV-26 decía «unas 40»; INV-04..07 y la demo necesitan una mezcla concreta | RF-11, EC-54, EC-55, CA-25 | 2026-10-06 |
| DT-06 | (OQ-06, producto; el responsable técnico) Se puede inscribir a un candidato con la retención vencida; su retención pasa a `null`. El bloqueo de anonimizados llega con la feature A | RV-17 solo bloquea a los anonimizados | RF-10, EC-08, Datos personales | 2026-10-06 |
| DT-07 | (OQ-07, ingeniería; responsable técnico, acepta la propuesta) (a) `POST /api/applications` con `{ jobId, candidateId }`, enteros JSON de `1` a `Number.MAX_SAFE_INTEGER`; pipeline en `GET /api/jobs/:jobId/applications`, registrada por el plugin de `applications`. (b) 409 de oferta no publicada `INVALID_TRANSITION`; duplicado `DUPLICATE` con `details: [{ field: 'candidateId', existingId }]`. (c) 404 primero de la oferta y luego del candidato, con «La oferta no existe.» y «El candidato no existe.». (d) Migración `003` con motivo y nota ya en `StageChange`, `last_change_at` en la inscripción y claves foráneas a `job_openings` y `candidates` con `ON DELETE RESTRICT`; el diseño anota la aclaración de DEC-06 «la integridad referencial es de la base, no un acoplamiento de código». *Triggers* **solo** para la inmutabilidad de `StageChange` (abortan `UPDATE` y `DELETE`), nada más. (e) Volúmenes de RNF-01/02: 1 000 candidatos, 2 000 inscripciones, 200 en una oferta. (f) Dejó de aplicar: el test de versiones del consentimiento lo hizo T-04. (g) Etiquetas: recibida, cribado, entrevista, oferta, contratado, rechazado; motivos «No encaja con el perfil», «Retirada del candidato», «Otro», «Oferta cerrada» | Contrato y persistencia necesarios para el diseño | RF-01, RF-02, RF-05, RF-07, RNF-01, Modelo de datos, Interfaces, EC-03, EC-15, Decisiones aplicables | 2026-10-06 |
| DT-08 | (OQ-08, ingeniería; responsable técnico) La guarda al inscribir es leer el puerto «estado de la oferta» dentro del mismo `BEGIN IMMEDIATE` que el `INSERT`; `inscripciones` no ejecuta SQL sobre `job_openings`. La guarda literal en el `WHERE` va en el SQL de `jobs` (SEC-02, RF-12). DEC-06 no se enmienda | DEC-06 prohíbe consultar tablas de otro módulo con SQL; SQLite serializa a los escritores | RF-01, RF-03, RF-12, EC-19, Decisiones aplicables | 2026-10-06 |
| DT-09 | (OQ-09, ingeniería; responsable técnico) `ofertas` entra en `modulos_afectados` de `hu.md` (ya aplicado) | HU-04 implementa el puerto en `jobs`, añade «Ver pipeline» y las guardas de RF-12 | Info | 2026-10-06 |
| DT-10 | (OQ-10, producto; el responsable técnico) Se acepta la ventana de INV-05 hasta HU-05: entre los merges de HU-04 y HU-05, el diálogo de cierre dirá 0 y cerrar dejará inscripciones abiertas. Ningún test de HU-04 cierra ofertas con inscripciones, y tras el merge de HU-05 se hace `npm run db:reset` | `JobApplicationsPort` es de HU-05 (DT-01/DT-02 de HU-02, CA de HU-05); adelantar solo el recuento sería peor | RF-08 (e2e), Fuera de scope | 2026-10-06 |
| DT-11 | (OQ-11, ingeniería; responsable técnico) Corte aceptado: UC-18 · P y A1 (API y pantalla del detalle con el historial) pasan a HU-05, que ya tenía A2, E1 y E2 (ya aplicado en `hu.md`, UC-18 y FEAT-03). Salen RF-06 y RF-09, CA-17 y CA-18 y EC-31 a EC-34 y EC-47 a EC-50, con su ID marcado «movido a HU-05». RF-13 sale por estar hecho en T-04 (CA-23 y CA-24, «hecho en T-04») | Techo de 15 tareas por HU | Casos de uso, RF-06, RF-09, RF-13, RNF-01, RNF-05, Interfaces, Edge cases, Criterios de aceptación, Fuera de scope | 2026-10-06 |
| DT-12 | (Diseño, producto; el responsable técnico, 2026-10-07, opción b) Los *triggers* de inmutabilidad del `StageChange` permiten solo `UPDATE stage_changes SET note = NULL` y nada más: «excepción RGPD: anonimizar el texto libre» (`docs/RGPD.md` §5), para que la feature A pueda vaciar la nota de un rechazo. Cualquier otro `UPDATE` o un `DELETE` abortan | La invariante es «el historial no cambia»; borrar texto libre identificativo está previsto en RGPD §5 | RF-02, CA-27, EC-15 | 2026-10-07 |

## Criterios de aceptación

| ID | Origen (UC · flujo o RF) | Dado | Cuando | Entonces |
|----|--------------------------|------|--------|----------|
| CA-01 | UC-14 · P / RF-01, RF-04 | Una oferta `published` y un candidato sin inscripción en ella, con fin de retención con fecha | Se envía `POST /api/applications` | 201 con la inscripción en `received`; existe un `StageChange` sin origen → `received` con el instante del reloj inyectado en UTC; `GET /api/candidates/:id` devuelve `retentionEndsAt: null`; todo en una transacción (un fallo inyectado en cualquiera de los tres pasos lo deshace, CA-11) |
| CA-02 | UC-14 · P / RF-08, RF-07 | El pipeline de una oferta `published` | El reclutador pulsa «Inscribir candidato», busca por parte del nombre (y, en otro caso, del email) y pulsa «Inscribir» en un resultado | Aparece «Candidato inscrito.» y la tarjeta con su nombre la primera de «recibida» (test de la web y recorrido e2e) |
| CA-03 | UC-14 · P / RF-01, RF-08 | El pipeline de una oferta `published` | Se intenta inscribir a dos candidatos en una sola petición (lista de IDs) o desde la web | La API responde 400 a la lista; la web solo ofrece inscribir de un resultado en uno y envía un `candidateId` por petición |
| CA-04 | UC-14 · E1 / RF-01, RF-03 | Una oferta en `draft` | Se intenta inscribir a un candidato | 409 `INVALID_TRANSITION` con un mensaje que explica que la oferta no está publicada; no hay inscripción ni `StageChange` y la retención del candidato no cambia |
| CA-05 | UC-14 · E1 / RF-01, RF-03 | Una oferta en `closed` | Se intenta inscribir a un candidato | 409 `INVALID_TRANSITION` con el mismo mensaje; no se crea nada |
| CA-06 | UC-14 · E2 / RF-01 | Un candidato con inscripción en la oferta, en `received` y, en otro caso, en `rejected` (seed) | Se intenta inscribirlo otra vez | 409 `DUPLICATE` con `existingId` = ID de la inscripción existente; no se crea nada y la retención no cambia |
| CA-07 | UC-14 · E2 / RF-01, RF-02 | Una pareja candidato-oferta sin inscripción | Llegan dos peticiones simultáneas para inscribirla | Una da 201 y la otra 409 `DUPLICATE` con el ID de la primera; queda una inscripción y un `StageChange` |
| CA-08 | UC-14 · E2 / RF-08 | El panel del buscador abierto con un candidato que ya está inscrito | El reclutador pulsa «Inscribir» | Ve «Este candidato ya está inscrito en la oferta.», sin enlace (DT-02); el pipeline no gana ninguna tarjeta |
| CA-09 | UC-14 · E3 / RF-01 | Un `jobId` o un `candidateId` que no existe | Se intenta inscribir | 404 `NOT_FOUND` («La oferta no existe.» o «El candidato no existe.») cuyo `message` y `details` no llevan nombre, email ni teléfono; no se crea nada |
| CA-10 | UC-14 · E4 / RF-01 | — | Llega una inscripción sin `candidateId`, con `candidateId: "7"`, con un campo desconocido o con un cuerpo no JSON | 400 en el envelope (`VALIDATION_ERROR` o `BAD_REQUEST`); no se crea nada |
| CA-11 | UC-14 · E5 / RF-01 | Un fallo inyectado en el `INSERT` de la inscripción, en el del `StageChange` y, en otro caso, en la escritura de la retención | Se inscribe | 500 `INTERNAL_ERROR` sin *stack*; no quedan inscripción ni `StageChange`, y `retention_ends_at` es el de antes |
| CA-12 | UC-17 · P / RF-05, RF-07 | Una oferta `published` con inscripciones en varias etapas (seed o creadas en el test) | El reclutador abre su pipeline con «Ver pipeline» | Ve 6 columnas (recibida, cribado, entrevista, oferta, contratado, rechazado); cada tarjeta con solo el nombre como texto, sin enlace, y la fecha del último cambio `dd/mm/aaaa` en Europe/Madrid; el motivo en «rechazado»; cada columna de la más reciente a la más antigua; todas las tarjetas sin paginar; y la acción «Inscribir candidato» |
| CA-13 | UC-17 · P / RF-05 | El pipeline de una oferta con candidatos con email, teléfono y una nota de rechazo | Se revisa la respuesta de la API | No contiene las claves ni los valores de email, teléfono ni nota; cada elemento tiene exactamente los campos de RF-05 |
| CA-14 | UC-17 · A2 / RF-05, RF-07 | Una oferta `published` sin inscripciones | El reclutador abre su pipeline | La API da 200 con todo vacío y la web muestra el estado vacío con un mensaje que lo explica y «Inscribir candidato» |
| CA-15 | UC-17 · E1 / RF-05, RF-07 | Un ID de oferta que no existe | Se abre su pipeline | La API responde 404 `NOT_FOUND` y la web muestra «Página no encontrada» (DD-09 del TD-frontend) |
| CA-16 | UC-17 · E2 / RF-07 | La API no responde | El reclutador abre un pipeline | Ve el estado de error con un mensaje útil y «Reintentar», sin *stack trace* |
| CA-17 (movido a HU-05) | UC-18 · P | — | — | — |
| CA-18 (movido a HU-05) | UC-18 · A1 | — | — | — |
| CA-19 | UC-12 · A1 / RF-10 | Un candidato con una inscripción no final | El reclutador abre su ficha | El fin de retención aparece como «Mientras dure el proceso» (test de la web con la respuesta real de la API y recorrido e2e) |
| CA-20 | UC-12 · A1 / RF-04 | Un candidato con una inscripción no final y otro sin inscripciones | `candidatos` consulta sus procesos por el puerto conectado en `buildApp` | El primero: `hasOpenApplication: true`, `hadAnyApplication: true`; el segundo: «sin inscripciones» (`false`, `false`, `null`) |
| CA-21 | RF-03 | El código de `apps/api/src/modules/` | Se ejecuta el test de dependencias entre módulos | `applications` no importa de `jobs` ni consulta `job_openings`; `candidates` no importa de `applications` ni de `jobs` |
| CA-22 | RF-12 | Una oferta `closed` y otra `published` en la base | Se llama al repositorio con el `UPDATE` de edición sobre la cerrada y con el `DELETE` sobre la publicada, saltándose el servicio | 0 filas afectadas y las filas intactas; el servicio traduce un 0 inesperado a 409 `INVALID_TRANSITION` |
| CA-23 (hecho en T-04) | RF-13 (a) | — | — | — |
| CA-24 (hecho en T-04) | RF-13 (b) | — | — | — |
| CA-25 | RF-11 | `npm run db:reset` | Se ejecuta el test del seed | 40 inscripciones que cumplen INV-04 a INV-07 y la composición de DT-05, y retención de cada candidato igual a la de la fórmula con el puerto real |
| CA-26 | RF-07 / DT-03 | Una oferta `draft` y otra `closed` | El reclutador abre `/jobs/:id/pipeline` de cada una | En la `draft`, el mensaje de borrador sin columnas ni «Inscribir candidato»; en la `closed`, las columnas sin «Inscribir candidato» |
| CA-27 | RF-02 / DT-07, DT-12 | Un `StageChange` en la base | Se ejecuta un `UPDATE` o un `DELETE` directo sobre él | Un `UPDATE` que cambie cualquier columna o ponga la nota a otro texto, o un `DELETE`, aborta y la fila no cambia; vaciar la nota (`SET note = NULL`, sin tocar otra columna) se permite (excepción RGPD §5) |

## Checklist de cierre
- [ ] Todos los RF tienen implementación verificable.
- [ ] Cada flujo de UC cubierto tiene al menos un CA, y cada CA su test.
- [ ] Cada edge case Must tiene su test.
- [ ] Review aprobada.
- [ ] 0 Open Questions.

---
v1.1 (2026-10-07): DT-12 (el *trigger* permite vaciar la nota, decisión del responsable técnico en el diseño) y CA-15 («Página no encontrada», coherente con DD-09 del TD-frontend), aprobadas por el responsable técnico en el gate de tareas.
