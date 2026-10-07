# Brief de implementación — HU-02 · TASK-11

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/tasks/TASK-11.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-03 (web) · RNF: RNF-05 · CA: CA-10, CA-11, CA-12 · Edge cases: EC-17, EC-19, EC-44
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Editar, § Diagrama de secuencia RF-03, § Error paths
    (EC-17, EC-19, EC-21, EC-44), DD-06, DD-08, § Estrategia de tests (fila RF-03), § Checklist paso 6 y «Umbrales»
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-02-ciclo-vida-ofertas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): b7d4778 test(api): adversarial tests for status rules and list filters [HU-02 TASK-06]; 211315e feat(api): job list filters, accent-insensitive search and pagination [HU-02 TASK-05]; 6c7e58a feat(web): job detail by status and close confirmation [HU-02 TASK-09]; d1659f4 test(api): adversarial tests for publish, close and duplicate [HU-02 TASK-04]; 8996219 feat(api): enforce job status on edit and delete [HU-02 TASK-03]; c9bd3c1 feat(api): publish, close and duplicate job openings [HU-02 TASK-02]; fa59f93 feat(web): search params, setData, dialog props and lifecycle API client [HU-02 TASK-07]; 901426a feat(api): cross-site write guard, applications port and 10-job seed [HU-02 TASK-01]; 7c4b690 docs(HU-02): tasks and roadmap; 17887f5 docs(HU-02): technical design; 7355db9 docs(HU-02): PRD; 5136493 docs(HU-02): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-03 (409 y 400 de `PATCH`/`DELETE` según el estado), TASK-09 (`JobActions` y la alerta de acción
    del contenedor)
  - **Bloquea:** TASK-12, TASK-14
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
- [x] **Reuso obligatorio**: el formulario de HU-01 (`job-form-model.ts`, `JobForm.tsx`, `JobFormScreen.tsx`), `JobActions.tsx` y `DeleteJobAction.tsx` (con la prop `disabled`) de TASK-09 y `missingFieldsText`/`jobFieldLabel` de `labels.ts`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Hueco aceptado: `ClosedJobNotice` vive en `JobFormScreen.tsx` (hoy 194 líneas; si pasa de 300, dilo). Otros builders trabajan a la vez en `JobDetailScreen.tsx`/`use-job-actions.ts` (TASK-10) y en el listado (TASK-08): no toques sus ficheros.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/web -- job-form-model JobFormScreen DeleteJobAction JobDetailScreen` en verde, con **10**
- [x] `npm test -w apps/web` completo en verde.
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
$ npm test -w apps/web -- job-form-model JobFormScreen DeleteJobAction JobDetailScreen
 Test Files  10 passed (10)
      Tests  126 passed (126)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  24 passed (24)
      Tests  290 passed (290)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  24 passed (24)
      Tests  290 passed (290)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  24 passed (24)
      Tests  290 passed (290)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/jobs/job-form-model.ts apps/web/src/features/jobs/JobForm.tsx apps/web/src/features/jobs/job-form-errors.ts apps/web/src/features/jobs/JobFormScreen.tsx apps/web/src/features/jobs/DeleteJobAction.tsx apps/web/src/features/jobs/JobActions.tsx apps/web/test/features/jobs/job-form-model.published.test.ts apps/web/test/features/jobs/JobFormScreen.published.test.tsx
exit=0
$ wc -l (ficheros tocados)
     112 apps/web/test/features/jobs/job-form-model.published.test.ts
     149 apps/web/src/features/jobs/JobForm.tsx
     184 apps/web/src/features/jobs/job-form-model.ts
     216 apps/web/src/features/jobs/JobFormScreen.tsx
     222 apps/web/test/features/jobs/JobFormScreen.published.test.tsx
    1080 total
INTEGRACION rc=0
```

- **Resultado:** verde a la primera (web-builder); suite web completa 3 veces seguidas en verde, lo que descarta el rojo transitorio que vio TASK-13 mientras esta tarea escribía
- **Commit:** el de esta tarea (`[HU-02 TASK-11]`)


## 8. Reapertura · review ronda 1
> Encargo adicional de `/implementar-hu` tras `review/REVIEW-ronda-1.md` (ronda 1). Rigen las mismas secciones 2 a 6 de este
> brief. **La task es el contrato:** su sección «Reapertura · review ronda 1».

- **Qué hacer:** `splitServerError` (`apps/web/src/features/jobs/job-form-errors.ts:18`) tiene unas 14 ramas y el umbral es 10: pásalo a funciones pequeñas o a una tabla de clasificación (404, 409, 400 con details, resto) sin cambiar su comportamiento ni sus textos.
- **Ficheros:** `apps/web/src/features/jobs/job-form-errors.ts`
- **Verificación que debes pegar:** `npm test -w @ats/web -- JobFormScreen job-form` en verde con el mismo número de tests que antes; `npm run typecheck -w @ats/web`; `npx eslint` del fichero; ninguna función pasa de 10 ramas (justifícalo).

### Resultado de la integración (reapertura)
```
$ npm test -w apps/web -- JobFormScreen job-form
 Test Files  6 passed (6)
      Tests  90 passed (90)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/jobs/job-form-errors.ts
exit=0
$ wc -l (ficheros tocados)
      41 apps/web/src/features/jobs/job-form-errors.ts
INTEGRACION rc=0
```

- **Resultado:** verde; splitServerError (5 ramas) delega el 400 en splitValidationError (6); 90 tests antes y después

