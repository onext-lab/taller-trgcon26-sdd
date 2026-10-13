# Brief de implementación — HU-07 · TASK-09

> `/implementar-hu` lo rellena **entero** y se lo pasa al builder. El porqué de cada línea está en
> `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/tasks/TASK-09.md` (criterios de
  done incluidos). Es `[e2e]`: el recorrido de la HU en Playwright (solo Chromium).
- **Capa y builder:** `web` → `web-builder` (una `[e2e]` de Playwright va a la capa web).
- **Diseño:** `docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/plans/TECHNICAL_DOC-frontend.md`, «Estrategia de
  tests» (e2e E1, E2 y E3). El seed de las dos ofertas con plazo: `plans/TECHNICAL_DOC-backend.md`, DD-11.
- **Criterios que cubre:** el recorrido de RF-03 y RF-04: E1 crear con fecha, verla en la ficha y quitarla; E2 una
  fecha pasada da el error junto al campo; E3 en el seed, la vencida sin «Inscribir candidato» y con el texto de DT-01,
  y la de plazo futuro con el botón.
- **Dónde se trabaja:** la raíz del repo, rama de la HU (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** TASK-01 a TASK-08 (API, formulario, ficha, pipeline y el 409 en la web). Los e2e usan
  `data/e2e.db`, que se regenera en cada pasada, y los puertos 3101 y 5174 (`playwright.config.ts`).
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-03 (la base de los e2e se regenera; no se versiona) y DEC-09 (las fechas del seed son
      relativas al reset: localiza las ofertas por su título, no por ID ni por una fecha fija).
- [x] **Selectores por rol y nombre accesible** (principio de diseño 2): nada de selectores CSS frágiles.
- [x] **Datos inventados.**
- [x] **Reuso obligatorio:** `createJobByApi` y compañía de `e2e/support/applications.ts`.
- [x] **Caracteres crudos:** nunca NUL ni U+2028/U+2029.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.** Si el seed nuevo rompe otro spec, dilo con su salida: no lo
      «arregles» cambiando el otro spec sin explicar por qué.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de «Archivos afectados»** sin decirlo en el informe.
- [x] **No instales dependencias** ni navegadores.
- [ ] **No ejecutes la suite completa:** *excepción de esta task*: un criterio de done es `npm run e2e` completo. No lo
      lances a la vez que la suite unitaria (el repo lo desaconseja: los tests web pasan de su *timeout*).
- [x] **Nada de red**; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npx playwright test e2e/jobs-deadline.spec.ts`: **3** tests.
- [x] `npm run e2e` (completo, una vez).
- [x] `npm run typecheck`.
- [x] `npx eslint e2e/jobs-deadline.spec.ts`.
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**.

## 6. Aprendizaje
> Lo no obvio y duradero, en un bloque `APRENDIZAJE` al final del informe.

## 7. Resultado de la integración
> La rellena `/implementar-hu` con la **salida real** de los comandos que ejecuta la sesión. Ciclo de arreglo: 0/2.

```
$ npx playwright test e2e/jobs-deadline.spec.ts
  ✓  1 [chromium] › e2e/jobs-deadline.spec.ts:63:1 › CA-01 y CA-03 crear con fecha límite, verla en la ficha y quitarla (886ms)
  ✓  2 [chromium] › e2e/jobs-deadline.spec.ts:87:1 › CA-02 una fecha pasada da el error junto al campo (537ms)
  ✓  3 [chromium] › e2e/jobs-deadline.spec.ts:102:1 › CA-12, CA-13 y EC-25 seed: la vencida sin botón y con el texto; la de plazo futuro con botón (715ms)
  3 passed (5.6s)

$ npm run typecheck
(exit 0)

$ npx eslint e2e/jobs-deadline.spec.ts
(exit 0, sin salida)

El builder ejecutó además npm run e2e completo (50 de 50). Observación: en el seed la oferta vencida no tiene inscripciones (INV-01), así que la rama «Avanzar/Rechazar» de E3 no se ejecuta en e2e; la cubre Vitest (CA-12).
```

- **Resultado:** verde, sin ciclos de arreglo (0/2).
- **Commit:** el de esta task, `test(e2e): enrollment deadline journey [HU-07 TASK-09]`.
