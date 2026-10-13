# Brief de implementación — HU-07 · TASK-08

> `/implementar-hu` lo rellena **entero** y se lo pasa al builder. El porqué de cada línea está en
> `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/tasks/TASK-08.md` (criterios de
  done incluidos). Es `[adversarial]` de la web: el campo de fecha a medias y el 409 al inscribir fuera de plazo.
- **Capa y builder:** `web` → `web-builder`.
- **Diseño:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/plans/TECHNICAL_DOC-frontend.md`, secciones DD-02
  (`validity.badInput`), DD-05 (el 409: alerta con el `message` de la API, foco y recarga del pipeline), «Error paths»
  y «Estrategia de tests» (filas `[adversarial]`).
- **Criterios que cubre:** RF-03 y RF-04 (cobertura adversarial); CA-10 (web); EC-15 (web), EC-17, EC-19, EC-20 y
  EC-26.
- **Dónde se trabaja:** la raíz del repo, rama de la HU (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** toda la API (TASK-01 a TASK-05), el formulario y la ficha (TASK-06) y el pipeline sin
  «Inscribir candidato» cuando el plazo venció (TASK-07). El 409 `ENROLLMENT_DEADLINE_PASSED` hoy cae en el caso
  genérico de `enroll-errors.ts` y no refresca: es lo que arregla esta task, imitando `onNotPublished` de
  `PipelineScreen.tsx`.
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-09 (la web nunca decide la fecha: en el 409 muestra el `message` de la API, DD-05) y DT-01
      del PRD («Introduce una fecha válida.» para una fecha a medias, sin hacer la petición).
- [ ] **Envelope de error / JSON Schema / SQLite / migraciones:** no aplica (web).
- [x] **Datos personales (EC-15 web):** la alerta del 409 no muestra datos del candidato.
- [x] **Accesibilidad:** la alerta con `role="alert"` y el foco en ella; el panel se cierra; el pipeline se recarga.
- [x] **Caracteres crudos:** nunca NUL ni U+2028/U+2029.
- [x] **Reuso obligatorio:** `splitValidationDetails` y compañía de `apps/web/src/components/form-errors.ts`; el
      reparto de casos de `use-enrollment.ts`; el patrón `onNotPublished` de `PipelineScreen.tsx`.
- [x] **Nombres:** cada test nombra su EC o CA en el título.
- [x] Otros: ningún fichero de más de 300 líneas. Si `JobFormScreen.deadline.test.tsx` o
      `PipelineScreen.deadline.test.tsx` lo superan, **para y avisa** antes de crear un fichero hermano.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.** Nunca adaptes un test para que pase sobre un bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de «Archivos afectados»** sin decirlo en el informe.
- [x] **No toques nada de `apps/api` ni de `e2e/`.**
- [x] **No instales dependencias.**
- [ ] **No ejecutes la suite completa:** *excepción de esta task*: un criterio de done es `npm test -w apps/web`
      completo. Ejecútala una vez, al final.
- [x] **Nada de red**; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/web -- deadline form-errors features/applications/api`.
- [x] `npm test -w apps/web` (completo, una vez).
- [x] `npm run typecheck`.
- [x] `npx eslint <la lista de la task>`.
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**.

## 6. Aprendizaje
> Lo no obvio y duradero, en un bloque `APRENDIZAJE` al final del informe.

## 7. Resultado de la integración
> La rellena `/implementar-hu` con la **salida real** de los comandos que ejecuta la sesión. Ciclo de arreglo: 0/2.

```
$ npm test -w apps/web -- deadline form-errors features/applications/api
 Test Files  8 passed (8)
      Tests  124 passed (124)

$ npm run typecheck
(exit 0)

$ npx eslint <la lista de la task>
(exit 0, sin salida)

El builder ejecutó además npm test -w apps/web completo (64 ficheros, 835 tests). JobFormScreen.deadline.test.tsx queda en 299 líneas: en el límite.
```

- **Resultado:** verde, sin ciclos de arreglo (0/2).
- **Commit:** el de esta task, `feat(web): guard partial date input and handle late-enrollment 409 [HU-07 TASK-08]`.
