# TASK-11 — Ficha de la oferta y borrado con confirmación

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** frontend
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
La ficha `/jobs/:id` con sus acciones de borrador:
- Contenedor `JobDetailScreen` (valida el ID con `parseJobId`, carga con `useResource(getJob)`) y presentacional
  `JobDetails` (todos los campos, «Sin indicar» si no hay valor, texto siempre literal).
- `DeleteJobAction`: botón «Borrar» → `ConfirmDialog` → `DELETE` → listado con «Oferta borrada.».
- Ruta `/jobs/:id` en `App.tsx`.

Los tests adversariales (HTML en la descripción, doble clic en «Borrar oferta», 404 al borrar) están en TASK-14.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/jobs/JobDetails.tsx` | crear | Ficha presentacional (`<dl>`) y acciones por estado |
| `apps/web/src/features/jobs/JobDetailScreen.tsx` | crear | Contenedor: ID, carga, estados, «Oferta no encontrada», aviso |
| `apps/web/src/features/jobs/DeleteJobAction.tsx` | crear | Botón «Borrar» + `ConfirmDialog` + `deleteJob` |
| `apps/web/src/App.tsx` | modificar | Ruta `/jobs/:id` → `JobDetailScreen` |
| `apps/web/test/features/jobs/JobDetailScreen.test.tsx` | crear | Ficha (camino feliz, no encontrada, error) |
| `apps/web/test/features/jobs/DeleteJobAction.test.tsx` | crear | Diálogo y borrado (camino feliz y 500) |

## Implementa
- RF: RF-06, RF-04 (web) · RNF: RNF-04, RNF-05 · CA: CA-13 (web), CA-19, CA-20 (web) · DT-02 · Edge cases: EC-27,
  EC-29, EC-43, EC-44, EC-45
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados (fila «Ficha», avisos, Diálogo de borrado),
  § Diagrama de secuencia RF-04 y RF-05/RF-06, § Error paths (EC-27, EC-29, EC-43 a EC-45), DD-05, § Checklist pasos 5
  y 7

## Dependencias
- **Depende de:** TASK-05 (`DELETE` real), TASK-10 (`App.tsx` y *shell*)
- **Bloquea:** TASK-12

## Criterios de done
- [ ] La ficha muestra h1 = título y un `<dl>` con Estado, Descripción, Ubicación, Modalidad, Banda salarial y Fecha de
      creación (`dd/mm/aaaa`); acciones «Editar» (enlace) y «Borrar» (botón) y **ninguna otra** (CA-19).
- [ ] Un borrador con solo el título muestra «Sin indicar» en los demás campos; ningún «null», «undefined» ni `<dd>`
      vacío (EC-44).
- [ ] 404 de la API, 400 de la API y `/jobs/abc` o `/jobs/1.5` → h1 «Oferta no encontrada», enlace «Volver a las
      ofertas», sin datos ni «Borrar»; con ID no válido, **sin petición** (CA-20, EC-27, EC-43).
- [ ] Red o 5xx → `role="alert"` + «Reintentar», sin datos a medias (EC-45).
- [ ] «Borrar» abre el diálogo «¿Borrar la oferta?» que nombra la oferta, con el foco en «Cancelar»; «Cancelar» no
      llama a la API; «Borrar oferta» → `DELETE` → `/jobs` con «Oferta borrada.» (CA-13).
- [ ] 500 al borrar → `role="alert"` dentro del diálogo, botones reactivados y la oferta sigue en la ficha (EC-29).
- [ ] `npm test -w apps/web -- JobDetailScreen DeleteJobAction App.test` en verde, con **3** ficheros de test
      ejecutados.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/App.tsx apps/web/src/features/jobs/JobDetails.tsx apps/web/src/features/jobs/JobDetailScreen.tsx apps/web/src/features/jobs/DeleteJobAction.tsx apps/web/test/features/jobs/JobDetailScreen.test.tsx apps/web/test/features/jobs/DeleteJobAction.test.tsx`
      sin errores.
- [ ] Commit único `feat(web): job detail screen and delete confirmation [HU-01 TASK-11]` nombrando los ficheros.

## Notas de implementación

**Ficha** (`/jobs/:id`, `document.title` «{título} · ATS»):

| Estado | Qué se ve |
|---|---|
| ID no válido (`parseJobId` → `null`) | «Oferta no encontrada», **sin petición** |
| Cargando | `role="status"` «Cargando la oferta…» |
| 404 o 400 de la API | h1 «Oferta no encontrada», un texto breve sin datos de la oferta y enlace «Volver a las ofertas» (el diseño no fija el texto del párrafo) |
| Red, *timeout*, 5xx o respuesta inesperada | `role="alert"` + «Reintentar», sin datos |
| Con datos | h1 = título; `<dl>`: Estado («Borrador»), Descripción (`white-space: pre-wrap`), Ubicación, Modalidad (etiqueta), Banda salarial (`formatSalaryBand`), Fecha de creación (`<time>` + `formatDate`); «Sin indicar» si no hay valor; acciones «Editar» (`<Link>` a `/jobs/{id}/edit`) y «Borrar» **solo si `status === 'draft'`** |

- `JobDetails` decide las acciones por estado para que HU-02 solo añada las suyas («Publicar», «Duplicar»…).
- Avisos de llegada (`Notice`, `role="status"`): «Oferta creada.» y «Cambios guardados.».
- Texto siempre como interpolación JSX (RNF-04): ni `dangerouslySetInnerHTML` ni `innerHTML`.

**Borrado** (`DeleteJobAction` + `ConfirmDialog` de TASK-09):
- Diálogo: título «¿Borrar la oferta?», texto «Vas a borrar «{título}». No se puede deshacer.», botones «Cancelar»
  (foco inicial, DT-02) y «Borrar oferta».
- «Cancelar» o `Escape` → cierra, el foco vuelve a «Borrar», sin petición.
- «Borrar oferta» → los dos botones `disabled` (con una guarda que impida una segunda llamada) → `deleteJob(id)`
  (`DELETE` sin cuerpo):
  - 204 → `navigate('/jobs', { notice: 'Oferta borrada.' })`.
  - 404 → `role="alert"` «Esta oferta ya no existe.» + enlace «Volver a las ofertas» (lo prueba TASK-14).
  - 500 / red → `role="alert"` en el diálogo con `userMessage`; botones reactivados.

**Tests** (`fetch` simulado, *polyfill* de `apps/web/test/helpers/dialog.ts`, ruta inicial con `history.replaceState`):
- `JobDetailScreen.test.tsx`: ficha completa con «Editar» y «Borrar» y ninguna otra acción (CA-19); «Sin indicar»
  (EC-44); 404 → «Oferta no encontrada» sin datos (CA-20); 400 de la API y `/jobs/abc`, `/jobs/1.5` → «Oferta no
  encontrada», sin «Borrar» y, en los dos últimos, sin llamada a `fetch` (EC-43, EC-27); error + «Reintentar» (EC-45).
- `DeleteJobAction.test.tsx`: diálogo con el nombre de la oferta y foco en «Cancelar» (DT-02); cancelar no llama;
  confirmar → `DELETE /api/jobs/{id}` y navegación a `/jobs` (CA-13); 500 → alerta en el diálogo y botones
  reactivados (EC-29).
- `App.test.tsx`: sigue en verde con la ruta nueva.

Datos inventados («Desarrollador/a backend (Node.js)», «Valencia»).
