# Brief de implementación — HU-07 · TASK-07

> TASK-07 — Pantalla «Importar candidatos» con su informe, la ruta y el enlace desde el listado. Plantilla `docs/_templates/BRIEF-IMPLEMENTACION.template.md` recorrida entera (R1). Solución de referencia de
> la feature en vivo C, rama `hu/HU-07-importar-candidatos-csv` (sale de `vivo/C`).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-07-importar-candidatos-csv/tasks/TASK-07.md` (descripción, archivos afectados, tests y criterios de done).
- **Capa y builder:** `web` → `web-builder` (copiado del campo `Capa:` de la task).
- **Diseño:** docs/03_delivery/hu/HU-07-importar-candidatos-csv/plans/TECHNICAL_DOC-frontend.md: «Pantallas y estados», «Decisiones de diseño» (DD-02, DD-03, DD-05 a DD-07), «Diagrama de secuencia» y «Error paths». No el documento entero.
- **Criterios que cubre:** los RF, CA y EC que lista la task.
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-07-importar-candidatos-csv` (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** TASK-06.
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-01 (Fastify con JSON Schema), DEC-06 (fronteras de módulos), DEC-07 y DEC-08 con sus aclaraciones del 2026-10-12, DEC-11 (envelope, `details`, caracteres de control) y **DEC-13** (cuerpo crudo `text/csv` en un plugin aislado con su `bodyLimit`), en `docs/07_architecture_principles/DECISIONS.md`.
- [ ] **Envelope de error** `{ error: { code, message, details? } }` con códigos estables; nunca *stack traces*. (La web solo lo lee.)
- [ ] **Validación con el JSON Schema de Fastify** en la ruta (cuerpo, respuesta). No aplica a la web.
- [ ] **SQLite parametrizado**: siempre sentencias preparadas. No aplica a la web.
- [ ] **Migraciones**: no aplica (el diseño no tiene migración).
- [x] **Datos personales** (`docs/RGPD.md`): el contenido del fichero (nombres, emails, teléfonos) nunca va a logs, errores ni respuestas de más; nada del fichero se guarda (FEAT-04 INV-06); datos inventados con `@example.com` y la serie `+34 600 000 0xx`.
- [x] **Accesibilidad** (web): roles y nombres accesibles, `label` en cada control, estados explícitos; nada de aserciones síncronas sobre foco, título o diálogo (`npm run check:harness`, efectos pasivos).
- [x] **Caracteres crudos**: nunca NUL ni U+2028/U+2029 en el código; usa secuencias de escape (el hook lo bloquea).
- [x] **Reuso obligatorio**: `ErrorMessage`/`LoadingMessage` (`apps/web/src/components/StatusMessages.tsx`), `useDocumentTitle`, el router y `expectFocusOn` (`apps/web/test/helpers/focus.ts`).
- [x] Otros: convenciones de `docs/ARCHITECTURE.md` §«Convenciones del repo» (factorías cortas, `*_MESSAGE`, guardas `isX`, tests hermanos antes de 300 líneas); `max-lines-per-function` 50 en `apps/*/src`.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** (el diseño no prevé ninguna).
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.
- [x] **Nada de mutaciones** del código para probar los tests: las hace la review, en serie.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/web -- <ficheros de test de la tarea>`: el número de ficheros de test ejecutados = el de ficheros que tocaste.
- [x] `npm run typecheck`.
- [x] `npx eslint <ficheros tocados>`.
- [ ] `npx playwright test`: no aplica (la sesión pasa los e2e en la integración final).
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una afirmación sin
> pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo, añádelo al final de tu informe en un bloque `APRENDIZAJE`.

## 7. Resultado de la integración
> **Obligatoria.** La rellena `/implementar-hu` después del builder, con la **salida real** de los comandos que ejecuta
> la sesión. Ciclo de arreglo: 0/2.

Ejecutada por la sesión el 2026-10-12, con Node 24.21.0:

```
$ npm test -w apps/web -- test/features/candidates/CandidateImportScreen.test.tsx test/features/candidates/CandidateImportScreen.errors.test.tsx test/App.test.tsx test/features/candidates/CandidateListScreen.test.tsx
 Test Files  4 passed (4)
      Tests  39 passed (39)
$ npm run typecheck -w apps/web
exit=0
(TASK-03 estaba en curso a la vez en apps/api; la pasada completa de la ola va con npm run integrate)
$ npx eslint <los 13 ficheros de la tarea>
exit=0
$ npm run check:harness
check:harness: todo en verde.
  ✔ efectos pasivos: 11 casos de autoprueba; 0 aserciones síncronas, 0 en excepciones fechadas
Desviaciones aceptadas por la sesión: test partido en CandidateImportScreen.errors.test.tsx (decisión del responsable
técnico: hermanos antes de 300 líneas); refs creados en el componente y pasados al hook (patrón de ConsentSection);
espacio fuera del span oculto de «Ver candidato» para que el nombre accesible sea el de CA-18.
```

- **Resultado:** verde.
- **Commit:** el de esta tarea, `[HU-07 TASK-07]`.
