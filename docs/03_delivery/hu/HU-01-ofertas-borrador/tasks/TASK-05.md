# TASK-05 — Edición y borrado: `PATCH /api/jobs/:id` y `DELETE /api/jobs/:id`

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** backend
- **Estado:** Completada
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Las dos escrituras que faltan:
- `PATCH /api/jobs/:id` edita un borrador por lectura-fusión-escritura dentro de `withTransaction`: lee la fila, fusiona
  los campos recibidos, valida mínimo ≤ máximo **con los valores fusionados** y hace un `UPDATE` de las 6 columnas
  editables (lista fija, sin SQL dinámico). Gana la última escritura, campo a campo.
- `DELETE /api/jobs/:id` borra físicamente (204) o da 404 si no hay fila.
- Test de rendimiento de las acciones (RNF-02).

Los casos hostiles (título vacío, campos de solo lectura, regla de banda con el valor guardado, fallo de SQLite, oferta
borrada mientras se edita, ID no válido, segundo `DELETE`) van en TASK-06 y TASK-07.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/jobs/schemas.ts` | modificar | JSON Schema del cuerpo del `PATCH` |
| `apps/api/src/modules/jobs/repository.ts` | modificar | `update(id, fields)` y `deleteById(id)` |
| `apps/api/src/modules/jobs/service.ts` | modificar | `update(id, patch)` y `remove(id)` |
| `apps/api/src/modules/jobs/routes.ts` | modificar | `PATCH /:id` (con `preValidation`) y `DELETE /:id` |
| `apps/api/test/jobs/update.test.ts` | crear | Edición (camino feliz) |
| `apps/api/test/jobs/delete.test.ts` | crear | Borrado (camino feliz) |
| `apps/api/test/jobs/performance.test.ts` | modificar | Añade RNF-02 |

## Implementa
- RF: RF-03, RF-04 · RNF: RNF-02 · CA: CA-09, CA-10, CA-11, CA-13 · Edge cases: EC-19, EC-21, EC-23, EC-26, EC-28
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API › Endpoints (`PATCH`, `DELETE`), § Diagrama de secuencia
  RF-03 y RF-04, DD-04, DD-05, DD-07, DD-11

## Dependencias
- **Depende de:** TASK-04
- **Bloquea:** TASK-06, TASK-07, TASK-11

## Criterios de done
- [ ] `PATCH` que cambia descripción y ubicación → 200 con los valores nuevos; `status` y `createdAt` intactos (CA-09).
- [ ] `PATCH { "description": "" }` y `{ "description": null }` → 200 con `description: null` (CA-10, EC-21).
- [ ] Dos `PATCH` con campos distintos se suman; con el mismo campo gana el segundo (CA-11, EC-23).
- [ ] `PATCH {}` → 400 `field: "body"`, «Envía al menos un campo.» (EC-19).
- [ ] El mismo `PATCH` dos veces → 200 con el mismo cuerpo (EC-26).
- [ ] `DELETE` → 204 sin cuerpo y después `GET` → 404 (CA-13); borrar el único deja el listado con `items: []` y
      `total: 0` (EC-28); un ID borrado no se reutiliza (DD-07).
- [ ] RNF-02: `POST`, `PATCH` y `DELETE` < 500 ms con 100 ofertas en la base.
- [ ] `npm test -w apps/api -- update delete performance` en verde, con **3** ficheros de test ejecutados.
- [ ] `npm test -w apps/api` completo en verde (no rompe TASK-01 a TASK-04).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/jobs apps/api/test/jobs` sin errores.
- [ ] Commit único `feat(jobs): edit and delete draft job openings [HU-01 TASK-05]` nombrando los ficheros.

## Notas de implementación

**Contrato:**

| Método y ruta | Entrada | 2xx | Errores |
|---|---|---|---|
| `PATCH /api/jobs/:id` | `params`: `idParamsSchema`; `body`: `{ type: object, additionalProperties: false, minProperties: 1, properties: JobFields }`. Campo ausente = sin cambios; `null` (o `""` en `description`/`location`) = sin valor; `title` no admite `null` | **200** `Job` con los valores fusionados; `status` y `createdAt` intactos | 400 `VALIDATION_ERROR` (incluida mínimo ≤ máximo sobre los valores **fusionados**) · 404 `NOT_FOUND` «La oferta no existe.» · 413 · 415 · 500 |
| `DELETE /api/jobs/:id` | `params`: `idParamsSchema`; **sin cuerpo** | **204** sin cuerpo | 400 `VALIDATION_ERROR` · 404 `NOT_FOUND` (también en el segundo `DELETE`) · 500 |

- `JobFields` es el mismo de `schemas.ts` (TASK-03): `title` es `type: "string"` (no admite `null`).
- El `PATCH` lleva el mismo `preValidation` que el `POST`: `trimTextFields(body, { trim: ['title', 'description',
  'location'], emptyToNull: ['description', 'location'] })`.
- **Orden de comprobación:** JSON Schema (400) → existencia (404) → reglas del servicio (400). Un `PATCH` inválido a un
  ID inexistente da **400**.
- `DELETE` (y `GET`) van **sin cuerpo y sin `Content-Type`**: Fastify responde 400 a un `Content-Type:
  application/json` con cuerpo vacío. En los tests, `inject({ method: 'DELETE', url })` sin `payload`.
- Respuesta del `DELETE`: `reply.code(204).send()`; esquema de respuesta solo para el `PATCH` (`200: Job`).

**Servicio** (DD-04, DD-05):

```ts
update(id, patch) → transaction(() => {
  const current = repository.findById(id);        // sin fila → throw notFound('La oferta no existe.')
  const merged = { ...current, ...patch };          // solo los 6 campos editables
  assertSalaryRange(merged.salaryMin, merged.salaryMax); // field salaryMin
  return repository.update(id, merged);
})
remove(id) → repository.deleteById(id) === 0 → throw notFound('La oferta no existe.')
```

- `transaction` es `(fn) => withTransaction(db, fn)` (`BEGIN IMMEDIATE`): si falla el `UPDATE`, `ROLLBACK` y el error
  sube al manejador (500).

**Repositorio** (sentencias preparadas, **lista fija** de columnas; nunca un `SET` construido con las claves recibidas):

```sql
UPDATE job_openings
SET title = ?, description = ?, location = ?, work_mode = ?, salary_min = ?, salary_max = ?
WHERE id = ? RETURNING *;
DELETE FROM job_openings WHERE id = ?;   -- devuelve changes (0 o 1)
```

**Tests** (con `createTestApp({ now })`, `createTestClock` y `createJob`):
- `update.test.ts`: «CA-09 cambia descripción y ubicación; sigue en draft y createdAt igual» (avanza el reloj antes
  del `PATCH` para probar que `createdAt` no cambia), «CA-10/EC-21 vaciar la descripción → null», «CA-11/EC-23 gana la
  última escritura, campo a campo», «EC-19 PATCH {} → 400», «EC-26 el mismo PATCH dos veces → 200 igual».
- `delete.test.ts`: «CA-13 204 sin cuerpo y después GET → 404», «EC-28 borrar el único deja el listado vacío», «DD-07
  un ID borrado no se reutiliza» (crea, borra el último, crea otro: su ID es mayor).
- `performance.test.ts`: «RNF-02 POST, PATCH y DELETE < 500 ms con 100 ofertas» (calentamiento previo y
  `performance.now()`).
