# Brief de implementación — HU-02 · TASK-12

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/tasks/TASK-12.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-02, RF-03, RF-06 (web) · RNF: RNF-03 (solo `message`), RNF-04 · CA: CA-13 (409 al borrar) · Edge cases: EC-15,
    EC-16, EC-20, EC-21, EC-23, EC-43 (cierre), EC-44, EC-46
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Diálogo de cierre y Ficha («Alerta de acción»),
    § Error paths (EC-15, EC-16, EC-20, EC-21, EC-23, EC-43, EC-44, EC-46), DD-06, § Estrategia de tests (casos
    `[adversarial]` de RF-02, RF-03 y RF-06)
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-02-ciclo-vida-ofertas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): c191da4 feat(web): edit and delete according to job status [HU-02 TASK-11]; f4245a3 test(web): adversarial tests for publish, duplicate and list filters [HU-02 TASK-13]; e1fbc34 feat(web): job list filters, search and pagination [HU-02 TASK-08]; 2b9d535 feat(web): publish and duplicate from the job detail [HU-02 TASK-10]; b7d4778 test(api): adversarial tests for status rules and list filters [HU-02 TASK-06]; 211315e feat(api): job list filters, accent-insensitive search and pagination [HU-02 TASK-05]; 6c7e58a feat(web): job detail by status and close confirmation [HU-02 TASK-09]; d1659f4 test(api): adversarial tests for publish, close and duplicate [HU-02 TASK-04]; 8996219 feat(api): enforce job status on edit and delete [HU-02 TASK-03]; c9bd3c1 feat(api): publish, close and duplicate job openings [HU-02 TASK-02]; fa59f93 feat(web): search params, setData, dialog props and lifecycle API client [HU-02 TASK-07]; 901426a feat(api): cross-site write guard, applications port and 10-job seed [HU-02 TASK-01].
- **Dependencias de la task:**
  - **Depende de:** TASK-09, TASK-11
  - **Bloquea:** nada (puede ir en paralelo con TASK-13 y TASK-14: no comparten ficheros)
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
- [x] **Reuso obligatorio**: los tests existentes (añade, no reescribas) y los helpers `apps/web/test/helpers/fetch.ts` y `dialog.ts`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Tarea [adversarial]: si un test destapa un fallo real en `src`, NO lo arregles: déjalo en rojo y repórtalo. Huecos que dejó TASK-11 y TASK-09: el 409 al borrar con `onConflict` de `DeleteJobAction` (desde `JobActions`), el doble clic en «Cerrar oferta», el HTML en el título de una cerrada y el 404 al confirmar el cierre. Umbral de 300 líneas: `CloseJobAction.test.tsx` ya tiene 297 y `JobDetailScreen.actions.test.tsx` 300; lo nuevo va en hermanos `<nombre>.adversarial.test.tsx` (dilo).

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/web -- CloseJobAction JobDetailScreen DeleteJobAction JobFormScreen job-form-model` en verde,
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
$ npm test -w apps/web -- CloseJobAction JobDetailScreen DeleteJobAction JobFormScreen job-form-model
 Test Files  12 passed (12)
      Tests  155 passed (155)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  25 passed (25)
      Tests  306 passed (306)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/test/features/jobs/CloseJobAction.adversarial.test.tsx apps/web/test/features/jobs/JobDetailScreen.states.test.tsx apps/web/test/features/jobs/DeleteJobAction.test.tsx apps/web/test/features/jobs/JobFormScreen.published.test.tsx apps/web/test/features/jobs/job-form-model.published.test.ts
exit=0
$ wc -l (ficheros tocados)
     130 apps/web/test/features/jobs/JobDetailScreen.states.test.tsx
     166 apps/web/test/features/jobs/job-form-model.published.test.ts
     205 apps/web/test/features/jobs/DeleteJobAction.test.tsx
     225 apps/web/test/features/jobs/CloseJobAction.adversarial.test.tsx
     250 apps/web/test/features/jobs/JobFormScreen.published.test.tsx
     976 total
INTEGRACION rc=0
```

- **Resultado:** verde a la primera; sin fallos de src. Hermano CloseJobAction.adversarial.test.tsx por el umbral de 300 líneas
- **Commit:** el de esta tarea (`[HU-02 TASK-12]`)

