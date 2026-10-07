# Brief de implementación — HU-06 · TASK-04

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-06-cerrar-oferta-inscripciones-activas/tasks/TASK-04.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-06-cerrar-oferta-inscripciones-activas/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01 (fallo de dependencia), RF-02 (input inválido, fallo de dependencia), RF-03 (input inválido, fallo de
    dependencia, concurrencia, datos legacy, seguridad) · Edge cases: EC-03, EC-08, EC-10, EC-14, EC-16, EC-17, EC-18,
    EC-19 · CA-06 · DD-09
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths, DD-09, § Threat modeling (excepción de RNF-05), § Estrategia
    de tests (`close-reject-adversarial.test.ts`), § Checklist 4
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
- [x] **Reuso obligatorio**: Reutiliza failWrites de apps/api/test/helpers/ (ampliado con whenNew: { column, equals }, DD-09), los helpers de applications.ts y test-app.ts, y el patrón de stage-change-failures-adversarial.test.ts (HU-05) para comparar con una foto previa.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. M3 de la review: si el rechazo se saca de la transacción del cierre, el test CA-06/EC-03 con el fallo en la 2.ª de 3 debe ponerse en rojo; compruébalo a mano y deshazlo. Otros builders trabajan a la vez en advance.test.ts, reject.test.ts, close-invariants, stage-change-after-close, DECISIONS.md y e2e/: no los toques. Commits previos: TASK-01, TASK-02.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- applications/close-reject-adversarial` en verde con **1** fichero y estos tests:
- [x] `npm test -w apps/api -- applications/ jobs/ module-boundaries` en verde (el helper es compartido: los usos sin
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
$ npm test -w apps/api -- applications/close-reject-adversarial
 Test Files  1 passed (1)
      Tests  12 passed (12)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  76 passed (76)
      Tests  1089 passed (1089)
exit=0
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/test/helpers/test-app.ts apps/api/test/applications/close-reject-adversarial.test.ts
exit=0
$ wc -l (ficheros tocados)
     173 apps/api/test/helpers/test-app.ts
     288 apps/api/test/applications/close-reject-adversarial.test.ts
     461 total
INTEGRACION rc=0
```

- **Resultado:** en verde; suite completa de la API 1089/1089. failWrites gana whenNew (entero seguro comprobado antes del DDL). La mutación M3 (rechazo fuera de la transacción del cierre) se ejecuta en serie al final de la ola, sola, por la regla del responsable técnico; resultado en el ROADMAP y en la review.
- **Commit:** el de esta tarea (`[HU-06 TASK-04]`)

