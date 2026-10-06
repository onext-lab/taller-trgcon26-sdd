# Brief de implementación — HU-01 · TASK-01

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-01-ofertas-borrador/tasks/TASK-01.md` (criterios de done incluidos).
- **Diseño:** `docs/03_delivery/hu/HU-01-ofertas-borrador/plans/TECHNICAL_DOC-backend.md`, secciones «Enfoque
  técnico», «Contrato de API» › «Convenciones (todas las rutas)», «Envelope de error» y «Firmas internas», DD-01, DD-02,
  DD-03, DD-06, DD-10, DD-11 y DD-13, y «Estrategia de tests» (no el documento entero).
- **Criterios que cubre:** base de RF-01 a RF-06 (envelope y validación), RNF-03 y EC-38 (lado API) del
  `specs/PRD.md`.
- **Dónde se trabaja:** la raíz del repo,
  rama `hu/HU-01-ofertas-borrador` (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** el esqueleto del monorepo (`apps/api/src/app.ts` con `buildApp({ db, logger })` y
  `GET /api/health`; `apps/api/src/db/{connection,migrate,seed,reset}.ts`; `apps/api/src/logger.ts`;
  `apps/api/test/health.test.ts` y `logger.test.ts`) y los documentos de la HU (PRD `f46dad7`, diseño `47a9c86`,
  tareas `69c8873`). Es la primera tarea de código.
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-11 (puntos 1 a 7: Ajv sin coerción ni `removeAdditional`, numéricos de `params` como texto
      con `pattern`, recorte previo, `details` `[{ field, message }]` sin el valor recibido, códigos extra, `Clock` y
      `withTransaction`); DEC-01 (envelope); DEC-07 (códigos HTTP); DEC-09 (reloj inyectado); DEC-06 (transacción
      única). Todas en `docs/07_architecture_principles/DECISIONS.md`.
- [x] **Envelope de error** `{ error: { code, message, details? } }` con códigos estables; nunca *stack traces*. Esta
      tarea crea el único sitio que lo construye.
- [x] **Validación con el JSON Schema de Fastify**: aquí se configura Ajv; las rutas de negocio llegan en TASK-03.
- [x] **SQLite parametrizado**: `withTransaction` solo ejecuta `BEGIN IMMEDIATE`, `COMMIT` y `ROLLBACK` literales.
- [ ] **Migraciones**: descartado, esta tarea no crea tablas (la primera migración es TASK-02).
- [x] **Datos personales** (`docs/RGPD.md`): nunca registres `request.body` ni la query en el log; solo los 500, con el
      objeto de error. Los mensajes de error no repiten el valor recibido.
- [ ] **Accesibilidad** (web): descartado, tarea solo de API.
- [x] **Caracteres crudos**: nunca NUL ni U+2028/U+2029 en el código; usa secuencias de escape (un hook lo bloquea).
- [x] **Reuso obligatorio**: `openDatabase` (`apps/api/src/db/connection.ts`), `migrate` (`apps/api/src/db/migrate.ts`)
      y las opciones de logger de `apps/api/src/logger.ts` (como las usa `apps/api/test/logger.test.ts`). `buildApp`
      sigue siendo compatible: `health.test.ts` y `logger.test.ts` no se tocan.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y mensajes al usuario en castellano de España.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea (ni `ajv` ni `ajv-errors`: DEC-05 y DEC-11).
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- error-handler transaction health logger`: **4** ficheros de test ejecutados.
- [x] `npm run typecheck`.
- [x] `npx eslint` con los 9 ficheros de la tabla «Archivos afectados».
- [ ] `npx playwright test <spec>`: descartado, la tarea no toca pantallas.
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
$ npm test -w apps/api -- error-handler transaction health logger
 Test Files  4 passed (4)
      Tests  14 passed (14)
exit=0
$ npm run typecheck
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/clock.ts apps/api/src/errors.ts apps/api/src/http/validation.ts apps/api/src/http/error-handler.ts apps/api/src/db/transaction.ts apps/api/src/app.ts apps/api/test/helpers/test-app.ts apps/api/test/http/error-handler.test.ts apps/api/test/db/transaction.test.ts
exit=0
$ wc -l (ficheros tocados)
      43 apps/api/src/app.ts
      43 apps/api/src/http/validation.ts
      70 apps/api/test/db/transaction.test.ts
     125 apps/api/src/http/error-handler.ts
     299 apps/api/test/http/error-handler.test.ts
     671 total
INTEGRACION rc=0
```

- **Resultado:** verde a la primera (sin ciclos de arreglo)
- **Commit:** el de esta tarea (`[HU-01 TASK-01]`)


## 8. Reapertura · review ronda 1
> Encargo adicional de `/implementar-hu` tras `review/REVIEW-ronda-1.md` (ronda 1). Rigen las mismas secciones 2 a 6 de este
> brief. **La task es el contrato:** su sección «Reapertura · review ronda 1».

- **Qué hacer:** `messageOf` (`apps/api/src/http/error-handler.ts:73`) tiene unas 13 ramas y el umbral es 10: pásalo a una tabla de mensajes por *keyword* (un objeto de funciones o plantillas) más un único caso por defecto, sin cambiar ningún mensaje. Sin tocar `apps/api/test/http/error-handler.test.ts` (299 líneas): sus tests son la red de seguridad del refactor.
- **Ficheros:** `apps/api/src/http/error-handler.ts`
- **Verificación que debes pegar:** `npm test -w apps/api -- error-handler create update` en verde con el mismo número de tests que antes (`error-handler.test.ts` sin cambios); `npm run typecheck`; `npx eslint` del fichero; ninguna función de `error-handler.ts` pasa de 10 ramas ni de 50 líneas (justifícalo).

### Resultado de la integración (reapertura)
```
$ npm test -w apps/api -- error-handler create update
 Test Files  4 passed (4)
      Tests  60 passed (60)
exit=0
$ npm run typecheck
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/api/src/http/error-handler.ts
exit=0
$ wc -l (ficheros tocados)
     120 apps/api/src/http/error-handler.ts
INTEGRACION rc=0
```

- **Resultado:** verde; messageOf y typeMessage pasan a tablas por keyword con un caso por defecto (3 ramas cada una); mensajes idénticos; 60 tests antes y después, error-handler.test.ts sin cambios

