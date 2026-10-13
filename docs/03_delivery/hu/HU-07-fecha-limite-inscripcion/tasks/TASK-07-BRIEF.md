# Brief de implementación — HU-07 · TASK-07

> `/implementar-hu` lo rellena **entero** y se lo pasa al builder. El porqué de cada línea está en
> `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/tasks/TASK-07.md` (criterios de
  done incluidos).
- **Capa y builder:** `web` → `web-builder`.
- **Diseño:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/plans/TECHNICAL_DOC-frontend.md`, secciones
  «Pantallas y estados» (pipeline), «Dependencias» (S4), DD-04 y DD-05 (solo lo que no sea el 409, que es de
  TASK-08). Contrato: `plans/TECHNICAL_DOC-backend.md` § «Contrato de API» (`Pipeline.job`), ya implementado.
- **Criterios que cubre:** RF-04 (sin el 409, que es de TASK-08); CA-06 y CA-12 (web); EC-14, EC-25, EC-28 y EC-30.
- **Dónde se trabaja:** la raíz del repo, rama de la HU (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** la API completa (TASK-01 a TASK-04): el `job` del pipeline trae
  `{ id, status, enrollmentDeadline, enrollmentDeadlinePassed }`. «Inscribir candidato» solo si
  `status === 'published' && !enrollmentDeadlinePassed`; el texto de DT-01 solo si
  `status === 'published' && enrollmentDeadlinePassed`. TASK-06 (formulario y ficha de la oferta) también está hecha.
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-09 (la web nunca calcula «hoy»: usa el booleano del servidor, DD-04; la fecha se pinta
      `dd/mm/aaaa` con `formatCalendarDate`) y DT-01 del PRD (texto exacto del pipeline: «El plazo de inscripción
      terminó el dd/mm/aaaa: no se pueden inscribir más candidatos.»).
- [ ] **Envelope de error / JSON Schema / SQLite / migraciones:** no aplica (web).
- [ ] **Datos personales:** no aplica.
- [x] **Accesibilidad:** el aviso con `role="status"`; «Inscribir candidato» desaparece (no se deshabilita sin
      explicación); estados de carga, vacío y error como hoy.
- [x] **Caracteres crudos:** nunca NUL ni U+2028/U+2029.
- [x] **Reuso obligatorio:** el guard `isPipeline` (`apps/web/src/features/applications/api.ts`), `formatCalendarDate`
      (`apps/web/src/components/format.ts`) y los *fixtures* de `apps/web/test/features/applications/fixtures.ts`.
- [x] Otros: ningún fichero de más de 300 líneas; `PipelineContent` sin pasar de 10 ramas ni de 50 líneas.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.**
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de «Archivos afectados»** sin decirlo en el informe.
- [x] **No toques nada de `apps/api`.**
- [x] **No instales dependencias.**
- [x] **No ejecutes la suite completa:** tests acotados (`features/applications App`).
- [x] **Nada de red**; datos inventados.
- [x] **Descartado a conciencia:** el 409 al inscribir con la página cargada (TASK-08) y el e2e (TASK-09).

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/web -- features/applications App`.
- [x] `npm run typecheck`.
- [x] `npx eslint apps/web/src/features/applications apps/web/test/features/applications apps/web/test/App.test.tsx`.
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**.

## 6. Aprendizaje
> Lo no obvio y duradero, en un bloque `APRENDIZAJE` al final del informe.

## 7. Resultado de la integración
> La rellena `/implementar-hu` con la **salida real** de los comandos que ejecuta la sesión. Ciclo de arreglo: 0/2.

```
$ npm test -w apps/web -- features/applications App
 Test Files  19 passed (19)
      Tests  242 passed (242)

$ npm run typecheck
(exit 0)

$ npx eslint apps/web/src/features/applications apps/web/test/features/applications apps/web/test/App.test.tsx
(exit 0, sin salida)

Observación del builder para la review: no hay test de que una recarga con el plazo ya vencido descarte un panel de inscribir abierto (lo dispara el 409 de TASK-08).
```

- **Resultado:** verde, sin ciclos de arreglo (0/2).
- **Commit:** el de esta task, `feat(web): hide enroll action when the enrollment deadline has passed [HU-07 TASK-07]`.
