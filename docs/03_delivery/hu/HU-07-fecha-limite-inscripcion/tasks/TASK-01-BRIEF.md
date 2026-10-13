# Brief de implementación — HU-07 · TASK-01

> Se guarda como `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/tasks/TASK-01-BRIEF.md`. `/implementar-hu` lo
> rellena **entero** y se lo pasa al builder: con este brief y lo que nombra, el builder no necesita más contexto. El
> porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/tasks/TASK-01.md` (criterios de
  done incluidos). Trae el SQL de la migración literal y la lista de tests.
- **Capa y builder:** `api` → `api-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/plans/TECHNICAL_DOC-backend.md`, secciones
  «Contrato de API» (apartado del campo), «Migración de datos», DD-01 y DD-05. No el documento entero.
- **Criterios que cubre:** RF-01 (campo, alta, edición, detalle y duplicar, **sin** reglas de día ni de publicar),
  RF-06 (parte API), CA-01 (parte sin validación), CA-03, CA-08, EC-03, EC-05 y EC-06 de `specs/PRD.md`.
- **Dónde se trabaja:** la raíz del repo, rama de la HU (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** solo documentación de la HU (PRD, diseño y tareas); ningún código de HU-07 todavía.
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-03 (migración nueva `004`; `001`-`003` no se tocan), DEC-08 (en las ediciones gana la
      última escritura), DEC-09 (la fecha es un día de calendario `AAAA-MM-DD`), DEC-11.3 (texto opcional vacío o
      solo espacios → `null`) y DEC-11 (esquema estricto: `enrollmentDeadline` entra en `jobFieldsSchema` y en
      `required` de `jobSchema`).
- [x] **Envelope de error** `{ error: { code, message, details? } }` con códigos estables; nunca *stack traces*.
- [x] **Validación con el JSON Schema de Fastify** en cada ruta: el campo nuevo, en el esquema de entrada y en el de
      respuesta.
- [x] **SQLite parametrizado**: `INSERT_SQL` y `UPDATE_SQL` con la **lista fija** de columnas (DD-05 de HU-01); nunca
      un `SET` construido con las claves recibidas.
- [x] **Migraciones**: fichero nuevo `apps/api/src/db/migrations/004-add-job-enrollment-deadline.sql`.
- [ ] **Datos personales:** no aplica (la fecha es de la oferta); tests con datos inventados.
- [ ] **Accesibilidad:** no aplica (sin web).
- [x] **Caracteres crudos**: nunca NUL ni U+2028/U+2029; el hook lo bloquea.
- [x] **Reuso obligatorio**: `trimJobText` (`apps/api/src/modules/jobs/routes.ts`) para el recorte y `""` → `null`;
      `editableFields` (`apps/api/src/modules/jobs/service.ts`) para que el `PATCH` fusione el campo; el reloj
      `createTestClock` y los helpers de tests de `apps/api/test/helpers/` para crear ofertas por la API.
- [x] Otros: `createJobWriteOperations` (`repository.ts`) no pasa de 50 líneas; ningún fichero pasa de 300 líneas.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.**
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias.**
- [ ] **No ejecutes la suite completa:** *excepción de esta task*: un criterio de done es `npm test -w apps/api`
      completo (la cascada de tests que comparan el `Job` entero y las listas de migraciones). Ejecútala una vez, al
      final.
- [x] **Nada de red** ni servicios externos; datos inventados.
- [x] **Descartado a conciencia:** validación de día y de «no anterior a hoy», publicar con plazo vencido, el 409 al
      inscribir, el puerto, el seed y la web: son TASK-02 a TASK-09. No escribas tests del 500 que da hoy el `CHECK`
      con un día inexistente (lo convierte en 400 TASK-02).

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- jobs/migration-deadline jobs/deadline`: **3** ficheros de test ejecutados.
- [x] `npm test -w apps/api` (completo, una vez).
- [x] `npm run typecheck`.
- [x] `npx eslint <ficheros tocados>`.
- [ ] `npx playwright test`: no aplica.
- [x] Los **criterios de done de la task, uno a uno, con su evidencia** (incluido `npm run db:reset` y `wc -l`).

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una afirmación sin
> pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo, añádelo al final de tu informe en un bloque `APRENDIZAJE`.

## 7. Resultado de la integración
> La rellena `/implementar-hu` después del builder, con la **salida real** de los comandos que ejecuta la sesión.
> Ciclo de arreglo: 0/2.

```
$ npm test -w apps/api -- jobs/migration-deadline jobs/deadline
 Test Files  3 passed (3)
      Tests  10 passed (10)
   Duration  777ms (tests 46%, import 27%, transform 27%, worker 1%)

$ npm test -w apps/api -- jobs/migration-deadline jobs/deadline jobs/create jobs/get jobs/state-guards candidates/migration applications/migration
 Test Files  11 passed (11)
      Tests  125 passed (125)

$ npm run typecheck
(exit 0: @ats/api, @ats/web y el tsc raíz sin errores)

$ npx eslint <los 4 ficheros de src/modules/jobs, los 3 tests nuevos y los 5 tests existentes tocados>
(exit 0, sin salida)
```

- **Fuera del brief, comprobado por la sesión:** los 3 ficheros de test nuevos cuadran con los 3 ejecutados; el
  builder ejecutó la suite completa de la API (81 ficheros, 1 107 tests) y `npm run db:reset` («4 migraciones
  aplicadas»), y ningún fichero tocado pasa de 300 líneas.
- **Resultado:** verde, sin ciclos de arreglo (0/2).
- **Commit:** el de esta task, `feat(api): add optional enrollment deadline to job openings (migration 004) [HU-07 TASK-01]`.
