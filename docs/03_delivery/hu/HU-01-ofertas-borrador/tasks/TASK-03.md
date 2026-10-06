# TASK-03 — Alta de borradores: `POST /api/jobs`

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** backend
- **Estado:** Completada
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Nace el módulo `jobs` (`apps/api/src/modules/jobs/`) con las capas de `docs/ARCHITECTURE.md` (`routes.ts` →
`service.ts` → `repository.ts`) y su primer endpoint: `POST /api/jobs` crea un borrador. Rebanada completa: JSON Schema
del cuerpo y de la respuesta, recorte previo (`preValidation`), regla mínimo ≤ máximo en el servicio, `INSERT …
RETURNING *` con sentencia preparada, composición en `buildApp` y tests con `app.inject` del camino feliz y de los
criterios de validación (CA-01 a CA-07). Los casos hostiles (cuerpo no JSON, campos de solo lectura, fallo de SQLite,
inyección, salario no entero, cuerpos enormes) van en TASK-06.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/jobs/schemas.ts` | crear | Tipos `Job`, `JobInput`, `JobPatch`, `JobListItem`, `JobPage`; JSON Schema `JobFields`, `Job` y cuerpo del alta |
| `apps/api/src/modules/jobs/repository.ts` | crear | `createJobsRepository(db)` con `toJob(row)` e `insert(input, createdAt)` |
| `apps/api/src/modules/jobs/service.ts` | crear | `createJobsService({ repository, now, transaction })` con `create` y `assertSalaryRange` |
| `apps/api/src/modules/jobs/routes.ts` | crear | `jobsRoutes: FastifyPluginAsync<{ service: JobsService }>` con `POST /` |
| `apps/api/src/app.ts` | modificar | Crea repositorio y servicio y registra `jobsRoutes` con prefijo `/api/jobs` |
| `apps/api/test/helpers/test-app.ts` | modificar | Añade `createJob(app, body)` (`POST /api/jobs` → `Job`) |
| `apps/api/test/jobs/create.test.ts` | crear | Tests del alta (camino feliz y CA) |

## Implementa
- RF: RF-01, RF-02 · CA: CA-01 (parte API; el «aparece en el listado» lo añade TASK-04), CA-02, CA-03, CA-04, CA-05,
  CA-06, CA-07 (mínimo > máximo y EC-13) · Edge cases: EC-03, EC-04, EC-06, EC-09, EC-10, EC-12, EC-13
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (Convenciones, Esquemas compartidos, Endpoints › `POST`),
  § Firmas internas, § Diagrama de secuencia RF-01 y RF-02, DD-01, DD-04, DD-09, DD-12

## Dependencias
- **Depende de:** TASK-02
- **Bloquea:** TASK-04

## Criterios de done
- [ ] `POST /api/jobs` con solo el título responde 201 con la oferta en `draft`, `createdAt` = instante del reloj
      inyectado (ISO con milisegundos) y los opcionales a `null` (CA-01).
- [ ] Recorta los textos y guarda todos los campos de CA-02; descripción y ubicación vacías o de espacios quedan `null`.
- [ ] Fronteras de CA-03, CA-04 y CA-06 y modalidades de CA-05: 400 con el campo en `details` y **0 filas**, o 201.
- [ ] Mínimo 45 000 y máximo 40 000 → 400 con `details: [{ field: "salaryMin", message: "El salario mínimo no puede
      ser mayor que el máximo." }]`; solo mínimo, solo máximo e iguales → 201 (CA-07, EC-13).
- [ ] `npm test -w apps/api -- create health` en verde, con **2** ficheros de test ejecutados.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/jobs apps/api/src/app.ts apps/api/test/helpers/test-app.ts apps/api/test/jobs/create.test.ts`
      sin errores.
- [ ] Ficheros ≤ 300 líneas y funciones ≤ 50 líneas.
- [ ] Commit único `feat(jobs): create draft job openings via POST /api/jobs [HU-01 TASK-03]` nombrando los ficheros.

## Notas de implementación

**Convenciones del contrato:**
- JSON UTF-8; `POST` lleva `Content-Type: application/json`.
- Longitudes en **puntos de código** (Ajv `unicode: true` y `length()` de SQLite). En los tests, fronteras con
  `'a'.repeat(n)` y `'🎨'.repeat(n)`.
- **Recorte previo** en un hook `preValidation` de la ruta: `trimTextFields(request.body, { trim: ['title',
  'description', 'location'], emptyToNull: ['description', 'location'] })` (de `apps/api/src/http/validation.ts`).
  `title` no se convierte a `null` (un `""` lo rechaza `minLength`). `workMode` y los salarios **no** se tocan: solo
  valen los literales exactos (`" híbrida"` o `"hibrida"` dan 400). Documenta el recorte junto al `preValidation`.
- **Orden de comprobación:** JSON Schema (400) → reglas del servicio (400).
- Fechas: `now().toISOString()` (p. ej. `2026-10-06T22:30:00.000Z`).

**Esquemas** (`schemas.ts`):

```json
"JobFields": {
  "title":       { "type": "string",            "minLength": 3, "maxLength": 120 },
  "description": { "type": ["string", "null"],  "maxLength": 5000 },
  "location":    { "type": ["string", "null"],  "minLength": 2, "maxLength": 120 },
  "workMode":    { "type": ["string", "null"],  "enum": ["presencial", "híbrida", "remota", null] },
  "salaryMin":   { "type": ["integer", "null"], "exclusiveMinimum": 0, "maximum": 9007199254740991 },
  "salaryMax":   { "type": ["integer", "null"], "exclusiveMinimum": 0, "maximum": 9007199254740991 }
}
"Job": { "type": "object", "additionalProperties": false,
  "required": ["id","title","description","location","workMode","salaryMin","salaryMax","status","createdAt","publishedAt","closedAt"],
  "properties": { "id": { "type": "integer" }, "...JobFields": "con los mismos tipos (salida)",
    "status": { "type": "string", "enum": ["draft","published","closed"] },
    "createdAt": { "type": "string" }, "publishedAt": { "type": ["string","null"] }, "closedAt": { "type": ["string","null"] } } }
```

- Cuerpo del alta: `{ type: "object", additionalProperties: false, required: ["title"], properties: JobFields }`.
- Respuesta: `response: { 201: Job }` (el esquema de respuesta filtra cualquier campo extra).
- Los opcionales sin valor se devuelven como `null`, **nunca ausentes**. `publishedAt` y `closedAt` son siempre `null`
  en esta HU, pero van ya en el contrato.
- `maximum: 9007199254740991` (DD-12): sin él, `1e300` llegaría a SQLite como `REAL`, fallaría el `CHECK` y daría 500.
- Define ya todos los tipos TS (`Job`, `JobInput`, `JobPatch`, `JobListItem`, `JobPage`); los JSON Schema de listado y
  de edición los añaden TASK-04 y TASK-05.

**Repositorio** (`createJobsRepository(db)`): solo sentencias preparadas de `node:sqlite` (nunca concatenar entrada).
`insert(input, createdAt)` hace `INSERT INTO job_openings (title, description, location, work_mode, salary_min,
salary_max, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?) RETURNING *` y devuelve `toJob(row)`.
`toJob` mapea `snake_case` → `camelCase` (`work_mode` → `workMode`, `created_at` → `createdAt`, etc.).

**Servicio** (firma final del diseño; en esta tarea solo `create`, TASK-04 y TASK-05 completan el resto):

```ts
export interface JobsService {
  create(input: JobInput): Job;
  get(id: number): Job;                    // NOT_FOUND (TASK-04)
  update(id: number, patch: JobPatch): Job; // NOT_FOUND, VALIDATION_ERROR (TASK-05)
  remove(id: number): void;                 // NOT_FOUND (TASK-05)
  list(): JobPage;                          // (TASK-04)
}
```

- `createJobsService({ repository, now, transaction })`: `now` es el `Clock` de `buildApp`; `transaction` es
  `(fn) => withTransaction(db, fn)`. Nada de singletons (DD-09): todo se compone en `buildApp`.
- `assertSalaryRange(min, max)`: si vienen los dos y `min > max`, lanza `validationError([{ field: 'salaryMin',
  message: 'El salario mínimo no puede ser mayor que el máximo.' }])`. El servicio no conoce `request` ni `reply` y no
  construye respuestas de error: lanza `AppError` (DD-10).
- `status` y `created_at` solo los fija el servicio.

**Rutas**: `app.register(jobsRoutes, { prefix: '/api/jobs', service })` en `buildApp`, **después** de
`registerErrorHandling(app)`. Sin `try/catch` en las rutas. `reply.code(201)`.

**Ejemplo** `POST /api/jobs` con `{ "title": "  Técnica/o de selección  ", "workMode": "híbrida", "location":
"Valencia", "salaryMin": 32000, "salaryMax": 40000 }` → 201:

```json
{ "id": 5, "title": "Técnica/o de selección", "description": null, "location": "Valencia", "workMode": "híbrida",
  "salaryMin": 32000, "salaryMax": 40000, "status": "draft", "createdAt": "2026-10-06T22:30:00.000Z",
  "publishedAt": null, "closedAt": null }
```

**Tests** (`apps/api/test/jobs/create.test.ts`, con `createTestApp({ now })` y `createTestClock`; «no se crea nada» =
`SELECT COUNT(*) FROM job_openings` sigue a 0):
- «CA-01 solo el título → 201 en draft con createdAt del reloj» (título «Desarrollador/a backend (Node.js)»).
- «CA-02/EC-03 recorta y guarda todos los campos».
- «RF-01 descripción y ubicación vacías o de espacios se guardan como null».
- «EC-04 tildes, eñes y emoji; cuenta caracteres, no bytes» («Diseñador/a UX 🎨»; 120 emojis → 201, 121 → 400).
- «EC-06/EC-09 dos POST iguales crean dos borradores» (IDs distintos; DT-03: sin clave natural no hay idempotencia).
- «CA-03/CA-04/CA-06 fronteras de longitud» (`it.each`): título ausente, `"   "`, 2 y 121 → 400 en `title`; 3 y 120 →
  201; descripción 5 000 → 201 y 5 001 → 400; ubicación 1 y 121 tras recortar → 400, 2 y 120 → 201.
- «CA-05/EC-10 modalidad fuera de los literales → 400; los tres se aceptan» («teletrabajo», «Híbrida», «hibrida» →
  400 en `workMode`).
- «CA-07/EC-13 solo mínimo, solo máximo o iguales → 201» y «CA-07 mínimo mayor que el máximo → 400 en salaryMin».

Mensajes esperados (de TASK-01): título de 2 → «Debe tener al menos 3 caracteres.»; modalidad → «Debe ser uno de estos
valores: presencial, híbrida, remota.».

## Reapertura · review ronda 1 (2026-10-06)
- **Origen:** `review/REVIEW-ronda-1.md` (ronda 1, `VERDICT: Requiere cambios`), §9.
- **Qué hay que hacer:** EC-50 (nuevo en el PRD v1.1, DT-05; regla común en DEC-11 punto 8): rechazar con 400 `VALIDATION_ERROR` los caracteres de control C0 (U+0000-U+001F) y DEL (U+007F) en `title` y `location`, y en `description` todos salvo `\n`, `\r` y `\t`, en el alta y en la edición, sin guardar nada. Hazlo en el JSON Schema (`pattern` en `JobFields` de `apps/api/src/modules/jobs/schemas.ts`; Ajv con `unicode`), de forma que `details` lleve el campo y el mensaje de *keyword* `pattern` («Formato no válido.»), o con un mensaje propio si lo justificas. Reutilizable por candidatos (exporta los patrones desde `apps/api/src/http/validation.ts` si encaja). Tests en un fichero nuevo `apps/api/test/jobs/control-chars.test.ts`, con nombres «EC-50»: NUL al principio, en medio y al final; U+0001, U+001F y U+007F; tabulador y salto de línea en la descripción aceptados y en el título rechazados; alta y edición; y que tras cada rechazo no hay filas nuevas ni cambios.
- **Ficheros:** `apps/api/src/modules/jobs/schemas.ts`, `apps/api/src/http/validation.ts` (si exportas los patrones), `apps/api/test/jobs/control-chars.test.ts` (crear)
- **Criterios de done:** `npm test -w apps/api` completo en verde; `npm test -w apps/api -- control-chars` con 1 fichero; `npm run typecheck`; `npx eslint` de los ficheros tocados; repetir la sonda: `"a\u0000bcdef"` → 400.
