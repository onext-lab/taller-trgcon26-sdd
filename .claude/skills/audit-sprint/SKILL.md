---
name: audit-sprint
description: Audita el diff consolidado de un sprint en 2 dimensiones (código; seguridad y datos personales), ejecuta la suite y escribe sprint-NN-AUDIT.md con VERDICT. Úsala antes de /cerrar-sprint.
---

# audit-sprint

## Propósito

Gate de auditoría **a escala de sprint**, previo a `/cerrar-sprint`. `/reviewer` audita cada HU aislada contra su PRD; este skill audita el **incremento integrado** del sprint sobre el **diff consolidado** y ve lo que la review por HU no ve: interacciones y regresiones entre HU, seguridad y datos personales acumulados, drift entre docs y código entre módulos y calidad global.

**Complementa a `/reviewer`, no lo sustituye.** Reutiliza los agentes auditores; no los reimplementa. Es una versión **reducida** por coste: **2 dimensiones**, como mucho **4 subagentes a la vez** y sin panel de consenso.

Produce `docs/10_audits/sprints/sprint-NN-AUDIT.md` con una última línea `VERDICT:` parseable, que `/cerrar-sprint` consume.

## Idioma

Castellano de España, sin voseo. Identificadores en inglés.

## Uso

```
/audit-sprint NN        # p. ej. /audit-sprint 01
```

Sin `NN`, usa el sprint `en curso` más reciente.

## Pre-flight checks (bloquean)

1. **Localiza** `docs/01_roadmap/sprints/sprint-{NN}.md`. Si no existe → STOP.
2. **HU cerradas:** las de estado `hecha`, con su `Origen: FEAT-NN`. Si hay **0** → STOP. Nunca emitas `Aprobado` sobre un incremento vacío.
3. **Estás en `main`** con el árbol limpio y las HU del sprint ya mergeadas.

## Workflow

### Paso 1 — Diff consolidado

- **Base:** el `base:` del frontmatter del sprint (lo fija `/crear-sprint` con el `main` de partida). Si falta, usa el padre del primer merge de una HU del sprint: `git log --merges --first-parent main --grep 'HU-NN'` por cada HU.
- **Diff:** `git diff --stat <base>..main` y `git diff <base>..main -- apps/ e2e/`. Acótalo a lo que tocaron las HU del sprint; si aparece un commit que no mapea a ninguna HU ni task del sprint, anótalo como «fuera de alcance» en el informe.
- Registra `<base>` y `git rev-parse --short main` (el commit auditado): `/cerrar-sprint` lo usa para saber si el informe está al día.

### Paso 2 — Suite a escala de sprint (OBLIGATORIA y bloqueante)

No te fíes de las integraciones por HU: ejecuta la suite completa sobre `main` y pega la salida real (las últimas líneas de cada comando):

```bash
npm run typecheck
npm run lint
npm test
npm run e2e
```

**Baseline:** cada etiqueta de fase se crea con todo en verde, así que en `<base>` la suite estaba verde. Un fallo que ya figure como preexistente en el informe del sprint anterior (`docs/10_audits/sprints/`) es **preexistente**; cualquier otro es **atribuible al sprint**.

`SUITE_VERDICT`: `VERDE` · `ROJO-ATRIBUIBLE` · `ROJO-PREEXISTENTE` · `NO-EJECUTABLE` (con el motivo técnico; cuenta como dimensión no concluida).

### Paso 3 — Auditoría en 2 dimensiones (en paralelo)

Lanza los subagentes **en un solo mensaje** (varias llamadas `Agent`, que se ejecutan a la vez), con el **scope del diff del sprint** (rutas del Paso 1), no el de una HU:

| Dimensión | Quién | Qué mira |
|---|---|---|
| **D1 · Código** | `doc-code-drift-checker` + revisión de calidad del propio skill | Rutas citadas en `docs/` y `.claude/` que no existen; umbrales y anti-patrones de `docs/07_architecture_principles/QUALITY-GATES.md`; duplicación entre módulos; criterios de aceptación sin test; deuda nueva sin registrar |
| **D2 · Seguridad y datos personales** | `security-auditor` + `datos-personales-auditor` | OWASP web sobre el diff; minimización, base jurídica, retención, supresión y datos personales en logs, errores y respuestas según `docs/RGPD.md` |

Son **3 subagentes** a la vez (el límite es 4). La revisión de calidad de D1 la haces tú en el contexto principal mientras los agentes trabajan.

- Pide a cada auditor hallazgos con `fichero:línea`, severidad (`crítico`, `alto`, `medio`, `bajo`, `info`) y evidencia, y que termine su informe con la línea `<<FIN-INFORME>>`. Un informe sin esa línea llegó **cortado**: pídele con `SendMessage` solo la parte que falta, nunca el informe completo otra vez.
- **Aislamiento:** si un auditor cae o no devuelve un informe completo, su **dimensión queda «no concluida»**. Nunca la trates como «0 hallazgos».

### Paso 4 — Verificación de hallazgos de severidad media o superior

Por cada hallazgo `medio`, `alto` o `crítico`, **compruébalo tú** antes de aceptarlo: abre el `fichero:línea`, confirma que la evidencia lo sostiene y, si es de comportamiento, reprodúcelo con un test o una llamada local (`npm run dev` + `fastify.inject` o el navegador). Lo que no se sostiene va a la sección «Refutados» con el motivo. Los `bajo` e `info` pasan directos, sin verificar, y no cuentan para el veredicto.

### Paso 5 — Veredicto

En este orden de precedencia:
1. `SUITE_VERDICT: ROJO-ATRIBUIBLE` → **`Bloqueado`**, digan lo que digan los auditores.
2. Alguna dimensión «no concluida» o `SUITE_VERDICT: NO-EJECUTABLE` → **`Bloqueado`** (fail-closed).
3. Algún `crítico`, `alto` o regresión confirmados → **`Bloqueado`**.
4. Solo `medio` confirmados → **`Aprobado con observaciones`**.
5. Nada de severidad media o superior confirmado y suite `VERDE` o `ROJO-PREEXISTENTE` → **`Aprobado`**.

### Paso 6 — Informe

Escribe `docs/10_audits/sprints/sprint-NN-AUDIT.md` desde `docs/_templates/SPRINT-AUDIT.template.md`:
- Alcance: HU auditadas, `<base>..<commit auditado>`, rutas del diff.
- Suite a escala de sprint: comandos, salida resumida, fallos atribuibles y preexistentes y `SUITE_VERDICT`.
- D1 y D2 con los hallazgos **confirmados** (`fichero:línea`, severidad, evidencia y propuesta).
- «Refutados», «Bajos e info», «Dimensiones no concluidas» y «Override» (vacía; la rellena `/cerrar-sprint` si se usa).
- **Última línea:** `VERDICT: Aprobado`, `VERDICT: Aprobado con observaciones` o `VERDICT: Bloqueado`, sin formato markdown.
- **Idempotente:** si el informe ya existe, reescríbelo entero.

Commit en `main`: `docs(sprint-NN): auditoría del sprint`. Si el veredicto es `Bloqueado`, los arreglos van por el flujo de la HU afectada (rama `hu/…`, `/implementar-hu`, `/reviewer`) y después se repite este skill.

## Reglas duras

- **Diff consolidado, no HU a HU.**
- **La suite se ejecuta siempre** antes del veredicto, y un rojo atribuible bloquea siempre.
- **Fail-closed:** una dimensión no concluida nunca da `Aprobado`; un auditor caído no está «limpio».
- **Como mucho 4 subagentes a la vez.**
- **Solo lees y escribes el informe.** No modifiques los agentes auditores ni el código de `apps/`.

## Cuándo NO eres tú

- Auditar una HU contra su PRD → `/reviewer`.
- Cerrar y archivar el sprint → `/cerrar-sprint` (consume tu `VERDICT`).
- Arreglar hallazgos → flujo de la HU (`/implementar-hu`).

## Referencias

- `.claude/skills/reviewer/SKILL.md`: patrón de invocación en paralelo de los auditores.
- `.claude/agents/doc-code-drift-checker.md`, `.claude/agents/security-auditor.md`, `.claude/agents/datos-personales-auditor.md`.
- `docs/07_architecture_principles/QUALITY-GATES.md` y `docs/RGPD.md`.
