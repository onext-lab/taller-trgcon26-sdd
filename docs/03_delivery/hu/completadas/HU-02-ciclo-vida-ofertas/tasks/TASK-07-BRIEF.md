# Brief de implementación — HU-02 · TASK-07

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/tasks/TASK-07.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: base de RF-01, RF-02, RF-04, RF-05 y RF-06 en la web · RNF: RNF-05 · CA: CA-20 (cliente) · Edge cases: EC-01 y
    EC-10 (sin cuerpo), EC-32 (claves desconocidas fuera), EC-33, EC-34 (`q` 100/101), EC-35 (sin normalizar)
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Dependencias (S1-S5 y `Content-Type`), § Módulos y ficheros afectados,
    § Pantallas y estados › Listado (URL) y Diálogo de cierre (textos), DD-01, DD-04, DD-05, § Error paths (EC-01, EC-10,
    EC-32 a EC-35), § Estrategia de tests, § Checklist pasos 1 y 2
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-02-ciclo-vida-ofertas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 7c4b690 docs(HU-02): tasks and roadmap; 17887f5 docs(HU-02): technical design; 7355db9 docs(HU-02): PRD; 5136493 docs(HU-02): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** nada (el contrato está cerrado en `plans/TECHNICAL_DOC-backend.md` § Contrato de API; Vitest simula
    `fetch`)
  - **Bloquea:** TASK-08, TASK-09
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
- [x] **Reuso obligatorio**: las piezas web de HU-01: `router.tsx`, `use-resource.ts`, `ConfirmDialog.tsx` (con `useModalDialog`), `http.ts` (`requestJson`, sin Content-Type si no hay cuerpo), `format.ts`, y `apps/web/src/features/jobs/{types,api,labels,paths}.ts`; helpers `apps/web/test/helpers/fetch.ts` y `dialog.ts`; ver `docs/05_modules/ofertas/technical.md`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. El contrato de API está cerrado en `plans/TECHNICAL_DOC-backend.md` § Contrato de API; Vitest simula `fetch`.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/web -- router use-resource ConfirmDialog api.test labels list-query JobListScreen` en verde, con
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
$ npm test -w apps/web -- router use-resource ConfirmDialog api.test labels list-query JobListScreen
 Test Files  7 passed (7)
      Tests  106 passed (106)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  16 passed (16)
      Tests  212 passed (212)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/components/router.tsx apps/web/src/components/use-resource.ts apps/web/src/components/ConfirmDialog.tsx apps/web/src/features/jobs/types.ts apps/web/src/features/jobs/api.ts apps/web/src/features/jobs/labels.ts apps/web/src/features/jobs/list-query.ts apps/web/src/features/jobs/JobListScreen.tsx apps/web/test/components/router.test.tsx apps/web/test/components/use-resource.test.tsx apps/web/test/components/ConfirmDialog.test.tsx apps/web/test/features/jobs/api.test.ts apps/web/test/features/jobs/labels.test.ts apps/web/test/features/jobs/list-query.test.ts
exit=0
$ wc -l (ficheros tocados)
     146 apps/web/src/features/jobs/api.ts
     166 apps/web/test/components/router.test.tsx
     179 apps/web/test/components/ConfirmDialog.test.tsx
     198 apps/web/test/features/jobs/list-query.test.ts
     277 apps/web/test/features/jobs/api.test.ts
    1657 total
INTEGRACION rc=0
```

- **Resultado:** verde a la primera; typecheck del workspace tocado (@ats/web) porque TASK-02 editaba apps/api a la vez. Adelanta dos tests de EC-39 (de TASK-13), que se quedan. Builder: general-purpose con las instrucciones de web-builder.md (respaldo)
- **Commit:** el de esta tarea (`[HU-02 TASK-07]`)


## 8. Reapertura · review ronda 1
> Encargo adicional de `/implementar-hu` tras `review/REVIEW-ronda-1.md` (ronda 1). Rigen las mismas secciones 2 a 6 de este
> brief. **La task es el contrato:** su sección «Reapertura · review ronda 1».

- **Qué hacer:** `isJob` (`apps/web/src/features/jobs/api.ts:46`) tiene unas 13 ramas (una cadena de `&&`) y el umbral es 10: pásalo a una tabla de comprobaciones por campo (p. ej. un objeto campo → predicado y `every`) sin cambiar qué acepta ni qué rechaza.
- **Ficheros:** `apps/web/src/features/jobs/api.ts`
- **Verificación que debes pegar:** `npm test -w @ats/web -- api.test` en verde con el mismo número de tests que antes; `npm run typecheck -w @ats/web`; `npx eslint` del fichero; ninguna función pasa de 10 ramas (justifícalo).

### Resultado de la integración (reapertura)
```
$ npm test -w apps/web -- api.test
 Test Files  1 passed (1)
      Tests  32 passed (32)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/jobs/api.ts
exit=0
$ wc -l (ficheros tocados)
     157 apps/web/src/features/jobs/api.ts
INTEGRACION rc=0
```

- **Resultado:** verde; isJob pasa a una tabla JOB_CHECKS (Record<keyof Job, predicado>) con 2 ramas; 32 tests antes y después

