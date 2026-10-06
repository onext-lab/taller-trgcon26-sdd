# TASK-09 — Ficha por estado y cierre con confirmación

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
La ficha `/jobs/:id` pasa a decidir sus acciones por estado y gana el cierre:
- `JobDetails` queda **solo presentación**: h1 con `tabIndex={-1}` y `headingRef`, `<dl>` con las fechas de creación,
  publicación y cierre que tenga, y el aviso de solo lectura de una `closed`.
- `JobActions` (nuevo) pinta las acciones por estado (RF-06). «Publicar» y «Duplicar» se pintan con sus props de
  callback y estado en curso, pero **los conecta TASK-10** (intermedio previsto en el TD, § Checklist paso 3).
- `CloseJobAction` (nuevo): botón «Cerrar» + `ConfirmDialog` que pide el número de inscripciones activas
  (`close-preview`) y, al confirmar, `POST …/close`.
- Contenedor `JobDetailScreen`: `JobDetailLoader key={id}`, aviso local («Oferta cerrada.»), alerta de acción bajo las
  acciones (409 → `message` + recarga; red/500 → `userMessage`), salida «Esta oferta ya no existe.» y foco al h1. TASK-10
  reutiliza esta fontanería para publicar y duplicar.
- `DeleteJobAction` gana `disabled?` para que «Borrar» se deshabilite mientras otra acción está en curso (decisión
  aceptada: el TD lo pide pero solo listaba `onConflict`; su `onConflict` es de TASK-11).

Implementa todas las ramas del diálogo (error al pedir el número, 409, 404, doble clic); sus casos hostiles, junto con el
HTML en el título de una cerrada, los prueba la tarea `[adversarial]` TASK-12.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/jobs/JobDetails.tsx` | modificar | Solo presentación; fechas; aviso de solo lectura; `headingRef` (~60 líneas). `JobActions` sale de aquí |
| `apps/web/src/features/jobs/JobActions.tsx` | crear | Acciones por estado (~80) |
| `apps/web/src/features/jobs/CloseJobAction.tsx` | crear | «Cerrar» + diálogo; hooks internos `useClosePreview` y `useCloseJob` (~140) |
| `apps/web/src/features/jobs/JobDetailScreen.tsx` | modificar | `key={id}`, aviso local, alerta de acción, «ya no existe», foco al h1 |
| `apps/web/src/features/jobs/DeleteJobAction.tsx` | modificar | Prop `disabled?` (solo el botón «Borrar») |
| `apps/web/test/features/jobs/JobDetailScreen.test.tsx` | modificar | Línea 69 (CA-19 de HU-01): el borrador muestra 4 controles (CA-23) |
| `apps/web/test/features/jobs/JobDetailScreen.states.test.tsx` | crear | Estados de la ficha (hermano: `JobDetailScreen.test.tsx` está a 231 líneas y pasaría de 300) |
| `apps/web/test/features/jobs/CloseJobAction.test.tsx` | crear | Diálogo de cierre (flujos de UC-04) |

## Implementa
- RF: RF-02 (web), RF-06, RF-03 (sin «Editar» ni «Borrar» por estado) · RNF: RNF-04, RNF-05 · CA: CA-05, CA-06, CA-09
  (web), CA-10 y CA-13 (fichas), CA-22, CA-23 · Edge cases: EC-04, EC-11, EC-12, EC-13, EC-24 (web), EC-42
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Ficha y Diálogo de cierre, § Diagrama de secuencia
  RF-02, § Error paths (EC-04, EC-11 a EC-13, EC-24, EC-42), DD-04, DD-05, DD-06, DD-07, § Estrategia de tests (filas
  RF-02 y RF-06), § Checklist pasos 3 y 5

## Dependencias
- **Depende de:** TASK-02 (`close-preview` y `close`), TASK-07 (`setData`, `ConfirmDialog`, `closeJob`,
  `getClosePreview`, `activeApplicationsText`)
- **Bloquea:** TASK-10, TASK-11, TASK-12

## Criterios de done
- [ ] CA-23: un borrador muestra solo «Fecha de creación» y, en este orden, el enlace «Editar» y los botones «Publicar»,
      «Borrar» y «Duplicar» (ninguna otra acción); cambia el test de `JobDetailScreen.test.tsx:69`.
- [ ] Una publicada muestra «Fecha de creación» y «Fecha de publicación» y solo «Editar», «Cerrar» y «Duplicar».
- [ ] CA-22/EC-42: una `closed` (creación 30/09, publicación 01/10 y cierre 06/10/2026) muestra las tres fechas en
      `dd/mm/aaaa`, el párrafo «Esta oferta está cerrada y no se puede modificar. Para volver a publicarla, duplícala.» y
      solo «Duplicar» (sin «Editar» ni «Borrar»: CA-10, CA-13, EC-24).
- [ ] EC-04/EC-11: `publishedAt`/`closedAt` `2026-10-06T22:30:00Z` → «07/10/2026».
- [ ] CA-05/EC-11: «Cerrar» abre «¿Cerrar la oferta?» con el foco en «Cancelar», «Comprobando las inscripciones
      activas…» y «Cerrar oferta» deshabilitado; al llegar el número, «Se rechazarán 0 inscripciones activas.» y «Cerrar
      oferta» habilitado; confirmar → `POST /api/jobs/{id}/close` sin cuerpo → la ficha pasa a «Cerrada», con «Fecha de
      cierre», «Oferta cerrada.» (`role="status"`) y el foco en el h1.
- [ ] CA-06: «Cancelar» y `Escape` (`simulateCancel` del *polyfill*) cierran sin `POST`, abortan la lectura del número y
      devuelven el foco a «Cerrar».
- [ ] CA-09/EC-12: 500 al cerrar → `role="alert"` dentro del diálogo, botones reactivados y la ficha sigue «Publicada»
      sin «Fecha de cierre».
- [ ] EC-13: un 200 con el `closedAt` de un cierre anterior se trata como éxito y se pinta esa fecha.
- [ ] `npm test -w apps/web -- JobDetailScreen CloseJobAction DeleteJobAction` en verde, con **4** ficheros de test
      ejecutados (`JobDetailScreen` recoge `JobDetailScreen.test.tsx` y `JobDetailScreen.states.test.tsx`).
- [ ] `npm test -w apps/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/jobs/JobDetails.tsx apps/web/src/features/jobs/JobActions.tsx apps/web/src/features/jobs/CloseJobAction.tsx apps/web/src/features/jobs/JobDetailScreen.tsx apps/web/src/features/jobs/DeleteJobAction.tsx apps/web/test/features/jobs/JobDetailScreen.test.tsx apps/web/test/features/jobs/JobDetailScreen.states.test.tsx apps/web/test/features/jobs/CloseJobAction.test.tsx`
      sin errores.
- [ ] Ninguna función pasa de 50 líneas (el umbral que reabrió `DeleteJobAction` en HU-01).
- [ ] Commit único `feat(web): job detail by status and close confirmation [HU-02 TASK-09]` nombrando los ficheros.

## Notas de implementación

**Ficha con datos:**

| Estado | `<dl>` (fechas en `<time>`, `formatDate`, Europe/Madrid) | Acciones, en este orden | Extra |
|---|---|---|---|
| `draft` | …, «Fecha de creación» | enlace «Editar», botón «Publicar», botón «Borrar», botón «Duplicar» | — |
| `published` | …, «Fecha de creación», «Fecha de publicación» | enlace «Editar», botón «Cerrar», botón «Duplicar» | — |
| `closed` | …, «Fecha de creación», «Fecha de publicación», «Fecha de cierre» | botón «Duplicar» | «Esta oferta está cerrada y no se puede modificar. Para volver a publicarla, duplícala.» |

- Una fecha `null` no se pinta (ni «Sin indicar»).
- `JobActions` recibe la oferta, el estado en curso (`pending`: qué acción está en marcha, para deshabilitar «Publicar»,
  «Duplicar», «Cerrar» y «Borrar» y rotular «Publicando…»/«Duplicando…»), los callbacks de publicar/duplicar (los pasa
  TASK-10) y los de cierre/conflicto del contenedor; renderiza `CloseJobAction` y `DeleteJobAction` (con `disabled`).

**Diálogo de cierre** (DD-04, DT-08; `CloseJobAction` sobre `ConfirmDialog`):

| Momento | Contenido |
|---|---|
| Al pulsar «Cerrar» | `showModal()`, foco en «Cancelar»; título «¿Cerrar la oferta?»; descripción «Una oferta cerrada no se puede reabrir: para volver a publicarla, duplícala.»; `children`: `<p role="status">` «Comprobando las inscripciones activas…»; «Cerrar oferta» con `confirmDisabled` |
| Número recibido | el `<p role="status">` pasa a `activeApplicationsText(n)`; «Cerrar oferta» se habilita |
| Error al pedir el número | `error` del diálogo con `userMessage` (forma inválida: «La respuesta del servidor no es válida. Vuelve a intentarlo.»); «Cerrar oferta» sigue deshabilitado y «Cancelar» disponible. 404 → cierra y «Esta oferta ya no existe.» en la ficha |
| «Cancelar» o `Escape` | se cierra sin `POST`; se aborta la lectura (`AbortController`); el foco vuelve a «Cerrar» |
| «Cerrar oferta» | `busy` (los dos botones deshabilitados) + guarda `useRef` contra el doble clic; `closeJob(id)` |
| 200 | se cierra; el contenedor hace `setData(job)` + aviso local «Oferta cerrada.» + foco al h1 |
| 500 o red | `role="alert"` en el diálogo; botones reactivados; la ficha sigue «Publicada» |
| 409 | se cierra; el contenedor muestra el `message` y llama a `retry()` |

- El diálogo **no** incluye el título de la oferta (EC-15).
- `useClosePreview` (lectura con `AbortController`) y `useCloseJob` (estado + guarda) son hooks internos del fichero.

**Contenedor** (`JobDetailScreen.tsx`, DD-05 a DD-07):
- `JobDetailScreen` monta `<JobDetailLoader key={id} id={id} />`: aviso, alerta y estado local no pasan de una oferta a
  otra.
- Aviso local (`Notice`, `role="status"`) que sustituye al de llegada; alerta de acción (`role="alert"`) bajo las
  acciones, que vive por encima del recurso y **sobrevive** a `retry()`.
- 404 de una acción → «Esta oferta ya no existe.» + «Volver a las ofertas», sin acciones (como `DeleteJobAction`).
- Foco: tras cerrar o recargar por un 409, al h1 (`headingRef`); los efectos de foco no llaman a `setState`.

**Tests** (`mockFetch`, *polyfill* de `<dialog>` en `apps/web/test/helpers/dialog.ts`, ruta inicial con
`history.replaceState`; consultas por rol: `dialog` «¿Cerrar la oferta?», `button` «Cerrar», «Cerrar oferta»,
«Cancelar», «Duplicar», «Publicar», «Borrar», `link` «Editar»):
- `JobDetailScreen.test.tsx`: solo el cambio de la línea 69 (4 controles en orden); el test de 404 sigue sin «Borrar».
- `JobDetailScreen.states.test.tsx`: borrador (CA-23), publicada (3 acciones, 2 fechas), cerrada (CA-22, EC-42, aviso,
  sin «Editar» ni «Borrar»), 22:30Z → 07/10/2026 (EC-04, EC-11).
- `CloseJobAction.test.tsx` (renderiza la ficha de una publicada en `/jobs/7`): foco y textos (CA-05, EC-11), cancelar y
  `Escape` sin `POST` y con la lectura abortada (`{ hang: true }`) (CA-06), 200 → ficha cerrada (CA-05, EC-13), 500
  (CA-09, EC-12).
