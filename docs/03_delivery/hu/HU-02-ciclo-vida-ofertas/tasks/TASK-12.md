# TASK-12 — Cierre, ficha, edición y borrado en la web frente a hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** test (frontend)
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Tarea `[adversarial]` de la web para **RF-02, RF-03 y RF-06**: casos hostiles y de fallo sobre el diálogo de cierre y
la ficha (TASK-09) y sobre la edición y el borrado según el estado (TASK-11), por categoría de
`docs/07_architecture_principles/QUALITY-GATES.md` §3. Solo añade tests; si uno destapa un fallo en `src/`, se arregla
aquí (techo de 2 ciclos) y, si es de diseño, se para y se escala.

| RF | Categoría · edge cases |
|---|---|
| RF-02 Cerrar | 3 EC-43 (red al cerrar), error y forma inválida de la lectura previa · 4 409 y 404 al cerrar (otra pestaña) · 6 EC-15 (título hostil con el diálogo abierto) · 7 EC-16 (doble clic en «Cerrar oferta») |
| RF-03 Editar y borrar | 3 EC-20 (500 al guardar una publicada) · 4 EC-21 (409 al borrar lo que otra pestaña publicó) · 6 EC-23 (`toPatch` nunca envía `status` ni fechas) |
| RF-06 Ficha por estado | 6 EC-46 (HTML en el título de una cerrada) · 3 EC-43 (cierre) · 4 409 + recarga de la ficha (EC-44) |

Las demás categorías están en TASK-09/TASK-11 o son N/A (EC-41, EC-45, EC-47), según la tabla del ROADMAP.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/test/features/jobs/CloseJobAction.test.tsx` | modificar | + EC-16, EC-15, EC-43, error/forma de la lectura, 409, 404 |
| `apps/web/test/features/jobs/JobDetailScreen.states.test.tsx` | modificar | + EC-46 |
| `apps/web/test/features/jobs/DeleteJobAction.test.tsx` | modificar | + EC-21 (409 → `onConflict`) |
| `apps/web/test/features/jobs/JobFormScreen.published.test.tsx` | modificar | + EC-20 |
| `apps/web/test/features/jobs/job-form-model.published.test.ts` | modificar | + EC-23 |

Si `CloseJobAction.test.tsx` (u otro) fuera a pasar de 300 líneas, los casos de esta tarea van a un hermano
`<nombre>.adversarial.test.tsx` (crear, p. ej. `CloseJobAction.adversarial.test.tsx`); los patrones de abajo lo recogen.

## Implementa
- RF: RF-02, RF-03, RF-06 (web) · RNF: RNF-03 (solo `message`), RNF-04 · CA: CA-13 (409 al borrar) · Edge cases: EC-15,
  EC-16, EC-20, EC-21, EC-23, EC-43 (cierre), EC-44, EC-46
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Diálogo de cierre y Ficha («Alerta de acción»),
  § Error paths (EC-15, EC-16, EC-20, EC-21, EC-23, EC-43, EC-44, EC-46), DD-06, § Estrategia de tests (casos
  `[adversarial]` de RF-02, RF-03 y RF-06)

## Dependencias
- **Depende de:** TASK-09, TASK-11
- **Bloquea:** nada (puede ir en paralelo con TASK-13 y TASK-14: no comparten ficheros)

## Criterios de done
- [ ] EC-16: doble clic en «Cerrar oferta» (con la primera respuesta en `{ hang: true }`) → **1** `POST`.
- [ ] EC-15: con el título `<img src=x onerror=alert(1)>` y el diálogo abierto, 0 `img` en la página; el diálogo no
      nombra la oferta; el error solo muestra `message`.
- [ ] EC-43: red caída al cerrar → `role="alert"` en el diálogo, botones reactivados, la ficha sigue «Publicada».
- [ ] Error al pedir el número → `role="alert"` en el diálogo, «Cerrar oferta» sigue deshabilitado y «Cancelar»
      disponible; respuesta sin `activeApplications` válido → «La respuesta del servidor no es válida. Vuelve a
      intentarlo.».
- [ ] 409 al cerrar → se cierra el diálogo, alerta con el `message` bajo las acciones y recarga de la oferta (la alerta
      sobrevive a la recarga; EC-44). 404 (al pedir el número o al cerrar) → se cierra el diálogo y «Esta oferta ya no
      existe.» + «Volver a las ofertas», sin acciones.
- [ ] EC-46: título `Oferta <b>X</b>` en una `closed` → texto literal en el h1, 0 elementos `b`.
- [ ] CA-13/EC-21: 409 al confirmar el borrado → se cierra el diálogo, se llama a `onConflict` con el `message` y, en la
      ficha, se ve la alerta y la oferta recargada sin «Borrar».
- [ ] EC-20: 500 al guardar una publicada → `role="alert"`; lo escrito se conserva.
- [ ] EC-23: `toPatch` nunca incluye `status`, `publishedAt` ni `closedAt`.
- [ ] `npm test -w apps/web -- CloseJobAction JobDetailScreen DeleteJobAction JobFormScreen job-form-model` en verde,
      con **11** ficheros de test ejecutados (`CloseJobAction` 1; `JobDetailScreen` 3; `DeleteJobAction` 1;
      `JobFormScreen` 4; `job-form-model` 2), más los hermanos `.adversarial` si se crearon. Si TASK-10 aún no se ha
      integrado (van en paralelo), `JobDetailScreen` recoge 2 y el total es 10.
- [ ] `npm test -w apps/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/test/features/jobs/CloseJobAction.test.tsx apps/web/test/features/jobs/JobDetailScreen.states.test.tsx apps/web/test/features/jobs/DeleteJobAction.test.tsx apps/web/test/features/jobs/JobFormScreen.published.test.tsx apps/web/test/features/jobs/job-form-model.published.test.ts`
      sin errores (más los hermanos y los ficheros de `src/` si hubo que arreglar algo).
- [ ] Commit único `test(web): adversarial tests for close, detail, edit and delete [HU-02 TASK-12]` nombrando los
      ficheros.

## Notas de implementación
- `mockFetch` (`apps/web/test/helpers/fetch.ts`): `{ networkError: true }` para la red caída, `{ hang: true }` para
  dejar una petición en curso, `{ status: 409, json: { error: { code: 'INVALID_TRANSITION', message: '…' } } }` con el
  mensaje literal del contrato.
- *Polyfill* de `<dialog>` en `apps/web/test/helpers/dialog.ts`; ruta inicial con `history.replaceState`.
- Para el 409 y el 404 «de otra pestaña», la siguiente petición `GET /api/jobs/{id}` devuelve la oferta ya cerrada o un
  404 (ruta como función en `mockFetch`).
- Texto siempre como interpolación JSX: busca `container.querySelector('img')` / `('b')` y espera `null`.
- Títulos del TD para los casos `[adversarial]`: «EC-16 doble clic en Cerrar oferta = 1 POST», «EC-15 título hostil con
  el diálogo abierto», «EC-46 HTML en una cerrada», «EC-21 409 al borrar → onConflict».

## Nota · review ronda 1 (2026-10-06)
EC-15, EC-16, EC-43 (cierre) y los demás casos nuevos del diálogo viven en `apps/web/test/features/jobs/CloseJobAction.adversarial.test.tsx` (umbral de 300 líneas); `CloseJobAction.test.tsx` no se modificó.
