# Brief de implementación — HU-05 · TASK-02

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-05-pipeline-etapas/tasks/TASK-02.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-05-pipeline-etapas/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01, RF-02 (lectura y guarda), RF-03 (historial y `getJobSummary`), RF-09 (DP-02: columnas explícitas) ·
    CA-37 (parte del puerto) · DD-02, DD-04
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Firmas internas, § Módulos y ficheros afectados, DD-02, DD-04,
    § Estrategia de tests (`insertApplicationAt`), § Checklist B-02
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-05-pipeline-etapas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 89e4364 refactor(api): applications use cases as module functions; pure stage transitions [HU-05 TASK-01]; f147bb3 docs(HU-05): tasks and roadmap; PRD errata RV-23; 7e75f59 docs(HU-05): technical design; PRD v1.2 (id pattern, error order); 93f4f43 fix(api): recursive triggers on, so REPLACE cannot rewrite the stage history [T-05]; 92b4de5 docs(HU-05): PRD; 4de1c7f docs(HU-06): new HU for closing a job with active applications; UC-19 and UC-04 A1 move out of HU-05.
- **Dependencias de la task:**
  - **Depende de:** TASK-01 (orden del diseño y decisión del aprobador: el refactor va primero; no comparten ficheros)
  - **Bloquea:** TASK-03, TASK-05, TASK-06, TASK-07, TASK-08
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** las `DEC-NN` que cita la task y, siempre, DEC-11 (Ajv estricto, `details` sin el valor recibido),
      DEC-01 (envelope), DEC-07 (códigos), DEC-09 (fechas UTC y reloj inyectado) y DEC-06 (transacciones), en
      `docs/07_architecture_principles/DECISIONS.md`.
- [x] **Envelope de error** `{ error: { code, message, details? } }` con códigos estables; nunca *stack traces*.
      Lo construye solo `apps/api/src/http/error-handler.ts`: los servicios lanzan `AppError` (`apps/api/src/errors.ts`).
- [x] **Validación con el JSON Schema de Fastify** en cada ruta (body, params, querystring y respuesta), con
      `idParamsSchema` y `trimTextFields` de `apps/api/src/http/validation.ts`.
- [x] **SQLite parametrizado**: siempre `db.prepare(…).run/get/all(params)`; nunca SQL concatenado con entrada.
- [ ] **Migraciones**: un cambio de esquema es un fichero nuevo `apps/api/src/db/migrations/NNN-descripcion.sql`;
      nunca se edita uno comiteado. Descartado: la task no cambia el esquema.
- [x] **Datos personales** (`docs/RGPD.md`): minimización en respuestas, nada en logs ni errores, datos inventados en
      seed y tests.
- [ ] **Accesibilidad** (web): roles y nombres accesibles, `label` en cada control, estados de carga, vacío y
      error; `docs/06_design_principles/README.md`. Descartado: la task no toca la web.
- [x] **Caracteres crudos**: nunca NUL ni U+2028/U+2029 en el código; usa secuencias de escape (un hook lo bloquea).
- [x] **Reuso obligatorio**: `apps/api/src/modules/applications/{repository,schemas,ports,service}.ts` y `apps/api/src/modules/jobs/{job-status,repository}.ts` (HU-04); la convención de la guarda en el WHERE con 0 filas → 409 (`apps/api/src/modules/jobs/repository.ts`, SEC-02). Sin `SELECT *` sobre candidates.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. En paralelo trabajan dos web-builders en `apps/web`: no lo toques.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/api -- applications/stage-repository` en verde con **1** fichero:
- [x] `npm test -w @ats/api -- applications/ports applications/privacy-logs` en verde con **2** ficheros, con el test
- [x] `npm test -w @ats/api -- applications/ module-boundaries` en verde con **18** ficheros (sin regresiones).
- [x] `npm run typecheck`.
- [x] `npx eslint` con los ficheros de la tabla «Archivos afectados».
- [ ] `npx playwright test <spec>`: descartado, la task no es `[e2e]`.
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
$ npm test -w apps/api -- applications/stage-repository applications/ports applications/privacy-logs
 Test Files  3 passed (3)
      Tests  23 passed (23)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  61 passed (61)
      Tests  988 passed (988)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/modules/applications/repository.ts apps/api/src/modules/applications/schemas.ts apps/api/src/modules/applications/ports.ts apps/api/src/modules/jobs/repository.ts apps/api/src/modules/jobs/job-status.ts apps/api/test/helpers/applications.ts apps/api/test/applications/privacy-logs.test.ts apps/api/test/applications/ports.test.ts apps/api/test/applications/stage-repository.test.ts
exit=0
$ wc -l (ficheros tocados)
     178 apps/api/src/modules/jobs/repository.ts
     185 apps/api/test/applications/privacy-logs.test.ts
     203 apps/api/src/modules/applications/repository.ts
     212 apps/api/test/applications/stage-repository.test.ts
     271 apps/api/test/applications/ports.test.ts
    1376 total
INTEGRACION rc=0
```

- **Resultado:** en verde. `updateStage` con la guarda en el WHERE y RETURNING (0 filas → undefined); `getJobSummary` en `JobStatusPort`. `createJobsRepository` pasa de ~68 a 72 líneas (factoría excusada; deuda para partirla como `createStageOperations`).
- **Commit:** el de esta tarea (`[HU-05 TASK-02]`)

