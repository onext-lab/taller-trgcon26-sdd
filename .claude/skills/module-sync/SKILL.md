---
name: module-sync
description: Actualiza functional.md, technical.md y los casos de uso del módulo, y su fila de MVP-STATUS.md, con lo que entregó una HU aprobada. Úsala tras /reviewer aprobado y el merge.
---

# module-sync

> **Dos documentos por módulo, ni más ni menos:**
> - **`docs/05_modules/{módulo}/functional.md`**: propósito, capacidades con estado (`✅/🚧/⬜`), alcance no implementado, actores, reglas de negocio con su estado real, dependencias entre módulos, cuestiones abiertas y **estado vivo del MVP** (% MVP, conteo, backlog e historial por HU).
> - **`docs/05_modules/{módulo}/technical.md`**: foto técnica para los arquitectos: estructura de código real, tablas y migraciones, endpoints, componentes y pantallas, validación y errores, convenciones, gotchas, deuda técnica y requisitos no funcionales.
>
> Además, el **catálogo de casos de uso** del módulo (`docs/05_modules/{módulo}/casos-de-uso/`, un `UC-NN-slug.md` por caso y su índice `README.md`): los crea `/feature-shaping` y este skill mantiene su estado y su trazabilidad.
>
> La carpeta de docs de cada módulo y su código salen de la tabla de `docs/_modules.md` (`candidatos` ↔ `candidates`, `ofertas` ↔ `jobs`, `inscripciones` ↔ `applications`).

## Propósito

Cierra el bucle de aprendizaje del flujo. Cuando una HU pasa `/reviewer` con veredicto aprobado y se mergea en `main`, este skill toma lo que aportó (tablas, endpoints, pantallas, convenciones, gotchas, capacidades cerradas) y **actualiza los dos documentos del módulo** para que:
- los arquitectos tengan la foto técnica al día y no propongan crear lo que ya existe, y
- el `product-owner` vea qué hace hoy el módulo, qué falta y el % MVP.

**No escribe changelog**: la historia vive en la carpeta de la HU y en git. Aquí solo se mantiene el **estado actual**.

## Uso

```
/module-sync HU-NN
```

`/reviewer` lo sugiere al acabar con veredicto `Aprobado` o `Aprobado con observaciones`.

## Idioma

Castellano de España, sin voseo. Identificadores y nombres de fichero en inglés.

## Pre-flight checks (bloquean)

1. **Review aprobada.** Lee `docs/03_delivery/hu/HU-NN-slug/review/REVIEW.md`. Si no existe → STOP: *«Ejecuta `/reviewer HU-NN` primero.»* Si el `VERDICT:` es `Requiere cambios` → STOP: *«La HU no está entregada; corrige y vuelve a pasar review.»*
2. **Mergeada en `main`.** `git branch --merged main` incluye `hu/HU-NN-slug`. Si no → STOP: los documentos del módulo describen `main`, no una rama.
3. **¿Existen los dos documentos?** Si falta alguno (caso residual: un módulo nuevo, con solo su `README.md`), ejecuta antes el **Paso 0**.

## Paso 0 — Crear `functional.md` y `technical.md` (cuando falten)

No copies una plantilla vacía: construye el documento con **evidencia real** y distingue lo **implementado** de lo **especificado pero no construido**.

1. **Código del módulo** (`Glob` y `Read`): `apps/api/src/modules/{módulo-código}/` (rutas, esquemas JSON, acceso a datos), las migraciones de `apps/api/src/db/migrations/` que crean sus tablas, `apps/web/src/features/{módulo-código}/` (pantallas y formularios) y sus tests.
2. **Uso real** (`Grep`): dónde se registran sus rutas en `apps/api/src/app.ts`, qué otros módulos lo importan y qué pantallas lo llaman. Lo que nadie usa es latente: dilo.
3. **HU cerradas** que lo tocaron: `docs/03_delivery/hu/completadas/` y las activas en `docs/03_delivery/hu/` (`hu.md`, `specs/PRD.md`, `review/REVIEW.md`).
4. **Fuentes transversales**: `docs/ARCHITECTURE.md`, `docs/07_architecture_principles/DECISIONS.md`, `docs/RGPD.md` (si trata datos personales) y `docs/_modules.md`.

Presenta al usuario el **esquema y los hallazgos clave** (no el documento entero), aplica la verificación de rutas del Paso 4 y, con su OK, escribe los dos ficheros. `functional.md` enlaza el catálogo `casos-de-uso/README.md` en su sección de capacidades. Después, sustituye el `README.md` «pendiente» del módulo por un enlace a los dos documentos (o bórralo con `git rm`, con confirmación).

## Workflow de sincronización

### Paso 1 — Lo que aporta la HU

- `docs/03_delivery/hu/HU-NN-slug/specs/PRD.md`: qué se prometió.
- `docs/03_delivery/hu/HU-NN-slug/plans/TECHNICAL_DOC*.md`: qué se diseñó (fullstack: `-backend` y `-frontend`).
- `docs/03_delivery/hu/HU-NN-slug/CHANGELOG.md`: qué se entregó.
- `docs/03_delivery/hu/HU-NN-slug/review/REVIEW.md`: qué se confirmó y qué quedó parcial (incluida la columna UC de la tabla criterio → test).
- `docs/03_delivery/hu/HU-NN-slug/hu.md` → `## Casos de uso`: qué UC y flujos cubre la HU.

### Paso 2 — Estado actual del módulo

**Lee por secciones, no los ficheros enteros**: saca el índice con `Grep` del patrón `^## ` y lee con `offset`/`limit` solo lo que necesitas (tablas, endpoints, pantallas, convenciones, gotchas, deuda; capacidades, reglas y la cabecera del estado vivo con la última fila del historial). Lee también la fila del módulo en `docs/MVP-STATUS.md`. Si no localizas una sección, léela entera y **dilo** en la propuesta.

### Paso 3 — Calcular el diff propuesto, por documento destino

**→ `technical.md`:** tablas y columnas (`add`/`update`/`remove`), endpoints, pantallas y componentes, estructura de código (solo carpetas nuevas o renombradas), convenciones del **módulo** (no de una HU), gotchas con evidencia (REVIEW) y deuda técnica (abierta o resuelta).

**→ `functional.md`:** capacidades (`⬜ → 🚧 → ✅` según el REVIEW), estado de las reglas de negocio, dependencias que pasan de latentes a reales y el estado vivo del MVP: `% MVP = round((✅ + 0,5·🚧) / total · 100)`, conteo y **una** fila nueva de historial.

**→ `casos-de-uso/`:** por cada UC que cubre la HU:
- `estado`: **`implementado`** si todos sus flujos tienen test en verde según el REVIEW; si quedan flujos para otra HU, sigue **`aprobado`**; si la HU lo deja sin sentido, **`obsoleto`** (nunca se borra).
- `hus:` incluye la HU; la tabla «Trazabilidad» queda completa (flujo · HU · CA · test).
- La fila del índice `casos-de-uso/README.md` (estado y HU) coincide con el frontmatter.

**→ `docs/MVP-STATUS.md`:** la fila del módulo (% + conteo + HU cerradas), con el enlace a `functional.md`.

Filtro de calidad: una convención de una HU no es del módulo («el formulario de HU-03 usa un modal» no lo es; «todos los listados de candidatos excluyen a los anonimizados» sí puede serlo). Un gotcha sin evidencia no entra. Las tablas, endpoints y estados de capacidad son hechos: se reportan tal cual dice el REVIEW.

### Paso 4 — Gate: rutas que no existen (BLOQUEANTE)

Antes de presentar el diff, **verifica con `Read`/`Glob`** cada ruta citada (siempre relativa a la raíz del repo). Si alguna no existe → bloquea: *«La ruta `{ruta}` del diff no existe en el repo.»* Si hay una ruta absoluta (`/Users/…`, `C:\…`) → bloquea y pide la relativa.

### Paso 5 — Presentar el diff (gate humano OBLIGATORIO)

```
═══ DIFF propuesto — docs/05_modules/{módulo}/{functional,technical}.md [+ docs/MVP-STATUS.md] ═══
technical.md · TABLAS
  + candidates (migración NNN-candidates.sql)
technical.md · ENDPOINTS
  + GET  /api/candidates?q=&skill=   Búsqueda por texto y skill
  ~ PATCH /api/candidates/:id        Ahora valida el consentimiento
technical.md · CONVENCIONES (candidatas: decides tú)
  ? Los listados excluyen a los candidatos anonimizados   Origen: TECHNICAL_DOC, DD-02
functional.md · CAPACIDADES / ESTADO MVP
  % MVP: ~40% → ~60%   Conteo: 2✅/1🚧/2⬜ → 3✅/1🚧/1⬜
  · «Búsqueda de candidatos» ⬜ → ✅ (REVIEW: entregado)
  Historial: + | 2026-10-13 | HU-03 | Alta, edición y búsqueda | ~60% |
casos-de-uso · UC-NN-alta-de-candidato
  estado: aprobado → implementado   hus: [HU-NN]   Trazabilidad P, A1, E1 completa
MVP-STATUS.md: fila de candidatos actualizada
═══════════════════════════════════════════════════════════════════════════════
```

Pregunta: *«Responde **`aprobado`** (aplico todo), **`solo factual`** (sin convenciones ni gotchas candidatos), **ajustes en texto** o **`abortar`**.»* **STOP y espera.**

### Paso 6 — Aplicar

**Reemplazos, no añadidos**: los dos documentos son el estado actual, no un log. La única excepción es el historial del MVP, que suma **una** fila. No toques «Propósito» ni «Alcance objetivo» salvo que la HU cambie el alcance del módulo. Si una sección pasa de 8 elementos o un documento de 500 líneas, sugiere partirlo.

Después, relee lo tocado (tablas sin romper, sin duplicados, conteos que cuadran), pasa `npm run check:harness` (enlaces) y haz commit en `main`, nombrando `functional.md`, `technical.md`, `casos-de-uso/` (UC e índice) y `docs/MVP-STATUS.md`: `docs(HU-NN): module-sync {módulo}`.

### Paso 7 — Resumen

Cambios por categoría, rutas tocadas y `% MVP` antes → después: *«`docs/05_modules/{módulo}/` sincronizado hasta HU-NN (~{%} MVP).»*

## Reglas duras

- **Dos ficheros por módulo**: `functional.md` y `technical.md`, más el catálogo `casos-de-uso/` (estado y trazabilidad de cada UC; nunca se borra un UC: pasa a `obsoleto`).
- **Crear = análisis con evidencia**, nunca una plantilla vacía; marca lo latente.
- **El estado de las capacidades lo dice el REVIEW**, no tu opinión: «Aprobado con observaciones» con un hueco → 🚧.
- **Verificación de rutas obligatoria** (Paso 4).
- **Gate humano** antes de aplicar, al crear y al sincronizar.
- **No toques `docs/_modules.md`** salvo que la HU cree un módulo o una ruta de código nueva.
- Si se invoca solo para frontend, no toques las secciones de backend (y al revés).

## Cuándo NO eres tú

- Discovery → `/feature-shaping`. PRD → `/prd-writer`. Diseño → `/tech-design`. Tareas → `/task-planner`. Review → `/reviewer`.
