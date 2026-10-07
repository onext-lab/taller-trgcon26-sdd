# Brief de implementación — HU-05 · TASK-01

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-05-pipeline-etapas/tasks/TASK-01.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-05-pipeline-etapas/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-09 (primer punto) · base de RF-01 y RF-02 · CA: CA-38 (factoría) · DD-01, DD-05, DD-06
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (1 y 2), § Orden de comprobación (DT-02, DD-05),
    § Firmas internas, DD-01, DD-05, DD-06, § Checklist B-01
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-05-pipeline-etapas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): f147bb3 docs(HU-05): tasks and roadmap; PRD errata RV-23; 7e75f59 docs(HU-05): technical design; PRD v1.2 (id pattern, error order); 93f4f43 fix(api): recursive triggers on, so REPLACE cannot rewrite the stage history [T-05]; 92b4de5 docs(HU-05): PRD; 4de1c7f docs(HU-06): new HU for closing a job with active applications; UC-19 and UC-04 A1 move out of HU-05.
- **Dependencias de la task:**
  - **Depende de:** nada
  - **Bloquea:** TASK-02, TASK-03
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
- [x] **Reuso obligatorio**: el patrón de `apps/api/src/modules/applications/{service,repository,schemas,ports}.ts` (HU-04), `invalidTransition`/`duplicate` de `apps/api/src/errors.ts` y las suites de `apps/api/test/applications/` como regresión del refactor.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. En paralelo, TASK-09 y TASK-11 trabajan en `apps/web`: no lo toques. RF-09: el refactor no cambia comportamiento; la suite de applications sigue en verde sin tocar sus tests.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] Antes de crear `transitions.ts`: `npm test -w @ats/api -- applications/ module-boundaries` en verde con **16**
- [x] `npm test -w @ats/api -- applications/transitions` en verde con **1** fichero:
- [x] `npm test -w @ats/api -- applications/ module-boundaries` en verde con **17** ficheros al terminar.
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
$ npm test -w apps/api -- applications/ module-boundaries
 Test Files  17 passed (17)
      Tests  406 passed (406)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  60 passed (60)
      Tests  979 passed (979)
exit=0
$ npm run typecheck -w @ats/api
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/modules/applications/service.ts apps/api/src/modules/applications/transitions.ts apps/api/src/errors.ts apps/api/test/applications/transitions.test.ts
exit=0
$ wc -l (ficheros tocados)
      47 apps/api/src/errors.ts
      50 apps/api/src/modules/applications/transitions.ts
     118 apps/api/src/modules/applications/service.ts
     194 apps/api/test/applications/transitions.test.ts
     409 total
INTEGRACION rc=0
```

- **Resultado:** en verde. Refactor RF-09 sin tocar tests: la suite de applications pasó antes de añadir `transitions.ts` (16 files / 147 tests). `createApplicationsService` queda en 6 líneas. `transitions.test.ts` cubre las 216 combinaciones de avanzar y las 36 de rechazar.
- **Commit:** el de esta tarea (`[HU-05 TASK-01]`)

