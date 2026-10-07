# Brief de implementación — HU-01 · TASK-15

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-01-ofertas-borrador/tasks/TASK-15.md` (criterios de done incluidos).
- **Diseño:** `docs/03_delivery/hu/HU-01-ofertas-borrador/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01 a RF-07 de extremo a extremo · CA: CA-01, CA-02, CA-03 (UI), CA-09, CA-10, CA-11, CA-13, CA-18, CA-19,
    CA-20 · Edge cases: EC-03, EC-08, EC-21, EC-23, EC-38
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Módulos y ficheros afectados (filas e2e), DD-08, § Estrategia de tests
    (columna Playwright y «E2E deterministas»), § Riesgos, § Checklist pasos 8 y 9
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-01-ofertas-borrador` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): f9b9464 feat(web): edit drafts and show server errors in the form [HU-01 TASK-13]; ea0d848 feat(web): create job form with client and server validation [HU-01 TASK-12]; 3680cfb feat(web): job detail screen and delete with confirmation [HU-01 TASK-11]; 4168da7 test(api): adversarial tests for create and edit [HU-01 TASK-06]; 942bad9 test(api): adversarial tests for delete, list and detail [HU-01 TASK-07]; d5051e9 feat(web): job list as the entry screen inside the app shell [HU-01 TASK-10]; 98a65e0 feat(api): edit and delete drafts with PATCH and DELETE /api/jobs/:id [HU-01 TASK-05]; e21a90c feat(api): job detail, first page of the list and draft seed [HU-01 TASK-04]; efa557c feat(api): create draft job openings with POST /api/jobs [HU-01 TASK-03]; 8c9f025 feat(web): HTTP client, date formatting and jobs API contract [HU-01 TASK-08]; f2c3248 feat(web): router, data loading and shared components [HU-01 TASK-09]; 24375a8 feat(api): add job_openings table with its constraints [HU-01 TASK-02].
- **Dependencias de la task:**
  - **Depende de:** TASK-13 (todas las pantallas; por cadena, todo el backend y el seed de TASK-04)
  - **Bloquea:** nada (puede ir en paralelo con TASK-14: no comparten ficheros)
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
- [ ] **Accesibilidad** (web): roles y nombres accesibles, `label` en cada control, estados de carga, vacío y
      error; `docs/06_design_principles/README.md`. Descartado: la task no toca la web.
- [x] **Caracteres crudos**: nunca NUL ni U+2028/U+2029 en el código; usa secuencias de escape (un hook lo bloquea).
- [x] **Reuso obligatorio**: `apps/api/src/db/reset.ts` (respeta `ATS_DB_PATH`), el seed de 4 borradores (`apps/api/src/db/seed.ts`), el smoke `e2e/smoke.spec.ts` y la configuración actual `playwright.config.ts`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. DD-08 del diseño web: el reset de `data/e2e.db` va en el comando del webServer de la API (no en globalSetup: en Playwright 1.63 el webServer arranca antes que globalSetup), con `reuseExistingServer: false`, puertos 3101 (API) y 5174 (web) y `workers: 1`; documenta el porqué en un comentario del config y en `docs/SETUP.md` (incluida la fila de puertos). Comprueba que dos `npx playwright test` seguidos dan el mismo resultado.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [ ] Tests acotados: descartado, la task no tiene tests de Vitest.
- [x] `npm run typecheck`.
- [x] `npx eslint` con los ficheros de la tabla «Archivos afectados».
- [x] `npx playwright test e2e/smoke.spec.ts e2e/jobs.spec.ts` en verde.
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
$ npm run typecheck
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint playwright.config.ts e2e/jobs.spec.ts
exit=0
$ wc -l (ficheros tocados)
      49 playwright.config.ts
     242 e2e/jobs.spec.ts
     291 total
$ npx playwright test e2e/smoke.spec.ts e2e/jobs.spec.ts
  ✓   1 [chromium] › e2e/jobs.spec.ts:53:1 › RF-05/RF-07 el listado muestra los borradores del seed en su orden, con estado y fecha (495ms)
  ✓   2 [chromium] › e2e/jobs.spec.ts:72:1 › CA-01 alta solo con título: ficha con aviso y aparece en el listado (480ms)
  ✓   3 [chromium] › e2e/jobs.spec.ts:90:1 › CA-02/EC-03 alta completa: la ficha muestra todo y el título se guarda sin espacios sobrantes (353ms)
  ✓   4 [chromium] › e2e/jobs.spec.ts:117:1 › CA-03 título de 2 caracteres: error junto al campo y se sigue en el formulario (286ms)
  ✓   5 [chromium] › e2e/jobs.spec.ts:130:1 › CA-09/CA-10/EC-21 editar un borrador y vaciar un campo opcional (603ms)
  ✓   6 [chromium] › e2e/jobs.spec.ts:159:1 › CA-11/EC-23 dos páginas editan el mismo borrador: gana la última en guardar (1.1s)
  ✓   7 [chromium] › e2e/jobs.spec.ts:183:1 › CA-13 borrar pide confirmación: Escape cancela y confirmar borra (458ms)
  ✓   8 [chromium] › e2e/jobs.spec.ts:204:1 › CA-18/EC-38 con la API caída el listado avisa y permite reintentar (203ms)
  ✓   9 [chromium] › e2e/jobs.spec.ts:213:1 › CA-19 el HTML del título se muestra como texto literal (321ms)
  ✓  10 [chromium] › e2e/jobs.spec.ts:221:1 › CA-20 una oferta inexistente muestra «Oferta no encontrada» y ninguna acción (203ms)
  ✓  11 [chromium] › e2e/jobs.spec.ts:231:1 › EC-08 un título con SQL se guarda y se ve literal; el listado sigue cargando (378ms)
  ✓  12 [chromium] › e2e/smoke.spec.ts:5:1 › la entrada es el listado de ofertas y muestra el estado de la API (207ms)
  12 passed (6.9s)
exit=0
INTEGRACION rc=0
```

- **Resultado:** verde a la primera (sin ciclos de arreglo); el builder ejecutó el e2e dos veces seguidas con el mismo resultado (12 passed)
- **Commit:** el de esta tarea (`[HU-01 TASK-15]`)

