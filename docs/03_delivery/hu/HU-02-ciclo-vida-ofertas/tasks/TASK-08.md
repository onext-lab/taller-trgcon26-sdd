# TASK-08 — Listado con filtros, búsqueda y paginación en la web

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
La pantalla `/jobs` con los filtros en la URL (`/jobs?status=…&q=…&page=…&pageSize=…`, DT-06):
- `JobFilters`: formulario de búsqueda (Estado + «Buscar por título» + «Buscar») y, fuera del formulario, el selector
  «Por página» (20, 50, 100; DT-07).
- `JobPagination`: `<nav aria-label="Paginación">` con «Anterior», «Página X de Y (N ofertas)» y «Siguiente».
- `JobListScreen`: lee `useSearch()`, pide `listJobs(readListQuery(search))`, estados vacíos por caso, error 400 con los
  `details` y «Quitar filtros», foco al h1 tras paginar. Desaparece el aviso «Se muestran las 20 más recientes de N.».
- Estilos de filtros, paginación y separación de `.actions` (todo `styles.css` de la HU va aquí).

Implementa también la validación de `q` al enviar y el estado de error de red; sus casos hostiles (URL manipulada, `q`
con control pegado, API caída al filtrar) los prueba la tarea `[adversarial]` TASK-13.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/jobs/JobFilters.tsx` | crear | Formulario `role="search"` y «Por página» (~120 líneas) |
| `apps/web/src/features/jobs/JobPagination.tsx` | crear | `<nav>` presentacional (~50) |
| `apps/web/src/features/jobs/JobListScreen.tsx` | modificar | Contenedor del listado filtrado (~150) |
| `apps/web/src/styles.css` | modificar | Filtros en línea, `<nav>` de paginación, `.actions` con separación |
| `apps/web/test/features/jobs/JobListScreen.test.tsx` | modificar | Test de 21 ofertas → «Página 1 de 2»; el de 20, sin «Siguiente» |
| `apps/web/test/features/jobs/JobListScreen.filters.test.tsx` | crear | Filtros, paginación, estados vacíos y 400 |

Si `JobListScreen.filters.test.tsx` fuera a pasar de 300 líneas, los tests de paginación van a un hermano
`apps/web/test/features/jobs/JobListScreen.pagination.test.tsx` (crear); el patrón `JobListScreen` lo recoge.

## Implementa
- RF: RF-05 (web) · RNF: RNF-04, RNF-05 · CA: CA-16, CA-17, CA-18, CA-19 a CA-21 (vistos desde la web) · Edge cases:
  EC-34
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Listado (estados, formulario, paginación, URL),
  § Diagrama de secuencia RF-05/RF-06, § Error paths (EC-34), DD-01, DD-02, DD-03, § Estrategia de tests (fila RF-05),
  § Tests de HU-01 que cambian, § Checklist paso 7

## Dependencias
- **Depende de:** TASK-05 (`GET /api/jobs` con filtros), TASK-07 (`useSearch`, `listJobs(query)`, `list-query.ts`)
- **Bloquea:** TASK-13, TASK-14

## Criterios de done
- [ ] CA-16: Estado «Publicada» + «gestion» + «Buscar» → navega a `/jobs?status=published&q=gestion` y pide
      `GET /api/jobs?status=published&q=gestion`; la tabla muestra lo que devuelve la API en ese orden.
- [ ] CA-18: «Siguiente» → `/jobs?status=published&page=2` con el foco en el h1 «Ofertas» al terminar la carga; «Por
      página» 50 → `/jobs?status=published&pageSize=50` (página 1, mismo filtro); el selector ofrece solo 20, 50 y 100
      (más el tamaño válido de la URL si es otro).
- [ ] EC-34: 20 de 20 → «Página 1 de 1 (20 ofertas)» y sin «Siguiente»; 21 → «Página 1 de 2» y «Siguiente».
- [ ] CA-17: página más allá de la última (`items` vacío, `total` > 0) → «Esta página no tiene ofertas.» + «Ir a la
      primera página» (mismos filtros, página 1).
- [ ] Vacío con filtros → «Ninguna oferta cumple los filtros.» + «Quitar filtros» (a `/jobs`); vacío sin filtros →
      «Todavía no hay ofertas.» + «Nueva oferta» (HU-01).
- [ ] CA-19 a CA-21 desde la web: 400 de la API → `role="alert"` con el `message`, un `<ul>` con «{etiqueta}: {mensaje}»
      por cada `details[i]` (`status` → «Estado», `q` → «Buscar por título», `page` → «Página», `pageSize` → «Por
      página») y «Quitar filtros», **sin** «Reintentar».
- [ ] «Atrás» del navegador resincroniza los controles con la URL.
- [ ] `JobListScreen.test.tsx`: el test de 21 ofertas pasa a «Página 1 de 2» + «Siguiente»; el de 20 comprueba que no
      hay «Siguiente»; el resto sigue con `GET /api/jobs` sin query.
- [ ] `npm test -w apps/web -- JobListScreen` en verde, con **2** ficheros de test ejecutados (3 si se creó el hermano
      de paginación).
- [ ] `npm test -w apps/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/jobs/JobFilters.tsx apps/web/src/features/jobs/JobPagination.tsx apps/web/src/features/jobs/JobListScreen.tsx apps/web/test/features/jobs/JobListScreen.test.tsx apps/web/test/features/jobs/JobListScreen.filters.test.tsx`
      sin errores.
- [ ] Commit único `feat(web): job list filters, search and pagination [HU-02 TASK-08]` nombrando los ficheros.

## Notas de implementación

**Estados de `/jobs`:**

| Estado | Qué se ve |
|---|---|
| Siempre | h1 «Ofertas» (`tabIndex={-1}`), aviso de llegada si lo hay, formulario de búsqueda y «Por página» con los valores de la URL |
| Cargando | `role="status"` «Cargando ofertas…»; ni tabla ni `<nav>` |
| Vacío sin filtros | «Todavía no hay ofertas.» + «Nueva oferta» |
| Vacío con filtros (`total` 0 con `status` o `q`) | «Ninguna oferta cumple los filtros.» + «Quitar filtros» |
| Más allá de la última (`items` vacío, `total` > 0) | «Esta página no tiene ofertas.» + «Ir a la primera página» |
| Error 400 | `role="alert"` con el `message` + `<ul>` de `details` con etiquetas + «Quitar filtros»; sin «Reintentar» |
| Red, *timeout*, 5xx, forma inesperada | `ErrorMessage` de HU-01: `role="alert"` + «Reintentar»; los controles conservan sus valores |
| Con datos | «Nueva oferta», `<table>` «Ofertas» (`JobTable` sin cambios) y `<nav aria-label="Paginación">` |

- Las etiquetas de los `details` del 400 viven en `JobListScreen.tsx` (el TD las fija pero no dice dónde).
- «Quitar filtros» usa `clearFiltersPath`, que lleva a `/jobs` (decisión aceptada, TASK-07).

**`JobFilters`** (`<form role="search" aria-label="Filtrar ofertas" noValidate>`):
- `<select name="status">` «Estado»: «Todos» (`''`), «Borrador», «Publicada», «Cerrada».
- `<input type="search" name="q">` «Buscar por título»: sin `maxLength` nativo; al enviar, `validateSearchText`; con
  error, mensaje en `<p id="q-error">`, `aria-invalid`, `aria-describedby="q-error"`, foco en el campo y **sin** navegar.
- `<button type="submit">` «Buscar»: `navigate(listPath({ status, q, pageSize }))`, siempre página 1 (DD-02).
- `<select name="pageSize">` «Por página», **fuera** del `<form>`: al cambiar, navega a la página 1 con los mismos filtros.
- Los controles se inicializan desde `listView(readListQuery(search))` y se **resincronizan** cuando cambia la URL con el
  patrón «ajustar el estado durante el render» (comparar la query anterior), como `useResource`; **no** con `setState`
  en un efecto (`react-hooks/set-state-in-effect`).
- Formulario y «Por página» quedan fuera del bloque que cambia con la carga: al enviar, el foco no se pierde.

**`JobPagination`** (props `page`, `pageSize`, `total`, `pathFor(page)`, `onNavigate`): enlaces `<Link>` «Anterior»
(solo si `page > 1`) y «Siguiente» (solo si `page < totalPages`); texto «Página {page} de {totalPages} ({total}
ofertas)» con `page`, `pageSize` y `total` **de la respuesta**.

**Foco** (DD-03): `onNavigate` marca en un `useRef` del contenedor «enfocar tras cargar»; al terminar la carga
provocada por «Anterior», «Siguiente», «Quitar filtros» o «Ir a la primera página», foco al h1 «Ofertas». El efecto de
foco no llama a `setState`.

**Carga:** `useResource((signal) => listJobs(query, signal), [search])`; la web reenvía solo las 4 claves conocidas en
bruto (DD-01) y no normaliza ni filtra en el cliente.

**Tests** (`mockFetch` con la URL exacta, ruta inicial con `history.replaceState`, consultas por rol: `search` «Filtrar
ofertas», `combobox` «Estado» y «Por página», `searchbox` «Buscar por título», `navigation` «Paginación», `link`
«Anterior»/«Siguiente»/«Quitar filtros»/«Ir a la primera página»). Títulos inventados. `JobTable` no cambia; el texto
sigue siendo interpolación JSX (RNF-04).

## Reapertura · review ronda 1 (2026-10-06)
- **Origen:** `review/REVIEW.md` (ronda 1, `VERDICT: Requiere cambios`), §9.
- **Qué hay que hacer:** CA-18 (decisión de quien aprueba el PRD): la web ofrece solo 20, 50 y 100 en «Por página», alineada con el PRD. Quita la opción extra que hoy añade `apps/web/src/features/jobs/JobFilters.tsx:45` cuando la URL trae un `pageSize` válido distinto de esos tres: en ese caso la interfaz usa 20 (selector y petición). La API sigue aceptando 1-100. Ajusta el test de `apps/web/test/features/jobs/JobListScreen.filters.test.tsx:123` (o donde esté el de `pageSize=7`) para fijar el comportamiento nuevo.
- **Ficheros:** `apps/web/src/features/jobs/JobFilters.tsx` (y `list-query.ts` si la normalización vive ahí), `apps/web/test/features/jobs/JobListScreen.filters.test.tsx`
- **Criterios de done:** `npm test -w @ats/web -- JobListScreen list-query` en verde; `npm run typecheck -w @ats/web`; `npx eslint` de los ficheros tocados.

## Nota · review ronda 1 (2026-10-06)
Los tests de paginación viven en `apps/web/test/features/jobs/JobListScreen.pagination.test.tsx` (umbral de 300 líneas); el patrón `JobListScreen` recoge hoy 4 ficheros (`.test`, `.filters`, `.pagination` y `.filters-adversarial`). En la reapertura, CA-18 se alineó con el PRD: «Por página» ofrece solo 20, 50 y 100.
