# TASK-14 — Recorridos e2e del ciclo de vida y del listado filtrado [e2e]

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** test (e2e)
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Recorridos de Playwright (solo Chromium) contra la API y la web reales, sobre `data/e2e.db` regenerada en cada ejecución
con el seed nuevo de 10 ofertas (4 borradores, 4 publicadas, 2 cerradas). La configuración de HU-01
(`playwright.config.ts`: reset en el comando del `webServer`, puertos 3101/5174, `reuseExistingServer: false`,
`workers: 1`) no cambia.
1. `e2e/jobs.spec.ts` (HU-01): sus comprobaciones del listado pasan a usar filtro o `pageSize=100` (DD-09).
2. `e2e/jobs-lifecycle.spec.ts` (nuevo): publicar, cerrar, duplicar y editar según el estado.
3. `e2e/jobs-list.spec.ts` (nuevo): filtros, búsqueda, paginación y errores del listado.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `e2e/jobs.spec.ts` | modificar | Test del seed en `/jobs?status=draft&pageSize=100`; EC-08 comprueba «Analista de datos junior» en `/jobs?pageSize=100`. `SEED_TITLES` no cambia |
| `e2e/jobs-lifecycle.spec.ts` | crear | Ciclo de vida (RF-01 a RF-04, RF-06) |
| `e2e/jobs-list.spec.ts` | crear | Listado filtrado (RF-05) |

## Implementa
- RF: RF-01 a RF-06 de extremo a extremo; RF-07 visto desde la web · CA: CA-01, CA-03, CA-05, CA-06, CA-11, CA-12,
  CA-14, CA-16, CA-18, CA-19 (web), CA-22, CA-23 · Edge cases: EC-13, EC-36, EC-43, EC-44
- Diseño: `plans/TECHNICAL_DOC-frontend.md` DD-09, § Estrategia de tests (columna Playwright, «Tests de HU-01 que
  cambian», «E2E deterministas»), § Riesgos, § Checklist paso 8

## Dependencias
- **Depende de:** TASK-05 (API completa y, por cadena desde TASK-01, el seed), TASK-08, TASK-10, TASK-11 (todas las
  pantallas)
- **Bloquea:** nada (puede ir en paralelo con TASK-12 y TASK-13: no comparten ficheros)

## Criterios de done
- [ ] `npx playwright test e2e/smoke.spec.ts e2e/jobs.spec.ts e2e/jobs-lifecycle.spec.ts e2e/jobs-list.spec.ts` en
      verde (equivale a `npm run e2e`; ojo: el patrón `jobs` recogería los tres *specs* de ofertas).
- [ ] `npm run e2e` ejecutado **dos veces seguidas**, con el mismo resultado.
- [ ] Ningún test comprueba el listado en la página 1 sin filtros; los totales sin filtros no se afirman en e2e.
- [ ] `npm run typecheck` sin errores (el `tsconfig.json` raíz incluye `e2e/`).
- [ ] `npx eslint e2e/jobs.spec.ts e2e/jobs-lifecycle.spec.ts e2e/jobs-list.spec.ts` sin errores.
- [ ] Ningún fichero pasa de 300 líneas (`e2e/jobs.spec.ts` está a 242).
- [ ] Commit único `test(e2e): job lifecycle and filtered list flows [HU-02 TASK-14]` nombrando los ficheros.

## Notas de implementación

**Determinismo** (DD-09): base regenerada + títulos **fijos** (constantes en cada *spec*) + un *worker*. Los ficheros
nuevos se ejecutan antes que `jobs.spec.ts` (orden alfabético) y crean ofertas: toda comprobación del listado va con
filtro (`status`, `q`) o con `pageSize=100`. Ningún otro *spec* usa «gestión» ni «Oferta de paginación» en un título.
Total al final de una ejecución: ~47 ofertas (< 100).

**`e2e/jobs-lifecycle.spec.ts`** (crea sus ofertas por la interfaz, porque el flujo es lo que se prueba):
- «CA-01 publicar un borrador completo»: «Técnica/o de selección», «Híbrida», «Valencia», 32000-40000 → «Publicar» →
  «Oferta publicada.», estado «Publicada», fecha de publicación y solo «Editar», «Cerrar» y «Duplicar» (CA-23 antes de
  publicar: «Editar», «Publicar», «Borrar», «Duplicar»).
- «CA-03 publicar con campos pendientes»: borrador solo con título → «Publicar» → «Para publicar falta: Descripción,
  Ubicación, Modalidad.» + «Editar»; sigue «Borrador».
- «EC-43 API caída al publicar»: `page.route('**/publish', (route) => route.abort())` → `role="alert"`; «Publicar»
  sigue habilitado.
- «CA-05/CA-06 cerrar con confirmación»: «Cerrar» → foco en «Cancelar» → `Escape` (sigue «Publicada») → «Cerrar» →
  «Se rechazarán 0 inscripciones activas.» → «Cerrar oferta» → solo lectura con «Fecha de cierre» y solo «Duplicar»
  (CA-22).
- «CA-14 duplicar una cerrada»: «Duplicar» → ficha nueva «Borrador», mismo título, sin fecha de publicación; la original
  sigue cerrada (comprobado con `page.request.get('/api/jobs/{id}')`).
- «CA-11 vaciar un obligatorio de una publicada»: «Editar» → vaciar Descripción → «Guardar» → «Obligatorio en una oferta
  publicada.» junto al campo.
- «CA-12/EC-44 guardar una oferta cerrada en otra pestaña»: dos `page` del mismo `context`; una abre
  `/jobs/{id}/edit`, la otra cierra la oferta; la primera guarda → mensaje del 409, `ClosedJobNotice` y «Ver la
  oferta» lleva a la ficha en solo lectura.
- **Fechas:** la fecha esperada de publicación o de cierre se calcula en el test con
  `new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' })`
  sobre el `publishedAt`/`closedAt` que devuelve la API (`page.request.get`), nunca con el reloj del portátil.

**`e2e/jobs-list.spec.ts`** (prepara con `page.request` los datos que el flujo no prueba: `POST /api/jobs` y
`…/publish`, `…/close`, sin cuerpo en las acciones):
- «CA-16 filtrar por estado y título»: crea «GESTIÓN de proveedores» (publicada), «Técnico/a de gestión administrativa»
  (borrador) y «Coordinador/a de gestión de eventos» (cerrada); en la interfaz, Estado «Publicada» + «gestion» +
  «Buscar» → exactamente «GESTIÓN de proveedores» y la del seed «Responsable de gestión de nóminas», en ese orden.
- «CA-18 paginar y cambiar el tamaño»: crea y publica «Oferta de paginación 01» a «Oferta de paginación 21»; con Estado
  «Publicada» y «Oferta de paginación» → «Página 1 de 2»; «Siguiente» → 1 fila y la URL conserva el filtro; «Por página»
  50 → 21 filas en la página 1; «Atrás» del navegador restaura la vista anterior.
- «EC-36 API caída al filtrar»: tras cargar el listado, `page.route((url) => url.pathname === '/api/jobs' &&
  url.search !== '', (route) => route.abort())` y filtrar → `role="alert"` + «Reintentar»; los controles conservan lo
  elegido.
- «CA-19 URL con pageSize=101»: `page.goto('/jobs?pageSize=101')` → `role="alert"` + «Quitar filtros» (lleva a `/jobs`).

**`e2e/jobs.spec.ts`**: solo los dos cambios de la tabla; el resto (y `SEED_TITLES`) sigue igual: el backend conserva
los 4 borradores del seed y su orden relativo.

**Gotchas:** selectores por rol y nombre (como en Testing Library); `getByLabel('Descripción')` también encuentra
«Descripción (obligatorio)» (coincidencia parcial). Si hay reintentos, busca tu oferta con `.first()`. Datos
inventados.
