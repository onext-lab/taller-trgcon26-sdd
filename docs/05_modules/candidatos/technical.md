# Módulo `candidatos` (código `candidates`) — Foto técnica

Estado de `main` sincronizado hasta **HU-03** (2026-10-06, review «Aprobado con observaciones», ronda 1). Lo mantiene
`/module-sync`; la parte funcional y el % MVP están en [functional.md](functional.md). Decisiones que lo condicionan:
DEC-01, DEC-03, DEC-04, DEC-06 a DEC-12 de [DECISIONS.md](../../07_architecture_principles/DECISIONS.md) (con el
punto 4 de DEC-11 enmendado en esta HU) y [RGPD.md](../../RGPD.md) §1 a §3 y §6.

**El módulo está completo salvo lo que depende de `inscripciones`.** Lo **latente**: el puerto `CandidateProcessesPort`
responde con el stub `noCandidateProcesses` («sin inscripciones») hasta que HU-04 lo sustituya en `app.ts`, y
`recalculateRetention` solo la llaman el propio servicio (alta y consentimiento); HU-04 y HU-05 la llamarán al crear y
cerrar inscripciones. Por eso `retentionEndsAt` nunca es `null` hoy.

## Estructura de código

| Capa | Ruta | Contenido |
|---|---|---|
| Rutas | `apps/api/src/modules/candidates/routes.ts` | Plugin `candidatesRoutes` (prefijo `/api/candidates`), JSON Schema por ruta, `preValidation` con `normalizeBody` (alta y edición), `trimSearchText` (`q` y `skill`) y `rejectBody` en las dos acciones de consentimiento, sin `try/catch` |
| Servicio | `apps/api/src/modules/candidates/service.ts` | `createCandidatesService({ repository, now, transaction, processes })`: `list`, `create`, `get`, `update`, `giveConsent`, `withdrawConsent` y `recalculateRetention` |
| Retención | `apps/api/src/modules/candidates/retention.ts` | Fórmula pura, sin reloj ni SQL: `computeRetentionEndsAt`, `madridCalendarDate`, `addMonthsClamped` |
| Puerto | `apps/api/src/modules/candidates/processes-port.ts` | `CandidateProcessesPort` (`getProcesses`), `CandidateProcesses` y el stub `noCandidateProcesses`; HU-04 lo conectará en `app.ts` |
| Normalización | `apps/api/src/modules/candidates/normalize.ts` | `normalizeCandidateBody(body)`: pura e idempotente; recorta, email en minúsculas, skills recortadas, en minúsculas, sin vacías y deduplicadas (antes de que el esquema cuente `maxItems`) |
| Repositorio | `apps/api/src/modules/candidates/repository.ts` | `createCandidatesRepository(db)`: SQL preparado (`findById`, `findIdByEmail`, `insert`, `updateFields`, `setConsent`, `setRetention`, `listPage`, `count`, `isDuplicateEmailError`), `toCandidate(row)`; registra `fold_search` en su conexión |
| Esquemas | `apps/api/src/modules/candidates/schemas.ts` | Tipos (`Candidate`, `CandidateListItem`, `CandidatePage`, `CandidateInput`, `CandidatePatch`, `CandidateListQuery`), `CONSENT_TEXT_VERSION = 'v1'`, `READ_ONLY` y JSON Schema (`candidateFieldsSchema`, `createCandidateBodySchema`, `updateCandidateBodySchema`, `listQuerySchema`, respuestas) |
| Composición | `apps/api/src/app.ts` | `buildApp({ db, logger?, now?, jobApplications?, candidateProcesses? })` crea el servicio con `candidateProcesses = noCandidateProcesses` y registra el plugin; `candidates` no importa `jobs` ni `applications` (DEC-06) |
| Migración · seed | `apps/api/src/db/migrations/002-create-candidates.sql` · `apps/api/src/db/seed-candidates.ts` | Tabla `candidates` · 30 candidatos inventados, que `seed(db, now = new Date())` carga en la misma transacción que las ofertas |
| Web | `apps/web/src/features/candidates/` | `api.ts`, `types.ts`, `paths.ts`, `consent.ts`, `list-state.ts`, `candidate-form-model.ts`, `candidate-form-errors.ts`, `use-consent-actions.ts`, `use-consent-focus.ts` y las pantallas y componentes |
| Tests API | `apps/api/test/candidates/` · `apps/api/test/helpers/candidates.ts` | `create`, `create-adversarial`, `get`, `update`, `update-adversarial`, `list`, `list-adversarial`, `consent`, `consent-adversarial`, `retention`, `normalize`, `migration`, `seed`, `privacy-logs`, `performance` · `createProcessesStub` y `createCandidate` |
| Tests web · e2e | `apps/web/test/features/candidates/` · `apps/web/test/components/` · `e2e/candidates.spec.ts`, `e2e/candidates-list.spec.ts` | Testing Library con `fetch` simulado (`apps/web/test/helpers/fetch.ts`, `dialog.ts`, `focus.ts`) · Playwright sobre `data/e2e.db` (10 recorridos) |

Piezas transversales que usa: `apps/api/src/http/` (`error-handler.ts`, `validation.ts`, `cross-site.ts`),
`apps/api/src/errors.ts`, `apps/api/src/clock.ts`, `apps/api/src/db/transaction.ts`, `apps/api/src/db/text-search.ts` y,
en la web, `apps/web/src/components/` (ver «Pantallas y componentes»).

## Tablas y migraciones

`candidates` (migración `002-create-candidates.sql`; la `001` es de ofertas). Instantes en ISO 8601 UTC con
milisegundos (`GLOB` en la base); `retention_ends_at` es un día natural `AAAA-MM-DD` de Europe/Madrid.

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Sin borrado: no hay ruta ni operación (RN-13, INV-05) |
| `full_name` | `TEXT NOT NULL` | `length` 2-100 |
| `email` | `TEXT NOT NULL` | `length` 3-254 y `email = lower(trim(email))` (INV-02) |
| `phone` · `summary` | `TEXT` | Nulo o `length` 6-21 · nulo o 1-2 000 |
| `skills` | `TEXT NOT NULL DEFAULT '[]'` | `json_valid` y `json_type = 'array'` y `json_array_length <= 20` |
| `created_at` | `TEXT NOT NULL` | Lo pone el servicio con el reloj inyectado; `GLOB` ISO con ms |
| `consent_given_at` · `consent_withdrawn_at` | `TEXT` | Nulo o `GLOB` ISO con ms |
| `consent_version` | `TEXT` | Nulo o `GLOB 'v[0-9]*'` |
| `retention_ends_at` | `TEXT` | Nulo o `GLOB` `AAAA-MM-DD`; admite `NULL` ya (HU-04 no migra) |

- `CHECK ((consent_given_at IS NULL) = (consent_version IS NULL))` y `CHECK (consent_withdrawn_at IS NULL OR
  consent_given_at IS NOT NULL)` (INV-04): la versión existe si y solo si existe el otorgamiento, y no hay retirada sin
  otorgamiento.
- `candidates_email_uq`, índice **único** sobre `email` (INV-01, DEC-08): la unicidad la garantiza la base y el servicio
  traduce su violación a 409.
- `candidates_created_at_idx` sobre `created_at DESC, id DESC`: el orden del listado.
- Un único estado de consentimiento por candidato, sin historial (DT-03): volver a otorgarlo sustituye fecha y versión y
  vacía la retirada.
- No están en la base: la fórmula de retención (INV-03) ni que las skills estén en minúsculas, sin vacías y sin repetir
  (INV-02); lo garantizan `normalize.ts`, el esquema y el servicio.

**Seed** (`apps/api/src/db/seed-candidates.ts`): 30 candidatos con `@example.com`. Alta = `now − (3 + 5·i)` días
(i = 0…29), así que ninguno está vencido; vigentes los índices múltiplos de 3 (10), retirados 1, 7, 13 y 19 (4) y el
resto sin consentimiento (16); 0-4 skills de un conjunto de 12. Las fechas son **relativas al reset**
(`npm run db:reset`), nunca absolutas. El seed escribe con el repositorio y calcula la retención con
`computeRetentionEndsAt` y `noCandidateProcesses`.

## Endpoints

| Método y ruta | Entrada | Éxito | Errores |
|---|---|---|---|
| `POST /api/candidates` | `fullName` y `email` obligatorios; `phone`, `summary`, `skills` y `consent` (booleano) opcionales | 201 `Candidate`; con `consent: true` guarda fecha del reloj y `v1` | 400 · 403 · **409 `DUPLICATE`** · 413 · 415 · 500 |
| `GET /api/candidates` | `q`, `skill`, `page`, `pageSize` (abajo); cualquier otro parámetro da 400 | 200 `{ items, total, page, pageSize }`; `total` es el del resultado filtrado | 400 · 500 |
| `GET /api/candidates/:id` | `id` texto `^[1-9][0-9]{0,14}$` | 200 `Candidate` | 400 · 404 · 500 |
| `PATCH /api/candidates/:id` | Al menos un campo de los cinco editables; ausente = sin cambios; `null` solo vacía `phone` y `summary` | 200 `Candidate` (también sin cambios); nunca toca retención ni consentimiento | 400 · 403 · 404 · 409 · 413 · 415 · 500 |
| `POST /api/candidates/:id/consent` | Sin cuerpo | 200 `Candidate` con `consentGivenAt` = reloj, `consentVersion` = `v1`, retirada `null` y retención recalculada (registrar y renovar) | 400 (`body` o `id`) · 403 · 404 · 500 |
| `POST /api/candidates/:id/consent/withdrawal` | Sin cuerpo | 200 `Candidate`: con consentimiento vigente, retirada = reloj y retención recalculada; sin él, la ficha **sin cambios** (sin `now()`, sin escribir) | 400 · 403 · 404 · 500 |

- `Candidate` lleva siempre los 11 campos; los opcionales sin valor salen `null`, nunca ausentes. Consentimiento
  **vigente** = `consentGivenAt !== null && consentWithdrawnAt === null`; retirado = ambos no nulos; nunca dado = ambos nulos.
- `CandidateListItem` = `{ id, fullName, email, skills }`, exactamente 4 campos (RNF-04): el esquema de respuesta filtra
  cualquier otro.
- **Parámetros del listado** (`listQuerySchema`): `q` (se recorta; ≤ 100, sin controles), `skill` (se recorta; ≤ 40, sin
  controles), `page` (`^[1-9][0-9]{0,8}$`, por defecto 1) y `pageSize` (1 a 100, por defecto 20). `q` o `skill` vacíos =
  sin filtro; una página más allá de la última da `items: []`.
- Las acciones de consentimiento rechazan cualquier cuerpo (también `{}`) con 400 `details: [{ field: 'body' }]`.
- `DELETE /api/candidates/:id` no existe: cae en el `setNotFoundHandler` → 404 `NOT_FOUND` «El recurso no existe.».
- **409 `DUPLICATE`**: `message` fijo «Ya existe un candidato con este email.» y
  `details: [{ field: 'email', message, existingId: <id> }]`; nunca el email ni otro dato del existente. Lo emiten el
  alta y el `PATCH` (email de otro).

## Pantallas y componentes

| Ruta | Contenedor → presentacionales | `document.title` · notas |
|---|---|---|
| `/candidates` | `CandidateListScreen` → `CandidateFilters`, `CandidateTable`, `Pagination` | «Candidatos · ATS». Búsqueda en `list-state.ts`, no en la URL; paginación con botones; foco al h1 tras cambiar de página; cargando, vacío (con o sin filtros), error con «Reintentar» |
| `/candidates/new` · `/candidates/:id/edit` | `CandidateFormScreen` → `CandidateForm` | «Nuevo candidato · ATS» · «Editar candidato · ATS». Un formulario para alta y edición; el alta lleva la casilla de consentimiento; la edición envía solo lo cambiado (`toPatch`) y sin cambios no hace petición; 409 → error junto al email y enlace «Ver el candidato existente» por `existingId` |
| `/candidates/:id` | `CandidateDetailScreen` → `CandidateDetails`, `ConsentSection` | «Ficha de candidato · ATS» (también cargando y con error); «Candidato no encontrado · ATS» si no existe. Sección de consentimiento con casilla, «Renovar consentimiento» y `ConfirmDialog` para retirar |

- **Títulos genéricos (DT-10 a, RNF-09):** cada pantalla fija un texto constante con `useDocumentTitle`; el nombre solo
  va en el `h1` de la ficha. Las rutas llevan solo el ID.
- **Filtros fuera de la URL (DT-10 c, DD-01):** `apps/web/src/features/candidates/list-state.ts` guarda la búsqueda
  aplicada (`q`, `skill`, `page`, `pageSize`) en una variable del módulo (`readListState`, `saveListState`,
  `INITIAL_LIST_QUERY`, `hasFilters`). Volver al listado la restaura; recargar la pierde. Nunca va a la URL, a
  `history.state` ni al almacenamiento del navegador.
- **Consentimiento en la web:** `consent.ts` guarda `CONSENT_TEXT` y `CONSENT_VERSION = 'v1'`, copia de la constante de la
  API; la ficha muestra siempre la versión guardada (`consentVersion`). La casilla refleja lo guardado, sin
  actualización optimista (DD-05). El foco vuelve al control que lanzó la acción por `ref`
  (`use-consent-focus.ts`), no por `document.activeElement`. Los avisos «Candidato creado.» y «Cambios guardados.»
  viajan en `history.state` (`NoticeText`).
- **Piezas compartidas** que HU-03 movió de `jobs` a `apps/web/src/components/` (jobs las re-exporta o las usa, sus
  tests no cambiaron): `list-controls.ts` (`DEFAULT_PAGE_SIZE`, `PAGE_SIZES`, `totalPages`, `validateSearchText`,
  `validateFilterText`), `Pagination.tsx` (con `renderStep`: enlaces en ofertas, botones en candidatos),
  `PageSizeSelect.tsx`, `form-errors.ts` (`splitValidationDetails`, `focusFirstError`), `use-document-title.ts`,
  `use-lifetime-signal.ts` y `parseRouteId` en `router.tsx`. HU-03 añadió además `formatCalendarDate` en `format.ts` y
  `existingId` en `ApiErrorDetail` de `http.ts` (solo si es un entero seguro > 0).
- **Rutas:** `apps/web/src/App.tsx` resuelve las pantallas con la tabla `ROUTES` (`/candidates/new` antes de
  `/candidates/:id`); el enlace «Candidatos» va tras «Ofertas».

## Validación y errores

- Esquema estricto con Ajv sin coerción ni `removeAdditional` (DEC-11.1); `page` y `pageSize` como texto con `pattern`
  (DEC-11.2); caracteres de control → 400 (DEC-11.8), salvo `\n`, `\r` y `\t` en `summary`. Longitudes en puntos de código.
- Reglas por campo (`candidateFieldsSchema`, tras `normalizeCandidateBody`): `fullName` 2-100; `email` ≤ 254 y
  `format: 'email'`; `phone` `^\+?(?=(?:[^0-9]*[0-9]){6})[0-9 ()-]{6,20}$` (DT-05); `summary` ≤ 2 000; `skills` ≤ 20
  de 1-40. El formato `email` de Ajv solo admite ASCII.
- **Orden de comprobación:** guarda entre sitios (403, antes de parsear el cuerpo) → parser (415, 413, JSON mal formado)
  → `rejectBody` en las acciones (400) → normalización o recorte en `preValidation` → JSON Schema de `params`, `body` y
  `querystring` (400) → existencia (404) → unicidad del email (409, por el índice) → retención y puerto (500 y
  `ROLLBACK` si fallan). Todo lo posterior al esquema, dentro de `withTransaction`.
- **`details` acotado (DEC-11.4 enmendado):** como mucho un elemento por campo declarado más uno para todas las claves
  no declaradas, que sale como `{ field: 'body' | 'querystring', message: 'Hay campos no permitidos.' }` sin nombrar
  ninguna. Los campos de solo lectura (`id`, `createdAt`, `consentGivenAt`, `consentVersion`, `consentWithdrawnAt`,
  `retentionEndsAt`; en `PATCH`, también `consent`) se declaran con `forbiddenFields` y salen con su nombre y «Campo no
  permitido.». Un solo lectura olvidado en el esquema saldría como «Hay campos no permitidos.».
- Códigos que emite: `VALIDATION_ERROR`, `NOT_FOUND`, `DUPLICATE` (409, DEC-07), `CROSS_SITE_REQUEST` (403, DEC-12, heredada
  por los `POST` de consentimiento), `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `BAD_REQUEST`, `INTERNAL_ERROR`. No
  emite `INVALID_TRANSITION`.
- Sin datos personales en logs ni errores: el logger no registra cuerpos y quita la query; ningún `message` ni `details`
  repite valores ni nombres de clave no declaradas; los 500 registran el objeto de error (los mensajes de SQLite de
  `CHECK` y `UNIQUE` llevan nombres de columna, no valores). Lo fija `apps/api/test/candidates/privacy-logs.test.ts`.

## Retención y puerto de procesos

- **Fórmula** (`retention.ts`, RN-07, RGPD §3): con `hasOpenApplication` → `null` («mientras dure el proceso»); si no, la más
  tardía de consentimiento vigente + 24 meses, `lastProcessClosedAt` + 6 meses y alta + 6 meses (solo si
  `!hadAnyApplication`). Las fechas de partida son el día natural de Europe/Madrid del instante UTC guardado
  (`madridCalendarDate`); `addMonthsClamped` toma el último día del mes si el día no existe (31/08 + 6 meses →
  28/02). Retirar aplica la fórmula aunque el resultado ya haya pasado.
- **Contrato del puerto:** `lastProcessClosedAt` no es `null` si `hadAnyApplication && !hasOpenApplication`.
  `computeRetentionEndsAt` lanza `Error` **solo si no aplica ningún plazo** (`apps/api/src/modules/candidates/retention.ts:69-77`); con
  otro plazo vigente, un puerto incoherente no se detecta.
- **`recalculateRetention(id)`** (en el servicio, se une a la transacción en curso) es el único escritor de
  `retention_ends_at` en el código de la API (`setRetention`); lo llaman `create`, `giveConsent` y `withdrawConsent`. El alta
  inserta con retención `NULL` y recalcula en la misma transacción, así que un fallo del puerto deshace también el
  alta. Editar nunca la recalcula (RN-10). El seed calcula con la misma función, pero escribe con `setRetention`
  sin pasar por el servicio.
- **Puerto** `CandidateProcessesPort.getProcesses(candidateId)`: síncrono, dentro de la transacción de quien lo llama.
  `buildApp` lo recibe como `candidateProcesses?` y usa `noCandidateProcesses` (`{ false, false, null }`). **Latente:**
  HU-04 aporta la implementación real desde `inscripciones` y llama a `recalculateRetention` al inscribir; HU-05 lo hace
  al cerrar. Dobles de test: `createProcessesStub({ processes, fail })` en `apps/api/test/helpers/candidates.ts`.

## Listado y búsqueda

`GET /api/candidates` filtra en Y con una sola sentencia preparada (`FILTER_SQL` de `repository.ts`):
`instr(fold_search(full_name), :q) > 0 OR instr(email, :q) > 0` y
`EXISTS (SELECT 1 FROM json_each(candidates.skills) WHERE value = :skill)`. El servicio pliega `q` con `foldSearchText` y
pasa la skill a minúsculas; `instr` es literal (`%`, `_` y `\` no son comodines) y el email, que ya es ASCII en minúsculas, no
necesita `fold_search`. Orden `created_at DESC, id DESC`, `LIMIT`/`OFFSET`, `total` con el mismo `WHERE` y solo las 4
columnas del elemento (sin `SELECT *`).

## Convenciones del módulo

- Capas `routes` → `service` → `repository`; el servicio lanza `AppError` y nunca construye respuestas (DEC-06).
- Alta y edición normalizan en `preValidation` (`normalizeCandidateBody`), no en el servicio: el esquema valida lo que se
  guardará y sigue siendo la única fuente del 400.
- La unicidad del email la decide el índice: el servicio captura el `UNIQUE` (`isDuplicateEmailError`) y consulta
  `findIdByEmail` en la misma transacción; no hay `SELECT` previo.
- `UPDATE` con lista fija de 5 columnas (`full_name`, `email`, `phone`, `summary`, `skills`); la retención y el
  consentimiento solo cambian por sus propias rutas.
- El listado devuelve solo los 4 campos de `CandidateListItem`; la ficha completa solo sale en `GET /:id` y en las
  respuestas de alta, edición y consentimiento.
- Los solo lectura del esquema se declaran con `forbiddenFields` para que `details` los nombre (DEC-11.4).
- Datos personales: nunca en la URL, el título del documento, `history.state`, el almacenamiento del navegador ni los
  logs; formularios y búsqueda con `autoComplete="off"`; seed, fixtures y tests con `@example.com`.
- Los textos libres (nombre, resumen, skills) se pintan como texto JSX, nunca como HTML.

## Gotchas

- **El foco movido por un efecto pasivo se aserta con `expectFocusOn`** (`apps/web/test/helpers/focus.ts`): un `findBy*`
  puede resolver antes de que corra el efecto que mueve el foco o recarga la ficha, y con la CPU cargada el test fallaba a veces
  (2 tests de ofertas en la integración previa a T-03). Espera por el estado final, sin tiempos fijos ni timeouts
  más largos (review §7, T-03).
- **El tsconfig de `e2e/` no incluye `dom`:** `history`, `document` o `window` no existen como tipos. Usa locators de
  Playwright o un cast mínimo de `globalThis` dentro de `page.evaluate` (`e2e/candidates-list.spec.ts`).
- **`list-state.ts` sobrevive entre tests:** es una variable del módulo. Cada test del listado hace
  `saveListState(INITIAL_LIST_QUERY)` en `beforeEach`; sin eso, una búsqueda se filtra al test siguiente.
- **Prettier alarga los tests:** el límite de 300 líneas se mide **después de formatear**. `apps/web/test/features/candidates/api.test.ts`
  pasó a 327 y se partió en `api.errors.test.ts` (review §6).
- **El alta escribe `retention_ends_at` (por `recalculateRetention`)**, así que un trigger `failWrites(db, 'UPDATE', { table:
  'candidates', column: 'retention_ends_at' })` debe crearse **después** de dar de alta al candidato del test; antes, el
  propio alta fallaría (`apps/api/test/candidates/consent-adversarial.test.ts`).
- **Las fechas del seed son relativas al reset:** los e2e crean sus propios candidatos con nombres únicos y solo usan el seed
  para «hay al menos 30»; ninguna aserción fija fechas absolutas del seed.
- **Un puerto de procesos incoherente solo da error si no aplica ningún plazo:** con consentimiento vigente (+ 24 meses) la
  incoherencia pasa sin avisar (DD-01 de la review).
- **`isDuplicateEmailError` mira el texto de SQLite:** `errcode === 2067` y `candidates.email` en el mensaje; tras el
  fallo, la transacción sigue abierta (comprobado en Node 24) y el ID del existente es coherente. Lo fijan CA-05 y CA-12.

## Deuda técnica

Observaciones aceptadas de la review de HU-03 (§9) y avisos para HU-04.

| Deuda | Estado | Origen |
|---|---|---|
| Sin lista de `Host` en `apps/api/src/http/cross-site.ts:22`: un DNS rebinding llegaría como `same-origin`; ahora expone también candidatos | Abierta (teórica; auditoría de sprint) | SEC-06 · HU-03 §9.1 |
| `NO_CONTROL_CHARS` no cubre `\p{Cf}` (RLO, ZWSP) en nombre y skills (`apps/api/src/modules/candidates/schemas.ts`): solo suplantación visual, React escapa | Abierta | SEC-07 · §9.2 |
| Teléfonos del seed y de los tests con formato de móvil (`+34 600 111 2xx`), no la serie `+34 600 000 0xx` de `docs/RGPD.md` §6 | Abierta: se unifica en HU-04 | DP-02 · §9.3 |
| Un `path` con texto libre que da 400 queda en el log (`apps/api/src/logger.ts`) | Abierta (residual) | DP-03 · §9.4 |
| La edición no fija su título («Editar candidato · ATS») durante la carga directa: hasta que carga, queda el título anterior | Abierta | DD-06 · §9.5 |
| El TD-frontend de HU-03 no lista `consent.test.ts`, `isValidId` ni `gone?` (anotado en las tareas) | Aceptada | DD-07 · §9.6 |
| Candidatos con la retención vencida siguen en el listado sin marca, hasta la feature A | Abierta (decisión del responsable) | §9.8 |
| `apps/web/src/features/candidates/CandidateFormScreen.tsx` tiene una copia local de `CandidateNotFound` además de la de `CandidateDetailScreen.tsx` | Abierta (trivial): se quita en HU-04 si se toca esa pantalla | `/module-sync` de HU-03 |
| Redacción de UC-11 sobre «elegir una skill» (la web es un campo de texto) | **Cerrada** en este sync | DD-09 · §9.7 |
| `CONSENT_VERSION` (web) y `CONSENT_TEXT_VERSION` (API) son dos constantes sin test que las ate (hoy solo las compara el e2e del alta) | Aviso para HU-04: añade el test que las ata | Review §9, avisos |
| `CandidateProcessesPort` sin implementación real: HU-04 la conecta y recalcula la retención al inscribir | Aviso para HU-04 | Review §9, avisos |

## Requisitos no funcionales

| RNF | Métrica | Test |
|---|---|---|
| Lecturas | `GET /api/candidates` (con `q` y skill) y `/:id` < 200 ms con 1 000 candidatos (`inject`, local) | `apps/api/test/candidates/performance.test.ts` |
| Acciones | Alta, edición y cambios de consentimiento < 500 ms con 1 000 candidatos | `apps/api/test/candidates/performance.test.ts` |
| Logs y errores | 0 apariciones de nombre, email, teléfono, resumen o `q` | `apps/api/test/candidates/privacy-logs.test.ts` |
| Minimización | Cada elemento del listado con exactamente 4 campos | `apps/api/test/candidates/list.test.ts` |
| `details` acotado | ≤ 1 elemento por campo del esquema + 1; 1 000 claves desconocidas dan uno | `apps/api/test/http/error-details.test.ts` · `apps/api/test/candidates/create-adversarial.test.ts` |
| HTML | Nombre, resumen y skills siempre como texto | `apps/web/test/features/candidates/CandidateDetailScreen.adversarial.test.tsx` |
| Navegador | Sin nombre, email ni `q` en `document.title` ni en la URL | `apps/web/test/features/candidates/CandidateListScreen.adversarial.test.tsx` · `e2e/candidates-list.spec.ts` |
| Accesibilidad | Controles con `<label>`; estados con `role="status"` / `"alert"`; diálogo con foco atrapado | Tests de `apps/web/test/features/candidates/` · `e2e/candidates.spec.ts` |
