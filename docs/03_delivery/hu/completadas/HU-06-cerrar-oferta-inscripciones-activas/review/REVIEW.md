# Review — HU-06 Cerrar una oferta con inscripciones activas (ronda 1)

## 1. Resumen ejecutivo
- **Fecha:** 2026-10-07 · **Rama:** `hu/HU-06-cerrar-oferta-inscripciones-activas` · **Commits revisados:** desde el
  sync de HU-05 (`d6a1084`) hasta `e10ebab`: PRD, diseño y tareas, 8 tareas (`25614d7` a `c733a01`), etiquetas de test
  (`2bb43fe`) y el curado de la review (`e10ebab`)
- **Ficheros tocados:** 5 de producción (API), 12 de tests de API, 4 de e2e y los docs de la HU, DEC-06 y ARCHITECTURE ·
  **Tasks:** 8/8 completadas, 0 ciclos de arreglo (2 `[adversarial]` de API y 1 de e2e)
- **Auditores:** security-auditor ✔ · datos-personales-auditor ✔ · doc-code-drift-checker ✔ · tabla criterio → test ✔ ·
  prueba de mutación ✔
- **Hallazgos:** críticos 1 (de drift, curado y reclasificado como medio, §2) · altos 0 · medios 1 (para `/module-sync`)
  · bajos 10 (curados 4, aceptados o para `/module-sync` 6)
- Al cerrar una oferta, sus inscripciones activas pasan a «Rechazado» con el motivo «oferta cerrada», sin nota y en la
  misma transacción del cierre, y la retención de cada candidato se recalcula. El diálogo de cierre anuncia el número
  real. `JobApplicationsPort` deja de ser un stub: lo implementa `inscripciones` (`job-closing.ts`) y lo conecta
  `apps/api/src/app.ts` (`composeServices`). Con ello **se cierra la ventana de INV-05**: ninguna oferta cerrada tiene
  inscripciones abiertas, y lo fijan dos tests de invariante (CA-15 sobre el seed y CA-16 tras cerrar). DEC-06 queda
  aclarado (tercer puerto) sin cambiar la decisión. Cumple el PRD v1.1: 15/15 CA con test (CA-14 se comprueba con los
  gates), 6/6 flujos de UC y 30/30 EC.

## 2. Veredicto
**Aprobado con observaciones.** Sin altos. El auditor de drift marcó un **crítico** (DD-01): la tabla de puertos de
`docs/ARCHITECTURE.md:57` seguía diciendo «Stub `noJobApplications` hasta HU-06». Se curó en `e10ebab`. La
reclasificación como **medio**, sin ronda 2, la **decidió el responsable técnico** (2026-10-07) a propuesta de la sesión
que implementa: quien implementa no rebaja la severidad de un hallazgo de su revisor, solo la propone. Es la misma clase de fallo que el DD-01 de HU-05: un doc vivo que afirma el estado anterior, se
arregla con una línea y no toca código ni contrato. TASK-03 corrigió la línea 24 del mismo fichero y no vio esta. Queda
un medio para `/module-sync`: DD-02, los docs de `candidatos` que dicen que el recálculo al cerrar inscripciones es
«latente». La integración final está en verde (§7) y la prueba de mutación muestra que los tests detectan las tres
invariantes (§5).

## 3. Decisiones aplicables

| DEC-NN | Aplica porque | ¿Cumple? |
|---|---|---|
| DEC-01 | Stack | Sí — sin dependencias nuevas; envelope sin cambios |
| DEC-03 | Esquema por migraciones | Sí — sin migración; la ventana de INV-05 se corrige con `npm run db:reset` (CA-15) |
| DEC-04 | Sin login | Sí |
| DEC-06 | Módulos y puertos (aclarado en esta HU, DT-04) | Sí — texto nuevo y línea «Aclaración 2026-10-07 (HU-06, DT-04)» en `docs/07_architecture_principles/DECISIONS.md:93-113` y coletilla de «Estado»; `job-closing.ts` solo importa el tipo de su repositorio; el puerto se conecta en `apps/api/src/app.ts:105-108`; ningún import entre módulos (`apps/api/test/module-boundaries.test.ts`) |
| DEC-07 | Códigos | Sí — 409 `STAGE_MISMATCH` tras el cierre (CA-07); el cierre sigue devolviendo el `Job` (DT-03 de HU-05) |
| DEC-08 | Concurrencia | Sí — el rechazo se une a la transacción `BEGIN IMMEDIATE` del cierre; guarda `WHERE id = ? AND stage = ?` en cada fila; 0 filas → 500 + ROLLBACK (DD-05) |
| DEC-09 | Reloj | Sí — un solo `closedAt` del reloj inyectado para el cierre, los `StageChange` y el recálculo |
| DEC-11 | Validación y errores | Sí — sin rutas ni cuerpos nuevos; errores fijos sin datos |
| DEC-12 | Escrituras desde otro sitio | Sí — `POST /close` tras la guarda global (EC-19) |

## 4. Hallazgos por auditor

### security-auditor
0 críticos, 0 altos, 0 medios, 0 bajos (VERDICT del auditor: OK). Comprobó:
- La atomicidad: los anidados se unen a la transacción y un fallo deshace el `markClosed`.
- SQL parametrizado, sin `SELECT *` nuevo.
- DD-05 y la serialización con `BEGIN IMMEDIATE`.
- Que `rejectActiveApplications` no tiene ruta HTTP (el `closedAt` no lo controla el cliente).
- La guarda cross-site.
- El DDL de `failWrites`, que solo vive en `test/`.
- Ningún import entre módulos.
Limitaciones que anota, previas a la HU: `busy_timeout` sin fijar (multiproceso) y DEC-12 sin la cabecera.

### datos-personales-auditor
0 críticos, 0 altos, 0 medios, 3 bajos (VERDICT del auditor: OK).
- **DP-01 · bajo** — `apps/api/src/modules/candidates/repository.ts:107`: `recalculateRetention` lee la ficha con
  `SELECT *`, dos veces por candidato en cada cierre (400 lecturas con 200 activas). Sin fuga. **Aceptado** (DT-02: a
  la feature A; RNF-01 se cumple con 12-24 ms).
- **DP-02 · bajo** — `apps/api/test/applications/close-reject.test.ts:285`: EC-05 fuerza por SQL una retención vencida
  que la aplicación no produce. **Curado** en `e10ebab`: el nombre lo dice («retención vencida simulada por SQL»).
- **DP-03 · bajo (informativo)** — si `recalculateRetention` no encontrara la ficha, el cierre daría 404 en vez de 500.
  Es inalcanzable (FK). Para la feature A.
- **Para `docs/RGPD.md` §7 (sin resolver):**
  - Cuestión 4: el cierre **amplifica en volumen**. Un solo «Cerrar oferta» lleva a «cierre + 6 meses» a N candidatos
    con la retención vencida.
  - Cuestiones 2 y 5: el cierre es un **tercer camino masivo**, además de avanzar y rechazar, que no consulta ninguna
    marca de anonimizado y reescribiría la retención de un anonimizado.
  - Cuestiones 3 y 6: no se agravan (`note: null`).

### doc-code-drift-checker
1 crítico, 0 altos, 1 medio, 7 bajos (VERDICT del auditor: BLOQUEANTE, levantado con el curado). Todas las rutas que
debían existir existen; no hay rutas absolutas en el alcance; los símbolos de los TD existen con el tamaño previsto
(`createApplicationsRepository` 50 líneas, `composeServices` 48, `buildApp` 24); DEC-06 coincide palabra por palabra
con el TD.
- **DD-01 · crítico → medio (decisión del responsable técnico)** — `docs/ARCHITECTURE.md:57`, ver §2. **Curado** en
  `e10ebab`.
- **DD-02 · medio** — `docs/05_modules/candidatos/functional.md:77,94,111` y `technical.md:12,169`: dicen que el recálculo
  al cerrar inscripciones es latente (de HU-05). El código lo hace desde HU-05 y HU-06. Viene del sync de HU-05: **a
  `/module-sync`**.
- **DD-03 · bajo** — `inscripciones`, `ofertas` y `MVP-STATUS.md` describen el puerto como stub y la ventana de INV-05
  como abierta: **a `/module-sync`** (lista del auditor).
- **DD-04 · bajo** — `docs/05_modules/ofertas/functional.md:85` cita el test de EC-14 eliminado: **a `/module-sync`**.
- **DD-05 · bajo** — la columna Test de UC-19 y UC-04 · A1: **rellena** en esta review.
- **DD-06 · bajo** — `UC-04-cerrar-oferta.md:75` cita `CloseJobAction.test.tsx:121`; el `it` está en la 122. Previo a la
  HU: **a `/module-sync`**.
- **DD-07 · bajo** — `hu.md` citaba `plans/TECHNICAL_DOC.md`. **Curado** en `e10ebab`.
- **DD-08 · bajo** — frases en presente («hoy») de `hu.md`, PRD y TD que describen la situación antes de la HU.
  **Aceptado**: son contexto de la especificación.
- **DD-09 · bajo** — `docs/ARCHITECTURE.md:46` no citaba HU-06 en DEC-06. **Curado** en `e10ebab`.

### Tabla criterio → test, comprobación previa y prueba de mutación
- **Comprobación previa:** los 46 IDs activos del PRD tienen test. EC-09 y EC-25 se citaron en los nombres de sus tests
  (`2bb43fe`). EC-27, EC-29 y EC-30 (diálogo web) los cubren los tests de HU-02, sin código web nuevo (DD-01 y DD-02 del
  TD-frontend).
- **Tabla del agente:** 0 huérfanos. Casos dudosos:
  - Curado: EC-15 citado en el test de CA-04 (`e10ebab`).
  - Aceptados:
    - EC-08 solo prueba `1.5` en la previa (`abc`, en HU-02).
    - EC-16 y EC-17 comprueban el resultado, no el orden interno ni la contención real (`node:sqlite` es síncrono).
    - EC-29 en el pipeline lo cubren los tests de HU-05 (EC-34), con el pipeline sin cambios.
    - Colisión de IDs con los tests de HU-02 en `close.test.ts` y `CloseJobAction*.test.tsx`.
- **EC-21, EC-22 y EC-25 viven en TASK-03** (`apps/api/test/applications/stage-change-after-close.test.ts`), no en una
  tarea `[adversarial]`. La adversarial de RF-04 es TASK-05 (EC-24). Lo pidió el responsable técnico al aprobar las
  tareas: cumple el gate 4 y la mutación lo vigila.

## 5. Criterio → test

| Origen | UC | Criterio o edge case | Categoría | Test (`fichero:línea`) | Estado |
|---|---|---|---|---|---|
| CA-01, CA-02, CA-16 | UC-19 · P; UC-04 · A1 | Previa 2; rechazo con `job_closed` en `closedAt`; retención 2027-04-07; INV-05 tras cerrar | — | `apps/api/test/applications/close-reject.test.ts:105,129` · `apps/api/test/applications/close-invariants.test.ts:74` | pasa |
| CA-03 | UC-04 · A1 | Inscrita tras la previa también se rechaza; inscribir tras el cierre → 409 | 4 | `apps/api/test/applications/close-reject.test.ts:143` | pasa |
| CA-04, CA-05 | UC-19 · A1, A2 | Sin activas o todas finales; otra abierta en otra oferta → retención `null` | 2 | `apps/api/test/applications/close-reject.test.ts:162,187` | pasa |
| CA-06, CA-11 | UC-19 · E1 | Fallo en la 2.ª de 3 en los tres puntos → 500 y nada cambia; ni el 500 ni el log llevan datos | 3, 6 | `apps/api/test/applications/close-reject-adversarial.test.ts:143` · `apps/api/test/applications/close-reject-privacy.test.ts:91` | pasa |
| CA-07, CA-13 | UC-19 · E2 | Tras el cierre: avance 409, rechazo 200 sin cambios; DT-01 (defensa en profundidad) | 5, 7 | `apps/api/test/applications/stage-change-after-close.test.ts:74` · `apps/api/test/applications/advance.test.ts:283` · `apps/api/test/applications/reject.test.ts:265,287` | pasa |
| CA-08, CA-09, CA-10 | UC-04 · A1, A3 | Recuento real; `buildApp` con el puerto real; segundo cierre sin cambios | 2, 7 | `apps/api/test/applications/close-preview-count.test.ts:50` · `apps/api/test/applications/close-reject.test.ts:204,235` | pasa |
| CA-12 | UC-19 · P; UC-04 · A1 | e2e: diálogo con 2, «Oferta cerrada.», pipeline en solo lectura y detalle | — | `e2e/jobs-close-applications.spec.ts:43` | pasa |
| CA-14 | — | Umbrales, 0 `SELECT *` nuevo, comentarios al día, test de EC-14 de HU-02 retirado | — | gates (§6) | gate |
| CA-15 | UC-19 · P | INV-05 sobre la base regenerada | 5 | `apps/api/test/applications/close-invariants.test.ts:55` | pasa |
| EC-01..EC-07 (RF-01) | UC-19 | `closedAt` inválido, 6 etapas, fallo en mitad, carrera con la inscripción, retención vencida, privacidad, idempotencia | 1-7 | `apps/api/test/applications/{close-operation,close-reject,close-reject-adversarial,close-reject-privacy}.test.ts` | pasa |
| EC-08..EC-13 (RF-02) | UC-04 · A1 | Previa con ID inválido, 0/1/4/200, recuento que lanza, recuento viejo, legacy, minimización | 1-6 | `apps/api/test/applications/{close-reject-adversarial,close-preview-count,close-reject-privacy,close-performance}.test.ts` · `e2e/jobs-close-applications.spec.ts:82` | pasa |
| EC-14..EC-20 (RF-03) | UC-04 | Cuerpo o ID inválido, todas finales, fallo del `UPDATE` de la oferta, dos cierres, legacy, cross-site, segundo cierre | 1-7 | `apps/api/test/applications/{close-reject,close-reject-adversarial,close-invariants}.test.ts` | pasa |
| EC-21..EC-25 (RF-04) | UC-19 · E2 | `offer` cerrada, avance y cierre en los dos órdenes, legacy, privacidad, idempotencia | 2, 4-7 | `apps/api/test/applications/{stage-change-after-close,close-reject-privacy,advance,reject}.test.ts` | pasa |
| EC-26..EC-30 (RF-05) | UC-04 · A1 | Diálogo con 0/1/2, previa que falla, otra pestaña, HTML, doble clic | 2-7 | `e2e/jobs-close-applications.spec.ts:43,82` · `apps/web/test/features/jobs/CloseJobAction.test.tsx:83,106,224` · `apps/web/test/features/jobs/CloseJobAction.adversarial.test.tsx:75,87` | pasa |

**Resultado:** 15/15 CA con test más CA-14 por gates, 6/6 flujos de UC y 30/30 EC. La Trazabilidad de UC-19 y UC-04 · A1
está rellena.

**Prueba de mutación** (condición del responsable técnico al aprobar el diseño). Se hizo **en serie**, sin ningún builder
en marcha (regla del responsable técnico tras la ola 1). Primero sobre `7758f6c`, al acabar la ola, y luego sobre
`c733a01` (HEAD de la implementación). Se ejecutaron los tests de cierre de la API (`applications/close`, `jobs/close` y
`applications/stage-change-after-close`): cada mutación se aplica sola y se revierte con `git checkout --`, sin commit
(«restaurado: limpio»):

| Mutación | Tests que fallan (sobre `c733a01`) |
|---|---|
| M1 · quitar `applications.rejectActiveApplications(...)` del cierre (`apps/api/src/modules/jobs/service.ts`) | 24: CA-16 (INV-05), CA-01, CA-02, CA-03/EC-04, CA-05, CA-09, EC-02, EC-05, los 3 de CA-06/EC-03, EC-17, CA-07 y EC-21/EC-22 tras el cierre, y los de `jobs/close.test.ts` que esperan el rechazo |
| M2 · `countActiveApplications` cuenta también las finales (`COUNT_ACTIVE_BY_JOB_SQL` sin el filtro de etapas) | 3: EC-07, CA-08/EC-09 y CA-01 |
| M3 · rechazo fuera de la transacción del cierre: el puerto se llama tras el `COMMIT` | 4: los 3 de «CA-06/EC-03 falla … en la 2.ª de 3» (el rechazo se deshace solo, pero la oferta ya quedó `closed` con sus inscripciones abiertas) y CA-09/EC-12 de `jobs/close.test.ts` |

## 6. Gates de QUALITY-GATES

| Umbral | Medido | ¿Cumple? |
|---|---|---|
| Líneas por fichero ≤ 300 | `src`: `apps/api/src/modules/applications/service.ts` 243, `apps/api/src/modules/applications/repository.ts` 237; tests al límite: `apps/api/test/applications/advance.test.ts` y `reject.test.ts` 300 (solo renombres), `close-reject.test.ts` 299 | Sí |
| Líneas por función ≤ 50 | `max-lines-per-function` sobre los 5 ficheros `src` del diff: sin avisos; `createApplicationsRepository` en 50 exactas, `composeServices` 48, `buildApp` 24 (antes, 61) | Sí |
| Complejidad ≤ 10 ramas | sin avisos | Sí |
| 1 test por RF, flujo y EC Must | 5/5 RF Must, 6/6 flujos, 30/30 EC | Sí |
| Techo de 15 tasks por HU | 8 | Sí |
| `SELECT *` nuevo | 0 (el de `candidates/repository.ts:107` es previo, DT-02) | Sí |
| typecheck, lint, test, e2e, check:harness | En verde (§7) | Sí |

## 7. Integración
Ejecutada por la review sobre el árbol de `e10ebab` (con el curado), con Node 24.21.0 y sin carga en paralelo:

```
$ npm run typecheck
exit=0
$ npm run lint
exit=0
$ npm test
 Test Files  78 passed (78)
      Tests  1097 passed (1097)
 Test Files  59 passed (59)
      Tests  754 passed (754)
exit=0
$ npm run e2e
  47 passed (25.7s)
exit=0
$ npm run check:harness
check:harness: todo en verde.
exit=0
```

Rendimiento (TASK-06, ejecutada sola): cerrar con 200 activas tarda 12-24 ms en 3 tandas (RNF-01 < 500 ms) y la previa
0,2-0,3 ms (RNF-02 < 200 ms). No aplica la parada de DT-02.

## 8. Limitaciones
- Sin Safari, Windows ni Linux; rendimiento con `fastify.inject` sobre `:memory:`.
- La contención real entre dos cierres o entre cierre e inscripción no se puede ejercitar con `node:sqlite` síncrono en
  un proceso. Los tests comprueban el resultado (EC-17, EC-04).
- `busy_timeout` sin fijar: con dos procesos sobre la misma base, un `BEGIN IMMEDIATE` daría 500. Es previo a la HU y
  queda fuera del uso previsto.

## 9. Acciones requeridas
Ninguna bloqueante. **Curado antes de cerrar:** `2bb43fe` (EC-09 y EC-25 en los nombres) y `e10ebab` (DD-01, DD-07,
DD-09, DP-02 y EC-15 en el nombre del test de CA-04).

**Observaciones aceptadas** (merge preaprobado con «Aprobado con observaciones»):
1. DD-01 · crítico del auditor, reclasificado como medio por decisión del responsable técnico (§2) — curado.
2. DP-01 · bajo — `SELECT *` de `recalculateRetention`, ahora con dos lecturas por candidato en cada cierre (DT-02, a la
   feature A).
3. DP-03 · bajo — 404 en vez de 500 si faltara la ficha al recalcular (inalcanzable; feature A).
4. Para `docs/RGPD.md` §7 (feature A): el cierre como tercer camino masivo (cuestiones 2, 4 y 5); RGPD §7 se amplía en
   `/module-sync`.
5. DD-08 · bajo — frases en presente de la especificación.
6. EC-08 y EC-16/EC-17 con cobertura parcial aceptada (§4).

**A `/module-sync`:**
- DD-02, el medio de `candidatos`: cerrar el «latente» del recálculo.
- DD-03:
  - `inscripciones/{functional,technical}.md`: UC-19 pasa a ✅, RN-09, el puerto real, `job-closing.ts` y DT-01, y se
    cierra la ventana de INV-05.
  - `ofertas/{functional,technical}.md`: UC-04 pasa a ✅ y los avisos para HU-06 quedan cumplidos.
  - `MVP-STATUS.md`.
  - Los `README.md` de los catálogos y el estado de UC-19 y UC-04.
- DD-04 y DD-06.
- `sprint-01.md`.

**Tras el merge:** `npm run db:reset` en cada portátil o base creada durante la ventana de INV-05.

---
Ronda: 1 · «Requiere cambios» previos: 0 (máximo 2; al tercero se para y se escala a la persona)

VERDICT: Aprobado con observaciones
