# Changelog — HU-01 Crear, editar y consultar ofertas en borrador

> Lo escribe `/reviewer` al aprobar la HU. Una entrada por task entregada, en lenguaje funcional (qué puede hacer ahora
> el reclutador), no técnico.

**Veredicto:** `Aprobado con observaciones` (ronda 2, `review/REVIEW.md`; ronda 1 en `review/REVIEW-ronda-1.md`).
**Endpoints:** `POST /api/jobs`, `GET /api/jobs`, `GET /api/jobs/:id`, `PATCH /api/jobs/:id`, `DELETE /api/jobs/:id`.
**Pantallas:** `/jobs` (listado, pantalla de entrada), `/jobs/new`, `/jobs/:id` y `/jobs/:id/edit`.
**Migraciones:** `apps/api/src/db/migrations/001-create-job-openings.sql`. **Seed:** 4 borradores inventados.

## Entradas

### 2026-10-06 — TASK-01: base transversal de la API
- **Tipo:** feature
- **Qué se entregó:** cualquier error de la API llega con el mismo formato y un mensaje en castellano junto al campo; un
  campo desconocido o un número escrito como texto se rechazan en vez de ignorarse (DEC-11). En la ronda 1 de la review,
  los mensajes pasaron a una tabla por *keyword*.
- **Archivos afectados:**
  - `apps/api/src/http/error-handler.ts`, `apps/api/src/http/validation.ts`, `apps/api/src/errors.ts`,
    `apps/api/src/clock.ts`, `apps/api/src/db/transaction.ts`, `apps/api/src/app.ts` — envelope, Ajv estricto, reloj y
    transacciones
- **Commit:** `d9a46d9` · `47d2a27` (review)
- **Desviaciones del PRD:** Ninguna

### 2026-10-06 — TASK-02: tabla de ofertas
- **Tipo:** feature
- **Qué se entregó:** la base guarda ofertas y rechaza por sí misma datos imposibles (banda invertida, estados sin sus
  fechas).
- **Archivos afectados:** `apps/api/src/db/migrations/001-create-job-openings.sql` — tabla con sus `CHECK`
- **Commit:** `24375a8`
- **Desviaciones del PRD:** Ninguna

### 2026-10-06 — TASK-03: crear borradores
- **Tipo:** feature
- **Qué se entregó:** el reclutador crea una oferta en borrador con solo el título; los textos se recortan y los datos
  inválidos se rechazan junto al campo. Tras la review, un carácter de control también se rechaza (EC-50).
- **Archivos afectados:** `apps/api/src/modules/jobs/{schemas,repository,service,routes}.ts` — alta y validación
- **Commit:** `efa557c` · `ad6d6f2` (review)
- **Desviaciones del PRD:** EC-50 añadido en el PRD v1.1 durante la review (DT-05)

### 2026-10-06 — TASK-04: ficha, listado y seed
- **Tipo:** feature
- **Qué se entregó:** el reclutador ve sus 20 ofertas más recientes y la ficha completa de cada una; `db:reset` deja 4
  borradores de ejemplo.
- **Archivos afectados:** `apps/api/src/modules/jobs/*`, `apps/api/src/db/seed.ts`
- **Commit:** `e21a90c`
- **Desviaciones del PRD:** Ninguna

### 2026-10-06 — TASK-05: editar y borrar
- **Tipo:** feature
- **Qué se entregó:** el reclutador corrige un borrador (gana la última edición) y lo borra.
- **Archivos afectados:** `apps/api/src/modules/jobs/*` — `PATCH` y `DELETE`
- **Commit:** `98a65e0`
- **Desviaciones del PRD:** Ninguna

### 2026-10-06 — TASK-06 y TASK-07: la API frente a entradas hostiles y fallos
- **Tipo:** test
- **Qué se entregó:** pruebas de JSON roto, campos de solo lectura, inyección SQL, fallos de la base, borrados dobles,
  IDs malformados y enumeración de IDs (EC-32, añadido en la review con `apps/api/src/listen-options.ts`).
- **Archivos afectados:** `apps/api/test/jobs/{create-adversarial,update,delete,list,get,enumeration}.test.ts`,
  `apps/api/src/listen-options.ts`, `apps/api/src/server.ts`
- **Commit:** `4168da7`, `942bad9` · `53304b9`, `856dab0` (review)
- **Desviaciones del PRD:** Ninguna

### 2026-10-06 — TASK-08 a TASK-13: la web de ofertas
- **Tipo:** feature
- **Qué se entregó:** listado como pantalla de entrada, ficha, alta, edición y borrado con un diálogo de confirmación
  accesible; fechas en Europe/Madrid; errores de la API junto a cada campo; estado de la API en el pie.
- **Archivos afectados:** `apps/web/src/components/*`, `apps/web/src/features/jobs/*`, `apps/web/src/App.tsx`,
  `apps/web/src/main.tsx`, `apps/web/src/styles.css`
- **Commit:** `8c9f025`, `f2c3248`, `d5051e9`, `3680cfb`, `ea0d848`, `f9b9464` · `9dcb10b`, `dee9390` (review)
- **Desviaciones del PRD:** Ninguna

### 2026-10-06 — TASK-14 y TASK-15: la web frente a casos hostiles y recorridos e2e
- **Tipo:** test
- **Qué se entregó:** dobles clics, ofertas borradas, respuestas inesperadas y HTML como texto; 11 recorridos e2e sobre
  una base que se regenera en cada ejecución.
- **Archivos afectados:** `apps/web/test/features/jobs/*`, `e2e/jobs.spec.ts`, `playwright.config.ts`, `docs/SETUP.md`
- **Commit:** `1d3fa03`, `21c4a46`
- **Desviaciones del PRD:** Ninguna
