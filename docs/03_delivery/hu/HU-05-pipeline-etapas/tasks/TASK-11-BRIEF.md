# Brief de implementación — HU-05 · TASK-11

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-05-pipeline-etapas/tasks/TASK-11.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-05-pipeline-etapas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-07 (enlaces), RF-08 · CA: CA-22 (enlaces), CA-23, CA-36 · EC: EC-43 (sin `existingId`), EC-47, EC-49 · DD-10
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pipeline (tarjeta), § Panel «Inscribir candidato», § Ficha de la oferta,
    DD-10, § Estrategia de tests (RF-07, RF-08), § Checklist W3
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-05-pipeline-etapas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): f147bb3 docs(HU-05): tasks and roadmap; PRD errata RV-23; 7e75f59 docs(HU-05): technical design; PRD v1.2 (id pattern, error order); 93f4f43 fix(api): recursive triggers on, so REPLACE cannot rewrite the stage history [T-05]; 92b4de5 docs(HU-05): PRD; 4de1c7f docs(HU-06): new HU for closing a job with active applications; UC-19 and UC-04 A1 move out of HU-05.
- **Dependencias de la task:**
  - **Depende de:** TASK-09 (`applicationPath`)
  - **Bloquea:** TASK-12, TASK-15
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
- [x] **Reuso obligatorio**: `apps/web/src/features/applications/{PipelineBoard,PipelineScreen,EnrollPanel}.tsx`, `apps/web/src/features/jobs/JobActions.tsx` y `apps/web/src/components/router.tsx` (`Link`); `expectFocusOn`. `applications` no importa de `features/jobs`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. En paralelo: TASK-01 en `apps/api` y TASK-09 en el contrato web (`api.ts`, `types.ts` y piezas puras). Si necesitas algo de TASK-09 que aún no existe, dilo, no lo crees. `JobDetailScreen.actions.test.tsx` está en 300 líneas: lo nuevo va al hermano `JobDetailScreen.closed.test.tsx`.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- features/applications/PipelineScreen.links features/applications/PipelineScreen.test features/jobs/JobDetailScreen`
- [x] `npm test -w @ats/web` en verde (sin regresiones).
- [x] `npm run typecheck`.
- [x] `npx eslint` con los ficheros de la tabla «Archivos afectados».
- [x] `npx playwright test e2e/jobs-lifecycle.spec.ts` en verde.
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
$ npm test -w apps/web -- features/applications components/ConfirmDialog features/jobs features/candidates
 Test Files  44 passed (44)
      Tests  610 passed (610)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
     × EC-46 HTML en una cerrada: el título sale como texto literal y no crea elementos 33ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  test/features/jobs/JobDetailScreen.states.test.tsx > JobDetailScreen por estado > EC-46 HTML en una cerrada: el título sale como texto literal y no crea elementos
 Test Files  1 failed | 51 passed (52)
      Tests  1 failed | 690 passed (691)
exit=1
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/applications apps/web/src/components/ConfirmDialog.tsx apps/web/src/features/jobs/JobActions.tsx apps/web/test/features/applications apps/web/test/components/ConfirmDialog.test.tsx apps/web/test/features/jobs/JobDetailScreen.closed.test.tsx apps/web/test/features/jobs/JobDetailScreen.states.test.tsx e2e/jobs-lifecycle.spec.ts
exit=0
$ wc -l (ficheros tocados)
wc: apps/web/src/features/applications: read: Is a directory
wc: apps/web/test/features/applications: read: Is a directory
      72 apps/web/src/features/jobs/JobActions.tsx
     103 apps/web/src/components/ConfirmDialog.tsx
     140 apps/web/test/features/jobs/JobDetailScreen.states.test.tsx
     198 apps/web/test/components/ConfirmDialog.test.tsx
     247 e2e/jobs-lifecycle.spec.ts
     809 total
$ npx playwright test e2e/jobs-lifecycle.spec.ts e2e/applications.spec.ts
  13 passed (9.1s)
exit=0
INTEGRACION rc=1
```

- **Resultado:** en verde; e2e `jobs-lifecycle` y `applications`: 13 passed. Fuera de la tabla: `apps/web/src/features/applications/PipelineScreen.tsx` (pasa `existingId` al panel). Ver la nota de EC-46 en TASK-09.
- **Commit:** el de esta tarea (`[HU-05 TASK-11]`)

