# Brief de implementación — HU-02 · TASK-08

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/tasks/TASK-08.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-05 (web) · RNF: RNF-04, RNF-05 · CA: CA-16, CA-17, CA-18, CA-19 a CA-21 (vistos desde la web) · Edge cases:
    EC-34
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Listado (estados, formulario, paginación, URL),
    § Diagrama de secuencia RF-05/RF-06, § Error paths (EC-34), DD-01, DD-02, DD-03, § Estrategia de tests (fila RF-05),
    § Tests de HU-01 que cambian, § Checklist paso 7
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-02-ciclo-vida-ofertas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 211315e feat(api): job list filters, accent-insensitive search and pagination [HU-02 TASK-05]; 6c7e58a feat(web): job detail by status and close confirmation [HU-02 TASK-09]; d1659f4 test(api): adversarial tests for publish, close and duplicate [HU-02 TASK-04]; 8996219 feat(api): enforce job status on edit and delete [HU-02 TASK-03]; c9bd3c1 feat(api): publish, close and duplicate job openings [HU-02 TASK-02]; fa59f93 feat(web): search params, setData, dialog props and lifecycle API client [HU-02 TASK-07]; 901426a feat(api): cross-site write guard, applications port and 10-job seed [HU-02 TASK-01]; 7c4b690 docs(HU-02): tasks and roadmap; 17887f5 docs(HU-02): technical design; 7355db9 docs(HU-02): PRD; 5136493 docs(HU-02): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-05 (`GET /api/jobs` con filtros), TASK-07 (`useSearch`, `listJobs(query)`, `list-query.ts`)
  - **Bloquea:** TASK-13, TASK-14
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [x] **Decisiones:** las `DEC-NN` que cita la task y, siempre, DEC-11 (Ajv estricto, `details` sin el valor recibido),
      DEC-01 (envelope), DEC-07 (códigos), DEC-09 (fechas UTC y reloj inyectado) y DEC-06 (transacciones), en
      `docs/07_architecture_principles/DECISIONS.md`.
- [ ] **Envelope de error** `{ error: { code, message, details? } }` con códigos estables; nunca *stack traces*.
      Lo construye solo `apps/api/src/http/error-handler.ts`: los servicios lanzan `AppError` (`apps/api/src/errors.ts`). Descartado: la task no toca la API.
- [ ] **Validación con el JSON Schema de Fastify** en cada ruta (body, params, querystring y respuesta), con
      `idParamsSchema` y `trimTextFields` de `apps/api/src/http/validation.ts`. Descartado: la task no toca la API.
- [ ] **SQLite parametrizado**: siempre `db.prepare(…).run/get/all(params)`; nunca SQL concatenado con entrada. Descartado: la task no toca la API.
- [ ] **Migraciones**: un cambio de esquema es un fichero nuevo `apps/api/src/db/migrations/NNN-descripcion.sql`;
      nunca se edita uno comiteado. Descartado: la task no cambia el esquema.
- [x] **Datos personales** (`docs/RGPD.md`): minimización en respuestas, nada en logs ni errores, datos inventados en
      seed y tests.
- [x] **Accesibilidad** (web): roles y nombres accesibles, `label` en cada control, estados de carga, vacío y
      error; `docs/06_design_principles/README.md`.
- [x] **Caracteres crudos**: nunca NUL ni U+2028/U+2029 en el código; usa secuencias de escape (un hook lo bloquea).
- [x] **Reuso obligatorio**: lo de TASK-07 (`useSearch` de `router.tsx`, `listJobs(query)`, `list-query.ts` con `toSearch`/`listView`/`validateSearchText`/`clearFiltersPath`/`totalPages`) y `JobListScreen`/`JobTable` de HU-01.
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Hueco aceptado: «Quitar filtros» → `/jobs` sin parámetros. Si `JobListScreen.test.tsx` pasa de 300 líneas, usa el hermano `JobListScreen.filters.test.tsx`.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [x] `npm test -w apps/web -- JobListScreen` en verde, con **2** ficheros de test ejecutados (3 si se creó el hermano
- [x] `npm test -w apps/web` completo en verde.
- [x] `npm run typecheck`.
- [x] `npx eslint` con los ficheros de la tabla «Archivos afectados».
- [ ] `npx playwright test <spec>`: descartado, la task no es `[e2e]`.
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una afirmación sin
> pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo (un gotcha, un comando, una convención), añádelo al final de tu
> informe en un bloque `APRENDIZAJE`; la sesión lo llevará a la doc del módulo o a `docs/ARCHITECTURE.md`.

## 7. Resultado de la integración
> La rellena `/implementar-hu` con la salida real de los comandos que ejecuta la sesión. Ciclo de arreglo: 1/2.

```
$ npm test -w apps/web -- JobListScreen
 Test Files  3 passed (3)
      Tests  28 passed (28)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/jobs/JobFilters.tsx apps/web/src/features/jobs/JobPagination.tsx apps/web/src/features/jobs/JobListScreen.tsx apps/web/test/features/jobs/JobListScreen.test.tsx apps/web/test/features/jobs/JobListScreen.filters.test.tsx apps/web/test/features/jobs/JobListScreen.pagination.test.tsx
exit=0
$ wc -l (ficheros tocados)
     109 apps/web/src/features/jobs/JobFilters.tsx
     122 apps/web/test/features/jobs/JobListScreen.pagination.test.tsx
     161 apps/web/src/features/jobs/JobListScreen.tsx
     211 apps/web/test/features/jobs/JobListScreen.test.tsx
     283 apps/web/test/features/jobs/JobListScreen.filters.test.tsx
     919 total
INTEGRACION rc=0
```

- **Resultado:** verde tras 1 ciclo de arreglo: con total 1 la paginación decía «(1 ofertas)»; ahora «(1 oferta)», con test. Hermano JobListScreen.pagination.test.tsx por el umbral de 300 líneas
- **Commit:** el de esta tarea (`[HU-02 TASK-08]`)


## 8. Reapertura · review ronda 1
> Encargo adicional de `/implementar-hu` tras `review/REVIEW.md` (ronda 1). Rigen las mismas secciones 2 a 6 de este
> brief. **La task es el contrato:** su sección «Reapertura · review ronda 1».

- **Qué hacer:** CA-18 (decisión de quien aprueba el PRD): la web ofrece solo 20, 50 y 100 en «Por página», alineada con el PRD. Quita la opción extra que hoy añade `apps/web/src/features/jobs/JobFilters.tsx:45` cuando la URL trae un `pageSize` válido distinto de esos tres: en ese caso la interfaz usa 20 (selector y petición). La API sigue aceptando 1-100. Ajusta el test de `apps/web/test/features/jobs/JobListScreen.filters.test.tsx:123` (o donde esté el de `pageSize=7`) para fijar el comportamiento nuevo.
- **Ficheros:** `apps/web/src/features/jobs/JobFilters.tsx` (y `list-query.ts` si la normalización vive ahí), `apps/web/test/features/jobs/JobListScreen.filters.test.tsx`
- **Verificación que debes pegar:** `npm test -w @ats/web -- JobListScreen list-query` en verde; `npm run typecheck -w @ats/web`; `npx eslint` de los ficheros tocados.

### Resultado de la integración (reapertura)
```
$ npm test -w apps/web -- JobListScreen list-query
 Test Files  5 passed (5)
      Tests  61 passed (61)
exit=0
$ npm test -w apps/web   (suite completa del workspace)
 Test Files  25 passed (25)
      Tests  307 passed (307)
exit=0
$ npm run typecheck -w @ats/web
> tsc -p tsconfig.json
exit=0
$ npx eslint apps/web/src/features/jobs/list-query.ts apps/web/src/features/jobs/JobFilters.tsx apps/web/src/features/jobs/JobListScreen.tsx apps/web/test/features/jobs/JobListScreen.filters.test.tsx apps/web/test/features/jobs/list-query.test.ts
exit=0
$ wc -l (ficheros tocados)
     104 apps/web/src/features/jobs/JobFilters.tsx
     139 apps/web/src/features/jobs/list-query.ts
     162 apps/web/src/features/jobs/JobListScreen.tsx
     217 apps/web/test/features/jobs/list-query.test.ts
     284 apps/web/test/features/jobs/JobListScreen.filters.test.tsx
     906 total
INTEGRACION rc=0
```

- **Resultado:** verde; «Por página» solo 20/50/100 (CA-18 alineado con el PRD); un pageSize válido no ofrecido se pide como 20 y la URL no se reescribe. Fuera de la tabla: JobListScreen.tsx (usa listRequest) y list-query.test.ts

