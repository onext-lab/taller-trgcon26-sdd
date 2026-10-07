# Brief de implementación — HU-04 · TASK-11

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-04-inscribir-candidato/tasks/TASK-11.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-04-inscribir-candidato/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-07 · RNF: RNF-06 (texto JSX), RNF-07 (6 `region`) · CA: CA-12, CA-14, CA-15, CA-16, CA-26 (web) · Edge cases:
    EC-26 (web), EC-27, EC-29 (web), EC-30 (web), EC-35, EC-36, EC-37, EC-39
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Rutas y títulos, § Pipeline, § Ficha de la oferta, DD-01, DD-08, DD-09,
    § Estrategia de tests (RF-07), § Checklist W2
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-04-inscribir-candidato` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 1768242 test(api): enrollment under dependency failures and personal data in logs [HU-04 TASK-08]; babda45 test(api): enrollment against hostile input and concurrency [HU-04 TASK-07]; a15014e feat(api): job pipeline (GET /api/jobs/:jobId/applications) [HU-04 TASK-05]; 4eb138f feat(api): enroll a candidate in a published job (POST /api/applications) [HU-04 TASK-04]; bee8422 feat(api): module ports for job status, candidate lookups and real candidate processes [HU-04 TASK-03]; 53296b3 feat(web): applications client, pipeline types, useResource.reload and focusable Notice [HU-04 TASK-10]; a1e7b64 feat(api): applications and stage changes tables, immutable history; DEC-06 clarification [HU-04 TASK-01]; 4a99223 fix(api): guard job edit and delete by status in SQL (SEC-02) [HU-04 TASK-02]; 01e33ac docs(HU-04): tasks and roadmap; PRD v1.1 (trigger note exception, not-found page); b50e5da docs(HU-04): technical design; 279fed8 docs(HU-04): PRD; 7de646c Merge sprint integration (T-04) into HU-04.
- **Dependencias de la task:**
  - **Depende de:** TASK-05 (endpoint del pipeline), TASK-10
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
- [x] **Reuso obligatorio**: lo de TASK-10 en `apps/web/src/features/applications/` (api, types, labels, paths, `useResource.reload`, `Notice` con ref), `apps/web/src/components/` y la tabla `ROUTES` de `apps/web/src/App.tsx`; `expectFocusOn` en tests de foco. `applications` no importa de `features/jobs` (App.tsx le pasa lo necesario por props).
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. En paralelo, TASK-06 trabaja en el seed de `apps/api`: no lo toques. Si la suite o el typecheck fallan solo por sus ficheros, dilo.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- applications/PipelineScreen JobDetailScreen App.test` en verde, con **6** ficheros de
- [x] `npm test -w @ats/web` completo en verde.
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
$ npm test -w apps/web -- applications/PipelineScreen JobDetailScreen App.test
 Test Files  6 passed (6)
      Tests  62 passed (62)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  45 passed (45)
      Tests  583 passed (583)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/applications/PipelineBoard.tsx apps/web/src/features/applications/PipelineScreen.tsx apps/web/src/App.tsx apps/web/src/features/jobs/JobActions.tsx apps/web/test/features/applications/fixtures.ts apps/web/test/features/applications/PipelineScreen.test.tsx apps/web/test/features/applications/PipelineScreen.states.test.tsx apps/web/test/App.test.tsx apps/web/test/features/jobs/JobDetailScreen.states.test.tsx apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx e2e/jobs-lifecycle.spec.ts
exit=0
$ wc -l (ficheros tocados)
     143 apps/web/test/features/jobs/JobDetailScreen.states.test.tsx
     152 apps/web/test/features/applications/PipelineScreen.test.tsx
     182 apps/web/test/App.test.tsx
     247 e2e/jobs-lifecycle.spec.ts
     300 apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx
    1552 total
$ npx playwright test e2e/jobs-lifecycle.spec.ts
  8 passed (6.8s)
exit=0
INTEGRACION rc=0
```

- **Resultado:** en verde, con el e2e de ciclo de vida de ofertas (8 passed). `JobDetailScreen.actions.test.tsx` queda en 300 líneas exactas: el siguiente test va a un hermano.
- **Commit:** el de esta tarea (`[HU-04 TASK-11]`)

