# TASK-05 — Listado y búsqueda de candidatos en la API, seed de 30 y rendimiento con 1 000

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-04) · Should (RF-08) · RNF-01, RNF-02, RNF-04
- **Complejidad:** L (2–4 h; estimada 3,5 h: listado 2 h + seed y rendimiento 1,5 h)

## Descripción
Junta las filas B-05 y B-06 del TD-backend (ver ROADMAP, «Ajustes respecto a los TD»): el criterio de RF-08 se comprueba
precisamente con el listado (`GET /api/candidates?pageSize=100` → 30), y el rendimiento mide el listado junto a las
demás rutas.

1. **Listado** `GET /api/candidates` con `q` (parcial y literal en nombre o email, sin mayúsculas ni tildes), `skill`
   (exacta, en minúsculas), `page` y `pageSize` (DEC-10). `q` y `skill` se recortan antes de validar; vacíos = sin
   filtro. Orden `created_at DESC, id DESC`. Respuesta `{ items, total, page, pageSize }` con cada elemento
   **exactamente** `{ id, fullName, email, skills }` (RNF-04).
2. **Seed** `apps/api/src/db/seed-candidates.ts`: 30 candidatos inventados con `@example.com`, invocado desde
   `seed(db, now = new Date())` en la **misma transacción** que las ofertas; escribe con el repositorio (sin SQL
   propio) y calcula la retención con `computeRetentionEndsAt` y `noCandidateProcesses`. Las 10 ofertas no cambian.
3. **Rendimiento** con 1 000 candidatos: lecturas < 200 ms y acciones < 500 ms con `fastify.inject`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/candidates/schemas.ts` | modificar | `listQuerySchema`, `candidateListItemSchema` (4 campos), `candidatePageSchema`, `CandidateListQuery` |
| `apps/api/src/modules/candidates/repository.ts` | modificar | `listPage(filter, limit, offset)` y `count(filter)` (solo `id, full_name, email, skills`) |
| `apps/api/src/modules/candidates/service.ts` | modificar | `list(query)` |
| `apps/api/src/modules/candidates/routes.ts` | modificar | `GET /` con recorte de `q` y `skill` en `preValidation` |
| `apps/api/src/db/seed-candidates.ts` | crear | 30 candidatos (10 vigentes, 4 retirados, 16 sin consentimiento) |
| `apps/api/src/db/seed.ts` | modificar | `seed(db, now = new Date())` llama a `seedCandidates(db, now)` dentro de la transacción |
| `apps/api/test/candidates/list.test.ts` | crear | CA-15 a CA-19, EC-28, EC-29, RNF-04 |
| `apps/api/test/candidates/seed.test.ts` | crear | RF-08 |
| `apps/api/test/candidates/performance.test.ts` | crear | RNF-01, RNF-02 |

## Implementa
- RF: RF-04 (API), RF-08 · CA: CA-15 a CA-19 (API) · Edge cases: EC-28, EC-29 · RNF-01, RNF-02, RNF-04
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Endpoints (`GET /api/candidates`), § Migración de datos › Seed, DD-02,
  DD-10, § Estrategia de tests (RNF-01, RNF-02, RNF-04, RF-08), § Checklist B-05 y B-06

## Dependencias
- **Depende de:** TASK-04 (comparten `schemas.ts`, `repository.ts`, `service.ts` y `routes.ts`; el seed usa
  `setConsent` y el rendimiento mide edición y consentimiento)
- **Bloquea:** TASK-07, TASK-08, TASK-10, TASK-15

## Criterios de done
- [ ] CA-15: «José Ruiz» (`jose.ruiz@example.com`) aparece con `q=jose` y con `q=ruiz@exa`; cada elemento tiene
      exactamente `id`, `fullName`, `email`, `skills` (RNF-04).
- [ ] CA-16: con 25 candidatos y sin filtros → los 20 más recientes, `total` 25, `page` 1, `pageSize` 20.
- [ ] CA-17: `q=jose&skill=SQL` con «José Ruiz» (`sql`) y «José Martín» (sin ella) → solo José Ruiz.
- [ ] CA-18: sin coincidencias → `items []` y `total` 0.
- [ ] CA-19: `page=2` → los 5 restantes; `pageSize=100` → los 25; `page=3` → `items []` con `total` 25.
- [ ] EC-28: 0, 20 y 21 candidatos; `q` de 100 caracteres → 200; `q` o `skill` solo con espacios → sin filtro.
- [ ] EC-29: «José Ruiz» y «JOSÉ MARTÍN» con `q=jose`; empate de `createdAt` → primero el ID mayor.
- [ ] RF-08: tras `migrate` + `seed(db, now)` con `now` fijo, `GET /api/candidates?pageSize=100` → `total` 30; 10
      vigentes, 4 retirados y 16 sin consentimiento; todos con `@example.com`, válidos según RF-02; ninguno con la
      retención vencida respecto a `now`; cada `retentionEndsAt` igual a `computeRetentionEndsAt`.
- [ ] `apps/api/test/jobs/seed.test.ts` y los e2e de ofertas no cambian (las 10 ofertas siguen igual).
- [ ] `npm run db:reset` termina sin errores.
- [ ] RNF-01: `GET /api/candidates` con `q` y `skill`, y `GET /:id`, < 200 ms por petición con 1 000 candidatos.
      RNF-02: alta, edición y cambios de consentimiento < 500 ms por petición con 1 000.
- [ ] `npm test -w @ats/api -- candidates/list.test candidates/seed candidates/performance` en verde, con **3**
      ficheros de test.
- [ ] `npm test -w @ats/api` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/candidates/schemas.ts apps/api/src/modules/candidates/repository.ts apps/api/src/modules/candidates/service.ts apps/api/src/modules/candidates/routes.ts apps/api/src/db/seed-candidates.ts apps/api/src/db/seed.ts apps/api/test/candidates/list.test.ts apps/api/test/candidates/seed.test.ts apps/api/test/candidates/performance.test.ts`
      sin errores.
- [ ] Commit único `feat(api): list and search candidates, seed 30 candidates [HU-03 TASK-05]` nombrando los ficheros.

## Notas de implementación

**Query** (`additionalProperties: false`, todo texto, DEC-11.2):

```ts
{ q: { type: 'string', maxLength: 100, pattern: NO_CONTROL_CHARS },
  skill: { type: 'string', maxLength: 40, pattern: NO_CONTROL_CHARS },
  page: { type: 'string', pattern: '^[1-9][0-9]{0,8}$' },
  pageSize: { type: 'string', pattern: '^(?:[1-9][0-9]?|100)$' } }
```

- Un parámetro desconocido sale como `{ field: 'querystring', message: 'Hay campos no permitidos.' }` (TASK-01). Sus
  tests hostiles van en TASK-08.

**SQL** (DD-02, sin `LIKE`, sentencias preparadas):

```sql
WHERE (:q IS NULL OR instr(fold_search(full_name), :q) > 0 OR instr(email, :q) > 0)
  AND (:skill IS NULL OR EXISTS (SELECT 1 FROM json_each(candidates.skills) WHERE value = :skill))
ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset
```

- `:q` va plegado con `foldSearchText` (el email ya es ASCII en minúsculas: no necesita `fold_search`); `:skill` en
  minúsculas. `%` y `_` son literales con `instr`.
- `listPage` y `count` seleccionan solo `id, full_name, email, skills` (nada de `SELECT *`).

**Seed** (DD-10, DT-08):
- `createdAt = now − (3 + 5·i) días`, `i = 0…29` (entre 3 y 148 días; ninguno vencido: alta + 6 meses ≥ 181 días).
- 10 con consentimiento vigente (`givenAt = createdAt + 1 día`), 4 retirados (`givenAt = createdAt + 1 día`,
  `withdrawnAt = givenAt + 2 días`, siempre ≤ `now`) y 16 sin él.
- 0-4 skills de `typescript`, `sql`, `react`, `node.js`, `python`, `java`, `figma`, `scrum`, `docker`, `aws`, `excel`,
  `ventas`; varios sin teléfono ni resumen. Nombres inventados.
- `reset.ts` no cambia (valor por defecto de `now`). `data/ats.db` cambiará de fechas en cada `db:reset` (aceptado en
  DD-10): los e2e no pueden fijar fechas absolutas del seed.
- `seed.ts` (157 líneas hoy) y `seed-candidates.ts` por debajo de 300 líneas.

**Rendimiento**: 1 000 filas insertadas con el repositorio en una transacción; medir con `performance.now()` alrededor
de `app.inject`, varias repeticiones y el peor caso contra el umbral (como `apps/api/test/jobs/performance.test.ts`).
