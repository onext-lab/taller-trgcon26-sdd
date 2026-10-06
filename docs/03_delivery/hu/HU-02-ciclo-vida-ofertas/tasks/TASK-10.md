# TASK-10 — Publicar y duplicar desde la ficha

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Conecta «Publicar» y «Duplicar» de `JobActions` (TASK-09) con la API, sin confirmación (DT-08):
- Hook `useJobActions` (nuevo): estado en curso, guarda `useRef` contra el doble clic, *ref* del botón pulsado para
  devolverle el foco tras un error y clasificación de errores (400 de campos pendientes, otro 400, 404, 409, red/500).
- Contenedor `JobDetailScreen`: publicar → `setData(job)` + «Oferta publicada.» + foco al h1; duplicar → navega a la
  ficha nueva con «Oferta duplicada.» en `history.state`; errores en la alerta de acción que dejó TASK-09.

Implementa todas las ramas de la tabla de resultados; sus casos hostiles (doble clic, red, 500, 404, 409) los prueba la
tarea `[adversarial]` TASK-13.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/jobs/use-job-actions.ts` | crear | Publicar y duplicar (~120 líneas) |
| `apps/web/src/features/jobs/JobDetailScreen.tsx` | modificar | Usa `useJobActions` y pasa sus callbacks y su estado a `JobActions` (~120 líneas en total) |
| `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx` | crear | Publicar y duplicar (flujos de UC-03 y UC-06) |

## Implementa
- RF: RF-01 (web), RF-04 (web), RF-06 · RNF: RNF-05 · CA: CA-01, CA-03, CA-14, CA-15 (web) · Edge cases: EC-02, EC-26
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Ficha («En curso», «Avisos», «Alerta de acción»,
  «Foco»), § Diagrama de secuencia RF-01 y RF-04, § Error paths (EC-02, EC-26), DD-05, DD-07, § Estrategia de tests
  (filas RF-01 y RF-04), § Checklist paso 4

## Dependencias
- **Depende de:** TASK-09 (`JobActions`, contenedor con aviso local y alerta de acción; por cadena, TASK-02 y TASK-07)
- **Bloquea:** TASK-13, TASK-14

## Criterios de done
- [ ] CA-01: borrador completo → «Publicar» → `POST /api/jobs/{id}/publish` sin cuerpo → «Oferta publicada.»
      (`role="status"`), estado «Publicada», «Fecha de publicación 06/10/2026», solo «Editar», «Cerrar» y «Duplicar», y
      el foco en el h1.
- [ ] CA-03/EC-02: 400 con `details` en `description` y `workMode` → `role="alert"` «Para publicar falta: Descripción,
      Modalidad.» (etiquetas en el orden de `details`) + enlace «Editar»; sigue «Borrador» y «Publicar» habilitado.
- [ ] CA-14/CA-15/EC-26: «Duplicar» → 201 → navega (`push`) a `/jobs/{nuevo}` con «Oferta duplicada.» como único aviso;
      la ficha nueva muestra el título tal cual; la original no se toca (ningún `PATCH`/`POST` sobre ella).
- [ ] Mientras publica, «Publicar», «Duplicar» y «Borrar» están `disabled` y el botón dice «Publicando…» (comprobado con
      una respuesta `{ hang: true }`).
- [ ] `npm test -w apps/web -- JobDetailScreen` en verde, con **3** ficheros de test ejecutados (`JobDetailScreen.test`,
      `.states` y `.actions`).
- [ ] `npm test -w apps/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/jobs/use-job-actions.ts apps/web/src/features/jobs/JobDetailScreen.tsx apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx`
      sin errores.
- [ ] Ninguna función pasa de 50 líneas.
- [ ] Commit único `feat(web): publish and duplicate from the job detail [HU-02 TASK-10]` nombrando los ficheros.

## Notas de implementación

**Resultados** (DD-05, DT-08; todas las filas se implementan aquí):

| Respuesta | Publicar | Duplicar |
|---|---|---|
| 200 / 201 | `setData(job)` + aviso local «Oferta publicada.» + foco al h1 | `navigate(jobPaths.detail(nuevo.id), { notice: 'Oferta duplicada.' })` (`push`; «Atrás» vuelve a la original) |
| 400 con todos los `details[].field` en `title`/`description`/`location`/`workMode` | «Para publicar falta: …» (`missingFieldsText`) + enlace «Editar» | — |
| Otro 400 | su `message` | su `message` |
| 409 | `message` + `retry()` de la oferta | — |
| 404 | «Esta oferta ya no existe.» + «Volver a las ofertas», sin acciones | ídem |
| Red, *timeout* o 500 | `userMessage(error)`; botón reactivado y con el foco | ídem |

- **En curso:** «Publicar», «Duplicar», «Cerrar» y «Borrar» `disabled` (`DeleteJobAction` ya acepta `disabled` desde
  TASK-09); el pulsado cambia a «Publicando…» o «Duplicando…». Guarda `useRef` además del `disabled` (un segundo clic
  antes del re-render no envía otra petición).
- **Foco** (DD-07): éxito → h1 de la ficha; error que deja el botón → ese botón (*ref* en `useJobActions`); duplicar
  cambia de ruta y el foco va a `<main>` (`useNavigationFocus` de HU-01).
- El `key={id}` de `JobDetailLoader` (TASK-09) evita que «Oferta publicada.» o la alerta pasen a la copia.
- Errores: `ApiError` de `apps/web/src/components/http.ts` (`status`, `message`, `details`).

**Tests** (`mockFetch`; ruta inicial `/jobs/7` con `history.replaceState`): «CA-01 publicar → ficha publicada con fecha
y 3 acciones», «CA-03/EC-02 campos pendientes → lista y Editar», «CA-14/CA-15 duplicar → ficha nueva con Oferta
duplicada.», «acciones deshabilitadas mientras publica». Datos inventados («Técnica/o de selección», «Valencia»).
