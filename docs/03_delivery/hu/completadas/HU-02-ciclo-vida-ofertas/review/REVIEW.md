# Review — HU-02 Publicar, cerrar, duplicar y listar ofertas con filtros (ronda 2)

## 1. Resumen ejecutivo
- **Fecha:** 2026-10-06 · **Rama:** `hu/HU-02-ciclo-vida-ofertas` · **Commits revisados en esta ronda:**
  `f82ae93..HEAD` (6 de código, 2 de docs y el de esta review). La ronda 1 está en `review/REVIEW-ronda-1.md`.
- **Tasks:** 14/14 completadas (TASK-01, 04, 05, 07, 08 y 11 reabiertas por la ronda 1)
- **Auditores:** security-auditor ✔ · datos-personales-auditor ✔ · doc-code-drift-checker ✔
- **Hallazgos abiertos:** críticos 0 · altos 0 · medios 0 · bajos 5 (observaciones, §9)
- Las siete acciones de la ronda 1 están resueltas: EC-14 tiene test, DEC-12 está enmendado (lista de métodos seguros,
  `same-site` rechazado, texto corregido y código nombrado) con su guard y sus tests, `splitServerError` e `isJob`
  vuelven a ≤ 10 ramas, CA-18 se alinea con el PRD, el drift de los TD, las tareas y el PRD está corregido y el test
  duplicado se ha quitado. Los hallazgos nuevos de la ronda (NEW-01..05, documentales) se curaron antes de cerrarla.

## 2. Veredicto
**Aprobado con observaciones.** Sin críticos, altos ni medios abiertos; quedan 5 bajos aceptados (§9) y el drift de
documentación general que corrige `/module-sync`.

## 3. Decisiones aplicables
Igual que la ronda 1 (§3 de `review/REVIEW-ronda-1.md`), con un cambio:

| DEC-NN | Aplica porque | ¿Cumple? |
|---|---|---|
| DEC-12 | Escrituras desde otro sitio (enmendada) | Sí — `apps/api/src/http/cross-site.ts:4,9-10,22`: solo `GET`, `HEAD` y `OPTIONS` pasan sin comprobar; `Sec-Fetch-Site` normalizado debe ser `same-origin` o `none`; sin cabecera pasa. Tests en `apps/api/test/http/cross-site.test.ts` (`same-site` → 403, `PUT` → 403 antes del 404, normalización) |

## 4. Hallazgos por auditor

### security-auditor
0 críticos, 0 altos, 0 medios, 1 bajo nuevo (VERDICT del auditor: OK).
- **SEC-01 (medio en la ronda 1): resuelto.** Falla cerrado ante cabeceras repetidas o vacías; el 403 llega antes del
  parseo del cuerpo y del 404; la web, por el proxy de Vite, sigue llegando como `same-origin`.
- **SEC-05 · bajo** — `apps/api/src/http/cross-site.ts:22`: sin validación de `Host`, un DNS rebinding llegaría como
  `same-origin`. Es la SEC-04 de la ronda 1 (anterior a HU-02 y teórica).
- Los refactors de `isJob`, `list-query.ts`, `job-form-errors.ts` y `JobListScreen.tsx` no abren nada.

### datos-personales-auditor
0 hallazgos (VERDICT del auditor: OK). DP-01 y DP-02 de la ronda 1 siguen como avisos para HU-05.

### doc-code-drift-checker
VERDICT del auditor: OK. **DD-01, DD-02, DD-06, DD-07 y DD-09: resueltos; DD-03, resuelto tras esta ronda.** Hallazgos
nuevos, todos curados antes de cerrar:
- **NEW-01 · alto** — las reaperturas citaban `review/REVIEW.md` como origen de la ronda 1; repuntadas a
  `review/REVIEW-ronda-1.md` (12 ficheros de `tasks/`). Es la misma lección que DD-13 de HU-01: el script de la sesión
  ya escribe la ronda desde el principio.
- **NEW-02 · medio** — `specs/PRD.md` DT-07 decía que los tamaños 1-100 se usan «por la API o la URL»; ahora, «solo por
  la API» (la web pide como 20 un tamaño válido que no sea 20, 50 ni 100). DD-01 del TD-frontend lo explica.
- **NEW-03 / NEW-04 · medio y bajo** — referencias del TD-frontend a los ficheros de test reales (`filters.test.tsx`,
  `JobDetailScreen.states.test.tsx` y los hermanos `[adversarial]`); corregidas por el arquitecto.
- **NEW-05 · bajo** — `tasks/TASK-01.md` y `TASK-04.md` llevan una nota de que los criterios de «`same-site` pasa»
  quedan sustituidos por la reapertura.

## 5. Criterio → test
Los 24 CA, los 20 flujos de UC y los EC de la ronda 1 siguen con su test (§5 de `review/REVIEW-ronda-1.md`) y en verde
en §7. Cambios de esta ronda:

| Origen | UC | Criterio o edge case | Categoría | Test (`fichero:línea`) | Estado |
|---|---|---|---|---|---|
| EC-14 / RF-02 Must | — | Ventana de INV-05 con el puerto por defecto | 5 datos corruptos | `apps/api/test/jobs/close.test.ts:202` «EC-14 sin puerto de inscripciones…» | pasa (antes falla) |
| EC-49 / RF-01, 02, 04 | — | Escritura desde otro sitio o `same-site`: 403 | 6 seguridad | `apps/api/test/http/cross-site.test.ts` (47 tests: `same-site`, `cross-site`, `PUT`, normalización) | pasa |
| CA-18 | UC-07 · A3 | «Por página» solo 20/50/100 | — | `apps/web/test/features/jobs/JobListScreen.filters.test.tsx:94,123` · `apps/web/test/features/jobs/list-query.test.ts:100,118` | pasa |

**Resultado:** 24/24 CA, 20/20 flujos de UC y 44/44 EC aplicables.

## 6. Gates de QUALITY-GATES

| Umbral | Medido | ¿Cumple? |
|---|---|---|
| Líneas por fichero ≤ 300 | `src`: máx. `apps/web/src/features/jobs/JobFormScreen.tsx` 216; tests: `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx` 300 | Sí |
| Líneas por función ≤ 50 | Sin cambios respecto a la ronda 1 | Sí |
| Complejidad ≤ 10 ramas | `splitServerError` 5 y `splitValidationError` 6 (`apps/web/src/features/jobs/job-form-errors.ts`); `isJob` 2 (`apps/web/src/features/jobs/api.ts`) | Sí |
| 1 test por RF, flujo y EC Must | 7/7 RF, 20/20 flujos, 44/44 EC Must | Sí |
| Anti-patrones de §4 | Sin hallazgos | Sí |
| typecheck, lint, test, e2e, check:harness | En verde (§7) | Sí |

## 7. Integración
Ejecutada por la review sobre `22feb74`, con Node 24.21.0:

```
$ npm run typecheck
exit=0
$ npm run lint
exit=0
$ npm test
 Test Files  24 passed (24)
      Tests  309 passed (309)
 Test Files  25 passed (25)
      Tests  307 passed (307)
exit=0
$ npm run e2e
  24 passed (13.3s)
exit=0
$ npm run check:harness
check:harness: todo en verde.
exit=0
$ git ls-files | grep -c '\.db$'
0
```

Los cambios posteriores de la ronda son solo documentales (PRD DT-07, TD-frontend y notas de tareas).

## 8. Limitaciones
- Sin Safari (ver el bajo del foco), sin Windows ni Linux; rendimiento solo con `fastify.inject` y 100 ofertas.
- No hay test que fije `text/plain` → 400 en el alta; el comportamiento sale de leer Fastify y `rejectBody`.

## 9. Acciones requeridas
Ninguna bloqueante. **Observaciones aceptadas** (merge preaprobado con «Aprobado con observaciones»):
1. SEC-02 · bajo — `UPDATE` y `DELETE` sin guarda de estado en el SQL (`apps/api/src/modules/jobs/repository.ts:42-45,159`);
   defensa en profundidad para HU-05.
2. SEC-04/SEC-05 · bajo — sin lista de `Host` permitidos (DNS rebinding teórico; anterior a HU-02).
3. Bajo — foco tras un error en Safari (`apps/web/src/features/jobs/use-job-actions.ts:62-63`).
4. Bajo — `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx` en 300 líneas: el siguiente test va a un hermano.
5. DP-01/DP-02 · bajo — avisos para HU-05: test de que los errores del puerto no llevan datos del candidato al log; no
   copiar `SELECT *` en candidatos.

**A `/module-sync`:** DD-04 (`docs/ARCHITECTURE.md`: `jobApplications?`, `CROSS_SITE_REQUEST`, el guard, `rejectBody`,
`text-search.ts`), DD-05 (`docs/SETUP.md`: el seed son 10 ofertas), `technical.md`, `functional.md`, UC-02..08 y
`MVP-STATUS.md`.

**Avisos para las HU siguientes:** HU-03 cierra SEC-03 (`details` acotado, DT-10) y reutiliza `foldSearchText`; HU-05
conecta el puerto de inscripciones dentro de la transacción del cierre (con retención y `StageChange`) y sustituye el
test de EC-14.

---
Ronda: 2 · «Requiere cambios» previos: 1 (máximo 2; al tercero se para y se escala a la persona)

VERDICT: Aprobado con observaciones
