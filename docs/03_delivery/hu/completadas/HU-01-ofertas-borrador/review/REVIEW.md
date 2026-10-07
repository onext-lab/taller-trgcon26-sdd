# Review — HU-01 Crear, editar y consultar ofertas en borrador (ronda 2)

## 1. Resumen ejecutivo
- **Fecha:** 2026-10-06 · **Rama:** `hu/HU-01-ofertas-borrador` · **Commits revisados en esta ronda:**
  `9123c7c..856dab0` (10: 6 de código, 3 de docs y el de esta review). La ronda 1 está en
  `review/REVIEW-ronda-1.md`.
- **Ficheros tocados en la ronda:** 11 de código y tests, más el PRD (v1.1), DEC-11, los dos TD, el ROADMAP y las
  tareas reabiertas · **Tasks:** 15/15 completadas (TASK-01, 03, 07, 09 y 11 reabiertas por la ronda 1; TASK-07 también
  por la ronda 2)
- **Auditores:** security-auditor ✔ · datos-personales-auditor ✔ · doc-code-drift-checker ✔
- **Hallazgos abiertos:** críticos 0 · altos 0 · medios 0 · bajos 4 (observaciones, §9)
- Las cinco acciones de la ronda 1 están resueltas: EC-32 tiene tests, un carácter de control da 400 (EC-50, DEC-11.8),
  el drift de la HU está corregido y las funciones vuelven a los umbrales. Los hallazgos nuevos de esta ronda (SEC-03 y
  el drift DD-13..DD-18) se curaron antes de cerrarla, con la integración repetida en verde.

## 2. Veredicto
**Aprobado con observaciones.** Sin críticos, altos ni medios abiertos; quedan 4 observaciones bajas aceptadas (§9) y
el drift de documentación general que corrige `/module-sync`.

## 3. Decisiones aplicables
Igual que la ronda 1 (§3 de `review/REVIEW-ronda-1.md`), con un cambio:

| DEC-NN | Aplica porque | ¿Cumple? |
|---|---|---|
| DEC-07 | Códigos HTTP | **Sí** (antes, No) — un carácter de control da 400 `VALIDATION_ERROR` (`apps/api/src/modules/jobs/schemas.ts:62,66,72`; sonda en §7) |
| DEC-11 | Validación y errores (punto 8 nuevo) | Sí — `NO_CONTROL_CHARS` y `NO_CONTROL_CHARS_EXCEPT_WHITESPACE` en `apps/api/src/http/validation.ts:28-30`; `pattern` → «Formato no válido.» (`apps/api/src/http/error-handler.ts:90`) |
| DEC-04 | Solo loopback | Sí — `apps/api/src/listen-options.ts:14` cae a `127.0.0.1` también con `API_HOST=` vacío (SEC-03) |

El resto (DEC-01, 03, 05, 06, 08, 09 y 10) no cambia y sigue cumpliéndose.

## 4. Hallazgos por auditor

### security-auditor
0 críticos, 0 altos, 0 medios, 2 bajos nuevos (VERDICT del auditor: OK).
- **SEC-02 (alto en la ronda 1): resuelto.** Patrones sobre C0 y DEL compilados con el flag `u`, sin huecos por `$` ni
  por terminadores de línea; `trim()` no puede esconder un control; surrogates sueltos sin desajuste de longitud
  (inferido, sin test). Sonda de la review: `"a\u0000bcdef"` → 400 (§7).
- **SEC-03 · bajo: resuelto en esta ronda.** `apps/api/src/listen-options.ts:14`: `API_HOST=` vacío dejaba el host en
  `''`. Ahora `||` y test «EC-32 API_HOST y API_PORT vacíos → 127.0.0.1:3001» (`856dab0`).
- **SEC-04 · bajo: observación.** `apps/api/src/http/error-handler.ts:54-65` con `allErrors: true`: cada clave sobrante
  genera un elemento de `details`; un cuerpo de miles de claves (≤ 1 MiB) da una respuesta mayor. Impacto nulo en
  loopback. Mismo punto que DP-01.
- **SEC-01 · bajo: observación** (sin cambios desde la ronda 1).
- Refactors sin regresiones: las tablas de mensajes usan `Object.hasOwn` (sin *prototype pollution*); `ConfirmDialog` y
  `DeleteJobAction` mantienen su comportamiento y la guarda de doble clic.

### datos-personales-auditor
0 hallazgos nuevos (VERDICT del auditor: OK). **DP-02: resuelto** (`apps/web/test/components/router.test.tsx:108`,
«Nombre Inventado»). DP-01 y DP-03 siguen como observaciones. Los tests nuevos usan solo datos inventados y los
mensajes nuevos no repiten valores. Para HU-03 siguen abiertos los tres puntos de la ronda 1 (título del documento,
duplicado por email, rutas solo con ID).

### doc-code-drift-checker
VERDICT del auditor: OK. **DD-02, DD-05, DD-06 y DD-07: resueltos.** Hallazgos nuevos, todos curados en esta ronda:
- **DD-13 · alto** — las reaperturas citaban `review/REVIEW.md` como origen de la ronda 1; repuntadas a
  `review/REVIEW-ronda-1.md` (10 citas en `tasks/`).
- **DD-14 · medio** — `plans/TECHNICAL_DOC-backend.md` hablaba de «el único `pattern`» y no lo recogía en `JobFields`;
  corregido por el arquitecto.
- **DD-15 · medio** — «EC-32 sin test» en `tasks/ROADMAP.md` y `tasks/TASK-07.md`/`-BRIEF.md`; corregido.
- **DD-16 · bajo** — recuento de ficheros de `tasks/TASK-13.md` y fichero compartido en `tasks/ROADMAP.md`; corregido
  con nota.
- **DD-17 · bajo** — DT-05 del PRD citaba «la OQ-06 de HU-03» sin rama; ahora cita la rama y la fecha.
- **DD-18 · bajo** — exports y filas de «Estrategia de tests» del TD backend; corregido por el arquitecto.

## 5. Criterio → test
Los 20 CA, los 17 flujos de UC y los EC de la ronda 1 siguen con su test (tabla completa en §5 de
`review/REVIEW-ronda-1.md`) y en verde en §7. Cambios de esta ronda:

| Origen | UC | Criterio o edge case | Categoría | Test (`fichero:línea`) | Estado |
|---|---|---|---|---|---|
| EC-32 / RF-04 Must | — | Enumeración de IDs: solo loopback y solo campos de oferta | 6 seguridad | `apps/api/test/jobs/enumeration.test.ts:23,27,34` (host) y `:43 "EC-32 GET /api/jobs/1..N → campos exactos de oferta o 404 en el envelope"`; host vacío en el mismo fichero | pasa (antes falla) |
| EC-50 / RF-02 Must | UC-01 · E1/E2/E4, UC-02 · E2 | Carácter de control C0/DEL → 400 sin guardar (alta y edición) | 1 input inválido | `apps/api/test/jobs/control-chars.test.ts:57-131` (35 tests «EC-50») | pasa (nuevo) |

**Resultado:** 20/20 CA, 17/17 flujos de UC y 40/40 EC aplicables (los 39 de la ronda 1 más EC-50).

## 6. Gates de QUALITY-GATES

| Umbral | Medido | ¿Cumple? |
|---|---|---|
| Líneas por fichero ≤ 300 | Máximo en `src`: `apps/web/src/features/jobs/JobFormScreen.tsx` 194; en tests: `apps/api/test/http/error-handler.test.ts` 299 | Sí |
| Líneas por función ≤ 50 | `ConfirmDialog` 46 y `useModalDialog` 29 (`apps/web/src/components/ConfirmDialog.tsx:18,48`); `DeleteJobAction` 32 y `useDeleteJob` 35 (`apps/web/src/features/jobs/DeleteJobAction.tsx:14`) | Sí |
| Complejidad ≤ 10 ramas | `messageOf` 3 y `typeMessage` 3 (`apps/api/src/http/error-handler.ts:94,109`); máximo `toAppError` ≈ 10 | Sí |
| 1 test por RF, por flujo de UC y por edge case Must | 7/7 RF, 17/17 flujos, 40/40 EC Must | Sí |
| Anti-patrones de §4 | Sin hallazgos; SEC-02 resuelto | Sí |
| typecheck, lint, test, e2e, check:harness | En verde (§7) | Sí |

## 7. Integración
Ejecutada por la review sobre el árbol de `856dab0` más los docs de esta ronda, con Node 24.21.0:

```
$ npm run typecheck
exit=0
$ npm run lint
exit=0
$ npm test
 Test Files  15 passed (15)
      Tests  166 passed (166)
 Test Files  14 passed (14)
      Tests  159 passed (159)
exit=0
$ npm run e2e
  12 passed (6.8s)
exit=0
$ npm run check:harness
  ✔ a) frontmatter: 12 skills y 8 agentes
  ✔ b) enlaces: 104 enlaces relativos en 123 ficheros .md
  ✔ c) rutas citadas: 175 rutas concretas en 24 ficheros
  ✔ d) hooks: 23 fixtures y ningún import de red
  ✔ e) numeración: IDEA-001, sprint-01 y UC-01 en vacío, sin colisión con archivadas, UC global
  ✔ f) contexto de arranque: 8572 caracteres (máximo 15 000)
  ✔ g) límites: 17 ficheros medidos
  ✔ h) caracteres crudos: 226 ficheros de texto
  ✔ i) casos de uso: 19 UC en 3 catálogos; 133 citas a UC concretos
check:harness: todo en verde.
exit=0
$ git ls-files | grep -c '\.db$'
0
$ sonda NUL (buildApp + inject, POST /api/jobs)
"a\u0000bcdef" 400 {"error":{"code":"VALIDATION_ERROR","message":"Hay campos con errores.","details":[{"field":"title","message":"Formato no válido."}]}}
"abcdef\u0000" 400 {"error":{"code":"VALIDATION_ERROR",…,"details":[{"field":"title","message":"Formato no válido."}]}}
"\u0000\u0000\u0000" 400 {"error":{"code":"VALIDATION_ERROR",…}}
"ok título" 201 {"id":1,"title":"ok título",…}
```

## 8. Limitaciones
- Rendimiento solo con `fastify.inject` en local; sin Windows ni Linux.
- Surrogates sueltos: sin test; el auditor infiere que no hay desajuste de longitud.
- Una `data/ats.db` creada antes del arreglo podría tener un título con NUL final; `npm run db:reset` la regenera (la
  base no se versiona).

## 9. Acciones requeridas
Ninguna bloqueante. **Observaciones aceptadas** (merge preaprobado con «Aprobado con observaciones» en el encargo de
paso-2):
1. SEC-01 · bajo — sin cabeceras de endurecimiento (`apps/api/src/app.ts:18`, `apps/web/index.html:3-7`). Para la
   auditoría de sprint.
2. SEC-04 / DP-01 · bajo — `details` sin tope y con el nombre de la clave sobrante (`apps/api/src/http/error-handler.ts:54-65`).
   Limitarlo a una lista blanca o a N elementos antes de candidatos (HU-03).
3. DP-03 · bajo — la descripción es texto libre (`apps/api/src/modules/jobs/schemas.ts:63-67`).
4. Bajo — `apps/api/test/http/error-handler.test.ts` está a 299 líneas: el siguiente test va en un fichero hermano.

**A `/module-sync` (tras el merge):** DD-01 y DD-04 (`docs/ARCHITECTURE.md`: `CONFLICT` → códigos de DEC-07/DEC-11,
`buildApp({ db, logger?, now? })`, `http/`, `errors.ts`, `clock.ts`, `db/transaction.ts`, `listen-options.ts`, puertos
de e2e), DD-03 (`.claude/agents/backend-architect.md:27`), DD-08 (`.claude/reglas/security-auditor/frontend.md:7`),
la sección Transversal de `docs/_modules.md` y DD-12 (`API_HOST` en `docs/SETUP.md`).

**Avisos para las HU siguientes:** HU-02 comprueba el estado en `service.update` y `service.remove`; HU-03 reutiliza
`NO_CONTROL_CHARS*` y decide título del documento, duplicado por email y rutas solo con ID.

---
Ronda: 2 · «Requiere cambios» previos: 1 (máximo 2; al tercero se para y se escala a la persona)

VERDICT: Aprobado con observaciones
