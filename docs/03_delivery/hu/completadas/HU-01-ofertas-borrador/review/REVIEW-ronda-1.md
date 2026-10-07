# Review — HU-01 Crear, editar y consultar ofertas en borrador

## 1. Resumen ejecutivo
- **Fecha:** 2026-10-06 · **Rama:** `hu/HU-01-ofertas-borrador` · **Commits revisados:**
  `a430023..1d3fa03` (19: 5 de especificación y 14 de código; TASK-01..15 en 15 commits, el de TASK-01 con su brief)
- **Ficheros tocados:** 66 de código y configuración, más los documentos de la HU · **Tasks:** 15/15 completadas
- **Auditores:** security-auditor ✔ · datos-personales-auditor ✔ · doc-code-drift-checker ✔ (más la tabla criterio →
  test, los gates y el contraste DEC/DD, hechos por la review)
- **Hallazgos:** críticos 1 · altos 2 · medios 9 · bajos 8
- La HU entrega el módulo `ofertas` completo para borradores: API (`POST/GET/PATCH/DELETE /api/jobs`), migración `001`,
  seed de 4 borradores, y web con listado, ficha, alta, edición y borrado con confirmación, más las piezas transversales
  de DEC-11. Cumple el PRD en 20/20 CA y 17/17 flujos de UC, con la integración completa en verde. Falla en un edge
  case de RF Must sin test (EC-32) y en un caso que la review destapó al ejecutar: un carácter NUL en el título da 500
  en vez de 400.

## 2. Veredicto
**Requiere cambios.** Hay un edge case de RF Must sin test (EC-32, crítico por la regla de `/reviewer`) y una entrada
inválida que la API responde con 500 en lugar de 400 (DEC-07 incumplida, comprobado ejecutando). El resto está en verde.

## 3. Decisiones aplicables

| DEC-NN | Aplica porque | ¿Cumple? |
|---|---|---|
| DEC-01 | Stack y envelope | Sí — envelope único en `apps/api/src/http/error-handler.ts:20`; router propio sin librería (`apps/web/src/components/router.tsx`) |
| DEC-03 | Primera migración y seed | Sí — `apps/api/src/db/migrations/001-create-job-openings.sql`; `git ls-files` sin ningún `.db`; seed inventado (`apps/api/src/db/seed.ts:10`) |
| DEC-04 | Sin login | Sí — sin login ni roles; escucha en `127.0.0.1` por defecto (`apps/api/src/server.ts:7`, anterior a la HU) |
| DEC-05 | Dependencias | Sí — ninguna dependencia nueva en los tres `package.json` |
| DEC-06 | Módulos y transacciones | Sí — `modules/jobs` solo importa piezas transversales; `withTransaction` en `apps/api/src/db/transaction.ts:8`; composición en `apps/api/src/app.ts:47-52` |
| DEC-07 | Códigos HTTP | **No** — un NUL embebido en el título o la ubicación da 500 `INTERNAL_ERROR` en lugar de 400 (§4, SEC-02). El resto sí: 201, 200, 204, 400 y 404 (`apps/api/src/modules/jobs/routes.ts:38,68`; `service.ts:65,71,81`) |
| DEC-08 | Concurrencia | Sí — última escritura campo a campo (`apps/api/src/modules/jobs/service.ts:73`); alta sin idempotencia (DT-03), probada en `apps/api/test/jobs/create.test.ts:143` |
| DEC-09 | Fechas y reloj | Sí — `Clock` (`apps/api/src/clock.ts:2`) inyectado en `app.ts:18`; Europe/Madrid en `apps/web/src/components/format.ts:8` |
| DEC-10 | Listado | Sí — `{ items, total, page, pageSize }` con 20 (`service.ts:83-86`), `id DESC` (`repository.ts:66`), solo campos de lista (`repository.ts:64`) |
| DEC-11 | Validación y errores | Sí — Ajv sin coerción (`apps/api/src/http/validation.ts:8`), ID con `pattern` (`:16`), recorte en `preValidation` (`routes.ts:19`), mensajes por *keyword* (`error-handler.ts:73`), 413/415/500 (`:41-50`) y los dos tests que exige (`apps/api/test/jobs/create-adversarial.test.ts:79` y `:124-127`) |

Las DD de los dos TECHNICAL_DOC (DD-01..13 del backend y DD-01..08 del frontend) están implementadas como dicen. Las
desviaciones de estructura (ficheros de test nuevos por el umbral de 300 líneas, `NotFound` exportado para reutilizarlo)
están justificadas en el §7 de `TASK-06-BRIEF.md`, `TASK-13-BRIEF.md` y `TASK-14-BRIEF.md`.

## 4. Hallazgos por auditor

### security-auditor
0 críticos, 0 altos, 0 medios, 1 bajo (VERDICT del auditor: OK), más una sospecha que la review confirmó ejecutando:

- **SEC-02 · alto (confirmado por la review)** — `apps/api/src/modules/jobs/schemas.ts:57-59` y
  `apps/api/src/db/migrations/001-create-job-openings.sql:4,6`. Un título con un NUL embebido pasa Ajv (cuenta puntos de
  código) pero SQLite cuenta en `length()` solo hasta el primer NUL, así que el `CHECK` falla y la API responde 500.
  Evidencia (sonda de la review con `buildApp` + `inject`): `"a\u0000bcdef"` → **500** `INTERNAL_ERROR`;
  `"\u0000\u0000\u0000"` → **500**; `"abcdef\u0000"` → **201** y se guarda el NUL. Es una entrada inválida que debería
  ser 400 (DEC-07) y que, además, deja caracteres de control en la base. No hay fuga de datos (el 500 es genérico).
- **SEC-01 · bajo** — `apps/api/src/app.ts:18` y `apps/web/index.html:3-7`: sin cabeceras de endurecimiento (`nosniff`,
  `frame-ancestors`). Sin explotación hoy (solo `127.0.0.1`, React escapa). Observación para la auditoría de sprint.
- Sin hallazgos en inyección SQL (todo con `?`; `UPDATE` de 6 columnas fijas), esquema estricto, *mass assignment*, XSS
  (ningún `dangerouslySetInnerHTML`/`innerHTML`), errores (mensajes fijos, sin stack), tamaño, secretos y logs.
- **Aviso para HU-02:** `service.update` y `service.remove` no comprueban el estado; no es explotable en HU-01 (solo hay
  borradores), pero HU-02 debe comprobarlo en el servicio, no solo ocultar botones.

### datos-personales-auditor
0 críticos, 0 altos, 0 medios, 3 bajos (VERDICT del auditor: OK). La HU no trata datos personales.

- **DP-01 · bajo** — `apps/api/src/http/error-handler.ts:63-65`: el nombre de una clave no permitida vuelve en
  `details[].field`. Inocuo hoy; documentarlo o limitarlo a una lista blanca antes de candidatos.
- **DP-02 · bajo** — `apps/web/test/components/router.test.tsx:108`: fixture `'Ana Pérez'`, un nombre corriente sin
  marca de ficción. Renombrarlo a un valor inequívoco.
- **DP-03 · bajo (informativo)** — `apps/api/src/modules/jobs/schemas.ts:58`: la descripción es texto libre; nada
  impide escribir nombres de terceros. Aceptable en el alcance.
- **Para HU-03, sin decidir en `docs/RGPD.md`:** título del documento con el nombre del candidato (historial del
  navegador), mensaje del duplicado por email sin revelar la ficha, y rutas de candidatos solo con ID (el `path` va al
  log). Se pasan al PRD/diseño de HU-03.

### doc-code-drift-checker
1 crítico, 1 alto, 6 medios, 4 bajos (VERDICT del auditor: BLOQUEANTE). La review los clasifica así:

- **DD-01 · crítico según el auditor → medio en esta review** — `docs/ARCHITECTURE.md:45` cita el código `CONFLICT`;
  DEC-07 dice `DUPLICATE`/`INVALID_TRANSITION`. Es anterior a la HU (paso-0) y la corrección ya está decidida para
  `/module-sync` (aprobación del PRD de HU-03). No es una ruta inexistente.
- **DD-02 · alto** — `plans/TECHNICAL_DOC-frontend.md:46,305`: `parseJobId` con `{0,15}`; el código y la API usan
  `{0,14}` (correcto, decidido al aprobar las tareas y anotado en `tasks/TASK-08.md:103-104`), pero el TD no se corrigió.
- **DD-05 · medio** — `plans/TECHNICAL_DOC-backend.md:699`: sigue el riesgo «`data/e2e.db` no se regenera», resuelto
  por DD-08 del frontend (`playwright.config.ts:30,37`).
- **DD-06 / DD-07 · medios** — los TD y `tasks/TASK-06.md`, `TASK-13.md` y `TASK-14.md` citan `create.test.ts` y
  `JobFormScreen.test.tsx` para tests que ahora viven en `create-adversarial.test.ts`, `JobFormScreen.edit.test.tsx` y
  `JobFormScreen.adversarial.test.tsx`.
- **DD-03 · medio** — `.claude/agents/backend-architect.md:27` usa `CONFLICT` e `INVALID_STATE_TRANSITION`.
- **DD-04 · medio** — `docs/ARCHITECTURE.md` no recoge `buildApp({ db, logger?, now? })`, `http/`, `errors.ts`,
  `clock.ts`, `db/transaction.ts`, los códigos de DEC-11 ni los puertos de e2e.
- **DD-08 · medio** — `.claude/reglas/security-auditor/frontend.md:7` describe la web de paso-0.
- **Bajos (anteriores a la HU):** DD-09 (`docs/_modules.md:12-13`), DD-10 (`docs/README.md:34`), DD-11
  (`AGENTS.md:23` sin `uc` ni `check:clean`), DD-12 (`API_HOST` sin documentar).
- Sin hallazgos en: todas las rutas citadas existen; SETUP.md ↔ `playwright.config.ts`; DEC-11 ↔ código; TD ↔ código
  (salvo DD-02).

### Revisión de calidad (la review)
- **Medio** — funciones de más de 50 líneas: `apps/web/src/components/ConfirmDialog.tsx:17` (66) y
  `apps/web/src/features/jobs/DeleteJobAction.tsx:14` (62).
- **Medio** — complejidad: `apps/api/src/http/error-handler.ts:73` `messageOf`, unas 13 ramas (> 10).
- **Bajo** — `apps/api/test/http/error-handler.test.ts` tiene 299 líneas, a una del tope.

## 5. Criterio → test
Abreviaturas: `A/` = `apps/api/test/jobs/`, `AH/` = `apps/api/test/http/`, `W/` = `apps/web/test/features/jobs/`,
`WC/` = `apps/web/test/components/`, `E2E` = `e2e/jobs.spec.ts`. Los 18 criterios de `hu.md` son CA-01..20 del PRD
(el 9 se reparte en CA-09/10 y el 14 en CA-15/16). «pasa» = test presente y en verde en §7.

| Origen | UC | Criterio o edge case | Categoría | Test (`fichero:línea`) | Estado |
|---|---|---|---|---|---|
| CA-01 / RF-01 | UC-01 · P | Solo título → 201 en `draft`, ficha y listado | — | `A/create.test.ts:47` · `W/JobFormScreen.test.tsx:55` · `E2E:72` | pasa |
| CA-02 / RF-01 | UC-01 · P | Título recortado y todos los campos | — | `A/create.test.ts:78` · `E2E:90` | pasa |
| CA-03 / RF-02 | UC-01 · E1 | Título ausente, espacios, 2 o 121 → 400; 3 y 120 se crean | — | `A/create.test.ts:169`, `:179` · `W/JobFormScreen.test.tsx:136` · `E2E:117` | pasa |
| CA-04 / RF-02 | UC-01 · E2 | Descripción 5 001 → 400; 5 000 se crea | — | `A/create.test.ts:169`, `:179` · `W/job-form-model.test.ts:51` | pasa |
| CA-05 / RF-02 | UC-01 · E3 | «teletrabajo» → 400; los 3 literales | — | `A/create.test.ts:193`, `:200` | pasa |
| CA-06 / RF-02 | UC-01 · E4 | Ubicación 1 o 121 → 400; 2 y 120 se crean | — | `A/create.test.ts:169`, `:179` · `W/job-form-model.test.ts:63` | pasa |
| CA-07 / RF-02 | UC-01 · E5 | Banda inválida → 400; solo uno o iguales | — | `A/create.test.ts:214`, `:220` · `A/create-adversarial.test.ts:127` | pasa |
| CA-08 / RF-02 | UC-01 · E6 | `status`, fecha o campo desconocido → 400 | — | `A/create-adversarial.test.ts:79` | pasa |
| CA-09 / RF-03 | UC-02 · P | Edita; sigue en `draft` y `createdAt` igual | — | `A/update.test.ts:40` · `W/JobFormScreen.edit.test.tsx:83` · `E2E:130` | pasa |
| CA-10 / RF-03 | UC-02 · P | Vaciar descripción → `null` y «Sin indicar» | — | `A/update.test.ts:68` · `W/JobFormScreen.edit.test.tsx:100` · `E2E:130` | pasa |
| CA-11 / RF-03 | UC-02 · A1 | Dos pestañas: gana la última | — | `A/update.test.ts:85` · `E2E:159` | pasa |
| CA-12 / RF-03 | UC-02 · E2 | Edición inválida → 400 sin cambios | — | `A/update.test.ts:144` · `W/JobFormScreen.edit.test.tsx:124` | pasa |
| CA-13 / RF-04 | UC-05 · P | Borrar con confirmación → 204; cancelar no borra | — | `A/delete.test.ts:26` · `W/DeleteJobAction.test.tsx:41`, `:67` · `E2E:183` | pasa |
| CA-14 / RF-04 | UC-05 · E2 | Segundo DELETE → 404 | — | `A/delete.test.ts:103` · `W/DeleteJobAction.test.tsx:121` | pasa |
| CA-15 / RF-05 | UC-07 · P | 25 → 20 más recientes, desempate, `total` 25 | — | `A/list.test.ts:40` · `W/JobListScreen.test.tsx:119` | pasa |
| CA-16 / RF-05 | UC-07 · P | 22:30Z → 07/10/2026 | — | `A/list.test.ts:59` · `W/JobListScreen.test.tsx:129` · `WC/format.test.ts:5` | pasa |
| CA-17 / RF-05 | UC-07 · A2 | Sin ofertas → «vacío» | — | `A/list.test.ts:72` · `W/JobListScreen.test.tsx:54` | pasa |
| CA-18 / RF-05 | UC-07 · E4 | API caída → «error» sin datos | — | `W/JobListScreen.test.tsx:66` · `E2E:204` | pasa |
| CA-19 / RF-06 | UC-08 · P | Ficha completa, `<b>` como texto, solo Editar y Borrar | — | `A/get.test.ts:23` · `W/JobDetailScreen.test.tsx:69` · `E2E:213` | pasa |
| CA-20 / RF-06 | UC-08 · E1 | ID inexistente → 404 sin datos | — | `A/get.test.ts:80` · `W/JobDetailScreen.test.tsx:125` · `E2E:221` | pasa |
| EC-01 / RF-01 Must | UC-01 · E6 | Cuerpo no JSON, `[]`, `"x"` | 1 input inválido | `A/create-adversarial.test.ts:45` · `W/JobFormScreen.test.tsx:170` | pasa |
| EC-02 / RF-01 Must | UC-01 · E6 | `status`, `createdAt`, `id` | 1 input inválido | `A/create-adversarial.test.ts:79` · `W/job-form-model.test.ts:149` | pasa |
| EC-03 / RF-01 Must | UC-01 · P | Espacios alrededor | 2 boundary | `A/create.test.ts:78` | pasa |
| EC-04 / RF-01 Must | — | Tildes y emoji | 2 boundary | `A/create.test.ts:129` · `W/job-form-model.test.ts:44` | pasa |
| EC-05 / RF-01 Must | — | Falla el INSERT → 500 sin filas | 3 dependencia | `A/create-adversarial.test.ts:95` · `W/JobFormScreen.test.tsx:231` | pasa |
| EC-06 / RF-01 Must | — | Doble clic en «Guardar» | 4 concurrencia | `W/JobFormScreen.adversarial.test.tsx:61` · `A/create.test.ts:143` | pasa |
| EC-08 / RF-01 Must | — | Inyección SQL en el título | 6 seguridad | `A/create-adversarial.test.ts:108` · `E2E:231` | pasa |
| EC-09 / RF-01 Must | — | Reintento tras error de red | 7 idempotencia | `A/create.test.ts:143` · `W/JobFormScreen.test.tsx:216` · `WC/http.test.ts:175` | pasa |
| EC-10 / RF-02 Must | UC-01 · E3 | «teletrabajo», «Híbrida», «hibrida» | 1 input inválido | `A/create.test.ts:193` | pasa |
| EC-11 / RF-02 Must | UC-01 · E5 | `"40000"`, 40000.5, 0, -1 | 1 input inválido | `A/create-adversarial.test.ts:127` | pasa |
| EC-12 / RF-02 Must | UC-01 · E1/E2/E4 | Fronteras de longitud | 2 boundary | `A/create.test.ts:169`, `:179` | pasa |
| EC-13 / RF-02 Must | UC-01 · E5 | mín = máx, solo uno | 2 boundary | `A/create.test.ts:214` · `W/labels.test.ts:10` | pasa |
| EC-16 / RF-02 Must | — | CHECK mín > máx en la base | 5 datos corruptos | `A/migration.test.ts:83` | pasa |
| EC-17 / RF-02 Must | — | Descripción de 1 MB | 6 seguridad | `A/create-adversarial.test.ts:147` · `W/JobFormScreen.test.tsx:194` | pasa |
| EC-19 / RF-03 Must | — | `PATCH {}` | 1 input inválido | `A/update.test.ts:107` · `W/JobFormScreen.adversarial.test.tsx:89` | pasa |
| EC-20 / RF-03 Must | UC-02 · E2 | Vaciar el título | 1 input inválido | `A/update.test.ts:144` · `W/JobFormScreen.edit.test.tsx:112` | pasa |
| EC-21 / RF-03 Must | UC-02 · P | Vaciar descripción → `null` | 2 boundary | `A/update.test.ts:68` | pasa |
| EC-22 / RF-03 Must | — | Falla el UPDATE → 500 sin cambios | 3 dependencia | `A/update.test.ts:217` · `W/JobFormScreen.edit.test.tsx:151` | pasa |
| EC-23 / RF-03 Must | UC-02 · A1 | Dos pestañas, campo a campo | 4 concurrencia | `A/update.test.ts:85` · `E2E:159` | pasa |
| EC-24 / RF-03 Must | — | PATCH de una oferta borrada → 404 | 5 datos corruptos | `A/update.test.ts:232` · `W/JobFormScreen.adversarial.test.tsx:124` | pasa |
| EC-25 / RF-03 Must | — | PATCH con `status`, `createdAt`, `id` | 6 seguridad | `A/update.test.ts:192` | pasa |
| EC-26 / RF-03 Must | — | El mismo PATCH dos veces | 7 idempotencia | `A/update.test.ts:123` | pasa |
| EC-27 / RF-04 Must | — | `DELETE /api/jobs/abc` | 1 input inválido | `A/delete.test.ts:67` | pasa |
| EC-28 / RF-04 Must | — | Borrar el único → vacío | 2 boundary | `A/delete.test.ts:44` · `W/JobListScreen.test.tsx:54` | pasa |
| EC-29 / RF-04 Must | — | Falla el DELETE → 500, sigue | 3 dependencia | `A/delete.test.ts:87` · `W/DeleteJobAction.test.tsx:81` | pasa |
| EC-30 / RF-04 Must | — | Borrar mientras se edita | 4 concurrencia | `A/update.test.ts:232` · `W/JobFormScreen.adversarial.test.tsx:124` | pasa |
| EC-32 / RF-04 Must | — | Enumeración de IDs secuenciales | 6 seguridad | — (el PRD no lo marca N/A; el TD lo «acepta sin test») | **falla (crítico)** |
| EC-33 / RF-04 Must | UC-05 · E2 | Doble clic en «Borrar» | 7 idempotencia | `A/delete.test.ts:103` · `W/DeleteJobAction.test.tsx:104` | pasa |
| EC-34 / RF-05 Must | — | `?page=2` u otro parámetro | 1 input inválido | `A/list.test.ts:97` · `W/api.test.ts:49` | pasa |
| EC-35 / RF-05 Must | UC-07 · P/A2 | 0, 20 y 21 ofertas | 2 boundary | `A/list.test.ts:72` · `W/JobListScreen.test.tsx:109`, `:119` | pasa |
| EC-36 / RF-05 Must | UC-07 · P | 22:30Z → 07/10/2026 | 2 boundary | `W/JobListScreen.test.tsx:129` · `WC/format.test.ts:5` | pasa |
| EC-37 / RF-05 Must | UC-07 · P | Misma fecha → ID mayor primero | 2 boundary | `A/list.test.ts:81` · `W/JobListScreen.test.tsx:154` | pasa |
| EC-38 / RF-05 Must | UC-07 · E4 | API caída o 500 | 3 dependencia | `W/JobListScreen.test.tsx:66`, `:92` · `E2E:204` | pasa |
| EC-41 / RF-05 Must | — | Título `<img onerror>` | 6 seguridad | `A/list.test.ts:112` · `W/JobListScreen.test.tsx:182` | pasa |
| EC-43 / RF-06 Must | UC-08 · E1 | `/api/jobs/abc` o `1.5` | 1 input inválido | `A/get.test.ts:91` · `W/JobDetailScreen.test.tsx:138`, `:150` | pasa |
| EC-44 / RF-06 Must | UC-08 · P | Solo título → «Sin indicar» | 2 boundary | `A/get.test.ts:52` · `W/JobDetailScreen.test.tsx:103` | pasa |
| EC-45 / RF-06 Must | — | API caída al abrir la ficha | 3 dependencia | `W/JobDetailScreen.test.tsx:162`, `:187` | pasa |
| EC-46 / RF-06 Must | — | Borrada en otra pestaña | 4 concurrencia | `A/get.test.ts:104` · `W/DeleteJobAction.test.tsx:121` | pasa |
| EC-48 / RF-06 Must | UC-08 · P | `<script>` y `<b>` en la descripción | 6 seguridad | `A/get.test.ts:23` · `W/JobDetailScreen.test.tsx:213` | pasa |
| EC-07, 14, 15, 18, 31, 39, 40, 42, 47, 49 | — | `N/A — razón` en el PRD | 3/4/5/7 | — (EC-40 tiene además `W/JobListScreen.test.tsx:195` y `W/api.test.ts:131`) | N/A |
| RF-07 Should | — | Seed: 4 borradores, 2 con banda | — | `A/seed.test.ts:23` · `A/migration.test.ts:64` · `E2E:53` | pasa |
| RNF-01/02 | — | Lectura < 200 ms y acción < 500 ms | — | `A/performance.test.ts:69`, `:79` | pasa |
| RNF-03 | — | Errores siempre en el envelope | — | `AH/error-handler.test.ts:86-268` | pasa |

**Resultado:** 20/20 CA, 17/17 flujos de UC y 38/39 EC aplicables. Huérfano: EC-32.

## 6. Gates de QUALITY-GATES

| Umbral | Medido | ¿Cumple? |
|---|---|---|
| PRD: rutas, flujos con CA, RNF medibles, edge cases, decisiones, datos personales, 0 OQ, `Ready` | Todo presente; 17/17 flujos con CA; 7 categorías por RF Must | Sí |
| TECHNICAL_DOC: secciones, Error paths con cada EC, DD con alternativas, 0 OD | 49 EC en cada TD; DD-01..13 y DD-01..08; 0 OD | Sí (con el drift de §4) |
| Tasks: ≤ 15, ≤ 4 h, ficheros concretos, adversarial por RF Must | 15 (el máximo), L de 3,5 h, TASK-06/07/14 | Sí |
| Líneas por fichero ≤ 300 | Máximo en `src`: `apps/web/src/features/jobs/JobFormScreen.tsx` 194; en tests: `apps/api/test/http/error-handler.test.ts` 299 | Sí |
| Líneas por función ≤ 50 | `apps/web/src/components/ConfirmDialog.tsx:17` 66 · `apps/web/src/features/jobs/DeleteJobAction.tsx:14` 62 | **No** (medio) |
| Complejidad ≤ 10 ramas | `apps/api/src/http/error-handler.ts:73` `messageOf` ≈ 13 | **No** (medio) |
| 1 test por RF, por flujo de UC y por edge case Must | 7/7 RF, 17/17 flujos, 38/39 EC Must (falta EC-32) | **No** (crítico) |
| Latencia local | RNF-01 y RNF-02 en verde (`apps/api/test/jobs/performance.test.ts:69,79`) | Sí |
| Anti-patrones de §4 | SQL parametrizado; sin HTML interpretado; validación en la API; sin `catch` vacío; seed inventado. **Pero** una entrada inválida da 500 (SEC-02) | No (alto) |
| typecheck, lint, test, e2e, check:harness | En verde (§7) | Sí |

## 7. Integración
Ejecutada por la review sobre `1d3fa03`, con Node 24.21.0:

```
$ npm run typecheck
exit=0
$ npm run lint
exit=0
$ npm test
 Test Files  13 passed (13)
      Tests  126 passed (126)
 Test Files  14 passed (14)
      Tests  159 passed (159)
exit=0
$ npm run e2e
  12 passed (7.2s)
exit=0
$ npm run check:harness
  ✔ a) frontmatter: 12 skills y 8 agentes
  ✔ b) enlaces: 104 enlaces relativos en 122 ficheros .md
  ✔ c) rutas citadas: 175 rutas concretas en 24 ficheros
  ✔ d) hooks: 23 fixtures y ningún import de red
  ✔ e) numeración: IDEA-001, sprint-01 y UC-01 en vacío, sin colisión con archivadas, UC global
  ✔ f) contexto de arranque: 8572 caracteres (máximo 15 000)
  ✔ g) límites: 17 ficheros medidos
  ✔ h) caracteres crudos: 222 ficheros de texto
  ✔ i) casos de uso: 19 UC en 3 catálogos; 128 citas a UC concretos
check:harness: todo en verde.
exit=0
$ git ls-files | grep -c '\.db$'
0
$ sonda NUL (buildApp + inject, POST /api/jobs)
"a\u0000bcdef" 500 {"error":{"code":"INTERNAL_ERROR","message":"Error interno. Inténtalo de nuevo."}}
"abcdef\u0000" 201 {"id":1,"title":"abcdef\u0000",…}
"\u0000\u0000\u0000" 500 {"error":{"code":"INTERNAL_ERROR","message":"Error interno. Inténtalo de nuevo."}}
"ok título" 201 {"id":2,"title":"ok título",…}
```

## 8. Limitaciones
- Rendimiento medido solo con `fastify.inject` en local; sin carga real.
- Sin prueba en Windows ni Linux (solo macOS).
- Los auditores trabajan en estático; la sonda NUL la ejecutó la review. Los surrogates sueltos (mismo riesgo teórico de
  desajuste Ajv ↔ SQLite) no se han probado.

## 9. Acciones requeridas
1. **Crítico** — EC-32 (RF-04 Must, categoría 6) sin test. Arreglo: un test que fije el comportamiento que el PRD
   declara (la API escucha en `127.0.0.1` por defecto, `apps/api/src/server.ts:7`, y la oferta no devuelve datos
   personales), sin cambiar el PRD para esquivarlo. Una tarea `[adversarial]` nueva.
2. **Alto (DEC-07)** — `apps/api/src/modules/jobs/schemas.ts:57-59`: un carácter de control en el título o la ubicación
   da 500 o se guarda. Arreglo: rechazar con 400 `VALIDATION_ERROR` los caracteres de control (C0 y DEL) en título y
   ubicación, y en la descripción todos salvo salto de línea, retorno de carro y tabulador, con tests de «NUL → 400»
   (mismo criterio que la decisión OQ-06 del PRD de HU-03 para candidatos). Necesita un EC nuevo en el PRD, que aprueba
   quien aprueba el PRD.
3. **Alto/medio (drift de la HU)** — corregir en los TD (lo hacen los arquitectos): `TECHNICAL_DOC-frontend.md:46,305`
   (`{0,14}`), `TECHNICAL_DOC-backend.md:699` (riesgo resuelto por DD-08) y las referencias a los ficheros de test
   nuevos (`create-adversarial`, `JobFormScreen.edit`, `JobFormScreen.adversarial`) en los TD y en `tasks/TASK-06.md`,
   `TASK-13.md` y `TASK-14.md`.
4. **Medio** — partir `ConfirmDialog` (`apps/web/src/components/ConfirmDialog.tsx:17`) y `DeleteJobAction`
   (`apps/web/src/features/jobs/DeleteJobAction.tsx:14`) por debajo de 50 líneas, y pasar `messageOf`
   (`apps/api/src/http/error-handler.ts:73`) a una tabla de mensajes por *keyword* (≤ 10 ramas), sin cambiar el
   comportamiento.
5. **Bajo** — `apps/web/test/components/router.test.tsx:108`: cambiar `'Ana Pérez'` por un valor inequívocamente
   inventado (DP-02).

**A `/module-sync` (tras el merge), no bloquean esta ronda:** DD-01 y DD-04 (`docs/ARCHITECTURE.md`), DD-03
(`.claude/agents/backend-architect.md:27`), DD-08 (`.claude/reglas/security-auditor/frontend.md:7`), la sección
Transversal de `docs/_modules.md` y DD-12 (`API_HOST`).

**Observaciones que no bloquean:** SEC-01 (cabeceras, para la auditoría de sprint), DP-01 (eco del nombre de clave),
DP-03 (descripción como texto libre), `error-handler.test.ts` a 299 líneas, DD-09..11 (anteriores a la HU), y los avisos
para HU-02 (estado en `update`/`remove`) y HU-03 (título del documento, duplicado por email y rutas solo con ID).

---
Ronda: 1 · «Requiere cambios» previos: 0 (máximo 2; al tercero se para y se escala a la persona)

VERDICT: Requiere cambios
