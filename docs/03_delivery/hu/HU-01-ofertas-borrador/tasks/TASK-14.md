# TASK-14 — La web frente a dobles envíos, ofertas borradas, respuestas inesperadas y HTML [adversarial]

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** test (frontend)
- **Estado:** Completada
- **Prioridad:** Must
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Tests adversariales de las pantallas (RF-01 y RF-03 a RF-06), aparte del camino feliz: doble clic en «Guardar» y en «Borrar
oferta», edición sin cambios, oferta borrada en otra pestaña al guardar o al borrar, respuesta de la API con forma
inesperada y HTML en el título y en la descripción.

Si un test destapa un fallo, se corrige el código de la pantalla en esta tarea (techo de 2 ciclos); **nunca** se adapta
el test. Si el fallo es del diseño, se para y se escala.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/test/features/jobs/JobFormScreen.test.tsx` | modificar | EC-06, EC-19, EC-24/EC-30 |
| `apps/web/test/features/jobs/DeleteJobAction.test.tsx` | modificar | EC-33 y CA-14 (web) |
| `apps/web/test/features/jobs/JobListScreen.test.tsx` | modificar | EC-41, EC-40 (pantalla) |
| `apps/web/test/features/jobs/api.test.ts` | modificar | EC-40 (`isJobPage`) |
| `apps/web/test/features/jobs/JobDetailScreen.test.tsx` | modificar | EC-48 |
| `apps/web/src/features/jobs/JobFormScreen.tsx` | modificar **solo si** un test destapa un fallo | Guarda de doble envío, `toPatch` vacío, 404 |
| `apps/web/src/features/jobs/DeleteJobAction.tsx` | modificar **solo si** un test destapa un fallo | Guarda de doble clic, 404 |
| `apps/web/src/features/jobs/api.ts` | modificar **solo si** un test destapa un fallo | `isJob`/`isJobPage` |

## Implementa
- RF: RF-01, RF-03, RF-04, RF-05, RF-06 (todos Must; parte web) · CA: CA-14 (web) · RNF: RNF-04
- Edge cases por categoría (`QUALITY-GATES.md` §3):

| RF | Categoría | EC | Test |
|---|---|---|---|
| RF-01 | 4 Concurrencia | EC-06 | doble clic en «Guardar» = 1 `fetch` |
| RF-03 | 1 Input inválido | EC-19 | edición sin cambios = 0 `fetch` (nunca `PATCH {}`) |
| RF-03 | 5 Datos corruptos · 4 Concurrencia | EC-24, EC-30 | 404 al guardar → «Esta oferta ya no existe.» |
| RF-04 | 7 Idempotencia | EC-33, CA-14 | doble clic en «Borrar oferta» = 1 `fetch`; 404 → mensaje |
| RF-05 | 6 Seguridad · 5 Datos corruptos | EC-41, EC-40 | `<img onerror>` como texto; forma inesperada → error sin filas |
| RF-06 | 6 Seguridad | EC-48 | `<b>`/`<script>` como texto |

  RF-02 no tiene fila propia en la web: la validación que manda es la de la API, cuyo adversarial está en TASK-06; en
  la web lo cubren el modelo (TASK-12: EC-11, EC-17 en cliente; `toCreateInput` sin campos de solo lectura, EC-02) y
  los errores del servidor (TASK-13: EC-01, EC-02, EC-17).
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Error paths (filas `[adversarial]`: EC-06, EC-19, EC-24, EC-33, EC-40,
  EC-41, EC-48), § Threat modeling (Manipulación, XSS), § Estrategia de tests

## Dependencias
- **Depende de:** TASK-13 (y, por cadena, TASK-10 y TASK-11)
- **Bloquea:** nada (puede ir en paralelo con TASK-15: no comparten ficheros)

## Criterios de done
- [ ] Todos los tests de abajo existen y pasan contra las pantallas reales (solo se simula la red).
- [ ] `npm test -w apps/web -- JobFormScreen DeleteJobAction JobListScreen api.test JobDetailScreen` en verde, con
      **5** ficheros de test ejecutados.
- [ ] `npm test -w apps/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/test/features/jobs` (más los de `src` que se toquen) sin errores.
- [ ] Commit único `test(web): adversarial tests for job screens [HU-01 TASK-14]` nombrando los ficheros.

## Notas de implementación

**Tests** (`fetch` simulado de `apps/web/test/helpers/fetch.ts`, que registra las llamadas; *polyfill* de
`apps/web/test/helpers/dialog.ts`; `fireEvent`):
- `JobFormScreen.test.tsx`:
  - «EC-06 doble clic en Guardar = 1 fetch»: dos `fireEvent.click` (o dos `submit`) seguidos con la respuesta del
    `POST` aún pendiente → exactamente 1 llamada; «Guardar» `disabled` con «Guardando…».
  - «EC-19 edición sin cambios no llama a la API»: abrir `/jobs/{id}/edit`, «Guardar» sin tocar nada → 0 `PATCH` y
    navegación a `/jobs/{id}`.
  - «EC-24/EC-30 404 al guardar»: `PATCH` → 404 `NOT_FOUND` → `role="alert"` «Esta oferta ya no existe.» y enlace
    «Volver a las ofertas»; lo escrito sigue en el formulario.
- `DeleteJobAction.test.tsx`:
  - «EC-33 doble clic en Borrar oferta = 1 fetch»: con el `DELETE` pendiente, segundo clic → 1 llamada; botones
    `disabled`.
  - «CA-14 404 al borrar»: `DELETE` → 404 → `role="alert"` «Esta oferta ya no existe.» + enlace al listado.
- `JobListScreen.test.tsx`:
  - «EC-41 título con HTML como texto»: título `<img src=x onerror=alert(1)>` visible como texto;
    `container.querySelectorAll('table img').length === 0`.
  - «EC-40 forma inesperada → error sin filas»: `GET /api/jobs` responde 200 con `{ items: "x" }` → `role="alert"` con
    «La respuesta del servidor no es válida. Vuelve a intentarlo.» y ninguna fila.
- `api.test.ts`: «EC-40 isJobPage rechaza formas inesperadas» (`items` no array, item sin `id`, `total` no numérico) →
  `ApiError` con ese mensaje.
- `JobDetailScreen.test.tsx`: «EC-48 HTML como texto»: descripción `<script>alert(1)</script> y <b>negrita</b>` y
  título `Oferta <b>X</b>` → se ven literales; 0 elementos `b` y `script` dentro de la ficha.

Recuerda: prohibido `dangerouslySetInnerHTML`, `innerHTML` y `href` con datos de la API (salvo el ID validado).
