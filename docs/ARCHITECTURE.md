# Arquitectura del ATS

Backbone corto del ATS de ejemplo. Las decisiones que lo fijan están en
[DECISIONS.md](07_architecture_principles/DECISIONS.md); el detalle de cada módulo, en `docs/05_modules/{módulo}/`
(lo crea `/module-sync` con la primera HU de cada módulo).

## Qué es

Un **ATS** (*applicant tracking system*) mínimo para un equipo de selección: publicar ofertas, dar de alta candidatos,
inscribirlos en ofertas y moverlos por las etapas del proceso. Lo usa un único rol, el **reclutador**, sin login
(DEC-04). Todos los datos son inventados.

## Piezas

```
navegador ──► apps/web (React + Vite, :5173) ──/api (proxy de Vite)──► apps/api (Fastify, :3001) ──► data/ats.db (node:sqlite)
                                                                         ▲
e2e/ (Playwright, Chromium) ── levanta api :3101 + web :5174 ────────────┘   (con data/e2e.db regenerada)
```

| Pieza | Ruta | Responsabilidad |
|---|---|---|
| API | `apps/api/src/` | Rutas REST bajo `/api`, validación con JSON Schema, reglas de negocio y acceso a datos |
| Arranque de la API | `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/listen-options.ts` | `buildApp({ db, logger?, now?, jobApplications?, candidateProcesses?, jobStatus? })` para tests (`fastify.inject`) y **único punto de composición**: crea cada repositorio y servicio, conecta los puertos entre módulos y registra los plugins. Los tres últimos son los puertos: los tres usan por defecto las implementaciones reales (`jobApplications`, de `jobs` hacia `inscripciones`, desde HU-06) y solo se inyectan en tests; `server.ts` escucha donde dice `listen-options.ts` (`127.0.0.1:3001` salvo `API_HOST`/`API_PORT`) |
| Errores y validación | `apps/api/src/http/`, `apps/api/src/errors.ts` | Manejador único del envelope, opciones de Ajv, recorte previo, `rejectBody` para las acciones sin cuerpo y `forbiddenFields` para nombrar los campos de solo lectura (DEC-11); `AppError` de los servicios |
| Guarda entre sitios | `apps/api/src/http/cross-site.ts` | Hook `onRequest` global: 403 `CROSS_SITE_REQUEST` a toda petición que no sea `GET`, `HEAD` ni `OPTIONS` si `Sec-Fetch-Site` no es `same-origin` ni `none` (DEC-12) |
| Búsqueda de texto | `apps/api/src/db/text-search.ts` | `foldSearchText` y la función SQL `fold_search`, que cada repositorio registra en su conexión: búsqueda sin mayúsculas ni tildes (DEC-10) |
| Reloj y transacciones | `apps/api/src/clock.ts`, `apps/api/src/db/transaction.ts` | `Clock` inyectado (DEC-09) y `withTransaction`, que se une a una en curso (DEC-06) |
| Base de datos | `apps/api/src/db/` | `connection.ts` (con `PRAGMA foreign_keys = ON`), `schema.sql`, `migrations/` (`001-create-job-openings.sql`, `002-create-candidates.sql`, `003-create-applications.sql`), `migrate.ts`, `seed.ts` (10 ofertas), `seed-candidates.ts` (30 candidatos, fechas relativas al reset) y `seed-applications.ts` (40 inscripciones con su historial; las de las ofertas publicadas son relativas al reset y las de las cerradas, fijas), `reset.ts` |
| Web | `apps/web/src/` | Pantallas por feature; router y cliente HTTP propios y componentes compartidos en `apps/web/src/components/`: `Pagination`, `PageSizeSelect`, `list-controls`, `form-errors`, `use-document-title`, `use-lifetime-signal`, `ConfirmDialog`, `FormField`, `StatusMessages`; las rutas, en la tabla `ROUTES` de `App.tsx` |
| E2E | `e2e/` | Smokes y flujos en Chromium, en los puertos 3101 (API) y 5174 (web) sobre `data/e2e.db`, que el `webServer` regenera en cada ejecución |
| Scripts | `scripts/` | Node sin dependencias: `dev` (API y web), `check-env` (portátil listo), `next-id` (IDs), `integrate` (verificación completa en serie, con logs), `check-harness` (kit SDD completo), `check-passive-effects` (aserciones sobre efectos pasivos), `check-machine-paths` (rutas con nombre de usuario), `check-clean` con `check-clean-identities` (términos prohibidos, identidades y la puerta `--publish`) y `publish-markers` (marcadores pendientes). `integrate`, `check-passive-effects`, `check-machine-paths` y `check-clean` se prueban a sí mismos con casos fijos (desde `npm run check:harness`) |

## Módulos

| Módulo (docs) | Código API | Código web | Entidades |
|---|---|---|---|
| ofertas | `apps/api/src/modules/jobs/` | `apps/web/src/features/jobs/` | `JobOpening` (`draft` → `published` → `closed`) |
| candidatos | `apps/api/src/modules/candidates/` | `apps/web/src/features/candidates/` | `Candidate` (contacto, resumen, skills, consentimiento, fin de retención) |
| inscripciones | `apps/api/src/modules/applications/` | `apps/web/src/features/applications/` | `Application` (`received → screening → interview → offer → hired \| rejected`), `StageChange` |

Las carpetas de módulo se crean con la primera HU que las necesite; hoy existen `jobs`, `candidates` y `applications`
(`docs/05_modules/ofertas/`, `docs/05_modules/candidatos/` y `docs/05_modules/inscripciones/` tienen su `functional.md` y
su `technical.md`). El mapa vivo está en [_modules.md](_modules.md).

**Módulos y puertos (DEC-06, aclarada en HU-04 y HU-06):** ningún módulo importa a otro, **ni siquiera sus tipos**. La dirección
de las llamadas es `ofertas → inscripciones → candidatos` y la compone `apps/api/src/app.ts`. Lo que un módulo necesita de
otro lo define él como un puerto y lo implementa el módulo que tiene los datos, que cumple la forma del puerto por tipado
estructural; `buildApp` lo conecta y la propia asignación lo comprueba al compilar (una forma desfasada no compila).
`apps/api/test/module-boundaries.test.ts` falla si aparece un `import` entre módulos o SQL sobre tablas ajenas.

| Puerto | Lo define | Lo implementa | Estado |
|---|---|---|---|
| `JobStatusPort` (estado de una oferta) | `applications` | `jobs` (`job-status.ts`) | Real (HU-04) |
| `CandidateLookupPort` (¿existe? y nombres) | `applications` | `candidates` (`exists`, `findNames`) | Real (HU-04) |
| `CandidateProcessesPort` (procesos del candidato) | `candidates` | `applications` (`candidate-processes.ts`) | Real (HU-04); el stub `noCandidateProcesses` solo para tests y el seed de candidatos |
| `JobApplicationsPort` (contar y rechazar inscripciones activas) | `jobs` | `applications` (`job-closing.ts`) | Real (HU-06); el stub `noJobApplications` solo para tests |

**Integridad de la base entre módulos:** las claves foráneas entre tablas de módulos distintos (`applications.candidate_id →
candidates.id` y `applications.job_id → job_openings.id`, ambas `ON DELETE RESTRICT`) son integridad referencial de la
base, no un acoplamiento de código: las declara la migración del módulo dueño de la tabla que referencia (`003`) y no
autorizan a ningún módulo a leer ni escribir con SQL las tablas de otro. La operación que cruza módulos va en **una**
transacción (`withTransaction`), que se une a la que ya esté abierta.

## Convenciones

- **Capas en la API, por módulo:** `routes.ts` (rutas y JSON Schema) → `service.ts` (reglas de negocio) →
  `repository.ts` (SQL con sentencias preparadas). Las rutas no tocan SQL; los repositorios no conocen HTTP.
- **Errores:** envelope uniforme `{ error: { code, message, details? } }` con códigos estables: los de DEC-07
  (`VALIDATION_ERROR`, `NOT_FOUND`, `DUPLICATE`, `INVALID_TRANSITION`, `STAGE_MISMATCH`…) y los de DEC-11
  (`INTERNAL_ERROR`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `BAD_REQUEST`) y el de DEC-12
  (`CROSS_SITE_REQUEST`, 403). Nunca *stack traces* ni datos personales en la respuesta. `details` va acotado al esquema
  (DEC-11.4): las claves no declaradas salen agrupadas en un solo elemento `body` o `querystring` y sin nombre, y el 409
  `DUPLICATE` lleva `existingId` con el ID del existente, nunca su email ni otro dato.
- **Fechas:** ISO 8601 en UTC (`2026-10-22T09:30:00.000Z`) en la API y en SQLite; la web las muestra en Europe/Madrid
  como `dd/mm/aaaa`. La fecha de fin de retención es un día natural `AAAA-MM-DD` de Europe/Madrid.
- **IDs:** enteros autoincrementales de SQLite.
- **Esquema:** cada cambio de modelo es una migración nueva en `apps/api/src/db/migrations/` (DEC-03).
- **Web:** una carpeta por feature con sus componentes, su cliente de API y sus tests; los componentes reutilizables,
  en `apps/web/src/components/`. Accesibilidad: roles y etiquetas que Testing Library y Playwright usan como selectores.
  Una pantalla con datos personales (candidatos, pipeline de inscripciones) no los pone en la URL, en `document.title` ni
  en `history.state`: la ruta lleva solo el ID, el título es fijo y los filtros del listado o la búsqueda del panel de
  inscribir viven en memoria. Las features siguen la misma dirección que la API (`jobs → applications → candidates`) y
  `App.tsx` es su punto de composición.
- **Datos personales:** se tratan según [RGPD.md](RGPD.md): minimización, retención y supresión.

### Convenciones del repo

Patrones que se repiten en todo el código y que un cambio nuevo sigue. Cada uno lleva un ejemplo. Decididos por el
responsable técnico el 2026-10-09 (T-10 del sprint-02, a partir de la auditoría del sprint-01 y del module-sync de
HU-04).

**API**

- **Factorías cortas.** Un repositorio o un servicio se compone de piezas pequeñas: los casos de uso son funciones del
  módulo que reciben sus dependencias, y los grupos de métodos afines son funciones `createXOperations` /
  `createXQueries` que la factoría exportada compone con *spread*. La frontera transaccional queda a la vista en el
  objeto que devuelve la factoría. Ejemplos: `apps/api/src/modules/applications/service.ts:232` (servicio) y
  `apps/api/src/modules/jobs/repository.ts:97` y `:183` (repositorio). Lo vigila `npm run lint`
  (`max-lines-per-function`, 50 líneas; [QUALITY-GATES.md](07_architecture_principles/QUALITY-GATES.md) §2).
- **Mensajes en constantes `*_MESSAGE`.** Cada texto de error del servicio se declara una vez, como constante, y se
  reutiliza en cada `throw`. Ejemplo: `apps/api/src/modules/applications/service.ts:72-74`.
- **`requireX` para «existe o 404».** Un helper por entidad que lee la fila o lanza `notFound` con su mensaje, en lugar
  de repetir la comprobación en cada caso de uso. Ejemplos: `apps/api/src/modules/jobs/service.ts:67` y
  `apps/api/src/modules/candidates/service.ts:84`.

**Datos y consistencia**

- **Una sola `withTransaction` por operación que cruza módulos.** La guarda del puerto, las escrituras, el
  `StageChange` y el recálculo de la retención van juntos: si falla uno, no queda nada. Ejemplo: inscribir,
  `apps/api/src/modules/applications/service.ts:234` (`deps.transaction(() => enroll(deps, input))`, con
  `withTransaction` de `apps/api/src/db/transaction.ts:8`).
- **El índice único decide el duplicado**, sin `SELECT` previo: se inserta y se traduce el choque del índice en 409
  `DUPLICATE` con el ID existente. Así dos peticiones a la vez no pueden colarse entre la comprobación y el `INSERT`.
  Ejemplo: `apps/api/src/db/migrations/003-create-applications.sql:12` (índice) y
  `apps/api/src/modules/applications/service.ts:99-120` (traducción).
- **Los puertos leen con columnas explícitas.** Lo que un módulo lee de otro pasa por un puerto con las columnas que
  necesita, nunca `SELECT *` ni SQL sobre tablas ajenas. Ejemplo: `findNamesByIds`,
  `apps/api/src/modules/candidates/repository.ts:97` (`SELECT id, full_name`).
- **Lo que decide el servidor no llega del cliente.** La etapa con la que nace una inscripción, las fechas
  (`createdAt`, `changedAt`, `lastChangeAt`) y el `StageChange` inicial los pone el servidor; el esquema de la petición
  ni siquiera los admite. Ejemplo: el cuerpo de inscribir solo acepta `jobId` y `candidateId`, con
  `additionalProperties: false` (`apps/api/src/modules/applications/schemas.ts:28-30`), y la fecha sale de `deps.now()`
  (`apps/api/src/modules/applications/service.ts:124`).
- **La guarda de estado va en el `WHERE`, y 0 filas es un 409.** El `UPDATE` solo toca la fila si sigue en el estado
  esperado; si no actualiza ninguna, alguien llegó antes y se responde 409, sin leer y escribir por separado. Ejemplo:
  `apps/api/src/modules/applications/repository.ts:101-102` (`WHERE id = ? AND stage = ?`) y
  `apps/api/src/modules/applications/service.ts:163` (`undefined` → `STAGE_MISMATCH`).

**Web**

- **Guardas `isX(value): value is X` en cada `api.ts`.** La web no se fía de la forma de la respuesta: cada cliente
  comprueba lo que recibe antes de usarlo. Ejemplo: `apps/web/src/features/applications/api.ts:48` (`isPipeline`).
- **Un hook `use-*-actions.ts` por pantalla con escrituras.** Las acciones (publicar, cerrar, borrar…) con su estado de
  envío, sus errores y el foco viven en un hook, y la pantalla solo los pinta. Ejemplo:
  `apps/web/src/features/jobs/use-job-actions.ts:77`.

**Tests**

- **Ficheros hermanos antes de pasar de 300 líneas.** Cuando un fichero de test crece, se parte por intención: los casos
  hostiles en `*.adversarial.test.*` y los datos y montajes comunes en `*-fixtures.ts`. Ejemplo:
  `apps/web/test/features/applications/PipelineScreen.adversarial.test.tsx` y
  `apps/web/test/features/applications/reject-fixtures.ts`.
