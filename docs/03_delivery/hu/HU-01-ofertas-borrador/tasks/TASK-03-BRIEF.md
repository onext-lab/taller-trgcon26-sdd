# Brief de implementación — HU-01 · TASK-03

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-01-ofertas-borrador/tasks/TASK-03.md` (criterios de done incluidos).
- **Diseño:** `docs/03_delivery/hu/HU-01-ofertas-borrador/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01, RF-02 · CA: CA-01 (parte API; el «aparece en el listado» lo añade TASK-04), CA-02, CA-03, CA-04, CA-05,
    CA-06, CA-07 (mínimo > máximo y EC-13) · Edge cases: EC-03, EC-04, EC-06, EC-09, EC-10, EC-12, EC-13
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (Convenciones, Esquemas compartidos, Endpoints › `POST`),
    § Firmas internas, § Diagrama de secuencia RF-01 y RF-02, DD-01, DD-04, DD-09, DD-12
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-01-ofertas-borrador` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 24375a8 feat(api): add job_openings table with its constraints [HU-01 TASK-02]; d9a46d9 feat(api): strict Ajv, error envelope, clock and transactions [HU-01 TASK-01]; 69c8873 docs(HU-01): tasks and roadmap; 47a9c86 docs(HU-01): technical design; f46dad7 docs(HU-01): PRD; 763017e docs(HU-01): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-02
  - **Bloquea:** TASK-04
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
- [x] **Reuso obligatorio**: `AppError`, `notFound` y `validationError` (`apps/api/src/errors.ts`), `trimTextFields` e `idParamsSchema` (`apps/api/src/http/validation.ts`), `withTransaction` (`apps/api/src/db/transaction.ts`), `Clock` (`apps/api/src/clock.ts`) y `createTestApp`/`createTestClock`/`failWrites` (`apps/api/test/helpers/test-app.ts`), todo de TASK-01 y TASK-02.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Sin clave natural no hay idempotencia (DT-03 del PRD): dos POST crean dos borradores.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- create health` en verde, con **2** ficheros de test ejecutados.
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
$ npm test -w apps/api -- create health
 Test Files  2 passed (2)
      Tests  29 passed (29)
exit=0
$ npm run typecheck
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/modules/jobs/schemas.ts apps/api/src/modules/jobs/repository.ts apps/api/src/modules/jobs/service.ts apps/api/src/modules/jobs/routes.ts apps/api/src/app.ts apps/api/test/helpers/test-app.ts apps/api/test/jobs/create.test.ts
exit=0
$ wc -l (ficheros tocados)
      55 apps/api/src/app.ts
      60 apps/api/test/helpers/test-app.ts
      61 apps/api/src/modules/jobs/repository.ts
     103 apps/api/src/modules/jobs/schemas.ts
     226 apps/api/test/jobs/create.test.ts
     577 total
INTEGRACION rc=0
```

- **Resultado:** verde a la primera (sin ciclos de arreglo)
- **Commit:** el de esta tarea (`[HU-01 TASK-03]`)


## 8. Reapertura · review ronda 1
> Encargo adicional de `/implementar-hu` tras `review/REVIEW-ronda-1.md` (ronda 1). Rigen las mismas secciones 2 a 6 de este
> brief. **La task es el contrato:** su sección «Reapertura · review ronda 1».

- **Qué hacer:** EC-50 (nuevo en el PRD v1.1, DT-05; regla común en DEC-11 punto 8): rechazar con 400 `VALIDATION_ERROR` los caracteres de control C0 (U+0000-U+001F) y DEL (U+007F) en `title` y `location`, y en `description` todos salvo `\n`, `\r` y `\t`, en el alta y en la edición, sin guardar nada. Hazlo en el JSON Schema (`pattern` en `JobFields` de `apps/api/src/modules/jobs/schemas.ts`; Ajv con `unicode`), de forma que `details` lleve el campo y el mensaje de *keyword* `pattern` («Formato no válido.»), o con un mensaje propio si lo justificas. Reutilizable por candidatos (exporta los patrones desde `apps/api/src/http/validation.ts` si encaja). Tests en un fichero nuevo `apps/api/test/jobs/control-chars.test.ts`, con nombres «EC-50»: NUL al principio, en medio y al final; U+0001, U+001F y U+007F; tabulador y salto de línea en la descripción aceptados y en el título rechazados; alta y edición; y que tras cada rechazo no hay filas nuevas ni cambios.
- **Ficheros:** `apps/api/src/modules/jobs/schemas.ts`, `apps/api/src/http/validation.ts` (si exportas los patrones), `apps/api/test/jobs/control-chars.test.ts` (crear)
- **Verificación que debes pegar:** `npm test -w apps/api` completo en verde; `npm test -w apps/api -- control-chars` con 1 fichero; `npm run typecheck`; `npx eslint` de los ficheros tocados; repetir la sonda: `"a\u0000bcdef"` → 400.

### Resultado de la integración (reapertura)
```
$ npm test -w apps/api -- control-chars
 Test Files  1 passed (1)
      Tests  35 passed (35)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  15 passed (15)
      Tests  165 passed (165)
exit=0
$ npm run typecheck
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/http/validation.ts apps/api/src/modules/jobs/schemas.ts apps/api/test/jobs/control-chars.test.ts
exit=0
$ wc -l (ficheros tocados)
      54 apps/api/src/http/validation.ts
     158 apps/api/src/modules/jobs/schemas.ts
     192 apps/api/test/jobs/control-chars.test.ts
     404 total
INTEGRACION rc=0
"a\u0000bcdef" 400 {"error":{"code":"VALIDATION_ERROR","message":"Hay campos con errores.","details":[{"field":"title","message":"Formato n
"abcdef\u0000" 400 {"error":{"code":"VALIDATION_ERROR","message":"Hay campos con errores.","details":[{"field":"title","message":"Formato n
"\u0000\u0000\u0000" 400 {"error":{"code":"VALIDATION_ERROR","message":"Hay campos con errores.","details":[{"field":"title","message":"Formato n
"ok título" 201 {"id":1,"title":"ok título","description":null,"location":null,"workMode":null,"salaryMin":null,"salaryMax":null,"status
```

- **Resultado:** verde; EC-50 con pattern en JobFields (patrones NO_CONTROL_CHARS y NO_CONTROL_CHARS_EXCEPT_WHITESPACE exportados desde validation.ts para candidatos); 35 tests EC-50; la sonda de la review pasa de 500 a 400

