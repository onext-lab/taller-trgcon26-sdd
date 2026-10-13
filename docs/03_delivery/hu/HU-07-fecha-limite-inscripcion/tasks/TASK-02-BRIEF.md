# Brief de implementación — HU-07 · TASK-02

> `/implementar-hu` lo rellena **entero** y se lo pasa al builder. El porqué de cada línea está en
> `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/tasks/TASK-02.md` (criterios de
  done incluidos).
- **Capa y builder:** `api` → `api-builder`.
- **Diseño:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/plans/TECHNICAL_DOC-backend.md`, secciones
  «Contrato de API» («Reglas del servicio», «Por endpoint»), «Firmas internas», DD-02, DD-03, DD-04, DD-10 y DD-12.
- **Criterios que cubre:** RF-01 (reglas de día, «no anterior a hoy» solo si cambia, publicar con el plazo vencido);
  CA-01, CA-02, CA-04, CA-05 y CA-07; EC-02, EC-08, EC-17 y EC-23 (parte API); RNF-01 (cálculo del día).
- **Dónde se trabaja:** la raíz del repo, rama de la HU (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** TASK-01 (`5f9f998`): migración `004`, `enrollmentDeadline` en esquemas, repositorio,
  recorte y duplicar; tests `apps/api/test/jobs/deadline.test.ts` y `deadline-publish-duplicate.test.ts`, que esta
  task amplía.
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-06 (ningún módulo importa a otro: `madridCalendarDate` sale de `candidates/retention.ts` a
      `apps/api/src/calendar.ts`, que no es `modules/`), DEC-07 y DEC-11.4 (400 `VALIDATION_ERROR` con
      `details: [{ field: 'enrollmentDeadline', message }]`, sin repetir el valor recibido), DEC-09 (día natural de
      Europe/Madrid con el reloj inyectado; un solo instante por petición) y DT-01 del PRD (los textos exactos).
- [x] **Envelope de error** `{ error: { code, message, details? } }`; nunca *stack traces*.
- [x] **Validación con el JSON Schema de Fastify:** el esquema no cambia (DD-03): la validez la decide el servicio.
- [x] **SQLite parametrizado.**
- [ ] **Migraciones:** no hay.
- [ ] **Datos personales:** no aplica.
- [ ] **Accesibilidad:** no aplica.
- [x] **Caracteres crudos:** nunca NUL ni U+2028/U+2029.
- [x] **Reuso obligatorio:** `madridCalendarDate` (hoy en `apps/api/src/modules/candidates/retention.ts`) se mueve,
      no se duplica; `missingRequiredDetails` (`apps/api/src/modules/jobs/rules.ts`) se combina con el plazo vencido
      en el mismo 400 al publicar.
- [x] Otros: ninguna función de más de 50 líneas ni fichero de más de 300 (lo mide `npm run lint`).

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.**
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de «Archivos afectados»** sin decirlo en el informe.
- [x] **No instales dependencias.**
- [x] **No ejecutes la suite completa:** tests acotados a tus ficheros (y `module-boundaries`).
- [x] **Nada de red**; datos inventados.
- [x] **Descartado a conciencia:** el 409 al inscribir, el puerto y el pipeline (TASK-03 y TASK-04), los ataques
      hostiles (TASK-05) y la web.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- calendar jobs/deadline candidates/retention candidates/seed applications/seed-invariants`:
      **6** ficheros de test.
- [x] `npm test -w apps/api -- module-boundaries`.
- [x] `npm run typecheck`.
- [x] `npx eslint <ficheros tocados>` (la lista de la task).
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**.

## 6. Aprendizaje
> Lo no obvio y duradero, en un bloque `APRENDIZAJE` al final del informe.

## 7. Resultado de la integración
> La rellena `/implementar-hu` con la **salida real** de los comandos que ejecuta la sesión. Ciclo de arreglo: 0/2.

```
$ npm test -w apps/api -- calendar jobs/deadline candidates/retention candidates/seed applications/seed-invariants module-boundaries
 Test Files  7 passed (7)
      Tests  103 passed (103)

$ npm run typecheck
(exit 0)

$ npx eslint <los 10 ficheros de la task>
(exit 0, sin salida)

$ npm run check:harness
(exit 0: la task toca docs/_modules.md y docs/ARCHITECTURE.md)
```

- **Resultado:** verde, sin ciclos de arreglo (0/2).
- **Commit:** el de esta task, `feat(api): validate enrollment deadline on create, edit and publish [HU-07 TASK-02]`.
