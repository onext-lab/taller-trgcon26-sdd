---
name: reviewer
description: Revisión final de una HU: auditores en paralelo, contraste con DECISIONS.md, tabla criterio → test e integración ejecutada. Escribe review/REVIEW.md con VERDICT; si aprueba, indica el merge local.
argument-hint: HU-NN
---

# reviewer

Paso 5 del delivery de una HU (ver `docs/WORKFLOW.md`). Audita la implementación de la rama `hu/HU-NN-slug` contra:

1. El **TECHNICAL_DOC** (vara técnica: cada decisión `DD-NN` se implementó como decía).
2. El **PRD** y `hu.md` (vara funcional: cada criterio de aceptación y cada edge case tienen su test).
3. Las decisiones vigentes de `docs/07_architecture_principles/DECISIONS.md` (`DEC-NN`).
4. Los gates de `docs/07_architecture_principles/QUALITY-GATES.md`.

Veredicto: `Aprobado`, `Aprobado con observaciones` o `Requiere cambios`. **Por defecto, `Requiere cambios`** hasta que la evidencia diga lo contrario.

## Uso

```
/reviewer HU-NN
```

## Pre-flight (bloquea)

1. Existen `specs/PRD.md` (`Ready`) y `plans/TECHNICAL_DOC*.md` sin Open Decisions. Si falta algo: «Ejecuta `/prd-writer` o `/tech-design` primero.» STOP.
2. Todas las `tasks/TASK-NN.md` en `Completada`. Si hay pendientes o bloqueadas, lístalas y pregunta si se revisa igualmente.
3. Estás en `hu/HU-NN-slug` y `git status` está limpio.
4. **Techo de rondas:** si existe `review/REVIEW.md`, renómbralo a `review/REVIEW-ronda-{N}.md` (N = ronda anterior) y cuenta cuántas rondas previas acabaron en `VERDICT: Requiere cambios`. **Si ya hay 2**, no hagas una tercera ronda automática: para y escala a la persona con el resumen de los dos REVIEW (qué se pidió, qué sigue abierto y tu propuesta: partir la HU, cambiar el diseño o aceptar con observaciones).
5. Imprime qué auditores vas a lanzar y sobre qué ficheros.

## Workflow

### Paso 1 — Cargar specs y diff

- `specs/PRD.md`, `plans/TECHNICAL_DOC*.md`, `hu.md`, todas las tareas y sus briefs (`tasks/TASK-NN-BRIEF.md`, con la integración que pegó `/implementar-hu`).
- La doc del módulo (vía `docs/_modules.md`), `DECISIONS.md`, `QUALITY-GATES.md`, `docs/RGPD.md`.
- Plantilla: `docs/_templates/REVIEW.template.md`.
- Ficheros tocados: `git diff --name-only main...hu/HU-NN-slug`.

### Paso 2 — Auditores en paralelo

Un **solo mensaje** con tres llamadas a `Agent` (paralelo real), cada una con la lista de ficheros del diff y las rutas del PRD y del TECHNICAL_DOC:

| Auditor | Qué mira |
|---|---|
| `security-auditor` | OWASP web: validación de entrada, inyección SQL, XSS, errores que filtran detalles, cabeceras y CORS, secretos, dependencias nuevas |
| `datos-personales-auditor` | Minimización, base jurídica y consentimiento, retención, supresión y anonimización, datos personales en logs, errores y respuestas (`docs/RGPD.md`) |
| `doc-code-drift-checker` | Las rutas citadas en el PRD, el TECHNICAL_DOC, las tareas, `docs/` y `.claude/` existen; la doc del módulo describe lo que hay |

Pídeles el informe **en su respuesta final** (son de solo lectura: no pueden escribir ficheros), con hallazgos `fichero:línea` y severidad (crítico, alto, medio, bajo), y de 12 000 caracteres como máximo. Si un informe no llega o llega cortado, pídeselo de nuevo por `SendMessage` (solo la parte que falta) antes de declarar esa dimensión «no concluida». Nunca la des por limpia sin informe.

### Paso 3 — Decisiones vigentes

Para cada `DEC-NN` que toque la HU (los que cita el PRD en «Decisiones aplicables» y los que detectes en el diff), comprueba si el código la cumple. Ejemplos: `DEC-01` (Fastify, `node:sqlite`, React + Vite: ninguna librería nueva que lo sustituya), `DEC-03` (ningún `.db` en git), `DEC-04` (sin login: ningún endpoint pide credenciales ni hay roles nuevos). Una dependencia nueva sin entrada en `DECISIONS.md` es un hallazgo.

### Paso 4 — Tabla criterio → test

Para **cada criterio de aceptación** de `hu.md` y **cada edge case** del PRD, busca el test que lo ejercita (`apps/api/test/`, `apps/web/test/`, `e2e/`, por nombre de `describe`/`it` o por un comentario `// covers RF-NN`):

| Origen | Criterio o edge case | Categoría | Test (`fichero:línea "nombre"`) | Estado |
|---|---|---|---|---|
| CA-1 | El reclutador crea una oferta en borrador | — | `<fichero>.test.ts:12 "crea en draft"` | Cubierto |
| RF-02 Must | Doble clic en «Publicar» | 7 idempotencia | — | **Huérfano (crítico)** |

Un criterio de aceptación o un edge case de RF Must **sin test** es crítico. Si es de RF Should o Could, es una observación.

### Paso 5 — Gates de QUALITY-GATES

Recorre los gates por artefacto y los umbrales de `QUALITY-GATES.md` y deja una fila por gate: umbral, medido, `cumple | no cumple | N/A`.

### Paso 6 — Integración (la ejecutas tú: los auditores solo leen)

```bash
npm run typecheck
npm run lint
npm test
npm run e2e
npm run check:harness
```

Pega la salida real (las últimas líneas de cada uno si es larga). Cualquier rojo es crítico.

### Paso 7 — Escribir `review/REVIEW.md`

Desde la plantilla, con estas secciones:

1. **Resumen ejecutivo:** un párrafo con el veredicto y sus motivos.
2. **Veredicto** y, si es `Requiere cambios`, los gates críticos que fallan.
3. **Decisiones aplicables:** tabla `DEC-NN` × aplica porque × cumple (con `fichero:línea` si no).
4. **Hallazgos por auditor:** una subsección por auditor; los no concluidos, marcados así.
5. **Criterio → test** (paso 4).
6. **Gates de QUALITY-GATES** (paso 5).
7. **Integración:** comandos y salida real (paso 6).
8. **Limitaciones:** lo que no se ha podido comprobar (p. ej. rendimiento real, Windows).
9. **Acciones requeridas:** lista numerada y concreta si hay que cambiar algo.
10. Pie: `Ronda: N · «Requiere cambios» previos: K`.

La **última línea** es exactamente una de estas, sin formato markdown:

```
VERDICT: Aprobado
VERDICT: Aprobado con observaciones
VERDICT: Requiere cambios
```

## Veredicto

**`Requiere cambios`** si falla cualquier gate crítico:
- Integración en rojo (typecheck, lint, tests, e2e o `check:harness`).
- Un criterio de aceptación o un edge case de RF Must sin test.
- Un hallazgo crítico o alto nuevo de `security-auditor` (inyección SQL, XSS, error con traza o SQL en la respuesta, secreto en el código).
- Un hallazgo crítico o alto de `datos-personales-auditor` (dato personal en logs o errores, respuesta con más datos de los necesarios, supresión que deja datos recuperables, retención ignorada).
- Una decisión `DEC-NN` incumplida o una dependencia nueva sin decisión.
- Una decisión de diseño `DD-NN` implementada de otra forma sin justificar.
- Una ruta citada en docs o en `.claude/` que no existe.

**`Aprobado con observaciones`** si solo fallan gates medios o bajos (tamaño de fichero o función, edge cases de RF Should o Could sin test, nombres, comentarios).

**`Aprobado`** si todo está en verde.

Cada hallazgo lleva `fichero:línea`; sin ruta concreta no es accionable y se descarta.

## Cierre

1. **`Aprobado`** (o **`Aprobado con observaciones`** con las observaciones curadas o aceptadas de forma explícita por la persona), con la integración del paso 6 en verde:
   - Añade la entrada a `docs/03_delivery/hu/HU-NN-slug/CHANGELOG.md` desde `docs/_templates/CHANGELOG.template.md` (qué se implementó, endpoints y pantallas, migraciones, veredicto).
   - Commit de la review: `git add -- docs/03_delivery/hu/HU-NN-slug/review docs/03_delivery/hu/HU-NN-slug/CHANGELOG.md` y `git commit -m "docs(review): HU-NN approved [HU-NN]"`.
   - **Merge local a `main`** (sin push: no hay remoto):
     ```bash
     git switch main
     git merge --no-ff hu/HU-NN-slug -m "Merge HU-NN: <título>"
     npm test && npm run typecheck   # main sigue en verde tras el merge
     ```
   - Siguiente paso: «Ejecuta `/module-sync HU-NN` para actualizar la doc del módulo y `docs/MVP-STATUS.md`.»
2. **`Requiere cambios`:** no hay merge. Lista las acciones y el siguiente paso: arreglar con `/implementar-hu HU-NN TASK-NN` (o una tarea nueva de `/task-planner`) y volver a ejecutar `/reviewer HU-NN`. Recuerda cuántas rondas quedan antes del techo (2).

## Reglas duras

- Nunca des el código por bueno sin leerlo; los auditores y tú leéis ficheros reales.
- Auditores en paralelo, en un solo mensaje.
- La integración se ejecuta aquí siempre, aunque `/implementar-hu` ya la pegara (R3 de `docs/IMPLEMENTATION-RULE.md`).
- No implementes arreglos durante la review: detectas y describes; arregla `/implementar-hu`.
- Techo de 2 «Requiere cambios» por HU; a la tercera, se para y se escala.
- Siempre la línea `VERDICT:` al final de `REVIEW.md`.
- Nunca push, ni remotos, ni `git add -A`.

## Cuándo no eres tú

- Implementar arreglos: `/implementar-hu`. Rediseñar: `/tech-design`. Replanificar: `/task-planner`.
- Actualizar la doc del módulo: `/module-sync`. Auditar el sprint entero: `/audit-sprint`.
