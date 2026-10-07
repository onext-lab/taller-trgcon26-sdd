# Módulo `ofertas` (código `jobs`) — Foto técnica

Estado de `main` sincronizado hasta **HU-02** (2026-10-06, review «Aprobado con observaciones», ronda 2), con los cambios
transversales de **HU-03** que tocan a ofertas (`details` acotado, piezas web compartidas, tabla `ROUTES`) y los de
**HU-04** (2026-10-07: guardas de estado en el SQL, lector del puerto «estado de la oferta» y «Ver pipeline») y
**HU-05** (2026-10-07: `getJobSummary` en el lector y «Ver pipeline» en una cerrada). Lo
mantiene `/module-sync`; la parte funcional y el % MVP están en [functional.md](functional.md). Decisiones que lo
condicionan: DEC-01, DEC-03, DEC-06 (aclarada en HU-04) a DEC-12 de
[DECISIONS.md](../../07_architecture_principles/DECISIONS.md) (DEC-11.4 enmendado en HU-03).

**El ciclo de vida completo (`draft → published → closed`) está implementado.** Lo único **latente** es el puerto
hacia `inscripciones`: `noJobApplications` (cuenta 0 y no rechaza nada) hasta que HU-06 lo sustituya en `app.ts`; hasta
entonces, cerrar una oferta deja abiertas sus inscripciones (ventana de INV-05, ver
[inscripciones](../inscripciones/technical.md)). En sentido contrario, desde HU-04 `jobs` **ya implementa** el puerto
«estado de la oferta» que define `inscripciones` (`job-status.ts`).

## Estructura de código

| Capa | Ruta | Contenido |
|---|---|---|
| Rutas | `apps/api/src/modules/jobs/routes.ts` | Plugin `jobsRoutes` (prefijo `/api/jobs`), JSON Schema por ruta, `preValidation` con `trimTextFields` (cuerpo y `q`) y `rejectBody` en las acciones, sin `try/catch` |
| Servicio | `apps/api/src/modules/jobs/service.ts` | `createJobsService({ repository, now, transaction, applications })`: `create`, `get`, `update`, `remove`, `publish`, `close`, `closePreview`, `duplicate` y `list(query)` |
| Reglas | `apps/api/src/modules/jobs/rules.ts` | Sin HTTP ni SQL: tabla acción × estado (`checkAction`: `apply`, `noop` o 409), obligatorios (`missingRequiredDetails`) y banda (`salaryRangeDetails`) |
| Puerto | `apps/api/src/modules/jobs/applications-port.ts` | `JobApplicationsPort` (`countActiveApplications`, `rejectActiveApplications`) y el stub `noJobApplications`; HU-06 lo conectará en `app.ts` |
| Repositorio | `apps/api/src/modules/jobs/repository.ts` | `createJobsRepository(db)`: SQL preparado (`update`, `deleteById`, `markPublished` y `markClosed`, **los cuatro con guarda de estado en el `WHERE`**, `findStatusById`, `listPage`, `count`), `toJob(row)` (`snake_case` → `camelCase`) |
| Lector de estado | `apps/api/src/modules/jobs/job-status.ts` | `createJobStatusReader(repo)`: implementa el `JobStatusPort` de `applications` sin importarlo (`getJobStatus(id)` → `draft`, `published`, `closed` o `null`), sobre `findStatusById` (`SELECT status`); `app.ts` comprueba la forma por tipado estructural |
| Esquemas | `apps/api/src/modules/jobs/schemas.ts` | Tipos (`Job`, `JobInput`, `JobPatch`, `JobListItem`, `JobPage`, `JobListQuery`, `ClosePreview`) y JSON Schema (`jobFieldsSchema`, `listQuerySchema`…); el alta y la edición declaran `id`, `status`, `createdAt`, `publishedAt` y `closedAt` con `forbiddenFields` (`apps/api/src/http/validation.ts`) para que sigan nombrados (DEC-11.4) |
| Búsqueda | `apps/api/src/db/text-search.ts` | `foldSearchText` y `fold_search(texto)`, función SQL que el repositorio registra en su conexión |
| Guarda entre sitios | `apps/api/src/http/cross-site.ts` | Hook `onRequest` global (DEC-12): 403 `CROSS_SITE_REQUEST` a las escrituras desde otro sitio |
| Composición | `apps/api/src/app.ts` | `buildApp({ db, logger?, now?, jobApplications?, candidateProcesses?, jobStatus? })` crea el servicio y registra el plugin (DD-09), y pasa `createJobStatusReader(jobsRepository)` a `applications` (`jobStatus?` solo para tests); ningún otro módulo importa `jobs` |
| Migración · seed | `apps/api/src/db/migrations/001-create-job-openings.sql` · `apps/api/src/db/seed.ts` | Tabla `job_openings` (sin migración nueva en HU-02); 10 ofertas inventadas: 4 `draft`, 4 `published` y 2 `closed` (`seed` carga además los 30 candidatos de `seed-candidates.ts` y, con HU-04, las 40 inscripciones de `seed-applications.ts`: de las 4 publicadas, 3 tienen 10 cada una y 1 queda vacía; las 2 cerradas, 5 cada una; los borradores, ninguna) |
| Web | `apps/web/src/features/jobs/` | `api.ts`, `types.ts`, `paths.ts`, `labels.ts`, `job-form-model.ts`, `list-query.ts` (URL del listado; re-exporta las reglas de `components/list-controls.ts`), `job-form-errors.ts` (delega en `components/form-errors.ts`), `use-job-actions.ts` y las pantallas y componentes; `JobPagination.tsx` envuelve `components/Pagination.tsx`; `JobActions.tsx` importa `pipelinePath` de `apps/web/src/features/applications/paths.ts` (dirección `jobs → applications`, DEC-06 por analogía) |
| Tests API | `apps/api/test/jobs/` · `apps/api/test/http/cross-site.test.ts` · `apps/api/test/http/error-details.test.ts` | `create`, `create-adversarial`, `control-chars`, `update`, `delete`, `get`, `list`, `list-filters`, `list-filters-adversarial`, `publish`, `close`, `duplicate`, `status-rules`, `status-rules-adversarial`, `state-guards` (SEC-02: regresión de respuestas, 0 filas en el repositorio y 409 en el servicio), `enumeration`, `migration`, `seed`, `performance`, `error-details-regression` · guarda DEC-12 · `details` acotado (DEC-11.4) |
| Tests web · e2e | `apps/web/test/features/jobs/` · `e2e/jobs.spec.ts`, `e2e/jobs-lifecycle.spec.ts`, `e2e/jobs-list.spec.ts` | Testing Library con `fetch` simulado · Playwright sobre `data/e2e.db` (ciclo de vida y listado filtrado) |

Piezas transversales que usa (de HU-01, DEC-11): `apps/api/src/http/`, `apps/api/src/errors.ts`,
`apps/api/src/clock.ts`, `apps/api/src/db/transaction.ts`, `apps/api/test/helpers/test-app.ts` y, en la web,
`apps/web/src/components/` (router, cliente HTTP, `useResource`, `ConfirmDialog`, `FormField`, `format.ts`). Desde HU-03,
también las piezas que se movieron allí desde esta feature y que `jobs` sigue usando: `list-controls.ts`,
`Pagination.tsx`, `PageSizeSelect.tsx`, `form-errors.ts`, `use-document-title.ts`, `use-lifetime-signal.ts` y
`parseRouteId` de `router.tsx` (los nombres públicos de `jobs` se conservan).

## Tablas y migraciones

`job_openings` (migración `001-create-job-openings.sql`). Fechas en ISO 8601 UTC con milisegundos (`GLOB` en la base).

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Un ID borrado no se reutiliza (DD-07) |
| `title` | `TEXT NOT NULL` | `length` 3-120 |
| `description` · `location` | `TEXT` | Nulo o `length` 1-5 000 · nulo o 2-120 |
| `work_mode` | `TEXT` | Nulo o `presencial`, `híbrida`, `remota` |
| `salary_min` · `salary_max` | `INTEGER` | Nulo o `typeof = 'integer'` y > 0; mínimo ≤ máximo (INV-07) |
| `status` | `TEXT NOT NULL DEFAULT 'draft'` | `draft`, `published`, `closed` |
| `created_at` | `TEXT NOT NULL` | Lo pone el servicio con el reloj inyectado |
| `published_at` · `closed_at` | `TEXT` | Nulo o fecha en el mismo formato; los fija el servicio: `published_at` al publicar y `closed_at` al cerrar |

- `CHECK` de coherencia estado-fechas (INV-01, INV-05) y de obligatorios fuera de `draft` (INV-04): desde HU-02 los
  ejercen `publish`, `close` y `update` (DD-08 del diseño backend de HU-01 los adelantó porque SQLite no deja añadir un
  `CHECK` a una tabla existente). Sin migración nueva en HU-02.
- Índice `job_openings_reference_date_idx` sobre `COALESCE(published_at, created_at) DESC, id DESC`; el listado usa la
  misma expresión.
- No están en la base: las transiciones de estado ni «solo se borra un `draft`» (INV-03). Las comprueba `checkAction`
  (`apps/api/src/modules/jobs/rules.ts`) en el servicio, dentro de la transacción (DEC-08); y, desde HU-04 (SEC-02),
  **toda escritura que depende del estado lleva su guarda en el propio `WHERE`**: `markPublished` (`status = 'draft'`),
  `markClosed` (`status = 'published'`), el `UPDATE` de edición (`status IN ('draft', 'published')`) y el `DELETE`
  (`status = 'draft'`). Defensa en profundidad: la API no puede llegar a una fila no permitida (el servicio ya la
  rechazó), pero un repositorio llamado a destiempo afecta 0 filas.
- Desde la migración `003`, `applications.job_id` es FK a `job_openings (id)` con `ON DELETE RESTRICT`: una oferta con
  inscripciones no se puede borrar. Un `draft` nunca las tiene (INV-02 de `inscripciones`), así que el borrado de borradores
  no cambia.

## Endpoints

| Método y ruta | Entrada | Éxito | Errores |
|---|---|---|---|
| `POST /api/jobs` | `title` obligatorio; resto de `jobFieldsSchema` opcional | 201 `Job` en `draft` | 400 · 403 · 413 · 415 · 500 |
| `GET /api/jobs` | `status`, `q`, `page`, `pageSize` (abajo); cualquier otro parámetro da 400 | 200 `{ items, total, page, pageSize }`; `total` es el del resultado filtrado | 400 · 500 |
| `GET /api/jobs/:id` | `id` texto `^[1-9][0-9]{0,14}$` | 200 `Job` | 400 · 404 · 500 |
| `PATCH /api/jobs/:id` | Al menos un campo; ausente = sin cambios; `null` = sin valor | 200 `Job` fusionado | 400 · 403 · 404 · 409 (cerrada) · 413 · 415 · 500 |
| `DELETE /api/jobs/:id` | Sin cuerpo ni `Content-Type` | 204 | 400 · 403 · 404 · 409 (publicada o cerrada) · 500 |
| `POST /api/jobs/:id/publish` | Sin cuerpo | 200 `Job` publicado; ya publicada: 200 igual, misma fecha | 400 (cuerpo, o `details` con los obligatorios que faltan) · 403 · 404 · 409 (cerrada) · 500 |
| `POST /api/jobs/:id/close` | Sin cuerpo | 200 `Job` cerrado, en una transacción con el puerto; ya cerrada: 200 igual | 400 · 403 · 404 · 409 (borrador) · 500 |
| `GET /api/jobs/:id/close-preview` | — | 200 `{ activeApplications }`, en cualquier estado | 400 · 404 · 500 |
| `POST /api/jobs/:id/duplicate` | Sin cuerpo | 201 `Job` nuevo en `draft` con los 6 campos editables; no es idempotente | 400 · 403 · 404 · 500 |

- `Job` lleva siempre los 11 campos; los opcionales sin valor salen `null`, nunca ausentes.
- `JobListItem` = `{ id, title, status, referenceDate }`, con `referenceDate = publishedAt ?? createdAt`.
- **Parámetros del listado** (`listQuerySchema`): `status` (`draft`, `published` o `closed`), `q` (se recorta; ≤ 100
  caracteres, sin controles; contenido en el título, sin mayúsculas ni tildes), `page` (por defecto 1) y `pageSize`
  (1 a 100, por defecto 20). `status` y `q` se combinan en Y; una página más allá de la última da `items: []`.
- Las acciones sin cuerpo rechazan cualquier cuerpo (también `{}`) con 400 `details: [{ field: 'body' }]`.
- Una clave no declarada en el cuerpo o la query (`foo`, `sort`) da 400 con **un solo** elemento
  `{ field: 'body' | 'querystring', message: 'Hay campos no permitidos.' }`, sin nombrarla (DEC-11.4 enmendado en HU-03).
  Los de solo lectura del alta y la edición (`id`, `status`, `createdAt`, `publishedAt`, `closedAt`) siguen saliendo con su
  nombre y «Campo no permitido.».
- `PATCH` y `DELETE` comprueban el estado en el servicio (`INVALID_TRANSITION`, 409); una publicada solo se edita si
  conserva título, descripción, ubicación y modalidad.
- **409 de la guarda del SQL (SEC-02, DD-09 de HU-04):** si, tras comprobar el estado, el `UPDATE` o el `DELETE` afecta 0
  filas, el servicio lanza 409 `INVALID_TRANSITION` con «El estado de la oferta ha cambiado: recarga e inténtalo de
  nuevo.». Bajo `BEGIN IMMEDIATE` es un camino defensivo inalcanzable por la API; su mensaje difiere de los de `rules.ts`
  porque solo aparecería si alguien se salta el servicio. No añade ningún endpoint ni cambia las respuestas existentes.

## Pantallas y componentes

| Ruta | Contenedor → presentacionales | Notas |
|---|---|---|
| `/jobs` (entrada; `/` redirige) | `JobListScreen` → `JobFilters`, `JobTable`, `JobPagination` | Filtros y página en la URL (`?status=&q=&page=&pageSize=`, `list-query.ts`); cargando, vacío (con o sin filtros), error con «Reintentar» (un 400 muestra el parámetro y «Quitar filtros»); «Por página» ofrece 20, 50 y 100 |
| `/jobs/new` · `/jobs/:id/edit` | `JobFormScreen` → `JobForm` | Un formulario para alta y edición; la edición envía solo lo cambiado (`toPatch`); en una publicada marca los obligatorios; un 409 o un 404 al guardar recarga la oferta (`job-form-errors.ts`) |
| `/jobs/:id` | `JobDetailScreen` → `JobDetails`, `JobActions` (`CloseJobAction`, `DeleteJobAction`) | Acciones por estado en `JobActions`: `draft` edita, publica, borra y duplica; `published` ofrece **«Ver pipeline»** (un `Link` a `pipelinePath(job.id)`, primer control, desde HU-04), edita, cierra (diálogo con las inscripciones activas) y duplica; `closed` ofrece «Ver pipeline» (pipeline en solo lectura, desde HU-05) y duplica (ficha de solo lectura). Publicar y duplicar van en `use-job-actions.ts` |

`apps/web/src/App.tsx` resuelve las pantallas con la tabla `ROUTES` (patrón, título y elemento, en orden de
coincidencia: `/jobs/new` antes de `/jobs/:id`). Sustituyó las ramas propias de `resolveScreen` para no pasar de 10 de
complejidad (gate de HU-03); `resolveScreen` solo busca en la tabla y devuelve «Página no encontrada» si nada coincide.
Una ruta nueva se añade a la tabla, no a `resolveScreen`.

Cliente de la feature en `apps/web/src/features/jobs/api.ts` sobre `requestJson` (`apps/web/src/components/http.ts`).
Los avisos tras navegar («Oferta creada.», «Cambios guardados.», «Oferta borrada.», «Oferta duplicada.») viajan en
`history.state`; los de publicar y cerrar los muestra la propia ficha.

## Validación y errores

- Esquema estricto con Ajv sin coerción ni `removeAdditional` (DEC-11.1); recorte previo en `preValidation` y
  opcionales vacíos → `null` (DEC-11.3); caracteres de control → 400 (`NO_CONTROL_CHARS`, DEC-11.8).
- **`details` acotado (DEC-11.4, enmendado en HU-03):** como mucho un elemento por campo declarado en el esquema más uno
  para todas las claves no declaradas, que sale agrupado como `{ field: 'body' | 'querystring', message: 'Hay campos no
  permitidos.' }` sin nombrarlas. Los de solo lectura se declaran con `forbiddenFields`
  (`apps/api/src/http/validation.ts`) y salen con su nombre y «Campo no permitido.». Lo construye `toDetails` en
  `apps/api/src/http/error-handler.ts`; los mensajes nuevos son `maxItems`, `false schema` y los tipos `boolean` y
  `array`. La regresión de ofertas está en `apps/api/test/jobs/error-details-regression.test.ts`.
- Orden de comprobación: guarda entre sitios (403, antes de parsear el cuerpo) → `rejectBody` en las acciones (400) →
  JSON Schema de `params`, `body` y `querystring` (400) → existencia (404) → estado (409) → reglas de campos (400:
  obligatorios de publicar o de una publicada y, detrás, mínimo > máximo en `salaryMin`, sobre los valores fusionados en
  `PATCH`). Todo lo posterior al esquema, dentro de la transacción (DEC-08).
- Repetir una transición da 200 sin cambios: `checkAction` devuelve `noop` y no se llama a `now()` ni al puerto.
- Códigos que emite hoy: `VALIDATION_ERROR`, `NOT_FOUND`, `INVALID_TRANSITION` (409, DEC-07), `CROSS_SITE_REQUEST`
  (403, DEC-12), `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `BAD_REQUEST`, `INTERNAL_ERROR`. Los construye
  `apps/api/src/http/error-handler.ts`; `INVALID_TRANSITION` sale de `apps/api/src/errors.ts` y `CROSS_SITE_REQUEST`
  de `apps/api/src/http/cross-site.ts`.
- **Guarda entre sitios (DEC-12):** hook `onRequest` global. Los métodos seguros (`GET`, `HEAD`, `OPTIONS`) pasan; el
  resto da 403 si `Sec-Fetch-Site` (en minúsculas y recortado) no es `same-origin` ni `none`. Sin cabecera pasa
  (`inject`, clientes que no son navegador). `same-site` se rechaza. El 403 va sin `details`.

## Convenciones del módulo

- Capas `routes` → `service` → `repository`; el servicio lanza `AppError` y nunca construye respuestas (DD-10).
- `UPDATE` con lista fija de 6 columnas; el `PATCH` es lectura-fusión-escritura en `withTransaction` (DD-05).
- `status` y las fechas solo las fija el servicio; cualquier campo de solo lectura en la entrada da 400, y los esquemas
  de alta y edición los declaran con `forbiddenFields` para que `details` los nombre (DEC-11.4).
- El listado devuelve solo los 4 campos de `JobListItem` (DEC-10).
- La web decide las acciones de la ficha por estado en `JobActions`.
- Toda escritura que depende del estado lleva la guarda en el `WHERE` y el servicio traduce 0 filas a 409 (SEC-02); una
  escritura nueva de este tipo hace lo mismo.
- Lo que otro módulo necesita saber de una oferta sale por un lector con columnas explícitas (`findStatusById` y, desde HU-05, `findSummaryById` → `job-status.ts`),
  no por `findById` (que usa `SELECT *`) ni por SQL ajeno.
- Las reglas de estado viven en `rules.ts` (tabla acción × estado); el servicio las aplica dentro de la transacción y,
  en el cierre, llama al puerto después del `UPDATE`: si lanza, se deshace todo (DEC-06).
- Las acciones sin cuerpo (`publish`, `close`, `duplicate`) llevan `rejectBody` y devuelven el `Job` resultante.
- El listado filtra con `fold_search(title)` sobre el texto plegado con `foldSearchText` y `instr` (sin comodines).

## Gotchas

- **Ajv de Fastify por defecto quita campos y convierte tipos** (`removeAdditional: true`, `coerceTypes: 'array'`): un
  `status` se descartaría en silencio y `"40000"` pasaría por entero. Lo corrige `ajvOptions` (DEC-11). Consecuencia:
  los numéricos de `params` y `querystring` (`page` y `pageSize` del listado) se declaran como texto con `pattern`.
  Efecto: `pageSize=101` o `0` da 400 «Formato no válido.» en `pageSize`, no un «máximo 100» (`apps/api/test/jobs/list-filters-adversarial.test.ts:73`).
- **NUL y `length()` de SQLite**: Ajv cuenta puntos de código, pero `length()` corta en el primer NUL; un título con
  NUL embebido daba 500 y uno con NUL final se guardaba (sonda de la review ronda 1). EC-50 / DEC-11.8 lo rechaza con
  400; HU-03 reutiliza `NO_CONTROL_CHARS*`.
- **`apps/api/src/server.ts` arranca el servidor al importarse**: lo que haya que probar del arranque va en
  `apps/api/src/listen-options.ts` (EC-32). `API_HOST` vacío también cae a `127.0.0.1` (`||`, SEC-03).
- **Reset de los e2e en el `webServer`**: en Playwright 1.63 el `webServer` arranca antes que `globalSetup`, así que
  `playwright.config.ts` regenera `data/e2e.db` en el propio comando de la API (`db:reset && start`), con puertos
  3101/5174 y `reuseExistingServer: false`.
- **`GET` y `DELETE` sin `Content-Type`**: con `application/json` y cuerpo vacío Fastify responde 400; `requestJson`
  solo lo pone si hay cuerpo.
- **Longitudes en puntos de código**: la web cuenta con `Array.from()` y no usa `maxLength` nativo (cortaría emojis).
- **Publicar, cerrar y duplicar son `POST` sin cuerpo**: para el navegador son peticiones «simples», sin *preflight* de
  CORS, y sin login nada las frena; por eso existe la guarda de DEC-12. Con la API en `127.0.0.1`, otra aplicación en
  otro puerto de loopback llega como `same-site`: la guarda también lo rechaza (SEC-01 de la ronda 1; tests en
  `apps/api/test/http/cross-site.test.ts`). La web pasa porque va por el proxy de Vite (`same-origin`).
- **La búsqueda pliega con NFD**: `q=Pena` encuentra «Peña» (la `ñ` pierde la tilde, EC-48) y «Gestión» da igual en NFC
  o NFD (`apps/api/src/db/text-search.ts:4-6`). `fold_search` se registra **por conexión** en `createJobsRepository`:
  cualquier otra conexión que ejecute esas consultas debe llamar a `registerTextSearch(db)` o SQLite responde «no such
  function».
- **El foco movido por un efecto pasivo se aserta con `expectFocusOn`** (`apps/web/test/helpers/focus.ts`): un `findBy*`
  puede resolver antes de que corra el efecto que mueve el foco o de la recarga de la ficha, y con la CPU cargada
  `CloseJobAction.test.tsx` («un 409 al cerrar…») y `JobListScreen.filters.test.tsx` («vacío con filtros…») fallaban a
  veces. T-03 los hizo esperar por el estado final, sin tiempos fijos ni timeouts más largos y sin tocar producción.
  Un test nuevo de foco usa el helper, no un `expect` inmediato.

## Deuda técnica

| Deuda | Estado | Origen |
|---|---|---|
| Sin cabeceras de endurecimiento (`nosniff`, `frame-ancestors`) en `apps/api/src/app.ts` ni en `apps/web/index.html` | Abierta (auditoría de sprint) | SEC-01 |
| `details` sin tope y con el nombre de la clave sobrante (`apps/api/src/http/error-handler.ts`) | **Cerrada en HU-03** (DEC-11.4 enmendado; tope «declaradas + 1» probado con 1 000 claves en `apps/api/test/http/error-details.test.ts`) | SEC-04 / DP-01 (HU-01), SEC-03 (HU-02) |
| `apps/api/test/http/error-handler.test.ts` a 299 líneas | Abierta: el siguiente test va en un fichero hermano | Review ronda 2 de HU-01 |
| Surrogates sueltos sin test | Abierta (el auditor infiere que no hay desajuste) | Review ronda 2 de HU-01, §8 |
| `UPDATE` y `DELETE` sin guarda de estado en el SQL (`apps/api/src/modules/jobs/repository.ts`) | **Cerrada en HU-04** (guarda en el `WHERE` de ambos y 409 del servicio; `apps/api/test/jobs/state-guards.test.ts`) | HU-02 §9.1 (SEC-02) |
| Sin lista de `Host` permitidos en `apps/api/src/app.ts`: un DNS rebinding llegaría como `same-origin` | Abierta (teórica, anterior a HU-02) | HU-02 §9.2 (SEC-04/SEC-05) |
| Tras un error de publicar o duplicar, el foco vuelve al botón con `document.activeElement` (`apps/web/src/features/jobs/use-job-actions.ts:63-64`); en Safari los botones no reciben foco al clic. `candidatos` ya lo evita con `ref` (`use-consent-focus.ts`) | Abierta | HU-02 §9.3 |
| Comentario obsoleto de `listQuerySchema` en `apps/api/src/modules/jobs/schemas.ts:167`: dice que un parámetro desconocido da «Campo no permitido.» y desde HU-03 da «Hay campos no permitidos.» | Abierta (trivial, solo el comentario) | Observada en HU-03 |
| `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx` en 300 líneas | Abierta: el siguiente test va en un fichero hermano | HU-02 §9.4 |
| El puerto de inscripciones solo expone un recuento; HU-06 necesita un test de que sus errores no llevan datos del candidato al log, y no copiar `SELECT *` de `findById` en candidatos | Aviso para HU-06 | HU-02 §9.5 (DP-01/DP-02) |

## Requisitos no funcionales

| RNF | Métrica | Test |
|---|---|---|
| Lecturas | `GET /api/jobs` (también filtrado), `/:id` y `/:id/close-preview` < 200 ms con 100 ofertas (`inject`, local) | `apps/api/test/jobs/performance.test.ts` |
| Acciones | `POST` (alta, publicar, cerrar, duplicar), `PATCH`, `DELETE` < 500 ms con 100 ofertas | `apps/api/test/jobs/performance.test.ts` |
| Errores | 100 % en el envelope, sin *stack traces* | `apps/api/test/http/error-handler.test.ts` |
| HTML | Título y descripción siempre como texto (sin `dangerouslySetInnerHTML`) | `apps/web/test/features/jobs/JobDetailScreen.test.tsx` |
| Accesibilidad | Controles con `<label>`; estados con `role="status"`/`"alert"` | Tests de `apps/web/test/features/jobs/` |
