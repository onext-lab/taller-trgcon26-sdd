# Changelog — HU-03 Alta, edición y búsqueda de candidatos, con consentimiento

> Lo escribe `/reviewer` al aprobar la HU. Una entrada por task entregada, en lenguaje funcional (qué puede hacer ahora
> el reclutador), no técnico.

**Veredicto:** `Aprobado con observaciones` (ronda 1, `review/REVIEW.md`).
**Endpoints nuevos:** `POST /api/candidates`, `GET /api/candidates` (`q`, `skill`, `page`, `pageSize`),
`GET /api/candidates/:id`, `PATCH /api/candidates/:id`, `POST /api/candidates/:id/consent` y
`POST /api/candidates/:id/consent/withdrawal`. Todas las rutas: `details` acotado al esquema (DEC-11.4 enmendado).
**Pantallas:** «Candidatos» en la navegación; listado con búsqueda (fuera de la URL), alta, edición y ficha con la
sección de consentimiento.
**Migraciones:** `apps/api/src/db/migrations/002-create-candidates.sql`. **Seed:** 30 candidatos inventados (10 con
consentimiento vigente, 4 retirado y 16 sin él), además de las 10 ofertas.

## Entradas

### 2026-10-06 — TASK-01: errores sin nombrar campos desconocidos
- **Tipo:** feature y test
- **Qué se entregó:** cuando una petición trae campos que la API no conoce, el error dice «Hay campos no permitidos.»
  sin repetir sus nombres; los campos de solo lectura se siguen nombrando. Aplica a ofertas y candidatos.
- **Archivos afectados:** `apps/api/src/http/{error-handler,validation}.ts`, `apps/api/src/errors.ts`,
  `apps/api/src/modules/jobs/schemas.ts`, `docs/07_architecture_principles/DECISIONS.md` y tests de errores y de ofertas
- **Commit:** `df83266`
- **Desviaciones del PRD:** ninguna (6 aserciones de tests cambiadas en lugar de las 5 previstas; ver la review)

### 2026-10-06 — TASK-02 a TASK-08: candidatos en la API
- **Tipo:** feature y test
- **Qué se entregó:** el reclutador da de alta candidatos (con o sin consentimiento), los edita, los busca por nombre o
  email sin importar tildes y por skill, abre su ficha y registra, renueva o retira el consentimiento; la fecha de fin
  de retención se calcula sola con la fórmula de RGPD §3. Un email repetido avisa sin mostrar los datos del otro
  candidato. Nada de esto deja datos personales en los logs.
- **Archivos afectados:** `apps/api/src/modules/candidates/*`, `apps/api/src/db/{migrations/002-create-candidates.sql,seed.ts,seed-candidates.ts}`,
  `apps/api/src/app.ts`, `apps/api/test/candidates/*`, `apps/api/test/helpers/*`
- **Commit:** `70db89c`, `9d24906`, `783f97f`, `3487755`, `087c3ca`, `d212483`, `26213a7` · review: `1649156`
- **Desviaciones del PRD:** ninguna

### 2026-10-06 — TASK-09 a TASK-14: candidatos en la web
- **Tipo:** feature, refactor y test
- **Qué se entregó:** listado con búsqueda que se recuerda al volver de una ficha pero no queda en la URL ni en el
  historial; formulario de alta y edición con los errores junto a cada campo y enlace a la ficha existente si el email
  ya está; ficha con la sección de consentimiento (marcar, renovar y retirar con confirmación). Los títulos de las
  pantallas nunca llevan el nombre del candidato. La paginación y los errores de formulario se comparten con ofertas.
- **Archivos afectados:** `apps/web/src/features/candidates/*`, `apps/web/src/components/*`, `apps/web/src/App.tsx`,
  `apps/web/src/features/jobs/*` (re-exportan las piezas compartidas), `apps/web/src/styles.css` y sus tests
- **Commit:** `136b8f4`, `030294e`, `e527975`, `2afe567`, `fcc95f1`, `f4327e8` · review: `a669796`, `8306c62`, `dc0acd4`
- **Desviaciones del PRD:** ninguna

### 2026-10-06 — TASK-15: recorridos e2e
- **Tipo:** test
- **Qué se entregó:** 10 recorridos nuevos (alta, duplicado, edición, ficha, consentimiento con teclado, búsqueda y
  vuelta al listado, API caída).
- **Archivos afectados:** `e2e/candidates.spec.ts`, `e2e/candidates-list.spec.ts`
- **Commit:** `02840af`
- **Desviaciones del PRD:** ninguna

### 2026-10-06 — T-03 (sprint): tests de ofertas estables bajo carga
- **Tipo:** test
- **Qué se entregó:** los tests web de ofertas que fallaban a veces con la máquina cargada esperan al estado final.
- **Archivos afectados:** `apps/web/test/helpers/focus.ts`, `apps/web/test/features/jobs/*` (5 ficheros)
- **Commit:** `f888305`
- **Desviaciones del PRD:** ninguna
