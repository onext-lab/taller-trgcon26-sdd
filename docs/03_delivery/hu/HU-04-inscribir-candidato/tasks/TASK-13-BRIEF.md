# Brief de implementación — HU-04 · TASK-13

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-04-inscribir-candidato/tasks/TASK-13.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-04-inscribir-candidato/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-08 (inscribir) · RNF: RNF-07 (foco al aviso) · CA: CA-02, CA-03 (web), CA-08 · Edge cases: EC-07 (web),
    EC-09 (web), EC-43, EC-44
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Resultado de inscribir, § Diagrama de secuencia, DD-04, DD-05, DD-06,
    DD-10, § Estrategia de tests (RF-08), § Checklist W4
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-04-inscribir-candidato` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 333068e feat(web): enroll panel with candidate search in the pipeline [HU-04 TASK-12]; c4e955c test(api): pipeline and data integrity against hostile input and corrupt writes [HU-04 TASK-09]; d40ddd3 feat(web): job pipeline screen and the View pipeline link [HU-04 TASK-11]; 0c996f0 feat(api): seed 40 applications with history; pipeline and enroll performance [HU-04 TASK-06]; 1768242 test(api): enrollment under dependency failures and personal data in logs [HU-04 TASK-08]; babda45 test(api): enrollment against hostile input and concurrency [HU-04 TASK-07]; a15014e feat(api): job pipeline (GET /api/jobs/:jobId/applications) [HU-04 TASK-05]; 4eb138f feat(api): enroll a candidate in a published job (POST /api/applications) [HU-04 TASK-04]; bee8422 feat(api): module ports for job status, candidate lookups and real candidate processes [HU-04 TASK-03]; 53296b3 feat(web): applications client, pipeline types, useResource.reload and focusable Notice [HU-04 TASK-10]; a1e7b64 feat(api): applications and stage changes tables, immutable history; DEC-06 clarification [HU-04 TASK-01]; 4a99223 fix(api): guard job edit and delete by status in SQL (SEC-02) [HU-04 TASK-02].
- **Dependencias de la task:**
  - **Depende de:** TASK-04 (endpoint `POST /api/applications`), TASK-12
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
- [x] **Reuso obligatorio**: lo de TASK-10/11/12 en `apps/web/src/features/applications/` (`enrollCandidate`, `classifyEnrollError`, `useResource.reload`, `Notice` con ref, `showAlert`/`submit` del panel); `expectFocusOn` para el foco movido por efectos.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Los dos 409 van sin enlace (el detalle es de HU-05). Cubre también el descarte del panel cuando una recarga deja la oferta en no `published` y el foco de la alerta del panel, que TASK-12 dejó sin test.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- applications/PipelineScreen` en verde, con **4** ficheros de test.
- [x] `npm test -w @ats/web` completo en verde.
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
 Test Files  4 passed (4)
      Tests  52 passed (52)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  47 passed (47)
      Tests  616 passed (616)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/applications/use-enrollment.ts apps/web/src/features/applications/use-pipeline-feedback.ts apps/web/src/features/applications/use-enroll-panel.ts apps/web/src/features/applications/EnrollPanel.tsx apps/web/src/features/applications/PipelineScreen.tsx apps/web/test/features/applications/PipelineScreen.enroll.test.tsx apps/web/test/features/applications/enroll-fixtures.ts
exit=0
$ wc -l (ficheros tocados)
      68 apps/web/src/features/applications/use-enrollment.ts
     100 apps/web/src/features/applications/use-enroll-panel.ts
     145 apps/web/src/features/applications/EnrollPanel.tsx
     164 apps/web/src/features/applications/PipelineScreen.tsx
     269 apps/web/test/features/applications/PipelineScreen.enroll.test.tsx
     836 total
INTEGRACION rc=0
```

- **Resultado:** en verde; gates.sh sin avisos en `apps/web/src/features/applications`. Fuera de la tabla: `apps/web/test/features/applications/enroll-fixtures.ts` (helpers sacados del test para no pasar de 300). El disparador «Inscribir candidato» se deshabilita mientras hay una inscripción en curso. Prueba de que el test muerde: sin `showAlert(undefined)` falla EC-43.
- **Commit:** el de esta tarea (`[HU-04 TASK-13]`)

