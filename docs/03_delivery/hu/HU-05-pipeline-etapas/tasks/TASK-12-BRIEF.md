# Brief de implementación — HU-05 · TASK-12

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-05-pipeline-etapas/tasks/TASK-12.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-05-pipeline-etapas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-05 · CA: CA-02, CA-22 (acciones), CA-40 · EC: EC-05 (web), EC-06 (web), EC-31, EC-32, EC-33 · RNF: RNF-08
    (nombres distintos, foco al aviso) · DD-01, DD-02, DD-04, DD-05, DD-06
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pipeline (tarjeta, acciones por etapa, `HireDialog`, resultado de avanzar
    y rechazar), DD-01, DD-02, DD-04, DD-05, DD-06, § Checklist W4
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-05-pipeline-etapas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 8155a75 feat(api): advance an application one stage (POST /api/applications/:id/advance) [HU-05 TASK-03]; b9126eb feat(web): card and duplicate links to the application; View pipeline on closed jobs [HU-05 TASK-11]; 59bb095 feat(web): stage change client, detail types and reject form rules [HU-05 TASK-09]; 332e012 feat(api): stage reads, guarded stage update and job summary port [HU-05 TASK-02]; 89e4364 refactor(api): applications use cases as module functions; pure stage transitions [HU-05 TASK-01]; f147bb3 docs(HU-05): tasks and roadmap; PRD errata RV-23; 7e75f59 docs(HU-05): technical design; PRD v1.2 (id pattern, error order); 93f4f43 fix(api): recursive triggers on, so REPLACE cannot rewrite the stage history [T-05]; 92b4de5 docs(HU-05): PRD; 4de1c7f docs(HU-06): new HU for closing a job with active applications; UC-19 and UC-04 A1 move out of HU-05.
- **Dependencias de la task:**
  - **Depende de:** TASK-09, TASK-11 (`PipelineBoard.tsx` y `PipelineScreen.test.tsx` ya adaptados), TASK-03 (endpoint de
    avanzar)
  - **Bloquea:** TASK-13
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** las `DEC-NN` que cita la task y, siempre, DEC-11 (Ajv estricto, `details` sin el valor recibido),
      DEC-01 (envelope), DEC-07 (códigos), DEC-09 (fechas UTC y reloj inyectado) y DEC-06 (transacciones), en
      `docs/07_architecture_principles/DECISIONS.md`.
- [ ] **Envelope de error** `{ error: { code, message, details? } }` con códigos estables; nunca *stack traces*.
      Lo construye solo `apps/api/src/http/error-handler.ts`: los servicios lanzan `AppError` (`apps/api/src/errors.ts`). Descartado: la task no toca la API.
- [ ] **Validación con el JSON Schema de Fastify** en cada ruta (body, params, querystring y respuesta), con
      `idParamsSchema` y `trimTextFields` de `apps/api/src/http/validation.ts`. Descartado: la task no toca la API.
- [ ] **SQLite parametrizado**: siempre `db.prepare(…).run/get/all(params)`; nunca SQL concatenado con entrada. Descartado: la task no toca la API.
- [ ] **Migraciones**: un cambio de esquema es un fichero nuevo `apps/api/src/db/migrations/NNN-descripcion.sql`;
      nunca se edita uno comiteado. Descartado: la task no cambia el esquema.
- [x] **Datos personales** (`docs/RGPD.md`): minimización en respuestas, nada en logs ni errores, datos inventados en
      seed y tests.
- [x] **Accesibilidad** (web): roles y nombres accesibles, `label` en cada control, estados de carga, vacío y
      error; `docs/06_design_principles/README.md`.
- [x] **Caracteres crudos**: nunca NUL ni U+2028/U+2029 en el código; usa secuencias de escape (un hook lo bloquea).
- [x] **Reuso obligatorio**: lo de TASK-09/11: `advanceApplication`, `nextStage`, `classifyStageError`, `ConfirmDialog`, `usePipelineFeedback`, `useResource.reload`, `Notice` con ref; `expectFocusOn`. Un nombre accesible único por botón (sufijo oculto con `.visually-hidden`).
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. En paralelo, TASK-04 trabaja en `apps/api`: no lo toques.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- features/applications/PipelineScreen.advance features/applications/PipelineScreen.hire`
- [x] `npm test -w @ats/web -- features/applications` en verde (los tests de HU-04 del pipeline siguen en verde sin
- [x] `npm run typecheck`.
- [x] `npx eslint` con los ficheros de la tabla «Archivos afectados».
- [x] `npx playwright test e2e/applications.spec.ts` en verde (la pantalla del pipeline la cubre ese spec).
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una afirmación sin
> pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo (un gotcha, un comando, una convención), añádelo al final de tu
> informe en un bloque `APRENDIZAJE`; la sesión lo llevará a la doc del módulo o a `docs/ARCHITECTURE.md`.

## 7. Resultado de la integración
> La rellena `/implementar-hu` con la salida real de los comandos que ejecuta la sesión. Ciclo de arreglo: 0/2.

```
$ npm test -w apps/api -- applications/reject
 Test Files  2 passed (2)
      Tests  15 passed (15)
exit=0
$ npm test -w apps/web -- features/applications/PipelineScreen.advance features/applications/PipelineScreen.hire
 Test Files  2 passed (2)
      Tests  13 passed (13)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  65 passed (65)
      Tests  1019 passed (1019)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  54 passed (54)
      Tests  704 passed (704)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/modules/applications/schemas.ts apps/api/src/modules/applications/service.ts apps/api/src/modules/applications/routes.ts apps/api/test/applications/reject.test.ts apps/api/test/applications/reject-note.test.ts apps/web/src/features/applications/use-stage-change.ts apps/web/src/features/applications/use-stage-actions.ts apps/web/src/features/applications/StageDialogs.tsx apps/web/src/features/applications/PipelineBoard.tsx apps/web/src/features/applications/PipelineScreen.tsx apps/web/test/features/applications/PipelineScreen.advance.test.tsx apps/web/test/features/applications/PipelineScreen.hire.test.tsx
exit=0
$ wc -l (ficheros tocados)
     174 apps/api/src/modules/applications/schemas.ts
     177 apps/web/src/features/applications/PipelineScreen.tsx
     192 apps/web/test/features/applications/PipelineScreen.advance.test.tsx
     200 apps/api/src/modules/applications/service.ts
     300 apps/api/test/applications/reject.test.ts
    1633 total
$ npx playwright test e2e/applications.spec.ts e2e/jobs-lifecycle.spec.ts
  13 passed (9.5s)
exit=0
INTEGRACION rc=0
```

- **Resultado:** en verde; e2e 13 passed. `PipelineScreen.hire.test.tsx` (CA-40 Escape) espera el cierre del diálogo con `waitFor`: 20/20 pasadas y la suite con las semillas 2024, 11, 12, 42 y 5 en verde (704/704).
- **Commit:** el de esta tarea (`[HU-05 TASK-12]`)

