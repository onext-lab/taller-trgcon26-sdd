# TASK-02 — Publicar, cerrar y duplicar en la API: `POST /:id/publish`, `/:id/close`, `/:id/duplicate` y `GET /:id/close-preview`

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Las tres transiciones de la oferta y la lectura previa al cierre, con el camino feliz y la idempotencia:
- **Reglas de estado** en `rules.ts` (tabla acción × estado, DD-02) y reglas de campos (obligatorios y banda, DD-07).
  `assertSalaryRange` sale de `service.ts` a `rules.ts`. La tabla incluye ya las filas de `update` y `remove`, que usa
  TASK-03.
- **Servicio:** `publish`, `close`, `closePreview` y `duplicate`, todos dentro de `withTransaction` salvo la lectura.
  Implementa también sus ramas de error (404, 409, campos pendientes, `ROLLBACK`).
- **Rutas:** cuatro rutas nuevas; las tres `POST` sin cuerpo (`rejectBody`).
- **Tests del camino feliz** en `publish.test.ts`, `close.test.ts` y `duplicate.test.ts`. Los casos hostiles (cuerpo, ID
  no válido, campos pendientes, 409, fallos de SQLite y del puerto, 404, HTML, 403) los prueba la tarea `[adversarial]`
  TASK-04.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/jobs/rules.ts` | crear | `checkAction`, `missingRequiredDetails`, `salaryRangeDetails`, `assertNoDetails` (~85 líneas) |
| `apps/api/src/modules/jobs/schemas.ts` | modificar | `closePreviewSchema` y tipo `ClosePreview` |
| `apps/api/src/modules/jobs/service.ts` | modificar | `publish`, `close`, `closePreview`, `duplicate`; `create` usa `rules.ts` |
| `apps/api/src/modules/jobs/routes.ts` | modificar | 4 rutas nuevas |
| `apps/api/test/helpers/test-app.ts` | modificar | `publishJob`, `closeJob`, `createPublishedJob` |
| `apps/api/test/jobs/publish.test.ts` | crear | Publicar (camino feliz) |
| `apps/api/test/jobs/close.test.ts` | crear | Cerrar y lectura previa (camino feliz) |
| `apps/api/test/jobs/duplicate.test.ts` | crear | Duplicar (camino feliz) |

## Implementa
- RF: RF-01, RF-02, RF-04 (API) · CA: CA-01, CA-02, CA-05, CA-06 (API), CA-07, CA-14, CA-15 · Edge cases: EC-03, EC-04,
  EC-07, EC-09, EC-11, EC-13, EC-16, EC-26, EC-28, EC-31, EC-42 (API)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API › Endpoints y Convenciones, § Firmas internas, § Diagrama
  de secuencia RF-01, RF-02 y RF-04, DD-02, DD-07, DD-08, DD-09, DD-11, § Checklist pasos 4, 5 y 6

## Dependencias
- **Depende de:** TASK-01
- **Bloquea:** TASK-03, TASK-04, TASK-09

## Criterios de done
- [ ] CA-01: borrador completo «Técnica/o de selección» (híbrida, Valencia, 32 000-40 000) y reloj en
      2026-10-06T08:00:00Z → `POST /api/jobs/:id/publish` sin cuerpo → 200 con `status: "published"` y
      `publishedAt: "2026-10-06T08:00:00.000Z"`.
- [ ] CA-02/EC-09: segunda publicación con el reloj una hora después → 200 y el mismo `publishedAt`.
- [ ] EC-03: se publica sin banda, y con título de 120 y descripción de 5 000 caracteres.
- [ ] EC-04: con el reloj en 2026-10-06T22:30:00Z, `publishedAt` es `"2026-10-06T22:30:00.000Z"`.
- [ ] EC-07: un borrador creado con `POST /api/jobs` se publica sin migrar nada.
- [ ] CA-05/EC-11/EC-42: `GET /api/jobs/:id/close-preview` → 200 `{ "activeApplications": 0 }`; `POST …/close` con el
      reloj en 2026-10-06T22:30:00Z → 200 `closed`, `closedAt` del reloj, `createdAt`/`publishedAt` informados, y el
      espía del puerto con **1** llamada `{ jobId, closedAt }`.
- [ ] CA-06 (API): pedir la lectura previa no cambia la oferta (sigue `published`, `closedAt` nulo).
- [ ] CA-07/EC-13/EC-16: segundo cierre con el reloj una hora después → 200, mismo `closedAt` y el espía sigue con 1
      llamada.
- [ ] CA-14/EC-28: duplicar una `closed` con el reloj en 2026-10-07T09:00:00Z → 201 con otro ID, los 6 campos
      editables iguales, `status: "draft"`, `createdAt` del reloj, `publishedAt`/`closedAt` nulos; la original igual.
- [ ] CA-15: duplicar un borrador y una publicada → un borrador por cada una, sin fechas de publicación ni de cierre.
- [ ] EC-26: un borrador con solo título se copia con solo título; un título de 120 caracteres, idéntico y sin sufijo.
- [ ] EC-31: dos `POST …/duplicate` → dos borradores con IDs distintos.
- [ ] `npm test -w apps/api -- publish close duplicate` en verde, con **3** ficheros de test ejecutados.
- [ ] `npm test -w apps/api` completo en verde (`create*.test.ts` sigue igual tras mover `assertSalaryRange`).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/jobs apps/api/test/helpers/test-app.ts apps/api/test/jobs/publish.test.ts apps/api/test/jobs/close.test.ts apps/api/test/jobs/duplicate.test.ts`
      sin errores.
- [ ] Ninguna función pasa de 50 líneas ni `service.ts` de 300 (~175 esperado).
- [ ] Commit único `feat(jobs): publish, close and duplicate job openings [HU-02 TASK-02]` nombrando los ficheros.

## Notas de implementación

**Contrato:**

| Método y ruta | Entrada | 2xx | Errores (se implementan aquí; los prueba TASK-04) |
|---|---|---|---|
| `POST /api/jobs/:id/publish` | `params`: `idParamsSchema`; sin cuerpo | **200** `Job` `published`, `publishedAt = now()`. Ya `published` → **200** igual, sin escribir | 400 (`id`, `body`, campos pendientes) · 404 · 409 · 415 · 500 |
| `POST /api/jobs/:id/close` | ídem | **200** `Job` `closed`, `closedAt = now()`; `rejectActiveApplications` una vez en la misma transacción. Ya `closed` → **200** igual, sin invocar el puerto | 400 · 404 · 409 · 415 · 500 `INTERNAL_ERROR` |
| `GET /api/jobs/:id/close-preview` | `params`: `idParamsSchema` | **200** `{ "activeApplications": 0 }` en cualquier estado (DD-11) | 400 · 404 · 500 |
| `POST /api/jobs/:id/duplicate` | `params`: `idParamsSchema`; sin cuerpo | **201** `Job` nuevo: 6 campos editables de la original, `draft`, `createdAt = now()`, sin fechas de publicación ni cierre. No es idempotente | 400 · 404 · 415 · 500 |

- Las tres `POST`: `preValidation: rejectBody` (TASK-01) y `schema: { params: idParamsSchema, response: { 200|201: jobSchema } }`.
  El cliente no envía cuerpo ni `Content-Type`; en los tests, `inject({ method: 'POST', url })` **sin** `payload`.
- `closePreviewSchema`: `{ type: 'object', additionalProperties: false, required: ['activeApplications'], properties:
  { activeApplications: { type: 'integer', minimum: 0 } } }`.
- **Repetir** publicar o cerrar → 200 con la oferta tal cual: no se llama a `now()` ni al puerto.

**Reglas** (`rules.ts`, DD-02 y DD-07):

```ts
export type JobAction = 'publish' | 'close' | 'update' | 'remove';
type Outcome = 'apply' | 'noop' | { conflict: string };
const RULES: Record<JobAction, Record<JobStatus, Outcome>> = {
  publish: { draft: 'apply', published: 'noop', closed: { conflict: 'Una oferta cerrada no se puede publicar.' } },
  close:   { draft: { conflict: 'Un borrador no se puede cerrar: publícalo primero.' }, published: 'apply', closed: 'noop' },
  update:  { draft: 'apply', published: 'apply', closed: { conflict: 'Una oferta cerrada no se puede editar.' } },
  remove:  { draft: 'apply', published: { conflict: 'Una oferta publicada no se puede borrar.' },
             closed: { conflict: 'Una oferta cerrada no se puede borrar.' } },
};
export function checkAction(action: JobAction, status: JobStatus): 'apply' | 'noop'; // conflicto → throw invalidTransition(msg)
export function missingRequiredDetails(fields: JobEditableFields, message: string): ErrorDetail[];
// un elemento por campo vacío (null o ""), en el orden title, description, location, workMode; la banda nunca
export function salaryRangeDetails(min: number | null | undefined, max: number | null | undefined): ErrorDetail[];
// [{ field: 'salaryMin', message: 'El salario mínimo no puede ser mayor que el máximo.' }] si min > max (los dos presentes)
export function assertNoDetails(details: ErrorDetail[]): void; // throw validationError(details) si no está vacío
```

- `create` pasa a `assertNoDetails(salaryRangeDetails(input.salaryMin, input.salaryMax))` (mismo comportamiento).
- `checkAction` con ≤ 3 ramas; `service.ts` por debajo de 10 ramas por función.

**Servicio** (orden DT-04: 404 → estado → reglas de campos; DD-08):

```ts
publish(id) → transaction(() => {
  const job = repository.findById(id);                 // sin fila → notFound('La oferta no existe.')
  if (checkAction('publish', job.status) === 'noop') return job;
  assertNoDetails(missingRequiredDetails(editableFields(job), 'Obligatorio para publicar.'));
  const published = repository.markPublished(id, now().toISOString());
  if (!published) throw new Error('markPublished no devolvió la fila'); // imposible bajo BEGIN IMMEDIATE → 500
  return published;
})
close(id) → transaction(() => {
  const job = …findById / 404…;
  if (checkAction('close', job.status) === 'noop') return job;   // sin now() ni puerto (S-01)
  const closedAt = now().toISOString();
  const closed = repository.markClosed(id, closedAt);   // sin fila → throw Error → 500
  applications.rejectActiveApplications({ jobId: id, closedAt }); // después del UPDATE; si lanza → ROLLBACK
  return closed;
})
closePreview(id) → findById(id) (404 si no existe) → { activeApplications: applications.countActiveApplications(id) }
duplicate(id) → transaction(() => repository.insert(editableFields(original /* 404 */), now().toISOString()))
```

- `duplicate` no llama a `checkAction`: cualquier estado (S-11, EC-28). Reutiliza `INSERT_SQL`, que fija `'draft'`
  (DD-09).
- Firma del servicio: `publish(id): Job`, `close(id): Job`, `closePreview(id): ClosePreview`, `duplicate(id): Job`.

**Helpers** (`test-app.ts`): `publishJob(app, id)` y `closeJob(app, id)` (fallan si no es 200);
`createPublishedJob(app, body?)` crea un borrador completo (título, descripción, ubicación y modalidad) y lo publica.

**Tests** (`createTestApp({ now, jobApplications })`, `createTestClock`, `createApplicationsSpy`; títulos inventados del
PRD), nombres del TD:
- `publish.test.ts`: «CA-01 publica un borrador completo con publishedAt del reloj», «CA-02/EC-09 segunda publicación →
  200 con la misma fecha», «EC-03 sin banda o en las fronteras de longitud → se publica», «EC-04 publishedAt es el
  instante UTC del reloj», «EC-07 un borrador creado con POST se publica sin migrar nada».
- `close.test.ts`: «CA-05/EC-11 previa con 0, cierre con closedAt del reloj y puerto invocado una vez», «CA-06 la previa
  no cambia la oferta», «CA-07/EC-13/EC-16 segundo cierre → 200 sin cambios ni nueva invocación».
- `duplicate.test.ts`: «CA-14/EC-28 duplicar una cerrada → 201 borrador; la original no cambia», «CA-15 duplicar un
  borrador y una publicada → borradores sin fechas», «EC-26 borrador con solo título y título de 120 se copian tal
  cual», «EC-31 dos duplicados → dos borradores».
- Comprueba la original con un `GET` después de cada acción (no cambia).
