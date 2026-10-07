# Brief de implementación — HU-03 · TASK-14

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/tasks/TASK-14.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-04, RF-05, RF-06 (web) · CA: CA-20 (web), CA-29, CA-30 (web) · Edge cases: EC-33, EC-40, EC-45, EC-48, EC-49,
    EC-53, EC-56 · RNF-06, RNF-09
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Error paths (CA-20, EC-33, EC-40, EC-45, EC-48, EC-49, EC-53, EC-56,
    respuesta con forma inesperada), § Threat modeling, § Estrategia de tests (RF-04 a RF-06 `[adversarial]`),
    § Checklist W5
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-03-candidatos-consentimiento` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 030294e feat(web): candidate list with search kept out of the URL [HU-03 TASK-10]; 2afe567 feat(web): candidate detail with consent section [HU-03 TASK-12]; e527975 feat(web): candidate create and edit form [HU-03 TASK-11]; 26213a7 test(api): adversarial cases for candidate list and consent [HU-03 TASK-08]; d212483 test(api): adversarial cases for candidate edits and personal data in logs [HU-03 TASK-07]; 3487755 feat(api): list and search candidates, seed 30 candidates [HU-03 TASK-05]; 087c3ca test(api): adversarial cases for candidate creation [HU-03 TASK-06]; 783f97f feat(api): edit candidates and give or withdraw consent [HU-03 TASK-04]; 9d24906 feat(api): create and get candidates [HU-03 TASK-03]; 70db89c feat(api): candidates table, processes port and retention formula [HU-03 TASK-02]; 136b8f4 refactor(web): share list, pagination and form-error pieces; add candidates client [HU-03 TASK-09]; df83266 feat(api): bound validation details to the schema (DEC-11.4 amendment) [HU-03 TASK-01].
- **Dependencias de la task:**
  - **Depende de:** TASK-10 (listado), TASK-12 (ficha y consentimiento)
  - **Bloquea:** nada
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
- [x] **Reuso obligatorio**: los helpers y el estilo de `apps/web/test/features/candidates/{CandidateListScreen,CandidateDetailScreen}*.test.tsx` (cada test empieza con `saveListState(INITIAL_LIST_QUERY)`) y de los adversariales de jobs.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. NO toques código de producción: si un caso falla por un bug, déjalo fallando y repórtalo (caso, esperado, obtenido); la sesión decide. En paralelo trabajan TASK-13 (test adversarial del formulario) y TASK-15 (e2e): no toques sus ficheros.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- CandidateListScreen.adversarial CandidateDetailScreen.adversarial` en verde, con **2**
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
$ npm test -w apps/web -- CandidateListScreen.adversarial CandidateDetailScreen.adversarial
 Test Files  2 passed (2)
      Tests  23 passed (23)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
     × EC-19: cambiar solo la banda envía PATCH { salaryMin } y vuelve a la ficha «Publicada» 86ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  test/features/jobs/JobFormScreen.published.test.tsx > JobFormScreen · edición de una publicada > EC-19: cambiar solo la banda envía PATCH { salaryMin } y vuelve a la ficha «Publicada»
 Test Files  1 failed | 39 passed (40)
      Tests  1 failed | 534 passed (535)
exit=1
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/test/features/candidates/CandidateListScreen.adversarial.test.tsx apps/web/test/features/candidates/CandidateDetailScreen.adversarial.test.tsx
exit=0
$ wc -l (ficheros tocados)
     159 apps/web/test/features/candidates/CandidateListScreen.adversarial.test.tsx
     299 apps/web/test/features/candidates/CandidateDetailScreen.adversarial.test.tsx
     458 total
INTEGRACION rc=1
```

- **Resultado:** tests de la task en verde (23); no se ha tocado producción. En la suite completa falló de forma intermitente `JobFormScreen.published.test.tsx` EC-19 (ofertas, ajeno a esta tarea), con los e2e de TASK-15 corriendo a la vez; suelto pasa (9/9). Es el tercer test de foco o tiempos de ofertas que falla solo bajo carga (también `JobDetailScreen.actions` y `JobListScreen.pagination`); queda para la review.
- **Commit:** el de esta tarea (`[HU-03 TASK-14]`)

