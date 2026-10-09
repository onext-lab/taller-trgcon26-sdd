# Brief de implementación — T-09 (sin HU) · Umbral de 50 líneas por función medido con lint

> Tarea sin HU del sprint-02 (`docs/01_roadmap/sprints/sprint-02.md`, T-09). Plantilla recorrida entera:
> `docs/_templates/BRIEF-IMPLEMENTACION.template.md`.

## 1. Qué hay que hacer
- **El contrato es este brief y la sección T-09 del sprint.** Criterios de done en §1.1.
- **Capa y builder:** `api` → `api-builder`. Toda la producción que se parte está en `apps/api/src`; `eslint.config.js`
  y una línea de `QUALITY-GATES.md` acompañan.
- **Diseño:** sin TECHNICAL_DOC (refactor interno sin cambio de contrato, `docs/WORKFLOW.md` §9). Diseño en §1.2.
- **Criterios que cubre:** A-03 y C-02 de `docs/10_audits/sprints/sprint-01-AUDIT.md` (opción 2, la recomendada).
- **Dónde se trabaja:** la raíz del repo (el worktree de la sesión), rama `worktree-paso-3-punto-de-partida`; no
  cambies de rama. Node 24.21 en el `PATH`.
- **Lo que ya está en la rama:** `a335fd4` (T-08, `npm run integrate`). Suite en verde.
- **Lee solo lo que este brief nombra.**

### 1.1 Criterios de done
1. Ninguna función de `apps/api/src` ni de `apps/web/src` pasa de **50 líneas sin contar las líneas en blanco ni los
   comentarios**. Hoy pasan 6, todas en la API (medido por la sesión el 2026-10-09):

   | Fichero | Función | Líneas |
   |---|---|---|
   | `apps/api/src/modules/candidates/repository.ts:102` | `createCandidatesRepository` | 71 |
   | `apps/api/src/modules/candidates/service.ts:90` | `createCandidatesService` | 82 |
   | `apps/api/src/modules/candidates/routes.ts:53` | el plugin de rutas (función flecha `async`) | 54 |
   | `apps/api/src/modules/jobs/repository.ts:97` | `createJobsRepository` | 72 |
   | `apps/api/src/modules/jobs/service.ts:73` | `createJobsService` | 75 |
   | `apps/api/src/modules/jobs/routes.ts:57` | el plugin de rutas (función flecha `async`) | 62 |

2. `eslint.config.js` aplica `max-lines-per-function: ['error', { max: 50, skipBlankLines: true, skipComments: true }]`
   a `apps/api/src/**` y `apps/web/src/**` (no a los tests), **sin excepciones** ni `eslint-disable`. `npm run lint` en
   verde.
3. **Cero cambios de comportamiento:** ningún fichero de `apps/api/test/` ni de `apps/web/` cambia, y la suite de la API
   sigue en 78 ficheros / 1 097 tests en verde. Las funciones exportadas (`createJobsRepository`,
   `createJobsService`, `createCandidatesRepository`, `createCandidatesService`, `jobsRoutes`, `candidatesRoutes` o
   como se llamen hoy) conservan nombre, firma y tipo de retorno.
4. `docs/07_architecture_principles/QUALITY-GATES.md` §2, fila «Líneas por función»: la nota dice cómo se mide
   (`npm run lint`, `max-lines-per-function` sin blancos ni comentarios, sobre `apps/*/src`), en lugar de «Ídem».

### 1.2 Diseño
- **Factorías** (repositorios y servicios): el patrón de `applications`. Se agrupan los métodos por afinidad en
  funciones privadas `createXOperations(deps)` / `createXQueries(db)` que devuelven un objeto, y la factoría exportada
  las compone con *spread*. Referencia: `apps/api/src/modules/applications/repository.ts:145-215`
  (`createActiveByJobQueries`, `createStageOperations` y `createApplicationsRepository`). En los servicios, si un
  método ya delega en una función de módulo (como hace `createApplicationsService`,
  `apps/api/src/modules/applications/service.ts:232`), mejor sacar el cuerpo a una función de módulo que trocear el
  objeto.
- **Plugins de rutas:** funciones de registro por grupo (`registerReadRoutes(app, opts)`, `registerWriteRoutes(…)` o
  la partición que mejor se lea), llamadas desde el plugin. Los hooks, esquemas y el orden de registro no cambian.
- Todo en el **mismo fichero**: ninguno pasa de 300 líneas con el cambio (hoy, el mayor tiene 184). Si alguno fuera a
  pasar, para y dilo.
- Comentarios JSDoc existentes: se conservan junto a su método.

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-06 (fronteras entre módulos: ningún import nuevo entre módulos;
      `apps/api/test/module-boundaries.test.ts` tiene que seguir en verde). DEC-01 (Fastify con JSON Schema por ruta:
      los esquemas no se tocan).
- [x] **Envelope de error:** no cambia; ningún `throw` ni código de error se mueve de semántica.
- [x] **Validación con el JSON Schema de Fastify:** cada ruta conserva su esquema tal cual.
- [x] **SQLite parametrizado:** las sentencias no se tocan; solo se mueven de función.
- [ ] Migraciones: no aplica.
- [x] **Datos personales:** no cambia nada de lo que se loguea ni se responde.
- [ ] Accesibilidad: no aplica.
- [x] **Caracteres crudos:** nada de NUL ni U+2028/U+2029.
- [x] **Reuso obligatorio:** el patrón `createXOperations` de `apps/api/src/modules/applications/repository.ts:145-215`.
- [x] Otros: la regla de lint es **sin excepciones**. Si una función no se puede partir sin dañar la lectura, para y
      dilo; no la excuses.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.**
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de estos:** los 6 de §1.1, `eslint.config.js` y
      `docs/07_architecture_principles/QUALITY-GATES.md`. **Ningún test.**
- [x] **No instales dependencias.**
- [x] **No ejecutes la suite completa ni `npm run integrate`:** lo hace la sesión.
- [x] **Nada de red.**

## 4. Verificación que debes PEGAR en tu informe
- [x] `npm test -w apps/api -- test/jobs test/candidates test/module-boundaries.test.ts` (di cuántos ficheros se
      ejecutaron y comprueba que cuadra con `ls`).
- [x] `npm run typecheck`.
- [x] `npm run lint` (entero: la regla nueva tiene que pasar en todo `apps/*/src`).
- [x] `npx eslint --no-color --rule 'complexity: [error, 10]' apps/api/src/modules/jobs apps/api/src/modules/candidates`
      (la partición no puede subir la complejidad).
- [x] `git diff --stat -- apps/api/test apps/web` vacío.
- [ ] `npx playwright test`: no aplica (sin cambios de pantalla; la sesión pasa los e2e en la integración).
- [x] Los criterios de done 1-4, uno a uno, con su evidencia.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice el sprint o la auditoría, si necesitarías instalar una dependencia o si el
> reuso obligatorio no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una afirmación
> sin pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo, añádelo al final de tu informe en un bloque `APRENDIZAJE`.

## 7. Resultado de la integración
> La rellena la sesión después del builder, con la **salida real**. Ciclo de arreglo: 0/2.

Ejecutada por la sesión el 2026-10-09 con Node 24.21.0:

```
$ npm run integrate
Paso           Resultado   Segundos
-----------------------------------
typecheck      verde            3,0
lint           verde            2,7
test-api       verde            5,7
test-web       verde            7,8
e2e            verde           25,3
check-harness  verde            1,2
-----------------------------------
Total                          45,7

✔ Integración en verde. Logs en logs/integrate/ y tabla en logs/integrate/summary.txt
$ grep -E "Tests |Test Files" logs/integrate/test-api.log
 Test Files  78 passed (78)
      Tests  1097 passed (1097)
$ grep -E "Tests |Test Files" logs/integrate/test-web.log
 Test Files  59 passed (59)
      Tests  754 passed (754)
$ grep "passed (" logs/integrate/e2e.log
  47 passed (25.0s)
$ git diff --stat -- apps/api/test apps/web
(vacío)
```

Antes del refactor, con la regla nueva, `npx eslint` daba los 6 errores de §1.1 (salida en el informe del builder);
después, `npm run lint` en verde. La función más larga queda en 44 líneas (`createJobWriteOperations`). La revisión
del diff confirma que cada método conserva su `transaction(...)` en el objeto devuelto y que `recalculateRetention`
sigue abriendo la suya.

- **Resultado:** verde.
- **Commit:** el de esta tarea, `[T-09]`.
