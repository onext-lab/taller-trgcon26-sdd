# TASK-04 — Ficha, listado y seed: `GET /api/jobs/:id` y `GET /api/jobs`

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** backend
- **Estado:** Completada
- **Prioridad:** Must (RF-05, RF-06) · Should (RF-07)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Las dos lecturas del módulo y los datos de ejemplo:
- `GET /api/jobs/:id` devuelve la oferta completa (404 si no existe).
- `GET /api/jobs` devuelve la primera página de 20 con la forma de DEC-10, ordenada por fecha de referencia descendente
  y desempate por ID descendente; no admite ningún parámetro en esta HU.
- El seed carga 4 borradores inventados (RF-07) para `npm run db:reset`.
- Primer test de rendimiento (RNF-01, lecturas).

Los casos hostiles de lectura (ID no válido, ID inexistente, parámetros de query, HTML en el título, campos de más en
los items) van en TASK-07.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/jobs/schemas.ts` | modificar | JSON Schema `JobListItem`, `JobPage` y `querystring` vacío del listado |
| `apps/api/src/modules/jobs/repository.ts` | modificar | `findById(id)`, `listPage(limit, offset)`, `count()` |
| `apps/api/src/modules/jobs/service.ts` | modificar | `get(id)` (`NOT_FOUND`) y `list()` |
| `apps/api/src/modules/jobs/routes.ts` | modificar | `GET /` y `GET /:id` |
| `apps/api/src/db/seed.ts` | modificar | 4 borradores inventados (RF-07) |
| `apps/api/test/jobs/create.test.ts` | modificar | CA-01: además, la oferta aparece en `GET /api/jobs` |
| `apps/api/test/jobs/get.test.ts` | crear | Ficha (camino feliz) |
| `apps/api/test/jobs/list.test.ts` | crear | Listado (camino feliz y fronteras) |
| `apps/api/test/jobs/seed.test.ts` | crear | RF-07 |
| `apps/api/test/jobs/performance.test.ts` | crear | RNF-01 |

## Implementa
- RF: RF-05, RF-06, RF-07 · RNF: RNF-01 · CA: CA-01 (listado), CA-15, CA-16, CA-17, CA-19 · Edge cases: EC-35,
  EC-36, EC-37, EC-44, EC-48 (la API devuelve el HTML tal cual)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API › Endpoints (`GET /api/jobs`, `GET /api/jobs/:id`),
  § Esquemas compartidos, § Migración de datos › Seed, § Diagrama de secuencia RF-05 y RF-06, § Estrategia de tests

## Dependencias
- **Depende de:** TASK-03
- **Bloquea:** TASK-05, TASK-10

## Criterios de done
- [ ] `GET /api/jobs/:id` → 200 con la oferta completa; los opcionales vacíos salen como `null`; título y descripción
      con HTML salen tal cual (CA-19, EC-44, EC-48).
- [ ] `GET /api/jobs` → `{ items, total, page: 1, pageSize: 20 }` con 25 borradores: 20 más recientes, `total` 25
      (CA-15); 0, 20 y 21 ofertas (CA-17, EC-35); `referenceDate` igual al instante del reloj (CA-16, EC-36); misma fecha
      → ID mayor primero (EC-37).
- [ ] El test CA-01 de `create.test.ts` comprueba además que la oferta aparece en el listado.
- [ ] `npm run db:reset` termina sin errores; tras él, la base tiene los 4 borradores del seed.
- [ ] RNF-01: `GET /api/jobs` y `GET /api/jobs/:id` < 200 ms con 100 ofertas en la base.
- [ ] `npm test -w apps/api -- create get list seed performance` en verde, con **5** ficheros de test ejecutados.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/jobs apps/api/src/db/seed.ts apps/api/test/jobs` sin errores.
- [ ] Commit único `feat(jobs): get and list job openings, seed drafts [HU-01 TASK-04]` nombrando los ficheros.

## Notas de implementación

**Contrato:**

| Método y ruta | Entrada | 2xx | Errores |
|---|---|---|---|
| `GET /api/jobs` | `querystring`: `{ type: object, additionalProperties: false, properties: {} }` (cualquier parámetro da 400 hasta HU-02) | **200** `JobPage`: `page: 1`, `pageSize: 20`, `total` = todas las filas; `items` = 20 primeras por `referenceDate` desc e `id` desc; `referenceDate = publishedAt ?? createdAt` | 400 `VALIDATION_ERROR` (`field` = el parámetro) · 500 |
| `GET /api/jobs/:id` | `params`: `idParamsSchema` (de `apps/api/src/http/validation.ts`) | **200** `Job` | 400 `VALIDATION_ERROR` (`field: "id"`) · 404 `NOT_FOUND` «La oferta no existe.» · 500 |

- `GET` va **sin cuerpo y sin `Content-Type`**: en los tests, `inject({ method: 'GET', url })` sin `payload`.
- El `:id` llega como texto validado por `pattern: "^[1-9][0-9]{0,14}$"`; conviértelo con `Number()` en la ruta.
- Orden de comprobación: JSON Schema (400) → existencia (404).

```json
"JobListItem": { "type": "object", "additionalProperties": false, "required": ["id","title","status","referenceDate"],
  "properties": { "id": { "type": "integer" }, "title": { "type": "string" },
    "status": { "type": "string", "enum": ["draft","published","closed"] }, "referenceDate": { "type": "string" } } }
"JobPage": { "type": "object", "additionalProperties": false, "required": ["items","total","page","pageSize"],
  "properties": { "items": { "type": "array", "items": { "$ref": "JobListItem" } },
    "total": { "type": "integer" }, "page": { "type": "integer" }, "pageSize": { "type": "integer" } } }
```

El listado devuelve **solo** esos 4 campos por item (DEC-10, RGPD §6.2). Puedes incrustar `JobListItem` en `items` en
lugar de usar `$ref` si es más simple con Fastify.

**SQL** (sentencias preparadas; usa **la misma expresión** que el índice `job_openings_reference_date_idx`):

```sql
SELECT id, title, status, COALESCE(published_at, created_at) AS reference_date
FROM job_openings
ORDER BY COALESCE(published_at, created_at) DESC, id DESC
LIMIT ? OFFSET ?;           -- 20, 0
SELECT COUNT(*) AS total FROM job_openings;
```

`findById(id)`: `SELECT * FROM job_openings WHERE id = ?` → `toJob(row)` o `undefined`. El servicio lanza
`notFound('La oferta no existe.')` si no hay fila.

**Seed** (`apps/api/src/db/seed.ts`; lo llama ya `apps/api/src/db/reset.ts`): 4 borradores inventados, completos y
válidos (título, descripción, ubicación y modalidad informados; RN-02 a RN-04), insertados con el repositorio
(`insert(input, createdAt)`) **dentro de `withTransaction(db, …)`**, con `created_at` fijos (orden determinista):

| Título | Modalidad | Ubicación | Banda (€/año) | `created_at` |
|---|---|---|---|---|
| Analista de datos junior | `híbrida` | Sevilla | 26 000-31 000 | `2026-09-21T08:00:00.000Z` |
| Técnico/a de soporte IT | `presencial` | Zaragoza | — | `2026-09-24T09:30:00.000Z` |
| Diseñador/a de producto | `remota` | Bilbao | — | `2026-09-28T07:15:00.000Z` |
| Desarrollador/a frontend (React) | `híbrida` | Valencia | 34 000-42 000 | `2026-10-01T10:00:00.000Z` |

Cada uno con una descripción inventada de 1-3 frases. Sin personas ni empresas reales. Exporta los títulos en el orden
del listado si te ayuda en el test (el e2e de TASK-15 los repetirá en una constante propia).

**Tests** (con `createTestApp({ now })`, `createTestClock` y `createJob`):
- `get.test.ts`: «CA-19/EC-48 todos los campos y el HTML tal cual» (título `Oferta <b>X</b>`, descripción con
  `<script>` y `<b>`), «EC-44 solo título → opcionales null».
- `list.test.ts`: «CA-15 25 borradores → 20 más recientes, total 25, page 1, pageSize 20» (escalona `createdAt` con
  `clock.advance`), «CA-16/EC-36 devuelve el instante UTC del reloj» (`2026-10-06T22:30:00.000Z`), «CA-17/EC-35 0, 20 y
  21 ofertas», «EC-37 misma fecha → ID mayor primero».
- `create.test.ts`: amplía «CA-01 …» para que compruebe que la oferta aparece en `GET /api/jobs`.
- `seed.test.ts`: «RF-07 migrate + seed → 4 borradores, 2 con banda, todos cumplen RN-02 a RN-04» (sobre `:memory:`:
  `migrate` + `seed` + `buildApp`; `GET /api/jobs` devuelve los 4 en orden y en `draft`; cada `GET /api/jobs/:id` trae
  descripción, ubicación y modalidad; exactamente 2 con `salaryMin` y `salaryMax`).
- `performance.test.ts`: «RNF-01 GET /api/jobs y /api/jobs/:id < 200 ms con 100 ofertas». Una petición de
  calentamiento antes de medir con `performance.now()`. TASK-05 añadirá RNF-02 en el mismo fichero.
