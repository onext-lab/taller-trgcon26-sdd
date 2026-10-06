# TASK-07 — Piezas transversales de la web, cliente de la API y URL del listado [setup]

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Todo lo que las pantallas de TASK-08 a TASK-11 consumen, sin pantallas nuevas:
1. **Transversal:** `useSearch()` y el aviso «Oferta duplicada.» en el router; `setData` en `useResource`; props
   opcionales `confirmDisabled` y `children` en `ConfirmDialog` (sin ellas, se comporta como hoy).
2. **Cliente de la API:** `ClosePreview` en `types.ts`; `listJobs(query, signal)`, `publishJob`, `closeJob`,
   `duplicateJob`, `getClosePreview` e `isClosePreview` en `api.ts`. Las tres acciones salen **sin cuerpo ni
   `Content-Type`**.
3. **Textos:** `jobFieldLabel`, `missingFieldsText` y `activeApplicationsText` en `labels.ts`.
4. **URL del listado** (DD-01): módulo puro `list-query.ts` (lectura de la URL, rutas canónicas, query de la API,
   validación de `q`, páginas).

`JobListScreen.tsx` solo cambia su llamada a `listJobs([], signal)` para que compile; la pantalla nueva es TASK-08. El
test `[adversarial]` de `encodeURIComponent` (EC-39) lo añade TASK-13.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/components/router.tsx` | modificar | `useSearch()`; `'Oferta duplicada.'` en `NoticeText` y `NOTICES` (~95 líneas) |
| `apps/web/src/components/use-resource.ts` | modificar | `setData(data: T)` en `Resource<T>` (~60) |
| `apps/web/src/components/ConfirmDialog.tsx` | modificar | `confirmDisabled?: boolean` y `children?: ReactNode` (~100) |
| `apps/web/src/features/jobs/types.ts` | modificar | `ClosePreview { activeApplications: number }` |
| `apps/web/src/features/jobs/api.ts` | modificar | 5 funciones nuevas o cambiadas e `isClosePreview` (~150) |
| `apps/web/src/features/jobs/labels.ts` | modificar | `jobFieldLabel`, `missingFieldsText`, `activeApplicationsText` (~60) |
| `apps/web/src/features/jobs/list-query.ts` | crear | Funciones de DD-01 (~110) |
| `apps/web/src/features/jobs/JobListScreen.tsx` | modificar | Solo `listJobs([], signal)` |
| `apps/web/test/components/router.test.tsx` | modificar | `useSearch` y el aviso nuevo |
| `apps/web/test/components/use-resource.test.tsx` | crear | `setData` |
| `apps/web/test/components/ConfirmDialog.test.tsx` | modificar | `confirmDisabled` y `children` |
| `apps/web/test/features/jobs/api.test.ts` | modificar | Cliente (incluido el cambio de la línea 49) |
| `apps/web/test/features/jobs/labels.test.ts` | modificar | Textos nuevos |
| `apps/web/test/features/jobs/list-query.test.ts` | crear | URL y `q` |

## Implementa
- RF: base de RF-01, RF-02, RF-04, RF-05 y RF-06 en la web · RNF: RNF-05 · CA: CA-20 (cliente) · Edge cases: EC-01 y
  EC-10 (sin cuerpo), EC-32 (claves desconocidas fuera), EC-33, EC-34 (`q` 100/101), EC-35 (sin normalizar)
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Dependencias (S1-S5 y `Content-Type`), § Módulos y ficheros afectados,
  § Pantallas y estados › Listado (URL) y Diálogo de cierre (textos), DD-01, DD-04, DD-05, § Error paths (EC-01, EC-10,
  EC-32 a EC-35), § Estrategia de tests, § Checklist pasos 1 y 2

## Dependencias
- **Depende de:** nada (el contrato está cerrado en `plans/TECHNICAL_DOC-backend.md` § Contrato de API; Vitest simula
  `fetch`)
- **Bloquea:** TASK-08, TASK-09

## Criterios de done
- [ ] `useSearch()` devuelve `window.location.search` y se actualiza con `navigate` y con «Atrás»; `readNotice` acepta
      «Oferta duplicada.».
- [ ] `setData(job)` pasa el recurso a `success` con ese dato **sin** petición.
- [ ] `ConfirmDialog` con `confirmDisabled` deshabilita solo el botón de confirmar; `children` se pinta entre la
      descripción y el error; sin las props, los tests de HU-01 siguen igual.
- [ ] `publishJob`, `closeJob` y `duplicateJob` hacen `POST /api/jobs/{id}/publish|close|duplicate` **sin cuerpo ni
      cabecera `Content-Type`** (EC-01, EC-10); `duplicateJob` acepta el 201; las tres validan la forma `Job`.
- [ ] `getClosePreview(id)` → `GET /api/jobs/{id}/close-preview`; una respuesta sin `activeApplications` entero ≥ 0 →
      error «La respuesta del servidor no es válida. Vuelve a intentarlo.».
- [ ] `listJobs([])` sigue llamando a `/api/jobs` (test de la línea 49, «sin parámetros (EC-34)»); con query, la URL
      exacta en orden canónico.
- [ ] `list-query.test.ts`: lectura (repetidas incluidas), orden canónico, omisión de valores por defecto, claves
      desconocidas fuera (EC-32), `q` de 100 válido y de 101 o con control con su error (EC-33, EC-34), `GESTIÓN` →
      `q=GESTI%C3%93N` sin normalizar (EC-35), `clearFiltersPath` → `/jobs`, `totalPages`.
- [ ] `labels.test.ts`: `activeApplicationsText` con 0, 1 y 2; `missingFieldsText(['description', 'workMode'])` →
      «Para publicar falta: Descripción, Modalidad.».
- [ ] `npm test -w apps/web -- router use-resource ConfirmDialog api.test labels list-query JobListScreen` en verde, con
      **7** ficheros de test ejecutados (`api.test` no recoge `App.test.tsx`; `JobListScreen` aún es un solo fichero).
- [ ] `npm test -w apps/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/components/router.tsx apps/web/src/components/use-resource.ts apps/web/src/components/ConfirmDialog.tsx apps/web/src/features/jobs/types.ts apps/web/src/features/jobs/api.ts apps/web/src/features/jobs/labels.ts apps/web/src/features/jobs/list-query.ts apps/web/src/features/jobs/JobListScreen.tsx apps/web/test/components apps/web/test/features/jobs/api.test.ts apps/web/test/features/jobs/labels.test.ts apps/web/test/features/jobs/list-query.test.ts`
      sin errores.
- [ ] Commit único `feat(web): search params, setData, dialog props and lifecycle API client [HU-02 TASK-07]` nombrando
      los ficheros.

## Notas de implementación

**Contrato que consume la web** (manda el backend):

| Llamada | Respuesta |
|---|---|
| `GET /api/jobs/:id/close-preview` | 200 `{ "activeApplications": 0 }` en cualquier estado · 400 · 404 · 500 |
| `POST /api/jobs/:id/publish` (sin cuerpo) | 200 `Job` (también al repetir) · 400 `VALIDATION_ERROR` «Hay campos con errores.» con `details` «Obligatorio para publicar.» en el orden `title`, `description`, `location`, `workMode` · 404 · 409 `INVALID_TRANSITION` «Una oferta cerrada no se puede publicar.» · 500 |
| `POST /api/jobs/:id/close` (sin cuerpo) | 200 `Job` · 404 · 409 «Un borrador no se puede cerrar: publícalo primero.» · 500 `INTERNAL_ERROR` |
| `POST /api/jobs/:id/duplicate` (sin cuerpo) | **201** `Job` nuevo en `draft` · 404 · 500 |
| `GET /api/jobs?status&q&page&pageSize` | 200 `JobPage` · 400 con `details[i].field` = nombre del parámetro |

- `requestJson` (`apps/web/src/components/http.ts`) ya pone `Content-Type` solo cuando hay `body`: no pases `body`.
- Un 403 `CROSS_SITE_REQUEST` (DEC-12) no lo provoca la web (mismo origen por el *proxy*); si llegara, se muestra como
  cualquier error con envelope.

**Router:** `useSearch()` con `useSyncExternalStore(subscribe, () => window.location.search)` (mismo `subscribe`).
`App.tsx` no cambia: `resolveScreen` casa por `pathname`, así que cambiar la query no desmonta la pantalla.

**`setData`:** `setData(data: T)` → `setResult({ state: 'success', data, error: undefined })`, sin petición (DD-05).

**`list-query.ts`** (DD-01). Solo se leen `status`, `q`, `page` y `pageSize` (**repetidas incluidas**) y se reenvían a la
API **en bruto**, sin validar (la API manda); el resto se ignora. **Decisión aceptada:** la query es una lista de pares
`[clave, valor]` en orden canónico, coherente con `listJobs([])` del TD, p. ej.
`ReadonlyArray<readonly ['status' | 'q' | 'page' | 'pageSize', string]>`. Funciones:

| Función | Qué hace |
|---|---|
| `readListQuery(search)` | Pares de las 4 claves conocidas, repetidas incluidas |
| `toSearch(query)` | `?k=v&…` en orden `status`, `q`, `page`, `pageSize`, con `encodeURIComponent` por valor (`''` si no hay pares). Lo usan la URL de la web y la de la API |
| `listView(query)` | Valores tolerantes para los controles: `status` que no es ninguno de los 3 → `''` («Todos»); `q`; `pageSize` (si es un tamaño válido distinto de 20/50/100, p. ej. 7, la pantalla añade esa opción) |
| `listPath(change)` / `pagePath(query, page)` | `/jobs?…` canónico **omitiendo los valores por defecto** (`status` vacío, `q` vacío, `page` 1, `pageSize` 20). CA-18: `/jobs?status=published&page=2` y, al elegir 50, `/jobs?status=published&pageSize=50` |
| `clearFiltersPath(query)` | **Decisión aceptada:** `/jobs` sin parámetros (resuelve también una URL con `pageSize` inválido) |
| `hasFilters(query)` | Hay `status` o `q` |
| `validateSearchText(raw)` | Recorta; ≤ 100 caracteres contados con `Array.from()`; sin C0 ni DEL. Errores: «La búsqueda no puede pasar de 100 caracteres.» · «La búsqueda no puede tener caracteres de control.» |
| `totalPages(total, pageSize)` | `max(1, ceil(total / pageSize))` |

- `api.ts`: `listJobs(query, signal)` → `requestJson('/api/jobs' + toSearch(query), { signal })`.

**Textos** (`labels.ts`): `jobFieldLabel`: `title` → «Título», `description` → «Descripción», `location` → «Ubicación»,
`workMode` → «Modalidad». `missingFieldsText(fields)` → «Para publicar falta: {etiquetas en el orden de `details`, con
coma}.». `activeApplicationsText(n)`: 1 → «Se rechazará 1 inscripción activa.»; cualquier otro → «Se rechazarán {n}
inscripciones activas.» (DD-04).

**`ConfirmDialog`:** `confirmDisabled` deshabilita solo «confirmar» (no «Cancelar»); `busy` sigue deshabilitando los
dos. `children` va entre la descripción (`aria-describedby`) y el error (`role="alert"`).

**Tests:** `fetch` simulado con `mockFetch` (`apps/web/test/helpers/fetch.ts`; la clave es `'METHOD /url'` con la query
exacta), datos inventados. `api.test.ts` pasa de 167 a ~240 líneas; si alguno de los ficheros de test fuera a pasar de
300, crea un hermano `<nombre>.lifecycle.test.ts(x)` y añade `<nombre>.lifecycle` al patrón de `npm test` (p. ej.
`api.lifecycle`, porque `api.test` no lo recoge).
