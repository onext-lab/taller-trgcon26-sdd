# Brief de implementación — HU-03 · TASK-08

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/tasks/TASK-08.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-04, RF-06, RF-07 · CA: CA-20, CA-29, CA-30 · Edge cases: EC-27, EC-33, EC-42, EC-45, EC-46, EC-48, EC-53
    (consentimiento), EC-56
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths (EC-27, EC-33, EC-42 a EC-48, EC-53, EC-56), § Threat
    modeling (Suplantación, Manipulación), § Estrategia de tests (CA-20, CA-30), § Checklist B-08
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-03-candidatos-consentimiento` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 3487755 feat(api): list and search candidates, seed 30 candidates [HU-03 TASK-05]; 087c3ca test(api): adversarial cases for candidate creation [HU-03 TASK-06]; 783f97f feat(api): edit candidates and give or withdraw consent [HU-03 TASK-04]; 9d24906 feat(api): create and get candidates [HU-03 TASK-03]; 70db89c feat(api): candidates table, processes port and retention formula [HU-03 TASK-02]; 136b8f4 refactor(web): share list, pagination and form-error pieces; add candidates client [HU-03 TASK-09]; df83266 feat(api): bound validation details to the schema (DEC-11.4 amendment) [HU-03 TASK-01]; b360bbe docs(HU-03): tasks and roadmap; 15432f9 docs(HU-03): technical design; c0e8adc Merge sprint integration (HU-02) into HU-03; 1380c79 docs(HU-03): PRD; dcdf80c Merge sprint integration (HU-01, T-01, T-02) into HU-03.
- **Dependencias de la task:**
  - **Depende de:** TASK-04 (consentimiento), TASK-05 (listado)
  - **Bloquea:** nada
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
- [x] **Reuso obligatorio**: `apps/api/test/helpers/test-app.ts` (`failWrites`), `apps/api/test/helpers/candidates.ts`, el estilo de `apps/api/test/candidates/create-adversarial.test.ts` y de `apps/api/test/jobs/list-filters-adversarial.test.ts`; para DEC-12, `apps/api/test/http/cross-site.test.ts`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. NO toques código de producción: si un caso falla por un bug, déjalo fallando y repórtalo (caso, esperado, obtenido); la sesión decide. En paralelo trabajan otros builders (web y TASK-07): no toques sus ficheros; si el typecheck falla solo en web, usa `-w @ats/api`.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/api -- candidates/list-adversarial candidates/consent-adversarial` en verde, con **2**
- [x] `npm test -w @ats/api` completo en verde.
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
$ npm test -w apps/api -- candidates/list-adversarial candidates/consent-adversarial
 Test Files  2 passed (2)
      Tests  38 passed (38)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  41 passed (41)
      Tests  558 passed (558)
exit=0
$ npm run typecheck -w @ats/api
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/test/candidates/list-adversarial.test.ts apps/api/test/candidates/consent-adversarial.test.ts
exit=0
$ wc -l (ficheros tocados)
     127 apps/api/test/candidates/list-adversarial.test.ts
     241 apps/api/test/candidates/consent-adversarial.test.ts
     368 total
INTEGRACION rc=0
```

- **Resultado:** en verde: 38 casos y ninguno falla. No se ha tocado producción. DEC-12 heredado, comprobado en `consent-adversarial.test.ts`.
- **Commit:** el de esta tarea (`[HU-03 TASK-08]`)

