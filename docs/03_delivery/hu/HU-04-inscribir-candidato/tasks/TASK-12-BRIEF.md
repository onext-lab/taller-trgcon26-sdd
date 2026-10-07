# Brief de implementación — HU-04 · TASK-12

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-04-inscribir-candidato/tasks/TASK-12.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-04-inscribir-candidato/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-08 (panel y búsqueda) · RNF: RNF-05 (la búsqueda no sale del estado), RNF-07 · Edge cases: EC-40, EC-41,
    EC-42 (buscar)
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Panel «Inscribir candidato», DD-02, DD-03, DD-07, DD-11, § Estrategia de
    tests (RF-08), § Checklist W3
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-04-inscribir-candidato` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): d40ddd3 feat(web): job pipeline screen and the View pipeline link [HU-04 TASK-11]; 0c996f0 feat(api): seed 40 applications with history; pipeline and enroll performance [HU-04 TASK-06]; 1768242 test(api): enrollment under dependency failures and personal data in logs [HU-04 TASK-08]; babda45 test(api): enrollment against hostile input and concurrency [HU-04 TASK-07]; a15014e feat(api): job pipeline (GET /api/jobs/:jobId/applications) [HU-04 TASK-05]; 4eb138f feat(api): enroll a candidate in a published job (POST /api/applications) [HU-04 TASK-04]; bee8422 feat(api): module ports for job status, candidate lookups and real candidate processes [HU-04 TASK-03]; 53296b3 feat(web): applications client, pipeline types, useResource.reload and focusable Notice [HU-04 TASK-10]; a1e7b64 feat(api): applications and stage changes tables, immutable history; DEC-06 clarification [HU-04 TASK-01]; 4a99223 fix(api): guard job edit and delete by status in SQL (SEC-02) [HU-04 TASK-02]; 01e33ac docs(HU-04): tasks and roadmap; PRD v1.1 (trigger note exception, not-found page); b50e5da docs(HU-04): technical design.
- **Dependencias de la task:**
  - **Depende de:** TASK-11 (comparten `PipelineScreen.tsx` y `styles.css`); la búsqueda usa `GET /api/candidates`, que
    ya existe (HU-03)
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
- [x] **Reuso obligatorio**: lo de TASK-10/11 en `apps/web/src/features/applications/`, `listCandidates` de `apps/web/src/features/candidates/api.ts` con `pageSize=10`, `validateSearchText` de `apps/web/src/components/list-controls.ts`, `FormField`, `useLifetimeSignal`; `expectFocusOn` en tests de foco.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. La búsqueda del panel solo vive en su estado: nunca en la URL, el título, `history.state` ni el almacenamiento. En paralelo, TASK-09 escribe tests en `apps/api`; no los toques.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- applications/PipelineScreen` en verde, con **3** ficheros de test.
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
$ npm test -w apps/web -- applications/PipelineScreen
 Test Files  3 passed (3)
      Tests  37 passed (37)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  46 passed (46)
      Tests  601 passed (601)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/applications/use-candidate-search.ts apps/web/src/features/applications/use-enroll-panel.ts apps/web/src/features/applications/EnrollPanel.tsx apps/web/src/features/applications/PipelineScreen.tsx apps/web/test/features/applications/PipelineScreen.search.test.tsx
exit=0
$ wc -l (ficheros tocados)
      74 apps/web/src/features/applications/use-enroll-panel.ts
      95 apps/web/src/features/applications/PipelineScreen.tsx
     101 apps/web/src/features/applications/use-candidate-search.ts
     127 apps/web/src/features/applications/EnrollPanel.tsx
     296 apps/web/test/features/applications/PipelineScreen.search.test.tsx
     693 total
INTEGRACION rc=0
```

- **Resultado:** en verde. La búsqueda vive solo en el estado del panel. El descarte del panel tras una recarga a no `published` y el foco de la alerta del panel quedan para los tests de TASK-13 (EC-44).
- **Commit:** el de esta tarea (`[HU-04 TASK-12]`)

