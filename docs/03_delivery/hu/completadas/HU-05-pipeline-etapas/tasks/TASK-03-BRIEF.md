# Brief de implementación — HU-05 · TASK-03

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-05-pipeline-etapas/tasks/TASK-03.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-05-pipeline-etapas/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01 · CA: CA-01, CA-03, CA-04, CA-05, CA-06, CA-07, CA-08, CA-10, CA-39 · EC: EC-03, EC-04, EC-08, EC-10 ·
    DD-02, DD-03, DD-05, DD-07, DD-09, DD-10
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (Endpoints, Orden de comprobación), § Firmas internas,
    § Diagrama de secuencia, DD-02, DD-03, DD-05, DD-07, DD-09, DD-10, § Estrategia de tests, § Checklist B-03
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-05-pipeline-etapas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): b9126eb feat(web): card and duplicate links to the application; View pipeline on closed jobs [HU-05 TASK-11]; 59bb095 feat(web): stage change client, detail types and reject form rules [HU-05 TASK-09]; 332e012 feat(api): stage reads, guarded stage update and job summary port [HU-05 TASK-02]; 89e4364 refactor(api): applications use cases as module functions; pure stage transitions [HU-05 TASK-01]; f147bb3 docs(HU-05): tasks and roadmap; PRD errata RV-23; 7e75f59 docs(HU-05): technical design; PRD v1.2 (id pattern, error order); 93f4f43 fix(api): recursive triggers on, so REPLACE cannot rewrite the stage history [T-05]; 92b4de5 docs(HU-05): PRD; 4de1c7f docs(HU-06): new HU for closing a job with active applications; UC-19 and UC-04 A1 move out of HU-05.
- **Dependencias de la task:**
  - **Depende de:** TASK-01, TASK-02
  - **Bloquea:** TASK-04, TASK-06, TASK-07, TASK-08, TASK-12, TASK-15
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
- [x] **Reuso obligatorio**: lo de TASK-01/02: `decideAdvance` de `transitions.ts`, `updateStage` con la guarda en el WHERE, `insertStageChange`, `recalculateRetention` (solo hacia hired), `withTransaction`, el patrón de rutas de `apps/api/src/modules/applications/routes.ts` y `NO_CONTROL_CHARS*`/`idParamsSchema` de `apps/api/src/http/validation.ts`; helpers `advance` e `insertApplicationAt`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Condiciones del aprobador en el done: el test del reintento con la esperada desactualizada (DT-13) y el test de DT-09 con «HU-06 lo revisa» en el nombre.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/api -- applications/advance` en verde con **2** ficheros. En `advance.test.ts`, con reloj
- [x] `npm test -w @ats/api -- applications/ module-boundaries` en verde con **20** ficheros.
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
$ npm test -w apps/api -- applications/advance
 Test Files  2 passed (2)
      Tests  16 passed (16)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  63 passed (63)
      Tests  1004 passed (1004)
exit=0
$ npm run typecheck -w @ats/api
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/modules/applications/schemas.ts apps/api/src/modules/applications/service.ts apps/api/src/modules/applications/routes.ts apps/api/test/applications/advance.test.ts apps/api/test/applications/advance-hire.test.ts
exit=0
$ wc -l (ficheros tocados)
      52 apps/api/src/modules/applications/routes.ts
     131 apps/api/test/applications/advance-hire.test.ts
     151 apps/api/src/modules/applications/schemas.ts
     180 apps/api/src/modules/applications/service.ts
     291 apps/api/test/applications/advance.test.ts
     805 total
INTEGRACION rc=0
```

- **Resultado:** en verde. Tests de las condiciones del aprobador: «RV-23 (DT-13) en interview, esperada screening (desactualizada) y destino interview → 200 sin escrituras…» y «CA-39 (DT-09, HU-06 lo revisa) activa de una oferta closed → advance 200…» (`apps/api/test/applications/advance.test.ts`). Las funciones de src cumplen; gates.sh solo marca callbacks de `describe` de tests (fuera del umbral de src).
- **Commit:** el de esta tarea (`[HU-05 TASK-03]`)

