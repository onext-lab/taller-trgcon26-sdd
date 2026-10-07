# Brief de implementación — HU-04 · TASK-10

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-04-inscribir-candidato/tasks/TASK-10.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-04-inscribir-candidato/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: base de RF-07 y RF-08 · Edge cases: EC-01, EC-02 (lado web), EC-37 (forma inesperada)
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Dependencias (S1-S6), § Módulos y ficheros afectados, DD-01, DD-04,
    DD-05, DD-08, § Checklist W1
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-04-inscribir-candidato` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 01e33ac docs(HU-04): tasks and roadmap; PRD v1.1 (trigger note exception, not-found page); b50e5da docs(HU-04): technical design; 279fed8 docs(HU-04): PRD; 7de646c Merge sprint integration (T-04) into HU-04; 27dca1a docs(HU-04): PRD draft, open questions; b7db2d7 docs(HU-04): move UC-18 detail and history to HU-05; HU-04 also touches ofertas.
- **Dependencias de la task:**
  - **Depende de:** nada (el contrato de la API está fijado en `plans/TECHNICAL_DOC-backend.md`; los tests simulan `fetch`)
  - **Bloquea:** TASK-11
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
- [x] **Reuso obligatorio**: `apps/web/src/components/` (`use-resource.ts`, `http.ts`, `StatusMessages.tsx`, `router.tsx`) y el patrón de `apps/web/src/features/candidates/{api,types,paths}.ts`; no importes de `features/jobs` ni de `features/candidates` salvo su api pública.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Condición del aprobador: `reload()` toca `useResource`, que es compartido: en tu integración ejecuta COMPLETAS las suites de jobs y candidates (`npm test -w @ats/web -- jobs` y `-- candidates`) y pega su salida. En paralelo trabajan TASK-01 y TASK-02 en `apps/api`; no los toques.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- features/applications components/use-resource` en verde, con **3** ficheros de test.
- [x] `npm test -w @ats/web -- features/jobs features/candidates` en verde **sin tocar** sus tests (`useResource` y
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
$ npm test -w apps/web -- features/applications components/use-resource features/jobs features/candidates
 Test Files  35 passed (35)
      Tests  478 passed (478)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  43 passed (43)
      Tests  561 passed (561)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/applications/types.ts apps/web/src/features/applications/paths.ts apps/web/src/features/applications/labels.ts apps/web/src/features/applications/api.ts apps/web/src/features/applications/enroll-errors.ts apps/web/src/components/use-resource.ts apps/web/src/components/StatusMessages.tsx apps/web/test/features/applications/fixtures.ts apps/web/test/features/applications/api.test.ts apps/web/test/features/applications/labels.test.ts apps/web/test/components/use-resource.test.tsx
exit=0
$ wc -l (ficheros tocados)
      68 apps/web/test/features/applications/fixtures.ts
      69 apps/web/src/components/use-resource.ts
      86 apps/web/src/features/applications/api.ts
     128 apps/web/test/components/use-resource.test.tsx
     222 apps/web/test/features/applications/api.test.ts
     791 total
INTEGRACION rc=0
```

- **Resultado:** en verde. Suites COMPLETAS de jobs y candidates (32 files / 449 tests) sin tocar sus tests, por `reload()` en `useResource` (condición del aprobador).
- **Commit:** el de esta tarea (`[HU-04 TASK-10]`)

