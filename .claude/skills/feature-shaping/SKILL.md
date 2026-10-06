---
name: feature-shaping
description: Convierte una idea (IDEA-NNN) en una feature shaped (FEAT-NN) preguntando hasta cerrar actores, casos de uso, reglas, invariantes, casos límite y alcance. Va tras /anadir-idea; usa feature-analyst.
---

# feature-shaping

## Propósito

Paso de **discovery** entre `ideas/` y `features/`. Toma una idea cruda y la convierte en una **feature bien shaped**, analizando la funcionalidad **con detalle y sin asumir nada**: detecta **reglas de negocio, casos de uso e invariantes** preguntando al usuario todo lo necesario **hasta cerrar todas las preguntas abiertas posibles**.

No diseña la solución técnica (eso es `/tech-design`) ni escribe el PRD de una HU (eso es `/prd-writer`). Aclara el **QUÉ** a nivel de producto y deja la feature lista para priorizar y partir en HU.

Conduce el análisis con el agente **`feature-analyst`**.

## Uso

```
/feature-shaping NNN        # p. ej. /feature-shaping 003 → docs/02_discovery/ideas/003-*.md
```

Si el usuario describe una capacidad sin idea registrada, regístrala antes con `/anadir-idea` (no dupliques aquí su numeración) y continúa.

## Idioma

Castellano de España, sin voseo, tildes correctas. Identificadores de código en inglés.

## Pre-flight checks (bloquean)

1. **Existe la idea** `docs/02_discovery/ideas/{NNN}-*.md`. Si no: *«No encuentro la idea `{NNN}` en `docs/02_discovery/ideas/`. ¿La registro primero o me das otro número?»* — STOP.
2. **No está cerrada**: ni `completada`, ni `descartada`, ni con `feature:` ya asignada. Si ya tiene feature, pregunta si se actualiza la existente.

## Workflow

### Paso 1 — Cargar contexto barato

Lee directo (pocas líneas):
- La idea `docs/02_discovery/ideas/{NNN}-*.md`.
- `docs/_modules.md` y, si existen, los `docs/05_modules/{módulo}/functional.md` de los módulos que toca.
- `docs/_templates/FEATURE.template.md` (formato del resultado).
- `docs/02_discovery/features/` y `features/completadas/` (para detectar solapes).
- `docs/07_architecture_principles/DECISIONS.md` (las `DEC-NN` que la idea roce; p. ej. DEC-04: sin login, un único rol «reclutador»).
- `docs/06_design_principles/README.md`: principios de producto y UX, tratados como invariantes.
- `docs/RGPD.md` si la idea toca datos personales de candidatos (casi siempre en este ATS).

### Paso 2 — Escaneo de código (opcional, subagente)

Si necesitas saber qué existe ya (tablas, endpoints, pantallas), lanza **un subagente `Explore` acotado** a `apps/api/src/modules/{módulo}/` y `apps/web/src/features/{módulo}/` y quédate solo con el resumen. Nunca leas el código entero en el contexto principal.

### Paso 3 — Análisis sin asunciones (6 dimensiones)

Con el agente **`feature-analyst`**, enumera por dimensión qué se sabe (citando la fuente) y qué no (→ pregunta):
1. **Actores y roles.** Hoy solo existe el «reclutador» (DEC-04). Si la idea pide otro rol, es una pregunta, no un supuesto.
2. **Casos de uso (UC-NN):** actor, precondición, disparador, flujo principal (**P**), alternativos (**A1…**), excepciones (**E1…**) y postcondiciones. **Cada A y cada E sale de una pregunta respondida** («¿qué pasa si el email ya existe?»), nunca de un supuesto. Revisa también los UC ya existentes en `docs/05_modules/{módulo}/casos-de-uso/README.md`: si la feature cambia uno, se edita (no se duplica).
3. **Reglas de negocio (RN-NN):** condición → comportamiento. Busca modales («debe», «solo si», «máximo», «siempre») y **pregunta los umbrales** (nunca los inventes: «¿cuántos meses de retención?», «¿tamaño máximo del CSV?»).
4. **Invariantes:** lo que SIEMPRE se cumple (p. ej. «un candidato no se inscribe dos veces en la misma oferta»). Cruza con `DECISIONS.md`, `docs/RGPD.md` y los principios de diseño.
5. **Casos límite:** recorre las **7 categorías** de `docs/07_architecture_principles/QUALITY-GATES.md` (input inválido, boundary, fallo de dependencia, concurrencia, datos corruptos, seguridad, idempotencia). Para cada una que aplique, el comportamiento esperado; si no está definido, pregunta.
6. **Alcance:** dentro / **fuera** (obligatorio, contra el scope creep) y módulos afectados.

### Paso 4 — Preguntar al usuario (bucle bloqueante, en tandas)

- Agrupa las preguntas por dimensión y numéralas. Con elecciones acotadas, usa `AskUserQuestion` si está disponible; si no, un bloque de preguntas numeradas con tu recomendación en cada una.
- **STOP y espera.** Por cada respuesta, actualiza el análisis; si abre preguntas nuevas, añádelas.
- Repite hasta **cerrar todas las preguntas posibles**. En el `feature.md` solo quedan como «Preguntas abiertas» las que el usuario **difiere explícitamente**.
- Ningún hueco crítico (un actor, una RN o un invariante sin definir) se queda como suposición silenciosa.

### Paso 5 — Numerar la feature (determinista)

```bash
node scripts/next-id.mjs feat      # imprime p. ej. FEAT-04
```

El script recorre `features/` y todas sus subcarpetas (`completadas/`, `descartadas/`). **Guardarraíl:** justo antes de escribir, ejecútalo otra vez y comprueba que no existe ninguna carpeta `FEAT-{NN}-*` en ninguna subcarpeta; si cambió, usa el nuevo número. Nunca reutilices ni renumeres. Carpeta y frontmatter dicen el mismo número: `FEAT-{NN}-slug/` y `id: FEAT-{NN}`.

### Paso 6 — Escribir `docs/02_discovery/features/FEAT-{NN}-slug/feature.md`

Desde `docs/_templates/FEATURE.template.md`. Rellena: Qué, Por qué (enlaza la idea), Alcance dentro/fuera, Actores, Casos de uso (**tabla** UC | título | módulo | flujos | fichero, citando cada UC por su ID y su ruta desde la raíz en código, sin enlace relativo: la feature se moverá a `completadas/`), Reglas de negocio, Invariantes, Datos clave, Casos límite, Módulos afectados, Dependencias y riesgos, Criterios de aceptación, Preguntas abiertas y Handoff. **Cita la fuente** de cada elemento (idea, respuesta del usuario, `DEC-NN`, `docs/RGPD.md`).

Si la feature trata datos personales, añade los invariantes de minimización, retención y supresión que salgan de `docs/RGPD.md`, y que lo revisará el agente `datos-personales-auditor` en `/reviewer`.

### Paso 6b — Escribir los casos de uso en el catálogo del módulo

Los UC son artefacto propio y viven en el módulo, no en la feature (la sobreviven). Por cada UC nuevo:
1. `node scripts/next-id.mjs uc` → `UC-NN` (numeración global; vuelve a ejecutarlo justo antes de escribir).
2. Crea `docs/05_modules/{módulo}/casos-de-uso/UC-NN-slug.md` desde `docs/_templates/UC.template.md`: `estado: borrador`, `feature: FEAT-{NN}`, `hus: []`, flujos **P**, **A1…** y **E1…** con su paso de origen, reglas de negocio aplicables, postcondiciones y datos personales. Fichero y frontmatter con el mismo número.
3. Añade su fila al índice `docs/05_modules/{módulo}/casos-de-uso/README.md` (UC | Título | Actor | Estado | Feature | HU).

Si la feature modifica un UC existente, edítalo, actualiza `feature:` y dilo en el resumen del gate.

### Paso 7 — Cerrar el lazo con la idea

- Idea origen: `estado: aceptada` + `feature: FEAT-{NN}` en el frontmatter y, en «Decisión», `Promovida a FEAT-{NN} el AAAA-MM-DD`.
- Si tras el análisis se decide no construirla: idea `estado: descartada` + motivo; no se crea feature.

### Paso 8 — Gate de validación humana (OBLIGATORIO)

Resumen corto: FEAT-NN y título, número de UC / RN / invariantes, alcance en una línea, preguntas que queden y la ruta del `feature.md`. Pregunta:

> «Feature shaped en `{ruta}`. Revísala y responde **`aprobado`**, **ajustes en texto** o **`abortar`**.»

STOP y espera. Aplica los ajustes y repite el gate si hace falta.

### Paso 8b — Commit en `main`

Tras la validación, un commit en `main` con todo lo que tocó el shaping, nombrando ficheros (`feature.md`, los
`UC-NN-slug.md` creados o editados, los índices `casos-de-uso/README.md` y la idea actualizada):
`git commit -m "docs(discovery): shape FEAT-NN {slug}"`. Nunca `git add -A`. Sin push.

### Paso 9 — Siguiente paso

*«Cuando se priorice, el `product-owner` la parte en HU y `/crear-sprint` las mete en un sprint. Cada HU vive en `docs/03_delivery/hu/HU-NN-slug/` y arranca con `/prd-writer`.»*

## Reglas duras

- **Cero asunciones.** Toda laguna → pregunta. Nunca inventes reglas, umbrales, roles ni comportamientos de casos límite.
- **El `FEAT-NN` y cada `UC-NN` salen de `scripts/next-id.mjs`** y se comprueban justo antes de escribir.
- **Un fichero por UC en el catálogo del módulo**, con flujos P/A/E identificados: el PRD los convierte en criterios de aceptación y la revisión exige un test por flujo.
- **Cierra todas las preguntas posibles**; solo quedan las que el usuario difiere.
- **«Fuera de alcance» obligatorio.**
- **Cada UC, RN e invariante con fuente**: trazabilidad idea → respuesta → feature.
- **No diseñes el CÓMO**: sin tablas SQL, sin endpoints concretos, sin elegir librerías. Eso es `/tech-design`.
- **Subagentes para escanear código**, nunca el código entero en el contexto principal.
- Si la feature crece demasiado (muchos UC o RN inconexos), propón partirla en varias.
- **Datos inventados** en los ejemplos.

## Cuándo NO eres tú

- Registrar o priorizar ideas, planificar sprints → `product-owner`, `/anadir-idea`, `/crear-sprint`.
- PRD de una HU → `/prd-writer`. Diseño técnico → `/tech-design`.
