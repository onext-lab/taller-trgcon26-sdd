# Brief de implementación — HU-07 · TASK-03

> `/implementar-hu` lo rellena **entero** y se lo pasa al builder. El porqué de cada línea está en
> `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/tasks/TASK-03.md` (criterios de
  done incluidos).
- **Capa y builder:** `api` → `api-builder`.
- **Diseño:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/plans/TECHNICAL_DOC-backend.md`, secciones
  «Contrato de API» (`POST /api/applications`, «409 nuevo»), «Firmas internas», «Diagrama de secuencia», DD-06, DD-07,
  DD-09 y «Estrategia de tests» (RNF-01).
- **Criterios que cubre:** RF-02; CA-06 (inscribir tras ampliar o quitar), CA-09, CA-10 (API) y CA-11; RNF-01;
  EC-11, EC-14, EC-16 y EC-28 (parte de inscribir).
- **Dónde se trabaja:** la raíz del repo, rama de la HU (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** TASK-01 (`5f9f998`, la fecha en la oferta) y TASK-02 (`d5b319e`,
  `apps/api/src/calendar.ts` con `madridCalendarDate`, `formatCalendarDate` e `isDeadlinePassed`).
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-06 (`inscripciones` lee la fecha por `JobStatusPort`; ningún módulo importa a otro; el
      puerto se conecta en `apps/api/src/app.ts` sin tocarlo), DEC-07 (409 `ENROLLMENT_DEADLINE_PASSED`, sin
      `details`, con «El plazo de inscripción de esta oferta terminó el dd/mm/aaaa.»), DEC-08 (el plazo se lee dentro
      de la transacción de la inscripción) y DEC-09 (un solo `now()` por petición; día de Madrid).
- [x] **Orden de comprobación (RN-07):** 404 de la oferta → 404 del candidato → 409 `INVALID_TRANSITION` → 409 de
      plazo → 409 `DUPLICATE`. Los tests de HU-04 no cambian.
- [x] **Envelope de error** `{ error: { code, message, details? } }`; nunca *stack traces*.
- [x] **SQLite parametrizado.**
- [ ] **Migraciones:** no hay.
- [x] **Datos personales:** el mensaje del 409 solo lleva la fecha; nada del candidato.
- [ ] **Accesibilidad:** no aplica.
- [x] **Caracteres crudos:** nunca NUL ni U+2028/U+2029.
- [x] **Reuso obligatorio:** `isDeadlinePassed` y `formatCalendarDate` de `apps/api/src/calendar.ts`; las factorías
      de `apps/api/src/errors.ts`; los dobles de `apps/api/test/helpers/applications.ts`.
- [x] Otros: ninguna función de más de 50 líneas ni fichero de más de 300.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.**
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de «Archivos afectados»** sin decirlo en el informe.
- [x] **No instales dependencias.**
- [x] **No ejecutes la suite completa:** tests acotados a tus ficheros (más `applications/enroll`).
- [x] **Nada de red**; datos inventados.
- [x] **Descartado a conciencia:** el pipeline y el seed (TASK-04), los ataques hostiles (TASK-05) y la web.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- applications/enroll-deadline applications/ports applications/privacy-logs`: **3**
      ficheros de test.
- [x] `npm test -w apps/api -- applications/enroll`.
- [x] `npm run typecheck`.
- [x] `npx eslint <los 9 ficheros de la task>`.
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**.

## 6. Aprendizaje
> Lo no obvio y duradero, en un bloque `APRENDIZAJE` al final del informe.

## 7. Resultado de la integración
> La rellena `/implementar-hu` con la **salida real** de los comandos que ejecuta la sesión. Ciclo de arreglo: 0/2.

```
$ npm test -w apps/api -- applications/enroll-deadline applications/ports applications/privacy-logs
 Test Files  3 passed (3)
      Tests  32 passed (32)

$ npm test -w apps/api -- applications/enroll module-boundaries
 Test Files  6 passed (6)
      Tests  65 passed (65)

$ npm run typecheck
(exit 0; apps/api/src/app.ts sin tocar)

$ npx eslint <los 9 ficheros de la task>
(exit 0, sin salida)
```

- **Resultado:** verde, sin ciclos de arreglo (0/2).
- **Commit:** el de esta task, `feat(api): reject enrollment after the job's deadline (409 ENROLLMENT_DEADLINE_PASSED) [HU-07 TASK-03]`.
