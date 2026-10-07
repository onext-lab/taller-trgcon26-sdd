# Auditoría del sprint-01

## Resumen
- **Fecha:** 2026-10-07 · **HU auditadas:** HU-01, HU-02, HU-03, HU-04, HU-05, HU-06 (las 6 en estado `hecha`), más
  las tareas transversales T-01 a T-05
- **Rango auditado:** `2cd8752..15fc488` (`base` del frontmatter del sprint → rama de integración del sprint) ·
  **Commit auditado:** `15fc488`
- **Commits:** 169 · **Ficheros tocados:** 530 (112 de `apps/*/src`, el resto tests, e2e y docs)
- **Hallazgos confirmados:** críticos 0 · altos 0 · medios 9 · bajos 13 · info 10
- Fuera de alcance: ningún commit sin HU o tarea del sprint. Los de T-01..T-05 y los de curado de cada review llevan su
  ID en el mensaje.

## 1. Suite completa

| Comando | Resultado | Detalle |
|---|---|---|
| `npm run typecheck` | verde | `@ats/api` y `@ats/web` |
| `npm run lint` | verde | |
| `npm test` | verde | API 1 097 tests en 78 ficheros · web 754 tests en 59 ficheros |
| `npm run e2e` | verde | 47 tests (Chromium) |
| `npm run check:harness` | verde | |

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
  47 passed (25.0s)
exit=0
$ npm run check:harness
check:harness: todo en verde.
exit=0
```

`SUITE_VERDICT: VERDE`. Baseline: `2cd8752` (etiqueta del esqueleto) estaba en verde. No hay fallos atribuibles ni
preexistentes en esta pasada.

**Intermitencias del sprint** (no fallan en esta pasada, pero son deuda de demo):
- `apps/web/test/features/jobs/DeleteJobAction.test.tsx` EC-21 falló 1 vez en la suite web completa tras el merge de
  HU-06 («expected true to be false» sobre `dialog.hasAttribute('open')`); en aislado, 20/20. Se arregló en `8c44350`.
- `JobDetailScreen.states` EC-46 falló en 1 de 10 semillas de `--sequence.shuffle` (`'' ≠ 'Oferta <b>X</b> · ATS'`).
  Se arregló en T-03.
- Con la suite web y los e2e a la vez, 16 tests web agotaron su *timeout* de 5 s (review de HU-04).
Las tres son la misma clase de fallo: **aserciones síncronas sobre lo que pone un efecto pasivo** (§2, A-01).

## 2. Dimensión código
Auditor: `doc-code-drift-checker` sobre los docs vivos y `.claude/` (VERDICT: OK). La revisión de calidad sobre el
agregado la hace la sesión con los gates del repo. Hallazgos **confirmados** (verificados en el código):

### Medios
1. **[C-01] Aserciones síncronas sobre efectos pasivos en los tests web.** Medido con `grep` en `apps/web/test/`:
   - 37 `expect(document.activeElement)` fuera de `waitFor`/`expectFocusOn`, en 18 ficheros.
   - 7 `expect(document.title)` síncronos. Cinco son negativos (`not.toContain`), que pueden pasar en vacío antes de que
     corra el efecto, por ejemplo `apps/web/test/features/applications/ApplicationDetailScreen.adversarial.test.tsx:65`.
   - 1 cierre de diálogo síncrono: `apps/web/test/features/applications/PipelineScreen.hire.test.tsx:79`.
   Frente a esas aserciones, hay 62 usos de `expectFocusOn`. Ya produjo dos intermitencias reales en el sprint (§1).
   La regla solo está como *gotcha* en los `technical.md`. No figura en `.claude/agents/web-builder.md` (que no cita
   `apps/web/test/helpers/focus.ts`) y nada la comprueba. **Es el mayor riesgo para la demo** (prioridad alta del
   responsable técnico).
2. **[C-02] El umbral de 50 líneas por función no se mide y tiene excepciones sin escribir.**
   `docs/07_architecture_principles/QUALITY-GATES.md:34` fija ≤ 50 sin excepciones. Medido con `max-lines-per-function`
   (50, sin líneas en blanco ni comentarios) sobre los 111 ficheros de `apps/*/src`, hay 6 funciones por encima:
   - Cuatro factorías de objeto con métodos, excusadas caso a caso por las reviews: `createCandidatesService` 82
     (`apps/api/src/modules/candidates/service.ts:90`), `createJobsService` 75 (`apps/api/src/modules/jobs/service.ts:73`),
     `createJobsRepository` 72 (`apps/api/src/modules/jobs/repository.ts:97`) y `createCandidatesRepository` 71
     (`apps/api/src/modules/candidates/repository.ts:102`).
   - Dos plugins de rutas que ninguna review señaló: `jobsRoutes` 62 (`apps/api/src/modules/jobs/routes.ts:57`) y
     `candidatesRoutes` 54 (`apps/api/src/modules/candidates/routes.ts:53`).
   `npm run lint` no aplica la regla. `applications` ya sigue el patrón que resuelve las factorías: casos de uso como
   funciones del módulo y consultas auxiliares con *spread* (`createStageOperations`, `createActiveByJobQueries`).
3. **[C-03] DEC-06 cuenta mal los puertos** — `docs/07_architecture_principles/DECISIONS.md:94` dice «Hoy hay tres» y no
   lista `CandidateLookupPort` (`apps/api/src/modules/applications/ports.ts:22`). `docs/ARCHITECTURE.md:52-57` y el
   código tienen cuatro.
   - La viñeta de dirección («los puertos de lectura que van contra la dirección de las llamadas los implementa el
     módulo de la izquierda; el que va en la dirección, el de la derecha») tampoco cubre `CandidateLookupPort`: va en la
     dirección de las llamadas (`inscripciones → candidatos`) y lo implementa el de la derecha, pero no es el único.
   - Lo introdujo la aclaración de HU-06 (DT-04). Hay que hacer una segunda aclaración trazable.
4. **[C-04] La skill `module-sync` describe un estado que ya no existe** — `.claude/skills/module-sync/SKILL.md:40`: «hoy
   cada módulo solo tiene un `README.md` "pendiente de la primera HU"». Los tres módulos tienen `functional.md` y
   `technical.md`. Lo mismo en `.claude/agents/product-owner.md:16`.
5. **[C-05] Los agentes builder y arquitectos no recogen la aclaración de DEC-06**:
   - `.claude/agents/api-builder.md:29-30` resume DEC-06 sin «ningún módulo importa a otro, ni sus tipos; puertos por
     tipado estructural»;
   - no citan `apps/api/test/module-boundaries.test.ts`;
   - `backend-architect.md` y `frontend-architect.md` no mencionan los puertos.
   El kit de un asistente no le enseña la regla que más se ha trabajado en el sprint.
6. **[C-06] Cita equivocada en un UC implementado** — `docs/05_modules/candidatos/casos-de-uso/UC-12-ver-ficha.md:62`
   (A1, CA-19/CA-20) cita `e2e/applications.spec.ts:76`. Esa línea es del test «CA-02 buscar por parte del email». El de
   la retención es `e2e/applications.spec.ts:31`.
7. **[C-07] La doc de inscripciones contradice el código** — `docs/05_modules/inscripciones/technical.md:263-265` dice
   que `applications` solo importa de `candidates` su `api.ts` y `types.ts`, y que los enlaces a la ficha le llegan por
   props. Pero `apps/web/src/features/applications/ApplicationDetails.tsx:3` importa `candidatePaths` de
   `../candidates/paths.ts`. No es un import prohibido (la dirección `applications → candidates` es correcta), pero la doc
   afirma otra cosa.

### Bajos
- `docs/05_modules/inscripciones/technical.md:299`: dice «22 usos» de `expectFocusOn`; hoy son 38.
- `docs/05_modules/ofertas/technical.md:3-7`: la cabecera dice «hasta HU-02» y encadena las demás como parches.
- `docs/05_modules/ofertas/technical.md:28`: el lector `job-status.ts` aparece sin `getJobSummary` ni `findSummaryById`.
- `AGENTS.md:23` y `.claude/agents/product-owner.md:26`: `next-id.mjs` sin el tipo `uc`.
- `docs/WORKFLOW.md:188`: no cita `/audit-sprint` entre quienes lanzan `doc-code-drift-checker`.
- `ATS_DB_PATH` y `WEB_PORT` no están en `docs/SETUP.md`; `check:clean` no está en DEC-02.
- `docs/05_modules/candidatos/technical.md:205`: la regla de `expectFocusOn` no se aplica en los tests de `candidates`.
  Es parte de C-01.
- `docs/RGPD.md:59,77`: describe en presente la exportación y la exclusión de anonimizados, que son de la feature A.
- 15 ficheros de test entre 290 y 300 líneas. Los tests se parten por el techo, no por el tema: es una señal para la
  convención de nombres de C-08.

### Info
- **Convenciones repetidas sin documentar**, a decidir cuáles pasan a convención del repo (con un ejemplo cada una):
  - casos de uso como funciones del módulo con factoría corta (`apps/api/src/modules/applications/service.ts:232-243`);
  - consultas auxiliares con *spread* (`apps/api/src/modules/applications/repository.ts:145-183`);
  - constantes `*_MESSAGE` por servicio (`apps/api/src/modules/applications/service.ts:72-76`);
  - helper `require*` que lanza `notFound` (`apps/api/src/modules/jobs/service.ts:67`);
  - guardas `isX(value): value is X` en cada `api.ts` web (`apps/web/src/features/applications/api.ts:48`);
  - `isNotFound(error)` copiada en 5 pantallas (`apps/web/src/features/jobs/JobDetailScreen.tsx:21`);
  - un hook `use-*-actions.ts` por pantalla (`apps/web/src/features/jobs/use-job-actions.ts`);
  - tests partidos en hermanos con sufijos `-adversarial` y `*-fixtures.ts`
    (`apps/web/test/features/applications/reject-fixtures.ts`).
- UC-17 sigue en `aprobado` por A3 (feature A); el 100 % de `inscripciones` no la cuenta, como dice la skill.
- «`npm run db:reset` tras el merge de HU-06» aparece como instrucción temporal en 5 docs; caduca al cerrar el sprint.
- `apps/api/src/modules/.gitkeep`, `apps/web/src/features/.gitkeep` y `apps/web/src/components/.gitkeep` sobran.
- Rutas absolutas de máquina: 0 en docs vivos y `.claude/`; 60 en los briefs de HU-01 a HU-04 (ya planificado para
  paso-3, con la regla de `check-clean`).

## 3. Dimensión seguridad y datos personales
Auditores: `security-auditor` (VERDICT: OK) y `datos-personales-auditor` (VERDICT: OK) sobre todo `apps/api/src` y
`apps/web/src`. Hallazgos **confirmados**:

### Medios
8. **[D-01] Residuos tras anonimizar** — `apps/api/src/db/connection.ts:17`: la base abre con `journal_mode = WAL` y sin
   `secure_delete`. Una anonimización por `UPDATE` dejaría el nombre, el email y el teléfono anteriores en páginas libres
   y en el `-wal` hasta el checkpoint o el `VACUUM`. RGPD §5 pide una supresión irreversible. Hoy no hay riesgo, porque la
   anonimización no existe: es para la feature A.
9. **[D-02] RGPD §7 no cubre las operaciones propias de `candidatos`** — `apps/api/src/modules/candidates/service.ts:96`
   y `:131-161` y `apps/api/src/modules/candidates/repository.ts:86-95`. `update`, `giveConsent`, `withdrawConsent`,
   `recalculateRetention` y el listado o la búsqueda no consultarán ninguna marca de anonimizado. §7.2 y §7.5 solo
   cubren el lado de `inscripciones`. Hay que añadir una cuestión a §7, sin resolverla.

### Bajos
- **SEC-S1** — `apps/api/src/http/cross-site.ts:22`: no hay lista de `Host` permitidos (DNS rebinding). Ya estaba
  aceptado en HU-02 y HU-03 y la severidad no cambia, aunque el impacto crece con el CRUD completo de candidatos.
  Propuesta: 403 si `Host` no es `127.0.0.1` o `localhost` con su puerto.
- **DP-S3** — el 409 `DUPLICATE` del email devuelve `existingId` (DEC-07): confirma que existe alguien. Con un solo rol,
  no hay exposición nueva.
- **DP-S4** — el buscador del panel de inscribir reutiliza `GET /api/candidates?q=` (`skills` y `email`); el logger
  quita la query.
- **DP-S5** — `apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx:285,297`: un teléfono `911 000 000`
  fuera de la serie de ficción `+34 600 000 0xx`.
- Aceptados en las reviews y sin cambio de severidad a escala de sprint: S-18 (pipeline sin paginar), DT-09/DT-01
  (verificado: una oferta `draft` o `closed` nunca tiene inscripciones no finales), `busy_timeout` sin fijar, DEC-12 sin
  la cabecera, DP-01 (`SELECT *` de `recalculateRetention`).

### Info
- **SEC-S2**: solo dos rutas rechazan parámetros de consulta desconocidos; las demás los ignoran sin leerlos.
- **SEC-S3**: el serializador del log registra la ruta tal cual; una ruta inexistente escrita a mano con un dato
  quedaría en el log. La web nunca la construye.
- **Inventario de datos personales** (para la feature A): `candidates` (`full_name`, `email`, `phone`, `summary`,
  `skills`, consentimiento y `retention_ends_at`) y `stage_changes.note`. No hay copias ni derivados: la búsqueda
  pliega en la consulta.
  - Para anonimizar hace falta una migración 004 con `anonymized_at`.
  - El email anonimizado debe ser único y sin hash reversible.
  - Sin decidir: qué se conserva del consentimiento y de `created_at` como prueba del art. 7.1, y qué valor queda en
    `retention_ends_at`.
- **Retención de punta a punta** (alta, inscribir, avanzar o rechazar a final, cierre, consentimiento): ningún camino
  deja `retention_ends_at` incoherente. Hay un único escritor (`recalculateRetention`) y la fórmula es única.
- Dependencias: versiones fijadas sin `^` ni `~`, con `package-lock.json`; ninguna fuera de DEC-01. Sin `npm audit`
  (no hay red): conviene antes de un uso real.

## 4. Dimensiones no concluidas
Ninguna. Los tres informes llegaron completos, con `<<FIN-INFORME>>`, y los nueve medios se verificaron en el código.

## 5. Override
No aplica.

## 6. Acciones
Por prioridad. Las de código van por el flujo de una tarea del sprint o de una HU; las de la feature A, a `docs/RGPD.md`
§7 para su *shaping* en directo.

- [ ] **A-01 · prioridad alta (C-01)**: regla de tests «nada de aserciones síncronas sobre lo que pone un efecto pasivo»
      (foco, `document.title`, cierre de `dialog`).
  - Convención en `.claude/agents/web-builder.md` y en un doc vivo, con ejemplo: `apps/web/test/helpers/focus.ts` y
    `await waitFor(...)`.
  - Comprobación en `npm run check:harness`, con su test: falla si encuentra esas aserciones sin `waitFor` ni
    `expectFocusOn`.
  - Barrido de las 45 aserciones de §2 (incluidas las negativas de título, que deben esperar al título positivo).
- [ ] **A-02 · deuda de demo** (pedida por el responsable técnico):
  - (a) un script de integración con unitarios y e2e en serie y e2e con *workers* acotados;
  - (b) un *timeout* por test web fijado y justificado (no subirlo a ciegas);
  - (c) medir la pasada completa en una máquina modesta, limitando *workers*, para saber el tiempo en directo.
- [ ] **A-03 (C-02)**: decidir el umbral de función.
  - Opción 1: escribir en QUALITY-GATES la excepción de las factorías de objeto y los plugins de rutas, y medirla con
    lint.
  - Opción 2 (recomendada): partir `createJobsRepository` y las otras tres factorías con el patrón `createXOperations`
    de `applications`, y los dos plugins de rutas en funciones de registro por grupo.
  - En las dos, añadir `max-lines-per-function` a `npm run lint`.
- [ ] **A-04 (C-03)**: segunda aclaración de DEC-06, trazable, con `CandidateLookupPort`: cuatro puertos y una viñeta
      de dirección correcta para los cuatro, sin cambiar la decisión.
- [ ] **A-05 (C-04, C-05)**: poner al día `.claude/skills/module-sync/SKILL.md:40`, `.claude/agents/product-owner.md:16`
      y los agentes builder y arquitectos (DEC-06 aclarado, puertos y `module-boundaries.test.ts`).
- [ ] **A-06 (C-06, C-07 y los bajos de docs)**: corregir la cita de UC-12 · A1, `inscripciones/technical.md:263-265` y
      `:299`, la cabecera y la línea 28 de `ofertas/technical.md`, `next-id.mjs` con `uc`, `WORKFLOW.md:188`,
      `SETUP.md` (`ATS_DB_PATH`, `WEB_PORT`) y DEC-02 (`check:clean`).
- [ ] **A-07 · convenciones**: decidir cuáles de las 8 de §2 (info) pasan a «Convenciones del repo», con un ejemplo de
      código cada una (pedido por el responsable técnico).
- [ ] **A-08 · feature A (D-01, D-02 y la info de §3)**:
  - añadir a `docs/RGPD.md` §7 la cuestión de las operaciones propias de `candidatos`, el mecanismo contra residuos
    (`secure_delete` o `VACUUM`) y qué se conserva al anonimizar;
  - sin resolverlas: van al *shaping* en directo.
- [ ] **A-09 · seguridad (SEC-S1)**: lista de `Host` permitidos en la guarda `onRequest`; es opcional y la decide el
      responsable técnico.
- [ ] **A-10 · paso-3** (ya planificado, no es de este sprint): rutas absolutas de los briefs de HU-01 a HU-04 y la
      regla de `check-clean`.

VERDICT: Aprobado con observaciones
