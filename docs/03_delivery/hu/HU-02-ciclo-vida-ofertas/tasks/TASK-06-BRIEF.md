# Brief de implementación — HU-02 · TASK-06

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/tasks/TASK-06.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-03, RF-05 (API) · RNF: RNF-03, RNF-06 · CA: CA-13 (repetición), CA-19, CA-20, CA-21 · Edge cases: EC-18,
    EC-20, EC-21, EC-23, EC-24, EC-32, EC-33, EC-34 (`pageSize` 101, `q` 101), EC-39
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (orden de comprobación; tabla de mensajes de la
    querystring), § Error paths (EC-18 a EC-24, EC-32 a EC-34, EC-39), DD-05, § Estrategia de tests (filas
    `[adversarial]` de RF-03 y RF-05, RNF-06)
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-02-ciclo-vida-ofertas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 211315e feat(api): job list filters, accent-insensitive search and pagination [HU-02 TASK-05]; 6c7e58a feat(web): job detail by status and close confirmation [HU-02 TASK-09]; d1659f4 test(api): adversarial tests for publish, close and duplicate [HU-02 TASK-04]; 8996219 feat(api): enforce job status on edit and delete [HU-02 TASK-03]; c9bd3c1 feat(api): publish, close and duplicate job openings [HU-02 TASK-02]; fa59f93 feat(web): search params, setData, dialog props and lifecycle API client [HU-02 TASK-07]; 901426a feat(api): cross-site write guard, applications port and 10-job seed [HU-02 TASK-01]; 7c4b690 docs(HU-02): tasks and roadmap; 17887f5 docs(HU-02): technical design; 7355db9 docs(HU-02): PRD; 5136493 docs(HU-02): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-03, TASK-05
  - **Bloquea:** nada (va en paralelo con las tareas de la web)
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
- [x] **Reuso obligatorio**: `apps/api/test/jobs/status-rules.test.ts` (añade, no reescribas), el listado de TASK-05 (`list-filters.test.ts` como modelo) y los helpers de `apps/api/test/helpers/test-app.ts` (`failWrites`, `createPublishedJob`, `closeJob`).
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Tarea [adversarial]: si un test destapa un fallo real en `src`, NO lo arregles: déjalo en rojo y repórtalo. Si `status-rules.test.ts` (254 líneas) pasa de 300, pon lo nuevo en un hermano y dilo.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- status-rules list-filters-adversarial` en verde, con **2** ficheros de test ejecutados
- [x] `npm test -w apps/api` completo en verde.
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
$ npm test -w apps/api -- status-rules list-filters-adversarial
 Test Files  3 passed (3)
      Tests  45 passed (45)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  24 passed (24)
      Tests  294 passed (294)
exit=0
$ npm run typecheck -w @ats/api
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/test/jobs/status-rules-adversarial.test.ts apps/api/test/jobs/list-filters-adversarial.test.ts
exit=0
$ wc -l (ficheros tocados)
     167 apps/api/test/jobs/status-rules-adversarial.test.ts
     176 apps/api/test/jobs/list-filters-adversarial.test.ts
     343 total
INTEGRACION rc=0
```

- **Resultado:** verde a la primera; sin fallos de src. Hermano status-rules-adversarial.test.ts por el umbral de 300 líneas (previsto en la task)
- **Commit:** el de esta tarea (`[HU-02 TASK-06]`)

