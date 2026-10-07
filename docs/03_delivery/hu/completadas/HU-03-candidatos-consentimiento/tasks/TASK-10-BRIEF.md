# Brief de implementación — HU-03 · TASK-10

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/tasks/TASK-10.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-04 (web) · CA: CA-15 a CA-19, CA-21 · Edge cases: EC-28, EC-30 · RNF-07, RNF-09 (listado)
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Listado, § Accesibilidad que usan los tests, DD-01,
    DD-02, DD-07, § Estrategia de tests (RF-04), § Checklist W2
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-03-candidatos-consentimiento` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): d212483 test(api): adversarial cases for candidate edits and personal data in logs [HU-03 TASK-07]; 3487755 feat(api): list and search candidates, seed 30 candidates [HU-03 TASK-05]; 087c3ca test(api): adversarial cases for candidate creation [HU-03 TASK-06]; 783f97f feat(api): edit candidates and give or withdraw consent [HU-03 TASK-04]; 9d24906 feat(api): create and get candidates [HU-03 TASK-03]; 70db89c feat(api): candidates table, processes port and retention formula [HU-03 TASK-02]; 136b8f4 refactor(web): share list, pagination and form-error pieces; add candidates client [HU-03 TASK-09]; df83266 feat(api): bound validation details to the schema (DEC-11.4 amendment) [HU-03 TASK-01]; b360bbe docs(HU-03): tasks and roadmap; 15432f9 docs(HU-03): technical design; c0e8adc Merge sprint integration (HU-02) into HU-03; 1380c79 docs(HU-03): PRD.
- **Dependencias de la task:**
  - **Depende de:** TASK-05 (`GET /api/candidates`), TASK-09 (piezas compartidas y cliente)
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
- [x] **Reuso obligatorio**: las piezas de TASK-09 en `apps/web/src/components/` (`list-controls.ts`, `Pagination.tsx` con `renderStep` de botones, `PageSizeSelect.tsx`, `use-resource.ts`, `use-document-title.ts`, `StatusMessages.tsx`) y el cliente `apps/web/src/features/candidates/api.ts`; el patrón de `apps/web/src/features/jobs/JobListScreen.tsx`, pero con los filtros en `list-state.ts` (nunca en la URL, DT-10 c). No importes nada de `features/jobs`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. En paralelo, TASK-11 también modifica `apps/web/src/App.tsx` (y TASK-12 ya lo hizo): tu cambio en App.tsx va al FINAL, con un único Edit mínimo (o dos adyacentes: import y ruta), releyendo el fichero justo antes y sin reformatear lo demás. No toques los ficheros de TASK-11 ni de TASK-12 ni apps/api.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- CandidateListScreen App.test` en verde, con **3** ficheros de test.
- [x] `npm test -w @ats/web` completo en verde (ofertas sin cambios).
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
$ npm test -w apps/web -- CandidateListScreen App.test router
 Test Files  4 passed (4)
      Tests  39 passed (39)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  37 passed (37)
      Tests  491 passed (491)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/candidates/list-state.ts apps/web/src/features/candidates/CandidateTable.tsx apps/web/src/features/candidates/CandidateFilters.tsx apps/web/src/features/candidates/CandidateListScreen.tsx apps/web/src/App.tsx apps/web/test/features/candidates/CandidateListScreen.test.tsx apps/web/test/features/candidates/CandidateListScreen.filters.test.tsx apps/web/test/App.test.tsx
exit=0
$ wc -l (ficheros tocados)
     106 apps/web/src/features/candidates/CandidateListScreen.tsx
     117 apps/web/src/App.tsx
     126 apps/web/test/App.test.tsx
     163 apps/web/test/features/candidates/CandidateListScreen.filters.test.tsx
     197 apps/web/test/features/candidates/CandidateListScreen.test.tsx
     867 total
$ npx playwright test e2e/jobs.spec.ts e2e/jobs-list.spec.ts e2e/jobs-lifecycle.spec.ts
  23 passed (13.0s)
exit=0
INTEGRACION rc=0
```

- **Resultado:** en verde; los e2e de ofertas (23) siguen pasando. `resolveScreen` de `App.tsx` pasa a la tabla `ROUTES` (2 ramas) para no superar el umbral de complejidad, que se superaba con la ruta nueva; el orden `/new` → `/:id/edit` → `/:id` se mantiene.
- **Commit:** el de esta tarea (`[HU-03 TASK-10]`)

