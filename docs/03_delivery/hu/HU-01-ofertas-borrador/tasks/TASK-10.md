# TASK-10 — Listado de ofertas como pantalla de entrada, dentro del *shell* de la web

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** frontend
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
La primera pantalla real: el listado de ofertas en `/jobs`, que pasa a ser la entrada de la web (`/` redirige a
`/jobs`). Rebanada completa: *shell* de la aplicación en `App.tsx` (cabecera, navegación, `main`, pie con el estado de
la API) con su tabla de rutas, contenedor `JobListScreen` (carga con `useResource` y `listJobs`) y presentacional
`JobTable`, con los estados cargando, vacío, error y con datos. Actualiza `App.test.tsx` y el *smoke* e2e.

Las rutas `/jobs/new`, `/jobs/:id` y `/jobs/:id/edit` las añaden TASK-11, TASK-12 y TASK-13; hasta entonces caen en
«Página no encontrada». El test adversarial del título con HTML (EC-41) está en TASK-14.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/jobs/JobTable.tsx` | crear | Tabla presentacional (props, sin `fetch`) |
| `apps/web/src/features/jobs/JobListScreen.tsx` | crear | Contenedor: `useResource(listJobs)`, estados y aviso |
| `apps/web/src/App.tsx` | modificar | *Shell* y tabla de rutas (`/` → `/jobs`, `/jobs`, ruta desconocida) |
| `apps/web/test/App.test.tsx` | modificar | Rutas, redirección, página no encontrada y estado de la API en el pie |
| `apps/web/test/features/jobs/JobListScreen.test.tsx` | crear | Estados y datos del listado |
| `e2e/smoke.spec.ts` | modificar | La entrada es el listado: h1 «Ofertas» y «Estado de la API: ok» |

## Implementa
- RF: RF-05 (web) · RNF: RNF-04 (sin `dangerouslySetInnerHTML`), RNF-05 · CA: CA-15, CA-16, CA-17, CA-18 · Edge
  cases: EC-28 (vacío), EC-35, EC-36, EC-37, EC-38
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados (Shell y fila «Listado»), § Diagrama de secuencia
  RF-05, § Error paths (EC-28, EC-35 a EC-38), DD-07, § Estrategia de tests (fila RF-05 y Transversal), § Checklist
  pasos 3 y 4

## Dependencias
- **Depende de:** TASK-04 (`GET /api/jobs` real para el *smoke*), TASK-08, TASK-09
- **Bloquea:** TASK-11

## Criterios de done
- [ ] `/` redirige (con `replace`) a `/jobs`; una ruta desconocida muestra h1 «Página no encontrada» y el enlace «Ir a
      las ofertas»; el pie muestra «Estado de la API: ok».
- [ ] Listado: cargando, vacío (CA-17, EC-28), error con «Reintentar» y sin tabla (CA-18, EC-38), 20 filas sin aviso y
      21 con «Se muestran las 20 más recientes de 21.» (CA-15, EC-35), fecha «07/10/2026» (CA-16, EC-36) y orden
      recibido (EC-37).
- [ ] `npm test -w apps/web -- App.test JobListScreen` en verde, con **2** ficheros de test ejecutados.
- [ ] `npx playwright test e2e/smoke.spec.ts` en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/App.tsx apps/web/src/features/jobs/JobTable.tsx apps/web/src/features/jobs/JobListScreen.tsx apps/web/test/App.test.tsx apps/web/test/features/jobs/JobListScreen.test.tsx e2e/smoke.spec.ts`
      sin errores.
- [ ] Commit único `feat(web): job list as entry screen [HU-01 TASK-10]` nombrando los ficheros.

## Notas de implementación

**Shell** (`App.tsx`):
- `<header>` con «ATS» y `<nav aria-label="Principal">` con el enlace «Ofertas» (`aria-current="page"` en `/jobs`).
- `<main tabIndex={-1}>` con la pantalla. Al **navegar** (no en la primera carga) el foco va a `<main>` y
  `document.title` pasa a «{pantalla} · ATS» (aquí «Ofertas · ATS»).
- `<footer>` con `ApiHealth` (TASK-09).
- Rutas con `usePath` + `matchPath` (TASK-09): `/` → `navigate('/jobs', { replace: true })`; `/jobs` →
  `JobListScreen`; desconocida → h1 «Página no encontrada» + `<Link>` «Ir a las ofertas».

**Listado** (`/jobs`):

| Estado | Qué se ve |
|---|---|
| Cargando | `role="status"` «Cargando ofertas…» |
| Vacío | «Todavía no hay ofertas.» + enlace «Nueva oferta» |
| Error | `role="alert"` con el mensaje (`userMessage`) y botón «Reintentar»; **sin tabla** ni filas a medias |
| Con datos | h1 «Ofertas»; enlace «Nueva oferta» (`/jobs/new`); `<table>` con `<caption>` «Ofertas» y columnas Título (enlace a `/jobs/{id}`), Estado (etiqueta: `draft` → «Borrador») y Fecha (`<time dateTime={referenceDate}>` con `formatDate`). Si `total > items.length`: «Se muestran las 20 más recientes de {total}.» |

- h1 «Ofertas» en todos los estados (lo busca el *smoke*).
- Si llega un aviso en `history.state` («Oferta borrada.»), se muestra con `Notice` (`role="status"`).
- Las filas se pintan **en el orden recibido**, sin reordenar (EC-37).
- Solo interpolación JSX: prohibido `dangerouslySetInnerHTML`, `innerHTML` y `href` construidos con datos de la API
  (salvo el ID numérico).
- Hay dos `role="status"` en la página (listado y `ApiHealth`): en los tests, busca por texto o dentro del contenedor.

**Contrato que consume** (`listJobs` de TASK-08): `{ items: [{ id, title, status, referenceDate }], total, page: 1,
pageSize: 20 }`; sin parámetros de query (darían 400).

**Tests** (Vitest + Testing Library, `fetch` simulado con `apps/web/test/helpers/fetch.ts`, ruta inicial con
`history.replaceState` antes de `render`; `fireEvent`, sin `user-event` ni `jest-dom`):
- `JobListScreen.test.tsx`: cargando; vacío (CA-17); error + «Reintentar» que vuelve a pedir y pinta (CA-18, EC-38);
  20 y 21 elementos (CA-15, EC-35); `referenceDate` `2026-10-06T22:30:00.000Z` → «07/10/2026» (CA-16, EC-36); orden
  recibido (EC-37).
- `App.test.tsx`: `/` → `/jobs` con h1 «Ofertas»; ruta desconocida → «Página no encontrada»; «Estado de la API: ok» en
  el pie (y «sin conexión» si `/api/health` falla, como hoy).
- `e2e/smoke.spec.ts` (DD-07): `page.goto('/')` → `getByRole('heading', { name: 'Ofertas' })` visible y
  `getByText('Estado de la API: ok')` (deja de usar `getByRole('status')`, que ahora no es único).

Datos inventados («Desarrollador/a backend (Node.js)», «Técnica/o de selección»).
