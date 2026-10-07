# Brief de implementación — HU-04 · TASK-06

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-04-inscribir-candidato/tasks/TASK-06.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-04-inscribir-candidato/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-11, RF-10 (fecha con `lastProcessClosedAt`) · RNF: RNF-01, RNF-02 · CA: CA-25 · Edge cases: EC-51, EC-54,
    EC-55, EC-56, EC-57
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Migración de datos › Seed, DD-10, § Estrategia de tests (CA-25, RNF-01,
    RNF-02, «Tests que cambian»), § Checklist B-06
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-04-inscribir-candidato` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 1768242 test(api): enrollment under dependency failures and personal data in logs [HU-04 TASK-08]; babda45 test(api): enrollment against hostile input and concurrency [HU-04 TASK-07]; a15014e feat(api): job pipeline (GET /api/jobs/:jobId/applications) [HU-04 TASK-05]; 4eb138f feat(api): enroll a candidate in a published job (POST /api/applications) [HU-04 TASK-04]; bee8422 feat(api): module ports for job status, candidate lookups and real candidate processes [HU-04 TASK-03]; 53296b3 feat(web): applications client, pipeline types, useResource.reload and focusable Notice [HU-04 TASK-10]; a1e7b64 feat(api): applications and stage changes tables, immutable history; DEC-06 clarification [HU-04 TASK-01]; 4a99223 fix(api): guard job edit and delete by status in SQL (SEC-02) [HU-04 TASK-02]; 01e33ac docs(HU-04): tasks and roadmap; PRD v1.1 (trigger note exception, not-found page); b50e5da docs(HU-04): technical design; 279fed8 docs(HU-04): PRD; 7de646c Merge sprint integration (T-04) into HU-04.
- **Dependencias de la task:**
  - **Depende de:** TASK-03 (`insertApplicationWithHistory`, lector real), TASK-04 y TASK-05 (el rendimiento mide sus
    endpoints)
  - **Bloquea:** TASK-09, TASK-15
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
- [x] **Reuso obligatorio**: `apps/api/src/db/{seed,seed-candidates,seed-applications}.ts` (con `insertApplicationWithHistory` de TASK-03), `recalculateRetention` con el puerto real y el estilo de `apps/api/test/candidates/{seed,performance}.test.ts`; teléfonos `+34 600 000 0xx`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. En paralelo, TASK-11 trabaja en `apps/web` y en `e2e/jobs-lifecycle.spec.ts`: no los toques. Los e2e existentes cuentan ofertas y candidatos: no cambies lo que cuentan.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/api -- seed performance` en verde, con **7** ficheros de test (`applications/seed`,
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
$ npm test -w apps/api -- seed performance
 Test Files  7 passed (7)
      Tests  32 passed (32)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  56 passed (56)
      Tests  683 passed (683)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/db/seed-applications.ts apps/api/src/db/seed.ts apps/api/src/db/seed-candidates.ts apps/api/test/applications/seed.test.ts apps/api/test/applications/seed-invariants.test.ts apps/api/test/applications/performance.test.ts apps/api/test/candidates/seed.test.ts
exit=0
$ wc -l (ficheros tocados)
     166 apps/api/src/db/seed.ts
     203 apps/api/src/db/seed-candidates.ts
     244 apps/api/src/db/seed-applications.ts
     256 apps/api/test/applications/seed-invariants.test.ts
     278 apps/api/test/applications/seed.test.ts
    1414 total
INTEGRACION rc=0
```

- **Resultado:** en verde. `npm run db:reset` (×2): 40 inscripciones, 115 StageChange, 10 ofertas y 30 candidatos (15 con retención null). Los e2e de jobs, jobs-list, candidates y candidates-list (25) pasan con el seed nuevo (builder).
- **Commit:** el de esta tarea (`[HU-04 TASK-06]`)

