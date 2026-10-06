# TASK-13 — Publicar, duplicar y listado en la web frente a hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** test (frontend)
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Tarea `[adversarial]` de la web para **RF-01, RF-04, RF-05 y RF-06**: casos hostiles y de fallo sobre publicar y
duplicar desde la ficha (TASK-10) y sobre el listado filtrado (TASK-07, TASK-08), por categoría de
`docs/07_architecture_principles/QUALITY-GATES.md` §3. Solo añade tests; si uno destapa un fallo en `src/`, se arregla
aquí (techo de 2 ciclos) y, si es de diseño, se para y se escala.

| RF | Categoría · edge cases |
|---|---|
| RF-01 Publicar | 3 EC-05/EC-43 (500 y red) · 4 EC-06 (borrada en otra pestaña), 409 + recarga · 7 EC-09 (doble clic) |
| RF-04 Duplicar | 1 EC-25 (404) · 3 EC-27/EC-43 (500 y red) · 7 EC-31 (doble clic) |
| RF-05 Listado | 1 EC-32 (URL con claves desconocidas o inválidas), EC-33 (`q` con control o de 101) · 3 EC-36 (API caída al filtrar) · 6 EC-39 (`encodeURIComponent`: `q` no inyecta parámetros) |
| RF-06 Ficha por estado | 3 EC-43 (publicar y duplicar con la red caída: la ficha sigue igual y el botón se rehabilita) |

Las demás categorías están en TASK-07/TASK-08/TASK-10 o son N/A, según la tabla del ROADMAP.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx` | modificar | + 409, EC-06, EC-05/EC-43, EC-09, EC-25, EC-27/EC-43, EC-31 |
| `apps/web/test/features/jobs/JobListScreen.filters.test.tsx` | modificar | + EC-32, EC-33, EC-36 |
| `apps/web/test/features/jobs/list-query.test.ts` | modificar | + EC-39 |

Si `JobDetailScreen.actions.test.tsx` o `JobListScreen.filters.test.tsx` fuera a pasar de 300 líneas, los casos de esta
tarea van a un hermano `<nombre>.adversarial.test.tsx` (crear, p. ej. `JobDetailScreen.adversarial.test.tsx`); los
patrones de abajo lo recogen.

## Implementa
- RF: RF-01, RF-04, RF-05, RF-06 (web) · RNF: RNF-05 · Edge cases: EC-05, EC-06, EC-09, EC-25, EC-27, EC-31, EC-32,
  EC-33, EC-36, EC-39, EC-43
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Ficha («Alerta de acción», «En curso», «Foco») y
  Listado, § Error paths (EC-05, EC-06, EC-09, EC-25, EC-27, EC-31 a EC-33, EC-36, EC-39, EC-43), DD-01, DD-07,
  § Threat modeling (inyección de parámetros con `q`)

## Dependencias
- **Depende de:** TASK-08, TASK-10
- **Bloquea:** nada (puede ir en paralelo con TASK-12 y TASK-14: no comparten ficheros)

## Criterios de done
- [ ] 409 al publicar → alerta con el `message` y recarga de la oferta (la alerta se mantiene).
- [ ] EC-06: 404 al publicar → «Esta oferta ya no existe.» + «Volver a las ofertas», sin acciones.
- [ ] EC-05/EC-43: 500 o red al publicar → `role="alert"` con `userMessage`; sigue «Borrador»; «Publicar» habilitado y
      con el foco.
- [ ] EC-09: doble clic en «Publicar» → **1** `POST`.
- [ ] EC-25: 404 al duplicar → «Esta oferta ya no existe.».
- [ ] EC-27/EC-43: 500 o red al duplicar → `role="alert"`; sigue en la ficha original; «Duplicar» habilitado y con el
      foco.
- [ ] EC-31: doble clic en «Duplicar» → **1** `POST`; «Duplicando…».
- [ ] EC-32: `/jobs?sort=title` → listado normal y la petición sale sin `sort`; `/jobs?pageSize=abc` → alerta con «Por
      página: …» + «Quitar filtros» (a `/jobs`), sin «Reintentar».
- [ ] EC-33: «Buscar por título» con un tabulador pegado → «La búsqueda no puede tener caracteres de control.» junto al
      campo (`aria-invalid`, foco en el campo), **sin** navegar ni pedir; con 101 caracteres → «La búsqueda no puede
      pasar de 100 caracteres.».
- [ ] EC-36: red caída al filtrar → `role="alert"` + «Reintentar»; Estado y texto conservan lo elegido.
- [ ] EC-39: `toSearch` con `q` = `%` → `q=%25`; con `a&status=closed` → `q=a%26status%3Dclosed` (no inyecta
      parámetros).
- [ ] `npm test -w apps/web -- JobDetailScreen JobListScreen list-query` en verde, con **6** ficheros de test
      ejecutados (`JobDetailScreen` 3; `JobListScreen` 2; `list-query` 1), más los hermanos si se crearon.
- [ ] `npm test -w apps/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx apps/web/test/features/jobs/JobListScreen.filters.test.tsx apps/web/test/features/jobs/list-query.test.ts`
      sin errores (más los hermanos y los ficheros de `src/` si hubo que arreglar algo).
- [ ] Commit único `test(web): adversarial tests for publish, duplicate and list filters [HU-02 TASK-13]` nombrando los
      ficheros.

## Notas de implementación
- Doble clic: la primera respuesta en `{ hang: true }` y dos `fireEvent.click` seguidos; cuenta las llamadas en
  `mock.calls` filtrando por método y URL.
- Red caída: `{ networkError: true }`; 500: `{ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: '…' } } }`.
- Foco tras un error: `expect(document.activeElement).toBe(<botón>)` (DD-07).
- En el listado, `mockFetch` usa la URL exacta: una petición con `sort` no declarada acabaría en `unmatched`, que el test
  comprueba vacío.
- Títulos del TD para los casos `[adversarial]`: «EC-09 doble clic en Publicar = 1 POST», «EC-31 doble clic en Duplicar
  = 1 POST», «EC-39 encodeURIComponent por valor», «EC-32 URL manipulada».
