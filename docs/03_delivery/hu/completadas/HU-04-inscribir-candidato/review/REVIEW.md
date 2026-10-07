# Review — HU-04 Inscribir en una oferta publicada, sin duplicados (ronda 1)

## 1. Resumen ejecutivo
- **Fecha:** 2026-10-07 · **Rama:** `hu/HU-04-inscribir-candidato` · **Commits revisados:** desde la integración del
  sprint (`7de646c`) hasta `bbd0be6`: 15 tareas, la reapertura de TASK-06 pedida por el responsable técnico, 4
  reaperturas de curado y los de docs
- **Ficheros tocados:** 76 de código, tests y docs de módulo, más los artefactos de la HU · **Tasks:** 15/15
  completadas
- **Auditores:** security-auditor ✔ · datos-personales-auditor ✔ · doc-code-drift-checker ✔ · tabla criterio → test ✔ ·
  prueba de mutación ✔
- **Hallazgos:** críticos 0 · altos 0 · medios 3 (2 curados, 1 aceptado por decisión previa) · bajos 13 (curados 5,
  aceptados 8, §9)
- Nace el módulo `inscripciones`: el reclutador inscribe candidatos de uno en uno en ofertas publicadas desde el pipeline,
  sin duplicados, con su `StageChange` inicial y la retención del candidato a «mientras dure el proceso» en la misma
  transacción. La HU cierra SEC-02 de HU-02 (guarda de estado en el SQL de `jobs`), aclara DEC-06 (claves foráneas entre
  módulos; ningún módulo importa a otro) y deja el historial inmutable salvo vaciar la nota (RGPD §5, decisión del responsable técnico).
  Cumple el PRD v1.1: 23/23 CA, 11/11 flujos de UC y 49/49 EC de RF Must con test.

## 2. Veredicto
**Aprobado con observaciones.** Sin críticos ni altos. De los tres medios, DP-01 (teléfonos fuera de la serie) y DD-01
(consecuencia de DEC-06) se curaron antes de cerrar; DD-02 (texto de UC-17 · E1) se acepta porque el responsable técnico
decidió no tocar ese UC al aprobar el PRD v1.1. La integración final está en verde (§7) y la prueba de mutación
demuestra que los tests adversariales muerden (§5).

## 3. Decisiones aplicables

| DEC-NN | Aplica porque | ¿Cumple? |
|---|---|---|
| DEC-01 | Stack | Sí — sin dependencias nuevas |
| DEC-03 | Esquema por migraciones | Sí — `apps/api/src/db/migrations/003-create-applications.sql` nueva; 001 y 002 sin tocar; ningún `.db` en git |
| DEC-04 | Sin login | Sí |
| DEC-06 | Módulos, puertos y transacciones (aclarada en esta HU) | Sí — texto literal en `docs/07_architecture_principles/DECISIONS.md:98-106`; `JobStatusPort`, `CandidateLookupPort` y `CandidateProcessesPort` conectados en `apps/api/src/app.ts` por tipado estructural; ningún import entre módulos (`apps/api/test/module-boundaries.test.ts`); guardas, `INSERT`, `StageChange` y recálculo en el mismo `withTransaction` |
| DEC-07 | Códigos y unicidad | Sí — 409 `INVALID_TRANSITION` y 409 `DUPLICATE` con `existingId` (`apps/api/src/modules/applications/service.ts:61-85`); el índice único decide el duplicado |
| DEC-09 | Reloj | Sí — un solo `now()` por inscripción |
| DEC-10 | Listados | Excepción declarada (S-18): el pipeline no pagina (SEC-08, §9) |
| DEC-11 | Validación y errores | Sí — `enrollBodySchema` estricto; `details` acotado |
| DEC-12 | Escrituras desde otro sitio | Sí — el `POST` hereda la guarda; probado en `apps/api/test/applications/enroll-adversarial.test.ts` |

## 4. Hallazgos por auditor

### security-auditor
0 críticos, 0 altos, 0 medios, 2 bajos (VERDICT del auditor: OK).
- **SEC-02 de HU-02: cerrado.** `apps/api/src/modules/jobs/repository.ts:43-49`: `UPDATE … AND status IN ('draft',
  'published')` y `DELETE … AND status = 'draft'`; 0 filas → 409. Tests en `apps/api/test/jobs/state-guards.test.ts`.
- **SEC-08 · bajo** — `apps/api/src/modules/applications/repository.ts:89-93`: el pipeline no tiene `LIMIT`. Decisión
  S-18; aceptado (§9).
- **SEC-09 · bajo (observación)** — `apps/api/src/db/migrations/003-create-applications.sql:37-47`: sin
  `recursive_triggers`, un `INSERT OR REPLACE` con SQL directo borraría un `StageChange` sin disparar el trigger. Ninguna
  ruta lo permite; aceptado (§9).
- Sin inyección SQL ni XSS; la excepción `SET note = NULL` no se puede usar desde la API (no hay `UPDATE stage_changes`).

### datos-personales-auditor
0 críticos, 0 altos, 1 medio, 3 bajos (VERDICT del auditor: HALLAZGOS).
- **DP-01 · medio** — `apps/api/test/applications/pipeline.test.ts:114-115`: dos teléfonos fuera de la serie de ficción.
  **Curado** en `d0b2060`.
- **DP-02 · bajo** — `apps/api/src/modules/candidates/repository.ts:106-109`: `recalculateRetention` lee la ficha con
  `SELECT *` para usar fechas y consentimiento. Sin fuga (el retorno se descarta). Deuda para la feature A (§9).
- **DP-03 · bajo** — el panel reutiliza `GET /api/candidates`, que trae `skills` (aceptado en el PRD, RF-08).
- **DP-04 · bajo** — la búsqueda viaja como `?q=` a la API; el logger la quita (`apps/api/src/logger.ts:11`).
- Sin decidir en `docs/RGPD.md` (para la feature A): si un candidato con la retención vencida puede inscribirse o aparecer
  en el buscador (hoy sí, DT-06); la marca de anonimizado en los puertos `exists`/`findNames`; si la anonimización
  vacía siempre la nota del rechazo (el trigger ya lo permite).

### doc-code-drift-checker
0 críticos, 0 altos, 2 medios y 6 bajos (VERDICT del auditor: HALLAZGOS). DEC-06 coincide literalmente con el TD; la
migración 003 y el SQL del trigger coinciden con el TD y TASK-01; las 33 citas de la Trazabilidad apuntan a su `it(`.
- **DD-01 · medio** — la *Consecuencia* de DEC-06 seguía diciendo que algunos módulos podían importar a otros.
  **Curado** en `bbd0be6`.
- **DD-02 · medio** — `docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md:48` (E1) dice «estado de error»;
  el PRD v1.1 (CA-15) y el código muestran «Página no encontrada». **Aceptado**: el responsable técnico decidió no tocar
  UC-17 · E1 al aprobar el PRD v1.1 («estado de error» en sentido amplio).
- **DD-03 · bajo** — matices del ROADMAP ya resueltos en el PRD v1.1. **Curado** (`bbd0be6`).
- **DD-04 · bajo** — los TD citan el fichero de test previsto antes del reparto A-3. **Curado** con una nota en el
  ROADMAP (`bbd0be6`); los TD se aceptan así (§9).
- **DD-05, DD-06 · bajos** — `enroll-fixtures.ts` y el disparador deshabilitado no estaban en TASK-13. **Curados** con una
  nota (`bbd0be6`); el TD-frontend se acepta así.
- **DD-07 · bajo** — JSDoc de `noCandidateProcesses`. **Curado** en `c488585`.
- **DD-08 · bajo** — TD-backend, DD-01 (*Contexto*) cita la redacción de DEC-06 anterior a la aclaración. Aceptado (§9).
- Para `/module-sync`: `candidatos/technical.md`, `ofertas/technical.md`, `inscripciones/{functional,technical}.md`
  (módulo nuevo), `ARCHITECTURE.md`, `MVP-STATUS.md`, `_modules.md` y los estados de UC-14, UC-17 y UC-12.

### Tabla criterio → test y comprobación previa
- La comprobación previa de la sesión (antes de lanzar la review, a petición del responsable técnico) cita en los tests
  de la HU los 72 IDs activos del PRD (CA y EC), con 0 huérfanos.
- La tabla del agente da 23/23 CA, 11/11 flujos y 49/49 EC Must. Etiquetas mal numeradas en dos tests: **curadas** en
  `97ef784` (`seed.test.ts:188` → «EC-54/RF-11») y `689dcbd` (`PipelineScreen.adversarial.test.tsx`, con los IDs de
  HU-04).

## 5. Criterio → test

| Origen | UC | Criterio o edge case | Categoría | Test (`fichero:línea`) | Estado |
|---|---|---|---|---|---|
| CA-01..CA-03 | UC-14 · P | Inscribir: 201 `received`, `StageChange` inicial, retención `null`; buscar e inscribir en la web; un `candidateId` por petición | — | `apps/api/test/applications/enroll.test.ts:58` · `apps/web/test/features/applications/PipelineScreen.enroll.test.tsx:90,114` · `e2e/applications.spec.ts:76` | pasa |
| CA-04, CA-05 | UC-14 · E1 | Oferta `draft` o `closed` → 409 `INVALID_TRANSITION` | — | `apps/api/test/applications/enroll.test.ts:90,109` | pasa |
| CA-06..CA-08 | UC-14 · E2 | Duplicado → 409 con `existingId`; carrera → un 201 y un 409; web sin enlace | 4 concurrencia | `apps/api/test/applications/enroll.test.ts:126` · `apps/api/test/applications/enroll-adversarial.test.ts:220` · `apps/web/test/features/applications/PipelineScreen.enroll.test.tsx:126` | pasa |
| CA-09, CA-10, CA-11 | UC-14 · E3-E5 | 404 sin datos; 400; fallo de escritura → 500 y nada a medias | 1, 3 | `apps/api/test/applications/enroll.test.ts:174` · `apps/api/test/applications/enroll-adversarial.test.ts:90` · `apps/api/test/applications/enroll-failures-adversarial.test.ts:86` | pasa |
| CA-12..CA-16 | UC-17 · P, A2, E1, E2 | Pipeline de 6 columnas; sin email, teléfono ni nota; vacío; 404; API caída | — | `apps/web/test/features/applications/PipelineScreen.test.tsx:40` · `apps/api/test/applications/pipeline.test.ts:112` · `apps/web/test/features/applications/PipelineScreen.states.test.tsx:41,87,105` | pasa |
| CA-19, CA-20 | UC-12 · A1 | «Mientras dure el proceso»; puerto de procesos real | — | `e2e/applications.spec.ts:76` · `apps/api/test/applications/ports.test.ts:92` | pasa |
| CA-21, CA-22, CA-25..CA-27 | — | Fronteras de módulo; SEC-02; seed de 40; pipeline de `draft`/`closed`; trigger con la excepción de la nota | — | `apps/api/test/module-boundaries.test.ts:71` · `apps/api/test/jobs/state-guards.test.ts:168` · `apps/api/test/applications/seed.test.ts:128` · `apps/web/test/features/applications/PipelineScreen.states.test.tsx:62` · `apps/api/test/applications/migration-triggers.test.ts:55` | pasa |
| EC-01..EC-25 (RF-01..RF-04) | — | Entradas hostiles, fronteras, fallos de dependencia, concurrencia, datos corruptos, privacidad, idempotencia | 1-7 | `apps/api/test/applications/{enroll,enroll-adversarial,enroll-failures-adversarial,enroll-retention,privacy-logs,migration,integrity-adversarial,ports}.test.ts` | pasa |
| EC-26..EC-30 (RF-05) | — | `jobId` inválido, 0/1/200 inscripciones, error de BD, minimización | 1-6 | `apps/api/test/applications/pipeline-adversarial.test.ts:58,94,134` · `apps/api/test/applications/pipeline.test.ts:157,181` | pasa |
| EC-35..EC-46 (RF-07, RF-08) | — | ID inválido, fechas, HTML como texto, título y URL, búsqueda, otra pestaña, privacidad del navegador, doble clic | 1-7 | `apps/web/test/features/applications/PipelineScreen.{states,search,enroll,adversarial}.test.tsx` · `apps/web/test/App.test.tsx:146` | pasa |
| EC-51..EC-57 (RF-10, RF-11) | — | Retención con cierre previo, fallo del recálculo, seed determinista e invariantes | 2-7 | `apps/api/test/applications/seed-invariants.test.ts:125,210,238` · `apps/api/test/applications/seed.test.ts:157,221,262` · `apps/api/test/applications/enroll-failures-adversarial.test.ts:86` | pasa |

**Resultado:** 23/23 CA, 11/11 flujos de UC y 49/49 EC de RF Must. La Trazabilidad de UC-14, UC-17 y UC-12 · A1 está
rellena.

**Prueba de mutación** (pedida por el responsable técnico; sobre `333068e`, cada mutación aplicada a mano y revertida con
`git checkout --`, sin commit):

| Mutación | Tests que fallan |
|---|---|
| M1 · quitar el `withTransaction` del `POST` (`apps/api/src/modules/applications/service.ts`) | 7: EC-19 ×2 (estado leído fuera de la transacción), CA-11 ×2 y EC-52 (rollback), EC-22, RNF-03 |
| M2 · quitar la traducción a 409 `DUPLICATE` | 6: CA-07/EC-06 (carrera), CA-06 ×2, EC-11, EC-19, RNF-03 |
| M3 · relajar el trigger a cualquier `UPDATE` de `note` (`apps/api/src/db/migrations/003-create-applications.sql`) | 1: `migration-triggers.test.ts` «note a otro texto → aborta» |

## 6. Gates de QUALITY-GATES

| Umbral | Medido | ¿Cumple? |
|---|---|---|
| Líneas por fichero ≤ 300 | Máx. `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx` 300 (sin cambio de tamaño en esta HU) y `apps/api/test/applications/integrity-adversarial.test.ts` 298; `src` máx. `apps/api/src/db/seed-applications.ts` 244 | Sí |
| Líneas por función ≤ 50 | `max-lines-per-function` sobre `apps/api/src` y `apps/web/src`: solo factorías de objetos de métodos (`createApplicationsService` 54, `createCandidatesRepository` 71, `createCandidatesService` 82, `createJobs*`), excusadas como en HU-02 y HU-03 | Sí |
| Complejidad ≤ 10 ramas | `complexity` 10 sobre `apps/api/src` y `apps/web/src`: ningún aviso | Sí |
| 1 test por RF, flujo y EC Must | 9/9 RF Must, 11/11 flujos, 49/49 EC Must | Sí |
| Anti-patrones de §4 | Sin hallazgos | Sí |
| typecheck, lint, test, e2e, check:harness | En verde (§7) | Sí |

## 7. Integración
Ejecutada por la review sobre el árbol de `bbd0be6` (con el curado), con Node 24.21.0 y sin carga en paralelo:

```
$ npm run typecheck
exit=0
$ npm run lint
exit=0
$ npm test
 Test Files  58 passed (58)
      Tests  715 passed (715)
 Test Files  48 passed (48)
      Tests  628 passed (628)
exit=0
$ npm run e2e
  39 passed (22.0s)
exit=0
$ npm run check:harness
check:harness: todo en verde.
exit=0
```

Con carga: `npm run e2e` con 8 procesos de CPU en paralelo dio 39/39 en 2 de 2 pasadas. Cuando la suite web y los e2e
corrieron a la vez (durante la implementación), 16 tests web agotaron su tiempo de 5 s (tardaban 6-21 s) y 3 e2e
fallaron de forma aislada en 1 de 4 pasadas con la máquina muy saturada; no se repitió sin esa carga. Va al
`/audit-sprint` como deuda de demo (§9).

## 8. Limitaciones
- Sin Safari, Windows ni Linux; rendimiento con `fastify.inject` (200 inscripciones en una oferta, 1 000 candidatos).
- SEC-09 (`INSERT OR REPLACE` con `recursive_triggers` apagado) se basa en la semántica documentada de SQLite; no se ha
  probado en esta base.
- La ventana de INV-05 sigue abierta hasta HU-05 (DT-10): ningún test cierra ofertas con inscripciones.

## 9. Acciones requeridas
Ninguna bloqueante. **Curado antes de cerrar:** `a626063` (caso mixto de retención en el seed, a petición del responsable
técnico), `d0b2060` (DP-01), `c488585` (DD-07), `97ef784` y `689dcbd` (etiquetas de test), `bbd0be6` (DD-01, DD-03,
DD-04 en el ROADMAP, DD-05 y DD-06).

**Observaciones aceptadas** (merge preaprobado con «Aprobado con observaciones»):
1. SEC-08 · bajo — el pipeline no pagina (S-18).
2. SEC-09 · bajo — `recursive_triggers` apagado: documentar o activar con test (para el audit).
3. DP-02 · bajo — `recalculateRetention` lee con `SELECT *`: leer solo las columnas necesarias cuando la feature A lo toque.
4. DP-03, DP-04 · bajos — `skills` en el buscador y `?q=` hacia la API (aceptados en el PRD; el logger quita la query).
5. DD-02 · medio — UC-17 · E1 dice «estado de error» (decisión del responsable técnico de no tocarlo).
6. DD-04, DD-08 · bajos — los TD citan ficheros de test previos al reparto y la redacción de DEC-06 anterior a la
   aclaración (anotado en el ROADMAP).
7. Para la feature A (sin decidir en RGPD.md): inscribir o buscar candidatos con la retención vencida; la marca de
   anonimizado en los puertos; vaciar la nota del rechazo al anonimizar.
8. Deuda de demo para `/audit-sprint` (decisión del responsable técnico): (a) integración con unitarios y e2e en serie y
   e2e con *workers* acotados; (b) *timeout* por test de la web fijado y justificado; (c) medir la pasada completa en una
   máquina modesta.

**Avisos para HU-05:** conectar `JobApplicationsPort` (conteo y rechazo al cerrar) y cerrar la ventana de INV-05; añadir
el detalle `/applications/:id` con los dos enlaces que dejó esta HU (`docs/03_delivery/hu/HU-05-pipeline-etapas/hu.md`,
Notas); `createApplicationsService` está en 54 líneas: sacar helpers antes de añadir avanzar y rechazar;
`JobDetailScreen.actions.test.tsx` está en 300: el siguiente test va a un hermano.

**A `/module-sync`:** ver §4 (doc-code-drift-checker).

---
Ronda: 1 · «Requiere cambios» previos: 0 (máximo 2; al tercero se para y se escala a la persona)

VERDICT: Aprobado con observaciones
