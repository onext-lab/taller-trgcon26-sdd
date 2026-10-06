---
name: tech-design
description: Diseño técnico de una HU con su PRD listo. Lanza backend-architect y/o frontend-architect (en paralelo si es fullstack) y valida que cada TECHNICAL_DOC tenga sus secciones obligatorias.
argument-hint: HU-NN [backend|frontend|fullstack]
---

# tech-design

Paso 2 del delivery de una HU (ver `docs/WORKFLOW.md`). **Orquesta, no diseña:** el diseño lo escriben los agentes `backend-architect` y `frontend-architect`. Tú compruebas la entrada, los lanzas y validas la salida.

## Uso

```
/tech-design HU-NN [scope]
```

`scope` opcional (`backend`, `frontend` o `fullstack`); si no se pasa, se toma del PRD.

## Pre-flight (bloquea)

1. Existe `docs/03_delivery/hu/HU-NN-slug/specs/PRD.md`. Si no: «Ejecuta `/prd-writer HU-NN` primero.» STOP.
2. **Sin Open Questions:** si alguna OQ tiene `Decisión: PENDIENTE`: «El PRD tiene OQ abiertas; resuélvelas con `/prd-writer HU-NN`.» STOP.
3. PRD en `Ready`. Si está en `Draft`, avisa y pregunta si se sigue igualmente.

## Workflow

### Paso 1 — Scope

Lee `Scope:` del PRD. Si el usuario pasó otro, pregunta cuál vale.

### Paso 2 — Carpeta destino

`docs/03_delivery/hu/HU-NN-slug/plans/` (créala si no existe).

### Paso 3 — Lanzar los arquitectos

| Scope | Agentes | Salida |
|---|---|---|
| `backend` | `backend-architect` | `plans/TECHNICAL_DOC.md` |
| `frontend` | `frontend-architect` | `plans/TECHNICAL_DOC.md` |
| `fullstack` | los dos **en paralelo**: un solo mensaje con dos llamadas a `Agent` | `plans/TECHNICAL_DOC-backend.md` y `plans/TECHNICAL_DOC-frontend.md` |

No se lanza ningún otro agente de diseño. Prompt para cada uno:

```
Diseña el {backend|frontend} de la HU-NN.

Entradas:
- PRD: docs/03_delivery/hu/HU-NN-slug/specs/PRD.md
- HU y feature: docs/03_delivery/hu/HU-NN-slug/hu.md y docs/02_discovery/features/FEAT-NN-slug/feature.md
- Módulo: resuélvelo con docs/_modules.md y lee docs/05_modules/{módulo}/technical.md y functional.md (si existen)
- Decisiones: docs/07_architecture_principles/DECISIONS.md · Gates: docs/07_architecture_principles/QUALITY-GATES.md
- Datos personales: docs/RGPD.md

Salida: {ruta del cuadro}, con la estructura de docs/_templates/TECHNICAL_DOC.template.md.
En fullstack, el contrato de API (rutas, JSON Schema y errores) lo fija el backend; el frontend lo consume tal cual
y lo cita. Si el PRD pide algo que choca con una decisión vigente, ponlo en "Open Decisions"; no diseñes alrededor.
```

### Paso 4 — Validar la salida (gate de secciones obligatorias)

1. Comprueba que los ficheros existen donde dicen.
2. Lee cada TECHNICAL_DOC y verifica estas secciones (encabezado `##`, sin «TBD» ni placeholders):

| # | Sección | Contenido mínimo |
|---|---|---|
| 1 | `## Threat modeling` | STRIDE básico: amenaza × mitigación × riesgo residual |
| 2 | `## Datos personales` | Qué datos de candidatos se leen o escriben, finalidad, retención y qué no sale en logs, errores ni respuestas (`docs/RGPD.md`); o «No toca datos personales» |
| 3 | `## Contrato de API` (backend) o `## Pantallas y estados` (frontend) | Rutas, JSON Schema de entrada y salida, códigos y envelope de error; o pantallas con sus estados de carga, vacío y error |
| 4 | `## Migración de datos` | Fichero `apps/api/src/db/migrations/NNN-descripcion.sql` y su efecto sobre datos existentes; o «N/A: no hay migración» |
| 5 | `## Diagrama de secuencia` | Al menos uno por RF Must: camino feliz y error principal (ASCII o mermaid) |
| 6 | `## Error paths` | Tabla edge case del PRD × estrategia (validación 400, conflicto 409, transacción con rollback, reintento idempotente, mensaje en la UI…). **Todos** los edge cases del PRD deben aparecer |
| 7 | `## Impacto en decisiones` | `DEC-NN` que respeta o tensiona; si hace falta una decisión nueva, se propone como `DEC-NN` en Open Decisions |
| 8 | `## Estrategia de tests` | Qué se prueba con Vitest (`fastify.inject`, Testing Library) y qué con Playwright, por RF |
| 9 | `## Open Decisions` | Presente aunque diga «No hay» |

3. Por cada sección que falte o esté vacía: «Falta `## {sección}` en `{fichero}`.» Devuélvelo al arquitecto que lo escribió, pidiéndole que la añada sin tocar el resto. Repite hasta completar.
4. **Error paths (gate fuerte):** cada edge case de la sección «Edge cases» del PRD aparece en la tabla con su estrategia. Si falta uno, vuelve al arquitecto.

### Paso 5 — Open Decisions

Si hay alguna con `Decisión: PENDIENTE`: lístalas en una tabla numerada con el doc que las origina y **STOP**. Con las respuestas, **no edites el doc tú**: pásaselas al arquitecto que lo escribió para que las mueva a «Decisiones de diseño». Repite hasta que no quede ninguna.

### Paso 6 — Validación humana (obligatoria)

Resume: docs generados (rutas), decisiones de diseño (`DD-NN`), ficheros y módulos afectados, riesgos. Y pregunta:

> «Diseño en `{rutas}`. **Léelo entero**: `/task-planner` lo parte en tareas y desviarse después es caro. Responde `aprobado`, los ajustes concretos o `abortar`.»

**STOP.** Ajustes → al arquitecto correspondiente, con el texto literal del usuario y la instrucción de no reescribir lo que no se menciona; después, repite el gate.

### Paso 7 — Cierre

Resumen (docs, decisiones, riesgos) y siguiente paso: «Ejecuta `/task-planner HU-NN`.»

## Reglas

- Nunca diseñes ni edites un TECHNICAL_DOC tú: delega en el arquitecto que lo escribió.
- Paralelo real en fullstack: un solo mensaje con las dos llamadas.
- No avances con Open Decisions pendientes ni con secciones obligatorias vacías.
- Si el PRD cambia después del diseño, `/task-planner` lo detectará: no relances tú el diseño.

## Cuándo no eres tú

- PRD: `/prd-writer`. Tareas: `/task-planner`. Implementación: `/implementar-hu`. Revisión: `/reviewer`.
