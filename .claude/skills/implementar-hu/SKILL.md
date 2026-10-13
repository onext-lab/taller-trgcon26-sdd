---
name: implementar-hu
description: Implementa una HU tarea a tarea: rellena el brief, lanza un builder, ejecuta la integración y pega su salida real, y hace un commit por tarea en hu/HU-NN-slug. Máximo 2 ciclos de arreglo.
argument-hint: HU-NN [TASK-NN]
---

# implementar-hu

Paso 4 del delivery de una HU (ver `docs/WORKFLOW.md`). Aplica `docs/IMPLEMENTATION-RULE.md` (R1-R4) a cada tarea de `tasks/`. **Tú no escribes el código:** lo escribe un builder (subagente) con un brief completo. Tú preparas el brief, ejecutas la integración, decides si vale y haces el commit.

## Uso

```
/implementar-hu HU-NN            # todas las tareas pendientes, en el orden del ROADMAP
/implementar-hu HU-NN TASK-NN    # solo esa tarea
```

## Pre-flight (bloquea)

1. Existen `docs/03_delivery/hu/HU-NN-slug/tasks/ROADMAP.md` y las `TASK-NN.md`, aprobadas en `/task-planner`. Si no: «Ejecuta `/task-planner HU-NN`.» STOP.
2. `git status` limpio fuera de la carpeta de la HU. Si hay cambios ajenos, para y pregunta: no se mezclan en los commits de la HU.
3. Rama de la HU: si existe `hu/HU-NN-slug`, `git switch hu/HU-NN-slug`; si no, `git switch -c hu/HU-NN-slug main`. Nunca se trabaja en `main`.
4. Base en verde: `npm run typecheck` y `npm test` pasan antes de empezar. Si no, para: hay que saber qué estaba roto antes de tocar nada.

## Bucle por tarea

Sigue el orden del ROADMAP: no empieces una tarea cuyas dependencias no estén `Completada`.

### 1. Brief (R1)

Copia `docs/_templates/BRIEF-IMPLEMENTACION.template.md` a `docs/03_delivery/hu/HU-NN-slug/tasks/TASK-NN-BRIEF.md` y **rellénalo entero**, marcando también lo que se descarta y por qué:
- **Qué hacer:** la tarea es el contrato (`tasks/TASK-NN.md`); su capa y el builder que la implementa (paso 2); secciones del TECHNICAL_DOC por ancla, no el documento entero; rama `hu/HU-NN-slug` en «la raíz del repo» (la ruta absoluta va en el encargo al builder, nunca en el brief: lleva el nombre de usuario de la máquina y el brief se versiona); commits previos relevantes; «lee solo lo que la tarea nombra».
- **Invariantes que aplican**, con su fichero: decisiones `DEC-NN` de `docs/07_architecture_principles/DECISIONS.md`; envelope de error y validación con JSON Schema de Fastify; acceso a SQLite solo desde el módulo, con consultas parametrizadas; datos personales según `docs/RGPD.md` (nada en logs ni en errores); sin NUL ni separadores Unicode crudos (los bloquea un hook).
- **Prohibiciones:** no arreglar nada fuera de alcance (se reporta); no tocar ficheros fuera de la tabla «Archivos afectados» sin decirlo; no instalar dependencias que no estén en el diseño; **no hacer commit** (lo haces tú); nada de `git add -A`, `git stash`, push ni remotos.
- **Verificación que debe pegar:** salida real de los tests acotados, del typecheck y del lint de sus ficheros, y los criterios de done uno a uno con su evidencia.
- **Permiso para pararse:** si falta algo o el brief contradice la tarea o el diseño, lo dice y devuelve lo que tenga.

### 2. Builder

El builder se elige por la **capa** de la tarea (campo `Capa:` de la task, que el brief copia): `api` → agente `api-builder`; `web` → agente `web-builder`. Una `[e2e]` o una `[adversarial]` que toca las dos capas va a la de su capa principal (la del fichero de producción o de test principal), y una `[e2e]` de Playwright, a `web-builder`. Si la task no declara `Capa:`, dedúcela de «Archivos afectados» (`apps/api/` → `api`; `apps/web/` o `e2e/` → `web`) y **dilo** en el brief y en tu respuesta.

Lanza ese subagente con el prompt: «Implementa la TASK-NN de la HU-NN siguiendo el brief `docs/03_delivery/hu/HU-NN-slug/tasks/TASK-NN-BRIEF.md`. Lee solo lo que el brief nombra. No hagas commit.» No fijes `model`: hereda el de la sesión.

Por defecto, **una tarea cada vez**. Solo puedes lanzar tareas en paralelo (como mucho 4) si no comparten ni un fichero y ninguna depende de otra; aun así, la integración y el commit van de una en una.

### 3. Integración (R2): la ejecutas tú y pegas la salida real

Con los ficheros que el builder dice haber tocado (compruébalos con `git status --short`):

```bash
npm test -w apps/api -- <ficheros de test tocados>   # y/o -w apps/web
npm run typecheck
npx eslint <ficheros tocados>
npx playwright test <spec>      # solo si la tarea es [e2e] o toca un recorrido existente
npm run check:harness           # solo si la tarea toca docs/ o .claude/
```

- Comprueba que **el número de ficheros de test ejecutados cuadra** con los que pasaste: una ruta mal escrita ejecuta menos y sale en verde.
- Repasa los criterios de done de la tarea uno a uno.
- Pega la salida real (no un resumen) en la sección «Resultado de la integración» del brief y en tu respuesta.

### 4. Si algo falla: ciclo de arreglo (techo de 2)

Devuelve al builder la evidencia: comando para reproducirlo, salida real y lo que se esperaba. **No se toca el test para que pase.** Repite la integración.

**Como mucho 2 ciclos de arreglo por tarea.** Si tras el segundo sigue fallando, **para**: marca la tarea `Estado: Bloqueada`, anota en el brief qué falla y qué se intentó, y escala a la persona con un resumen corto (qué falla, evidencia, tu propuesta). No pases a otra tarea que dependa de ella.

### 5. Commit (uno por tarea)

Con la integración en verde:
1. Marca `Estado: Completada` en `tasks/TASK-NN.md`.
2. Commit nombrando ficheros, nunca `git add -A` ni `git add .`:

```bash
git add -- <ficheros de la tarea> docs/03_delivery/hu/HU-NN-slug/tasks/TASK-NN.md docs/03_delivery/hu/HU-NN-slug/tasks/TASK-NN-BRIEF.md
git commit -m "feat(api): create job openings endpoint [HU-NN TASK-NN]"
```

Mensaje en inglés, conventional, con `[HU-NN TASK-NN]`. El hook `typecheck-precommit` bloquea el commit si el typecheck falla: en ese caso es un fallo de integración (vuelve al paso 4). Sin push: el hook `no-externo` lo bloquea.

## Al acabar todas las tareas

1. Integración completa de la rama, con la salida pegada:
   ```bash
   npm run typecheck && npm run lint && npm test && npm run e2e
   ```
2. Resumen: tareas completadas y bloqueadas, commits (hash y mensaje), ciclos de arreglo usados por tarea y aprendizajes que deban ir a la doc del módulo.
3. Siguiente paso: «Ejecuta `/reviewer HU-NN`. La revisión vuelve a ejecutar la integración: los auditores solo leen.»

## Reglas duras

- Sin brief completo no se lanza el builder (R1).
- La integración se ejecuta siempre y se pega su salida real (R2); la review no la sustituye (R3).
- Un commit por tarea, nombrando ficheros; nunca `git add -A`, `git stash`, push ni `rm -rf`.
- Techo de 2 ciclos de arreglo por tarea; al tercero, se para y se escala.
- Nada fuera del alcance de la tarea: lo que se descubra se apunta como observación o idea (`/anadir-idea`).
- Datos inventados en tests y seed; nunca datos de personas reales.

## Cuándo no eres tú

- Partir en tareas: `/task-planner`. Revisar la HU: `/reviewer`. Mezclar en `main`: lo indica `/reviewer` con la review aprobada.
