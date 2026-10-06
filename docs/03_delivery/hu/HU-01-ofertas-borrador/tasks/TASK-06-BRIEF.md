# Brief de implementación — HU-01 · TASK-06

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-01-ofertas-borrador/tasks/TASK-06.md` (criterios de done incluidos).
- **Diseño:** `docs/03_delivery/hu/HU-01-ofertas-borrador/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01, RF-02, RF-03 (todos Must) · CA: CA-07 (salario 0 o no entero), CA-08, CA-12
  - Edge cases por categoría (`QUALITY-GATES.md` §3):
  
  | RF | 1 Input inválido | 3 Fallo de dependencia | 5 Datos corruptos | 6 Seguridad |
  |---|---|---|---|---|
  | RF-01 | EC-01, EC-02 | EC-05 | — (EC-07 N/A) | EC-08 |
  | RF-02 | EC-11 | — (EC-14 N/A) | (EC-16 en TASK-02) | EC-17 |
  | RF-03 | EC-20 + regla de banda fusionada | EC-22 | EC-24 (y EC-30) | EC-25 |
  
    Las demás categorías están en el camino feliz: boundary (EC-03, EC-04, EC-12, EC-13 en TASK-03; EC-21 en TASK-05),
    concurrencia (EC-06 en TASK-03 y TASK-14; EC-23 en TASK-05) e idempotencia (EC-09 en TASK-03; EC-26 en TASK-05).
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths (EC-01 a EC-25), § Threat modeling (Manipulación, Exposición
    de datos, Denegación de servicio), § Estrategia de tests (filas `[adversarial]`)
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-01-ofertas-borrador` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 98a65e0 feat(api): edit and delete drafts with PATCH and DELETE /api/jobs/:id [HU-01 TASK-05]; e21a90c feat(api): job detail, first page of the list and draft seed [HU-01 TASK-04]; efa557c feat(api): create draft job openings with POST /api/jobs [HU-01 TASK-03]; 8c9f025 feat(web): HTTP client, date formatting and jobs API contract [HU-01 TASK-08]; f2c3248 feat(web): router, data loading and shared components [HU-01 TASK-09]; 24375a8 feat(api): add job_openings table with its constraints [HU-01 TASK-02]; d9a46d9 feat(api): strict Ajv, error envelope, clock and transactions [HU-01 TASK-01]; 69c8873 docs(HU-01): tasks and roadmap; 47a9c86 docs(HU-01): technical design; f46dad7 docs(HU-01): PRD; 763017e docs(HU-01): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-05
  - **Bloquea:** nada (puede ir en paralelo con TASK-07: no comparten ficheros de test)
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
- [x] **Reuso obligatorio**: las utilidades de `apps/api/test/helpers/test-app.ts` (`createTestApp`, `createTestClock`, `failWrites`, `createJob`) y los tests existentes de `apps/api/test/jobs/create.test.ts` y `update.test.ts` (añade, no reescribas).
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Tarea [adversarial]: si un test destapa un fallo real en `src`, NO lo arregles tú (otro builder trabaja a la vez sobre los mismos ficheros de `src`): deja el test en rojo, márcalo en el informe con la evidencia y para.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- create update` en verde, con **2** ficheros de test ejecutados.
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
$ npm test -w apps/api -- create update
 Test Files  3 passed (3)
      Tests  51 passed (51)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  13 passed (13)
      Tests  126 passed (126)
exit=0
$ npm run typecheck
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/test/jobs/create.test.ts apps/api/test/jobs/create-adversarial.test.ts apps/api/test/jobs/update.test.ts
exit=0
$ wc -l (ficheros tocados)
     168 apps/api/test/jobs/create-adversarial.test.ts
     237 apps/api/test/jobs/create.test.ts
     244 apps/api/test/jobs/update.test.ts
     649 total
INTEGRACION rc=0
```

- **Resultado:** verde tras 1 ciclo de arreglo: la primera pasada dejaba create.test.ts en 384 líneas (> 300, QUALITY-GATES §2); los tests adversariales del alta pasan sin cambios a apps/api/test/jobs/create-adversarial.test.ts, fichero nuevo que no estaba en «Archivos afectados». No destapa fallos en src
- **Commit:** el de esta tarea (`[HU-01 TASK-06]`)

