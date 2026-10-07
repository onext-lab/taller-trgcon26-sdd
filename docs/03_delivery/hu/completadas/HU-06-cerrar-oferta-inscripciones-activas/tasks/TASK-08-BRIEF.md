# Brief de implementación — HU-06 · TASK-08

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-06-cerrar-oferta-inscripciones-activas/tasks/TASK-08.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-06-cerrar-oferta-inscripciones-activas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-05 (concurrencia) · Edge cases: EC-28, EC-11 (en la UI), EC-04 (parte visible), EC-26 (1 real) · CA-03 en la
    UI
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Diagrama de secuencia (EC-28 / EC-11), § Error paths (EC-28), § Estrategia
    de tests (T2 y «`[adversarial]` de RF-05»), § Checklist de implementación 2
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-06-cerrar-oferta-inscripciones-activas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 7758f6c test(api): failures, hostile input and races when closing a job with active applications [HU-06 TASK-04]; 9542027 test(api): post-close stage changes and INV-05 invariants; clarify DEC-06 [HU-06 TASK-03]; acbcc2b test(e2e): close a job with active applications from the job page [HU-06 TASK-07]; 5ffc0a3 feat(api): wire the real JobApplicationsPort into buildApp [HU-06 TASK-02]; 25614d7 feat(api): count and reject the active applications of a job being closed [HU-06 TASK-01]; c69ca7a docs(HU-06): tasks and roadmap; fbee2c0 docs(HU-06): technical design; 722b009 docs(HU-06): PRD; c4de679 docs(HU-06): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-07 (crea el spec y `advanceByApi`; mismo fichero)
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
- [x] **Reuso obligatorio**: Reutiliza e2e/jobs-close-applications.spec.ts de TASK-07 (helpers closeDialog, cardIn, prepareJobWithApplications) y e2e/support/applications.ts (enroll por API, advanceByApi); aserciones de Playwright que esperan solas.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. NO apliques mutaciones. Otro builder trabaja a la vez en apps/api/test/: no lo toques. Ejecuta el spec junto a e2e/pipeline-closed.spec.ts y, al final, la suite e2e completa una vez. Commits previos: TASK-07 (T1).

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
- [x] `npx playwright test e2e/jobs-close-applications.spec.ts e2e/pipeline-closed.spec.ts` en verde, con T1 y T2.
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
$ npx eslint e2e/jobs-close-applications.spec.ts
exit=0
$ wc -l (ficheros tocados)
     105 e2e/jobs-close-applications.spec.ts
$ npx playwright test e2e/jobs-close-applications.spec.ts e2e/pipeline-closed.spec.ts
  ✓  1 [chromium] › e2e/jobs-close-applications.spec.ts:43:1 › CA-12 y EC-26 cerrar con 2 activas y 1 contratada: diálogo con 2, «Oferta cerrada.», pipeline en solo lectura y detalle «Oferta cerrada» sin nota (847ms)
  ✓  2 [chromium] › e2e/jobs-close-applications.spec.ts:82:1 › EC-28 y EC-11 una inscripción creada con el diálogo abierto también se rechaza (506ms)
  ✓  3 [chromium] › e2e/pipeline-closed.spec.ts:31:1 › CA-23, CA-26 y EC-50 oferta cerrada: «Ver pipeline», seis columnas sin acciones y el detalle de un rechazo «Oferta cerrada» sin nota (461ms)
  3 passed (3.6s)
exit=0
INTEGRACION rc=0
```

- **Resultado:** en verde; suite e2e completa 47 passed (informe del builder). T2 comprueba «Se rechazará 1 inscripción activa.» antes de inscribir a B y las dos rechazadas tras el cierre. Sin mutaciones (ola en paralelo); el rechazo de lo que existe al confirmar lo vigilan además CA-03/EC-04 de la API.
- **Commit:** el de esta tarea (`[HU-06 TASK-08]`)

