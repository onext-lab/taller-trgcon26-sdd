# Brief de implementación — HU-06 · TASK-02

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-06-cerrar-oferta-inscripciones-activas/tasks/TASK-02.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-06-cerrar-oferta-inscripciones-activas/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01, RF-02, RF-03 · RF-06 (umbrales de `app.ts`) · Edge cases: EC-02, EC-04, EC-05, EC-07 (por la API),
    EC-09 (0/1/4), EC-11, EC-12, EC-15, EC-20 · CA-01 a CA-05, CA-08, CA-09, CA-10 · DD-06, DD-07
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (3), § Módulos y ficheros afectados, DD-06, DD-07,
    § Estrategia de tests (`close-reject.test.ts`, `close-preview-count.test.ts`, *Criterio → test*), § Checklist 2
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-06-cerrar-oferta-inscripciones-activas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 25614d7 feat(api): count and reject the active applications of a job being closed [HU-06 TASK-01]; c69ca7a docs(HU-06): tasks and roadmap; fbee2c0 docs(HU-06): technical design; 722b009 docs(HU-06): PRD; c4de679 docs(HU-06): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-01
  - **Bloquea:** TASK-03, TASK-04, TASK-05, TASK-06, TASK-07
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
- [x] **Reuso obligatorio**: Reutiliza countActiveApplications y rejectActiveApplications de TASK-01 (apps/api/src/modules/applications/job-closing.ts, expuestas en createApplicationsService); el contrato JobApplicationsPort de apps/api/src/modules/jobs/applications-port.ts sin cambiar su firma; los helpers de apps/api/test/helpers/applications.ts y test-app.ts.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. buildApp ≤ 50 líneas tras partirlo (composeServices, DD-06); ningún import entre módulos (module-boundaries); ningún fichero tocado > 300 líneas; la suite completa de la API en verde (regresión de cableado); los tests citan el ID del criterio al principio del nombre; datos inventados. Commits previos relevantes: TASK-01 (count/reject en applications).

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- applications/close-reject applications/close-preview-count` en verde con **2**
- [x] `npm test -w apps/api` **completo** en verde (la composición afecta a los tres módulos; incluye
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
$ npm test -w apps/api -- applications/close-reject applications/close-preview-count jobs/close module-boundaries
 Test Files  4 passed (4)
      Tests  26 passed (26)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  73 passed (73)
      Tests  1071 passed (1071)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/app.ts apps/api/src/modules/jobs/applications-port.ts apps/api/test/helpers/test-app.ts apps/api/test/jobs/close.test.ts apps/api/test/applications/close-reject.test.ts apps/api/test/applications/close-preview-count.test.ts
exit=0
$ wc -l (ficheros tocados)
      76 apps/api/test/applications/close-preview-count.test.ts
     141 apps/api/src/app.ts
     163 apps/api/test/helpers/test-app.ts
     197 apps/api/test/jobs/close.test.ts
     299 apps/api/test/applications/close-reject.test.ts
     895 total
INTEGRACION rc=0
```

- **Resultado:** en verde; suite completa de la API 1071/1071. Mutaciones del builder, cada una restaurada: M1 (puerto con rejectActiveApplications que no rechaza) → 7 tests de close-reject en rojo, CA-01 y CA-09 incluidos; M2 (recuento sin filtro de etapas) → CA-08 y CA-01 en rojo. buildApp 24 líneas y composeServices 48. close-reject.test.ts queda en 299 líneas: lo nuevo va a ficheros hermanos.
- **Commit:** el de esta tarea (`[HU-06 TASK-02]`)

