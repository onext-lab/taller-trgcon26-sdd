# Brief de implementación — HU-02 · TASK-09

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/tasks/TASK-09.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-02 (web), RF-06, RF-03 (sin «Editar» ni «Borrar» por estado) · RNF: RNF-04, RNF-05 · CA: CA-05, CA-06, CA-09
    (web), CA-10 y CA-13 (fichas), CA-22, CA-23 · Edge cases: EC-04, EC-11, EC-12, EC-13, EC-24 (web), EC-42
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Ficha y Diálogo de cierre, § Diagrama de secuencia
    RF-02, § Error paths (EC-04, EC-11 a EC-13, EC-24, EC-42), DD-04, DD-05, DD-06, DD-07, § Estrategia de tests (filas
    RF-02 y RF-06), § Checklist pasos 3 y 5
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-02-ciclo-vida-ofertas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): c9bd3c1 feat(api): publish, close and duplicate job openings [HU-02 TASK-02]; fa59f93 feat(web): search params, setData, dialog props and lifecycle API client [HU-02 TASK-07]; 901426a feat(api): cross-site write guard, applications port and 10-job seed [HU-02 TASK-01]; 7c4b690 docs(HU-02): tasks and roadmap; 17887f5 docs(HU-02): technical design; 7355db9 docs(HU-02): PRD; 5136493 docs(HU-02): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-02 (`close-preview` y `close`), TASK-07 (`setData`, `ConfirmDialog`, `closeJob`,
    `getClosePreview`, `activeApplicationsText`)
  - **Bloquea:** TASK-10, TASK-11, TASK-12
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
- [x] **Reuso obligatorio**: lo de TASK-07 (`setData` de `use-resource.ts`, `ConfirmDialog` con `confirmDisabled` y `children`, `closeJob`/`getClosePreview` de `apps/web/src/features/jobs/api.ts`, `activeApplicationsText` de `labels.ts`) y las pantallas de HU-01 (`JobDetails`, `JobDetailScreen`, `DeleteJobAction`).
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Hueco aceptado: `DeleteJobAction` gana una prop `disabled`. Si un fichero de test pasa de 300 líneas, crea uno hermano y dilo.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/web -- JobDetailScreen CloseJobAction DeleteJobAction` en verde, con **4** ficheros de test
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
$ npm test -w apps/web -- JobDetailScreen CloseJobAction DeleteJobAction
 Test Files  4 passed (4)
      Tests  37 passed (37)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  18 passed (18)
      Tests  231 passed (231)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/jobs/JobDetails.tsx apps/web/src/features/jobs/JobActions.tsx apps/web/src/features/jobs/CloseJobAction.tsx apps/web/src/features/jobs/JobDetailScreen.tsx apps/web/src/features/jobs/DeleteJobAction.tsx apps/web/test/features/jobs/JobDetailScreen.test.tsx apps/web/test/features/jobs/JobDetailScreen.states.test.tsx apps/web/test/features/jobs/CloseJobAction.test.tsx
exit=0
$ wc -l (ficheros tocados)
     119 apps/web/test/features/jobs/JobDetailScreen.states.test.tsx
     141 apps/web/src/features/jobs/CloseJobAction.tsx
     155 apps/web/src/features/jobs/JobDetailScreen.tsx
     232 apps/web/test/features/jobs/JobDetailScreen.test.tsx
     297 apps/web/test/features/jobs/CloseJobAction.test.tsx
    1147 total
INTEGRACION rc=0
```

- **Resultado:** verde a la primera (web-builder)
- **Commit:** el de esta tarea (`[HU-02 TASK-09]`)

