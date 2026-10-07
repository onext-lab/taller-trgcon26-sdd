# Brief de implementación — HU-05 · TASK-14

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-05-pipeline-etapas/tasks/TASK-14.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-05-pipeline-etapas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-05, RF-06, RF-07, RF-08 · EC: EC-01, EC-09, EC-10, EC-23, EC-34, EC-35, EC-40, EC-41, EC-46, EC-48 · RNF:
    RNF-06, RNF-07
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Error paths, § Threat modeling, § Datos personales, § Estrategia de tests
    (fila `[adversarial]`), § Checklist W6
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-05-pipeline-etapas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 9a4a939 feat(web): application detail screen with its stage history [HU-05 TASK-10]; 9f1d902 test(api): personal data and the rejection note out of logs and errors; hostile detail [HU-05 TASK-08]; 9d2bff8 feat(web): reject an application with reason and note from the pipeline [HU-05 TASK-13]; 9fea405 test(api): stage changes under write failures and a stale read [HU-05 TASK-07]; 715d064 feat(api): application detail with its history (GET /api/applications/:id) [HU-05 TASK-05]; 08cd597 test(api): stage changes against hostile input and concurrency [HU-05 TASK-06]; 0cd5d1f feat(web): advance and hire from the pipeline cards [HU-05 TASK-12]; b111063 feat(api): reject an application with reason and note (POST /api/applications/:id/reject) [HU-05 TASK-04]; 7947346 test(web): wait for document.title set by a passive effect [T-03]; 8155a75 feat(api): advance an application one stage (POST /api/applications/:id/advance) [HU-05 TASK-03]; b9126eb feat(web): card and duplicate links to the application; View pipeline on closed jobs [HU-05 TASK-11]; 59bb095 feat(web): stage change client, detail types and reject form rules [HU-05 TASK-09].
- **Dependencias de la task:**
  - **Depende de:** TASK-10 (detalle), TASK-13 (avanzar y rechazar completos)
  - **Bloquea:** nada
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
- [x] **Reuso obligatorio**: los fixtures de `apps/web/test/features/applications/{stage-fixtures,reject-fixtures,fixtures,enroll-fixtures}.ts` y el estilo de `apps/web/test/features/applications/PipelineScreen.adversarial.test.tsx`; `expectFocusOn` y `waitFor`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. NO toques producción: si un caso falla por un bug, déjalo fallando y repórtalo. REGLA DE TESTS: nada de asertos síncronos sobre lo que pone un efecto pasivo. En paralelo, TASK-15 escribe e2e.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w @ats/web -- features/applications/PipelineScreen.stage-adversarial features/applications/ApplicationDetailScreen.adversarial`
- [x] `npm test -w @ats/web` en verde (sin regresiones).
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
$ npm test -w apps/web -- PipelineScreen.stage-adversarial ApplicationDetailScreen.adversarial
 Test Files  2 passed (2)
      Tests  14 passed (14)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/test/features/applications/PipelineScreen.stage-adversarial.test.tsx apps/web/test/features/applications/ApplicationDetailScreen.adversarial.test.tsx
exit=0
$ wc -l (ficheros tocados)
      84 apps/web/test/features/applications/ApplicationDetailScreen.adversarial.test.tsx
     255 apps/web/test/features/applications/PipelineScreen.stage-adversarial.test.tsx
     339 total
INTEGRACION rc=0
```

- **Resultado:** en verde: 14 casos y ninguno falla. No se ha tocado producción. 20/20 por fichero y semillas 42 y 99 (754/754) en el informe del builder.
- **Commit:** el de esta tarea (`[HU-05 TASK-14]`)

