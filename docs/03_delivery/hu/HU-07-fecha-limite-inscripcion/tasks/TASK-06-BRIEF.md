# Brief de implementación — HU-07 · TASK-06

> `/implementar-hu` lo rellena **entero** y se lo pasa al builder. El porqué de cada línea está en
> `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/tasks/TASK-06.md` (criterios de
  done incluidos).
- **Capa y builder:** `web` → `web-builder`.
- **Diseño:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/plans/TECHNICAL_DOC-frontend.md`, secciones
  «Pantallas y estados» (formulario y ficha), «Dependencias» (S1-S3), DD-01, DD-03, DD-06, DD-07, DD-08 y DD-09. El
  contrato de API es el de `plans/TECHNICAL_DOC-backend.md` § «Contrato de API», ya implementado en la rama.
- **Criterios que cubre:** RF-03, RF-06 y la parte visible de RF-01 (CA-07); CA-01 a CA-05, CA-07 y CA-08 (web);
  RNF-02 (el campo con `<label>`); EC-17 (400 de la API), EC-18, EC-21 y EC-23.
- **Dónde se trabaja:** la raíz del repo, rama de la HU (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** la API completa del campo: `enrollmentDeadline` (`AAAA-MM-DD` o `null`) en el `Job`,
  400 `VALIDATION_ERROR` con `details[{ field: 'enrollmentDeadline' }]` y los textos de DT-01, y el 400 al publicar con
  el plazo vencido (TASK-01 y TASK-02).
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-09 (la web nunca calcula «hoy»: lo decide la API, DD-03; la fecha se pinta `dd/mm/aaaa` con
      `formatCalendarDate`), DEC-11 (los errores de la API van junto al campo con su `message`) y DT-01 del PRD (textos
      exactos).
- [ ] **Envelope de error / JSON Schema / SQLite / migraciones:** no aplica (web).
- [ ] **Datos personales:** no aplica (la fecha es de la oferta).
- [x] **Accesibilidad:** `<input type="date">` con `<label>` «Fecha límite de inscripción», localizable por su nombre
      accesible; errores con su asociación al campo como los demás de `FormField`.
- [x] **Caracteres crudos:** nunca NUL ni U+2028/U+2029.
- [x] **Reuso obligatorio:** `FormField` (`apps/web/src/components/FormField.tsx`), `formatCalendarDate`
      (`apps/web/src/components/format.ts`), el reparto de errores por campo de `job-form-errors.ts` (el campo nuevo
      entra en `FIELD_ORDER`).
- [x] Otros: ningún fichero de más de 300 líneas (ojo con `JobDetailScreen.actions.test.tsx`), ninguna función de más
      de 50 y `validateJobForm` sin pasar de 10 ramas.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.**
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de «Archivos afectados»** sin decirlo en el informe.
- [x] **No instales dependencias.**
- [ ] **No ejecutes la suite completa:** *excepción de esta task*: un criterio de done es `npm test -w apps/web`
      completo (la cascada de *fixtures*). Ejecútala una vez, al final.
- [x] **No toques nada de `apps/api`:** otro builder trabaja a la vez en la API (TASK-04). Para el typecheck usa
      `npm run typecheck -w apps/web`; si la raíz falla por ficheros de `apps/api`, no es tuyo: dilo.
- [x] **Nada de red**; datos inventados.
- [x] **Descartado a conciencia:** el pipeline (TASK-07), los ataques web y el 409 (TASK-08), el e2e (TASK-09) y
      `hasBadInput` (TASK-08).

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/web -- deadline format`.
- [x] `npm test -w apps/web` (completo, una vez).
- [x] `npm run typecheck -w apps/web`.
- [x] `npx eslint <los ficheros de la task>`.
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**.

## 6. Aprendizaje
> Lo no obvio y duradero, en un bloque `APRENDIZAJE` al final del informe.

## 7. Resultado de la integración
> La rellena `/implementar-hu` con la **salida real** de los comandos que ejecuta la sesión. Ciclo de arreglo: 0/2.

```
$ npm test -w apps/web -- deadline format
 Test Files  5 passed (5)
      Tests  45 passed (45)

$ npm test -w apps/web -- features/jobs App
 Test Files  42 passed (42)
      Tests  516 passed (516)

$ npm run typecheck
(exit 0, raíz y los dos workspaces)

$ npx eslint apps/web/src/components/format.ts apps/web/src/features/jobs apps/web/test/features/jobs apps/web/test/components/format.test.ts apps/web/test/App.test.tsx
(exit 0, sin salida)

El builder ejecutó además npm test -w apps/web completo (63 ficheros, 801 tests).
```

- **Resultado:** verde, sin ciclos de arreglo (0/2).
- **Commit:** el de esta task, `feat(web): enrollment deadline field in the job form and detail [HU-07 TASK-06]`.
