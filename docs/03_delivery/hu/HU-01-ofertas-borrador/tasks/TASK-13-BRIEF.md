# Brief de implementación — HU-01 · TASK-13

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-01-ofertas-borrador/tasks/TASK-13.md` (criterios de done incluidos).
- **Diseño:** `docs/03_delivery/hu/HU-01-ofertas-borrador/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-03 (web), RF-01 y RF-02 (errores del servidor) · CA: CA-09, CA-10, CA-12 (web) · Edge cases: EC-01, EC-02,
    EC-09, EC-17 (413), EC-20, EC-21, EC-22, EC-25
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados (fila «Editar» y tabla «Formulario»), § Diagrama de
    secuencia RF-03, § Error paths (EC-01, EC-02, EC-09, EC-17, EC-20 a EC-25), DD-04, § Estrategia de tests (fila
    RF-03), § Checklist paso 6
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-01-ofertas-borrador` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): ea0d848 feat(web): create job form with client and server validation [HU-01 TASK-12]; 3680cfb feat(web): job detail screen and delete with confirmation [HU-01 TASK-11]; 4168da7 test(api): adversarial tests for create and edit [HU-01 TASK-06]; 942bad9 test(api): adversarial tests for delete, list and detail [HU-01 TASK-07]; d5051e9 feat(web): job list as the entry screen inside the app shell [HU-01 TASK-10]; 98a65e0 feat(api): edit and delete drafts with PATCH and DELETE /api/jobs/:id [HU-01 TASK-05]; e21a90c feat(api): job detail, first page of the list and draft seed [HU-01 TASK-04]; efa557c feat(api): create draft job openings with POST /api/jobs [HU-01 TASK-03]; 8c9f025 feat(web): HTTP client, date formatting and jobs API contract [HU-01 TASK-08]; f2c3248 feat(web): router, data loading and shared components [HU-01 TASK-09]; 24375a8 feat(api): add job_openings table with its constraints [HU-01 TASK-02]; d9a46d9 feat(api): strict Ajv, error envelope, clock and transactions [HU-01 TASK-01].
- **Dependencias de la task:**
  - **Depende de:** TASK-12. El `PATCH` real existe desde TASK-05.
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
- [x] **Reuso obligatorio**: `job-form-model.ts`, `JobForm.tsx` y `JobFormScreen.tsx` de TASK-12 (amplía `mode` a `'edit'`; el PATCH envía solo lo que cambia, `null` para vaciar un opcional, nunca `""`, y sin cambios no hay petición), `updateJob`/`getJob` de `apps/web/src/features/jobs/api.ts`, `navigate` con aviso «Cambios guardados.» y `use-resource.ts`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Un 5xx sin envelope llega como `CLIENT_NETWORK` (mensaje de conexión); «Error interno. Inténtalo de nuevo.» solo con el envelope `INTERNAL_ERROR`. El 413 llega con envelope `PAYLOAD_TOO_LARGE`.

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
 Test Files  4 passed (4)
      Tests  66 passed (66)
exit=0
$ npm run typecheck
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/jobs/job-form-model.ts apps/web/src/features/jobs/JobFormScreen.tsx apps/web/src/features/jobs/JobDetailScreen.tsx apps/web/src/App.tsx apps/web/test/features/jobs/job-form-model.test.ts apps/web/test/features/jobs/JobFormScreen.test.tsx apps/web/test/features/jobs/JobFormScreen.edit.test.tsx
exit=0
$ wc -l (ficheros tocados)
     161 apps/web/src/features/jobs/job-form-model.ts
     194 apps/web/src/features/jobs/JobFormScreen.tsx
     199 apps/web/test/features/jobs/JobFormScreen.edit.test.tsx
     258 apps/web/test/features/jobs/job-form-model.test.ts
     282 apps/web/test/features/jobs/JobFormScreen.test.tsx
    1249 total
$ npx playwright test e2e/smoke.spec.ts
  ✓  1 [chromium] › e2e/smoke.spec.ts:5:1 › la entrada es el listado de ofertas y muestra el estado de la API (826ms)
  1 passed (2.4s)
exit=0
INTEGRACION rc=0
```

- **Resultado:** verde a la primera (sin ciclos de arreglo). Fuera de la tabla: apps/web/test/features/jobs/JobFormScreen.edit.test.tsx (nuevo, por el umbral de 300 líneas) y apps/web/src/features/jobs/JobDetailScreen.tsx (solo exporta NotFound e isNotFound para reutilizarlos)
- **Commit:** el de esta tarea (`[HU-01 TASK-13]`)

