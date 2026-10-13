# Brief de implementación — HU-07 · TASK-04

> `/implementar-hu` lo rellena **entero** y se lo pasa al builder. El porqué de cada línea está en
> `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/tasks/TASK-04.md` (criterios de
  done incluidos).
- **Capa y builder:** `api` → `api-builder`.
- **Diseño:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/plans/TECHNICAL_DOC-backend.md`, secciones
  «Contrato de API» (`Pipeline.job`), «Diagrama de secuencia» (párrafo «Pipeline»), «Migración de datos» (seed), DD-08
  y DD-11.
- **Criterios que cubre:** RF-04 (parte API: `job` del pipeline con `enrollmentDeadline` y
  `enrollmentDeadlinePassed`) y RF-05; CA-06 (pipeline), CA-12 (API) y CA-13; EC-25, EC-27, EC-28 y EC-30 (parte API).
- **Dónde se trabaja:** la raíz del repo, rama de la HU (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** TASK-01 a TASK-03 (la fecha en la oferta, `apps/api/src/calendar.ts`, la validación
  y el 409 al inscribir con `getEnrollmentDeadline` en `JobStatusPort`).
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-06 (la fecha llega a `inscripciones` por `JobStatusPort`), DEC-09 (el booleano lo calcula el
      servidor con su reloj inyectado, independiente del estado de la oferta; DD-08) y DEC-10 (el pipeline solo lleva
      lo que la web necesita).
- [x] **Seed:** fechas relativas a `now` del reset (DD-11): la publicada de la posición 4, hoy + 14 días; la de la
      posición 5, sin inscripciones, hoy − 3 días. Datos inventados; ningún dato personal nuevo.
- [x] **Envelope de error** sin cambios.
- [x] **Validación con el JSON Schema de Fastify:** los dos campos nuevos en `pipelineSchema`, en `required`.
- [x] **SQLite parametrizado.**
- [ ] **Migraciones:** no hay.
- [ ] **Accesibilidad:** no aplica.
- [x] **Caracteres crudos:** nunca NUL ni U+2028/U+2029.
- [x] **Reuso obligatorio:** `isDeadlinePassed` de `apps/api/src/calendar.ts` y `getEnrollmentDeadline` de
      `JobStatusPort`.
- [x] Otros: ningún fichero de más de 300 líneas ni función de más de 50.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.**
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de «Archivos afectados»** sin decirlo en el informe.
- [x] **No instales dependencias.**
- [ ] **No ejecutes la suite completa:** *excepción de esta task*: un criterio de done es `npm test -w apps/api`
      completo (el seed cambia). Ejecútala una vez, al final.
- [x] **Nada de red**; datos inventados.
- [x] **Descartado a conciencia:** los ataques hostiles (TASK-05) y la web (TASK-06 a TASK-09).

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- applications/pipeline jobs/seed applications/seed`.
- [x] `npm test -w apps/api` (completo, una vez) y `npm run db:reset`.
- [x] `npm run typecheck`.
- [x] `npx eslint <los 8 ficheros de código y test de la task>`.
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**.

## 6. Aprendizaje
> Lo no obvio y duradero, en un bloque `APRENDIZAJE` al final del informe.

## 7. Resultado de la integración
> La rellena `/implementar-hu` con la **salida real** de los comandos que ejecuta la sesión. Ciclo de arreglo: 0/2.

```
$ npm test -w apps/api -- applications/pipeline jobs/seed applications/seed
 Test Files  7 passed (7)
      Tests  52 passed (52)

$ npm run typecheck -w apps/api
(exit 0. La raíz falla en apps/web por la TASK-06, que trabaja en paralelo sin commitear: no es de esta task)

$ npx eslint <los 8 ficheros de la task>
(exit 0, sin salida)

El builder ejecutó además npm test -w apps/api completo (85 ficheros, 1 178 tests) y npm run db:reset («4 migraciones aplicadas»).
Fuera de la tabla de la task: apps/api/test/applications/pipeline.test.ts:90 (un cuarto toEqual sobre job), avisado por el builder.
```

- **Resultado:** verde, sin ciclos de arreglo (0/2).
- **Commit:** el de esta task, `feat(api): expose enrollment deadline in the pipeline and seed deadlines [HU-07 TASK-04]`.
