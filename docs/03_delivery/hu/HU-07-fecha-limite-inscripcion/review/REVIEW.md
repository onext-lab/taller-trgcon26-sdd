# Review — HU-07 Fecha límite de inscripción en una oferta

## 1. Resumen ejecutivo
- **Fecha:** 2026-10-13 · **Rama:** `practica/fecha-limite-inscripcion` (hace de `hu/HU-07-fecha-limite-inscripcion` en
  la práctica del taller) · **Commits revisados:** `30e4720..b3f964d` (11: 9 tasks y 2 de progreso del sprint)
- **Ficheros tocados:** 83 de código y tests (`apps/`, `e2e/`) más `docs/_modules.md` y `docs/ARCHITECTURE.md` ·
  **Tasks:** 9/9 completadas, ningún ciclo de arreglo
- **Auditores:** security-auditor ✔ · datos-personales-auditor ✔ · doc-code-drift-checker ✔
- **Hallazgos:** críticos 0 · altos 0 · medios 5 · bajos 6
- La HU entrega la fecha límite de inscripción opcional en la oferta: se fija, cambia o quita en el alta y la edición
  (400 si es pasada y cambia, o no es un día real), publicar con el plazo vencido da 400, duplicar no la copia,
  inscribir fuera de plazo da 409 `ENROLLMENT_DEADLINE_PASSED` con la precedencia de RN-07, y el pipeline deja de
  ofrecer «Inscribir candidato» y explica por qué. Cumple el PRD: los 13 criterios y los 30 casos límite tienen test
  (con una cláusula de CA-12 cubierta solo por los tests previos, O-4), la integración completa está en verde y las
  tres mutaciones de §7 muerden.

## 2. Veredicto
**Aprobado con observaciones**: ningún gate crítico falla; quedan observaciones medias de documentación (anclas de
línea desplazadas y textos obsoletos), una cláusula de CA-12 sin test propio con el plazo vencido y un test de
rendimiento de HU-04 que falló una vez con la máquina cargada.

## 3. Decisiones aplicables

| DEC-NN | Aplica porque | ¿Cumple? |
|---|---|---|
| DEC-01 | Stack sin librerías nuevas | Sí: ningún cambio en `package.json` ni en el lockfile desde `paso-3-punto-de-partida` |
| DEC-03 | La fecha entra con una migración nueva; la base no se versiona | Sí: `apps/api/src/db/migrations/004-add-job-enrollment-deadline.sql`; ningún `.db` en el diff |
| DEC-04 | Sin login | Sí: ninguna ruta pide credenciales ni hay roles nuevos |
| DEC-06 | `inscripciones` lee la fecha de `ofertas` | Sí: `JobStatusPort.getEnrollmentDeadline` (`apps/api/src/modules/applications/ports.ts`), implementado en `apps/api/src/modules/jobs/job-status.ts` y conectado en `apps/api/src/app.ts` sin tocarlo; `madridCalendarDate` sale de `candidates` a `apps/api/src/calendar.ts` (transversal), y `module-boundaries` sigue en verde. La aclaración de DEC-06 que propone el TD-backend no está escrita (O-6) |
| DEC-07 | 400 y 409 con códigos estables | Sí: 409 `ENROLLMENT_DEADLINE_PASSED` sin `details` (`apps/api/src/errors.ts`); 400 `VALIDATION_ERROR` en `enrollmentDeadline` |
| DEC-08 | La fecha se lee dentro de la transacción de la inscripción | Sí: `apps/api/test/applications/enroll-deadline.test.ts:187` y `enroll-deadline-adversarial.test.ts:127` (`deadlineInsideTransaction`); en las ediciones gana la última (`deadline.test.ts:193`) |
| DEC-09 | Día de calendario de Europe/Madrid, reloj inyectado | Sí: `apps/api/src/calendar.ts`; un solo `now()` por petición; frontera y cambios de hora en `enroll-deadline.test.ts:174` y `apps/api/test/calendar.test.ts:66`; la web nunca calcula «hoy» |
| DEC-10 | El pipeline solo lleva lo que la web necesita | Sí: `job` gana `enrollmentDeadline` y `enrollmentDeadlinePassed`; los ítems no cambian |
| DEC-11 | Esquema estricto, recorte y `details` sin el valor | Sí: `maxLength: 32`, `""` → `null`, textos fijos de DT-01 (`deadline-adversarial.test.ts:74`) |
| DEC-12 | Escrituras desde otro sitio | Sí: sin rutas nuevas; el guard sigue registrado en `apps/api/src/app.ts` |

## 4. Hallazgos por auditor

### security-auditor
Sin hallazgos (0 críticos, 0 altos, 0 medios, 0 bajos) en las 10 categorías OWASP: validación del campo (esquema,
`isCalendarDate`, `CHECK` de la `004` como segunda defensa), SQL parametrizado con listas fijas de columnas, XSS (la
fecha y el `message` del 409 se pintan como texto), errores sin traza y DEC-12 intacto. **Limitación del auditor
cerrada por la review:** no podía ver el diff de dependencias; `git diff --stat paso-3-punto-de-partida HEAD --
package.json package-lock.json apps/api/package.json apps/web/package.json` sale vacío.

### datos-personales-auditor
0 críticos, 0 altos, 0 medios, 1 bajo. Ningún dato personal nuevo; el 409 y los 400 no llevan datos del candidato;
mover `madridCalendarDate` no cambia la retención (cuerpo idéntico, tests de retención en verde); el 409 no recalcula
nada.
- **DP-01 (bajo)** `apps/api/test/applications/enroll-deadline.test.ts:106-112`: el test de CA-10 no comprueba
  teléfono ni log; la comprobación completa está en `enroll-deadline-adversarial.test.ts:153-172` (EC-15). Sin acción.

### doc-code-drift-checker
0 críticos, 0 altos, 3 medios, 3 bajos. Ninguna ruta citada falta (~140 verificadas).
- **DD-01 (medio)** `docs/ARCHITECTURE.md:98-136`: anclas `fichero:línea` de «Convenciones del repo» desplazadas por
  HU-07 (`applications/service.ts:232`, `:72-74`, `:234`, `:99-120`, `:124`, `:163`; `jobs/repository.ts:97`, `:183`;
  `jobs/service.ts:67`; `applications/api.ts:48`; `jobs/use-job-actions.ts:77`). Los símbolos existen; la línea no.
- **DD-02 (medio)** `docs/05_modules/candidatos/technical.md:22`, `:153` y `:156`: dicen que `retention.ts` contiene
  `madridCalendarDate` (ahora en `apps/api/src/calendar.ts`) y citan `retention.ts:69-77`, que ya no existe (64
  líneas). `candidatos` no está en `modulos_afectados` de la HU, así que `/module-sync` podría no tocarlo.
- **DD-03 (medio)** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/plans/TECHNICAL_DOC-frontend.md:30-32`,
  `:449` y `:458-459`: sigue diciendo que el TD-backend no existe y que el contrato es una dependencia abierta; el
  `ROADMAP.md` (H-2) ya lo da por resuelto.
- **DD-04 (bajo)** `docs/ARCHITECTURE.md:70` y `:75-76`: no nombra `ENROLLMENT_DEADLINE_PASSED` ni la fecha límite
  como otro día natural. No contradice nada.
- **DD-05 (bajo)** `docs/07_architecture_principles/DECISIONS.md:103-104`: las aclaraciones de DEC-06 y DEC-09 que
  propone `plans/TECHNICAL_DOC-backend.md:406-413` no están escritas («las escribe quien cierre la HU»).
- **DD-06 (bajo)** notación del seed distinta entre `TECHNICAL_DOC-backend.md:179-180` («posición 4 y 5», base 0) y
  `TASK-04.md:40-41` («5.ª y 6.ª»). El código es coherente con las dos.
- **Observaciones de sincronización (no hallazgos):** `docs/05_modules/ofertas/technical.md` e
  `inscripciones/technical.md`, y la fila de `docs/MVP-STATUS.md`, no reflejan HU-07: es trabajo de `/module-sync`.

## 5. Criterio → test
Todos los tests citados salen en verde en la segunda pasada de la integración de §7. «pasa» = el test cubre el
criterio leído contra su texto.

| Origen | UC | Criterio o edge case | Categoría | Test (`fichero:línea`) | Estado |
|---|---|---|---|---|---|
| `hu.md` / CA-01 / RF-01, RF-03 | UC-01 · P | Crear con fecha hoy o futura, o sin fecha | — | `apps/api/test/jobs/deadline.test.ts:62`, `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:72`, `e2e/jobs-deadline.spec.ts:63` | pasa |
| `hu.md` / CA-02 / RF-01 | UC-01 · E7 | Fecha pasada o no válida al crear → 400 junto al campo | — | `apps/api/test/jobs/deadline.test.ts:106`, `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:107`, `e2e/jobs-deadline.spec.ts:87` | pasa |
| `hu.md` / CA-03 / RF-01, RF-03 | UC-02 · P | Poner, ampliar, reducir o quitar sin cambiar estado | — | `apps/api/test/jobs/deadline.test.ts:142`, `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:141` y `:158` | pasa |
| `hu.md` / CA-04 / RF-01 | UC-02 · E5 | Cambiar a pasada o no válida → 400; la oferta igual | — | `apps/api/test/jobs/deadline.test.ts:206`, `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:171` | pasa |
| `hu.md` / CA-05 / RF-01 | UC-02 · A2 | Plazo vencido sin tocar (o reenviado igual) → 200 | — | `apps/api/test/jobs/deadline.test.ts:237`, `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:187` | pasa |
| `hu.md` / CA-06 / RF-01, RF-02, RF-04 | UC-02 · A3 | Ampliar o quitar un vencido reabre inscripciones y el botón | — | `apps/api/test/applications/enroll-deadline.test.ts:139`, `apps/api/test/applications/pipeline-deadline.test.ts:102`, `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx:57` | pasa |
| `hu.md` / CA-07 / RF-01 | UC-03 · E3 | Publicar con plazo vencido → 400 y sigue draft; hoy → publica | — | `apps/api/test/jobs/deadline-publish-duplicate.test.ts:57`, `apps/web/test/features/jobs/JobDetailScreen.deadline.test.tsx:77` | pasa |
| `hu.md` / CA-08 / RF-01 | UC-06 · P | Duplicar no copia la fecha | — | `apps/api/test/jobs/deadline-publish-duplicate.test.ts:104` | pasa |
| `hu.md` / CA-09 / RF-02 | UC-14 · P | 23:59:59 de Madrid se inscribe; sin plazo, como hoy; UTC ≠ Madrid y cambios de hora | — | `apps/api/test/applications/enroll-deadline.test.ts:83` y `:174` | pasa |
| `hu.md` / CA-10 / RF-02, RF-04 | UC-14 · E6 | 00:00 del día siguiente → 409, nada creado, reintento igual; web: alerta y refresco | — | `apps/api/test/applications/enroll-deadline.test.ts:97`, `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx:157` | pasa |
| `hu.md` / CA-11 / RF-02 | UC-14 · E6 | Precedencia: plazo antes que duplicado; cerrada → no publicada | — | `apps/api/test/applications/enroll-deadline.test.ts:119` | pasa |
| `hu.md` / CA-12 / RF-04 | UC-17 · A4 | Pipeline vencido sin botón y con el texto; avanzar, rechazar e historial como antes | — | `apps/api/test/applications/pipeline-deadline.test.ts:61`, `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx:37` y `:48`. **Historial:** sin test con el plazo vencido; el detalle no cambia en la HU y lo cubren los tests de HU-05 (O-4) | pasa (parcial, O-4) |
| `hu.md` / CA-13 / RF-05 (Should) | — | Seed con una publicada con plazo futuro y otra vencida, relativas al reset | — | `apps/api/test/jobs/seed-deadlines.test.ts:55`, `e2e/jobs-deadline.spec.ts:102` | pasa |
| RNF-01 | — | Frontera del día (23:59:59/00:00, UTC ≠ Madrid, 29/03 y 25/10) | — | `apps/api/test/applications/enroll-deadline.test.ts:174`, `apps/api/test/calendar.test.ts:66` | pasa |
| RNF-02 | — | Campo con `<label>`; 409 y texto con `role` | — | `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:72`, `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx:37` y `:157` | pasa |
| EC-01 / RF-01 | — | Formatos no válidos y número | 1 input inválido | `apps/api/test/jobs/deadline-adversarial.test.ts:74`, `:84`, `:106`, `:119`; `apps/api/test/jobs/deadline.test.ts:115` | pasa |
| EC-02 / RF-01 | — | Hoy, ayer, bisiesto, dentro de 10 años | 2 boundary | `apps/api/test/jobs/deadline.test.ts:62`, `:85`, `:106` | pasa |
| EC-03 / RF-01 | — | Vacío o espacios → sin plazo | 2 boundary | `apps/api/test/jobs/deadline.test.ts:174` | pasa |
| EC-04 / RF-01 | — | Falla la escritura al editar → 500 | 3 fallo de dependencia | `apps/api/test/jobs/deadline-adversarial.test.ts:135` | pasa |
| EC-05 / RF-01 | — | Dos ediciones: gana la última | 4 concurrencia | `apps/api/test/jobs/deadline.test.ts:193` | pasa |
| EC-06 / RF-01 | — | Ofertas previas a la migración | 5 datos corruptos | `apps/api/test/jobs/migration-deadline.test.ts:94` | pasa |
| EC-07 / RF-01 | — | `<script>` y SQL en el campo | 6 seguridad | `apps/api/test/jobs/deadline-adversarial.test.ts:74`, `:97` | pasa |
| EC-08 / RF-01 | — | Reenviar la misma fecha vencida | 7 idempotencia | `apps/api/test/jobs/deadline.test.ts:237` | pasa |
| EC-09 / RF-01 | — | Editar una cerrada | 2 boundary | `apps/api/test/jobs/deadline-adversarial.test.ts:152` | pasa |
| EC-10 / RF-02 | — | N/A — inscribir no recibe la fecha | 1 input inválido | — | N/A |
| EC-11 / RF-02 | — | Frontera de medianoche y cambios de hora | 2 boundary | `apps/api/test/applications/enroll-deadline.test.ts:174` | pasa |
| EC-12 / RF-02 | — | Falla la escritura dentro de plazo → 500 sin nada a medias | 3 fallo de dependencia | `apps/api/test/applications/enroll-deadline-adversarial.test.ts:86` | pasa |
| EC-13 / RF-02 | — | Recortar el plazo mientras se inscribe | 4 concurrencia | `apps/api/test/applications/enroll-deadline-adversarial.test.ts:127` | pasa |
| EC-14 / RF-02 | — | Publicada sin plazo se inscribe | 5 datos corruptos | `apps/api/test/applications/enroll-deadline.test.ts:83` | pasa |
| EC-15 / RF-02 | — | El 409 solo lleva la fecha; nada en el log | 6 seguridad | `apps/api/test/applications/enroll-deadline-adversarial.test.ts:153` | pasa |
| EC-16 / RF-02 | — | Reintentar fuera de plazo: el mismo 409 | 7 idempotencia | `apps/api/test/applications/enroll-deadline.test.ts:97` | pasa |
| EC-17 / RF-03 | — | Valor no válido o a medias → error junto al campo | 1 input inválido | `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:171`, `:233`, `:248` | pasa |
| EC-18 / RF-03 | — | Vaciar en la edición → `null` | 2 boundary | `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:158` | pasa |
| EC-19 / RF-03 | — | La API no responde al guardar | 3 fallo de dependencia | `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:264` | pasa |
| EC-20 / RF-03 | — | Doble clic en «Guardar» | 4 concurrencia | `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:281` | pasa |
| EC-21 / RF-03 | — | Oferta sin plazo abre el campo vacío | 5 datos corruptos | `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:201` | pasa |
| EC-22 / RF-03 | — | N/A — sin texto libre | 6 seguridad | — | N/A |
| EC-23 / RF-03 | — | Guardar sin cambios no revalida | 7 idempotencia | `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx:207` | pasa |
| EC-24 / RF-04 | — | N/A — el pipeline no recibe datos | 1 input inválido | — | N/A |
| EC-25 / RF-04 | — | Plazo hoy (botón) y ayer (sin botón), también vacío | 2 boundary | `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx:69`, `apps/api/test/applications/pipeline-deadline.test.ts:122` | pasa |
| EC-26 / RF-04 | — | Falla el refresco tras el 409 | 3 fallo de dependencia | `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx:173` | pasa |
| EC-27 / RF-04 | — | Pipeline cargado antes de medianoche e «Inscribir» después | 4 concurrencia | `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx:157`, `apps/api/test/applications/pipeline-deadline.test.ts:149` | pasa |
| EC-28 / RF-04 | — | Cerrada con plazo vencido | 5 datos corruptos | `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx:91`, `apps/api/test/applications/pipeline-deadline.test.ts:164` | pasa |
| EC-29 / RF-04 | — | N/A — solo se pinta una fecha con formato fijo | 6 seguridad | — | N/A |
| EC-30 / RF-04 | — | Recargar con el plazo vencido | 7 idempotencia | `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx:103`, `apps/api/test/applications/pipeline-deadline.test.ts:186` | pasa |

Los flujos que la HU declara cubrir (UC-01 · P y E7; UC-02 · P, A2, A3 y E5; UC-03 · E3; UC-06 · P; UC-14 · P y E6;
UC-17 · A4) tienen fila y test; su columna «Test» de la Trazabilidad de cada UC se rellena con esta tabla.

## 6. Gates de QUALITY-GATES

| Umbral | Medido | ¿Cumple? |
|---|---|---|
| Líneas por fichero ≤ 300 | Máximo 299: `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx` y `CloseJobAction.test.tsx`; `apps/web/test/features/applications/api.test.ts` 297 | Sí (O-7: al límite) |
| Líneas por función ≤ 50 | `npm run lint` (`max-lines-per-function` sobre `apps/*/src`) en verde | Sí |
| Complejidad ≤ 10 ramas | Estimada: `PipelineContent` ~9 (se sacó `passedDeadline` como función pura); `validateJobForm` sin ramas nuevas salvo `if (deadline)` | Sí |
| 1 test por RF, flujo de UC y edge case Must | §5: todos, con CA-12 parcial en el historial (O-4) | Sí |
| Tasks ≤ 15 y ≤ 4 h | 9 tasks; la mayor L 3,5 h | Sí |
| RF por PRD ≤ 15 | 6 | Sí |
| Latencia | El PRD no define RNF de rendimiento para HU-07; el de HU-04 (acción < 500 ms) falló una vez con carga (O-5) | Ver O-5 |
| Anti-patrones de §4 | Ninguno detectado por los auditores ni en la lectura | Sí |
| Verificaciones de la etiqueta | `test`, `typecheck`, `lint`, `e2e` y `check:harness` en verde (§7, 2.ª pasada) | Sí |

## 7. Integración
Comandos ejecutados **por la review**, con Node 24.21 y en serie (`npm run integrate`, `scripts/integrate.mjs`):

**1.ª pasada (12:58), en rojo:**
```
Paso           Resultado   Segundos
-----------------------------------
typecheck      verde            4,9
lint           verde            4,0
test-api       rojo (1)        17,9
-----------------------------------
Total                          26,9
Sin ejecutar: test-web, e2e, check-harness

 × RNF-02 POST /api/applications < 500 ms 1461ms
 FAIL  test/applications/performance.test.ts > rendimiento de inscripciones con 1 000 candidatos y 2 000 inscripciones > RNF-02 POST /api/applications < 500 ms
AssertionError: expected 581.9161249999997 to be less than 500
```
El mismo test, aislado, tres veces seguidas (`npm test -w apps/api -- applications/performance`): `Tests 4 passed (4)`
las tres. Ver O-5.

**2.ª pasada (12:59), en verde:**
```
Paso           Resultado   Segundos
-----------------------------------
typecheck      verde            4,5
lint           verde            4,2
test-api       verde           10,5
test-web       verde           15,0
e2e            verde           31,9
check-harness  verde            2,9
-----------------------------------
Total                          69,0

test-api:  Test Files  87 passed (87) · Tests  1198 passed (1198)
test-web:  Test Files  64 passed (64) · Tests  835 passed (835)
e2e:       50 passed (31.4s)
check-harness: … ⚠ publicación: quedan 2 marcadores (los revisa check-clean --publish)
```

**Mutaciones (en serie, sin ningún builder trabajando; cada una revertida con `git checkout --` y el árbol limpio
después):**

| # | Mutación | Comando | Resultado |
|---|---|---|---|
| M1 | Quitar la guarda del plazo al inscribir (`apps/api/src/modules/applications/service.ts:147`, `assertDeadlineNotPassed`) | `npm test -w apps/api -- applications/enroll-deadline applications/pipeline-deadline` | **14 tests en rojo** (CA-10, CA-11, CA-06, EC-13, EC-15, EC-27 y las fronteras de RNF-01, entre otros) |
| M2 | Duplicar copia la fecha (`apps/api/src/modules/jobs/service.ts`, `enrollmentDeadline: null` fuera de la copia) | `npm test -w apps/api -- jobs/deadline` | **1 test en rojo**: CA-08 |
| M3 | La web ignora el vencimiento (`apps/web/src/features/applications/labels.ts:6`, `canEnroll` sin `!enrollmentDeadlinePassed`) | `npm test -w apps/web -- features/applications/PipelineScreen.deadline features/applications/labels` | **6 tests en rojo** (CA-12 ×2, CA-10, EC-25, EC-30 y `canEnroll`) |

## 8. Limitaciones
- La 1.ª pasada de la integración salió en rojo por un test de rendimiento de HU-04 con la máquina cargada; la
  review no ha medido la latencia de inscribir antes y después de HU-07 con la máquina en reposo (O-5).
- El e2e E3 (`e2e/jobs-deadline.spec.ts:102`) no ejecuta la rama «Avanzar/Rechazar» porque la oferta vencida del
  seed no tiene inscripciones (INV-01); esa parte la cubren Vitest (CA-12).
- Las comprobaciones de complejidad son estimaciones razonadas: ninguna regla de ESLint mide ramas.

## 9. Acciones requeridas
Ninguna bloquea. **Observaciones** (se curan o se aceptan antes de cerrar):
1. **O-1 (medio, DD-01)** `docs/ARCHITECTURE.md:98-136` — anclas de línea desplazadas — actualizar las once citas a
   las líneas actuales.
2. **O-2 (medio, DD-02)** `docs/05_modules/candidatos/technical.md:22`, `:153`, `:156` — `madridCalendarDate` ya vive
   en `apps/api/src/calendar.ts` y `retention.ts:69-77` no existe — corregirlo a mano (no lo hará `/module-sync`).
3. **O-3 (medio, DD-03)** `plans/TECHNICAL_DOC-frontend.md:30-32`, `:449`, `:458-459` — texto de dependencia
   abierta con el backend — marcarlo como resuelto (los contratos coinciden).
4. **O-4 (medio, review)** CA-12 · «el historial sigue disponible»: sin test con el plazo vencido. El detalle de la
   inscripción (`getApplication`) no está en el diff y lo cubren los tests de HU-05 — aceptar como observación o
   añadir un test con `/implementar-hu`.
5. **O-5 (medio, review)** `apps/api/test/applications/performance.test.ts` (HU-04, RNF-02 «acción < 500 ms») falló
   una vez (582 ms) con la suite tardando 17,9 s; aislado, 3/3 en verde. HU-07 añade un `SELECT` por inscripción —
   vigilarlo en el ensayo del 15/10 en una máquina modesta; si se repite, revisar el umbral o aislar ese test.
6. **O-6 (bajo, DD-04, DD-05, DD-06, DP-01)** completar `docs/ARCHITECTURE.md` (código del 409, fecha límite como día
   natural), escribir las aclaraciones de DEC-06 y DEC-09, y unificar la notación del seed. DP-01 sin acción.
7. **O-7 (bajo, review)** `JobFormScreen.deadline.test.tsx`, `CloseJobAction.test.tsx` (299) y `api.test.ts` (297)
   al límite de 300 líneas: el próximo test que entre en ellos va en un fichero hermano. `hu.md` sigue con
   `sprint: null` (como en sprint-01) y los criterios de done de las tasks sin marcar.

---
Ronda: 1 · «Requiere cambios» previos: 0 (máximo 2; al tercero se para y se escala a la persona)

VERDICT: Aprobado con observaciones
