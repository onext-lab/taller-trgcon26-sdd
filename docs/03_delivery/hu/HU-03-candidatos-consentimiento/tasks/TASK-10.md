# TASK-10 — Listado y búsqueda de candidatos en la web

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-04 web; RNF-07, RNF-09)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
Pantalla `/candidates` con el patrón contenedor → presentacionales de ofertas, pero **con la búsqueda fuera de la URL**
(DT-10 c, DD-01):
- `list-state.ts`: la búsqueda **aplicada** (`q`, `skill`, `page`, `pageSize`) vive en una variable del módulo;
  `readListState()` al montar y `saveListState(q)` en cada búsqueda, cambio de página o de tamaño. Nada en la URL, en
  `history.state` ni en el almacenamiento del navegador; recargar empieza vacío.
- `CandidateListScreen` (contenedor con `useResource` y `useDocumentTitle('Candidatos')`), `CandidateFilters`
  (`<form role="search" aria-label="Buscar candidatos" noValidate>` con «Buscar por nombre o email», «Skill» y
  «Buscar»; `PageSizeSelect` fuera del `<form>`), `CandidateTable` (`<caption>` «Candidatos»; columnas «Nombre y
  apellidos» con enlace a la ficha, «Email» y «Skills») y `Pagination` con **botones** (DD-02).
- `App.tsx`: ruta `/candidates` y enlace «Candidatos» en `<nav aria-label="Principal">` tras «Ofertas», con
  `aria-current="page"` en el listado.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/candidates/list-state.ts` | crear | `CandidateListQuery`, `INITIAL_LIST_QUERY`, `readListState`, `saveListState` (~30) |
| `apps/web/src/features/candidates/CandidateTable.tsx` | crear | Tabla «Candidatos» (~45) |
| `apps/web/src/features/candidates/CandidateFilters.tsx` | crear | Formulario de búsqueda y «Por página» (~110) |
| `apps/web/src/features/candidates/CandidateListScreen.tsx` | crear | Contenedor del listado (~170) |
| `apps/web/src/App.tsx` | modificar | Ruta `/candidates`, título «Candidatos» y enlace en la navegación |
| `apps/web/test/features/candidates/CandidateListScreen.test.tsx` | crear | Estados, CA-15, CA-16, CA-18, CA-21, EC-28, EC-30 |
| `apps/web/test/features/candidates/CandidateListScreen.filters.test.tsx` | crear | CA-17, CA-19, DD-01 (restaurar sin URL) |
| `apps/web/test/App.test.tsx` | modificar | Enlace «Candidatos» y título «Candidatos · ATS» al navegar |

## Implementa
- RF: RF-04 (web) · CA: CA-15 a CA-19, CA-21 · Edge cases: EC-28, EC-30 · RNF-07, RNF-09 (listado)
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Listado, § Accesibilidad que usan los tests, DD-01,
  DD-02, DD-07, § Estrategia de tests (RF-04), § Checklist W2

## Dependencias
- **Depende de:** TASK-05 (`GET /api/candidates`), TASK-09 (piezas compartidas y cliente)
- **Bloquea:** TASK-14, TASK-15

## Criterios de done
- [ ] Estados: cargando (`role="status"` «Cargando candidatos…», sin tabla ni paginación); vacío sin filtros
      «Todavía no hay candidatos.»; vacío con filtros «Ningún candidato coincide con la búsqueda.» (CA-18); error con
      `role="alert"` y «Reintentar»; con datos.
- [ ] CA-16: sin filtros pide exactamente `/api/candidates`. CA-15: tres columnas, skills unidas por «, » y vacías
      «Sin indicar», en el orden recibido.
- [ ] CA-17: `q` «jose» + skill «SQL» → pide `/api/candidates?q=jose&skill=SQL` (la API pasa la skill a minúsculas).
- [ ] CA-19: «Siguiente» → `page=2`, «Página 2 de 2» y foco en el h1 al terminar la carga; «Por página» 100 →
      `pageSize=100` y página 1 con la búsqueda **aplicada** (no los borradores).
- [ ] EC-28: `q` solo con espacios → sin `q`; 20 sin «Siguiente»; 21 → «Página 1 de 2».
- [ ] CA-21 / EC-30: red caída → «Reintentar» repite **la misma URL** y los campos conservan lo escrito.
- [ ] DD-01 / RNF-09: desmontar y volver a montar la pantalla restaura `q`, skill, página y tamaño; `location.search`
      sigue vacío, `history.state` no contiene `q` y `document.title` es «Candidatos · ATS».
- [ ] `autoComplete="off"` en «Buscar por nombre o email» y «Skill» (DD-07).
- [ ] `App.test.tsx`: enlace «Candidatos» en «Principal» con `aria-current="page"` en `/candidates`.
- [ ] `npm test -w @ats/web -- CandidateListScreen App.test` en verde, con **3** ficheros de test.
- [ ] `npm test -w @ats/web` completo en verde (ofertas sin cambios).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/candidates/list-state.ts apps/web/src/features/candidates/CandidateTable.tsx apps/web/src/features/candidates/CandidateFilters.tsx apps/web/src/features/candidates/CandidateListScreen.tsx apps/web/src/App.tsx apps/web/test/features/candidates/CandidateListScreen.test.tsx apps/web/test/features/candidates/CandidateListScreen.filters.test.tsx apps/web/test/App.test.tsx`
      sin errores.
- [ ] Commit único `feat(web): candidate list and search [HU-03 TASK-10]` nombrando los ficheros.

## Notas de implementación
- Validación de los filtros en cliente (sin petición si falla; error en `<p id="…-error">` con `aria-describedby`,
  `aria-invalid` y foco): `q` con `validateSearchText` (≤ 100, sin control); skill con `validateFilterText` (≤ 40, sin
  control) y textos «La skill no puede pasar de 40 caracteres.» / «La skill no puede tener caracteres de control.».
  Sus casos hostiles se prueban en TASK-14.
- `Pagination` con `renderStep(target, label)` → `<button type="button">`; `page`, `pageSize` y `total` **de la
  respuesta**. La página de más no se alcanza desde la interfaz.
- `beforeEach` de los tests: `saveListState(INITIAL_LIST_QUERY)` (el estado del módulo sobrevive entre tests).
- `App.tsx`: el título lo fija `resolveScreen` al navegar y la pantalla con `useDocumentTitle` en la carga directa;
  nunca lleva un nombre. TASK-11 y TASK-12 también tocan `App.tsx`: no van en paralelo con esta.
- Datos inventados con `@example.com`.
