# Review — HU-02 Publicar, cerrar, duplicar y listar ofertas con filtros

## 1. Resumen ejecutivo
- **Fecha:** 2026-10-06 · **Rama:** `hu/HU-02-ciclo-vida-ofertas` · **Commits revisados:** `fcce2b2..b669cc0`
  (especificación, diseño y tareas, y 14 commits de código)
- **Ficheros tocados:** 67 de código y tests, más los documentos de la HU y DEC-12 · **Tasks:** 14/14 completadas
- **Auditores:** security-auditor ✔ · datos-personales-auditor ✔ · doc-code-drift-checker ✔ (más la tabla
  criterio → test, los gates y el contraste DEC/DD)
- **Hallazgos:** críticos 1 · altos 0 · medios 4 · bajos 12
- La HU completa el ciclo de vida de la oferta: publicar, cerrar (en una transacción, con el diálogo y el puerto de
  inscripciones preparado para HU-05), duplicar, editar y borrar según el estado (comprobado en el servicio), y el
  listado con filtros por estado y título (sin tildes ni mayúsculas), con paginación. Añade DEC-12 (403 a escrituras
  desde otro sitio). Cumple 24/24 CA y 20/20 flujos de UC, con la integración completa en verde. Falla en un edge case
  de RF Must sin test (EC-14).

## 2. Veredicto
**Requiere cambios.** EC-14 (RF-02 Must) describe un comportamiento (la ventana de INV-05: con el puerto por defecto, el
cierre no rechaza inscripciones) y no tiene test ni está marcado `N/A` en el PRD. Por la regla de `/reviewer`, es
crítico. Además, la review pide curar dos medios antes del merge: el guard de DEC-12 deja pasar `same-site` y los
métodos de escritura que no estén en su lista (SEC-01), y `splitServerError` pasa de 10 ramas.

## 3. Decisiones aplicables

| DEC-NN | Aplica porque | ¿Cumple? |
|---|---|---|
| DEC-01 | Rutas nuevas con esquema y envelope | Sí — `apps/api/src/modules/jobs/routes.ts:58-127`, `apps/api/src/http/error-handler.ts:10-22` |
| DEC-03 | Sin migración nueva; seed de 10 | Sí — solo `001-create-job-openings.sql`; `git ls-files` sin `.db`; seed inventado (`apps/api/src/db/seed.ts`) |
| DEC-04 | Sin login | Sí — sin credenciales ni roles |
| DEC-05 | Sin dependencias nuevas | Sí — `normalize` y `DatabaseSync#function` nativos (`apps/api/src/db/text-search.ts:9,17`) |
| DEC-06 | Cierre transaccional y puerto | Sí — `apps/api/src/modules/jobs/service.ts:124-135`; `jobs` no importa `applications`; composición en `apps/api/src/app.ts:57-63` |
| DEC-07 | 409, 201 y 200 | Sí — `apps/api/src/errors.ts:29` (`INVALID_TRANSITION`), `apps/api/src/modules/jobs/rules.ts:11-32` |
| DEC-08 | Estado dentro de la transacción; repetir = 200 | Sí — `service.ts:87-135`; guarda en el `UPDATE` (`apps/api/src/modules/jobs/repository.ts:48-54`) |
| DEC-09 | Fechas y reloj | Sí — `now()` en `service.ts:118,128,143`; `formatDate` en `apps/web/src/features/jobs/JobDetails.tsx:16` |
| DEC-10 | Listado | Sí — forma y orden (`service.ts:146-150`, `repository.ts:87`), 4 campos (`schemas.ts:117`), NFD (`text-search.ts:9`) |
| DEC-11 | Validación y errores | Sí — `page`/`pageSize` como texto con `pattern` (`schemas.ts:171-172`), `q` recortado y sin controles (`routes.ts:38`, `schemas.ts:170`) |
| DEC-12 | Escrituras desde otro sitio | Sí, como está escrita — `apps/api/src/http/cross-site.ts:12-18`, `app.ts:30-31`, test `apps/api/test/http/cross-site.test.ts:87`. **Pero** su texto y su alcance tienen fallos (SEC-01, DD-01, DD-06) |

Las DD de los dos TECHNICAL_DOC están implementadas como dicen (DD-12 de triggers, descartada; no hay `002`).

## 4. Hallazgos por auditor

### security-auditor
0 críticos, 0 altos, 1 medio, 3 bajos (VERDICT del auditor: OK).
- **SEC-01 · medio** — `apps/api/src/http/cross-site.ts:4,13`: el guard es una lista de métodos (`POST`, `PATCH`,
  `DELETE`). (a) Un método de escritura futuro (`PUT`) quedaría fuera, aunque DEC-12 promete que «cada HU que añada
  escrituras hereda la protección». (b) Con la API en `127.0.0.1`, otra aplicación en otro puerto de loopback llega
  como `same-site` y pasa. Propuesta: invertir la lógica (rechazar todo método que no sea `GET`, `HEAD` ni `OPTIONS`
  si `Sec-Fetch-Site` no es `same-origin` ni `none`; sin cabecera, pasa) y normalizar el valor. Cambia DEC-12.
- **SEC-02 · bajo** — `apps/api/src/modules/jobs/repository.ts:42-45,159`: `UPDATE` y `DELETE` sin guarda de estado
  en el SQL (sí la tienen `markPublished`/`markClosed`). No explotable hoy (`BEGIN IMMEDIATE`, una conexión).
  Defensa en profundidad para HU-05.
- **SEC-03 · bajo** — `details` sin tope con el nombre de la clave sobrante: es la SEC-04/DP-01 aceptada en HU-01, que
  HU-03 cierra (DT-10 de su PRD).
- **SEC-04 · bajo** — `apps/api/src/app.ts:28`: sin lista de `Host` permitidos; un DNS rebinding llegaría como
  `same-origin`. Teórico y anterior a HU-02.
- Sin hallazgos en inyección (SQL con parámetros con nombre; `instr` literal), ReDoS, `page` enorme (patrón de 9
  cifras), mass assignment, XSS, URL de la web (`encodeURIComponent`, rutas internas), errores ni logs.

### datos-personales-auditor
0 críticos, 0 altos, 0 medios, 2 bajos (VERDICT del auditor: OK). La HU no trata datos personales; el puerto y
`close-preview` solo exponen un recuento.
- **DP-01 · bajo (preventivo)** — `apps/api/src/http/error-handler.ts:12` registra el objeto de error de los 500. Cuando
  HU-05 implemente el puerto, un `Error` que interpole datos del candidato acabaría en el log: HU-05 necesita un test.
- **DP-02 · bajo (informativo)** — `apps/api/src/modules/jobs/repository.ts:98`: `SELECT *` en `findById`, contenido
  por el esquema de respuesta; no copiarlo en candidatos.
- **Para HU-04/05:** recalcular la retención en la transacción del cierre (RGPD §3), mantener el puerto solo con
  escalares, mensajes de error sin datos personales y rutas de candidatos sin datos en el path.

### doc-code-drift-checker
1 crítico, 0 altos, 5 medios, 5 bajos (VERDICT del auditor: BLOQUEANTE, por DD-01).
- **DD-01 · crítico según el auditor → medio en esta review** — `docs/07_architecture_principles/DECISIONS.md:212`
  (contexto de DEC-12): «los cuerpos `text/plain` dan 415» es falso. Fastify trae el parser de `text/plain`, así que el
  cuerpo llega como texto: en las acciones lo para `rejectBody` con 400 y en el alta, el esquema (400). El razonamiento
  de DEC-12 no cambia (siguen sin poder crear nada), pero el dato es erróneo. No es una ruta inexistente; lo escribió
  la sesión al redactar DEC-12.
- **DD-06 · medio** — DEC-12 no nombra el código `CROSS_SITE_REQUEST`.
- **DD-02 / DD-03 · medios** — `plans/TECHNICAL_DOC-backend.md:405-411,646-650` y `plans/TECHNICAL_DOC-frontend.md`
  (`:321-363`, `:349-353`, `:550-579`, tabla `:85-91`) citan ficheros de test de los que los casos se movieron a los
  hermanos (`status-rules-adversarial`, `JobDetailScreen.states`, `CloseJobAction.adversarial`,
  `JobListScreen.pagination`, `JobListScreen.filters-adversarial`).
- **DD-04 / DD-05 · medios** — `docs/ARCHITECTURE.md:24-49` (sin `jobApplications?`, `CROSS_SITE_REQUEST`, el guard ni
  `text-search.ts`) y `docs/SETUP.md:98-99` («seed de 4 borradores»; son 10). Van a `/module-sync`.
- **Bajos:** DD-07 (recuentos y nombres de hermanos en `tasks/TASK-08.md`, `TASK-12.md` y `TASK-13.md`), DD-08
  (líneas movidas en TD y ROADMAP), DD-09 (los TD citan PRD v1.1), DD-10 (`docs/_modules.md`, anterior).

### Revisión de calidad (la review)
- **Medio** — complejidad: `apps/web/src/features/jobs/job-form-errors.ts:18` `splitServerError` ≈ 14 ramas.
- **Bajo** — `apps/web/src/features/jobs/api.ts:46` `isJob` ≈ 13 ramas (cadena de `&&` de forma).
- **Bajo** — CA-18 del PRD dice que «Por página» ofrece solo 20, 50 y 100; la web añade delante un tamaño válido que
  venga en la URL (`apps/web/src/features/jobs/JobFilters.tsx:45`), como decidió el TD-frontend sin actualizar el PRD.
- **Bajo** — `apps/web/src/features/jobs/use-job-actions.ts:62-63`: el foco vuelve al botón con
  `document.activeElement`; en Safari los botones no reciben foco al clic y no volvería (declarado en
  `tasks/TASK-10-BRIEF.md`).
- **Bajo** — `apps/api/test/jobs/performance.test.ts:127` duplica el test RNF-02 de HU-01 junto al nuevo.
- **Informativo** — `JobDetailScreen.actions.test.tsx` está en 300 líneas exactas.

## 5. Criterio → test
Abreviaturas: `A/` = `apps/api/test/jobs/`, `AH/` = `apps/api/test/http/`, `W/` = `apps/web/test/features/jobs/`,
`EL` = `e2e/jobs-lifecycle.spec.ts`, `ES` = `e2e/jobs-list.spec.ts`; los ficheros, sin `.test.ts(x)`. «pasa» = test
presente y en verde en §7.

| Origen | UC | Criterio o edge case | Categoría | Test (`fichero:línea`) | Estado |
|---|---|---|---|---|---|
| CA-01 / RF-01 | UC-03 · P | Publicar un borrador completo | — | `A/publish:51` · `W/JobDetailScreen.actions:61` · `EL:95` | pasa |
| CA-02 | UC-03 · A1 | Ya publicada: 200, misma fecha | — | `A/publish:65` | pasa |
| CA-03 | UC-03 · E1 | Faltan obligatorios: 400 con la lista | — | `A/publish:165` · `W/JobDetailScreen.actions:82` · `EL:114` | pasa |
| CA-04 | UC-03 · E2 | Publicar una cerrada: 409 | — | `A/publish:197` | pasa |
| CA-05 / RF-02 | UC-04 · P | Diálogo con 0 y cierre en una transacción | — | `A/close:51` · `W/CloseJobAction:82,147` · `EL:140` | pasa |
| CA-06 | UC-04 · A2 | Cancelar o Escape: sin POST | — | `W/CloseJobAction:121,135` · `A/close:68` | pasa |
| CA-07 | UC-04 · A3 | Ya cerrada: 200, misma fecha | — | `A/close:80` · `W/CloseJobAction:172` | pasa |
| CA-08 | UC-04 · E1 | Cerrar un borrador: 409 | — | `A/close:143` | pasa |
| CA-09 | UC-04 · E2 | Falla el cierre: envelope, sigue publicada | — | `A/close:161,175` · `W/CloseJobAction:185` | pasa |
| CA-10 / RF-03 | UC-02 · E1 | Cerrada: sin Editar, PATCH 409 | — | `A/status-rules:64` · `W/JobDetailScreen.states:82` · `W/JobFormScreen.published:210` | pasa |
| CA-11 | UC-02 · E3 | Vaciar obligatorio de publicada: 400 | — | `A/status-rules:74` · `W/JobFormScreen.published:78` · `EL:208` | pasa |
| CA-12 | UC-02 · E4 | Cerrada en otra pestaña: 409 | — | `A/status-rules:117` · `W/JobFormScreen.published:171` · `EL:224` | pasa |
| CA-13 | UC-05 · E1 | Publicada o cerrada: DELETE 409 | — | `A/status-rules:150` · `W/JobDetailScreen.states:71,82` · `W/DeleteJobAction:162` | pasa |
| CA-14 / RF-04 | UC-06 · P | Duplicar una cerrada | — | `A/duplicate:46` · `W/JobDetailScreen.actions:113` · `EL:185` | pasa |
| CA-15 | UC-06 · P | Duplicar borrador y publicada | — | `A/duplicate:67` | pasa |
| CA-16 / RF-05 | UC-07 · A1 | `published` + «gestion» | — | `A/list-filters:67` · `W/JobListScreen.filters:70` · `ES:38` | pasa |
| CA-17 | UC-07 · A3 | Paginación de la API | — | `A/list-filters:96,111` · `W/JobListScreen.pagination:104` | pasa |
| CA-18 | UC-07 · A3 | Paginación y tamaño en la web | — | `W/JobListScreen.pagination:45,66` · `ES:60` | pasa |
| CA-19 | UC-07 · E1 | `pageSize` 101 o 0: 400 | — | `A/list-filters-adversarial:73` · `ES:122` | pasa |
| CA-20 | UC-07 · E2 | `q` de 101 o con control: 400 | — | `A/list-filters-adversarial:89,98,105` · `W/JobListScreen.filters:204,239` | pasa |
| CA-21 | UC-07 · E3 | `status=archived`: 400 | — | `A/list-filters-adversarial:80` | pasa |
| CA-22 / RF-06 | UC-08 · A1 | Ficha cerrada en solo lectura | — | `W/JobDetailScreen.states:82` · `EL:140` | pasa |
| CA-23 | UC-08 · P | Ficha de borrador con 4 acciones | — | `W/JobDetailScreen.states:60` · `EL:95` | pasa |
| CA-24 / RF-07 Should | — | Seed de 10 | — | `A/seed:49,61,81,101` | pasa |
| EC-01..EC-13 | — | RF-01 y RF-02 (ver informe de la tabla) | 1-7 | `A/publish`, `A/close`, `W/JobDetailScreen.actions`, `W/CloseJobAction`, `A/migration:143` | pasa |
| **EC-14 / RF-02 Must** | — | Ventana de INV-05: el cierre no rechaza inscripciones mientras no haya puerto real | 5 datos corruptos | — (el PRD no lo marca `N/A`) | **falla (crítico)** |
| EC-15, EC-16 | — | Título hostil en el diálogo; doble clic | 6, 7 | `W/CloseJobAction.adversarial:75,87,102` · `A/close:80` | pasa |
| EC-17..EC-24 | UC-02 · E3/E4 | RF-03 (edición y borrado según estado) | 1-7 | `A/status-rules:74,117,132` · `A/status-rules-adversarial:71,89,105,127,145` · `A/migration:143` · `W/JobFormScreen.published` · `W/job-form-model.published` | pasa |
| EC-25..EC-31 | UC-06 · P | RF-04 (duplicar) | 1-7 | `A/duplicate:46,91,103,121,143,160` · `W/JobDetailScreen.actions` (EC-29 N/A) | pasa |
| EC-32..EC-39, EC-48 | UC-07 | RF-05 (listado) | 1-7 | `A/list-filters:96,111,123,134,149,164,187,199` · `A/list-filters-adversarial:54,73,89,105,126,147` · `W/JobListScreen.filters-adversarial:52,64,96,114,146` · `ES:104` | pasa |
| EC-42..EC-46 | UC-08 · A1 | RF-06 (ficha por estado) | 2-6 | `W/JobDetailScreen.states:60,82,120` · `W/JobDetailScreen.actions:182,247` · `W/CloseJobAction:210,267` · `EL:129,224` | pasa |
| EC-49 / RF-01, 02, 04 | — | Escritura cross-site: 403 | 6 | `AH/cross-site:87,129` | pasa |
| EC-40, 41, 45, 47 | — | `N/A` en el PRD | — | — | N/A |
| RNF-01..06 | — | Latencia, envelope, HTML, accesibilidad, `q` fuera de logs | — | `A/performance:95,113` · `A/list-filters-adversarial:147` · `W/CloseJobAction:82` · `W/JobDetailScreen.states:120` | pasa |

**Resultado:** 24/24 CA, 20/20 flujos de UC (UC-04 · A1 es de HU-05) y 43/44 EC aplicables. Huérfano: EC-14.

## 6. Gates de QUALITY-GATES

| Umbral | Medido | ¿Cumple? |
|---|---|---|
| PRD | 20/20 flujos con CA; 7 RF; 49 EC por las 7 categorías; RNF con métrica; 0 OQ; `Ready` v1.2 | Sí |
| TECHNICAL_DOC | 49 EC en cada TD; DD con alternativas; 0 OD | Sí (con el drift de §4) |
| Tasks | 14 (≤ 15), máx. 3,5 h, adversariales aparte en M por RF Must (TASK-04, 06, 12 y 13) | Sí |
| Líneas por fichero ≤ 300 | `src`: máx. `apps/web/src/features/jobs/JobFormScreen.tsx` 216; tests: `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx` 300 | Sí |
| Líneas por función ≤ 50 | Máx. con lógica: `apps/web/src/features/jobs/JobFormScreen.tsx:38` 47; factorías de objetos de métodos (`service.ts:71`, `routes.ts:54`, `repository.ts:93`) con métodos ≤ 18 | Sí |
| Complejidad ≤ 10 ramas | `apps/web/src/features/jobs/job-form-errors.ts:18` ≈ 14; `apps/web/src/features/jobs/api.ts:46` ≈ 13 | **No** (medio y bajo) |
| 1 test por RF, flujo y EC Must | 7/7 RF, 20/20 flujos, 43/44 EC Must | **No** (EC-14, crítico) |
| Anti-patrones de §4 | Sin hallazgos | Sí |
| typecheck, lint, test, e2e, check:harness | En verde (§7) | Sí |

## 7. Integración
Ejecutada por la review sobre `b669cc0`, con Node 24.21.0:

```
$ npm run typecheck
exit=0
$ npm run lint
exit=0
$ npm test
 Test Files  24 passed (24)
      Tests  294 passed (294)
 Test Files  25 passed (25)
      Tests  306 passed (306)
exit=0
$ npm run e2e
  24 passed (13.0s)
exit=0
$ npm run check:harness
check:harness: todo en verde.
exit=0
$ git ls-files | grep -c '\.db$'
0
```

## 8. Limitaciones
- Rendimiento solo con `fastify.inject` en local; sin Windows ni Linux; sin Safari (ver el bajo del foco).
- Los auditores trabajan en estático; la búsqueda con una tabla grande no se ha medido más allá de 100 ofertas.

## 9. Acciones requeridas
1. **Crítico** — EC-14 (RF-02 Must) sin test. Arreglo: fijar con un test de la API que, con el puerto por defecto
   (`noJobApplications`), cerrar una oferta publicada da 200, `close-preview` da 0 y no hay nada que rechazar, y que
   HU-05 sustituirá ese test al conectar UC-19. Sin cambiar el PRD para esquivarlo. Reapertura de TASK-04.
2. **Medio (SEC-01, cambia DEC-12)** — invertir el guard: rechazar todo método que no sea `GET`, `HEAD` ni `OPTIONS`
   si `Sec-Fetch-Site` (normalizado) no es `same-origin` ni `none`; sin cabecera, pasa. Tests de `same-site` → 403 y de
   un método no listado. Necesita la aprobación de la enmienda de DEC-12. Reapertura de TASK-01.
3. **Medio** — `splitServerError` (`apps/web/src/features/jobs/job-form-errors.ts:18`) a ≤ 10 ramas, sin cambiar su
   comportamiento (reapertura de TASK-11); y `isJob` (`apps/web/src/features/jobs/api.ts:46`) igual (reapertura de
   TASK-07).
4. **Medio (docs de la sesión)** — DEC-12: corregir «`text/plain` da 415» (es 400) y nombrar `CROSS_SITE_REQUEST`
   (DD-01, DD-06).
5. **Medio (docs de la HU)** — que los TD y `tasks/TASK-08.md`, `TASK-12.md` y `TASK-13.md` citen los ficheros de test
   reales (DD-02, DD-03, DD-07) y el PRD v1.2 (DD-09).
6. **Bajo** — CA-18: que el PRD recoja lo que decidió el TD-frontend (el selector conserva un tamaño válido de la URL)
   o que la web lo quite. Necesita decisión de quien aprueba el PRD.
7. **Bajo** — quitar el test duplicado de `apps/api/test/jobs/performance.test.ts:127`.

**A `/module-sync`:** DD-04 (`docs/ARCHITECTURE.md`), DD-05 (`docs/SETUP.md`), y `technical.md`, `functional.md`,
UC-02..08 y `MVP-STATUS.md` (ver el informe del drift-checker).

**Observaciones que no bloquean:** SEC-02 (guarda de estado en el SQL), SEC-03 (la cierra HU-03), SEC-04 (Host),
DP-01 y DP-02 (para HU-05), el foco en Safari de `use-job-actions.ts:62-63` y `JobDetailScreen.actions.test.tsx` en
300 líneas.

---
Ronda: 1 · «Requiere cambios» previos: 0 (máximo 2; al tercero se para y se escala a la persona)

VERDICT: Requiere cambios
