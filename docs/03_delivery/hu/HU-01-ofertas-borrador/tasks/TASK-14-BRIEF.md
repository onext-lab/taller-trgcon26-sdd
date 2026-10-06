# Brief de implementación — HU-01 · TASK-14

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-01-ofertas-borrador/tasks/TASK-14.md` (criterios de done incluidos).
- **Diseño:** `docs/03_delivery/hu/HU-01-ofertas-borrador/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01, RF-03, RF-04, RF-05, RF-06 (todos Must; parte web) · CA: CA-14 (web) · RNF: RNF-04
  - Edge cases por categoría (`QUALITY-GATES.md` §3):
  
  | RF | Categoría | EC | Test |
  |---|---|---|---|
  | RF-01 | 4 Concurrencia | EC-06 | doble clic en «Guardar» = 1 `fetch` |
  | RF-03 | 1 Input inválido | EC-19 | edición sin cambios = 0 `fetch` (nunca `PATCH {}`) |
  | RF-03 | 5 Datos corruptos · 4 Concurrencia | EC-24, EC-30 | 404 al guardar → «Esta oferta ya no existe.» |
  | RF-04 | 7 Idempotencia | EC-33, CA-14 | doble clic en «Borrar oferta» = 1 `fetch`; 404 → mensaje |
  | RF-05 | 6 Seguridad · 5 Datos corruptos | EC-41, EC-40 | `<img onerror>` como texto; forma inesperada → error sin filas |
  | RF-06 | 6 Seguridad | EC-48 | `<b>`/`<script>` como texto |
  
    RF-02 no tiene fila propia en la web: la validación que manda es la de la API, cuyo adversarial está en TASK-06; en
    la web lo cubren el modelo (TASK-12: EC-11, EC-17 en cliente; `toCreateInput` sin campos de solo lectura, EC-02) y
    los errores del servidor (TASK-13: EC-01, EC-02, EC-17).
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Error paths (filas `[adversarial]`: EC-06, EC-19, EC-24, EC-33, EC-40,
    EC-41, EC-48), § Threat modeling (Manipulación, XSS), § Estrategia de tests
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-01-ofertas-borrador` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): f9b9464 feat(web): edit drafts and show server errors in the form [HU-01 TASK-13]; ea0d848 feat(web): create job form with client and server validation [HU-01 TASK-12]; 3680cfb feat(web): job detail screen and delete with confirmation [HU-01 TASK-11]; 4168da7 test(api): adversarial tests for create and edit [HU-01 TASK-06]; 942bad9 test(api): adversarial tests for delete, list and detail [HU-01 TASK-07]; d5051e9 feat(web): job list as the entry screen inside the app shell [HU-01 TASK-10]; 98a65e0 feat(api): edit and delete drafts with PATCH and DELETE /api/jobs/:id [HU-01 TASK-05]; e21a90c feat(api): job detail, first page of the list and draft seed [HU-01 TASK-04]; efa557c feat(api): create draft job openings with POST /api/jobs [HU-01 TASK-03]; 8c9f025 feat(web): HTTP client, date formatting and jobs API contract [HU-01 TASK-08]; f2c3248 feat(web): router, data loading and shared components [HU-01 TASK-09]; 24375a8 feat(api): add job_openings table with its constraints [HU-01 TASK-02].
- **Dependencias de la task:**
  - **Depende de:** TASK-13 (y, por cadena, TASK-10 y TASK-11)
  - **Bloquea:** nada (puede ir en paralelo con TASK-15: no comparten ficheros)
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
- [x] **Reuso obligatorio**: los tests existentes de `apps/web/test/features/jobs/` (añade, no reescribas) y sus helpers `apps/web/test/helpers/fetch.ts` y `dialog.ts`. La guarda de doble clic (`useRef`) y el 404 al guardar («Esta oferta ya no existe.») ya están implementados en TASK-12 y TASK-13; aquí se prueban.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Tarea [adversarial]: si un test destapa un fallo real en `src`, arréglalo solo en los ficheros que la tabla marca como «modificar solo si un test destapa un fallo» y dilo en el informe. Si un fichero de test pasa de 300 líneas, crea uno hermano `<nombre>.adversarial.test.tsx` y dilo. El aviso de `ApiHealth` también usa `role="status"`: en tests con `<App />`, usa `getByText`.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/web -- JobFormScreen DeleteJobAction JobListScreen api.test JobDetailScreen` en verde, con
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
> La rellena `/implementar-hu` con la salida real de los comandos que ejecuta la sesión. Ciclo de arreglo: 1/2.

```
$ npm test -w apps/web -- JobFormScreen DeleteJobAction JobListScreen api.test JobDetailScreen App.test
 Test Files  8 passed (8)
      Tests  78 passed (78)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  14 passed (14)
      Tests  159 passed (159)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  14 passed (14)
      Tests  159 passed (159)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  14 passed (14)
      Tests  159 passed (159)
exit=0
$ npm run typecheck
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/test/features/jobs/JobFormScreen.adversarial.test.tsx apps/web/test/features/jobs/JobFormScreen.edit.test.tsx apps/web/test/features/jobs/DeleteJobAction.test.tsx apps/web/test/features/jobs/JobListScreen.test.tsx apps/web/test/features/jobs/api.test.ts apps/web/test/features/jobs/JobDetailScreen.test.tsx apps/web/test/App.test.tsx
exit=0
$ wc -l (ficheros tocados)
     145 apps/web/test/features/jobs/JobFormScreen.adversarial.test.tsx
     167 apps/web/test/features/jobs/api.test.ts
     199 apps/web/test/features/jobs/JobFormScreen.edit.test.tsx
     205 apps/web/test/features/jobs/JobListScreen.test.tsx
     231 apps/web/test/features/jobs/JobDetailScreen.test.tsx
    1171 total
INTEGRACION rc=0
```

- **Resultado:** verde tras 1 ciclo de arreglo: CA-19 fallaba de forma intermitente en la suite web completa (document.title comprobado antes del efecto que lo fija). Era una carrera del test, no un fallo de src: las comprobaciones de título tras findBy o una navegación esperan con waitFor (JobDetailScreen.test, JobFormScreen.edit.test y App.test, este fuera de la tabla). Nuevo: JobFormScreen.adversarial.test.tsx (umbral de 300 líneas). Suite web 3 veces seguidas en verde (8 en la del builder). No destapa fallos en src
- **Commit:** el de esta tarea (`[HU-01 TASK-14]`)

