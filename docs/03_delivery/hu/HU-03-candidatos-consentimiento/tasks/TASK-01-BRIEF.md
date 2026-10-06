# Brief de implementación — HU-03 · TASK-01

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/tasks/TASK-01.md` (criterios de done incluidos).
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-03-candidatos-consentimiento/plans/TECHNICAL_DOC-backend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: base de RF-01, RF-02 y RF-03 (409 con `existingId`, solo lectura nombrados) · RNF-08 · Edge cases: EC-59 (regla)
  - Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (pieza 3), § Reglas por campo (solo lectura), § Errores
    específicos, DD-08, DD-11, § Impacto en decisiones, § Estrategia de tests › Enmienda DEC-11.4, § Checklist B-01
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-03-candidatos-consentimiento` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): b360bbe docs(HU-03): tasks and roadmap; 15432f9 docs(HU-03): technical design; c0e8adc Merge sprint integration (HU-02) into HU-03; 1380c79 docs(HU-03): PRD; dcdf80c Merge sprint integration (HU-01, T-01, T-02) into HU-03; 6fc6792 docs(HU-03): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** nada
  - **Bloquea:** TASK-02 (orden fijado por el aprobador), TASK-03
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
- [x] **Reuso obligatorio**: el manejador único `apps/api/src/http/error-handler.ts` (`toDetails`, `fieldOf`, `TYPE_MESSAGES`), `apps/api/src/http/validation.ts`, `apps/api/src/errors.ts` y `apps/api/test/helpers/test-app.ts`; no crees otro manejador ni otra ruta de errores.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Orden obligatorio de la task: la regresión se escribe y se ejecuta en verde ANTES de tocar producción, y esa salida se pega.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] **Antes de tocar producción:** `npm test -w @ats/api -- error-details-regression` en verde (1 fichero) con el
- [x] **Después del cambio:** `npm test -w @ats/api -- error-details-regression` en verde, **sin haber tocado** el
- [x] `npm test -w @ats/api -- error-details` en verde (2 ficheros: `error-details.test.ts` y
- [x] `publish.test.ts`, `close.test.ts`, `delete.test.ts`, `duplicate.test.ts`, `get.test.ts`: `npm test -w @ats/api`
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
# Paso 1 (builder, antes de tocar producción)
$ npm test -w @ats/api -- error-details-regression
 Test Files  1 passed (1)
      Tests  3 passed (3)
# Integración de la sesión (después del cambio)
$ npm test -w apps/api -- error-details
 Test Files  2 passed (2)
      Tests  11 passed (11)
exit=0
$ npm test -w apps/api   (suite completa del workspace)
 Test Files  26 passed (26)
      Tests  320 passed (320)
exit=0
$ npm run typecheck -w @ats/api
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/http/error-handler.ts apps/api/src/errors.ts apps/api/src/http/validation.ts apps/api/src/modules/jobs/schemas.ts apps/api/test/http/error-details.test.ts apps/api/test/jobs/error-details-regression.test.ts apps/api/test/jobs/create-adversarial.test.ts apps/api/test/jobs/list.test.ts apps/api/test/jobs/list-filters-adversarial.test.ts apps/api/test/http/error-handler.test.ts
exit=0
$ wc -l (ficheros tocados)
     159 apps/api/test/http/error-details.test.ts
     176 apps/api/test/jobs/list-filters-adversarial.test.ts
     182 apps/api/test/jobs/create-adversarial.test.ts
     205 apps/api/src/modules/jobs/schemas.ts
     299 apps/api/test/http/error-handler.test.ts
    1507 total
INTEGRACION rc=0
```

- **Resultado:** en verde. La regresión pasa antes y después, sin tocar el fichero. Las 5 aserciones de DD-11 están cambiadas. Hay una sexta, inevitable: `apps/api/test/http/error-handler.test.ts:236` (`flag`, de tipo `boolean`, pasa de «Tipo de dato no válido.» a «Debe ser verdadero o falso.», el mensaje que pide la propia task). No es de ofertas y figura en el commit.
- **Commit:** el de esta tarea (`[HU-03 TASK-01]`)

