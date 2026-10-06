---
name: task-planner
description: Parte el TECHNICAL_DOC aprobado de una HU en tareas atómicas (tasks/TASK-NN.md) y su ROADMAP.md: rebanadas verticales de menos de 4 h, con ficheros concretos y tests adversariales.
argument-hint: HU-NN [backend|frontend]
---

# task-planner

Paso 3 del delivery de una HU (ver `docs/WORKFLOW.md`). Convierte el diseño en tareas que un builder puede implementar sin abrir cinco documentos.

**Fuente de verdad:** el TECHNICAL_DOC (`plans/TECHNICAL_DOC.md`, o `-backend.md` y `-frontend.md` en fullstack), **no el PRD**. El PRD solo sirve para comprobar que todos los RF quedan cubiertos y para saber qué RF son Must.

## Uso

```
/task-planner HU-NN [scope]
```

Sin `scope`, parte todos los TECHNICAL_DOC de la HU.

## Pre-flight (bloquea)

1. `specs/PRD.md` en `Ready` y sin Open Questions. Si no: «Ejecuta `/prd-writer HU-NN`.» STOP.
2. Existe el TECHNICAL_DOC del scope en `docs/03_delivery/hu/HU-NN-slug/plans/`. Si no: «Ejecuta `/tech-design HU-NN`.» STOP.
3. El TECHNICAL_DOC no tiene Open Decisions pendientes. Si las tiene: «Resuélvelas con `/tech-design HU-NN`.» STOP.
4. Estás en la rama `hu/HU-NN-slug` con el árbol limpio. Si no: `git switch hu/HU-NN-slug`.

## Workflow

### Paso 1 — Contexto

Lee el TECHNICAL_DOC, el PRD, `hu.md`, la doc del módulo (vía `docs/_modules.md`) y las plantillas `docs/_templates/TASK.template.md` y `docs/_templates/ROADMAP.template.md`.

### Paso 2 — Coherencia PRD ↔ diseño

Cada RF del PRD tiene que estar cubierto en el TECHNICAL_DOC (contrato de API, pantallas, modelo de datos). Si un RF no aparece, **avisa antes de generar tareas**: falta en el diseño.

### Paso 3 — Plantear las tareas: rebanadas verticales, no capas

Una tarea es una rebanada de funcionalidad cohesiva, no una capa técnica.

**Backend (`apps/api`):**
- 1 tarea por tabla nueva = migración `apps/api/src/db/migrations/NNN-descripcion.sql` + funciones de acceso del módulo + datos del seed si hacen falta.
- 1 tarea por endpoint = ruta Fastify + JSON Schema de entrada y salida + errores con el envelope + test con `fastify.inject`.
- La lógica compartida entre endpoints va en la primera tarea del grupo; las siguientes dependen de ella.

**Frontend (`apps/web`):**
- 1 tarea por pantalla = componentes de `apps/web/src/features/{módulo}/` + llamadas a la API + formulario y validación + test con Testing Library.
- Una acción usada desde varias pantallas (p. ej. «cambiar etapa») va en su propia tarea solo si no encaja en una.

**E2E:** 1 tarea con el recorrido de Playwright de la HU (`e2e/`), si la HU tiene pantalla.

**Tests:** van con su tarea por defecto. Solo se separan si son complejos (más de 1 h), si cruzan endpoints (e2e) o si los exige el gate 4.

### Paso 4 — Gates (bloqueantes)

1. **Número de tareas:** ideal 4-8 por HU; más de 12, revisa si estás partiendo por capas; **más de 15, bloquea**: «HU demasiado grande ({N} tareas). Propón partirla en dos por fronteras de funcionalidad.» STOP.
2. **Tamaño:** cada tarea declara `Complejidad: S | M | L` (S < 1 h, M 1-2 h, L 2-4 h). Más de 4 h: «TASK-NN supera 4 h: pártela.» Se parte por funcionalidad, no por capa, y se vuelve al gate 1.
3. **Ficheros concretos:** cada tarea tiene una tabla «Archivos afectados» con rutas del repo (existentes o marcadas `Crear`). «Investigar X» no es una tarea: «TASK-NN no lista ficheros concretos.»
4. **Adversarial por RF Must:** cada RF Must tiene al menos una tarea `[adversarial]` aparte del camino feliz, de tamaño S o M, que cubre sus edge cases del PRD por categoría de `docs/07_architecture_principles/QUALITY-GATES.md` (input inválido, boundary, fallo de dependencia, concurrencia, datos corruptos, seguridad, idempotencia). Construye la tabla `RF Must × tarea [adversarial]`. Si falta: «RF-NN (Must) sin tarea `[adversarial]`.»

Etiquetas de título combinables: `[adversarial]`, `[migration]`, `[setup]`, `[refactor]`, `[e2e]`.

### Paso 5 — Dependencias y orden

Cada tarea declara `Depende de` y `Bloquea`. Las migraciones van antes que los endpoints que las usan; una pantalla depende de la tarea backend que crea su endpoint; los tests separados dependen de su implementación. Numeración única y continua en `tasks/` (TASK-01..N); el scope va en los metadatos, no en la ruta.

### Paso 6 — Escribir los ficheros

**`docs/03_delivery/hu/HU-NN-slug/tasks/TASK-NN.md`**, una por tarea, desde la plantilla, con:
- Metadatos: HU, feature, scope, **capa**, `Estado: Pendiente`, prioridad, complejidad.
- **`Capa: api | web`**, que decide el builder de `/implementar-hu` (`api-builder` o `web-builder`). Una tarea de endpoint o
  migración es `api` y una de pantalla, `web`; una `[e2e]` o `[adversarial]` que toca las dos lleva la de su capa principal (la del fichero de producción
  o de test principal), y una `[e2e]` de Playwright, `web`.
- **Descripción autosuficiente:** qué crear o cambiar, qué patrón seguir y qué decisiones aplican, sin tener que abrir el TECHNICAL_DOC.
- **Archivos afectados** (tabla fichero × acción × descripción).
- **Implementa:** RF-NN y la sección del TECHNICAL_DOC por ancla.
- **Dependencias.**
- **Criterios de done** verificables, con sus comandos:
  - tests acotados: `npm test -w apps/api -- <patrón>` o `npm test -w apps/web -- <patrón>`;
  - `npm run typecheck` sin errores;
  - lint de los ficheros tocados: `npx eslint <ficheros>`;
  - si la tarea es `[e2e]`: `npx playwright test <spec>`.
- **Notas de implementación:** fragmentos clave del diseño y gotchas.

**`docs/03_delivery/hu/HU-NN-slug/tasks/ROADMAP.md`** desde su plantilla: resumen (tareas, estimación), fases (setup → núcleo → pantallas → e2e y adversariales), grafo de dependencias, camino crítico y riesgos heredados del diseño.

### Paso 7 — Validación humana (obligatoria)

Resume: tareas por scope y capa con su reparto S/M/L, camino crítico y riesgos. Y pregunta:

> «Tareas en `{ruta}`. **Léelas antes de implementar**: son el contrato de cada builder. Responde `aprobado`, los ajustes concretos («junta TASK-03 y TASK-04», «parte TASK-05») o `abortar`.»

**STOP.** Los ajustes los aplicas tú (son tus ficheros) y repites el gate.

### Paso 8 — Commit en la rama y cierre

En `hu/HU-NN-slug`: `git add -- docs/03_delivery/hu/HU-NN-slug/tasks/` y
`git commit -m "docs(HU-NN): tasks and roadmap"`. Sin push.

Siguiente paso: «Ejecuta `/implementar-hu HU-NN`: una tarea cada vez, con brief, builder, integración y commit.»

## Reglas duras

- Fuente de verdad: el diseño. No inventes rutas: si no están en el TECHNICAL_DOC, levanta el hueco.
- Rebanadas verticales; nada de una tarea por capa.
- Menos de 4 h por tarea y como mucho 15 por HU.
- Ficheros concretos y dependencias explícitas en cada tarea.
- Cobertura adversarial separada por cada RF Must.
- Si un RF queda sin tarea, dilo antes de cerrar; no lo escondas.

## Cuándo no eres tú

- PRD: `/prd-writer`. Diseño: `/tech-design`. Implementación: `/implementar-hu`. Revisión: `/reviewer`.
