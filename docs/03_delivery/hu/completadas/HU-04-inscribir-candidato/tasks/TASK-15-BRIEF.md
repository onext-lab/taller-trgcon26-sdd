# Brief de implementación — HU-04 · TASK-15

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-04-inscribir-candidato/tasks/TASK-15.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-04-inscribir-candidato/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-07, RF-08, RF-10 · RNF: RNF-05 · CA: CA-02, CA-08, CA-14, CA-19, CA-26 · Edge cases: EC-28, EC-39, EC-45
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Estrategia de tests (columna Playwright y párrafo «e2e»), § Checklist W6
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-04-inscribir-candidato` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 63584c6 feat(web): enroll a candidate from the pipeline with feedback and reload [HU-04 TASK-13]; a626063 test(api): explicit mixed-case retention check in the seed [HU-04 TASK-06]; 333068e feat(web): enroll panel with candidate search in the pipeline [HU-04 TASK-12]; c4e955c test(api): pipeline and data integrity against hostile input and corrupt writes [HU-04 TASK-09]; d40ddd3 feat(web): job pipeline screen and the View pipeline link [HU-04 TASK-11]; 0c996f0 feat(api): seed 40 applications with history; pipeline and enroll performance [HU-04 TASK-06]; 1768242 test(api): enrollment under dependency failures and personal data in logs [HU-04 TASK-08]; babda45 test(api): enrollment against hostile input and concurrency [HU-04 TASK-07]; a15014e feat(api): job pipeline (GET /api/jobs/:jobId/applications) [HU-04 TASK-05]; 4eb138f feat(api): enroll a candidate in a published job (POST /api/applications) [HU-04 TASK-04]; bee8422 feat(api): module ports for job status, candidate lookups and real candidate processes [HU-04 TASK-03]; 53296b3 feat(web): applications client, pipeline types, useResource.reload and focusable Notice [HU-04 TASK-10].
- **Dependencias de la task:**
  - **Depende de:** TASK-01 a TASK-09 (toda la API: rutas, migración `003`, seed y puerto de procesos real), TASK-11,
    TASK-13
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
- [ ] **Accesibilidad** (web): roles y nombres accesibles, `label` en cada control, estados de carga, vacío y
      error; `docs/06_design_principles/README.md`. Descartado: la task no toca la web.
- [x] **Caracteres crudos**: nunca NUL ni U+2028/U+2029 en el código; usa secuencias de escape (un hook lo bloquea).
- [x] **Reuso obligatorio**: `playwright.config.ts` tal cual (la base `data/e2e.db` se regenera con el seed de 10 ofertas, 30 candidatos y 40 inscripciones; fechas relativas al reset) y el estilo de `e2e/candidates.spec.ts` y `e2e/jobs-lifecycle.spec.ts`. El tsconfig de `e2e/` no tiene `dom`: locators o un cast mínimo de `globalThis`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. No toques producción ni la configuración. Usa datos propios creados por la API (emails únicos `@example.com`) para no depender del orden. Ningún test cierra una oferta con inscripciones (ventana de INV-05, DT-10). En paralelo, TASK-14 escribe un test unitario web.

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
- [x] `npx playwright test e2e/applications.spec.ts` en verde.
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
exit=0
$ npm run lint
exit=0
$ npm test
 Test Files  58 passed (58)
      Tests  715 passed (715)
 Test Files  48 passed (48)
      Tests  628 passed (628)
exit=0
$ npm run e2e
  39 passed (46.2s)
exit=0
$ npm run check:harness
check:harness: todo en verde.
exit=0
INTEGRACION COMPLETA rc=0
```

- **Resultado:** en verde: 5 recorridos; `npm run e2e` 39 passed en la integración de la sesión. El builder vio 3 fallos aislados en 1 de sus 4 pasadas completas, con la máquina saturada (6,5 min frente a 0,7-2 min); no se repitieron.
- **Commit:** el de esta tarea (`[HU-04 TASK-15]`)

