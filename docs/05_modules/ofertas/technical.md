# Módulo `ofertas` (código `jobs`) — Foto técnica

Estado de `main` sincronizado hasta **HU-01** (2026-10-06, review «Aprobado con observaciones», ronda 2). Lo mantiene
`/module-sync`; la parte funcional y el % MVP están en [functional.md](functional.md). Decisiones que lo condicionan:
DEC-01, DEC-03, DEC-06 a DEC-11 de [DECISIONS.md](../../07_architecture_principles/DECISIONS.md).

**Hoy solo hay borradores (`draft`).** Lo que el modelo ya prevé para `published` y `closed` está marcado como
**latente**: existe en la migración o en el contrato, pero ningún código lo usa hasta HU-02.

## Estructura de código

| Capa | Ruta | Contenido |
|---|---|---|
| Rutas | `apps/api/src/modules/jobs/routes.ts` | Plugin `jobsRoutes` (prefijo `/api/jobs`), JSON Schema por ruta, `preValidation` con `trimTextFields`, sin `try/catch` |
| Servicio | `apps/api/src/modules/jobs/service.ts` | `createJobsService({ repository, now, transaction })`: `create`, `get`, `update`, `remove`, `list`; regla mínimo ≤ máximo |
| Repositorio | `apps/api/src/modules/jobs/repository.ts` | `createJobsRepository(db)`: SQL preparado, `toJob(row)` (`snake_case` → `camelCase`) |
| Esquemas | `apps/api/src/modules/jobs/schemas.ts` | Tipos (`Job`, `JobInput`, `JobPatch`, `JobListItem`, `JobPage`) y JSON Schema (`jobFieldsSchema`…) |
| Composición | `apps/api/src/app.ts` | `buildApp` crea el servicio y registra el plugin (DD-09); ningún otro módulo importa `jobs` |
| Migración · seed | `apps/api/src/db/migrations/001-create-job-openings.sql` · `apps/api/src/db/seed.ts` | Tabla `job_openings`; 4 borradores inventados |
| Web | `apps/web/src/features/jobs/` | `api.ts`, `types.ts`, `paths.ts`, `labels.ts`, `job-form-model.ts` y las pantallas |
| Tests API | `apps/api/test/jobs/` | `create`, `create-adversarial`, `control-chars`, `update`, `delete`, `get`, `list`, `enumeration`, `migration`, `seed`, `performance` |
| Tests web · e2e | `apps/web/test/features/jobs/` · `e2e/jobs.spec.ts` | Testing Library con `fetch` simulado · Playwright sobre `data/e2e.db` |

Piezas transversales que usa (de HU-01, DEC-11): `apps/api/src/http/`, `apps/api/src/errors.ts`,
`apps/api/src/clock.ts`, `apps/api/src/db/transaction.ts`, `apps/api/test/helpers/test-app.ts` y, en la web,
`apps/web/src/components/` (router, cliente HTTP, `useResource`, `ConfirmDialog`, `FormField`, `format.ts`).

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
| `published_at` · `closed_at` | `TEXT` | **Latentes**: siempre `NULL` hasta HU-02 |

- `CHECK` de coherencia estado-fechas (INV-01, INV-05) y de obligatorios fuera de `draft` (INV-04): **latentes**, ya
  defendidos en la base (DD-08 del diseño backend de HU-01) porque SQLite no deja añadir un `CHECK` a una tabla
  existente.
- Índice `job_openings_reference_date_idx` sobre `COALESCE(published_at, created_at) DESC, id DESC`; el listado usa la
  misma expresión.
- No están en la base: las transiciones de estado ni «solo se borra un `draft`» (INV-03). Las comprobará el servicio
  de HU-02 dentro de la transacción (DEC-08).

## Endpoints

| Método y ruta | Entrada | Éxito | Errores |
|---|---|---|---|
| `POST /api/jobs` | `title` obligatorio; resto de `jobFieldsSchema` opcional | 201 `Job` en `draft` | 400 · 413 · 415 · 500 |
| `GET /api/jobs` | Sin parámetros (cualquiera da 400 hasta HU-02) | 200 `{ items, total, page: 1, pageSize: 20 }` | 400 · 500 |
| `GET /api/jobs/:id` | `id` texto `^[1-9][0-9]{0,14}$` | 200 `Job` | 400 · 404 · 500 |
| `PATCH /api/jobs/:id` | Al menos un campo; ausente = sin cambios; `null` = sin valor | 200 `Job` fusionado | 400 · 404 · 413 · 415 · 500 |
| `DELETE /api/jobs/:id` | Sin cuerpo ni `Content-Type` | 204 | 400 · 404 · 500 |

- `Job` lleva siempre los 11 campos; los opcionales sin valor salen `null`, nunca ausentes. `publishedAt` y `closedAt`
  van ya en el contrato (latentes).
- `JobListItem` = `{ id, title, status, referenceDate }`, con `referenceDate = publishedAt ?? createdAt`.
- **Latente hasta HU-02:** `PATCH` y `DELETE` no comprueban el estado (no existen ofertas `published` ni `closed`).
  HU-02 añade el 409 `INVALID_TRANSITION` en `service.update` y `service.remove` (aviso de la review).

## Pantallas y componentes

| Ruta | Contenedor → presentacionales | Notas |
|---|---|---|
| `/jobs` (entrada; `/` redirige) | `JobListScreen` → `JobTable` | Cargando, vacío, error con «Reintentar»; aviso si `total` > 20 |
| `/jobs/new` · `/jobs/:id/edit` | `JobFormScreen` → `JobForm` | Un formulario para alta y edición; la edición envía solo lo cambiado (`toPatch`) |
| `/jobs/:id` | `JobDetailScreen` → `JobDetails`, `DeleteJobAction` | Acciones por estado en `JobActions`: hoy, solo «Editar» y «Borrar» en `draft` |

Cliente de la feature en `apps/web/src/features/jobs/api.ts` sobre `requestJson` (`apps/web/src/components/http.ts`).
Los avisos tras navegar («Oferta creada.», «Cambios guardados.», «Oferta borrada.») viajan en `history.state`.

## Validación y errores

- Esquema estricto con Ajv sin coerción ni `removeAdditional` (DEC-11.1); recorte previo en `preValidation` y
  opcionales vacíos → `null` (DEC-11.3); caracteres de control → 400 (`NO_CONTROL_CHARS`, DEC-11.8).
- Orden de comprobación: JSON Schema (400) → existencia (404) → reglas del servicio (400, mínimo > máximo en
  `salaryMin`, sobre los valores fusionados en `PATCH`).
- Códigos que emite hoy: `VALIDATION_ERROR`, `NOT_FOUND`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`,
  `BAD_REQUEST`, `INTERNAL_ERROR`. Todos los construye `apps/api/src/http/error-handler.ts`.

## Convenciones del módulo

- Capas `routes` → `service` → `repository`; el servicio lanza `AppError` y nunca construye respuestas (DD-10).
- `UPDATE` con lista fija de 6 columnas; el `PATCH` es lectura-fusión-escritura en `withTransaction` (DD-05).
- `status` y las fechas solo las fija el servicio; cualquier campo de solo lectura en la entrada da 400.
- El listado devuelve solo los 4 campos de `JobListItem` (DEC-10).
- La web decide las acciones de la ficha por estado en `JobActions`: HU-02 solo añade las suyas.

## Gotchas

- **Ajv de Fastify por defecto quita campos y convierte tipos** (`removeAdditional: true`, `coerceTypes: 'array'`): un
  `status` se descartaría en silencio y `"40000"` pasaría por entero. Lo corrige `ajvOptions` (DEC-11). Consecuencia:
  los numéricos de `params` y `querystring` (el `page`/`pageSize` de HU-02) se declaran como texto con `pattern`.
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

## Deuda técnica

| Deuda | Estado | Origen |
|---|---|---|
| Sin cabeceras de endurecimiento (`nosniff`, `frame-ancestors`) en `apps/api/src/app.ts` ni en `apps/web/index.html` | Abierta (auditoría de sprint) | SEC-01 |
| `details` sin tope y con el nombre de la clave sobrante (`apps/api/src/http/error-handler.ts`) | Abierta: limitar antes de HU-03 | SEC-04 / DP-01 |
| `apps/api/test/http/error-handler.test.ts` a 299 líneas | Abierta: el siguiente test va en un fichero hermano | Review ronda 2 |
| Surrogates sueltos sin test | Abierta (el auditor infiere que no hay desajuste) | Review ronda 2, §8 |

## Requisitos no funcionales

| RNF | Métrica | Test |
|---|---|---|
| Lecturas | `GET /api/jobs` y `/:id` < 200 ms con 100 ofertas (`inject`, local) | `apps/api/test/jobs/performance.test.ts` |
| Acciones | `POST`, `PATCH`, `DELETE` < 500 ms con 100 ofertas | `apps/api/test/jobs/performance.test.ts` |
| Errores | 100 % en el envelope, sin *stack traces* | `apps/api/test/http/error-handler.test.ts` |
| HTML | Título y descripción siempre como texto (sin `dangerouslySetInnerHTML`) | `apps/web/test/features/jobs/JobDetailScreen.test.tsx` |
| Accesibilidad | Controles con `<label>`; estados con `role="status"`/`"alert"` | Tests de `apps/web/test/features/jobs/` |
