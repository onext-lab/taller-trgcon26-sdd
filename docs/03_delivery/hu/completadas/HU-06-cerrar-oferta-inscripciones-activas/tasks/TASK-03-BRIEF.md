# Brief de implementación — HU-06 · TASK-03

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-06-cerrar-oferta-inscripciones-activas/tasks/TASK-03.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-06-cerrar-oferta-inscripciones-activas/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-04 (completo), RF-03 (INV-05, DT-01), RF-06 (aclaración de DEC-06, DT-04; umbrales) · Edge cases: EC-18
    (base regenerada), EC-21, EC-22, EC-23, EC-25 · CA-07, CA-13, CA-15, CA-16 · DD-08
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (4), DD-08, § Impacto en decisiones (aclaración de DEC-06
    y `docs/ARCHITECTURE.md:24`), § Estrategia de tests (`stage-change-after-close.test.ts`, `close-invariants.test.ts`,
    CA-13), § Checklist 3
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-06-cerrar-oferta-inscripciones-activas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 5ffc0a3 feat(api): wire the real JobApplicationsPort into buildApp [HU-06 TASK-02]; 25614d7 feat(api): count and reject the active applications of a job being closed [HU-06 TASK-01]; c69ca7a docs(HU-06): tasks and roadmap; fbee2c0 docs(HU-06): technical design; 722b009 docs(HU-06): PRD; c4de679 docs(HU-06): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-02
  - **Bloquea:** nada
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
- [x] **Reuso obligatorio**: Reutiliza el reset real (apps/api/src/db/reset.ts) en un proceso hijo con ATS_DB_PATH a un directorio temporal (DD-08), los helpers de apps/api/test/helpers/ y el texto LITERAL de la aclaración de DEC-06 que está en plans/TECHNICAL_DOC-backend.md («Impacto en decisiones»): copialo tal cual, con la línea «Aclaración 2026-10-07 (HU-06, DT-04): …» y la coletilla de «Estado».
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. advance.test.ts y reject.test.ts siguen en ≤ 300 líneas (solo se renombran tests); ningún test nuevo en ellos. Otros builders trabajan a la vez en apps/api/test/applications/close-reject-adversarial.test.ts, apps/api/test/helpers/test-app.ts y e2e/: no los toques. Commits previos: TASK-01 (count/reject), TASK-02 (puerto real conectado).

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- applications/stage-change-after-close applications/close-invariants applications/advance applications/reject`
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
$ npm test -w apps/api -- applications/stage-change-after-close applications/close-invariants applications/advance.test applications/reject.test
 Test Files  4 passed (4)
      Tests  34 passed (34)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/test/applications/stage-change-after-close.test.ts apps/api/test/applications/close-invariants.test.ts apps/api/test/applications/advance.test.ts apps/api/test/applications/reject.test.ts
exit=0
$ wc -l (ficheros tocados)
      99 apps/api/test/applications/close-invariants.test.ts
     158 apps/api/test/applications/stage-change-after-close.test.ts
     300 apps/api/test/applications/advance.test.ts
     300 apps/api/test/applications/reject.test.ts
     857 total
INTEGRACION rc=0
```

- **Resultado:** en verde; check:harness en verde. DEC-06 aclarado con la línea «Aclaración 2026-10-07 (HU-06, DT-04)» y la coletilla de «Estado»; ARCHITECTURE.md:24 sin línea (cambio trivial). advance.test.ts y reject.test.ts en 300 líneas; 0 «HU-06 lo revisa». La mutación M1 → CA-16 se hace en serie al final de la ola (regla del responsable técnico: nada de mutaciones con builders en paralelo).
- **Commit:** el de esta tarea (`[HU-06 TASK-03]`)

