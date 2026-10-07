# Brief de implementación — HU-03 · TASK-03

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/tasks/TASK-03.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01, RF-02, RF-05 (API), RF-07 (recálculo en el alta) · CA: CA-01, CA-03, CA-04 (fronteras aceptadas),
    CA-22, CA-23 · Edge cases: EC-03, EC-11, EC-12, EC-13, EC-18, EC-35, EC-36, EC-40 · RNF-04 (esquema), RNF-05
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico, § Contrato de API (Tipos de respuesta, Reglas por campo,
    Endpoints, Errores específicos, Firmas internas), § Diagrama de secuencia (alta), DD-02, DD-03, DD-04, DD-05, DD-07,
    § Checklist B-03
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-03-candidatos-consentimiento` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 70db89c feat(api): candidates table, processes port and retention formula [HU-03 TASK-02]; 136b8f4 refactor(web): share list, pagination and form-error pieces; add candidates client [HU-03 TASK-09]; df83266 feat(api): bound validation details to the schema (DEC-11.4 amendment) [HU-03 TASK-01]; b360bbe docs(HU-03): tasks and roadmap; 15432f9 docs(HU-03): technical design; c0e8adc Merge sprint integration (HU-02) into HU-03; 1380c79 docs(HU-03): PRD; dcdf80c Merge sprint integration (HU-01, T-01, T-02) into HU-03; 6fc6792 docs(HU-03): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-01 (`forbiddenFields`, `duplicate`, `details` acotado), TASK-02 (tabla, puerto, fórmula)
  - **Bloquea:** TASK-04, TASK-06, TASK-11, TASK-12
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
- [x] **Reuso obligatorio**: el patrón de `apps/api/src/modules/jobs/{routes,service,repository,schemas}.ts`; `foldSearchText` y `registerTextSearch` de `apps/api/src/db/text-search.ts` (el repositorio llama a `registerTextSearch(db)`); `NO_CONTROL_CHARS`, `NO_CONTROL_CHARS_EXCEPT_WHITESPACE`, `forbiddenFields` y el recorte de `apps/api/src/http/validation.ts`; `duplicate()` de `apps/api/src/errors.ts`; `withTransaction`; `computeRetentionEndsAt` y `noCandidateProcesses` de TASK-02; DEC-12 ya protege las escrituras (no la reimplementes).
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Nunca se loguean ni se devuelven en un error datos del candidato (RGPD); el 409 lleva solo `existingId`.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] Los tests de ofertas que usan `failWrites(db, op)` siguen en verde: `npm test -w @ats/api` completo en verde.
- [x] `npm test -w @ats/api -- candidates/normalize candidates/create.test candidates/get` en verde, con **3**
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
$ npm test -w apps/api -- candidates/normalize candidates/create.test candidates/get
 Test Files  3 passed (3)
      Tests  34 passed (34)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  31 passed (31)
      Tests  417 passed (417)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/modules/candidates/schemas.ts apps/api/src/modules/candidates/normalize.ts apps/api/src/modules/candidates/repository.ts apps/api/src/modules/candidates/service.ts apps/api/src/modules/candidates/routes.ts apps/api/src/app.ts apps/api/test/helpers/test-app.ts apps/api/test/helpers/candidates.ts apps/api/test/candidates/normalize.test.ts apps/api/test/candidates/create.test.ts apps/api/test/candidates/get.test.ts
exit=0
$ wc -l (ficheros tocados)
     100 apps/api/src/modules/candidates/repository.ts
     134 apps/api/src/modules/candidates/schemas.ts
     159 apps/api/test/helpers/test-app.ts
     171 apps/api/test/candidates/get.test.ts
     174 apps/api/test/candidates/create.test.ts
    1132 total
INTEGRACION rc=0
```

- **Resultado:** en verde; los tests de ofertas con `failWrites` siguen pasando (`failWrites` admite ahora `{ table, column }`).
- **Commit:** el de esta tarea (`[HU-03 TASK-03]`)

