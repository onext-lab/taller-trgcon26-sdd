# Brief de implementación — HU-02 · TASK-01

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/tasks/TASK-01.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-07 (seed) · base de RF-01, RF-02 y RF-04 · DEC-12 · CA: CA-24 · Edge cases: EC-49 (rutas de HU-01)
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico, § Contrato de API › Convenciones y tabla de errores
    (403, 409), § Firmas internas (`applications-port.ts`, `AppOptions`, `markPublished`/`markClosed`), § Migración de
    datos › Seed, DD-01, DD-03, DD-06, DD-08, DD-10, § Checklist pasos 1, 2 y 8
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-02-ciclo-vida-ofertas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 7c4b690 docs(HU-02): tasks and roadmap; 17887f5 docs(HU-02): technical design; 7355db9 docs(HU-02): PRD; 5136493 docs(HU-02): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** nada
  - **Bloquea:** TASK-02
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
- [x] **Reuso obligatorio**: las piezas de HU-01: `registerErrorHandling` (`apps/api/src/http/error-handler.ts`), `AppError` (`apps/api/src/errors.ts`), `ajvOptions`/`idParamsSchema`/`trimTextFields`/`NO_CONTROL_CHARS*` (`apps/api/src/http/validation.ts`), `withTransaction` (`apps/api/src/db/transaction.ts`), `buildApp` (`apps/api/src/app.ts`), el módulo `apps/api/src/modules/jobs/` y `createTestApp`/`createTestClock`/`failWrites`/`createJob` (`apps/api/test/helpers/test-app.ts`); ver `docs/05_modules/ofertas/technical.md`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. DEC-12: hook `onRequest` en `apps/api/src/http/cross-site.ts`, 403 `CROSS_SITE_REQUEST` solo con `Sec-Fetch-Site: cross-site`; sin cabecera, pasa.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- cross-site seed` en verde, con **2** ficheros de test ejecutados.
- [x] `npm test -w apps/api` completo en verde (los tests de HU-01 siguen igual: `createTestApp()` sin argumentos sigue
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
$ npm test -w apps/api -- cross-site seed
 Test Files  2 passed (2)
      Tests  21 passed (21)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  16 passed (16)
      Tests  186 passed (186)
exit=0
$ npm run typecheck -w @ats/api
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/errors.ts apps/api/src/http/validation.ts apps/api/src/http/cross-site.ts apps/api/src/modules/jobs/applications-port.ts apps/api/src/app.ts apps/api/src/modules/jobs/service.ts apps/api/src/modules/jobs/repository.ts apps/api/src/db/seed.ts apps/api/test/helpers/test-app.ts apps/api/test/http/cross-site.test.ts apps/api/test/jobs/seed.test.ts
exit=0
$ wc -l (ficheros tocados)
      97 apps/api/test/helpers/test-app.ts
     113 apps/api/test/http/cross-site.test.ts
     117 apps/api/test/jobs/seed.test.ts
     145 apps/api/src/modules/jobs/repository.ts
     157 apps/api/src/db/seed.ts
     926 total
INTEGRACION rc=0
```

- **Resultado:** verde a la primera; typecheck del workspace tocado (@ats/api): el de la raíz caía en ese momento por apps/web, a medio editar por TASK-07 (R2: workspace tocado). Builder: general-purpose con las instrucciones de api-builder.md (respaldo)
- **Commit:** el de esta tarea (`[HU-02 TASK-01]`)


## 8. Reapertura · review ronda 1
> Encargo adicional de `/implementar-hu` tras `review/REVIEW.md` (ronda 1). Rigen las mismas secciones 2 a 6 de este
> brief. **La task es el contrato:** su sección «Reapertura · review ronda 1».

- **Qué hacer:** SEC-01 (enmienda de DEC-12, ya escrita en `docs/07_architecture_principles/DECISIONS.md`): invierte el guard de `apps/api/src/http/cross-site.ts`. Se rechaza con 403 `CROSS_SITE_REQUEST` toda petición cuyo método NO sea `GET`, `HEAD` ni `OPTIONS` si `Sec-Fetch-Site` (en minúsculas y recortado) no vale `same-origin` ni `none`; si la cabecera falta, pasa. Tests en `apps/api/test/http/cross-site.test.ts` (o un hermano si pasa de 300): `same-site` → 403 en POST, PATCH y DELETE; un método no listado (`PUT` contra una ruta existente o inexistente) con `cross-site` → 403 antes del 404; `Same-Origin` con mayúsculas y espacios → pasa; `same-origin`, `none` y sin cabecera → 2xx; GET con `cross-site` → 200. Ajusta los tests existentes que hoy esperan que `same-site` pase.
- **Ficheros:** `apps/api/src/http/cross-site.ts`, `apps/api/test/http/cross-site.test.ts`
- **Verificación que debes pegar:** `npm test -w @ats/api -- cross-site` en verde; `npm test -w @ats/api` completo; `npm run typecheck -w @ats/api`; `npx eslint` de los ficheros tocados.

### Resultado de la integración (reapertura)
```
$ npm test -w apps/api -- cross-site
 Test Files  1 passed (1)
      Tests  47 passed (47)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  24 passed (24)
      Tests  310 passed (310)
exit=0
$ npm run typecheck -w @ats/api
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/http/cross-site.ts apps/api/test/http/cross-site.test.ts
exit=0
$ wc -l (ficheros tocados)
      28 apps/api/src/http/cross-site.ts
     181 apps/api/test/http/cross-site.test.ts
     209 total
INTEGRACION rc=0
```

- **Resultado:** verde; guard por lista de métodos seguros (GET, HEAD, OPTIONS) y same-site rechazado (DEC-12 enmendada); 47 tests de cross-site

