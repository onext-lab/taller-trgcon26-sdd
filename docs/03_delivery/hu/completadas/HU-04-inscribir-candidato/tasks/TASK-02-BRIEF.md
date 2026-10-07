# Brief de implementación — HU-04 · TASK-02

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-04-inscribir-candidato/tasks/TASK-02.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-04-inscribir-candidato/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-12 · CA: CA-22
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (pieza 5), DD-09, § Estrategia de tests › SEC-02 (B-02),
    § Checklist B-02
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-04-inscribir-candidato` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 01e33ac docs(HU-04): tasks and roadmap; PRD v1.1 (trigger note exception, not-found page); b50e5da docs(HU-04): technical design; 279fed8 docs(HU-04): PRD; 7de646c Merge sprint integration (T-04) into HU-04; 27dca1a docs(HU-04): PRD draft, open questions; b7db2d7 docs(HU-04): move UC-18 detail and history to HU-05; HU-04 also touches ofertas.
- **Dependencias de la task:**
  - **Depende de:** nada (puede ir en paralelo con TASK-01: no comparten ficheros)
  - **Bloquea:** TASK-03 (que también modifica `apps/api/src/modules/jobs/repository.ts`)
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
- [x] **Reuso obligatorio**: `apps/api/src/modules/jobs/{repository,service,rules}.ts`, `AppError`/`INVALID_TRANSITION` de `apps/api/src/errors.ts`, `failWrites` de `apps/api/test/helpers/test-app.ts` y los tests de jobs existentes como regresión.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Orden obligatorio: la regresión de las respuestas de ofertas se escribe y pasa ANTES de tocar el SQL de jobs; pega esa salida. En paralelo: TASK-01 (migración 003, DECISIONS.md, candidates/migration.test.ts) y TASK-10 (`apps/web`); no los toques.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] **Antes de tocar producción:** `npm test -w @ats/api -- jobs/state-guards` en verde (1 fichero) con el código
- [x] **Después:** `npm test -w @ats/api -- jobs/state-guards` en verde, con la regresión sin tocar.
- [x] `npm test -w @ats/api -- jobs` en verde (20 ficheros): `update.test.ts`, `delete.test.ts`,
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
$ npm test -w apps/api -- jobs
 Test Files  20 passed (20)
      Tests  256 passed (256)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  45 passed (45)
      Tests  593 passed (593)
exit=0
$ npm run typecheck -w @ats/api
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/modules/jobs/repository.ts apps/api/src/modules/jobs/service.ts apps/api/test/jobs/state-guards.test.ts
exit=0
$ wc -l (ficheros tocados)
     155 apps/api/src/modules/jobs/service.ts
     168 apps/api/src/modules/jobs/repository.ts
     228 apps/api/test/jobs/state-guards.test.ts
     551 total
INTEGRACION rc=0
```

- **Resultado:** en verde. La regresión de ofertas (8 tests) pasó ANTES de tocar el SQL (`-t regresi`: 8 passed, 5 skipped, los de CA-22) y DESPUÉS (13/13). SQL: `UPDATE … WHERE id = ? AND status IN ('draft','published')` y `DELETE … WHERE id = ? AND status = 'draft'`; con 0 filas, 409 `INVALID_TRANSITION`.
- **Commit:** el de esta tarea (`[HU-04 TASK-02]`)

