# Review — HU-05 Pipeline con cambio de etapa e historial (ronda 1)

## 1. Resumen ejecutivo
- **Fecha:** 2026-10-07 · **Rama:** `hu/HU-05-pipeline-etapas` · **Commits revisados:** desde la sincronización de HU-04
  (`7cdc1f2`) hasta `454f2a2`: 15 tareas (`89e4364` a `cfc3c9b`), el refuerzo de la prueba de mutación (`a420c0e`), el
  curado de la review (`454f2a2`), las tareas transversales T-03, T-04 y T-05 del sprint y los commits de docs
- **Ficheros tocados:** 70 de código y tests, 5 e2e y los docs de la HU y de los módulos `inscripciones` y `ofertas` ·
  **Tasks:** 15/15 completadas (8 de API, 7 de web y e2e; 4 adversariales)
- **Auditores:** security-auditor ✔ · datos-personales-auditor ✔ · doc-code-drift-checker ✔ · tabla criterio → test ✔ ·
  prueba de mutación ✔
- **Hallazgos:** críticos 0 · altos 0 · medios 1 (curado) · bajos 13 (curados 5, aceptados 8, §9)
- El reclutador mueve las inscripciones por el pipeline: avanza a la etapa siguiente, contrata con confirmación y rechaza
  con motivo y nota, con control optimista por la etapa esperada (`STAGE_MISMATCH`), reintento idempotente (RV-23) y la
  retención del candidato recalculada en la misma transacción. Cada tarjeta enlaza al detalle de la inscripción con su
  historial, y una oferta cerrada ofrece su pipeline en solo lectura. Cumple el PRD v1.2: 32/32 CA con test (CA-38 se
  comprueba con los gates), 24/24 flujos de UC y 42/42 EC activos de RF Must. UC-19 y UC-04 · A1 (CA-29 a CA-35) se
  movieron a HU-06.

## 2. Veredicto
**Aprobado con observaciones.** Sin críticos ni altos. El único medio (DD-01, hito de `JobApplicationsPort` en
`docs/ARCHITECTURE.md`) se curó antes de cerrar, igual que DP-02 (test de la nota vaciada) y las etiquetas de test mal
numeradas. Quedan bajos aceptados: DT-09 (la API avanza y rechaza en una oferta cerrada; HU-06 lo revisa), el pipeline
sin paginar (S-18), deuda para la feature A y la sincronización de la doc del módulo. La integración final está en verde
(§7) y la prueba de mutación muestra que los tests detectan las tres invariantes (§5).

## 3. Decisiones aplicables

| DEC-NN | Aplica porque | ¿Cumple? |
|---|---|---|
| DEC-01 | Stack | Sí — sin dependencias nuevas (`package.json` fuera del diff); envelope de error en las rutas nuevas |
| DEC-03 | Esquema por migraciones | Sí — sin migración nueva (001-003 intactas); el seed no cambia; ningún `.db` en git |
| DEC-04 | Sin login | Sí — un solo rol, sin permisos por rol; enumeración de IDs inherente a DEC-04 (security-auditor) |
| DEC-06 | Módulos y puertos | Sí — el título llega por `getJobSummary` (`apps/api/src/modules/applications/ports.ts`, implementado en `apps/api/src/modules/jobs/job-status.ts`), conectado en `apps/api/src/app.ts`; ningún import entre módulos (`apps/api/test/module-boundaries.test.ts`); `JobApplicationsPort` sigue con el stub hasta HU-06 |
| DEC-07 | Códigos | Sí — 409 `STAGE_MISMATCH` y 409 `INVALID_TRANSITION` con mensajes fijos (`apps/api/src/modules/applications/transitions.ts:7-11`); 200 en el reintento |
| DEC-08 | Control optimista | Sí — orden 404 → reintento → esperada → transición (`apps/api/src/modules/applications/transitions.ts:32-50`); guarda `WHERE id = ? AND stage = ?` con `RETURNING` (`apps/api/src/modules/applications/repository.ts:101-103`); 0 filas → `STAGE_MISMATCH` (`apps/api/src/modules/applications/service.ts:155`) |
| DEC-09 | Reloj | Sí — instantes UTC del reloj inyectado; `dd/mm/aaaa` en Europe/Madrid en el detalle (EC-43) |
| DEC-10 | Listados | Excepción declarada: el historial (≤ 5 cambios) no pagina y el pipeline sigue sin paginar (S-18, SEC-02 §9) |
| DEC-11 | Validación y errores | Sí — `advanceBodySchema` y `rejectBodySchema` estrictos (`apps/api/src/modules/applications/schemas.ts:36-60`); nota recortada, vacía → `null`, ≤ 500 puntos de código, C0 y DEL fuera salvo `\n\r\t`; `details` acotado y sin el valor; `withTransaction` |
| DEC-12 | Escrituras desde otro sitio | Sí — los dos `POST` heredan la guarda global (`apps/api/src/http/cross-site.ts:20-28`); probado en `apps/api/test/applications/stage-change-adversarial.test.ts` (EC-09) |

## 4. Hallazgos por auditor

### security-auditor
0 críticos, 0 altos, 0 medios, 2 bajos (VERDICT del auditor: OK).
- **SEC-01 · bajo** — `apps/api/src/modules/applications/service.ts:169-186`: `advance` y `reject` no comprueban el
  estado de la oferta; con el stub de `JobApplicationsPort`, una inscripción activa de una oferta cerrada se mueve con
  200. Es DT-09, fijado por CA-39 y EC-08 y sin acción en la web (EC-49). Aceptado: **HU-06 lo revisa** (§9).
- **SEC-02 · bajo** — `apps/api/src/modules/applications/repository.ts:89-93`: el pipeline no tiene `LIMIT` (S-18).
  Aceptado como en HU-04.
- Sin inyección SQL (sentencias constantes y parametrizadas), sin XSS (ni `dangerouslySetInnerHTML` ni `href` con texto;
  `document.title` fijo), sin fugas en errores ni logs; la nota no llega a URL, título ni almacenamiento.

### datos-personales-auditor
0 críticos, 0 altos, 0 medios, 2 bajos (VERDICT del auditor: OK).
- **DP-01 · bajo** — `apps/api/src/modules/candidates/repository.ts:107`: `recalculateRetention` lee la ficha con
  `SELECT *`; HU-05 añade dos llamadas (contratar y rechazar). Sin fuga. Deuda ya anotada para la feature A (§9).
- **DP-02 · bajo** — ningún test cruzaba «nota vaciada con `SET note = NULL` → detalle». **Curado** en `454f2a2`
  (`apps/api/test/applications/detail.test.ts`, «DP-02 (review) nota vaciada…»).
- Minimización correcta: avanzar y rechazar devuelven la `Application` de 6 campos; el detalle, `candidate { id,
  fullName }`, `job { id, title, status }` e historial; ni email ni teléfono. La nota solo sale en el detalle. Recálculo
  de la retención atómico, y sin escrituras en el reintento.
- **Para `docs/RGPD.md` §7 (feature A, sin resolver aquí):** (1) contratar o rechazar a alguien con la retención vencida
  la recalcula a cierre + 6 meses (§7.1); (2) avanzar y rechazar no consultan la marca de anonimizado, el recálculo
  reescribiría la retención de un anonimizado y el detalle da 500 si `findNames` omite al candidato (§7.2); (3) si la
  feature A no vacía siempre la nota, el historial conserva texto libre identificativo (§7.3).

### doc-code-drift-checker
0 críticos, 0 altos, 1 medio y 9 bajos (VERDICT del auditor: OK). Todas las rutas citadas existen; sin rutas absolutas
en los docs de HU-05; los símbolos de los dos TD existen y el orden de comprobación coincide con el código; la
Trazabilidad de UC-15 a UC-18 cita HU-05 y los CA correctos.
- **DD-01 · medio** — `docs/ARCHITECTURE.md:24` decía que `jobApplications` sigue con su stub «hasta HU-05». **Curado**
  en `454f2a2` (HU-06).
- **DD-02 a DD-05 · bajos** — `inscripciones/{technical,functional}.md`, `ofertas/technical.md:109` y `MVP-STATUS.md`
  describen `main` (HU-04): pendiente de `/module-sync` (lista del auditor, §9).
- **DD-06 · bajo** — `docs/05_modules/inscripciones/casos-de-uso/UC-18-consultar-historial.md:41` (E1) dice «estado de
  error»; el PRD (DT-08, CA-27) y el código muestran «Página no encontrada». Aceptado por DT-08; `/module-sync` añade la
  fila de deuda, como la de UC-17 · E1.
- **DD-07 · bajo** — `TECHNICAL_DOC-frontend.md` citaba `HistoryList` y ponía el formulario de rechazo en
  `use-stage-actions.ts`. **Curado** en `454f2a2`.
- **DD-08 · bajo** — los dos TD citan «PRD v1.1, DT-01 a DT-11»; el PRD es v1.2 (DT-12, DT-13). Ya anotado en
  `tasks/ROADMAP.md`; aceptado.
- **DD-09 · bajo** — `apps/api/test/jobs/close.test.ts:200` decía «HU-05 sustituirá este test». **Curado** en `454f2a2`
  (HU-06).
- **DD-10 · bajo** — `hu.md` cita `review/REVIEW.md` antes de existir: lo crea esta review.
- Fuera del diff: rutas absolutas en los briefs de HU-01 a HU-04 (ya previsto para el paso 3, con su regla de
  `check-clean`).

### Tabla criterio → test, comprobación previa y prueba de mutación
- **Comprobación previa de la sesión:** 75 IDs activos del PRD citados en los tests de la HU, salvo EC-08 (lo fija el
  test de CA-39, como dice el PRD) y CA-38 (umbrales: gates).
- **Tabla del agente:** 0 huérfanos. Casos dudosos revisados:
  - **Curados en `454f2a2`:** etiquetas con el ID de otro criterio en `PipelineScreen.advance.test.tsx` (EC-32),
    `PipelineScreen.reject.test.tsx` (EC-38) y `PipelineScreen.stage-adversarial.test.tsx` (EC-35, DT-06), y EC-18 citado
    en el test de CA-14.
  - **Aceptados:**
    - `PipelineScreen.stage-adversarial.test.tsx` «EC-01/EC-09» (la web ante un 400 o un 403 de la API) y
      `PipelineScreen.reject.test.tsx` «RNF-08» (foco y descarte) llevan IDs válidos.
    - Los criterios que reparten sus aserciones entre varios tests (CA-12 con EC-13, CA-23, CA-24, CA-28, CA-40) están
      cubiertos entre todos.
    - La «respuesta no JSON» de EC-44 la cubren los tests del cliente HTTP genérico.

## 5. Criterio → test

| Origen | UC | Criterio o edge case | Categoría | Test (`fichero:línea`) | Estado |
|---|---|---|---|---|---|
| CA-01, CA-02 | UC-15 · P | Avanzar a la siguiente con `StageChange`; aviso, foco y tarjeta movida | — | `apps/api/test/applications/advance.test.ts:98` · `apps/web/test/features/applications/PipelineScreen.advance.test.tsx:93` · `e2e/pipeline-stages.spec.ts:58` | pasa |
| CA-03 | UC-15 · A1 | Reintento → 200 sin escrituras | 7 | `apps/api/test/applications/advance.test.ts:118` | pasa |
| CA-04, CA-05, CA-40 | UC-15 · A2 | Contratar: oferta intacta, retención, segundo `hired`; confirmación | — | `apps/api/test/applications/advance-hire.test.ts:67,82` · `apps/web/test/features/applications/PipelineScreen.hire.test.tsx:62` | pasa |
| CA-06..CA-10 | UC-15 · E1-E5 | `STAGE_MISMATCH`; salto, retroceso o `rejected` (y todos los saltos desde etapas no finales); final; 400; 404 | 1, 4 | `apps/api/test/applications/advance.test.ts:173,188,227,250` · `apps/api/test/applications/stage-change-adversarial.test.ts:108` | pasa |
| CA-11 | UC-15 · E6 | Fallo de escritura → nada cambia | 3 | `apps/api/test/applications/stage-change-failures-adversarial.test.ts:111` | pasa |
| CA-12, CA-13, CA-21 | UC-16 · P | Rechazar con motivo y nota; diálogo y aviso; nota fuera de logs, errores y pipeline | 6 | `apps/api/test/applications/reject.test.ts:95` · `apps/web/test/features/applications/PipelineScreen.reject.test.tsx:82` · `apps/api/test/applications/stage-change-privacy.test.ts:83` | pasa |
| CA-14 | UC-16 · A1 | Reintento conserva motivo y nota (EC-18) | 7 | `apps/api/test/applications/reject.test.ts:124` | pasa |
| CA-15..CA-20 | UC-16 · E1-E6 | Motivo inválido; nota de 501; esperada desactualizada; `hired`; 404; fallo de escritura | 1-4 | `apps/api/test/applications/reject.test.ts:191,207,224,239` · `apps/api/test/applications/reject-note.test.ts:57` · `apps/api/test/applications/stage-change-failures-adversarial.test.ts:130` | pasa |
| CA-22, CA-23 | UC-17 · P (paso 5), A1 | Acciones y enlace por tarjeta; cerrada en solo lectura | — | `apps/web/test/features/applications/PipelineScreen.links.test.tsx:60,99` · `e2e/pipeline-closed.spec.ts:31` | pasa |
| CA-24..CA-28 | UC-18 · P, A1, A2, E1, E2 | Detalle con historial; recién creada; rechazos manual y por cierre; 404; API caída | 3, 5 | `apps/api/test/applications/detail.test.ts:67,103,114,192` · `apps/web/test/features/applications/ApplicationDetailScreen.test.tsx` · `e2e/pipeline-stages.spec.ts:114` | pasa |
| CA-29..CA-35 | UC-19, UC-04 · A1 | Rechazo de las activas al cerrar | — | — | movido a HU-06 |
| CA-36, CA-37, CA-39 | — | «Ver la inscripción» en el 409; título por `getJobSummary`; DT-09 (HU-06 lo revisa) | — | `apps/web/test/features/applications/PipelineScreen.links.test.tsx:73` · `apps/api/test/applications/detail.test.ts:207` · `apps/api/test/applications/advance.test.ts:283` | pasa |
| CA-38 | — | Umbrales de tamaño | — | gates (§6) | gate |
| EC-01..EC-10 (RF-01) | UC-15 | Entrada hostil, fronteras, fallos, dos pestañas, oferta cerrada, cross-site, reintento | 1-7 | `apps/api/test/applications/{advance,advance-hire,stage-change-adversarial,stage-change-failures-adversarial,stage-change-privacy}.test.ts` | pasa |
| EC-11..EC-18 (RF-02) | UC-16 | Motivo y nota hostiles, 500 puntos de código, fallos, cruce con avance, seed `job_closed`, HTML y SQL literal, doble envío | 1-7 | `apps/api/test/applications/{reject,reject-note,stage-change-adversarial,stage-change-failures-adversarial}.test.ts` | pasa |
| EC-19..EC-23 (RF-03) | UC-18 | ID inválido, 1 y 5 cambios, puertos que fallan, sin nombre, minimización | 1-6 | `apps/api/test/applications/{detail,detail-adversarial}.test.ts` | pasa |
| EC-31..EC-50 (RF-05..RF-08) | UC-15..UC-18 | Acciones por etapa, API caída, 409/404, HTML, doble clic, formulario de rechazo, privacidad del navegador, fechas, forma inválida, cerrada | 1-7 | `apps/web/test/features/applications/{PipelineScreen.advance,PipelineScreen.reject,PipelineScreen.reject-form,PipelineScreen.links,PipelineScreen.stage-adversarial,ApplicationDetailScreen,ApplicationDetailScreen.adversarial,api.stage}.test.ts(x)` · `e2e/pipeline-stages.spec.ts` · `e2e/pipeline-closed.spec.ts` | pasa |

**Resultado:** 32/32 CA con test más CA-38 por gates, 24/24 flujos de UC y 42/42 EC activos de RF Must (EC-07 y
EC-24..EC-30 se movieron a HU-06). La Trazabilidad de UC-15, UC-16, UC-17 · A1 (y CA-22 en P) y UC-18 está rellena.

**Prueba de mutación** (condición del responsable técnico). Sobre `cfc3c9b` y luego `a420c0e`, con
`npm test -w @ats/api -- applications`, cada mutación se aplica sola y se revierte con `git checkout --`, sin commit
(«restaurado: limpio»):

| Mutación | Tests que fallan |
|---|---|
| M1 · quitar `AND stage = ?` del `WHERE` del `UPDATE` (`apps/api/src/modules/applications/repository.ts`) | 3: DD-02 avance y rechazo con `findById` desfasado (`stage-change-failures-adversarial.test.ts`) y `updateStage` desfasado (`stage-repository.test.ts`) |
| M2 · comprobar esperada ≠ actual **antes** del reintento, al avanzar y al rechazar (`transitions.ts`) | 31: CA-03, EC-10, CA-14, los dos RV-23 (DT-13) de ruta, RV-23 unitario y la tabla de `decideAdvance` |
| M3 · permitir el salto `received → interview` (`transitions.ts`) | Sobre `cfc3c9b`: **1** (la tabla unitaria de `transitions.test.ts`). Reforzado en `a420c0e` (CA-07 con todos los saltos desde etapas no finales). Sobre `a420c0e`: **2**, «CA-07 received → interview…» de `advance.test.ts` y la tabla unitaria |

## 6. Gates de QUALITY-GATES

| Umbral | Medido | ¿Cumple? |
|---|---|---|
| Líneas por fichero ≤ 300 | `src` máx. `apps/api/src/modules/applications/service.ts` 232; tests al límite: `apps/api/test/applications/advance.test.ts` 300 y `apps/api/test/applications/reject.test.ts` 300 | Sí |
| Líneas por función ≤ 50 | `max-lines-per-function` sobre los 31 ficheros `src` del diff: solo `createJobsRepository` 72 (`apps/api/src/modules/jobs/repository.ts:97`), factoría de objeto con métodos, excusada como en HU-02 a HU-04; `createApplicationsService` bajó a 6 líneas (TASK-01) | Sí |
| Complejidad ≤ 10 ramas | `complexity` 10 sobre los mismos ficheros: ningún aviso | Sí |
| 1 test por RF, flujo y EC Must | 8/8 RF Must, 24/24 flujos, 42/42 EC Must | Sí |
| Techo de 15 tasks por HU (con adversariales) | 15 | Sí |
| Anti-patrones de §4 | Sin hallazgos | Sí |
| typecheck, lint, test, e2e, check:harness | En verde (§7) | Sí |

## 7. Integración
Ejecutada por la review sobre el árbol de `454f2a2` (con el curado), con Node 24.21.0 y sin carga en paralelo:

```
$ npm run typecheck
exit=0
$ npm run lint
exit=0
$ npm test
 Test Files  70 passed (70)
      Tests  1059 passed (1059)
 Test Files  59 passed (59)
      Tests  754 passed (754)
exit=0
$ npm run e2e
  45 passed (24.0s)
exit=0
$ npm run check:harness
check:harness: todo en verde.
exit=0
```

Antes del curado, sobre `a420c0e`: API 1 058, web 754, e2e 45 y `check:harness` en verde.

**Intermitencias (T-03, EC-46).** Con `--sequence.shuffle --sequence.seed=42`, `JobDetailScreen.states` EC-46 falló en 1
de 10 semillas (`expected '' to be 'Oferta <b>X</b> · ATS'`): el título lo pone un efecto pasivo. Tras el `waitFor`, el
fichero pasó 50/50 y la suite 16 semillas en verde; el mismo patrón se arregló en las otras 7 aserciones de título. En
HU-05, el `Escape` de CA-40 espera el cierre del diálogo con `waitFor` (20/20 y 5 semillas en verde). Siguen unas 30
aserciones síncronas de `activeElement` tras efectos: van al `/audit-sprint` como regla de test y comprobación de
`check:harness`.

## 8. Limitaciones
- Sin Safari, Windows ni Linux; rendimiento con `fastify.inject`.
- La ventana de INV-05 sigue abierta hasta HU-06 (DT-09): la API mueve inscripciones de ofertas cerradas; ningún dato del
  seed lo provoca.
- El nombre accesible «Rechazar : Nombre» lleva un espacio antes de los dos puntos en Chromium (texto visible más
  `visually-hidden`); los tests buscan por nombre y pasan. Observación de accesibilidad para el audit.
- El `fieldset` de motivos no se deshabilita mientras la petición está en vuelo (para devolver el foco al primer radio
  tras un 400); «Cancelar» y «Rechazar» sí se deshabilitan y el doble envío está cubierto (EC-41).

## 9. Acciones requeridas
Ninguna bloqueante. **Curado antes de cerrar:** `a420c0e` (refuerzo de M3) y `454f2a2` (DP-02, DD-01, DD-07, DD-09 y
etiquetas de test).

**Observaciones aceptadas** (merge preaprobado con «Aprobado con observaciones»):
1. SEC-01 · bajo — DT-09: avanzar y rechazar no miran el estado de la oferta. **HU-06 debe revisarlo a propósito** al
   conectar `JobApplicationsPort` (3 tests con «HU-06 lo revisa» en el nombre).
2. SEC-02 · bajo — el pipeline no pagina (S-18).
3. DP-01 · bajo — `recalculateRetention` con `SELECT *`: leer solo las columnas necesarias cuando la feature A lo toque.
4. Para la feature A (`docs/RGPD.md` §7): retención vencida al contratar o rechazar; marca de anonimizado en avanzar,
   rechazar, recálculo y detalle (hoy 500 si `findNames` omite al candidato); vaciar la nota al anonimizar.
5. DD-06 · bajo — UC-18 · E1 dice «estado de error» (DT-08 decide «Página no encontrada»).
6. DD-08 · bajo — los TD citan el PRD v1.1 (anotado en el ROADMAP).
7. `createJobsRepository` en 72 líneas: partirla con el patrón `createXOperations` (para el audit).
8. Accesibilidad y foco: espacio en «Rechazar : Nombre»; `fieldset` activo en vuelo; ~30 aserciones síncronas de foco
   (para el audit).

**Avisos para HU-06:** conectar `JobApplicationsPort` (conteo y rechazo con `job_closed` al cerrar) y cerrar la ventana
de INV-05; revisar DT-09 (SEC-01); sustituir el test de EC-14 de HU-02 (`apps/api/test/jobs/close.test.ts:200`);
`advance.test.ts` y `reject.test.ts` están en 300 líneas: los tests nuevos van a ficheros hermanos.

**A `/module-sync`:** la lista de DD-02 a DD-06 del doc-code-drift-checker (§4): `inscripciones/{functional,technical}.md`
(rutas, casos de uso, `transitions.ts`, puertos, pantallas, recálculo al pasar a final, deuda), `ofertas/technical.md`
(«Ver pipeline» en `closed`), `MVP-STATUS.md`, `sprint-01.md` y los estados de UC-15 a UC-18.

---
Ronda: 1 · «Requiere cambios» previos: 0 (máximo 2; al tercero se para y se escala a la persona)

VERDICT: Aprobado con observaciones
