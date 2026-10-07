# Estado del MVP por módulo

Vista única de qué hay hecho en cada módulo del ATS. La fila de cada módulo la actualiza `/module-sync` al cerrar cada
HU; el detalle vive en `docs/05_modules/{módulo}/functional.md`.

- **Última actualización:** 2026-10-07 (HU-04: nace `inscripciones` con inscribir y pipeline; `candidatos` al 100 %).

## Leyenda

| Símbolo | Significado |
|---|---|
| ✅ | Implementado, probado y con review aprobada |
| 🚧 | Parcial o con huecos conocidos |
| ⬜ | Sin empezar |

## Resumen

| Módulo | Estado | Capacidades ✅ / total | HU entregadas | Notas |
|---|---|---|---|---|
| `ofertas` | 🚧 | 7 / 8 | HU-01, HU-02 | ~94 % MVP (7 ✅ / 1 🚧 / 0 ⬜). Falta UC-04 · A1, el rechazo de inscripciones activas al cerrar (HU-06). HU-04 solo tocó el módulo: cerró SEC-02 (guarda de estado en el SQL), implementó el puerto «estado de la oferta» y añadió «Ver pipeline». [functional.md](05_modules/ofertas/functional.md) |
| `candidatos` | ✅ | 5 / 5 | HU-03, HU-04 | 100 % MVP (5 ✅ / 0 🚧 / 0 ⬜). «Mientras dure el proceso» y el puerto de procesos real, desde HU-04. Quedan para la feature A la anonimización y la marca de los candidatos con la retención vencida. [functional.md](05_modules/candidatos/functional.md) |
| `inscripciones` | 🚧 | 1 / 6 | HU-04 | ~25 % MVP (1 ✅ / 1 🚧 / 4 ⬜). Hecho: inscribir (UC-14) y el pipeline de una oferta (UC-17, sin acciones). Faltan avanzar, rechazar, historial y UC-17 · A1 (HU-05), y el rechazo al cerrar una oferta (HU-06). [functional.md](05_modules/inscripciones/functional.md) |

## Transversal

| Pieza | Estado | Notas |
|---|---|---|
| Esqueleto del monorepo (`GET /api/health`, web, e2e smoke) | ✅ | Infraestructura sin HU (ver [WORKFLOW.md](WORKFLOW.md) §9) |
| Envelope de errores (`apps/api/src/http/error-handler.ts`, `apps/api/src/errors.ts`) | ✅ | HU-01 · DEC-11.4-5: códigos de DEC-07 y DEC-11, sin *stack traces*. HU-03 enmendó DEC-11.4: `details` acotado al esquema (claves no declaradas agrupadas y sin nombre) y `existingId` en el 409 `DUPLICATE` |
| Validación estricta (`apps/api/src/http/validation.ts`) | ✅ | HU-01 · DEC-11.1-3 y 11.8: Ajv sin coerción, recorte, caracteres de control. HU-03 añadió `forbiddenFields` para nombrar los campos de solo lectura |
| Guarda entre sitios (`apps/api/src/http/cross-site.ts`) | ✅ | HU-02 · DEC-12: 403 `CROSS_SITE_REQUEST` a toda escritura con `Sec-Fetch-Site` distinto de `same-origin` o `none`; la heredan las HU siguientes |
| Búsqueda sin tildes (`apps/api/src/db/text-search.ts`) | ✅ | HU-02 · DEC-10: `foldSearchText` y `fold_search`, registrada por conexión; la reutiliza `candidatos` (HU-03) |
| Reloj y transacciones (`apps/api/src/clock.ts`, `apps/api/src/db/transaction.ts`) | ✅ | HU-01 · DEC-11.6-7; `withTransaction` se une a una en curso (HU-03: el recálculo de retención se une a la del alta y del consentimiento; HU-04: la inscripción une en una sola transacción el puerto de estado de la oferta, el `INSERT`, el `StageChange` y el recálculo de `candidatos`) |
| Arranque en loopback (`apps/api/src/listen-options.ts`) | ✅ | HU-01 · `API_HOST`/`API_PORT`, por defecto `127.0.0.1:3001` |
| Web: router, cliente HTTP y componentes (`apps/web/src/components/`) | ✅ | HU-01 · router propio, `requestJson`, `useResource`, `ConfirmDialog`, `FormField` |
| Web: piezas compartidas de listados y formularios (`apps/web/src/components/`) | ✅ | HU-03 · movidas de `jobs`: `list-controls.ts`, `Pagination.tsx`, `PageSizeSelect.tsx`, `form-errors.ts`, `use-document-title.ts`, `use-lifetime-signal.ts` y `parseRouteId`; nuevos `formatCalendarDate` y `existingId` en `http.ts`. `App.tsx` resuelve rutas con la tabla `ROUTES` |
| Web: helper de foco en tests (`apps/web/test/helpers/focus.ts`) | ✅ | T-03 (sprint 01) · `expectFocusOn` espera al foco movido por un efecto pasivo; los tests nuevos de foco lo usan |
| Web: recarga silenciosa y aviso con foco (`apps/web/src/components/use-resource.ts`, `StatusMessages.tsx`) | ✅ | HU-04 · `useResource.reload()` vuelve a pedir sin pasar por «Cargando» y `Notice` acepta `ref` para recibir el foco |
| Puertos entre módulos (`apps/api/src/app.ts`) | ✅ | HU-04 · DEC-06 aclarada: ningún módulo importa a otro, ni sus tipos; `JobStatusPort` y `CandidateLookupPort` (los define `applications`) y `CandidateProcessesPort` (lo define `candidates`) se conectan por tipado estructural y los comprueba `apps/api/test/module-boundaries.test.ts`. Latente: `JobApplicationsPort` sigue en stub hasta HU-06 |
| Integridad de la base: FK y triggers (`apps/api/src/db/migrations/003-create-applications.sql`) | ✅ | HU-04 · las FK entre tablas de módulos distintos son integridad de la base, no acoplamiento (DEC-06); únicos triggers del esquema: `stage_changes` es inmutable salvo vaciar la nota (RGPD §5) |
| E2E con base regenerada (`playwright.config.ts`) | ✅ | HU-01 · `data/e2e.db` reseteada en el `webServer`, puertos 3101/5174; HU-03: con 10 ofertas y 30 candidatos; HU-04: y 40 inscripciones con historial |
