# Brief de implementación — T-14 (sin HU) · Un solo `isNotFound` en la web

> Tarea sin HU del sprint-02 (`docs/01_roadmap/sprints/sprint-02.md`, T-14). Plantilla recorrida entera:
> `docs/_templates/BRIEF-IMPLEMENTACION.template.md`.

## 1. Qué hay que hacer
- **El contrato es este brief y la sección T-14 del sprint.** Criterios de done en §1.1.
- **Capa y builder:** `web` → `web-builder`.
- **Diseño:** sin TECHNICAL_DOC (refactor interno sin cambio de contrato, `docs/WORKFLOW.md` §9). Diseño en §1.2.
- **Criterios que cubre:** la duplicación de `isNotFound` de la auditoría del sprint-01 (§2, info), que el responsable
  técnico decidió tratar como deuda el 2026-10-09.
- **Dónde se trabaja:** la raíz del repo (el worktree de la sesión), rama `worktree-paso-3-punto-de-partida`; no
  cambies de rama. Node 24.21 en el `PATH`.
- **Lo que ya está en la rama:** T-08 a T-11. Suite en verde.
- **Lee solo lo que este brief nombra.**

### 1.1 Criterios de done
1. Hay **una sola** definición de `isNotFound(error: unknown): boolean`, exportada desde
   `apps/web/src/components/http.ts`, junto a `ApiError` (`:38`), con el mismo cuerpo y el comentario que hoy lleva
   en `apps/web/src/features/jobs/JobDetailScreen.tsx:19-23` (404 y 400 de la API se pintan como un ID no válido, EC-43).
2. Las 5 copias desaparecen y sus usos importan la común:
   - `apps/web/src/features/jobs/JobDetailScreen.tsx:21` (la exportada);
   - `apps/web/src/features/candidates/CandidateFormScreen.tsx:36`;
   - `apps/web/src/features/candidates/CandidateDetailScreen.tsx:18`;
   - `apps/web/src/features/applications/ApplicationDetailScreen.tsx:19`;
   - `apps/web/src/features/applications/PipelineScreen.tsx:33`.
   `apps/web/src/features/jobs/JobFormScreen.tsx:8` deja de importarla de `JobDetailScreen.tsx` (sigue importando
   `NotFound` de ahí).
3. `grep -rn "function isNotFound" apps/web/src` da exactamente 1 línea.
4. Un test unitario en `apps/web/test/components/http.test.ts` fija el comportamiento: `true` para un `ApiError` con
   404 y con 400; `false` para 409, 500, un `ApiError` sin esos estados, un `Error` normal, `null` y un objeto con
   `status: 404` que no es `ApiError`. El fichero no pasa de 300 líneas (hoy, 235).
5. Sin cambio de comportamiento: ningún otro test cambia, y los de las 6 pantallas afectadas siguen en verde.

### 1.2 Diseño
- `http.ts` ya es el sitio de `ApiError`, `userMessage` e `isRecord`: `isNotFound` es del mismo tipo (interpretar un
  error de la API). Nada de un fichero nuevo.
- Import con extensión `.ts`, como el resto de imports del repo.

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-06 en la web (`ARCHITECTURE.md` §Convenciones, «Web»): `components/` es común; las features
      importan de `components/`, nunca al revés.
- [ ] Envelope de error: no cambia (solo se lee `status`).
- [ ] Validación con JSON Schema: no aplica.
- [ ] SQLite parametrizado: no aplica.
- [ ] Migraciones: no aplica.
- [ ] Datos personales: no aplica.
- [x] **Accesibilidad:** sin cambios en lo que se pinta; los tests de las pantallas lo comprueban.
- [x] **Caracteres crudos:** nada de NUL ni U+2028/U+2029.
- [x] **Reuso obligatorio:** `ApiError` de `apps/web/src/components/http.ts:38`.
- [x] Otros: la regla de efectos pasivos de `npm run check:harness` aplica a cualquier aserción nueva (el test es puro,
      no debería tocarla).

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.**
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de estos:** `apps/web/src/components/http.ts`, las 6 pantallas del criterio 2 y
      `apps/web/test/components/http.test.ts`.
- [x] **No instales dependencias.**
- [x] **No ejecutes la suite completa ni `npm run integrate`.**
- [x] **Nada de red.**

## 4. Verificación que debes PEGAR en tu informe
- [x] `npm test -w apps/web -- test/components/http.test.ts test/features/jobs/JobDetailScreen test/features/jobs/JobFormScreen test/features/candidates/CandidateFormScreen test/features/candidates/CandidateDetailScreen test/features/applications/ApplicationDetailScreen test/features/applications/PipelineScreen`
      (di cuántos ficheros se ejecutaron y comprueba con `ls` que cuadra).
- [x] `npm run typecheck`.
- [x] `npx eslint` sobre los 8 ficheros tocados.
- [x] `grep -rn "function isNotFound" apps/web/src`.
- [ ] `npx playwright test`: no aplica (la sesión pasa los e2e en la integración).
- [x] Los criterios de done 1-5, uno a uno, con su evidencia.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice el sprint o la auditoría, si necesitarías instalar una dependencia o si el
> reuso obligatorio no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una afirmación
> sin pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo, añádelo al final de tu informe en un bloque `APRENDIZAJE`.

## 7. Resultado de la integración
> La rellena la sesión después del builder, con la **salida real**. Ciclo de arreglo: 0/2.

Ejecutada por la sesión el 2026-10-09, con T-12 y T-13 en el mismo árbol (sus commits van aparte):

```
$ npm run integrate
typecheck verde 3,6 · lint verde 3,2 · test-api verde 7,0 · test-web verde 8,1 · e2e verde 26,1 · check-harness verde 2,7
Total 50,7 · ✔ Integración en verde.
$ grep -E "Tests |Test Files" logs/integrate/test-web.log
 Test Files  59 passed (59)
      Tests  762 passed (762)
$ grep -rn "function isNotFound" apps/web/src
apps/web/src/components/http.ts:54:export function isNotFound(error: unknown): boolean {
```

La web pasa de 754 a 762 tests: los 8 casos nuevos de `isNotFound` en `apps/web/test/components/http.test.ts`; ningún
test existente cambia.

- **Resultado:** verde.
- **Commit:** el de esta tarea, `[T-14]`.
