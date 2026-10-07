# Brief de implementación — HU-02 · TASK-04

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/tasks/TASK-04.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01, RF-02, RF-04 (API) · RNF: RNF-03 · CA: CA-03, CA-04, CA-08, CA-09 · Edge cases: EC-01, EC-02, EC-05,
    EC-06, EC-08, EC-10, EC-12, EC-15 (API), EC-25, EC-27, EC-30, EC-49 (rutas nuevas)
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (convenciones, tabla de errores, orden de comprobación),
    § Error paths (EC-01 a EC-15, EC-25 a EC-31, EC-49), DD-01, DD-06, § Estrategia de tests (filas `[adversarial]` de
    RF-01, RF-02 y RF-04)
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-02-ciclo-vida-ofertas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): c9bd3c1 feat(api): publish, close and duplicate job openings [HU-02 TASK-02]; fa59f93 feat(web): search params, setData, dialog props and lifecycle API client [HU-02 TASK-07]; 901426a feat(api): cross-site write guard, applications port and 10-job seed [HU-02 TASK-01]; 7c4b690 docs(HU-02): tasks and roadmap; 17887f5 docs(HU-02): technical design; 7355db9 docs(HU-02): PRD; 5136493 docs(HU-02): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-02
  - **Bloquea:** nada (puede ir en paralelo con TASK-03 y TASK-05: no comparten ficheros)
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
- [x] **Reuso obligatorio**: los tests existentes `apps/api/test/jobs/{publish,close,duplicate}.test.ts` y `apps/api/test/http/cross-site.test.ts` (añade, no reescribas) y sus helpers de `apps/api/test/helpers/test-app.ts` (`createApplicationsSpy({ failOnReject })`, `failWrites`).
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Tarea [adversarial]: si un test destapa un fallo real en `src`, NO lo arregles (otro builder edita `service.ts` a la vez): deja el test en rojo y repórtalo con la evidencia. Si un fichero de test pasa de 300 líneas, crea uno hermano `<nombre>-adversarial.test.ts` y dilo.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- publish close duplicate cross-site` en verde, con **4** ficheros de test ejecutados (o
- [x] `npm test -w apps/api` completo en verde.
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
$ npm test -w apps/api -- publish close duplicate cross-site
 Test Files  4 passed (4)
      Tests  58 passed (58)
exit=0
$ npm run typecheck -w @ats/api
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/test/jobs/publish.test.ts apps/api/test/jobs/close.test.ts apps/api/test/jobs/duplicate.test.ts apps/api/test/http/cross-site.test.ts
exit=0
$ wc -l (ficheros tocados)
     140 apps/api/test/http/cross-site.test.ts
     172 apps/api/test/jobs/duplicate.test.ts
     197 apps/api/test/jobs/close.test.ts
     252 apps/api/test/jobs/publish.test.ts
     761 total
INTEGRACION rc=0
```

- **Resultado:** verde; no destapa fallos de src. Durante la tarea, la sesión avisó de que el test CA-04 esperaba CONFLICT en vez del INVALID_TRANSITION del contrato (error del test, no de src) y el builder lo corrigió antes de entregar
- **Commit:** el de esta tarea (`[HU-02 TASK-04]`)


## 8. Reapertura · review ronda 1
> Encargo adicional de `/implementar-hu` tras `review/REVIEW-ronda-1.md` (ronda 1). Rigen las mismas secciones 2 a 6 de este
> brief. **La task es el contrato:** su sección «Reapertura · review ronda 1».

- **Qué hacer:** EC-14 (RF-02 Must, categoría 5) no tiene test. Fija con un test de la API el comportamiento de la ventana de INV-05 que declara el PRD: con el puerto por defecto (`noJobApplications`, sin `jobApplications` en `createTestApp`), cerrar una oferta publicada da 200 `closed`, `GET /api/jobs/:id/close-preview` da `{ activeApplications: 0 }` antes de cerrar, y no hay inscripciones que rechazar. Nombre del test con «EC-14» y un comentario que diga que HU-05 lo sustituirá al conectar UC-19. Si `close.test.ts` (197) pasa de 300, crea un hermano.
- **Ficheros:** `apps/api/test/jobs/close.test.ts`
- **Verificación que debes pegar:** `npm test -w @ats/api -- close` en verde; `npm run typecheck -w @ats/api`; `npx eslint` del fichero.

### Resultado de la integración (reapertura)
```
$ npm test -w apps/api -- close
 Test Files  1 passed (1)
      Tests  9 passed (9)
exit=0
$ npm run typecheck -w @ats/api
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/test/jobs/close.test.ts
exit=0
$ wc -l (ficheros tocados)
     217 apps/api/test/jobs/close.test.ts
INTEGRACION rc=0
```

- **Resultado:** verde; test «EC-14 sin puerto de inscripciones…» con el puerto por defecto (noJobApplications), que HU-05 sustituirá al conectar UC-19

