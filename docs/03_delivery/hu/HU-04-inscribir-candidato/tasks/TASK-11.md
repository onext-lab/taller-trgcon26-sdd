# TASK-11 — Pantalla del pipeline y enlace «Ver pipeline»

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-07; RNF-06, RNF-07)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
La pantalla `/jobs/:id/pipeline` sin el panel de inscribir (TASK-12) y el enlace desde la ficha de la oferta.

1. **`applications/PipelineBoard.tsx`** (nuevo, presentacional): 6 `section aria-labelledby` → `h2` en orden (Recibida,
   Cribado, Entrevista, Oferta, Contratado, Rechazado) sobre `groupByStage`; cada una con una lista de `PipelineCard`
   o «Sin candidatos.». La tarjeta es un `<li>` con el nombre en un `<p>` (**texto JSX, sin `<a>`**, DT-01),
   «Último cambio: `<time dateTime>`dd/mm/aaaa`</time>`» (`formatDate`, Europe/Madrid) y, solo en `rejected`,
   «Motivo: {etiqueta}». Pinta solo esos campos aunque el elemento traiga más.
2. **`applications/PipelineScreen.tsx`** (nuevo): `PipelineScreen` (ruta; props `jobPath` y `notFound`;
   `parsePipelineJobId` → ID no válido = `props.notFound` **sin petición**), `PipelineLoader key=id`
   (`useResource(getPipeline)`) y `PipelineContent` (por estado de la oferta):
   - cargando → «Cargando el pipeline…» (`status`);
   - error 404 o 400 → `props.notFound` (DD-09); otro error → `ErrorMessage` con `userMessage(error)` + «Reintentar»;
   - `draft` → «Esta oferta es un borrador: publícala para inscribir candidatos.», sin columnas ni botón (DT-03);
   - `published` → botón «Inscribir candidato» (sin panel todavía: `aria-expanded="false"`; el panel y
     `aria-controls` llegan en TASK-12) y, vacía, «Todavía no hay candidatos inscritos en esta oferta.»; con datos,
     `PipelineBoard`;
   - `closed` → lo mismo sin botón.
   Cabecera: `h1` «Pipeline de la oferta» (`tabIndex -1`) y `Link` «Volver a la oferta» (`props.jobPath(id)`).
3. **`apps/web/src/App.tsx`**: en `ROUTES`, `{ pattern: PIPELINE_ROUTE, title: 'Pipeline de la oferta', element:
   <PipelineScreen jobPath={jobPaths.detail} notFound={<NotFoundScreen />} /> }` tras `/jobs/:id/edit`. El título es
   constante en todos los estados («Pipeline de la oferta · ATS»).
4. **`apps/web/src/features/jobs/JobActions.tsx`**: en `published`, `<Link to={pipelinePath(job.id)}>Ver pipeline</Link>`
   como **primer** control de `.actions` (importa de `applications/paths.ts`). `draft` y `closed` sin cambios.
5. **`apps/web/src/styles.css`**: `.pipeline` (rejilla de 6 columnas con `overflow-x: auto`) y `.pipeline-card`.
6. **Tests** (`expectFocusOn` en todo foco movido por un efecto):
   - `apps/web/test/features/applications/fixtures.ts`: añade `renderPipeline(path, routes)`.
   - `apps/web/test/features/applications/PipelineScreen.test.tsx` (columnas y tarjetas): «CA-12 6 region en orden con
     sus nombres; tarjeta con nombre sin link, fecha y motivo solo en Rechazado; orden recibido»; «Sin candidatos.» en
     columna vacía; «EC-36 2026-12-31T23:30:00.000Z → 01/01/2027»; «EC-27 200 tarjetas en una columna, sin paginar»;
     «EC-30 un elemento con email, phone o note de más → no se pinta».
   - `apps/web/test/features/applications/PipelineScreen.states.test.tsx` (estados): cargando; «CA-14 published vacía con
     el mensaje y el botón»; «CA-26 draft con el mensaje sin region ni botón; closed con columnas sin botón»; «CA-15
     404 y 400 → Página no encontrada»; «EC-35 /jobs/abc/pipeline → Página no encontrada sin petición»; «CA-16/EC-37 red,
     500 y respuesta no válida → alerta útil sin stack y Reintentar, que repite el GET».
   - `apps/web/test/App.test.tsx`: «Ver pipeline» desde la ficha abre `/jobs/7/pipeline` con el título «Pipeline de la
     oferta · ATS»; `/jobs/abc/pipeline` → «Página no encontrada» sin petición (EC-39 título y URL).
   - **Tests existentes que cambian** (`controls()` de una `published` pasa a `['Ver pipeline', 'Editar', 'Cerrar',
     'Duplicar']`):
     - `apps/web/test/features/jobs/JobDetailScreen.states.test.tsx:77`, y un test nuevo: «Ver pipeline con
       href="/jobs/7/pipeline" solo en published; ausente en draft y closed»;
     - `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx:77` y `:215`, más `:24` (ver Notas);
     - `e2e/jobs-lifecycle.spec.ts:108`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/applications/PipelineBoard.tsx` | crear | Columnas y `PipelineCard` |
| `apps/web/src/features/applications/PipelineScreen.tsx` | crear | Ruta, cargador y contenido por estado |
| `apps/web/src/App.tsx` | modificar | Ruta del pipeline en `ROUTES` |
| `apps/web/src/features/jobs/JobActions.tsx` | modificar | «Ver pipeline» en `published` |
| `apps/web/src/styles.css` | modificar | `.pipeline`, `.pipeline-card` |
| `apps/web/test/features/applications/fixtures.ts` | modificar | `renderPipeline` |
| `apps/web/test/features/applications/PipelineScreen.test.tsx` | crear | Columnas, tarjetas, orden, EC-27, EC-30, EC-36 |
| `apps/web/test/features/applications/PipelineScreen.states.test.tsx` | crear | Estados, CA-14 a CA-16, CA-26, EC-35, EC-37 |
| `apps/web/test/App.test.tsx` | modificar | Navegación y título del pipeline |
| `apps/web/test/features/jobs/JobDetailScreen.states.test.tsx` | modificar | `:77` y un test nuevo del enlace |
| `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx` | modificar | Solo `:24`, `:77` y `:215` |
| `e2e/jobs-lifecycle.spec.ts` | modificar | Solo `:108` |

## Implementa
- RF: RF-07 · RNF: RNF-06 (texto JSX), RNF-07 (6 `region`) · CA: CA-12, CA-14, CA-15, CA-16, CA-26 (web) · Edge cases:
  EC-26 (web), EC-27, EC-29 (web), EC-30 (web), EC-35, EC-36, EC-37, EC-39
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Rutas y títulos, § Pipeline, § Ficha de la oferta, DD-01, DD-08, DD-09,
  § Estrategia de tests (RF-07), § Checklist W2

## Dependencias
- **Depende de:** TASK-05 (endpoint del pipeline), TASK-10
- **Bloquea:** TASK-12, TASK-15

## Criterios de done
- [ ] `npm test -w @ats/web -- applications/PipelineScreen JobDetailScreen App.test` en verde, con **6** ficheros de
      test (2 de `PipelineScreen`, 3 de `JobDetailScreen`, `App.test.tsx`).
- [ ] `npm test -w @ats/web` completo en verde.
- [ ] `npx playwright test e2e/jobs-lifecycle.spec.ts` en verde.
- [ ] `grep -rn dangerouslySetInnerHTML apps/web/src/features/applications` vacío.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/applications/PipelineBoard.tsx apps/web/src/features/applications/PipelineScreen.tsx apps/web/src/App.tsx apps/web/src/features/jobs/JobActions.tsx apps/web/test/features/applications/fixtures.ts apps/web/test/features/applications/PipelineScreen.test.tsx apps/web/test/features/applications/PipelineScreen.states.test.tsx apps/web/test/App.test.tsx apps/web/test/features/jobs/JobDetailScreen.states.test.tsx apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx e2e/jobs-lifecycle.spec.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier; `JobDetailScreen.actions.test.tsx` sigue en **300**.
- [ ] Commit único `feat(web): job pipeline screen and "Ver pipeline" link [HU-04 TASK-11]` cuyo cuerpo cita
      `JobDetailScreen.states.test.tsx:77`, `JobDetailScreen.actions.test.tsx:24`, `:77`, `:215` y
      `e2e/jobs-lifecycle.spec.ts:108`.

## Notas de implementación
- **`JobDetailScreen.actions.test.tsx` está en 300 líneas** y la línea 215 con «Ver pipeline» mediría 102 caracteres
  (`printWidth` 100): Prettier la partiría en 3 y el fichero llegaría a 302. Solución sin crecer: en la línea 24 (hoy
  en blanco, tras `const PUBLISHED`) declara `const PUBLISHED_CONTROLS = ['Ver pipeline', 'Editar', 'Cerrar',
  'Duplicar'];` y úsala en `:77` y `:215`. Las otras dos líneas que cambian (`states:77`, `jobs-lifecycle:108`) caben en
  100 caracteres.
- **Foco:** todo foco movido por un efecto se aserta con `expectFocusOn` (`apps/web/test/helpers/focus.ts`), nunca con
  tiempos fijos.
- **DD-01:** `jobs` importa `pipelinePath` de `applications/paths.ts`; `applications` no importa `features/jobs/`
  (`jobPath` y `notFound` llegan por props desde `App.tsx`). `matchPath` compara segmentos: el orden en `ROUTES` no
  importa.
- La web no reordena (DD-08): el orden lo da la API.
- `NotFoundScreen` de `App.tsx` cubre ID no válido, 400 y 404 (DD-09); el título sigue siendo «Pipeline de la oferta ·
  ATS».
- UC-12 · A1 no tiene código: `CandidateDetails.tsx` ya pinta «Mientras dure el proceso»
  (`apps/web/test/features/candidates/CandidateDetailScreen.test.tsx:183`).
- Datos inventados (`@example.com`).
