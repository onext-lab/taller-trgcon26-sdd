# Brief de implementación — HU-03 · TASK-12

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/tasks/TASK-12.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-05, RF-06 (web) · CA: CA-01 (ficha), CA-22 a CA-28 · Edge cases: EC-35, EC-36, EC-37, EC-43, EC-55 (texto
    con `retentionEndsAt: null`)
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Ficha y Sección de consentimiento, § Accesibilidad
    que usan los tests, DD-04, DD-05, DD-08, DD-12, § Estrategia de tests (RF-05, RF-06), § Checklist W4
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-03-candidatos-consentimiento` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 087c3ca test(api): adversarial cases for candidate creation [HU-03 TASK-06]; 783f97f feat(api): edit candidates and give or withdraw consent [HU-03 TASK-04]; 9d24906 feat(api): create and get candidates [HU-03 TASK-03]; 70db89c feat(api): candidates table, processes port and retention formula [HU-03 TASK-02]; 136b8f4 refactor(web): share list, pagination and form-error pieces; add candidates client [HU-03 TASK-09]; df83266 feat(api): bound validation details to the schema (DEC-11.4 amendment) [HU-03 TASK-01]; b360bbe docs(HU-03): tasks and roadmap; 15432f9 docs(HU-03): technical design; c0e8adc Merge sprint integration (HU-02) into HU-03; 1380c79 docs(HU-03): PRD; dcdf80c Merge sprint integration (HU-01, T-01, T-02) into HU-03; 6fc6792 docs(HU-03): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-03 (`GET /:id`), TASK-04 (los dos `POST` de consentimiento), TASK-09 (piezas y cliente)
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
- [x] **Reuso obligatorio**: las piezas de TASK-09 en `apps/web/src/components/` (`ConfirmDialog.tsx`, `use-resource.ts`, `use-document-title.ts`, `use-lifetime-signal.ts`, `StatusMessages.tsx`, `format.ts` con `formatCalendarDate`, `router.tsx` con `parseRouteId`), el cliente `apps/web/src/features/candidates/api.ts` y `consent.ts`; el patrón de `apps/web/src/features/jobs/{JobDetailScreen.tsx,use-job-actions.ts,CloseJobAction.tsx}`. No importes nada de `features/jobs`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. En paralelo, TASK-11 también modifica `apps/web/src/App.tsx`: haz tu cambio en App.tsx al FINAL, con un único Edit mínimo y releyendo el fichero justo antes, sin reformatear lo demás. No toques los ficheros de TASK-11 (CandidateForm*, candidate-form-*) ni apps/api.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- CandidateDetailScreen` en verde, con **2** ficheros de test.
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
> La rellena `/implementar-hu` con la salida real de los comandos que ejecuta la sesión. Ciclo de arreglo: 1/2.

```
$ npm test -w apps/web -- candidate-form-model CandidateFormScreen CandidateDetailScreen
 Test Files  5 passed (5)
      Tests  106 passed (106)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  35 passed (35)
      Tests  474 passed (474)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/candidates/candidate-form-model.ts apps/web/src/features/candidates/candidate-form-errors.ts apps/web/src/features/candidates/CandidateForm.tsx apps/web/src/features/candidates/CandidateFormScreen.tsx apps/web/src/features/candidates/CandidateDetailScreen.tsx apps/web/src/features/candidates/CandidateDetails.tsx apps/web/src/features/candidates/ConsentSection.tsx apps/web/src/features/candidates/use-consent-actions.ts apps/web/src/App.tsx apps/web/test/features/candidates/candidate-form-model.test.ts apps/web/test/features/candidates/CandidateFormScreen.test.tsx apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx apps/web/test/features/candidates/CandidateDetailScreen.test.tsx apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx
exit=0
$ wc -l (ficheros tocados)
     279 apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx
     284 apps/web/test/features/candidates/CandidateDetailScreen.test.tsx
     290 apps/web/test/features/candidates/CandidateFormScreen.test.tsx
     300 apps/web/test/features/candidates/candidate-form-model.test.ts
     300 apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx
    2502 total
INTEGRACION rc=0
```

- **Resultado:** en verde tras 1 ciclo de arreglo (`CandidateDetailScreen.test.tsx` tenía 302 líneas; queda en 284 sin quitar tests). Integración conjunta con TASK-11, que comparte `App.tsx`.
- **Commit:** el de esta tarea (`[HU-03 TASK-12]`)


## 8. Reapertura · review ronda 1 (curado)
> Encargo adicional de `/implementar-hu` tras `review/REVIEW.md` (ronda 1, curado). Rigen las mismas secciones 2 a 6 de este
> brief. **La task es el contrato:** su sección «Reapertura · review ronda 1 (curado)».

- **Qué hacer:** Gate de QUALITY-GATES (≤ 50 líneas por función): `ConsentSection` tiene 57 y `useConsentActions` 56. Pártelos (p. ej. un subcomponente para el diálogo de retirada y un hook auxiliar para el foco) sin cambiar el comportamiento. Corrige además las etiquetas de ID de `apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx`: `:119` y `:198` dicen CA-24/CA-26 y prueban el fallo del consentimiento (CA-30); `:258` y `:270` dicen CA-28 y prueban la protección de la casilla en la web (pon «EC-49» o una descripción sin ID equivocado).
- **Ficheros:** `apps/web/src/features/candidates/ConsentSection.tsx`, `apps/web/src/features/candidates/use-consent-actions.ts` (y uno nuevo si extraes), `apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx`
- **Verificación que debes pegar:** `ConsentSection` y `useConsentActions` ≤ 50 líneas cada una (max-lines-per-function con skipBlankLines y skipComments); `npm test -w @ats/web -- CandidateDetailScreen` en verde; typecheck y eslint de los ficheros tocados a 0.

### Resultado de la integración (reapertura)
```
$ npm test -w apps/web -- candidates/api CandidateFormScreen candidate-form-model CandidateDetailScreen
 Test Files  9 passed (9)
      Tests  161 passed (161)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/test/features/candidates/api.test.ts apps/web/test/features/candidates/api.errors.test.ts apps/web/src/features/candidates/CandidateForm.tsx apps/web/src/features/candidates/CandidateFormScreen.tsx apps/web/src/features/candidates/ConsentSection.tsx apps/web/src/features/candidates/use-consent-actions.ts apps/web/src/features/candidates/use-consent-focus.ts apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx
exit=0
$ wc -l (ficheros tocados)
     148 apps/web/test/features/candidates/api.errors.test.ts
     174 apps/web/src/features/candidates/CandidateForm.tsx
     197 apps/web/src/features/candidates/CandidateFormScreen.tsx
     226 apps/web/test/features/candidates/api.test.ts
     279 apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx
    1277 total
INTEGRACION rc=0
```

- **Resultado:** en verde: `ConsentSection` y `useConsentActions` ≤ 50 (extraídos `RenewButton`, `WithdrawDialog`, `useWithdrawDialog` y `use-consent-focus.ts`); etiquetas CA-30 y EC-49 corregidas. gates.sh sin avisos en candidatos.

