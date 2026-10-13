# Brief de implementación — HU-07 · TASK-05

> `/implementar-hu` lo rellena **entero** y se lo pasa al builder. El porqué de cada línea está en
> `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/tasks/TASK-05.md` (criterios de
  done incluidos). Es `[adversarial]`: tests que intentan romper RF-01 y RF-02.
- **Capa y builder:** `api` → `api-builder`.
- **Diseño:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/plans/TECHNICAL_DOC-backend.md`, secciones «Error
  paths», «Threat modeling» y «Estrategia de tests» (filas `[adversarial]`).
- **Criterios que cubre:** RF-01 y RF-02 (cobertura adversarial); EC-01, EC-04, EC-07, EC-09, EC-12, EC-13 y EC-15.
- **Dónde se trabaja:** la raíz del repo, rama de la HU (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** TASK-01 a TASK-04: la fecha en la oferta, su validación, el 409 al inscribir y el
  pipeline con el plazo.
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-06 (fallo inyectado en el puerto: 500 sin nada a medias), DEC-07 y DEC-11.4 (400 sin
      repetir el valor recibido), DEC-08 (el plazo se lee en la transacción; la carrera de EC-13) y DEC-09 (reloj
      inyectado).
- [x] **Envelope de error** `{ error: { code, message, details? } }`; un 500 es `INTERNAL_ERROR` sin traza.
- [x] **Datos personales:** el cuerpo de ningún error lleva datos del candidato (EC-15).
- [x] **Caracteres crudos:** nunca NUL ni U+2028/U+2029 en el código (usa secuencias de escape en los tests).
- [x] **Reuso obligatorio:** los dobles de `apps/api/test/helpers/applications.ts` (`failDeadline`,
      `deadlineInsideTransaction`) y el reloj de `createTestClock`.
- [x] **Nombres:** cada test nombra su EC y su categoría de QUALITY-GATES § 3 en el `describe` o el título.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.** Si un test adversarial descubre un fallo de producción
      **dentro** del alcance de RF-01 o RF-02, puedes arreglarlo con el cambio mínimo, nombrándolo en el informe
      (la task lo prevé con un commit `fix(api)`). **Nunca** adaptes un test para que pase sobre un bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de «Archivos afectados»** sin decirlo en el informe.
- [x] **No toques nada de `apps/web`:** otro builder trabaja a la vez en la web.
- [x] **No instales dependencias.**
- [x] **No ejecutes la suite completa:** tests acotados a tus ficheros.
- [x] **Nada de red**; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/api -- deadline-adversarial`: **2** ficheros de test.
- [x] `npm run typecheck -w apps/api`.
- [x] `npx eslint <los ficheros tocados>`.
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**.

## 6. Aprendizaje
> Lo no obvio y duradero, en un bloque `APRENDIZAJE` al final del informe.

## 7. Resultado de la integración
> La rellena `/implementar-hu` con la **salida real** de los comandos que ejecuta la sesión. Ciclo de arreglo: 0/2.

```
$ npm test -w apps/api -- deadline-adversarial
 Test Files  2 passed (2)
      Tests  20 passed (20)

$ npm run typecheck -w apps/api
(exit 0)

$ npx eslint apps/api/test/jobs/deadline-adversarial.test.ts apps/api/test/applications/enroll-deadline-adversarial.test.ts
(exit 0, sin salida)

Ningún test destapó un fallo de producción: commit test(api), sin cambios en apps/api/src.
```

- **Resultado:** verde, sin ciclos de arreglo (0/2).
- **Commit:** el de esta task, `test(api): adversarial tests for enrollment deadline and late enrollment [HU-07 TASK-05]`.
