# Brief de implementación — HU-01 · TASK-12

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-01-ofertas-borrador/tasks/TASK-12.md` (criterios de done incluidos).
- **Diseño:** `docs/03_delivery/hu/HU-01-ofertas-borrador/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01, RF-02 (web) · RNF: RNF-05 · CA: CA-01, CA-02, CA-03, CA-04, CA-05, CA-06, CA-07 (web) · Edge cases:
    EC-02 (`toCreateInput` sin campos de solo lectura), EC-03, EC-04, EC-05, EC-10, EC-11, EC-12, EC-13, EC-17 (cliente)
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados (fila «Nueva oferta» y tabla «Formulario»),
    § Diagrama de secuencia RF-01/RF-02, § Error paths (EC-02 a EC-17), DD-04, § Estrategia de tests (filas RF-01 y
    RF-02), § Checklist paso 6
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-01-ofertas-borrador` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 3680cfb feat(web): job detail screen and delete with confirmation [HU-01 TASK-11]; 4168da7 test(api): adversarial tests for create and edit [HU-01 TASK-06]; 942bad9 test(api): adversarial tests for delete, list and detail [HU-01 TASK-07]; d5051e9 feat(web): job list as the entry screen inside the app shell [HU-01 TASK-10]; 98a65e0 feat(api): edit and delete drafts with PATCH and DELETE /api/jobs/:id [HU-01 TASK-05]; e21a90c feat(api): job detail, first page of the list and draft seed [HU-01 TASK-04]; efa557c feat(api): create draft job openings with POST /api/jobs [HU-01 TASK-03]; 8c9f025 feat(web): HTTP client, date formatting and jobs API contract [HU-01 TASK-08]; f2c3248 feat(web): router, data loading and shared components [HU-01 TASK-09]; 24375a8 feat(api): add job_openings table with its constraints [HU-01 TASK-02]; d9a46d9 feat(api): strict Ajv, error envelope, clock and transactions [HU-01 TASK-01]; 69c8873 docs(HU-01): tasks and roadmap.
- **Dependencias de la task:**
  - **Depende de:** TASK-11 (`App.tsx`; la ficha a la que se navega). El `POST` real existe desde TASK-03.
  - **Bloquea:** TASK-13
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
- [x] **Reuso obligatorio**: `FormField` (`apps/web/src/components/FormField.tsx`, render prop con `id`, `aria-invalid` y `aria-describedby`), `router.tsx` (`navigate` con aviso «Oferta creada.»), el contrato de `apps/web/src/features/jobs/` (`api.ts` `createJob`, `types.ts` `WORK_MODES`, `paths.ts`) y el *shell* de `apps/web/src/App.tsx`; helpers `apps/web/test/helpers/fetch.ts`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Aviso de TASK-11: `matchPath('/jobs/:id', '/jobs/new')` también casa; declara `/jobs/new` antes que `/jobs/:id` en `resolveScreen` de `App.tsx`. Longitudes en puntos de código con `[...texto].length`, nunca `text.length` ni el atributo `maxLength` de HTML.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/web -- job-form-model JobFormScreen App.test` en verde, con **3** ficheros de test ejecutados.
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
$ npm test -w apps/web -- job-form-model JobFormScreen App.test
 Test Files  3 passed (3)
      Tests  44 passed (44)
exit=0
$ npm run typecheck
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/jobs/job-form-model.ts apps/web/src/features/jobs/JobForm.tsx apps/web/src/features/jobs/JobFormScreen.tsx apps/web/src/App.tsx apps/web/test/features/jobs/job-form-model.test.ts apps/web/test/features/jobs/JobFormScreen.test.tsx
exit=0
$ wc -l (ficheros tocados)
     108 apps/web/src/features/jobs/JobFormScreen.tsx
     121 apps/web/src/features/jobs/job-form-model.ts
     132 apps/web/src/features/jobs/JobForm.tsx
     150 apps/web/test/features/jobs/job-form-model.test.ts
     241 apps/web/test/features/jobs/JobFormScreen.test.tsx
     842 total
$ npx playwright test e2e/smoke.spec.ts
  ✓  1 [chromium] › e2e/smoke.spec.ts:5:1 › la entrada es el listado de ofertas y muestra el estado de la API (527ms)
  1 passed (1.8s)
exit=0
INTEGRACION rc=0
```

- **Resultado:** verde a la primera (sin ciclos de arreglo)
- **Commit:** el de esta tarea (`[HU-01 TASK-12]`)

