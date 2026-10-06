# HU-04 — Inscribir en una oferta publicada, sin duplicados — PRD

## Info
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** fullstack
- **Módulos:** `inscripciones` (código `applications`, nuevo), `candidatos` (código `candidates`) y, por el puerto «estado
  de la oferta» y las guardas de SEC-02, `ofertas` (código `jobs`; ver OQ-09)
- **Fecha:** 2026-10-06
- **Estado:** Draft

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
- **Deuda que llega a esta HU:** de la review de HU-03 (`docs/05_modules/candidatos/technical.md`, «Deuda técnica»):
  el test que ate `CONSENT_VERSION` (`apps/web/src/features/candidates/consent.ts`) con `CONSENT_TEXT_VERSION`
  (`apps/api/src/modules/candidates/schemas.ts`), hoy solo comparadas por `e2e/candidates.spec.ts`; los teléfonos del
  seed (`600 111 2xx` en `apps/api/src/db/seed-candidates.ts`) y de algunos tests fuera de la serie `+34 600 000 0xx`
  (RGPD §6.3); y la copia local de `CandidateNotFound` en `apps/web/src/features/candidates/CandidateFormScreen.tsx`.
  De la review de HU-02 (`docs/05_modules/ofertas/technical.md`, DP-01/DP-02): los errores de un puerto no llevan datos
  del candidato al log, y no se copia el `SELECT *` de `findById`.

### Resultado esperado
Nace el módulo `inscripciones` en API y web, con su migración `003` y un seed de 40 inscripciones inventadas. Desde la
ficha de una oferta publicada, el reclutador abre su pipeline: una columna por etapa, cada tarjeta con solo el nombre del
candidato y la fecha del último cambio (y el motivo en «rechazado»). Desde allí busca un candidato por nombre o email y lo
inscribe, uno cada vez: la inscripción nace en `received` con su `StageChange` inicial y, en la misma transacción,
`candidatos` recalcula la retención con el puerto de procesos ya real, así que la ficha del candidato muestra «Mientras
dure el proceso». Inscribir en una oferta que no está publicada o repetir la pareja da 409 sin crear nada. El reclutador
consulta el detalle de una inscripción con su historial. Las escrituras de `jobs` que dependen del estado llevan la guarda
en el SQL (SEC-02).

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
| UC-18 · P | Detalle con la etapa actual y el historial cronológico (motivo y nota en el rechazo) | CA-17 |
| UC-18 · A1 | Inscripción recién creada: un único `StageChange` sin origen → `received` | CA-18 |
| UC-12 · A1 | Ficha con «Mientras dure el proceso» y puerto de procesos real | CA-19, CA-20 |

Ficheros: `docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md`,
`docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md`,
`docs/05_modules/inscripciones/casos-de-uso/UC-18-consultar-historial.md` y
`docs/05_modules/candidatos/casos-de-uso/UC-12-ver-ficha.md`. La columna CA de su «Trazabilidad» se rellena con el PRD
aprobado.

Flujos de esos UC que **no** cubre esta HU (de `hu.md`): UC-17 · P, acciones «Avanzar» y «Rechazar»; UC-17 · A1 y A3;
UC-18 · A2, E1 y E2; UC-12 · P, E1 y E2. El acceso al detalle desde cada tarjeta lo decide OQ-01.

## Requisitos funcionales

| ID | Descripción | Prioridad | Scope | Criterios de aceptación |
|----|-------------|-----------|-------|-------------------------|
| RF-01 | Inscribir por API: un candidato en una oferta, con la transacción completa de UC-14 | Must | backend | - [ ] Petición con un único `jobId` y un único `candidateId` (contrato exacto en OQ-07); éxito 201 con la inscripción creada en `received`<br>- [ ] Orden de comprobación: guarda entre sitios (403) → cuerpo y esquema (400) → existencia de la oferta y del candidato (404) → estado de la oferta (409) → unicidad de la pareja (409 `DUPLICATE` con `existingId`, por el índice único, sin `SELECT` previo; DEC-08)<br>- [ ] Dentro de una sola `withTransaction`: lectura del estado de la oferta (RF-03), `INSERT` de la inscripción, `INSERT` del `StageChange` sin origen → `received` con el instante del reloj inyectado en UTC, y `recalculateRetention(candidateId)` de `candidatos`; cualquier error hace `ROLLBACK` de todo<br>- [ ] La existencia del candidato se comprueba con una operación de `candidatos` que lee columnas explícitas, sin `SELECT *` (DP-02)<br>- [ ] Ningún `message` ni `details` de error lleva nombre, email ni teléfono del candidato; un error del puerto o del recálculo registra en el log el objeto de error sin datos del candidato (DP-01) |
| RF-02 | Persistencia de `Application` y `StageChange` (migración `003`, nueva) | Must | backend | - [ ] Tabla de inscripciones con candidato, oferta, etapa actual (`received`, `screening`, `interview`, `offer`, `hired`, `rejected`, por `CHECK`), fecha de creación y fecha del último cambio en ISO UTC con milisegundos (`GLOB`)<br>- [ ] Índice **único** sobre (candidato, oferta) (INV-01, DEC-08)<br>- [ ] Tabla de `StageChange` con inscripción, etapa origen (nula solo en el inicial), destino, fecha, y motivo y nota (solo si el destino es `rejected`; motivo de la lista cerrada, nota ≤ 500), por `CHECK` (INV-07, INV-10)<br>- [ ] No existe ninguna ruta ni operación que modifique o borre un `StageChange` ni una inscripción (INV-03, INV-08); la defensa en la base la fija OQ-07<br>- [ ] `npm run db:reset` aplica `001`-`003` y el seed sin errores |
| RF-03 | Puerto «estado de la oferta» (DEC-06): lo define `inscripciones`, lo implementa `ofertas` y se conecta en `apps/api/src/app.ts` | Must | backend | - [ ] Devuelve el estado de una oferta (`draft`, `published`, `closed`) o «no existe», leyendo columnas explícitas<br>- [ ] `inscripciones` lo lee dentro de la misma transacción que el `INSERT` (guarda de estado de la escritura, punto 4 del responsable; forma exacta en OQ-08)<br>- [ ] Ningún fichero de `apps/api/src/modules/applications/` importa de `apps/api/src/modules/jobs/` ni ejecuta SQL sobre `job_openings`; `candidates` no importa de `applications` ni de `jobs` (DEC-06), comprobado por un test<br>- [ ] Si el puerto lanza, 500 `INTERNAL_ERROR` y no se crea nada |
| RF-04 | Puerto de procesos del candidato real: lo implementa `inscripciones` y sustituye al stub en `buildApp` | Must | backend | - [ ] `buildApp` inyecta la implementación de `inscripciones` como `candidateProcesses` por defecto; el stub `noCandidateProcesses` solo queda para tests<br>- [ ] `getProcesses(id)`: `hasOpenApplication` = alguna inscripción en etapa no final; `hadAnyApplication` = alguna inscripción; `lastProcessClosedAt` = el instante del último `StageChange` a etapa final si no hay ninguna abierta, si no `null`<br>- [ ] Cumple el contrato de `apps/api/src/modules/candidates/processes-port.ts`: nunca `hadAnyApplication && !hasOpenApplication` con `lastProcessClosedAt` nulo<br>- [ ] Se ejecuta dentro de la transacción del iniciador (síncrono) y sin `SELECT *` |
| RF-05 | API del pipeline de una oferta (UC-17 · P, A2, E1) | Must | backend | - [ ] Devuelve la oferta (ID y estado) y sus inscripciones agrupables por etapa: ID de la inscripción, nombre del candidato, etapa, fecha del último cambio y, en `rejected`, el motivo; **nada más** (ni email, ni teléfono, ni nota)<br>- [ ] Cada etapa ordenada por fecha del último cambio descendente, con desempate por ID descendente; sin paginación<br>- [ ] Oferta inexistente → 404 `NOT_FOUND` sin datos; oferta sin inscripciones → 200 con todo vacío<br>- [ ] El nombre del candidato se obtiene de `candidatos` por una operación que solo lee ID y nombre |
| RF-06 | API del detalle de una inscripción con su historial (UC-18 · P, A1) | Must | backend | - [ ] Devuelve la etapa actual, la oferta (ID y título), el candidato (ID y nombre) y los `StageChange` del más antiguo al más reciente (desempate por ID): origen (o vacío), destino, fecha y, en el de rechazo, motivo y nota (o `null`)<br>- [ ] Sin email ni teléfono; la nota solo sale en esta respuesta, nunca en el pipeline, en errores ni en logs<br>- [ ] Inscripción inexistente → 404 `NOT_FOUND` sin datos; ID mal formado → 400 |
| RF-07 | Pantalla del pipeline en la web | Must | frontend | - [ ] Acceso desde la ficha de una oferta `published` (enlace y ruta según OQ-01)<br>- [ ] Seis columnas con nombre accesible, en orden: recibida, cribado, entrevista, oferta, contratado y rechazado; cada tarjeta con el nombre como texto (nunca HTML) y la fecha del último cambio en `dd/mm/aaaa` (Europe/Madrid, `formatDate`); en «rechazado», el motivo con su etiqueta en castellano<br>- [ ] Estados cargando, vacío (con mensaje y «Inscribir candidato» si la oferta está `published`), error con mensaje útil y «Reintentar», y con datos (principio de diseño 3)<br>- [ ] «Inscribir candidato» solo si la oferta está `published`; comportamiento con `draft` y `closed` según OQ-03<br>- [ ] `document.title` genérico y la URL solo con el ID de la oferta (sin nombres) |
| RF-08 | Inscribir desde el pipeline en la web (UC-14 · P, S-19) | Must | frontend | - [ ] «Inscribir candidato» abre un buscador por nombre o email sobre `GET /api/candidates?q=` (sin endpoint nuevo de búsqueda), con `q` validado en el cliente (`validateSearchText`); diseño según OQ-02<br>- [ ] Cada resultado inscribe a un solo candidato; el control queda deshabilitado mientras la petición está en curso (un doble clic envía una sola petición)<br>- [ ] Éxito: aviso con `role="status"`, el pipeline se recarga y el candidato aparece en «recibida»<br>- [ ] 409 duplicado: mensaje con enlace al detalle de la inscripción existente por `existingId`; 409 de oferta no publicada: mensaje y recarga del pipeline; 404 o error de red: mensaje con `role="alert"`, sin *stack trace*<br>- [ ] La búsqueda no va a la URL, al título, a `history.state` ni al almacenamiento del navegador; campo con `autoComplete="off"`<br>- [ ] Un recorrido e2e (Playwright) inscribe a un candidato creado en el test, lo ve en «recibida», abre su detalle y comprueba «Mientras dure el proceso» en su ficha |
| RF-09 | Pantalla del detalle de una inscripción en la web (UC-18 · P, A1) | Must | frontend | - [ ] Muestra la etapa actual y la lista cronológica de `StageChange` (origen, destino y fecha `dd/mm/aaaa`; el inicial sin origen); en el de rechazo, motivo y nota como texto<br>- [ ] Estados cargando, error y «no encontrada» (principio de diseño 3), aunque sus CA (UC-18 · E1, E2) son de HU-05<br>- [ ] Contenido de la cabecera y enlaces según OQ-04; título del documento genérico y ruta solo con el ID |
| RF-10 | Fin de retención «Mientras dure el proceso» de punta a punta (UC-12 · A1) | Must | fullstack | - [ ] Tras inscribir, `GET /api/candidates/:id` devuelve `retentionEndsAt: null` y la ficha muestra «Mientras dure el proceso»<br>- [ ] Un candidato sin inscripciones conserva su fecha (sin cambios respecto a HU-03)<br>- [ ] Un candidato cuyas inscripciones son todas finales (seed) tiene la fecha que da la fórmula con `lastProcessClosedAt` |
| RF-11 | Seed de inscripciones (RV-26) | Must | backend | - [ ] 40 inscripciones inventadas con su historial, composición según OQ-05, fechas relativas al `db:reset`<br>- [ ] Cumplen INV-04, INV-05, INV-06 e INV-07 (comprobado por un test del seed)<br>- [ ] La retención de cada candidato del seed es la que da `computeRetentionEndsAt` con el puerto real (con inscripción abierta, `null`)<br>- [ ] Notas del seed inventadas y sin datos sensibles |
| RF-12 | Guarda de estado en el SQL de las escrituras de `jobs` que dependen del estado (SEC-02, defensa en profundidad) | Should | backend | - [ ] El `UPDATE` de edición de `apps/api/src/modules/jobs/repository.ts` solo afecta a filas en `draft` o `published`, y el `DELETE` solo a filas en `draft`, en el propio `WHERE`<br>- [ ] Un test llama al repositorio directamente con una oferta en el estado no permitido y comprueba 0 filas afectadas y la fila intacta<br>- [ ] El servicio traduce 0 filas afectadas a 409 `INVALID_TRANSITION` (no a un 200 ni a un 500); los tests de `apps/api/test/jobs/` siguen en verde |
| RF-13 | Arrastre de deuda de HU-03 | Should | fullstack | - [ ] (a) Un test falla si `CONSENT_VERSION` de `apps/web/src/features/candidates/consent.ts` y `CONSENT_TEXT_VERSION` de `apps/api/src/modules/candidates/schemas.ts` difieren (ubicación en OQ-07)<br>- [ ] (b) Todos los teléfonos de `apps/api/src/db/seed-candidates.ts` y los teléfonos válidos de los tests de `apps/api/test/`, `apps/web/test/` y `e2e/` usan los dígitos de la serie `+34 600 000 0xx` (con o sin prefijo, y en el formato que cada test necesite); los valores de frontera o de formato inválido llevan un comentario que lo diga<br>- [ ] (c) Could: si la HU toca `apps/web/src/features/candidates/CandidateFormScreen.tsx`, su copia local de `CandidateNotFound` (y de `isNotFound`) se sustituye por la de `CandidateDetailScreen.tsx`; si no la toca, la deuda sigue abierta en `docs/05_modules/candidatos/technical.md` |

## Requisitos no funcionales

| ID | Descripción | Categoría | Métrica concreta |
|----|-------------|-----------|------------------|
| RNF-01 | Lectura del pipeline y del detalle | Rendimiento | `GET` del pipeline < 200 ms con una oferta de 200 inscripciones, 1 000 candidatos y 2 000 inscripciones en total; `GET` del detalle < 200 ms con 6 `StageChange` (`fastify.inject`, local; volúmenes a confirmar en OQ-07) |
| RNF-02 | Inscribir | Rendimiento | `POST` de inscripción < 500 ms con 1 000 candidatos y 2 000 inscripciones (`inject`, local) |
| RNF-03 | Datos personales en logs y errores | Privacidad | 0 apariciones de nombre, email, teléfono o nota de un candidato en los logs y en los cuerpos de error de los tests de `inscripciones`, incluidos los 500 provocados en el puerto de estado de la oferta, en el de procesos y en el recálculo (DP-01) |
| RNF-04 | Minimización del pipeline | Privacidad | Cada elemento del pipeline lleva exactamente los 5 campos de RF-05 (ID, nombre, etapa, fecha del último cambio y motivo o `null`); 0 claves `email`, `phone` o `note` en la respuesta |
| RNF-05 | Datos en el navegador | Privacidad | 0 nombres, emails o textos de búsqueda en `document.title`, en la URL o en `history.state` en las pantallas de pipeline, buscador y detalle |
| RNF-06 | HTML escapado | Seguridad | 0 usos de `dangerouslySetInnerHTML` en `apps/web/src/features/applications/` (nueva); un nombre y una nota con `<img onerror>` se pintan como texto (test) |
| RNF-07 | Accesibilidad | Accesibilidad | 6 columnas con nombre accesible; 100 % de los controles del buscador con `<label>`; avisos con `role="status"` y errores con `role="alert"`; tras inscribir o cerrar el buscador, el foco vuelve a un elemento definido (aserción con `expectFocusOn`) |

## Modelo de datos
Migración nueva `apps/api/src/db/migrations/003-create-applications.sql` (nombre exacto en el diseño; nunca se edita una
comiteada, DEC-03). Dueño: `inscripciones` (DEC-06). Nombres de columna orientativos; los fija el diseño.

**Inscripciones (`Application`)**
| Columna | Contenido | Restricción |
|---|---|---|
| `id` | Entero autoincremental | Sin borrado (INV-08) |
| `candidate_id` | ID del candidato | No nulo; clave foránea según OQ-07 |
| `job_id` | ID de la oferta | No nulo; clave foránea según OQ-07 |
| `stage` | Etapa actual | `CHECK` en las 6 etapas; nace `received` |
| `created_at` · `last_change_at` | Instantes ISO UTC con milisegundos | `GLOB`; `last_change_at` = fecha del último `StageChange` (INV-06) |

- Índice **único** (`candidate_id`, `job_id`) (INV-01). Índice para el pipeline por (`job_id`, `stage`, `last_change_at`
  DESC, `id` DESC) e índice por `candidate_id` para el puerto de procesos (detalle en el diseño).

**Cambios de etapa (`StageChange`)**
| Columna | Contenido | Restricción |
|---|---|---|
| `id` | Entero autoincremental | Inmutable (INV-03) |
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
Rutas propuestas; las confirma OQ-07 (API) y OQ-01 (web). Errores en el envelope `{ error: { code, message, details? } }`.

| Tipo | Ruta o pantalla | Cambio | Descripción |
|------|-----------------|--------|-------------|
| POST | `/api/applications` | Nuevo | Cuerpo `{ jobId, candidateId }`. 201 inscripción en `received` · 400 `VALIDATION_ERROR` · 403 `CROSS_SITE_REQUEST` · 404 `NOT_FOUND` (oferta o candidato) · 409 `INVALID_TRANSITION` (oferta no publicada) · 409 `DUPLICATE` (`details: [{ field: 'candidateId', message, existingId }]`) · 413 · 415 · 500 `INTERNAL_ERROR` |
| GET | `/api/jobs/:jobId/applications` o `/api/applications?jobId=` | Nuevo | Pipeline (RF-05). 200 · 400 · 404 · 500. La registra el plugin de `applications`; ruta exacta en OQ-07 |
| GET | `/api/applications/:id` | Nuevo | Detalle e historial (RF-06). 200 · 400 · 404 · 500 |
| GET | `/api/candidates` | Sin cambios | Lo reutiliza el buscador (`q`, `pageSize`): 4 campos por elemento |
| GET | `/api/candidates/:id` | Sin cambios de contrato | `retentionEndsAt: null` con una inscripción abierta |
| Interno | Puerto «estado de la oferta» | Nuevo | Definido en `apps/api/src/modules/applications/` (nuevo), implementado en `apps/api/src/modules/jobs/`, conectado en `apps/api/src/app.ts` |
| Interno | `CandidateProcessesPort` | Implementación nueva | En `apps/api/src/modules/applications/`; sustituye a `noCandidateProcesses` en `buildApp` |
| Interno | Lecturas de `candidatos` | Nuevo | Existencia y nombre por ID, con columnas explícitas (sin `SELECT *`) |
| Pantalla | Pipeline (`/jobs/:id/pipeline`, propuesta) | Nueva | RF-07 y RF-08, en `apps/web/src/features/applications/` (nueva) |
| Pantalla | Detalle de la inscripción (`/applications/:id`, propuesta) | Nueva | RF-09 |
| Pantalla | Ficha de la oferta (`/jobs/:id`) | Modificar | Enlace al pipeline (OQ-01) en `apps/web/src/features/jobs/JobActions.tsx` o en la ficha |
| Pantalla | Ficha del candidato (`/candidates/:id`) | Sin cambios de código previstos | Ya pinta «Mientras dure el proceso» con `retentionEndsAt: null` |
| Rutas web | `apps/web/src/App.tsx` (tabla `ROUTES`) | Modificar | Dos rutas nuevas; `/jobs/:id/pipeline` antes de `/jobs/:id` si hiciera falta por el orden de coincidencia |

## Flujos de usuario
1. **Abrir el pipeline:** ficha de una oferta `published` → enlace al pipeline (OQ-01) → seis columnas con las tarjetas;
   si no hay inscripciones, estado vacío con «Inscribir candidato».
2. **Inscribir:** «Inscribir candidato» → buscador (OQ-02) → escribe parte del nombre o del email y busca → elige un
   resultado → «Inscribir» → aviso «Candidato inscrito.» (texto exacto en OQ-02), el pipeline se recarga y la tarjeta
   aparece la primera en «recibida».
3. **Inscribir a uno ya inscrito:** → mensaje de que ya está inscrito con enlace a su inscripción; no cambia nada.
4. **Oferta cerrada en otra pestaña:** al inscribir → mensaje de que la oferta ya no está publicada; el pipeline se
   recarga sin «Inscribir candidato».
5. **Consultar el detalle:** desde el pipeline (OQ-01) → etapa actual e historial; en una recién creada, un único cambio
   «— → recibida» con la fecha de inscripción.
6. **Comprobar la retención:** ficha del candidato → «Fin de retención: Mientras dure el proceso».

## Datos personales
- **Qué toca:** el vínculo candidato-oferta y su historial de etapas (`Application`, `StageChange`), la nota de rechazo
  (solo existe en el seed en esta HU), el nombre del candidato (lo lee, no lo copia) y, en el buscador, el nombre y el
  email que ya devuelve `GET /api/candidates` (RV-14, UC-14 · P). Escribe `candidates.retention_ends_at` a través de
  `recalculateRetention`, la operación de `candidatos` (no duplica la fórmula).
- **Para qué y base jurídica:** seguir el proceso de selección, con medidas precontractuales (art. 6.1.b) mientras haya
  una inscripción abierta (RGPD §2).
- **Cuánto tiempo:** la fórmula de retención de `candidatos` (RGPD §3, S-06): con una inscripción no final, «mientras
  dure el proceso» (`retentionEndsAt: null`). Cerrar inscripciones y su recálculo llega en HU-05.
- **Qué devuelve cada respuesta:** el pipeline, solo el nombre (S-18, RGPD §6.2; RNF-04); el detalle, nombre del
  candidato, título de la oferta, etapas, fechas, motivo y nota; el `POST`, la inscripción sin datos del candidato.
- **Qué NO aparece:** nombre, email, teléfono ni nota en logs, en mensajes de error, en `details`, en `document.title`, en
  la URL ni en `history.state` (RGPD §6.1; RNF-03, RNF-05). El 409 `DUPLICATE` solo lleva el ID de la inscripción
  existente; el 404 no dice nada del candidato.
- **Datos de ejemplo:** inventados, con `@example.com` y teléfonos de la serie `+34 600 000 0xx` (RGPD §6.3; RF-13 b).

## Edge cases
Categorías de `docs/07_architecture_principles/QUALITY-GATES.md` §3: 1 Input inválido · 2 Boundary · 3 Fallo de
dependencia · 4 Concurrencia · 5 Datos corruptos o legacy · 6 Seguridad · 7 Idempotencia.

| ID | RF | Categoría | Situación | Comportamiento esperado |
|----|----|-----------|-----------|-------------------------|
| EC-01 | RF-01 | 1 Input inválido | Cuerpo sin `candidateId`, con `candidateId: "12"` (texto), `0`, `-3`, `1.5`, una lista de IDs o un campo desconocido (`stage: "hired"`) | 400 `VALIDATION_ERROR`; la clave desconocida sale agrupada como `{ field: 'body' }` sin nombrarla (DEC-11.4); no se crea nada |
| EC-02 | RF-01 | 1 Input inválido | Cuerpo que no es JSON, vacío o `text/plain`; `application/x-www-form-urlencoded` | 400 / 415 en el envelope; no se crea nada |
| EC-03 | RF-01 | 2 Boundary | `candidateId` o `jobId` igual a `Number.MAX_SAFE_INTEGER` que no existe; y `MAX_SAFE_INTEGER + 1` | 404 sin datos / 400 (límite exacto en OQ-07) |
| EC-04 | RF-01 | 2 Boundary | Pareja con inscripción `rejected` del seed (RV-18, «para siempre») | 409 `DUPLICATE` con el ID existente; no se crea nada |
| EC-05 | RF-01 | 3 Fallo de dependencia | Falla el `INSERT` de la inscripción, el del `StageChange` o el `UPDATE` de la retención (trigger de fallo en el test) | 500 `INTERNAL_ERROR` sin *stack*; ni inscripción ni `StageChange`, y `retention_ends_at` igual que antes (UC-14 · E5) |
| EC-06 | RF-01 | 4 Concurrencia | Dos `POST` simultáneos de la misma pareja | Uno 201 y otro 409 `DUPLICATE` con el ID del primero; la base tiene una sola inscripción y un solo `StageChange` (DEC-08) |
| EC-07 | RF-01 | 4 Concurrencia | La oferta se cierra entre que la web pinta el pipeline y el reclutador inscribe | 409 `INVALID_TRANSITION`; no se crea nada (RV-17) |
| EC-08 | RF-01 | 5 Datos corruptos | Candidato cuya fecha de retención ya pasó (pendiente de anonimizar; la anonimización es de la feature A) | Según OQ-06 (recomendación: se inscribe y su retención pasa a `null`) |
| EC-09 | RF-01 | 6 Seguridad | 404 de oferta o de candidato, 409 de duplicado y 500 del recálculo | Ningún `message`, `details` ni línea de log lleva nombre, email o teléfono; el 409 solo lleva `existingId` (RNF-03) |
| EC-10 | RF-01 | 6 Seguridad | `POST` con `Sec-Fetch-Site: cross-site` o `same-site` | 403 `CROSS_SITE_REQUEST`; no se crea nada (DEC-12) |
| EC-11 | RF-01 | 7 Idempotencia | Reintento de una inscripción ya creada | 409 `DUPLICATE` con el ID existente; sin `StageChange` nuevo ni recálculo que cambie la retención (S-14) |
| EC-12 | RF-02 | 1 Input inválido | Inserción directa en la base con etapa `foo`, motivo en un destino distinto de `rejected` o nota de 501 caracteres | Falla el `CHECK` |
| EC-13 | RF-02 | 2 Boundary | `StageChange` inicial: origen nulo con destino `received`; origen nulo con destino `screening` | El primero se acepta; el segundo falla el `CHECK` |
| EC-14 | RF-02 | 4 Concurrencia | Dos inserciones de la misma pareja que se saltan el servicio | El índice único rechaza la segunda (INV-01) |
| EC-15 | RF-02 | 5 Datos corruptos | `UPDATE` o `DELETE` directo sobre un `StageChange` | Según OQ-07 (recomendación: un *trigger* lo aborta; INV-03) |
| EC-16 | RF-02 | 7 Idempotencia | Aplicar las migraciones dos veces (`schema_migrations`) | La `003` no se reaplica; sin errores |
| EC-17 | RF-03 | 2 Boundary | Oferta en `draft`, `published`, `closed` e inexistente (también un borrador borrado) | 409, 201, 409 y 404 respectivamente; mensajes distintos para `draft`/`closed` y para «no existe» |
| EC-18 | RF-03 | 3 Fallo de dependencia | La implementación del puerto lanza | 500 `INTERNAL_ERROR`, `ROLLBACK`, no se crea nada |
| EC-19 | RF-03 | 4 Concurrencia | Cierre de la oferta e inscripción en la misma pareja de transacciones | La lectura del estado y el `INSERT` van en la misma transacción `BEGIN IMMEDIATE`: si el cierre se confirma antes, 409; nunca queda una inscripción en una oferta `closed` creada después del cierre (INV-02) |
| EC-20 | RF-03 | 6 Seguridad | Acoplamiento entre módulos | Un test falla si `apps/api/src/modules/applications/` importa de `jobs` o contiene SQL sobre `job_openings`, o si `candidates` importa de `applications` o `jobs` |
| EC-21 | RF-04 | 2 Boundary | Candidato sin inscripciones; con una abierta; con dos finales de fechas distintas; con una final y otra abierta | `{false,false,null}`; `{true,true,null}`; `{false,true,<la más reciente>}`; `{true,true,null}` |
| EC-22 | RF-04 | 3 Fallo de dependencia | La lectura del puerto falla durante el recálculo de una inscripción | 500, `ROLLBACK` de la inscripción y de su `StageChange` |
| EC-23 | RF-04 | 5 Datos corruptos | Candidato con consentimiento vigente (+ 24 meses) y una inscripción abierta | `retentionEndsAt: null`: la inscripción abierta prevalece (S-06) |
| EC-24 | RF-04 | 6 Seguridad | Un error en el puerto | El log registra el error sin nombre, email ni teléfono (DP-01) |
| EC-25 | RF-04 | 7 Idempotencia | `getProcesses` dos veces seguidas sin cambios | Mismo resultado; no escribe |
| EC-26 | RF-05 | 1 Input inválido | `jobId` `abc`, `0`, `01` o con 16 dígitos | 400 `VALIDATION_ERROR` |
| EC-27 | RF-05 | 2 Boundary | Oferta con 0, 1 y 200 inscripciones; dos con la misma fecha de último cambio | Vacío; una; las 200 sin paginar (RNF-01); empate resuelto por ID descendente |
| EC-28 | RF-05 | 2 Boundary | Pipeline de una oferta `draft` (por URL) | Según OQ-03 (recomendación: 200 con todo vacío y su estado) |
| EC-29 | RF-05 | 3 Fallo de dependencia | Error de la base al leer | 500 en el envelope, sin *stack* |
| EC-30 | RF-05 | 6 Seguridad | Respuesta del pipeline con candidatos con teléfono y notas en el seed | Sin `email`, `phone` ni `note` (RNF-04) |
| EC-31 | RF-06 | 1 Input inválido | ID `abc` o con 16 dígitos | 400 |
| EC-32 | RF-06 | 2 Boundary | Inscripción con un solo `StageChange`; con dos del mismo instante | Uno, sin origen; orden por ID ascendente |
| EC-33 | RF-06 | 5 Datos corruptos | Inscripción del seed con historial completo `received → … → rejected` | Todos los cambios en orden, con motivo y nota solo en el de rechazo (INV-06) |
| EC-34 | RF-06 | 6 Seguridad | Detalle de una rechazada con nota | La nota sale en la respuesta, pero no en logs ni en errores; sin email ni teléfono |
| EC-35 | RF-07 | 1 Input inválido | URL `/jobs/abc/pipeline` | «Página no encontrada» (`parseRouteId`), sin petición |
| EC-36 | RF-07 | 2 Boundary | Cambio registrado a las 23:30 UTC del 31/12 | La tarjeta muestra la fecha de Europe/Madrid (01/01 del año siguiente) |
| EC-37 | RF-07 | 3 Fallo de dependencia | API caída o respuesta no JSON | Estado de error con mensaje útil y «Reintentar», sin *stack* (UC-17 · E2) |
| EC-38 | RF-07 | 6 Seguridad | Nombre `<img src=x onerror=alert(1)>` | Se ve como texto (RNF-06) |
| EC-39 | RF-07 | 6 Seguridad | Título del documento y URL del pipeline | Genérico; solo el ID de la oferta (RNF-05) |
| EC-40 | RF-08 | 1 Input inválido | Búsqueda de 101 caracteres o con un carácter de control | Error junto al campo, sin petición (`validateSearchText`) |
| EC-41 | RF-08 | 2 Boundary | Búsqueda sin resultados; con más resultados de los que se muestran | Mensaje «Ningún candidato…»; aviso de afinar la búsqueda (OQ-02) |
| EC-42 | RF-08 | 3 Fallo de dependencia | La API no responde al buscar o al inscribir | Mensaje con `role="alert"`; el buscador sigue abierto y no se pierde lo escrito |
| EC-43 | RF-08 | 4 Concurrencia | Otra pestaña inscribe al mismo candidato antes | 409: mensaje con enlace a la inscripción existente; el pipeline se recarga |
| EC-44 | RF-08 | 4 Concurrencia | Otra pestaña cierra la oferta antes de inscribir | 409: mensaje de oferta no publicada; recarga sin «Inscribir candidato» |
| EC-45 | RF-08 | 6 Seguridad | Texto de búsqueda con un email | No aparece en la URL, el título, `history.state` ni el almacenamiento (RNF-05) |
| EC-46 | RF-08 | 7 Idempotencia | Doble clic en «Inscribir» | Una sola petición (control deshabilitado en curso); si llegaran dos, la segunda da 409 y la web no muestra error de duplicado sobre su propia inscripción recién creada (detalle en el diseño) |
| EC-47 | RF-09 | 1 Input inválido | URL `/applications/abc` | «Página no encontrada», sin petición |
| EC-48 | RF-09 | 2 Boundary | Inscripción recién creada | Un único cambio sin origen → «recibida» con la fecha (UC-18 · A1) |
| EC-49 | RF-09 | 3 Fallo de dependencia | API caída | Estado de error con mensaje útil |
| EC-50 | RF-09 | 6 Seguridad | Nota con HTML | Se ve como texto (RNF-06) |
| EC-51 | RF-10 | 2 Boundary | Candidato cuya única inscripción es `rejected` del seed | Fecha calculada con `lastProcessClosedAt` (no «Mientras dure el proceso») |
| EC-52 | RF-10 | 3 Fallo de dependencia | El recálculo falla al inscribir | La ficha conserva su fecha anterior (UC-14 · E5) |
| EC-53 | RF-10 | 5 Datos corruptos | Candidato con consentimiento retirado y una inscripción abierta | «Mientras dure el proceso» |
| EC-54 | RF-11 | 2 Boundary | Composición del seed | Las 6 etapas presentes en ofertas publicadas; una oferta publicada sin inscripciones (OQ-05) |
| EC-55 | RF-11 | 5 Datos corruptos | Ofertas `closed` del seed | Ninguna inscripción en etapa no final (INV-05); «oferta cerrada» solo en rechazos con la fecha del cierre (INV-07) |
| EC-56 | RF-11 | 6 Seguridad | Datos del seed | Inventados, `@example.com`, notas sin datos sensibles, teléfonos de la serie (RF-13 b) |
| EC-57 | RF-11 | 7 Idempotencia | `npm run db:reset` dos veces | Mismos recuentos y mismas invariantes |

**Evaluación de las 7 categorías por RF Must** (EC o `N/A — motivo`):

| RF | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|----|---|---|---|---|---|---|---|
| RF-01 | EC-01, EC-02 | EC-03, EC-04 | EC-05 | EC-06, EC-07 | EC-08 | EC-09, EC-10 | EC-11 |
| RF-02 | EC-12 | EC-13 | N/A — la migración corre en `db:reset` sobre una base nueva; un fallo de SQLite aborta el reset entero | EC-14 | EC-15 | N/A — sin entrada de usuario: lo cubren EC-09 y EC-30 en las rutas | EC-16 |
| RF-03 | N/A — recibe un ID ya validado por el esquema de RF-01/RF-05 | EC-17 | EC-18 | EC-19 | EC-17 (borrador borrado) | EC-20 | N/A — lectura pura, sin efectos |
| RF-04 | N/A — recibe un ID interno, nunca entrada de usuario | EC-21 | EC-22 | N/A — síncrono dentro de la transacción del iniciador (`node:sqlite`, una conexión) | EC-23 | EC-24 | EC-25 |
| RF-05 | EC-26 | EC-27, EC-28 | EC-29 | N/A — una sola lectura; el reclutador ve la foto del momento | N/A — INV-06 lo garantiza la transacción de RF-01 y lo prueba EC-55 | EC-30 | N/A — `GET` sin efectos |
| RF-06 | EC-31 | EC-32 | EC-29 (mismo manejador) | N/A — una sola lectura | EC-33 | EC-34 | N/A — `GET` sin efectos |
| RF-07 | EC-35 | EC-36 | EC-37 | N/A — recarga tras inscribir; otra pestaña ve el cambio al recargar (EC-43) | N/A — la web pinta lo que valida la API; etapa desconocida imposible por `CHECK` (EC-12) | EC-38, EC-39 | N/A — solo lectura |
| RF-08 | EC-40 | EC-41 | EC-42 | EC-43, EC-44 | N/A — no persiste nada en el cliente | EC-45 | EC-46 |
| RF-09 | EC-47 | EC-48 | EC-49 | N/A — solo lectura | EC-33 | EC-50 | N/A — solo lectura |
| RF-10 | N/A — no hay entrada nueva: es el `GET` de HU-03 | EC-51 | EC-52 | EC-06 (una sola inscripción, un recálculo) | EC-53 | EC-09 | EC-11 |
| RF-11 | N/A — datos fijos del repositorio, sin entrada | EC-54 | N/A — corre en `db:reset`; si falla, el reset falla entero | N/A — proceso único sin concurrencia | EC-55 | EC-56 | EC-57 |

## Decisiones aplicables
- **DEC-01:** envelope de error en todas las rutas nuevas; TypeScript estricto; Vitest y Playwright (RF-01, RF-05, RF-06).
- **DEC-03:** migración nueva `003`, sin editar `001` ni `002`; seed con datos inventados (RF-02, RF-11).
- **DEC-04:** sin login, un único rol «reclutador»; el PRD no declara permisos. La seguridad se centra en datos
  personales, inyección y enumeración (EC-09, EC-30).
- **DEC-06:** `inscripciones` es dueño de sus tablas; lee el estado de la oferta por el puerto que define e implementa
  `ofertas`; implementa el puerto de procesos de `candidatos` e invoca su operación interna `recalculateRetention` en la
  misma transacción; dirección `ofertas → inscripciones → candidatos`, conexión en `apps/api/src/app.ts`. Test de fallo
  inyectado por cada efecto cruzado (RF-01, RF-03, RF-04; EC-05, EC-18, EC-22). Ver OQ-08.
- **DEC-07:** 400 validación, 404 inexistente sin datos, 409 duplicado con `existingId` y precondición de estado, 201 al
  crear (RF-01).
- **DEC-08:** estado comprobado dentro de la transacción; unicidad de la pareja por índice único traducido a 409
  (RF-01, RF-02; EC-06, EC-19).
- **DEC-09:** instantes en UTC con el reloj inyectado; la web muestra `dd/mm/aaaa` en Europe/Madrid (RF-01, RF-07, RF-09;
  EC-36).
- **DEC-10:** el buscador reutiliza `GET /api/candidates` (búsqueda sin tildes ni mayúsculas, 4 campos). El pipeline,
  sin paginación por S-18 (excepción declarada a DEC-10, que solo regula listados paginados).
- **DEC-11:** Ajv sin coerción ni `removeAdditional`; `params` numéricos como texto con `pattern`; `details` acotado;
  códigos adicionales; reloj en `buildApp({ now })`; `withTransaction`; caracteres de control (RF-01, RF-05, RF-06).
- **DEC-12:** el `POST` de inscripción hereda la guarda `CROSS_SITE_REQUEST` (EC-10).
- **Avisos de review:** SEC-02 de HU-02 (RF-12), DP-01/DP-02 de HU-02 (RF-01, RF-04, RNF-03), avisos de HU-03 (RF-13).

## Fuera de scope
- Avanzar etapas, rechazar a mano, sus formularios y las acciones «Avanzar» y «Rechazar» de las tarjetas (UC-15, UC-16,
  UC-17 · P paso 5): HU-05.
- Implementar `JobApplicationsPort` (`countActiveApplications` y `rejectActiveApplications`), el rechazo al cerrar una
  oferta (UC-19) y UC-04 · A1: HU-05 (DT-01 y DT-02 del PRD de HU-02; CA de UC-04 · A1 en `hu.md` de HU-05). Ver OQ-10.
- Pipeline de solo lectura de una oferta `closed` como flujo probado (UC-17 · A1) y el historial de rechazos por cierre
  (UC-18 · A2): HU-05. Los estados 404 y de error del detalle tienen pantalla aquí (RF-09), pero sus CA son de HU-05
  (UC-18 · E1, E2).
- Recalcular la retención al cerrar inscripciones (paso a `hired` o `rejected`): HU-05.
- Inscribir desde la ficha del candidato o varios a la vez (S-19); retroceder, deshacer o borrar inscripciones
  (RV-18, RV-21).
- Estado «anonimizado», bloqueo de inscripción de anonimizados y etiqueta «Candidato anonimizado» (UC-17 · A3, S-05):
  feature A.
- Exportación por derecho de acceso y la importación CSV (features A y C).
- Paginación del pipeline (S-18).
- Cambios de esquema en `job_openings` o `candidates`.

## Open Questions

| ID | Pregunta | Contexto | Recomendación | Decisión | Estado |
|----|----------|----------|---------------|----------|--------|
| OQ-01 | (Producto) ¿Cómo llega el reclutador al pipeline y al detalle de una inscripción en esta HU? | `hu.md` deja al PRD cómo se llega al detalle antes de que HU-05 añada el acceso desde cada tarjeta; la ficha de la oferta no tiene enlace al pipeline | Enlace «Ver pipeline» en la ficha de una oferta `published` (en `closed`, lo añade HU-05 con UC-17 · A1); rutas `/jobs/:id/pipeline` y `/applications/:id`. Acceso al detalle: el nombre de cada tarjeta es un enlace a su detalle ya en esta HU (HU-05 solo añade «Avanzar» y «Rechazar»), además del enlace «Ver la inscripción» del 409 duplicado | PENDIENTE | Abierta |
| OQ-02 | (Producto) ¿Cómo es el buscador de «Inscribir candidato»? | UC-14 · P y S-19 fijan buscar por nombre o email y uno cada vez, no la interfaz ni los textos | Panel en la propia pantalla del pipeline (no un diálogo modal) con el campo «Nombre o email» y «Buscar» (Enter); hasta 10 resultados con nombre y email y un botón «Inscribir» por fila; con más de 10, «Hay más resultados: afina la búsqueda.»; sin marcar a los ya inscritos (el 409 lo resuelve). Éxito: aviso «Candidato inscrito.», el panel se cierra, el pipeline se recarga y el foco va al aviso. 409 duplicado: «Este candidato ya está inscrito en la oferta.» con «Ver la inscripción»; 409 de estado: «La oferta ya no está publicada: no admite inscripciones.» | PENDIENTE | Abierta |
| OQ-03 | (Producto) ¿Qué muestra el pipeline de una oferta en `draft` o `closed` en esta HU? | UC-17 exige `published` o `closed`; un borrador por URL no está cubierto. A1 (cerrada) es de HU-05 | API: 200 para cualquier oferta existente, con su estado. Web: en `draft`, «Esta oferta es un borrador: publícala para inscribir candidatos.» sin columnas ni acción; en `closed`, las mismas columnas sin «Inscribir candidato» (HU-05 lo completa y lo prueba) | PENDIENTE | Abierta |
| OQ-04 | (Producto) ¿Qué muestra la cabecera del detalle de una inscripción? | UC-18 fija la etapa y el historial, no la cabecera ni la hora | Nombre del candidato (enlace a su ficha), título de la oferta (enlace a su pipeline) y etapa actual; historial en lista ordenada con «origen → destino · dd/mm/aaaa», «—» como origen del inicial, sin hora; motivo y nota bajo el cambio de rechazo; título del documento «Inscripción · ATS» | PENDIENTE | Abierta |
| OQ-05 | (Producto) Composición del seed de inscripciones | RV-26 dice «unas 40»; INV-04..07 y la demo del pipeline necesitan una mezcla concreta | Exactamente 40, fechas relativas al reset: en las 4 publicadas, todas las etapas, con rechazos por cada uno de los 3 motivos manuales (2 con nota inventada no sensible) y al menos un `hired`; **una publicada sin inscripciones** (para ver UC-17 · A2); en las 2 cerradas, solo `hired` y `rejected` («oferta cerrada» sin nota, con la fecha del cierre, más algún rechazo manual previo); varios candidatos con 2 inscripciones abiertas; ninguna en borradores; historial coherente paso a paso | PENDIENTE | Abierta |
| OQ-06 | (Producto) ¿Se puede inscribir a un candidato con la retención ya vencida (pendiente de anonimizar)? | RV-17 solo bloquea a los anonimizados, que llegan con la feature A; hoy un vencido sigue en el listado sin marca (decisión de la review de HU-03) | Sí: inscribir abre un proceso (base 6.1.b) y su retención pasa a `null`; el bloqueo de anonimizados lo añade la feature A | PENDIENTE | Abierta |
| OQ-07 | (Ingeniería) Paquete de decisiones de contrato y persistencia | El PRD necesita fijarlas para que el diseño no las decida a ciegas | (a) `POST /api/applications` con `{ jobId, candidateId }` como enteros JSON `1..Number.MAX_SAFE_INTEGER`; pipeline en `GET /api/jobs/:jobId/applications` (registrada por el plugin de `applications`); detalle en `GET /api/applications/:id`. (b) 409 de oferta no publicada con `INVALID_TRANSITION` (precedente de HU-02) y mensaje propio; duplicado `DUPLICATE` con `details: [{ field: 'candidateId', existingId }]`. (c) 404 comprobando primero la oferta y luego el candidato, con «La oferta no existe.» y «El candidato no existe.». (d) Migración `003` con motivo y nota ya en `StageChange` (el seed los necesita), `last_change_at` en la inscripción, claves foráneas a `job_openings` y `candidates` con `ON DELETE RESTRICT` (declarativas, sin consultas; compatibles con DEC-06) y *triggers* que abortan `UPDATE`/`DELETE` de `StageChange` (INV-03). (e) Volúmenes de RNF-01/02: 1 000 candidatos, 2 000 inscripciones, 200 en una oferta. (f) Test de RF-13 a en `apps/api/test/` importando `apps/web/src/features/candidates/consent.ts` (sin dependencias de React). (g) Etiquetas de la web: recibida, cribado, entrevista, oferta, contratado, rechazado; motivos «No encaja con el perfil», «Retirada del candidato», «Otro», «Oferta cerrada» | PENDIENTE | Abierta |
| OQ-08 | (Ingeniería) «Guarda de estado en el SQL» al inscribir frente a DEC-06 | El responsable pide la guarda en el SQL de la escritura; DEC-06 prohíbe que `inscripciones` consulte `job_openings` con SQL, así que un `INSERT … SELECT … WHERE EXISTS (… status = 'published')` la incumpliría | La guarda es la lectura del puerto «estado de la oferta» dentro de la misma transacción `BEGIN IMMEDIATE` que el `INSERT` (SQLite serializa los escritores, así que el estado no cambia entre la lectura y la escritura). La guarda literal en el `WHERE` se aplica a las escrituras del propio dueño (`jobs`, RF-12). No enmendar DEC-06 | PENDIENTE | Abierta |
| OQ-09 | (Ingeniería) `modulos_afectados` de `hu.md` no incluye `ofertas` | HU-04 implementa el puerto «estado de la oferta» en `jobs`, añade el enlace «Ver pipeline» en su ficha y las guardas de RF-12 | Añadir `ofertas` a `modulos_afectados` de `hu.md` (lo actualiza el `product-owner` o esta skill con tu visto bueno) para que `/reviewer` y `/module-sync` revisen y sincronicen `ofertas` | PENDIENTE | Abierta |
| OQ-10 | (Producto) Aceptar la ventana de INV-05 ya con inscripciones reales | HU-04 no implementa `JobApplicationsPort` (HU-05 por DT-01/DT-02 de HU-02 y por los CA de HU-05). Entre los merges de HU-04 y HU-05, el diálogo de cierre dirá «0 inscripciones» y cerrar dejará inscripciones abiertas en una oferta `closed`, con su candidato sin fecha de retención; HU-05 no las arregla a posteriori | Mantenerlo en HU-05 y aceptar la ventana (ya tolerada en el PRD de HU-02), con dos mitigaciones: los tests y e2e de HU-04 no cierran ofertas con inscripciones, y tras el merge de HU-05 se hace `npm run db:reset`. Alternativa: adelantar `countActiveApplications` a HU-04 (el diálogo diría N pero no las rechazaría: peor) | PENDIENTE | Abierta |
| OQ-11 | (Ingeniería) Tamaño de la HU | 13 RF (≤ 15), pero 11 Must con dos pantallas nuevas, un buscador, dos puertos, migración y seed. Estimación: 13-15 tareas, sin contar las adversariales; al límite del techo de 15 | Mantener la HU entera y pactar ya el corte por si `/task-planner` pasa de 15: mover **UC-18 · P y A1** (RF-06 y RF-09, detalle e historial) a HU-05, que ya tiene UC-18 · A2, E1 y E2; el `StageChange` inicial de HU-04 se seguiría verificando por API (CA-01, CA-18 sobre la base) | PENDIENTE | Abierta |

> Un PRD con Open Questions abiertas **no pasa** a diseño.

## Decisiones tomadas

| ID | Decisión | Razón | Impacto en el PRD | Fecha |
|----|----------|-------|-------------------|-------|

## Criterios de aceptación

| ID | Origen (UC · flujo o RF) | Dado | Cuando | Entonces |
|----|--------------------------|------|--------|----------|
| CA-01 | UC-14 · P / RF-01, RF-04 | Una oferta `published` y un candidato sin inscripción en ella, con fin de retención con fecha | Se envía el `POST` de inscripción | 201 con la inscripción en `received`; existe un `StageChange` sin origen → `received` con el instante del reloj inyectado en UTC; `GET /api/candidates/:id` devuelve `retentionEndsAt: null`; todo en una transacción (un fallo inyectado en cualquiera de los tres pasos lo deshace, CA-11) |
| CA-02 | UC-14 · P / RF-08, RF-07 | El pipeline de una oferta `published` | El reclutador pulsa «Inscribir candidato», busca por parte del nombre (y, en otro caso, del email) y pulsa «Inscribir» en un resultado | Aparece el aviso de éxito y la tarjeta con su nombre la primera de «recibida» (test de la web y recorrido e2e) |
| CA-03 | UC-14 · P / RF-01, RF-08 | El pipeline de una oferta `published` | Se intenta inscribir a dos candidatos en una sola petición (lista de IDs) o desde la web | La API responde 400 a la lista; la web solo ofrece inscribir de un resultado en uno y envía un `candidateId` por petición |
| CA-04 | UC-14 · E1 / RF-01, RF-03 | Una oferta en `draft` | Se intenta inscribir a un candidato | 409 con un mensaje que explica que la oferta no está publicada; no hay inscripción ni `StageChange` y la retención del candidato no cambia |
| CA-05 | UC-14 · E1 / RF-01, RF-03 | Una oferta en `closed` | Se intenta inscribir a un candidato | 409 con el mismo mensaje; no se crea nada |
| CA-06 | UC-14 · E2 / RF-01 | Un candidato con inscripción en la oferta, en `received` y, en otro caso, en `rejected` (seed) | Se intenta inscribirlo otra vez | 409 `DUPLICATE` con `existingId` = ID de la inscripción existente; no se crea nada y la retención no cambia |
| CA-07 | UC-14 · E2 / RF-01, RF-02 | Una pareja candidato-oferta sin inscripción | Llegan dos peticiones simultáneas para inscribirla | Una da 201 y la otra 409 `DUPLICATE` con el ID de la primera; queda una inscripción y un `StageChange` |
| CA-08 | UC-14 · E2 / RF-08 | El buscador abierto con un candidato que ya está inscrito | El reclutador pulsa «Inscribir» | Ve el mensaje de que ya está inscrito y un enlace a esa inscripción; el pipeline no cambia |
| CA-09 | UC-14 · E3 / RF-01 | Un `jobId` o un `candidateId` que no existe | Se intenta inscribir | 404 `NOT_FOUND` cuyo `message` y `details` no llevan nombre, email ni teléfono; no se crea nada |
| CA-10 | UC-14 · E4 / RF-01 | — | Llega una inscripción sin `candidateId`, con `candidateId: "7"`, con un campo desconocido o con un cuerpo no JSON | 400 en el envelope (`VALIDATION_ERROR` o `BAD_REQUEST`); no se crea nada |
| CA-11 | UC-14 · E5 / RF-01 | Un fallo inyectado en el `INSERT` de la inscripción, en el del `StageChange` y, en otro caso, en la escritura de la retención | Se inscribe | 500 `INTERNAL_ERROR` sin *stack*; no quedan inscripción ni `StageChange`, y `retention_ends_at` es el de antes |
| CA-12 | UC-17 · P / RF-05, RF-07 | Una oferta `published` con inscripciones en varias etapas (seed o creadas en el test) | El reclutador abre su pipeline | Ve 6 columnas (recibida, cribado, entrevista, oferta, contratado, rechazado); cada tarjeta con solo el nombre como texto y la fecha del último cambio `dd/mm/aaaa` en Europe/Madrid; el motivo en «rechazado»; cada columna de la más reciente a la más antigua; todas las tarjetas sin paginar; y la acción «Inscribir candidato» |
| CA-13 | UC-17 · P / RF-05 | El pipeline de una oferta con candidatos con email, teléfono y una nota de rechazo | Se revisa la respuesta de la API | No contiene las claves ni los valores de email, teléfono ni nota; cada elemento tiene exactamente los campos de RF-05 |
| CA-14 | UC-17 · A2 / RF-05, RF-07 | Una oferta `published` sin inscripciones | El reclutador abre su pipeline | La API da 200 con todo vacío y la web muestra el estado vacío con un mensaje que lo explica y «Inscribir candidato» |
| CA-15 | UC-17 · E1 / RF-05, RF-07 | Un ID de oferta que no existe | Se abre su pipeline | La API responde 404 `NOT_FOUND` y la web muestra el estado de error |
| CA-16 | UC-17 · E2 / RF-07 | La API no responde | El reclutador abre un pipeline | Ve el estado de error con un mensaje útil y «Reintentar», sin *stack trace* |
| CA-17 | UC-18 · P / RF-06, RF-09 | Una inscripción del seed con varios cambios y un rechazo con motivo y nota | Se consulta su detalle | La API y la web muestran la etapa actual y los `StageChange` del más antiguo al más reciente con origen, destino y fecha `dd/mm/aaaa`; el de rechazo, con su motivo y su nota como texto |
| CA-18 | UC-18 · A1 / RF-06, RF-09 | Una inscripción recién creada | Se consulta su detalle | Etapa actual `received` («recibida») y un único `StageChange`, sin origen → `received`, con la fecha de inscripción `dd/mm/aaaa` (Europe/Madrid) |
| CA-19 | UC-12 · A1 / RF-10 | Un candidato con una inscripción no final | El reclutador abre su ficha | El fin de retención aparece como «Mientras dure el proceso» (test de la web con la respuesta real de la API y recorrido e2e) |
| CA-20 | UC-12 · A1 / RF-04 | Un candidato con una inscripción no final y otro sin inscripciones | `candidatos` consulta sus procesos por el puerto conectado en `buildApp` | El primero: `hasOpenApplication: true`, `hadAnyApplication: true`; el segundo: «sin inscripciones» (`false`, `false`, `null`) |
| CA-21 | RF-03 | El código de `apps/api/src/modules/` | Se ejecuta el test de dependencias entre módulos | `applications` no importa de `jobs` ni consulta `job_openings`; `candidates` no importa de `applications` ni de `jobs` |
| CA-22 | RF-12 | Una oferta `closed` y otra `published` en la base | Se llama al repositorio con el `UPDATE` de edición sobre la cerrada y con el `DELETE` sobre la publicada, saltándose el servicio | 0 filas afectadas y las filas intactas; el servicio traduce un 0 inesperado a 409 `INVALID_TRANSITION` |
| CA-23 | RF-13 (a) | Las dos constantes de versión del consentimiento | Se cambia una sin la otra | El test de RF-13 a falla |
| CA-24 | RF-13 (b) | El seed y los tests | Se buscan teléfonos fuera de la serie `600 000 0xx` | Solo quedan los valores de frontera o de formato inválido marcados con comentario |
| CA-25 | RF-11 | `npm run db:reset` | Se ejecuta el test del seed | 40 inscripciones que cumplen INV-04 a INV-07, composición de OQ-05 y retención de cada candidato igual a la de la fórmula con el puerto real |

## Checklist de cierre
- [ ] Todos los RF tienen implementación verificable.
- [ ] Cada flujo de UC cubierto tiene al menos un CA, y cada CA su test.
- [ ] Cada edge case Must tiene su test.
- [ ] Review aprobada.
- [ ] 0 Open Questions.
