# HU-06 — Cerrar una oferta con inscripciones activas — PRD

## Info
- **HU:** HU-06 · **Feature:** FEAT-03
- **Scope:** fullstack (casi todo backend; en la web, el recuento real del diálogo de cierre y un recorrido e2e)
- **Módulos:** `inscripciones` (código `applications`: implementa `JobApplicationsPort`, el recuento y la operación
  interna de UC-19), `ofertas` (código `jobs`: el cierre de UC-04 la invoca, sin cambios de firma) y `candidatos`
  (código `candidates`: solo se invoca su `recalculateRetention`, sin cambios de código previstos; ver OQ-02)
- **Fecha:** 2026-10-07
- **Estado:** Draft

## Contexto

### Problema
Al cerrar una oferta publicada, sus inscripciones activas tienen que pasar a `rejected` con el motivo «oferta cerrada»
en la misma transacción que el cierre, y el diálogo de confirmación tiene que anunciar cuántas son (RV-05, S-10, RN-09
de FEAT-03). Hoy el cierre deja esas inscripciones abiertas: el candidato se queda en un proceso que ya no existe, su
retención sigue «mientras dure el proceso» para siempre (RGPD §3, S-06) e INV-05 («ninguna oferta `closed` tiene
inscripciones no finales») no se cumple. HU-06 cierra esa ventana.

### Situación actual
HU-06 va en secuencia tras HU-01..HU-05, ya en `main`, en la rama `hu/HU-06-cerrar-oferta-inscripciones-activas`.

- **Puerto ya declarado, sin implementar:** `JobApplicationsPort` (`apps/api/src/modules/jobs/applications-port.ts`)
  tiene `countActiveApplications(jobId): number` y `rejectActiveApplications({ jobId, closedAt }): number`. `buildApp`
  (`apps/api/src/app.ts`, opción `jobApplications?`) inyecta por defecto el stub `noJobApplications`, que cuenta 0 y no
  rechaza nada. Los comentarios de `app.ts` (línea 28) y de `applications-port.ts` (línea 3) aún dicen que el real lo
  aporta HU-05.
- **Cierre de `ofertas`** (`apps/api/src/modules/jobs/service.ts`, `close`, líneas 127-138): dentro de
  `withTransaction` (`BEGIN IMMEDIATE`, `apps/api/src/db/transaction.ts`), comprueba el estado, hace el `UPDATE` con la
  guarda `status = 'published'` y, solo en la transición real, llama a `rejectActiveApplications({ jobId, closedAt })`
  con el instante del reloj; si lanza, `ROLLBACK`. Ya cerrada → 200 sin llamar al puerto (S-01). `closePreview` llama a
  `countActiveApplications` fuera de transacción. `POST /api/jobs/:id/close` devuelve el `Job`; `GET
  /api/jobs/:id/close-preview` devuelve `{ activeApplications }` (`apps/api/src/modules/jobs/routes.ts`).
- **`inscripciones`** (`apps/api/src/modules/applications/`): `repository.ts` (203 líneas) tiene `findById`,
  `updateStage` con la guarda de la etapa en el `WHERE`, `insertStageChange`, `listByJob` y `getProcessFacts`, todo con
  columnas explícitas; no tiene lectura de las inscripciones activas de una oferta ni recuento. `service.ts` (232
  líneas) tiene `applyStageChange` (avance y rechazo manual), que pide el instante a `now()` y llama a
  `recalculateRetention` al pasar a etapa final. **Avanzar y rechazar no comprueban el estado de la oferta** (DT-09 del
  PRD de HU-05; SEC-01 de su review), y lo fijan tres tests con «HU-06 lo revisa» en el nombre:
  `apps/api/test/applications/advance.test.ts:283` (CA-39 de HU-05) y `apps/api/test/applications/reject.test.ts:265`
  y `:287`.
- **Esquema ya listo, sin migración nueva:** `apps/api/src/db/migrations/003-create-applications.sql` admite
  `reason = 'job_closed'`, tiene el índice `applications_job_pipeline_idx (job_id, …)` y el único parcial de un cambio
  final por inscripción.
- **`candidatos`:** `recalculateRetention` (`apps/api/src/modules/candidates/service.ts`, líneas 96-107) se une a la
  transacción en curso y lee la ficha con `SELECT *` (`apps/api/src/modules/candidates/repository.ts:107`; DP-02 de
  HU-04 y DP-01 de HU-05, deuda abierta). La fórmula es `computeRetentionEndsAt`
  (`apps/api/src/modules/candidates/retention.ts`): día natural de Europe/Madrid del último cierre + 6 meses.
- **Tests del cierre:** `apps/api/test/jobs/close.test.ts` usa un espía del puerto (`createApplicationsSpy`,
  `apps/api/test/helpers/test-app.ts`). Su último bloque (líneas 199-216, «EC-14 sin puerto de inscripciones…») fija el
  comportamiento del stub y hay que sustituirlo. `failWrites` (mismo helper) provoca fallos reales de SQLite por tabla y
  operación. `apps/api/test/module-boundaries.test.ts` prohíbe a `jobs` el SQL sobre `applications` y `stage_changes`.
- **Web:** `apps/web/src/features/jobs/CloseJobAction.tsx` ya pide `close-preview` al abrir el diálogo y pinta
  `activeApplicationsText` (`apps/web/src/features/jobs/labels.ts`: «Se rechazará 1 inscripción activa.» / «Se
  rechazarán N inscripciones activas.»); con el stub siempre dice 0. No hace falta código nuevo para el número real. El
  pipeline de una `closed` ya es de solo lectura y la ficha ofrece «Ver pipeline» (HU-05). Ningún e2e cierra todavía una
  oferta con inscripciones (`e2e/pipeline-closed.spec.ts` solo lee el seed).
- **Ficheros al límite:** `apps/api/test/applications/advance.test.ts` y `reject.test.ts` (300 líneas) y
  `apps/web/test/features/jobs/CloseJobAction.test.tsx` (298).

**Procedencia.** El PRD de HU-05 (`docs/03_delivery/hu/HU-05-pipeline-etapas/specs/PRD.md`, v1.2) marca como «movido a
HU-06» su RF-04, RNF-03, EC-07, EC-24 a EC-30 y CA-29 a CA-35 (DT-01 de HU-05), pero **solo conserva los marcadores, sin
su texto**. Aquí se retoman con número nuevo y su contenido se reconstruye desde `hu.md`, UC-19, UC-04 y FEAT-03:

| HU-05 | Este PRD |
|---|---|
| RF-04 | RF-01, RF-02 y RF-03 |
| RNF-03 | RNF-01 |
| EC-24 a EC-30 (7, uno por categoría del antiguo RF-04) | EC-01 a EC-07 |
| EC-07 (concurrencia de un avance con el cierre) | EC-22 |
| CA-29, CA-30, CA-31, CA-32, CA-33, CA-34, CA-35 | CA-01, CA-02, CA-03, CA-04, CA-05, CA-06, CA-07 |

### Resultado esperado
Al abrir el diálogo de cierre de una oferta publicada, el reclutador ve el número real de inscripciones activas. Al
confirmar, en una sola transacción, la oferta pasa a `closed` y cada inscripción en etapa no final pasa a `rejected` con
el motivo «oferta cerrada», sin nota y con su `StageChange` en la fecha del cierre; las de `hired` y `rejected` no
cambian; y cada candidato que se queda sin procesos abiertos tiene su fin de retención desde ese día. El aviso sigue
siendo «Oferta cerrada.» y la respuesta, el `Job` (DT-10 de HU-05). INV-05 se cumple por construcción; tras el merge,
`npm run db:reset`.

**Tamaño estimado** (techo de 15 tareas **con** las `[adversarial]`, QUALITY-GATES §2): unas 5 tareas más 2
`[adversarial]`, 6-7 en total (operación y recuento en `applications`; conexión en `app.ts` y sustitución del test de
EC-14; tras el cierre y DT-09; rendimiento; recorrido e2e; adversariales de API).

## Casos de uso

| UC · flujo | Descripción corta | CA |
|---|---|---|
| UC-19 · P | Rechazo de las activas con `job_closed`, sin nota y en la fecha del cierre; recálculo de la retención | CA-01, CA-02, CA-12 |
| UC-19 · A1 | Sin inscripciones activas → 0, nada se rechaza ni se recalcula | CA-04 |
| UC-19 · A2 | Candidato con otra inscripción abierta → su retención no cambia | CA-05 |
| UC-19 · E1 | Falla una escritura → la oferta sigue `published` y nada cambia | CA-06, CA-11 |
| UC-19 · E2 | Avance o rechazo que llega tras el cierre → 409, o 200 si pedía `rejected` | CA-07 |
| UC-04 · A1 | Cierre con inscripciones activas: las no finales a `rejected`; `hired` y `rejected` intactas; también las creadas con el diálogo abierto | CA-01, CA-03, CA-12 |

Ficheros: `docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md` y
`docs/05_modules/ofertas/casos-de-uso/UC-04-cerrar-oferta.md`. La columna CA de su «Trazabilidad» se rellena con el PRD
aprobado.

Flujos de esos UC que **no** cubre esta HU: UC-04 · P, A2, A3, E1 y E2 (HU-02, en `main`). A3 y E2 se vuelven a probar
aquí con el puerto real (CA-10, CA-06), sin cambiar su comportamiento.

## Requisitos funcionales

| ID | Descripción | Prioridad | Scope | Criterios de aceptación |
|----|-------------|-----------|-------|-------------------------|
| RF-01 | Operación interna de rechazo al cerrar (UC-19 · P, A1, A2, E1; retoma RF-04 de HU-05) | Must | backend | - [ ] `inscripciones` implementa `rejectActiveApplications({ jobId, closedAt })` sin cambiar la firma de `JobApplicationsPort` (DT-02 de HU-02) y sin abrir transacción propia: se une a la del cierre (DEC-06)<br>- [ ] Localiza las inscripciones de la oferta en `received`, `screening`, `interview` u `offer`, con columnas explícitas (sin `SELECT *`)<br>- [ ] Cada una pasa a `rejected` con `last_change_at = closedAt` (guarda de la etapa leída en el `WHERE`, como `updateStage`) y un `StageChange` propio: origen = su etapa, destino `rejected`, `changed_at = closedAt`, motivo `job_closed`, nota `null` (RV-21, S-15, S-16)<br>- [ ] Las inscripciones en `hired` o `rejected` no cambian ni reciben `StageChange`<br>- [ ] Para cada candidato afectado se invoca `recalculateRetention` de `candidatos` en la misma transacción; el resultado es «cierre + 6 meses» (o la fecha más tardía de la fórmula) si no le queda ninguna inscripción no final, y sigue sin fecha si le queda alguna (S-06, RN-10). Invocarla para todos los afectados o solo para los que se quedan sin abiertas es decisión del diseño: el valor guardado es el mismo<br>- [ ] Devuelve el número de inscripciones rechazadas; 0 si no hay activas, sin escribir nada (UC-19 · A1)<br>- [ ] Es el **único** escritor de `job_closed` (INV-07): ninguna ruta lo admite (`POST /api/applications/:id/reject` sigue dando 400 con `job_closed`)<br>- [ ] Cualquier error se propaga y deshace el cierre entero (UC-19 · E1); ni el error ni el log llevan datos del candidato (DP-01 de HU-02; RNF-03) |
| RF-02 | Recuento real de inscripciones activas (UC-04 · P paso 2 con el número real; UC-04 · A1) | Must | backend | - [ ] `inscripciones` implementa `countActiveApplications(jobId)`: número de inscripciones de la oferta en etapa no final, con una sola consulta de agregado sobre `applications` (sin traer filas)<br>- [ ] `GET /api/jobs/:id/close-preview` devuelve ese número, con el mismo contrato `{ activeApplications }` (sin cambios de esquema ni de errores: 400, 404, 500)<br>- [ ] En cualquier estado de la oferta (DD-11 de HU-02): un `draft` y una `closed` dan 0 (INV-02, INV-05)<br>- [ ] El número es el del momento de la lectura; el cierre rechaza las activas en el momento de confirmar, aunque sean más (UC-04 · A1; DT-10 de HU-05) |
| RF-03 | Conexión de `JobApplicationsPort` y cierre de punta a punta (UC-04 · A1; cierra la ventana de INV-05) | Must | backend | - [ ] `buildApp` (`apps/api/src/app.ts`) conecta por defecto la implementación real de `inscripciones`, comprobada por tipado estructural al asignarla a `JobApplicationsPort`; `jobApplications?` sigue existiendo para inyectar dobles en tests (DEC-06, aclarada en HU-04)<br>- [ ] Ningún módulo importa a otro ni ejecuta SQL sobre tablas ajenas (`apps/api/test/module-boundaries.test.ts` en verde)<br>- [ ] `POST /api/jobs/:id/close` sigue devolviendo el `Job` (sin campos nuevos ni el número de rechazadas) y la web sigue mostrando «Oferta cerrada.» (DT-10 de HU-05, OQ-09 de HU-05 respondida por el responsable técnico)<br>- [ ] Ya `closed` → 200 sin invocar el rechazo ni crear `StageChange` (UC-04 · A3, S-01)<br>- [ ] INV-05 se comprueba con un test: tras cerrar, ninguna oferta `closed` de la base tiene inscripciones no finales<br>- [ ] El test de EC-14 de HU-02 (`apps/api/test/jobs/close.test.ts:199-216`) se elimina y lo sustituyen los tests del cierre real (CA-01, CA-04, CA-06, CA-10)<br>- [ ] Los comentarios que dan el puerto por pendiente (`apps/api/src/app.ts:28`, `apps/api/src/modules/jobs/applications-port.ts:3` y `apps/api/test/jobs/close.test.ts:200`) se actualizan<br>- [ ] La nota de cierre de la HU recuerda ejecutar `npm run db:reset` tras el merge: una base creada en la ventana puede tener ofertas `closed` con inscripciones abiertas |
| RF-04 | Cambios de etapa tras el cierre (UC-19 · E2) y revisión a propósito de DT-09 de HU-05 | Must | backend | - [ ] Tras el cierre, un avance con la etapa esperada anterior responde 409 `STAGE_MISMATCH` y no cambia nada (RV-22)<br>- [ ] Tras el cierre, un rechazo manual responde 200 sin `StageChange` y conserva `job_closed` y la nota `null`, con cualquier etapa esperada (RV-23, DT-13 de HU-05)<br>- [ ] La decisión sobre DT-09 (mantener que avanzar y rechazar no miran el estado de la oferta, o añadir la guarda) es **OQ-01**; los tres tests con «HU-06 lo revisa» acaban con un nombre y una aserción coherentes con lo decidido, sin la etiqueta «HU-06 lo revisa»<br>- [ ] Los tests nuevos van a ficheros hermanos de `advance.test.ts` y `reject.test.ts`, que no pasan de 300 líneas |
| RF-05 | Diálogo de cierre con el número real y recorrido e2e (UC-04 · A1, UC-19 · P) | Must | frontend | - [ ] El diálogo de cierre muestra el número real con los textos de DT-08 de HU-02 («Se rechazará 1 inscripción activa.» / «Se rechazarán N inscripciones activas.»); si cambia el texto lo decide **OQ-03**. No se espera código nuevo en `apps/web/src/features/jobs/CloseJobAction.tsx`<br>- [ ] Tras cerrar, el aviso sigue siendo «Oferta cerrada.» (DT-10 de HU-05)<br>- [ ] Recorrido e2e nuevo contra la API y la web reales: una oferta publicada creada en el test con 2 inscripciones activas y 1 `hired` (helpers de `e2e/support/applications.ts`, sin IDs fijos ni tocar el seed) → «Cerrar» → el diálogo anuncia 2 → «Cerrar oferta» → «Oferta cerrada.» → «Ver pipeline» → solo lectura, con las 2 en «Rechazado» y «Motivo: Oferta cerrada», y la de `hired` en «Contratado» |
| RF-06 | Avisos heredados de las reviews de HU-02 y HU-05 | Should | fullstack | - [ ] Test de que los errores del rechazo por cierre no llevan nombre, email ni teléfono del candidato a la respuesta ni al log (HU-02 §9.5; RNF-03)<br>- [ ] El código nuevo no copia `SELECT *` (HU-02 §9.5, DP-02 de HU-04); `recalculateRetention` según **OQ-02**<br>- [ ] Ninguna función nueva o modificada pasa de 50 líneas ni ningún fichero nuevo o modificado de 300 (QUALITY-GATES §2); `advance.test.ts`, `reject.test.ts` y `CloseJobAction.test.tsx` no crecen por encima de 300<br>- [ ] DEC-06 queda al día con el tercer puerto según **OQ-04** |

## Requisitos no funcionales

| ID | Descripción | Categoría | Métrica concreta |
|----|-------------|-----------|------------------|
| RNF-01 | Cierre con inscripciones (retoma RNF-03 de HU-05) | Rendimiento | `POST /api/jobs/:id/close` < 500 ms con una oferta de 200 inscripciones activas, 1 000 candidatos y 2 000 inscripciones en total (`fastify.inject`, local; volúmenes de RNF-01 de HU-04 y RNF-01 de HU-05; umbral «acción» de QUALITY-GATES §2) |
| RNF-02 | Recuento del diálogo | Rendimiento | `GET /api/jobs/:id/close-preview` < 200 ms con los mismos volúmenes (umbral «lectura» de QUALITY-GATES §2) |
| RNF-03 | Datos personales en logs y errores | Privacidad | 0 apariciones de nombre, email o teléfono de un candidato en los logs y en los cuerpos de error del cierre, incluidos los 500 provocados en el `UPDATE` de `applications`, el `INSERT` de `stage_changes` y el `UPDATE` de la retención |
| RNF-04 | Minimización | Privacidad | `close-preview` con exactamente 1 clave (`activeApplications`); la respuesta de `POST /close` con 0 claves nuevas respecto al `Job` de HU-02 y 0 datos de candidatos |
| RNF-05 | SQL del código nuevo | Seguridad | 0 `SELECT *` y 0 SQL concatenado en el diff de la HU (sentencias preparadas); 0 consultas de `jobs` sobre `applications` o `stage_changes` (`module-boundaries`) |

## Modelo de datos
**Sin migración nueva** (DEC-03: no se edita `003`). Dueño de `applications` y `stage_changes`: `inscripciones` (DEC-06).

| Tabla | Operación nueva | Notas |
|---|---|---|
| `applications` | Recuento de no finales por `job_id`; lectura de las activas de una oferta; `UPDATE stage = 'rejected', last_change_at = closedAt` con la guarda de la etapa en el `WHERE` | Usa `applications_job_pipeline_idx`. Columnas explícitas |
| `stage_changes` | `INSERT` de un cambio por inscripción rechazada: origen, `rejected`, `closedAt`, `job_closed`, nota `null` | Nunca `UPDATE` ni `DELETE` (INV-03, *triggers*); el único parcial impide un segundo cambio final |
| `candidates` | `retention_ends_at`, solo a través de `recalculateRetention` | Único escritor: `candidatos` (S-06) |
| `job_openings` | Ninguna nueva | El `UPDATE` del cierre es el de HU-02 |

- **Datos personales:** el historial del proceso de selección (RGPD §1) y la fecha de fin de retención. El rechazo por
  cierre no escribe texto libre.
- **Datos de la ventana:** sin migración de datos; una base creada entre los merges de HU-04 y HU-06 se regenera con
  `npm run db:reset` (EC-18).

## Interfaces / endpoints / pantallas
Errores en el envelope `{ error: { code, message, details? } }`.

| Tipo | Ruta o pantalla | Cambio | Descripción |
|------|-----------------|--------|-------------|
| GET | `/api/jobs/:id/close-preview` | Modificar (comportamiento) | `{ activeApplications }` con el número real. Contrato y errores sin cambios: 200 · 400 · 404 · 500 |
| POST | `/api/jobs/:id/close` | Modificar (comportamiento) | Además rechaza las activas en la misma transacción. 200 `Job` (también al repetir) · 400 · 403 `CROSS_SITE_REQUEST` · 404 · 409 `INVALID_TRANSITION` · 500 `INTERNAL_ERROR`, sin cambios |
| POST | `/api/applications/:id/advance` · `/reject` | Según OQ-01 | Con la recomendación de OQ-01, sin cambios |
| Interno | `JobApplicationsPort` (`countActiveApplications`, `rejectActiveApplications`) | Implementación nueva | Definido en `apps/api/src/modules/jobs/applications-port.ts` (sin cambios de firma); implementado en `apps/api/src/modules/applications/` (fichero en el diseño) |
| Interno | `apps/api/src/app.ts` | Modificar | Conexión por defecto de la implementación real en lugar de `noJobApplications` |
| Pantalla | Diálogo de cierre de la ficha (`/jobs/:id`) | Sin cambios de código previstos | Muestra el número real; texto según OQ-03 |
| Pantalla | Pipeline de una `closed` (`/jobs/:id/pipeline`) | Sin cambios | Ya en solo lectura (HU-05) |
| e2e | Recorrido de cierre con inscripciones | Nuevo | Spec nuevo en `e2e/` (nombre en el diseño) |

## Flujos de usuario
1. **Cerrar con inscripciones:** ficha de una publicada → «Cerrar» → diálogo «¿Cerrar la oferta?» con «Se rechazarán 2
   inscripciones activas.» → «Cerrar oferta» → «Oferta cerrada.» y la ficha en solo lectura con su fecha de cierre.
2. **Ver el resultado:** ficha de la cerrada → «Ver pipeline» → las rechazadas por el cierre en «Rechazado» con «Motivo:
   Oferta cerrada»; las contratadas, en «Contratado»; sin acciones. Desde una tarjeta, el detalle muestra el cambio a
   «Rechazado» con «Oferta cerrada» y sin nota.
3. **Cancelar:** como en HU-02 (UC-04 · A2): no se rechaza nada.

## Datos personales
- **Qué toca:** el historial del proceso de selección (`Application`, `StageChange`) de los candidatos inscritos en la
  oferta que se cierra, y su `candidates.retention_ends_at` a través de `recalculateRetention` (sin duplicar la fórmula).
  No escribe texto libre: el rechazo por cierre va sin nota (S-16).
- **Para qué y base jurídica:** terminar el proceso de selección de una oferta cerrada; medidas precontractuales (art.
  6.1.b) mientras hubo inscripción abierta (RGPD §1-§2).
- **Cuánto tiempo:** al quedarse sin inscripciones no finales, el fin de retención pasa a la más tardía entre el día del
  cierre en Europe/Madrid + 6 meses y el consentimiento vigente + 24 meses (RGPD §3, S-06). Un candidato inscrito con
  la retención ya vencida (DT-06 de HU-04) sale del proceso con «cierre + 6 meses»: es la cuestión 4 de `docs/RGPD.md`
  §7, que **no se resuelve aquí** (EC-05, Fuera de scope).
- **Qué se devuelve:** `close-preview`, solo un número; `POST /close`, el `Job` (sin datos de candidatos) (RNF-04).
- **Qué NO aparece:** nombre, email ni teléfono en logs, mensajes de error ni `details`, también en los 500 del rechazo
  (RNF-03). El diálogo de cierre no nombra a nadie.
- **Datos de ejemplo:** inventados, con `@example.com` y teléfonos de la serie `+34 600 000 0xx` (RGPD §6.3).

## Edge cases
Categorías de `docs/07_architecture_principles/QUALITY-GATES.md` §3: 1 Input inválido · 2 Boundary · 3 Fallo de
dependencia · 4 Concurrencia · 5 Datos corruptos o legacy · 6 Seguridad · 7 Idempotencia. EC-01 a EC-07 retoman EC-24 a
EC-30 de HU-05 y EC-22 retoma EC-07 de HU-05 (ver «Procedencia»).

| ID | RF | Categoría | Situación | Comportamiento esperado |
|----|----|-----------|-----------|-------------------------|
| EC-01 | RF-01 | 1 Input inválido | La operación recibe un `closedAt` que no es ISO UTC con milisegundos, o el `jobId` de una oferta sin inscripciones o inexistente (llamada directa en un test) | El `CHECK` de `stage_changes` aborta: error y `ROLLBACK`, sin nada a medias; con un `jobId` sin inscripciones, devuelve 0 sin escribir |
| EC-02 | RF-01 | 2 Boundary | Oferta con una inscripción en cada una de las 6 etapas; cierre a las 2026-10-06T22:30:00.000Z | Se rechazan 4 (`received`, `screening`, `interview`, `offer`); `hired` y la `rejected` a mano, con su motivo y su nota, no cambian; un candidato sin consentimiento ni otras abiertas queda con fin de retención `2027-04-07` (07/10/2026 en Madrid + 6 meses) |
| EC-03 | RF-01 | 3 Fallo de dependencia | Falla (`failWrites`) el `UPDATE` de `applications`, el `INSERT` de `stage_changes` o el `UPDATE` de `retention_ends_at` mientras se rechaza la segunda de tres inscripciones | 500 `INTERNAL_ERROR` sin *stack*; la oferta sigue `published` con `closedAt` nulo; ninguna de las tres cambia ni gana `StageChange`; ninguna retención cambia (UC-19 · E1) |
| EC-04 | RF-01 | 4 Concurrencia | Con el diálogo abierto se crea otra inscripción en la oferta; y, después del cierre, se intenta inscribir a otro candidato | La primera también se rechaza (se rechazan las activas al confirmar; CA-03); la segunda recibe 409 `INVALID_TRANSITION` (INV-02, EC-19 de HU-04) |
| EC-05 | RF-01 | 5 Datos corruptos o legacy | Candidato que se inscribió con la retención ya vencida y sin anonimizar (DT-06 de HU-04) | Se rechaza y su retención pasa a «cierre + 6 meses», como en un rechazo manual. Es la cuestión 4 de `docs/RGPD.md` §7: se fija con un test y no se resuelve aquí |
| EC-06 | RF-01 | 6 Seguridad | Candidato con nombre, email y teléfono marcados (inventados) y un fallo inyectado en el rechazo; un rechazo manual con `reason: "job_closed"` | Ni la respuesta 500 ni el log contienen los marcadores (RNF-03); el rechazo manual da 400 (S-15, CA-15 de HU-05); SQL preparado, sin `SELECT *` (RNF-05) |
| EC-07 | RF-01 | 7 Idempotencia | La operación se invoca dos veces sobre la misma oferta (llamada directa); el cierre se repite por la API | La segunda invocación devuelve 0, sin `StageChange` ni recálculo; el segundo `POST /close` no la invoca (UC-04 · A3) |
| EC-08 | RF-02 | 1 Input inválido | `close-preview` con `:id` `abc` o `1.5`; con `999999` inexistente | 400 `VALIDATION_ERROR`; 404 `NOT_FOUND` sin datos; no se cuenta nada |
| EC-09 | RF-02 | 2 Boundary | Oferta sin inscripciones; con 1 activa; con las 6 etapas; con 200 activas | 0; 1; 4; 200 en < 200 ms (RNF-02) |
| EC-10 | RF-02 | 3 Fallo de dependencia | El recuento lanza (puerto doble que falla) | 500 `INTERNAL_ERROR` sin datos; en la web, el error dentro del diálogo y «Cerrar oferta» deshabilitado (comportamiento de HU-02) |
| EC-11 | RF-02 | 4 Concurrencia | El recuento queda viejo: se inscribe a alguien entre la previa y la confirmación | El diálogo dijo N y se rechazan N + 1; el aviso sigue «Oferta cerrada.» y el resultado se ve en el pipeline (DT-10 de HU-05) |
| EC-12 | RF-02 | 5 Datos corruptos o legacy | Previa de un `draft` y de una `closed` del seed | 0 en ambas (INV-02, INV-05) |
| EC-13 | RF-02 | 6 Seguridad | Respuesta de la previa y su 404 | Exactamente `{ activeApplications }`, sin nombres ni IDs de candidatos; el 404 sin datos (RNF-04) |
| EC-14 | RF-03 | 1 Input inválido | `POST /api/jobs/1.5/close` o con cuerpo, sobre una oferta con inscripciones activas | 400; la oferta y sus inscripciones no cambian y el rechazo no se invoca |
| EC-15 | RF-03 | 2 Boundary | Oferta publicada sin inscripciones; otra con todas en `hired` o `rejected` | 200 `closed`, 0 `StageChange` nuevos y retenciones intactas (UC-19 · A1, CA-04) |
| EC-16 | RF-03 | 3 Fallo de dependencia | Falla el `UPDATE` de `job_openings` del cierre | 500; el rechazo no llega a invocarse y nada cambia (EC-12 de HU-02, ahora con el puerto real) |
| EC-17 | RF-03 | 4 Concurrencia | Dos pestañas confirman el cierre a la vez | `BEGIN IMMEDIATE` las serializa: la primera cierra y rechaza; la segunda, 200 sin cambios, con el `closedAt` de la primera y sin `StageChange` nuevos |
| EC-18 | RF-03 | 5 Datos corruptos o legacy | Base creada en la ventana de INV-05: una oferta `closed` con inscripciones no finales | `POST /close` sobre ella es un no-op (UC-04 · A3) y no las rechaza: se corrige con `npm run db:reset` tras el merge (DEC-03), sin migración de datos. El seed regenerado cumple INV-05 (`apps/api/test/applications/seed-invariants.test.ts`) |
| EC-19 | RF-03 | 6 Seguridad | `POST /close` con `Sec-Fetch-Site: cross-site`; `module-boundaries` | 403 `CROSS_SITE_REQUEST` y no se rechaza nada (DEC-12); ningún `import` entre módulos ni SQL de `jobs` sobre `applications` o `stage_changes` |
| EC-20 | RF-03 | 7 Idempotencia | Segundo cierre una hora después | 200 con el `closedAt` original, sin `StageChange` nuevos ni recálculo de retención (S-01, CA-10) |
| EC-21 | RF-04 | 2 Boundary | Inscripción en `offer` rechazada por el cierre; llega «Avanzar a Contratado» con la etapa esperada `offer` | 409 `STAGE_MISMATCH`; nunca queda un `hired` en una oferta cerrada |
| EC-22 | RF-04 | 4 Concurrencia | Un avance y el cierre de la oferta llegan casi a la vez (retoma EC-07 de HU-05) | Se serializan: si gana el cierre, el avance da 409 `STAGE_MISMATCH`; si gana el avance, el cierre rechaza la inscripción desde su etapa nueva. En ningún caso queda abierta (INV-05) |
| EC-23 | RF-04 | 5 Datos corruptos o legacy | Inscripción no final en una oferta `closed` (solo posible con datos de la ventana o escritos por SQL en un test, como los de `advance.test.ts:283` y `reject.test.ts:265`) | Según OQ-01: (a) la API la mueve, 200, como hoy; (b) 409 |
| EC-24 | RF-04 | 6 Seguridad | Cuerpo del 409 tras el cierre; rechazo manual con `job_closed` | Sin datos del candidato; 400 (S-15) |
| EC-25 | RF-04 | 7 Idempotencia | Tras el cierre llega un rechazo manual con otro motivo, una nota y la etapa esperada anterior | 200 sin `StageChange`; conserva `job_closed` y la nota `null` (RV-23, DT-13 de HU-05) |
| EC-26 | RF-05 | 2 Boundary | Diálogo con 0, 1 y 2 inscripciones activas | «Se rechazarán 0 inscripciones activas.», «Se rechazará 1 inscripción activa.» y «Se rechazarán 2 inscripciones activas.» (`activeApplicationsText`; el de 2, en el e2e) |
| EC-27 | RF-05 | 3 Fallo de dependencia | La previa no responde | Error con `role="alert"` en el diálogo y «Cerrar oferta» deshabilitado (tests de HU-02 en `apps/web/test/features/jobs/CloseJobAction.test.tsx`, sin cambios) |
| EC-28 | RF-05 | 4 Concurrencia | Otra pestaña inscribe a alguien con el diálogo abierto | Tras cerrar, «Oferta cerrada.» y el pipeline muestra también esa inscripción en «Rechazado» (DT-10 de HU-05) |
| EC-29 | RF-05 | 6 Seguridad | Nombres con `<img src=x onerror=alert(1)>` en el pipeline tras el cierre | El diálogo solo muestra un número; los nombres se pintan como texto (RNF-07 de HU-05) |
| EC-30 | RF-05 | 7 Idempotencia | Doble clic en «Cerrar oferta» | Una sola petición (EC-16 de HU-02); si llegaran dos, la segunda no rechaza nada (EC-20) |

**Evaluación de las 7 categorías por RF Must** (EC o `N/A — motivo`):

| RF | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|----|---|---|---|---|---|---|---|
| RF-01 | EC-01 | EC-02 | EC-03 | EC-04 | EC-05 | EC-06 | EC-07 |
| RF-02 | EC-08 | EC-09 | EC-10 | EC-11 | EC-12 | EC-13 | N/A — `GET` sin efectos: dos lecturas seguidas sin cambios dan el mismo número |
| RF-03 | EC-14 | EC-15 | EC-16 | EC-17 | EC-18 | EC-19 | EC-20 |
| RF-04 | N/A — sin entrada nueva: avanzar y rechazar validan con los esquemas de HU-05 (EC-01 y EC-11 de HU-05) | EC-21 | N/A — sin escritura nueva: los fallos de avanzar y rechazar los cubren EC-05 y EC-14 de HU-05 | EC-22 | EC-23 | EC-24 | EC-25 |
| RF-05 | N/A — el diálogo no tiene campos de entrada: solo confirmar o cancelar | EC-26 | EC-27 | EC-28 | N/A — la web ya valida el contrato del recuento (un número negativo da error: `apps/web/test/features/jobs/CloseJobAction.test.tsx:241`) | EC-29 | EC-30 |

## Decisiones aplicables
- **DEC-01:** envelope de error y TypeScript estricto; Vitest y Playwright (RF-01 a RF-05).
- **DEC-03:** sin migración nueva; la `.db` no se versiona: la ventana se corrige con `npm run db:reset` (RF-03, EC-18).
- **DEC-04:** sin login, rol único «reclutador»; la seguridad se centra en datos personales, inyección y peticiones entre
  sitios (EC-06, EC-19).
- **DEC-06 (aclarada en HU-04):** `inscripciones` es dueño de `applications` y `stage_changes`; `ofertas` invoca la
  operación interna dentro de su transacción sin importar `inscripciones`; la implementación cumple
  `JobApplicationsPort` por tipado estructural y `app.ts` lo comprueba; `candidatos` recalcula la retención en la misma
  transacción. Test de fallo inyectado por cada efecto cruzado (EC-03) y `module-boundaries` (EC-19). El texto de DEC-06
  solo cita dos puertos: OQ-04.
- **DEC-07:** 200 con el `Job` al cerrar y al repetir; 409 `STAGE_MISMATCH` tras el cierre; 400, 404 y 500 sin cambios
  (RF-03, RF-04).
- **DEC-08:** estado comprobado dentro de la transacción, guarda de la etapa en el `WHERE`, repetición idempotente sin
  `StageChange` (EC-07, EC-17, EC-20, EC-25).
- **DEC-09:** `closedAt` del reloj inyectado, en UTC; la retención por día natural de Europe/Madrid (EC-02).
- **DEC-11.7:** `withTransaction` se une a la transacción en curso: la operación interna y el recálculo no abren otra.
- **DEC-12:** `POST /close` sigue con la guarda `CROSS_SITE_REQUEST` (EC-19).
- **Decisiones de PRD anteriores que se respetan:**
  - HU-02: DT-01 (recuento por lectura propia), DT-02 (el rechazo, inyectado, después del `UPDATE` y solo en la
    transición real; «se cambia la implementación, no la firma»), DT-03 (`POST /close` sin cuerpo, 200 con el `Job`) y
    DT-08 (textos del diálogo y aviso «Oferta cerrada.»).
  - HU-04: DT-06 (inscribir con la retención vencida; ver EC-05), DT-08 (guarda de inscribir en el mismo
    `BEGIN IMMEDIATE`) y DT-10 (la ventana de INV-05, que esta HU cierra).
  - HU-05: DT-01 (corte a HU-06), **DT-10** (OQ-09 de HU-05, el responsable técnico: el aviso tras cerrar sigue siendo «Oferta cerrada.» y
    `POST /close` sigue devolviendo el `Job`), DT-13 (orden reintento → `STAGE_MISMATCH` → `INVALID_TRANSITION`) y
    **DT-09**, que esta HU revisa a propósito en OQ-01.
  - S-15 de `docs/02_discovery/reglas-validadas.md`: `job_closed` solo lo pone el sistema.
- **Avisos de review:** SEC-01 y DP-01 de HU-05 (OQ-01, OQ-02); DP-01/DP-02 de HU-02 (RF-06, RNF-03, RNF-05); test de
  EC-14 de HU-02 (RF-03); ficheros de test en 300 líneas (RF-04, RF-06).

## Fuera de scope
- **Cuestiones 1 a 6 de `docs/RGPD.md` §7** (retención vencida al inscribir y al salir del proceso, marca de anonimizado
  en puertos, avanzar, rechazar, recálculo y detalle, vaciado de la nota y texto libre en el historial): son de la
  feature A y **no se resuelven aquí**. El rechazo por cierre de un candidato con la retención vencida toca la
  **cuestión 4** (la salida del proceso reescribe la retención a «cierre + 6 meses»): se deja como hoy y se fija con un
  test (EC-05).
- Leer con columnas explícitas en `recalculateRetention` (DP-01 de HU-05), salvo que OQ-02 decida lo contrario.
- Mostrar en el aviso o en la respuesta del cierre el número de inscripciones rechazadas (DT-10 de HU-05).
- Cambios en la ficha de la oferta, en el pipeline o en el detalle de la inscripción: ya cubren la oferta cerrada
  (HU-05).
- Una migración o un script que repare bases creadas en la ventana de INV-05: se usa `npm run db:reset`.
- Reabrir una oferta `closed` (RV-03) y despublicar.
- Nota en los rechazos por cierre (S-16) y editar el motivo de un rechazo (RV-21).
- UC-04 · P, A2, A3, E1 y E2 como flujos nuevos (HU-02); aquí solo se reprueban A3 y E2 con el puerto real.
- El estado «anonimizado» y el destino de las inscripciones abiertas de un anonimizado (feature A, S-05).
- Las observaciones de la review de HU-05 que van al `/audit-sprint` (accesibilidad, `createJobsRepository` en 72
  líneas, deuda de demo), salvo que esta HU toque esas funciones.

## Open Questions

| ID | Pregunta | Contexto | Recomendación | Decisión | Estado |
|----|----------|----------|---------------|----------|--------|
| OQ-01 | (Ingeniería) ¿Se mantiene DT-09 de HU-05 (avanzar y rechazar no miran el estado de la oferta) o se añade la guarda? | SEC-01 de la review de HU-05. Con HU-06, INV-05 pasa a cumplirse por construcción: el cierre rechaza las activas en su `BEGIN IMMEDIATE` y la inscripción comprueba el estado en el suyo (DT-08 de HU-04). UC-19 · E2 ya se cumple sin guarda: tras el cierre la inscripción está `rejected`, así que un avance da 409 `STAGE_MISMATCH` y un rechazo, 200 sin cambios (RV-22, RV-23). Opciones: **(a) mantener** sin guarda; **(b) guarda después del reintento**: leer `getJobStatus` dentro de la transacción y, si la oferta está `closed`, 409 `INVALID_TRANSITION` («La oferta está cerrada: no admite cambios de etapa.»); E2 no cambia, pero el código solo es alcanzable con datos de la ventana o escritos por SQL; **(c) guarda antes del reintento**: rompe UC-19 · E2 y RV-23 (un rechazo tardío daría 409 en vez de 200), descartada. Efecto en los tres tests: con (a), `advance.test.ts:283` (CA-39 de HU-05) y `reject.test.ts:265` se quedan con un estado imposible tras HU-06: se renombran como «datos legacy (EC-23)», sin «HU-06 lo revisa», citando la decisión, y siguen en verde; `reject.test.ts:287` (espía sin llamadas) se renombra como garantía de la decisión. Con (b), los dos primeros pasan a esperar 409 y el tercero se invierte (el espía ve una lectura dentro de la transacción); es probable que crezcan y haya que moverlos a un fichero hermano | **(a) mantener DT-09.** La guarda solo protegería un estado que ya no puede darse tras HU-06 y `db:reset`, añadiría una lectura y un acoplamiento a `ofertas` en cada transición sin que ningún UC lo pida, y la web ya deja en solo lectura el pipeline de una `closed` (RF-08 de HU-05). INV-05 queda protegida por el cierre (RF-03, con su test) y la guarda de inscribir | PENDIENTE | Abierta |
| OQ-02 | (Ingeniería) ¿Se arregla aquí el `SELECT *` de `recalculateRetention` (DP-01 de HU-05) o sigue para la feature A? | El rechazo por cierre llama a `recalculateRetention` una vez por inscripción rechazada (hasta 200 en RNF-01); cada llamada lee la ficha entera con `SELECT *` (`apps/api/src/modules/candidates/repository.ts:107`). No hay fuga: el retorno se descarta. Opciones: **(a)** sigue en la feature A, como decidieron HU-04 y HU-05; **(b)** arreglarlo aquí con una lectura de solo las columnas de la fórmula (`created_at`, `consent_given_at`, `consent_withdrawn_at`): +1 tarea y toca el módulo `candidatos` y sus tests | **(a) sigue en la feature A**, salvo que RNF-01 no se cumpla, en cuyo caso pasa a (b). No hay fuga, la HU no toca `candidatos` y la feature A tiene que revisar esa operación de todas formas (cuestión 5 de RGPD §7) | PENDIENTE | Abierta |
| OQ-03 | (Producto) ¿Cambia el texto del diálogo de cierre ahora que el número es real? | Hoy: «Se rechazarán N inscripciones activas.» (DT-08 de HU-02). El número es el del momento de abrir el diálogo; si se inscribe a alguien antes de confirmar, se rechazan más (UC-04 · A1, EC-11). Opciones: **(a)** mantener el texto; **(b)** añadir una línea, p. ej. «Si se inscribe a alguien antes de confirmar, también se rechazará.» | **(a) mantener.** Solo difiere con dos pestañas a la vez, el resultado se ve en el pipeline (DT-10 de HU-05) y no toca la web ni sus tests (`CloseJobAction.test.tsx` está en 298 líneas) | PENDIENTE | Abierta |
| OQ-04 | (Ingeniería) ¿Se aclara DEC-06 para recoger `JobApplicationsPort`? | DEC-06 dice «Hoy hay dos» puertos (procesos del candidato y estado de la oferta) y que «los puertos los implementa el módulo de la izquierda». `JobApplicationsPort` es un tercero: lo define `ofertas` (DD-03 de HU-02) y lo implementa `inscripciones`, en la dirección de las llamadas `ofertas → inscripciones`, y mezcla una lectura (el recuento) con la operación interna (el rechazo). No cambia la decisión, pero su texto no lo describe; el TECHNICAL_DOC-backend de HU-02 ya propuso ampliar la lista como «propuesta no bloqueante» y no se aplicó. Opciones: **(a)** aclaración de DEC-06 en el diseño (como en HU-04) y texto al día en `/module-sync`; **(b)** no tocar DEC-06 | **(a) aclarar DEC-06** sin cambiar la decisión: añadir el tercer puerto y precisar que, en la dirección de las llamadas, el puerto lo define quien llama y lo implementa el dueño de los datos | PENDIENTE | Abierta |

> Un PRD con Open Questions abiertas **no pasa** a diseño.

## Decisiones tomadas

| ID | Decisión | Razón | Impacto en el PRD | Fecha |
|----|----------|-------|-------------------|-------|

Ninguna todavía. Las decisiones heredadas de HU-02, HU-04 y HU-05 están en «Decisiones aplicables».

## Criterios de aceptación

| ID | Origen (UC · flujo o RF) | Dado | Cuando | Entonces |
|----|--------------------------|------|--------|----------|
| CA-01 | UC-19 · P; UC-04 · A1 / RF-01, RF-02, RF-03 (retoma CA-29 de HU-05) | Una oferta `published` con tres inscripciones de candidatos distintos, en `received`, `offer` y `hired`, y el reloj en 2026-10-06T22:30:00.000Z | Se pide la previa y después `POST /api/jobs/:id/close` | La previa da `{ activeApplications: 2 }`; el cierre responde 200 con el `Job` en `closed` y `closedAt` igual al reloj; las dos primeras quedan `rejected` con `last_change_at` = `closedAt` y un `StageChange` cada una (origen su etapa, destino `rejected`, `changed_at` = `closedAt`, motivo `job_closed`, nota `null`); la de `hired` no cambia ni gana `StageChange` |
| CA-02 | UC-19 · P / RF-01 (retoma CA-30 de HU-05) | El cierre de CA-01, con los dos candidatos rechazados sin consentimiento y sin otras inscripciones | Termina el cierre | Su `retention_ends_at` es `2027-04-07` (07/10/2026 en Europe/Madrid + 6 meses), escrito en la misma transacción (lo demuestra CA-06); la retención del candidato contratado no cambia |
| CA-03 | UC-04 · A1 / RF-01, RF-02 (retoma CA-31 de HU-05) | Una oferta publicada con una inscripción activa y la previa ya pedida (dice 1) | Se inscribe a otro candidato y después se confirma el cierre | Las dos inscripciones quedan `rejected` con `job_closed`: el cierre rechaza las activas en el momento de cerrar |
| CA-04 | UC-19 · A1 / RF-01, RF-03 (retoma CA-32 de HU-05) | Una oferta publicada sin inscripciones y otra con todas en `hired` o `rejected` | Se cierra cada una | 200 y `closed`; la operación devuelve 0; no hay `StageChange` nuevos y las retenciones de esos candidatos son las de antes |
| CA-05 | UC-19 · A2 / RF-01 (retoma CA-33 de HU-05) | Un candidato con una inscripción en `screening` en la oferta A y otra en `interview` en la oferta B | Se cierra la oferta A | Su inscripción en A pasa a `rejected` con `job_closed`; la de B no cambia; su `retention_ends_at` sigue `null` |
| CA-06 | UC-19 · E1; UC-04 · E2 / RF-01, RF-03 (retoma CA-34 de HU-05) | Una oferta publicada con dos inscripciones activas y un fallo inyectado (`failWrites`), en tres casos: `UPDATE` de `applications`, `INSERT` de `stage_changes` y `UPDATE` de `retention_ends_at` | Se confirma el cierre | 500 `INTERNAL_ERROR` sin *stack*; la oferta sigue `published` con `closedAt` nulo; ninguna inscripción cambia de etapa ni gana `StageChange`; ninguna retención cambia |
| CA-07 | UC-19 · E2 / RF-04 (retoma CA-35 de HU-05) | Una inscripción en `interview` de una oferta que se cierra | Llega después del cierre un avance a `offer` con la etapa esperada `interview`; y, en otro caso, un rechazo con `not_a_fit`, una nota y la etapa esperada `interview` | El avance responde 409 `STAGE_MISMATCH` y no cambia nada; el rechazo responde 200 sin `StageChange` nuevo y conserva `job_closed` y la nota `null` |
| CA-08 | RF-02 | Una oferta publicada con inscripciones en las 6 etapas, un `draft` y una oferta `closed` del seed | Se pide la previa de cada una | 4, 0 y 0, con exactamente la clave `activeApplications` |
| CA-09 | RF-03 / DEC-06 | `buildApp` sin `jobApplications` (la conexión por defecto) | Se cierra una oferta con inscripciones activas y se ejecuta `apps/api/test/module-boundaries.test.ts` | Se rechazan con el puerto real; ninguna oferta `closed` de la base tiene inscripciones no finales (INV-05); no hay `import` entre módulos ni SQL sobre tablas ajenas |
| CA-10 | UC-04 · A3 / RF-03 | Una oferta cerrada con inscripciones rechazadas por el cierre y el reloj una hora después | Llega otro `POST /close` | 200 con el `closedAt` original; ningún `StageChange` nuevo y retenciones sin cambios |
| CA-11 | UC-19 · E1 / RF-01, RF-06, RNF-03 | Un candidato inscrito con nombre, email y teléfono marcados (inventados) y un fallo inyectado en el rechazo por cierre | Se confirma el cierre con el log capturado | Ni el cuerpo del 500 ni ninguna línea del log contienen los marcadores |
| CA-12 | UC-19 · P; UC-04 · A1 / RF-05 | Una oferta publicada creada en el test con 2 inscripciones activas y 1 `hired` | El reclutador pulsa «Cerrar», ve «Se rechazarán 2 inscripciones activas.», confirma con «Cerrar oferta» y abre «Ver pipeline» | Ve «Oferta cerrada.»; el pipeline, sin «Avanzar», «Rechazar» ni «Inscribir candidato», muestra las 2 en «Rechazado» con «Motivo: Oferta cerrada» y la contratada en «Contratado» (e2e) |
| CA-13 | RF-04 / OQ-01 | Los tests `advance.test.ts:283`, `reject.test.ts:265` y `reject.test.ts:287` | Se aplica la decisión de OQ-01 | Ninguno lleva «HU-06 lo revisa»; su nombre y su aserción reflejan la decisión (con la recomendación (a): 200 como datos legacy de EC-23 y el espía sin llamadas); siguen en verde |
| CA-14 | RF-06, RNF-05 | El diff de la HU | Se revisan los umbrales y el SQL | Toda función nueva o modificada ≤ 50 líneas y todo fichero nuevo o modificado ≤ 300 (`advance.test.ts`, `reject.test.ts` y `CloseJobAction.test.tsx` incluidos); 0 `SELECT *` nuevos; los comentarios de `app.ts:28`, `applications-port.ts:3` y `close.test.ts:200` ya no dan el puerto por pendiente; el test de EC-14 de HU-02 ya no existe |

## Checklist de cierre
- [ ] Todos los RF tienen implementación verificable.
- [ ] Cada flujo de UC cubierto tiene al menos un CA, y cada CA su test.
- [ ] Cada edge case Must tiene su test.
- [ ] Review aprobada.
- [ ] 0 Open Questions.
- [ ] `npm run db:reset` tras el merge (RF-03).
