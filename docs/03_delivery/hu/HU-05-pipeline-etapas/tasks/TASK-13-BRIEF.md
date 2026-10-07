# Brief de implementación — HU-05 · TASK-13

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-05-pipeline-etapas/tasks/TASK-13.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-05-pipeline-etapas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-06 · CA: CA-13 · EC: EC-12 (web), EC-14 (web), EC-36, EC-37, EC-38, EC-39 · RNF: RNF-08 (`label`, `legend`,
    foco al cancelar) · DD-02, DD-03, DD-06, DD-07
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § `RejectDialog`, § Validación en el cliente, § Resultado de avanzar y
    rechazar, DD-03, DD-06, DD-07, § Estrategia de tests (RF-06), § Checklist W5
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-05-pipeline-etapas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 0cd5d1f feat(web): advance and hire from the pipeline cards [HU-05 TASK-12]; b111063 feat(api): reject an application with reason and note (POST /api/applications/:id/reject) [HU-05 TASK-04]; 7947346 test(web): wait for document.title set by a passive effect [T-03]; 8155a75 feat(api): advance an application one stage (POST /api/applications/:id/advance) [HU-05 TASK-03]; b9126eb feat(web): card and duplicate links to the application; View pipeline on closed jobs [HU-05 TASK-11]; 59bb095 feat(web): stage change client, detail types and reject form rules [HU-05 TASK-09]; 332e012 feat(api): stage reads, guarded stage update and job summary port [HU-05 TASK-02]; 89e4364 refactor(api): applications use cases as module functions; pure stage transitions [HU-05 TASK-01]; f147bb3 docs(HU-05): tasks and roadmap; PRD errata RV-23; 7e75f59 docs(HU-05): technical design; PRD v1.2 (id pattern, error order); 93f4f43 fix(api): recursive triggers on, so REPLACE cannot rewrite the stage history [T-05]; 92b4de5 docs(HU-05): PRD.
- **Dependencias de la task:**
  - **Depende de:** TASK-12 (mismos ficheros: `StageDialogs.tsx`, `use-stage-actions.ts`), TASK-04 (endpoint de rechazar)
  - **Bloquea:** TASK-14, TASK-15
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
- [x] **Reuso obligatorio**: lo de TASK-09/12: `useStageChange.reject`, `useStageActions.onReject`, `validateRejectForm`, `classifyStageError`, `ConfirmDialog`, `splitValidationDetails`, `FormField`; `expectFocusOn` y `waitFor` para lo que pone un efecto pasivo (foco, `dialog.open`, `document.title`).
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. En paralelo: TASK-05 y TASK-06 trabajan en `apps/api`. No lo toques.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- features/applications/PipelineScreen.reject` en verde con **2** ficheros. En
- [x] `npm test -w @ats/web -- features/applications` en verde (sin regresiones).
- [x] `npm run typecheck`.
- [x] `npx eslint` con los ficheros de la tabla «Archivos afectados».
- [x] `npx playwright test e2e/applications.spec.ts` en verde.
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
$ npm test -w apps/web -- features/applications/PipelineScreen.reject
 Test Files  2 passed (2)
      Tests  19 passed (19)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/applications/StageDialogs.tsx apps/web/src/features/applications/use-stage-actions.ts apps/web/src/features/applications/use-reject-form.ts apps/web/test/features/applications/reject-fixtures.ts apps/web/test/features/applications/PipelineScreen.reject.test.tsx apps/web/test/features/applications/PipelineScreen.reject-form.test.tsx
exit=0
$ wc -l (ficheros tocados)
      79 apps/web/src/features/applications/use-reject-form.ts
     111 apps/web/src/features/applications/StageDialogs.tsx
     154 apps/web/src/features/applications/use-stage-actions.ts
     161 apps/web/test/features/applications/PipelineScreen.reject-form.test.tsx
     242 apps/web/test/features/applications/PipelineScreen.reject.test.tsx
     817 total
$ npx playwright test e2e/applications.spec.ts
  5 passed (4.5s)
exit=0
INTEGRACION rc=0
```

- **Resultado:** en verde; e2e `applications` 5 passed. 20/20 pasadas y las semillas 42 y 2024 de la suite web (740/740) en el informe del builder. Fuera de la tabla: `apps/web/src/features/applications/use-reject-form.ts` (para no pasar de 50 líneas) y `apps/web/test/features/applications/reject-fixtures.ts`. El `fieldset` de motivos no se deshabilita en vuelo, para poder llevar el foco al primer radio tras un 400; «Cancelar» y «Rechazar» sí.
- **Commit:** el de esta tarea (`[HU-05 TASK-13]`)

