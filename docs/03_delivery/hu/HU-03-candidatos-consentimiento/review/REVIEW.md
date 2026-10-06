# Review — HU-03 Alta, edición y búsqueda de candidatos, con consentimiento (ronda 1)

## 1. Resumen ejecutivo
- **Fecha:** 2026-10-06 · **Rama:** `hu/HU-03-candidatos-consentimiento` · **Commits revisados:**
  `c0e8adc..HEAD` (15 tareas, 4 reaperturas de curado, la tarea T-03 del sprint y los de docs)
- **Ficheros tocados:** 100 de código, tests y docs de módulo, más los artefactos de la HU · **Tasks:** 15/15
  completadas (TASK-02, 09, 11 y 12 reabiertas para curar observaciones)
- **Auditores:** security-auditor ✔ · datos-personales-auditor ✔ · doc-code-drift-checker ✔ · tabla criterio → test ✔
- **Hallazgos:** críticos 0 · altos 0 · medios 4 (curados) · bajos 12 (curados 5, aceptados 7, §9)
- La HU entrega el módulo `candidatos` completo para el reclutador: alta, edición, búsqueda sin tildes con paginación y
  ficha con el consentimiento (registrar, renovar y retirar) y la fecha de fin de retención calculada con la fórmula
  única de RGPD §3. Cumple el PRD: 32/32 CA, 29/29 flujos de UC y 48/48 EC de RF Must con test. Además enmienda
  DEC-11.4 (`details` acotado al esquema), lo que cierra SEC-03 de HU-02 y SEC-04/DP-01 de HU-01.

## 2. Veredicto
**Aprobado con observaciones.** Sin críticos ni altos. Los cuatro medios (tres funciones de más de 50 líneas, un test de
327 líneas y dos desajustes del TD-backend) se curaron antes de cerrar con reaperturas y un ajuste del diseño; quedan
bajos aceptados (§9). La integración final está en verde (§7) tras arreglar la intermitencia de los tests web de ofertas
(T-03).

## 3. Decisiones aplicables

| DEC-NN | Aplica porque | ¿Cumple? |
|---|---|---|
| DEC-01 | Stack | Sí — sin dependencias nuevas; Fastify, `node:sqlite`, React y Vite |
| DEC-03 | Esquema por migraciones | Sí — `apps/api/src/db/migrations/002-create-candidates.sql` nueva; la `001` sin tocar; `git ls-files` no tiene `.db` |
| DEC-04 | Sin login | Sí — ningún endpoint pide credenciales |
| DEC-06 | Módulos y transacciones | Sí — `candidates` no importa `jobs`; puerto `CandidateProcessesPort` con `noCandidateProcesses` (`apps/api/src/modules/candidates/processes-port.ts`); alta y consentimiento recalculan dentro de `withTransaction` |
| DEC-07 | Códigos y unicidad | Sí — `DUPLICATE` 409 con `existingId` (`apps/api/src/errors.ts:40-42`); `NOT_FOUND` 404 |
| DEC-09 | Fechas y reloj | Sí — reloj inyectado; día natural de Europe/Madrid en `apps/api/src/modules/candidates/retention.ts` |
| DEC-10 | Búsqueda sin tildes | Sí — `fold_search` + `instr`, `registerTextSearch` en el repositorio |
| DEC-11 | Validación y errores (punto 4 enmendado) | Sí — texto literal en `docs/07_architecture_principles/DECISIONS.md:186-192`, igual que el TD; código en `apps/api/src/http/error-handler.ts:58-72` y `forbiddenFields` (`apps/api/src/http/validation.ts:25-29`); regresión de ofertas en verde antes y después (`apps/api/test/jobs/error-details-regression.test.ts`) |
| DEC-12 | Escrituras desde otro sitio | Sí — los `POST` de consentimiento heredan la guarda global; probado en `apps/api/test/candidates/consent-adversarial.test.ts` (`cross-site` y `same-site` → 403) |

## 4. Hallazgos por auditor

### security-auditor
0 críticos, 0 altos, 0 medios, 2 bajos (VERDICT del auditor: OK).
- **SEC-03 de HU-02 (`details` sin acotar): cerrado.** Ninguna ruta nombra claves desconocidas; tope «declaradas + 1»
  probado con 1 000 claves (`apps/api/test/http/error-details.test.ts`).
- **SEC-06 · bajo** — `apps/api/src/http/cross-site.ts:22`: sin lista de `Host`, un DNS rebinding llegaría como
  `same-origin`. Es SEC-04/05 de HU-02; ahora expone candidatos además de ofertas. Aceptado (§9).
- **SEC-07 · bajo** — `apps/api/src/modules/candidates/schemas.ts:63,78`: `NO_CONTROL_CHARS` no cubre `\p{Cf}` (RLO,
  ZWSP) en nombre y skills; solo suplantación visual, React escapa. Aceptado (§9).
- Sin inyección SQL (constantes con parámetros con nombre, `instr` y `json_each` parametrizados), sin XSS (texto JSX,
  cero `innerHTML`), errores con texto fijo, `rejectBody` en las acciones de consentimiento.

### datos-personales-auditor
0 críticos, 0 altos, 0 medios, 3 bajos (VERDICT del auditor: OK).
- **DP-01 de HU-01 (`details`): cerrado.**
- **DP-01 · bajo** — `apps/web/test/features/candidates/api.test.ts` usaba `a@b.es`. **Curado** en `a669796`
  (`@example.com`).
- **DP-02 · bajo** — teléfonos del seed y de los tests con formato de móvil real. Decisión del responsable: la serie
  `+34 600 000 0xx` queda fijada en `docs/RGPD.md` §6 y se unifica en HU-04 (`docs/01_roadmap/sprints/sprint-01.md`).
- **DP-03 · bajo** — `apps/api/src/logger.ts:11`: un `path` con texto libre que da 400 queda en el log. Residual,
  aceptado (§9).
- Sin decidir en `docs/RGPD.md`, resuelto por el responsable: el texto de cada versión del consentimiento se conserva en
  el repo (anotado en `docs/RGPD.md` §2; test que ate las versiones de web y API en HU-04); los candidatos con la
  retención vencida siguen en el listado sin marca hasta la feature A.

### doc-code-drift-checker
0 críticos, 0 altos, 2 medios y 7 bajos, documentales (VERDICT del auditor: HALLAZGOS). Todas las rutas citadas existen;
DEC-11.4 coincide literalmente con el TD.
- **DD-01 · medio** — DD-06 del TD-backend decía que un puerto incoherente siempre da error; el código solo lo da si no
  aplica ningún plazo (como § Firmas internas). **Curado:** TD y comentario de
  `apps/api/src/modules/candidates/processes-port.ts` (`1649156`, `2e89515`).
- **DD-02 · medio** — «5 aserciones» de ofertas cambiadas; fueron 6 (también `apps/api/test/http/error-handler.test.ts:236`,
  por el mensaje `boolean`). **Curado** en el TD, TASK-01 y el ROADMAP (`2e89515`); el commit `df83266` ya listaba las 6.
- **DD-03, DD-04, DD-05, DD-08 · bajos** (líneas previas al cambio, test de EC-38, redacción del seed, mecanismo de
  DEC-11.4). **Curados** en el TD-backend (`2e89515`).
- **DD-06 · bajo** — `docs/03_delivery/hu/HU-03-candidatos-consentimiento/plans/TECHNICAL_DOC-frontend.md:120`: la
  edición no fija su título durante la carga directa. **Aceptado** (§9); el texto de «no encontrado» se unificó con la
  ficha (`8306c62`).
- **DD-07 · bajo** — piezas no listadas en el TD-frontend (`consent.test.ts`, `isValidId`, `gone?`). Anotadas en
  TASK-09 y TASK-11 (`2e89515`); el TD-frontend se acepta así (§9).
- **DD-09 · bajo** — `docs/05_modules/candidatos/casos-de-uso/UC-11-buscar-candidatos.md:38` habla de «elegir una
  skill» y la web es un campo de texto (DT-04). Para `/module-sync`.

## 5. Criterio → test
Tabla completa construida sobre los tests de `apps/api/test/candidates/`, `apps/web/test/features/candidates/`,
`apps/web/test/components/`, `apps/api/test/http/error-details.test.ts` y `e2e/candidates*.spec.ts`. Resumen por
origen (un test por fila; todos en verde en §7):

| Origen | UC | Criterio o edge case | Categoría | Test (`fichero:línea`) | Estado |
|---|---|---|---|---|---|
| CA-01, CA-02 | UC-09 · P | Alta normalizada; retención alta + 6 meses (Madrid, fin de mes) | — | `apps/api/test/candidates/create.test.ts:37` · `apps/api/test/candidates/retention.test.ts:80` | pasa |
| CA-03 | UC-09 · A1 | Alta con consentimiento: fecha, `v1`, + 24 meses | — | `apps/api/test/candidates/create.test.ts:60` | pasa |
| CA-04 | UC-09 · E1 | Inválidos → 400 junto al campo | 1 input inválido | `apps/api/test/candidates/create-adversarial.test.ts:113` | pasa |
| CA-05 | UC-09 · E2 | Email duplicado → 409 con ID, sin email | 6 seguridad | `apps/api/test/candidates/create-adversarial.test.ts:173` | pasa |
| CA-06 | UC-09 · E3 | Fallo de SQLite → 500 sin datos | 3 dependencia | `apps/api/test/candidates/create-adversarial.test.ts:196` | pasa |
| CA-07..CA-10 | UC-10 · P, A1-A3 | Editar, email libre o propio, sin cambios | — | `apps/api/test/candidates/update.test.ts:41,65,74,83` | pasa |
| CA-11..CA-14 | UC-10 · E1-E4 | 400, 409 ajeno, 404, 500 con ficha intacta | 1, 6, 3 | `apps/api/test/candidates/update.test.ts:144,161,176` · `apps/api/test/candidates/update-adversarial.test.ts:107` | pasa |
| CA-15..CA-19 | UC-11 · P, A1-A4 | Búsqueda sin tildes, 4 campos, skill, vacío, páginas | — | `apps/api/test/candidates/list.test.ts:48,103,62,79,112` | pasa |
| CA-20, CA-21 | UC-11 · E1, E2 | `q` inválido → 400; API caída → «Reintentar» | 1, 3 | `apps/api/test/candidates/list-adversarial.test.ts:52` · `apps/web/test/features/candidates/CandidateListScreen.test.tsx:126` | pasa |
| CA-22..CA-24 | UC-12 · P, E1, E2 | Ficha en 3 estados; 404; API caída | — | `apps/web/test/features/candidates/CandidateDetailScreen.test.tsx:101,195,232` · `apps/api/test/candidates/get.test.ts:41,140` | pasa |
| CA-25..CA-28 | UC-13 · P, A1-A3 | Registrar, retirar, renovar, retirar sin vigente | — | `apps/api/test/candidates/consent.test.ts:49,125,65,144` | pasa |
| CA-29, CA-30 | UC-13 · E1, E2 | 404; fallo → 500 y ROLLBACK | 6, 3 | `apps/api/test/candidates/consent-adversarial.test.ts:135,149` | pasa |
| CA-31 | UC-13 · P, A1 | Fórmula de RGPD §3; puerto por defecto | — | `apps/api/test/candidates/retention.test.ts:92` | pasa |
| CA-32 | UC-09, UC-11 · E | Sin datos personales en logs ni errores | 6 seguridad | `apps/api/test/candidates/privacy-logs.test.ts:77` | pasa |
| EC-01..EC-17, EC-58, EC-59 (RF-01, RF-02) | — | Cuerpo no JSON, solo lectura, fronteras, duplicado simultáneo, doble clic, control, 1 000 claves | 1-7 | `apps/api/test/candidates/create-adversarial.test.ts:69,90,136,184,221,252` · `apps/api/test/candidates/create.test.ts:87,108,132,158` · `apps/web/test/features/candidates/CandidateFormScreen.adversarial.test.tsx:132` | pasa |
| EC-19..EC-26 (RF-03) | — | `PATCH {}`, ID no numérico, vaciar, concurrencia, fallo, enumeración, idempotencia | 1-7 | `apps/api/test/candidates/update.test.ts:113,122,185,194` · `apps/api/test/candidates/update-adversarial.test.ts:44,138` | pasa |
| EC-27..EC-33 (RF-04) | — | Parámetros inválidos, fronteras, plegado, API caída, `' OR 1=1`, `%` y `_` | 1-6 | `apps/api/test/candidates/list-adversarial.test.ts:52,111` · `apps/api/test/candidates/list.test.ts:126,165` | pasa |
| EC-35..EC-40 (RF-05) | — | ID inválido, opcionales vacíos, re-lectura, HTML como texto | 1-6 | `apps/api/test/candidates/get.test.ts:110,149` · `apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx:277` · `apps/web/test/features/candidates/CandidateDetailScreen.adversarial.test.tsx:84` | pasa |
| EC-42..EC-49 (RF-06) | — | Cuerpo en la acción, fronteras, fallo, concurrencia, corruptos, doble clic, DEC-12 | 1-7 | `apps/api/test/candidates/consent-adversarial.test.ts:83,149,199` · `apps/api/test/candidates/consent.test.ts:82,176` · `apps/api/test/candidates/migration.test.ts:143` | pasa |
| EC-51..EC-57 (RF-07) | — | Fechas límite, varias filas, puerto que falla, inscripción abierta, error sin datos, idempotencia | 2-7 | `apps/api/test/candidates/retention.test.ts:80,130,148,186` · `apps/api/test/candidates/create-adversarial.test.ts:207` | pasa |
| RF-08 (Should) | — | Migración y seed de 30 (10/4/16), ninguno vencido | — | `apps/api/test/candidates/seed.test.ts:50` · `apps/api/test/candidates/migration.test.ts:70` | pasa |
| EC-06, 14, 15, 18, 31, 32, 34, 39, 41, 50, 54 | — | Categorías sin aplicación | — | N/A (justificado en el PRD) | — |

**Resultado:** 32/32 CA, 29/29 flujos de UC (UC-12 · A1 es de HU-04) y 48/48 EC de RF Must. La Trazabilidad de
UC-09..13 está rellena con el test de cada flujo.

## 6. Gates de QUALITY-GATES

| Umbral | Medido | ¿Cumple? |
|---|---|---|
| Líneas por fichero ≤ 300 | Tras el curado: máx. `apps/web/test/features/candidates/candidate-form-model.test.ts` y `CandidateFormScreen.edit.test.tsx` 300; `src` máx. `apps/web/src/features/jobs/JobFormScreen.tsx` 214 (de HU-03, `apps/api/src/modules/candidates/schemas.ts` 206) (antes: `apps/web/test/features/candidates/api.test.ts` 327, curado en `a669796`) | Sí |
| Líneas por función ≤ 50 | Medido con `max-lines-per-function` (sin blancos ni comentarios) sobre `apps/api/src` y `apps/web/src`: solo las factorías de objetos de métodos (`createCandidatesRepository` 64, `createCandidatesService` 79, el registro de rutas 54), excusadas como en HU-02. Antes del curado: `CandidateForm` 51, `ConsentSection` 57, `useConsentActions` 56 (curados en `8306c62` y `dc0acd4`) | Sí |
| Complejidad ≤ 10 ramas | `complexity` 10 sobre `apps/api/src` y `apps/web/src`: ningún aviso. `resolveScreen` de `apps/web/src/App.tsx` pasó a la tabla `ROUTES` (TASK-10) | Sí |
| 1 test por RF, flujo y EC Must | 7/7 RF Must, 29/29 flujos, 48/48 EC Must | Sí |
| Anti-patrones de §4 | Sin hallazgos | Sí |
| typecheck, lint, test, e2e, check:harness | En verde (§7) | Sí |

## 7. Integración
Ejecutada por la review sobre `f888305` (con el curado y T-03), con Node 24.21.0:

```
$ npm run typecheck
exit=0
$ npm run lint
exit=0
$ npm test
 Test Files  41 passed (41)
      Tests  558 passed (558)
 Test Files  41 passed (41)
      Tests  535 passed (535)
exit=0
$ npm run e2e
  34 passed (17.2s)
exit=0
$ npm run check:harness
check:harness: todo en verde.
exit=0
$ git ls-files | grep -c '\.db$'
0
```

Antes de T-03, la integración sobre `2e89515` dio en la web `2 failed | 533 passed`: dos tests de ofertas
(`apps/web/test/features/jobs/CloseJobAction.test.tsx`, «un 409 al cerrar…», y
`apps/web/test/features/jobs/JobListScreen.filters.test.tsx`, «vacío con filtros…») que pasaban al repetir. Causa: el
foco movido por un efecto pasivo, y la recarga de la ficha tras guardar, se asertaban justo después de un `findBy` que
podía resolver antes con la CPU cargada. T-03 (`f888305`) los hace esperar por el estado final, sin tiempos fijos ni
timeouts más largos y sin tocar producción. Las piezas que movió TASK-09 no influyen. Verificación con 24 procesos de
CPU en paralelo:

```
$ t03-jobs.sh 5 24 "test/"   (suite web completa, 5 pasadas)
 Test Files  41 passed (41) · Tests  535 passed (535)   × 5
$ t03-jobs.sh 6 40 "features/candidates components App.test"   (tests de HU-03, 6 pasadas)
 Test Files  22 passed (22) · Tests  277 passed (277)   × 6
```

## 8. Limitaciones
- Sin Safari, Windows ni Linux; rendimiento solo con `fastify.inject` y 1 000 candidatos (`apps/api/test/candidates/performance.test.ts`).
- RNF-07 (accesibilidad) solo con Testing Library y el recorrido de teclado del diálogo en e2e; sin lector de pantalla.
- No se ha comprobado qué `Host` reenvía el proxy de Vite (relevante solo para SEC-06).

## 9. Acciones requeridas
Ninguna bloqueante. **Curado antes de cerrar:** reaperturas de TASK-02 (`1649156`), TASK-09 (`a669796`), TASK-11
(`8306c62`) y TASK-12 (`dc0acd4`); TD-backend, notas de tareas y `docs/RGPD.md` (`2e89515`); T-03 del sprint
(`f888305`).

**Observaciones aceptadas** (merge preaprobado con «Aprobado con observaciones»):
1. SEC-06 · bajo — sin lista de `Host` (DNS rebinding teórico); ahora también afecta a candidatos.
2. SEC-07 · bajo — `\p{Cf}` admitido en nombre y skills (solo visual).
3. DP-02 · bajo — teléfonos del seed y de los tests: se unifican en HU-04 en la serie fijada en `docs/RGPD.md` §6.
4. DP-03 · bajo — un `path` con texto libre que da 400 queda en el log.
5. DD-06 · bajo — título de la edición durante la carga directa.
6. DD-07 · bajo — el TD-frontend no lista `consent.test.ts`, `isValidId` ni `gone?` (anotado en las tareas).
7. DD-09 · bajo — redacción de UC-11 sobre la skill (para `/module-sync`).
8. Candidatos con la retención vencida en el listado sin marca, hasta la feature A (decisión del responsable).

**Avisos para las HU siguientes:** HU-04 conecta `CandidateProcessesPort` y recalcula la retención al inscribir; añade
el test que ata `CONSENT_VERSION` (web) con `CONSENT_TEXT_VERSION` (API) y unifica los teléfonos de ficción.

**A `/module-sync`:** crear `docs/05_modules/candidatos/{functional,technical}.md`; UC-09..13 → `implementado`;
`docs/05_modules/ofertas/technical.md` (deuda SEC-03/SEC-04/DP-01 cerrada, `forbiddenFields`, claves no declaradas
agrupadas); `docs/ARCHITECTURE.md` (módulo `candidates`, migración 002, puerto de procesos, `existingId`, piezas
compartidas de `apps/web/src/components/`); `docs/MVP-STATUS.md`; `docs/SETUP.md` (seed de 10 ofertas y 30 candidatos).

---
Ronda: 1 · «Requiere cambios» previos: 0 (máximo 2; al tercero se para y se escala a la persona)

VERDICT: Aprobado con observaciones
