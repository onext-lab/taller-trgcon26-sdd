# Brief de implementación — HU-02 · TASK-14

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/tasks/TASK-14.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-02-ciclo-vida-ofertas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-01 a RF-06 de extremo a extremo; RF-07 visto desde la web · CA: CA-01, CA-03, CA-05, CA-06, CA-11, CA-12,
    CA-14, CA-16, CA-18, CA-19 (web), CA-22, CA-23 · Edge cases: EC-13, EC-36, EC-43, EC-44
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` DD-09, § Estrategia de tests (columna Playwright, «Tests de HU-01 que
    cambian», «E2E deterministas»), § Riesgos, § Checklist paso 8
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-02-ciclo-vida-ofertas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): c191da4 feat(web): edit and delete according to job status [HU-02 TASK-11]; f4245a3 test(web): adversarial tests for publish, duplicate and list filters [HU-02 TASK-13]; e1fbc34 feat(web): job list filters, search and pagination [HU-02 TASK-08]; 2b9d535 feat(web): publish and duplicate from the job detail [HU-02 TASK-10]; b7d4778 test(api): adversarial tests for status rules and list filters [HU-02 TASK-06]; 211315e feat(api): job list filters, accent-insensitive search and pagination [HU-02 TASK-05]; 6c7e58a feat(web): job detail by status and close confirmation [HU-02 TASK-09]; d1659f4 test(api): adversarial tests for publish, close and duplicate [HU-02 TASK-04]; 8996219 feat(api): enforce job status on edit and delete [HU-02 TASK-03]; c9bd3c1 feat(api): publish, close and duplicate job openings [HU-02 TASK-02]; fa59f93 feat(web): search params, setData, dialog props and lifecycle API client [HU-02 TASK-07]; 901426a feat(api): cross-site write guard, applications port and 10-job seed [HU-02 TASK-01].
- **Dependencias de la task:**
  - **Depende de:** TASK-05 (API completa y, por cadena desde TASK-01, el seed), TASK-08, TASK-10, TASK-11 (todas las
    pantallas)
  - **Bloquea:** nada (puede ir en paralelo con TASK-12 y TASK-13: no comparten ficheros)
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
- [ ] **Accesibilidad** (web): roles y nombres accesibles, `label` en cada control, estados de carga, vacío y
      error; `docs/06_design_principles/README.md`. Descartado: la task no toca la web.
- [x] **Caracteres crudos**: nunca NUL ni U+2028/U+2029 en el código; usa secuencias de escape (un hook lo bloquea).
- [x] **Reuso obligatorio**: `playwright.config.ts` (la base `data/e2e.db` se regenera en el comando del webServer de la API; puertos 3101/5174; `workers: 1`), `e2e/jobs.spec.ts` y `e2e/smoke.spec.ts` de HU-01, y el seed de 10 ofertas (`apps/api/src/db/seed.ts`, `SEED_TITLES_IN_LIST_ORDER`).
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. DD-09 del TD frontend: títulos fijos (sin títulos únicos), datos creados por la API, y el listado siempre con filtro o `pageSize=100` para no depender de la paginación del seed. Comprueba que dos `npx playwright test` seguidos dan el mismo resultado.

## 3. Prohibiciones
- [x] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [x] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [x] **No instales dependencias** que el diseño no prevea.
- [x] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [x] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [ ] Tests acotados: descartado, la task no tiene tests de Vitest.
- [x] `npm run typecheck`.
- [x] `npx eslint` con los ficheros de la tabla «Archivos afectados».
- [x] `npx playwright test e2e/smoke.spec.ts e2e/jobs.spec.ts e2e/jobs-lifecycle.spec.ts e2e/jobs-list.spec.ts` en
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
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint e2e/jobs.spec.ts e2e/jobs-lifecycle.spec.ts e2e/jobs-list.spec.ts
exit=0
$ wc -l (ficheros tocados)
     134 e2e/jobs-list.spec.ts
     247 e2e/jobs-lifecycle.spec.ts
     252 e2e/jobs.spec.ts
     633 total
$ npx playwright test e2e/smoke.spec.ts e2e/jobs.spec.ts e2e/jobs-lifecycle.spec.ts e2e/jobs-list.spec.ts
  ✓   1 [chromium] › e2e/jobs-lifecycle.spec.ts:95:1 › CA-01/CA-23 publicar un borrador completo: acciones por estado y fecha de publicación (692ms)
  ✓   2 [chromium] › e2e/jobs-lifecycle.spec.ts:114:1 › CA-03 publicar con campos pendientes: avisa de lo que falta y sigue en borrador (387ms)
  ✓   3 [chromium] › e2e/jobs-lifecycle.spec.ts:129:1 › EC-43 con la API caída al publicar: alerta y el botón sigue disponible (406ms)
  ✓   4 [chromium] › e2e/jobs-lifecycle.spec.ts:140:1 › CA-05/CA-06/CA-22 cerrar con confirmación: Escape cancela y confirmar deja la ficha en solo lectura (562ms)
  ✓   5 [chromium] › e2e/jobs-lifecycle.spec.ts:166:1 › EC-13 otra pestaña cierra la oferta con el diálogo abierto: confirmar conserva la fecha de cierre (922ms)
  ✓   6 [chromium] › e2e/jobs-lifecycle.spec.ts:185:1 › CA-14 duplicar una cerrada: borrador nuevo con el mismo título y la original sigue cerrada (601ms)
  ✓   7 [chromium] › e2e/jobs-lifecycle.spec.ts:208:1 › CA-11 vaciar un obligatorio de una publicada: error junto al campo y sin guardar (560ms)
  ✓   8 [chromium] › e2e/jobs-lifecycle.spec.ts:224:1 › CA-12/EC-44 guardar una oferta cerrada en otra pestaña: mensaje del 409 y ficha en solo lectura (953ms)
  ✓   9 [chromium] › e2e/jobs-list.spec.ts:38:1 › CA-16 filtrar por estado y título: solo las publicadas que contienen el texto, sin acentos ni mayúsculas (369ms)
  ✓  10 [chromium] › e2e/jobs-list.spec.ts:60:1 › CA-18 paginar y cambiar el tamaño: 21 resultados, la URL conserva el filtro y «Atrás» restaura (503ms)
  ✓  11 [chromium] › e2e/jobs-list.spec.ts:104:1 › EC-36 con la API caída al filtrar: alerta con «Reintentar» y los controles conservan lo elegido (333ms)
  ✓  12 [chromium] › e2e/jobs-list.spec.ts:122:1 › CA-19 una URL con pageSize=101: la alerta explica el error y «Quitar filtros» vuelve al listado (322ms)
  ✓  13 [chromium] › e2e/jobs.spec.ts:54:1 › RF-05/RF-07 el listado muestra los borradores del seed en su orden, con estado y fecha (220ms)
  ✓  14 [chromium] › e2e/jobs.spec.ts:73:1 › CA-01 alta solo con título: ficha con aviso y aparece en el listado (473ms)
  ✓  15 [chromium] › e2e/jobs.spec.ts:92:1 › CA-02/EC-03 alta completa: la ficha muestra todo y el título se guarda sin espacios sobrantes (350ms)
  ✓  16 [chromium] › e2e/jobs.spec.ts:119:1 › CA-03 título de 2 caracteres: error junto al campo y se sigue en el formulario (261ms)
  ✓  17 [chromium] › e2e/jobs.spec.ts:132:1 › CA-09/CA-10/EC-21 editar un borrador y vaciar un campo opcional (601ms)
  ✓  18 [chromium] › e2e/jobs.spec.ts:161:1 › CA-11/EC-23 dos páginas editan el mismo borrador: gana la última en guardar (1.0s)
  ✓  19 [chromium] › e2e/jobs.spec.ts:185:1 › CA-13 borrar pide confirmación: Escape cancela y confirmar borra (775ms)
  ✓  20 [chromium] › e2e/jobs.spec.ts:214:1 › CA-18/EC-38 con la API caída el listado avisa y permite reintentar (200ms)
  ✓  21 [chromium] › e2e/jobs.spec.ts:223:1 › CA-19 el HTML del título se muestra como texto literal (336ms)
  ✓  22 [chromium] › e2e/jobs.spec.ts:231:1 › CA-20 una oferta inexistente muestra «Oferta no encontrada» y ninguna acción (182ms)
  ✓  23 [chromium] › e2e/jobs.spec.ts:241:1 › EC-08 un título con SQL se guarda y se ve literal; el listado sigue cargando (447ms)
  ✓  24 [chromium] › e2e/smoke.spec.ts:5:1 › la entrada es el listado de ofertas y muestra el estado de la API (207ms)
  24 passed (13.6s)
exit=0
INTEGRACION rc=0
```

- **Resultado:** verde tras 1 ciclo de arreglo: CA-13 comprobaba una ausencia en /jobs (página 1 sin filtros); ahora comprueba presencia y luego ausencia en /jobs?status=draft&pageSize=100. Fuera de la tabla: en CA-01 se añadió page.goto('/jobs?pageSize=100'), por el mismo criterio de done. npm run e2e dos veces seguidas con 24 passed (builder)
- **Commit:** el de esta tarea (`[HU-02 TASK-14]`)

