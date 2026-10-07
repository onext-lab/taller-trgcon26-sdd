# Brief de implementación — HU-03 · TASK-13

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/tasks/TASK-13.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01, RF-02, RF-03 (web) · CA: CA-05 (web) · Edge cases: EC-02, EC-07, EC-08, EC-17 (> 2 000), EC-19, EC-25,
    EC-58, EC-59 · DEC-12 (403 en la web) · RNF-09 (formulario)
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Error paths (EC-02/EC-19/EC-59, EC-07, EC-08, EC-17, EC-25, EC-58, 403),
    § Threat modeling, § Estrategia de tests (RF-01 a RF-03 `[adversarial]`), § Checklist W5
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-03-candidatos-consentimiento` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 2afe567 feat(web): candidate detail with consent section [HU-03 TASK-12]; e527975 feat(web): candidate create and edit form [HU-03 TASK-11]; 26213a7 test(api): adversarial cases for candidate list and consent [HU-03 TASK-08]; d212483 test(api): adversarial cases for candidate edits and personal data in logs [HU-03 TASK-07]; 3487755 feat(api): list and search candidates, seed 30 candidates [HU-03 TASK-05]; 087c3ca test(api): adversarial cases for candidate creation [HU-03 TASK-06]; 783f97f feat(api): edit candidates and give or withdraw consent [HU-03 TASK-04]; 9d24906 feat(api): create and get candidates [HU-03 TASK-03]; 70db89c feat(api): candidates table, processes port and retention formula [HU-03 TASK-02]; 136b8f4 refactor(web): share list, pagination and form-error pieces; add candidates client [HU-03 TASK-09]; df83266 feat(api): bound validation details to the schema (DEC-11.4 amendment) [HU-03 TASK-01]; b360bbe docs(HU-03): tasks and roadmap.
- **Dependencias de la task:**
  - **Depende de:** TASK-11
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
- [x] **Reuso obligatorio**: los helpers y el estilo de `apps/web/test/features/candidates/CandidateFormScreen.test.tsx` y de los adversariales de jobs (`apps/web/test/features/jobs/*adversarial*`).
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. NO toques código de producción: si un caso falla por un bug, déjalo fallando y repórtalo (caso, esperado, obtenido); la sesión decide. En paralelo, TASK-10 trabaja en el listado y App.tsx: no los toques.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- CandidateFormScreen.adversarial` en verde, con **1** fichero de test.
- [x] `npm test -w @ats/web -- candidates` en verde.
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
$ npm test -w apps/web -- CandidateFormScreen.adversarial
 Test Files  1 passed (1)
      Tests  21 passed (21)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/test/features/candidates/CandidateFormScreen.adversarial.test.tsx
exit=0
$ wc -l (ficheros tocados)
     298 apps/web/test/features/candidates/CandidateFormScreen.adversarial.test.tsx
INTEGRACION rc=0
```

- **Resultado:** en verde: 21 casos y ninguno falla. No se ha tocado producción. Para quedarse en 300 líneas se fusionaron casos redundantes (de 30 a 21; cada EC de la task conserva al menos un test). La suite web completa (40 files / 535 tests) la pasó el builder.
- **Commit:** el de esta tarea (`[HU-03 TASK-13]`)

