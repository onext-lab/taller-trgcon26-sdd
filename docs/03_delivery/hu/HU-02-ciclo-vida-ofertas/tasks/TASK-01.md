# TASK-01 — Base de la API para el ciclo de vida: escrituras entre sitios (DEC-12), puerto de inscripciones y seed de 10 ofertas [setup]

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (prepara RF-01 a RF-04; incluye RF-07, Should)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
Piezas transversales que usan las tareas siguientes de la API, más el seed nuevo:
1. **409 de estado:** `invalidTransition(message)` en `errors.ts`.
2. **Acciones sin cuerpo:** hook `rejectBody` en `http/validation.ts` (lo usan las rutas de TASK-02; sus tests van en
   TASK-02 y TASK-04).
3. **Escrituras entre sitios (DEC-12):** hook `onRequest` global `registerCrossSiteGuard(app)` en `http/cross-site.ts`,
   registrado en `buildApp` antes de cualquier ruta, con su test sobre las escrituras que ya existen (las de HU-01).
   Las filas de las rutas nuevas las añade TASK-04.
4. **Puerto hacia `inscripciones`:** `JobApplicationsPort` + `noJobApplications` (*stub*: 0 y no hace nada), opción
   `jobApplications` en `AppOptions` y dependencia `applications` del servicio (aún sin usar; la usa TASK-02).
5. **Transiciones en el repositorio:** `markPublished` y `markClosed` con guarda de estado en el `UPDATE`.
6. **Seed (RF-07):** +6 ofertas inventadas (4 `published`, 2 `closed`) con `insert` → `markPublished` → `markClosed`, y
   su test (CA-24).
7. **Helpers de test:** `createTestApp({ now, jobApplications })` y `createApplicationsSpy`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/errors.ts` | modificar | `invalidTransition(message)` → `AppError('INVALID_TRANSITION', 409, message)`, sin `details` |
| `apps/api/src/http/validation.ts` | modificar | `rejectBody` (hook `preValidation`) |
| `apps/api/src/http/cross-site.ts` | crear | `registerCrossSiteGuard(app)` (hook `onRequest`, DEC-12) |
| `apps/api/src/modules/jobs/applications-port.ts` | crear | `JobApplicationsPort` y `noJobApplications` |
| `apps/api/src/app.ts` | modificar | `registerCrossSiteGuard(app)` tras `registerErrorHandling(app)`; `jobApplications?` en `AppOptions` (por defecto `noJobApplications`) y `applications` al crear el servicio |
| `apps/api/src/modules/jobs/service.ts` | modificar | Solo `applications: JobApplicationsPort` en `JobsServiceDeps` (los métodos llegan en TASK-02) |
| `apps/api/src/modules/jobs/repository.ts` | modificar | `markPublished(id, publishedAt)` y `markClosed(id, closedAt)` |
| `apps/api/src/db/seed.ts` | modificar | +6 ofertas; `SEED_TITLES_IN_LIST_ORDER` por fecha de referencia |
| `apps/api/test/helpers/test-app.ts` | modificar | `createTestApp({ now?, jobApplications? })`, `createApplicationsSpy({ failOnReject? })` |
| `apps/api/test/http/cross-site.test.ts` | crear | EC-49 sobre las escrituras de HU-01 (hermano de `error-handler.test.ts`, que está a 299 líneas y no se toca) |
| `apps/api/test/jobs/seed.test.ts` | modificar | Se reescribe como CA-24 |

## Implementa
- RF: RF-07 (seed) · base de RF-01, RF-02 y RF-04 · DEC-12 · CA: CA-24 · Edge cases: EC-49 (rutas de HU-01)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico, § Contrato de API › Convenciones y tabla de errores
  (403, 409), § Firmas internas (`applications-port.ts`, `AppOptions`, `markPublished`/`markClosed`), § Migración de
  datos › Seed, DD-01, DD-03, DD-06, DD-08, DD-10, § Checklist pasos 1, 2 y 8

## Dependencias
- **Depende de:** nada
- **Bloquea:** TASK-02

## Criterios de done
- [ ] `POST /api/jobs`, `PATCH /api/jobs/:id` y `DELETE /api/jobs/:id` con `Sec-Fetch-Site: cross-site` → 403 con el
      cuerpo **exacto** `{ "error": { "code": "CROSS_SITE_REQUEST", "message": "Petición no permitida desde otro sitio." } }`
      y la base sin cambios (mismo número de filas; la oferta de `PATCH`/`DELETE` sigue igual) (EC-49).
- [ ] Las mismas escrituras con `same-origin`, `same-site`, `none` o sin la cabecera → su 2xx normal (201, 200, 204).
- [ ] `GET /api/jobs` y `GET /api/jobs/:id` con `cross-site` → 200.
- [ ] CA-24: tras `migrate` + `seed`, `GET /api/jobs` → `total` 10 (4 `draft`, 4 `published`, 2 `closed`), títulos en
      el orden de `SEED_TITLES_IN_LIST_ORDER`, todas cumplen RN-02 a RN-04, `publishedAt > createdAt` en las publicadas y
      cerradas, `closedAt > publishedAt` en las cerradas, y los borradores sin `publishedAt` ni `closedAt`.
- [ ] `npm run db:reset` termina sin errores.
- [ ] `npm test -w apps/api -- cross-site seed` en verde, con **2** ficheros de test ejecutados.
- [ ] `npm test -w apps/api` completo en verde (los tests de HU-01 siguen igual: `createTestApp()` sin argumentos sigue
      valiendo).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/errors.ts apps/api/src/http/validation.ts apps/api/src/http/cross-site.ts apps/api/src/modules/jobs/applications-port.ts apps/api/src/app.ts apps/api/src/modules/jobs/service.ts apps/api/src/modules/jobs/repository.ts apps/api/src/db/seed.ts apps/api/test/helpers/test-app.ts apps/api/test/http/cross-site.test.ts apps/api/test/jobs/seed.test.ts`
      sin errores.
- [ ] Commit único `feat(api): cross-site write guard, applications port and 10-offer seed [HU-02 TASK-01]` nombrando
      los ficheros.

## Notas de implementación

**Escrituras entre sitios** (DD-06, DEC-12). Hook `onRequest` (corre antes de parsear el cuerpo y de validar):

```ts
// apps/api/src/http/cross-site.ts
const WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE']);
export function registerCrossSiteGuard(app: FastifyInstance): void {
  app.addHook('onRequest', (request, _reply, done) => {
    if (WRITE_METHODS.has(request.method) && request.headers['sec-fetch-site'] === 'cross-site') {
      done(new AppError('CROSS_SITE_REQUEST', 403, 'Petición no permitida desde otro sitio.'));
      return;
    }
    done();
  });
}
```

- En `buildApp`: justo después de `registerErrorHandling(app)` y **antes** de `/api/health` y de `app.register(jobsRoutes…)`,
  para que lo hereden todas las rutas (las de HU-01 y las futuras).
- El 403 no lleva `details` ni datos de la petición. Lo traduce el manejador único (`AppError`).
- Sin la cabecera se deja pasar: `inject` no la envía y la web va por el *proxy* de Vite (`same-origin`).
- Test (`apps/api/test/http/cross-site.test.ts`), con `it.each` y `headers: { 'sec-fetch-site': … }` en `inject`:
  «EC-49 escritura cross-site → 403 y nada cambia» (aquí, solo `POST /api/jobs`, `PATCH /:id` y `DELETE /:id`; TASK-04
  añade publicar, cerrar y duplicar), «EC-49 same-origin, same-site, none o sin cabecera → 2xx» y «EC-49 GET cross-site
  → 200». Compara el envelope **completo**.

**`rejectBody`** (DD-01). Hook `preValidation` reutilizable:

```ts
export const rejectBody: preValidationHookHandler = (request, _reply, done) => {
  if (request.body !== undefined) {
    done(validationError([{ field: 'body', message: 'Esta acción no admite cuerpo.' }]));
    return;
  }
  done();
};
```

- Cualquier cuerpo (también `{}`, `null` o un texto) → 400. `Content-Type: application/json` sin cuerpo sigue dando el
  400 «El cuerpo de la petición no es JSON válido.» de HU-01; `x-www-form-urlencoded`/`multipart` → 415 (Fastify).
- Corre antes que el esquema de `params`: con ID inválido **y** cuerpo, `details` solo trae `body`.
- Aquí no hay ruta que lo use: se prueba en TASK-02 (sin cuerpo → 200) y TASK-04 (EC-01, EC-10).

**Puerto** (DD-03). Firma fija (HU-05 la implementa sin cambiarla):

```ts
// apps/api/src/modules/jobs/applications-port.ts
export interface JobApplicationsPort {
  /** Lectura (DT-01): inscripciones de la oferta en etapa no final. Síncrona. */
  countActiveApplications(jobId: number): number;
  /** Operación interna (DT-02, UC-19): se llama dentro de la transacción del cierre, después del UPDATE y solo en la
   *  transición real. Devuelve cuántas rechazó. Si lanza, se deshace todo. */
  rejectActiveApplications(input: { jobId: number; closedAt: string }): number;
}
export const noJobApplications: JobApplicationsPort = {
  countActiveApplications: () => 0,
  rejectActiveApplications: () => 0,
};
```

- `AppOptions` gana `jobApplications?: JobApplicationsPort`; `buildApp({ …, jobApplications = noJobApplications })`
  y `createJobsService({ repository, now, transaction, applications: jobApplications })`.
- `jobs` no importa nada de `applications` (DEC-06): HU-05 solo tocará `apps/api/src/app.ts`.

**Repositorio** (DD-08). Sentencias fijas, con guarda de estado:

```sql
UPDATE job_openings SET status = 'published', published_at = ? WHERE id = ? AND status = 'draft' RETURNING *;
UPDATE job_openings SET status = 'closed', closed_at = ? WHERE id = ? AND status = 'published' RETURNING *;
```

Las dos devuelven `Job | undefined` (sin fila → `undefined`).

**Seed** (DD-10, RF-07). Dentro del `withTransaction` que ya existe: `insert(input, createdAt)` → `markPublished(id,
publishedAt)` → `markClosed(id, closedAt)` según el caso. Fechas fijas, en UTC con `:00.000Z`:

| Título | Estado | Modalidad · ubicación | Banda (€/año) | `created_at` | `published_at` | `closed_at` |
|---|---|---|---|---|---|---|
| Desarrollador/a backend (Node.js) | `published` | `remota` · Málaga | 36 000-45 000 | 2026-09-29T09:00 | 2026-10-02T08:00 | — |
| Administrativo/a contable | `published` | `presencial` · Murcia | — | 2026-09-22T07:45 | 2026-09-25T10:15 | — |
| Técnico/a de selección de personal | `published` | `híbrida` · Valencia | 30 000-37 000 | 2026-09-17T10:00 | 2026-09-19T08:30 | — |
| Responsable de gestión de nóminas | `published` | `presencial` · Madrid | 38 000-46 000 | 2026-09-10T08:00 | 2026-09-12T09:00 | — |
| Becario/a de marketing digital | `closed` | `remota` · Barcelona | 12 000-14 000 | 2026-08-25T10:00 | 2026-08-27T08:00 | 2026-09-26T15:30 |
| Auxiliar de logística | `closed` | `presencial` · Getafe | — | 2026-08-18T08:00 | 2026-08-20T09:00 | 2026-09-15T16:00 |

- Cada una con una descripción **inventada** de 1-2 frases, sin personas ni empresas reales. Los 4 borradores de HU-01
  no cambian.
- `SEED_TITLES_IN_LIST_ORDER` se ordena por `publishedAt ?? createdAt` descendente. Resultado: Node.js, frontend
  (React), Diseñador/a, Administrativo/a, Soporte IT, Analista, Selección, Nóminas, Marketing, Logística.
- `seed.ts` queda por debajo de 300 líneas (~150).

**Helpers** (`apps/api/test/helpers/test-app.ts`):
- `createTestApp({ now?, jobApplications? })` pasa las dos a `buildApp`; la firma actual sigue siendo válida.
- `createApplicationsSpy({ failOnReject? } = {})` → `{ port, rejectCalls }`: `port.countActiveApplications` devuelve 0;
  `port.rejectActiveApplications(input)` guarda `input` en `rejectCalls` y, con `failOnReject`, lanza
  `new Error('fallo simulado del rechazo')` (CA-09 en TASK-04). Sin *mocks* de módulo.

**Aviso:** el seed nuevo puede mover los borradores en el listado sin filtros de `e2e/jobs.spec.ts`; los e2e no se
exigen hasta TASK-14, que los ajusta (DD-09 frontend).
