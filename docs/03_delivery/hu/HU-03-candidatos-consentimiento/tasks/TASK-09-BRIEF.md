# Brief de implementación — HU-03 · TASK-09

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/tasks/TASK-09.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: base de RF-01 a RF-06 (web) · Supuestos S1-S10 · Edge cases: respuesta 2xx con forma inesperada
    (`CLIENT_BAD_RESPONSE`), EC-51 (solo `formatCalendarDate`)
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Enfoque técnico, § Dependencias (S1-S10), § Módulos y ficheros
    afectados (transversal, jobs, `types.ts`, `api.ts`, `paths.ts`, `consent.ts`), DD-03, DD-04, DD-06, § Checklist W1
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-03-candidatos-consentimiento` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): b360bbe docs(HU-03): tasks and roadmap; 15432f9 docs(HU-03): technical design; c0e8adc Merge sprint integration (HU-02) into HU-03; 1380c79 docs(HU-03): PRD; dcdf80c Merge sprint integration (HU-01, T-01, T-02) into HU-03; 6fc6792 docs(HU-03): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** nada (los tests simulan `fetch`; el contrato lo fija el TD-backend)
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
- [x] **Reuso obligatorio**: MUEVE (no copies) a `apps/web/src/components/` las piezas de `apps/web/src/features/jobs/` que nombra la task; jobs re-exporta sus nombres públicos y sus tests (`apps/web/test/features/jobs/`) no se tocan; reutiliza `http.ts`, `use-resource.ts` y `router.tsx`.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. No toques `apps/api`: otra tarea trabaja allí en paralelo.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] **Ofertas sin regresión:** `npm test -w @ats/web -- jobs` en verde **sin modificar ningún fichero de
- [x] `npm test -w @ats/web -- components` en verde (8 ficheros: los 5 actuales y los 3 nuevos).
- [x] `npm test -w @ats/web -- candidates/api` en verde (1 fichero): cada llamada usa su método y URL
- [x] `npm test -w @ats/web` completo en verde.
- [x] `npm run typecheck`.
- [x] `npx eslint` con los ficheros de la tabla «Archivos afectados».
- [x] e2e de ofertas sin regresión: `npx playwright test e2e/jobs.spec.ts e2e/jobs-list.spec.ts e2e/jobs-lifecycle.spec.ts`
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
$ npm test -w apps/web -- components candidates
 Test Files  10 passed (10)
      Tests  106 passed (106)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  30 passed (30)
      Tests  368 passed (368)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/components apps/web/src/features/jobs apps/web/src/features/candidates apps/web/test/components apps/web/test/features/candidates
exit=0
$ npx playwright test e2e/jobs.spec.ts e2e/jobs-list.spec.ts e2e/jobs-lifecycle.spec.ts
  23 passed (12.9s)
exit=0
INTEGRACION rc=0
```

- **Resultado:** en verde. Los tests de `apps/web/test/features/jobs/` no se han tocado y pasan; los e2e de ofertas también (23). Fuera de la tabla, `apps/web/test/features/candidates/consent.test.ts` (nuevo, para el criterio de `CONSENT_TEXT` y `v1`); `isValidId` se exporta de `http.ts` para reutilizarlo.
- **Commit:** el de esta tarea (`[HU-03 TASK-09]`)

