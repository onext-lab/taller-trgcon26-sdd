# Auditoría del sprint-02

## Resumen
- **Fecha:** 2026-10-09 · **HU auditadas:** ninguna. Es un sprint técnico sin HU (decisión del responsable técnico,
  2026-10-09); el incremento son las tareas T-08 a T-14.
- **Rango auditado:** `8328116..9215a8a`, re-auditado hasta `baffda9` (§7) (`base` del frontmatter → cabeza de la rama de integración
  `worktree-paso-3-punto-de-partida`) · **Commit auditado:** `baffda9` (re-auditoría; la auditoría completa fue sobre `9215a8a`)
- **Commits:** 15 · **Ficheros tocados:** 106 (23 de `apps/`, `scripts/`, `.claude/` y configuración; el resto, docs)
- **Hallazgos confirmados:** críticos 0 · altos 1 · medios 4 · bajos 8 · info 15

**Pre-flight, adaptado y anotado:**
- *«0 HU → STOP»:* el incremento no está vacío (7 tareas con brief o documentación, cada una integrada). El
  responsable técnico pidió cerrar este sprint con `/audit-sprint` para que la etiqueta salga auditada.
- *«Estás en `main`»:* como en el sprint-01, se audita la rama de integración; `main` avanza por *fast-forward* tras la
  revisión del responsable técnico.
- *Fuera de las tareas, pero dentro de `base..`:* el borrador del guion (`6d8073e`), el README y `SETUP.md`
  (`85cc2b6`) y la corrección de trazabilidad de los UC (`055673b`), anotados en las notas del sprint. Se auditan igual.

## 1. Suite completa

| Comando | Resultado | Detalle |
|---|---|---|
| `npm run typecheck` | verde | 3,3 s |
| `npm run lint` | verde | 2,9 s; incluye `max-lines-per-function` (50) sobre `apps/*/src`, nuevo en T-09 |
| `npm test` | verde | API 1 097 tests en 78 ficheros · web 762 tests en 59 ficheros |
| `npm run e2e` | verde | 47 tests (Chromium) |
| `npm run check:harness` | verde | Aviso de 2 marcadores de publicación pendientes (URL_MARKETPLACE), a propósito |

```
$ npm run typecheck
exit=0 (3,3 s)
$ npm run lint
exit=0 (2,9 s)
$ npm test
 Test Files  78 passed (78)
      Tests  1097 passed (1097)
 Test Files  59 passed (59)
      Tests  762 passed (762)
exit=0 (16,4 s)
$ npm run e2e
  47 passed (25.6s)
exit=0 (26,0 s)
$ npm run check:harness
check:harness: todo en verde.
exit=0 (2,1 s)
```

`SUITE_VERDICT: VERDE`. Baseline: `8328116` (main tras `paso-2-sprint-01` y el estilo visual) estaba en verde. No hay
fallos atribuibles ni preexistentes. La web pasa de 754 a 762 tests por los 8 casos nuevos de `isNotFound` (T-14).

## 2. Dimensión código
Auditor: `doc-code-drift-checker` sobre los docs vivos, `.claude/` y los briefs del sprint (VERDICT: HALLAZGOS). La
revisión de calidad sobre el diff la hace la sesión con los umbrales de QUALITY-GATES, ampliados a `scripts/`.
Hallazgos **confirmados** (verificados en el repo):

### Altos
1. **[DD-01] Cita de trazabilidad a un test que no es el del criterio** —
   `docs/05_modules/candidatos/casos-de-uso/UC-09-alta-candidato.md:73`. En la fila E2 (email duplicado, CA-05), la cita
   web apunta a `apps/web/test/features/candidates/CandidateFormScreen.adversarial.test.tsx:132`, que es
   `EC-08: doble clic en «Guardar»…`. El test de CA-05 es el de `:102` (`CA-05 / EC-07: un 409 pone el message junto al
   email…`). El flujo sí está cubierto por las otras dos citas de la fila (`apps/api/test/candidates/create-adversarial.test.ts:173`
   y `e2e/candidates.spec.ts:163`); lo roto es el ancla. Lo agrava que la corrección de trazabilidad de este mismo
   sprint (`055673b`) la dio por buena: el barrido clasificó la línea como «test EC que cubre el flujo» sin leerlo.
   **Propuesta:** `:132` → `:102`, y repasar a mano las 9 citas de esa clase que el barrido dejó como plausibles.

### Medios
2. **[DD-03] Enumeración de scripts desfasada** — `docs/ARCHITECTURE.md:32`: la fila «Scripts» lista `dev`,
   `check:env`, `check:harness` y `next-id`. Faltan `integrate`, `check-clean`, `check-clean-identities`,
   `check-machine-paths`, `check-passive-effects` y `publish-markers` (cuatro de ellos son de este sprint).
   **Propuesta:** listarlos con una frase cada uno.
3. **[C-01] Complejidad por encima del umbral en un script nuevo** — `scripts/check-clean.mjs:179`: `main` tiene
   complejidad 11 (umbral: 10, QUALITY-GATES §2), medido con
   `npx eslint --rule 'complexity: [error, 10]' scripts/check-clean.mjs`. El fichero está en 300 líneas justas.
   **Propuesta:** sacar el despacho de modos (`--self-test`, `--file`, normal y `--publish`) a funciones pequeñas.

### Bajos
- **[C-02]** `git ls-files -z --cached --others --exclude-standard` se repite en 4 scripts
  (`scripts/check-harness.mjs:335`, `scripts/check-clean.mjs:104`, `scripts/check-machine-paths.mjs:82`,
  `scripts/publish-markers.mjs:31`). Un helper común lo evitaría.
- **[DD-04]** `docs/ARCHITECTURE.md:103-105`: la convención `requireX` tiene una excepción en `applications`, que
  repite la comprobación en `apps/api/src/modules/applications/service.ts:179`, `:187` y `:213`. Matizarla o anotarla
  como deuda.
- **[DD-05]** `docs/01_roadmap/sprints/sprint-02.md`: T-10 y T-13 no tienen brief porque no escriben código (R1 solo lo
  exige con builder); falta una línea que lo diga.

### Info
- **[C-03] `scripts/` fuera del lint de tamaño** (anterior al sprint): `scripts/check-harness.mjs` tiene 405 líneas y
  `parseFrontmatter` (`:48`), complejidad 15. Ningún script lo mide el lint. El responsable técnico pidió que esta
  auditoría lo decida: **se recomienda** extender `max-lines` (300), `max-lines-per-function` (50) y `complexity` (10) a
  `scripts/**/*.mjs`, con una excepción fechada y explícita para `check-harness.mjs` hasta partirlo (acción A-04).
- **[DD-06]** `docs/ARCHITECTURE.md`: la cita `candidates/repository.ts:97` es la constante `FIND_NAMES_SQL` (con
  `SELECT id, full_name`); el método `findNamesByIds` está en `:113`. El texto cuadra con lo citado.
- **[DD-07]** `docs/taller/GUION.md:40` dice «47-51 s»; las pasadas registradas van de 45,7 s a 50,8 s.
- **[DD-08]** Los briefs cerrados de T-09 y T-14 citan coordenadas anteriores al cambio, como es normal en un brief.
- **[DD-09]** `docs/SETUP.md` «Antes de publicar» nombra los tres marcadores; ya solo queda URL_MARKETPLACE.
- **[DD-10]** `scripts/check-clean.mjs:191` menciona un hook `commit-msg` que no está en `.claude/`: es un hook local de
  git, fuera del repo. Conviene decirlo.
- **[DD-11]** La checklist del GUION pide todas las etiquetas; `paso-3-punto-de-partida` y los `vivo-*` aún no existen
  (es lo esperado).
- Sin hallazgos en: las 15 citas de `docs/ARCHITECTURE.md` §Convenciones, las del GUION (incluida la mutación del
  bloque 4), 42 de las 43 citas de trazabilidad de UC-01, UC-09, UC-10 y UC-14, los comandos y scripts que citan los
  docs, el mapa de rutas de `NOTICE` y las 6 citas de `technical.md`.

### Refutados
- **[DD-02]** `docs/taller/GUION.md:101` cita `docs/03_delivery/hu/HU-04-inscribir-candidato/hu.md`, sin
  `completadas/`. **Refutado:** la fila es de la etiqueta `paso-1-discovery`, y en esa etiqueta la ruta existe
  (`git show paso-1-discovery:docs/03_delivery/hu/HU-04-inscribir-candidato/hu.md` la muestra). Se puede aclarar en la
  celda, sin que sea un defecto.

## 3. Dimensión seguridad y datos personales
Auditores: `security-auditor` (VERDICT: HALLAZGOS, 0 medios o más) y `datos-personales-auditor` (VERDICT: HALLAZGOS).
Hallazgos **confirmados**:

### Medios
4. **[DP-01] Nombre de pila de la persona responsable en docs que se publicarán** —
   `docs/01_roadmap/sprints/sprint-02.md:73`, `:79`, `:84`, `:90`, `:93` y `:111` («decisión de» o «dada por» seguido del
   nombre). La copia de publicación reescribe las identidades de autoría (T-15) para no publicarlas, y la
   prosa las nombra igualmente. El mismo nombre aparece en docs anteriores al sprint (`docs/01_roadmap/sprints/sprint-01.md:168`,
   `docs/05_modules/inscripciones/technical.md:75`, los PRD, hu.md y REVIEW de HU-04 a HU-06, entre otros), y la
   denylist real no lo cubre. `docs/RGPD.md` trata datos de candidatos, no de quienes trabajan en el repo: **el criterio
   lo decide la persona**. **Propuesta:** en `sprint-02.md`, «el responsable técnico» o «la persona responsable»; para
   el resto, decidir si se sanea antes de T-15 o lo resuelve la copia de publicación (y, si cuenta, añadir la regla a la
   denylist).

### Bajos
- **[SEC-01] / [DP-03]** `scripts/check-clean.mjs:108`, `:138`, `:145` y `:149`: cuando una regla coincide con un nombre
  de fichero, rama o etiqueta, o con una ruta del diff, el informe imprime ese nombre (que es el término), en contra de
  la cabecera del script. Solo sale por consola local. Imprimir un índice o enmascarar, y cubrirlo en la autoprueba.
- **[SEC-02]** `scripts/integrate.mjs:45-50`: en win32 une `command` y `args` sin entrecomillar. Los pasos reales son
  constantes (no hay inyección), pero la autoprueba con `process.execPath` y código con espacios fallaría en Windows.
  Lanzar `process.execPath` sin shell y reservar la shell para `npm`.
- **[DP-02]** `.gitignore` no incluye `.mailmap`, y `--publish` no comprueba que no esté versionado: la decisión «el
  `.mailmap` no se versiona» depende de la disciplina de quien lo cree.
- **[DP-04]** `--publish` no revisa las identidades de los trailers (`Co-Authored-By`, `Signed-off-by`): uno con un email
  real lo pasaría (en modo normal, solo lo cubre la denylist).

### Info
- **[SEC-03]** `usage()` y `--file` repiten la ruta que pasa quien llama (`basename` bastaría).
- **[SEC-04]** `statSync` y `readFileSync` siguen enlaces simbólicos versionados; no se imprime el contenido.
- **[SEC-05]** `isAllowedIdentity` compara nombre y email por separado, no como pareja; con un solo titular canónico no
  cambia nada.
- **[SEC-06]** Sin `git` o fuera de un repo, dos scripts lanzan una traza con la ruta absoluta del script.
- **[I-01] Retención y consentimiento intactos tras T-09:** `recalculateRetention` sigue siendo el único escritor y se
  une a la transacción en curso (`apps/api/src/modules/candidates/service.ts:91-106`, `apps/api/src/db/transaction.ts:9`).
- **[I-02]** Respuestas, errores y logs sin cambios; **[I-03]** `isNotFound` solo lee `status`; **[I-04]** las
  identidades nunca se imprimen y la autoprueba usa solo identidades inventadas; **[I-05]** ninguna ruta con nombre de
  usuario en el árbol; **[I-06]** los docs nuevos no tienen emails personales.
- Refactor T-09: el `security-auditor` confirma hooks, esquemas, guardas de estado en el `WHERE`, transacciones, SQL
  parametrizado, límites y orden de registro de rutas sin pérdidas.
- Sin decidir en `docs/RGPD.md` (para la feature A, anterior al sprint): el `existingId` del 409 de email duplicado
  revela si existe un candidato con ese email; las cuestiones 1, 2, 7 y 8 de §7 siguen abiertas.

**Limitación de los auditores:** los tres trabajaron sobre el árbol final, sin ejecutar `git diff` (no tienen Bash).
La sesión cubrió el contraste con el diff con la suite completa, `git diff --stat -- apps/api/test apps/web` vacío en
T-09 y la revisión de cada diff en la integración de cada tarea.

## 4. Dimensiones no concluidas
Ninguna. Los tres informes llegaron completos (con `<<FIN-INFORME>>`).

## 5. Override
No aplica.

## 6. Acciones
- [x] **A-01 (DD-01, alto) · bloquea** → T-16 (`cd9ea96`): `UC-09-alta-candidato.md:73` apunta a `:102`. Al releer a
      mano las 9 citas «plausibles», salió otra: `UC-08-consultar-oferta.md:61` (A1, CA-22) pasa de `:82` a `:92`.
- [x] **A-02 (DD-03, medio)** → T-16: fila «Scripts» de `docs/ARCHITECTURE.md` al día.
- [x] **A-03 (C-01, medio)** → T-17 (`baffda9`): `main` de `scripts/check-clean.mjs` dentro del umbral.
- [ ] **A-04 (C-03, decisión de esta auditoría):** extender `max-lines`, `max-lines-per-function` y `complexity` a
      `scripts/**/*.mjs`, con una excepción fechada para `scripts/check-harness.mjs` hasta partirlo (backlog).
- [ ] **A-05 (DP-01, medio):** hecho en `sprint-02.md` (T-16: rol en lugar de nombre, 0 menciones). **Abierto:** la
      decisión sobre los docs anteriores al sprint y sobre la regla de la denylist, escalada a la persona responsable
      el 2026-10-09 (recomendación: sanearlos en la copia de publicación, T-15).
- [ ] **A-06 (bajos, opcional antes de publicar):** SEC-01/DP-03, SEC-02, DP-02, DP-04, C-02 y DD-04. DD-05 y DD-07,
      hechos en T-16.

## 7. Re-auditoría corta tras T-16 y T-17
Desde `c5fc6e2` hasta `baffda9` hay 3 commits y 8 ficheros: 2 UC, `docs/ARCHITECTURE.md`, el GUION, el sprint, el brief
de T-17 y dos scripts (`scripts/check-clean.mjs` y `scripts/check-clean-identities.mjs`). **Ninguno de `apps/` ni de
`e2e/`**, así que la dimensión de seguridad y datos personales sobre el producto no cambia. En lugar de relanzar los
auditores, la sesión verificó lo tocado:

- **DD-01 y la cita extra de UC-08:** el comprobador de citas de los tres catálogos (165 citas) da `UC-09:73` E2 →
  `CandidateFormScreen.adversarial.test.tsx:102` («CA-05 / EC-07: un 409…») y `UC-08:61` A1 →
  `JobDetailScreen.states.test.tsx:92` («CA-22, EC-42…»). Las 7 «plausibles» restantes se sostienen leídas a mano
  contra su criterio.
- **DD-03:** la fila «Scripts» nombra los 9 scripts y cuáles se prueban a sí mismos.
- **C-01:** `npx eslint --rule 'complexity: [error, 10]' --rule 'max-lines: [error, {max: 300}]' scripts/check-clean.mjs scripts/check-clean-identities.mjs`
  da `exit=0`; el builder comparó 12 casos de salida y código de salida antes y después (idénticos), y la autoprueba
  (con su comprobación de que nada imprime identidades ni términos) sigue en verde.
- **DP-01:** 0 menciones del nombre en `docs/01_roadmap/sprints/sprint-02.md`.

Suite sobre `baffda9`:

```
$ npm run integrate
typecheck verde 3,6 · lint verde 3,0 · test-api verde 6,8 (1097) · test-web verde 8,6 (762) · e2e verde 27,0 (47) · check-harness verde 2,4
Total 51,3 · ✔ Integración en verde.
$ node scripts/check-clean.mjs --denylist <denylist real>
check-clean: 0 coincidencias (56 reglas · 638 ficheros del árbol · historial, refs e identidades).
```

`SUITE_VERDICT: VERDE`. Queda abierto un **medio** (DP-01, la parte que depende de la decisión de la persona
responsable) y ningún alto ni crítico.

VERDICT: Aprobado con observaciones
