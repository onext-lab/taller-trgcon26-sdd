# Brief de implementación — HU-02 · TASK-02

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/tasks/TASK-02.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01, RF-02, RF-04 (API) · CA: CA-01, CA-02, CA-05, CA-06 (API), CA-07, CA-14, CA-15 · Edge cases: EC-03, EC-04,
    EC-07, EC-09, EC-11, EC-13, EC-16, EC-26, EC-28, EC-31, EC-42 (API)
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API › Endpoints y Convenciones, § Firmas internas, § Diagrama
    de secuencia RF-01, RF-02 y RF-04, DD-02, DD-07, DD-08, DD-09, DD-11, § Checklist pasos 4, 5 y 6
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-02-ciclo-vida-ofertas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 901426a feat(api): cross-site write guard, applications port and 10-job seed [HU-02 TASK-01]; 7c4b690 docs(HU-02): tasks and roadmap; 17887f5 docs(HU-02): technical design; 7355db9 docs(HU-02): PRD; 5136493 docs(HU-02): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-01
  - **Bloquea:** TASK-03, TASK-04, TASK-09
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
- [x] **Reuso obligatorio**: lo de TASK-01 (`invalidTransition` en `apps/api/src/errors.ts`, `rejectBody` en `apps/api/src/http/validation.ts`, `JobApplicationsPort` en `apps/api/src/modules/jobs/applications-port.ts`, `markPublished`/`markClosed` en `repository.ts`, `createApplicationsSpy` en `apps/api/test/helpers/test-app.ts`) y el módulo `apps/api/src/modules/jobs/` con `withTransaction`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Las acciones son POST sin cuerpo (DEC-12 ya protege las escrituras desde otro sitio).

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- publish close duplicate` en verde, con **3** ficheros de test ejecutados.
- [x] `npm test -w apps/api` completo en verde (`create*.test.ts` sigue igual tras mover `assertSalaryRange`).
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
$ npm test -w apps/api -- publish close duplicate
 Test Files  3 passed (3)
      Tests  12 passed (12)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  19 passed (19)
      Tests  198 passed (198)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/modules/jobs/rules.ts apps/api/src/modules/jobs/schemas.ts apps/api/src/modules/jobs/service.ts apps/api/src/modules/jobs/routes.ts apps/api/test/helpers/test-app.ts apps/api/test/jobs/publish.test.ts apps/api/test/jobs/close.test.ts apps/api/test/jobs/duplicate.test.ts
exit=0
$ wc -l (ficheros tocados)
     111 apps/api/test/jobs/duplicate.test.ts
     119 apps/api/test/jobs/publish.test.ts
     133 apps/api/src/modules/jobs/service.ts
     139 apps/api/test/helpers/test-app.ts
     171 apps/api/src/modules/jobs/schemas.ts
     932 total
INTEGRACION rc=0
```

- **Resultado:** verde a la primera (api-builder)
- **Commit:** el de esta tarea (`[HU-02 TASK-02]`)

