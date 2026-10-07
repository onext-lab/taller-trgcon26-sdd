# Brief de implementación — HU-06 · TASK-07

> Brief de `/implementar-hu` desde `docs/_templates/BRIEF-IMPLEMENTACION.template.md`. Con este brief y lo que nombra,
> el builder no necesita más contexto. El porqué de cada línea está en `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-06-cerrar-oferta-inscripciones-activas/tasks/TASK-07.md` (criterios de done incluidos).
- **Capa y builder:** `web` → `web-builder` (copiada del campo `Capa:` de la task).
- **Diseño:** `docs/03_delivery/hu/HU-06-cerrar-oferta-inscripciones-activas/plans/TECHNICAL_DOC-frontend.md`, solo las secciones que cita la task en «Implementa» (no el documento entero).
- **Criterios que cubre** (del `specs/PRD.md`):
  - RF: RF-05 (camino feliz) · RF-01 a RF-03 de punta a punta en el navegador · RF-06 (umbrales, parte web) · Edge
    cases: EC-26 (2 real), EC-21 (pipeline sin acciones) · CA-12 · DD-01 a DD-05 del TD-frontend
  - Diseño: `plans/TECHNICAL_DOC-frontend.md` § Enfoque técnico, § Pantallas y estados, § Diagrama de secuencia (CA-12),
    DD-03, DD-04, DD-05, § Estrategia de tests (T1), § Checklist de implementación 1-3
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-06-cerrar-oferta-inscripciones-activas` (ya creada; no cambies de rama).
- **Lo que ya está en la rama** (commits desde la rama de integración, el más reciente primero): 5ffc0a3 feat(api): wire the real JobApplicationsPort into buildApp [HU-06 TASK-02]; 25614d7 feat(api): count and reject the active applications of a job being closed [HU-06 TASK-01]; c69ca7a docs(HU-06): tasks and roadmap; fbee2c0 docs(HU-06): technical design; 722b009 docs(HU-06): PRD; c4de679 docs(HU-06): PRD draft, open questions.
- **Dependencias de la task:**
  - **Depende de:** TASK-02 (puerto real conectado: sin él el diálogo dice 0 y T1 falla)
  - **Bloquea:** TASK-08
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
- [x] **Reuso obligatorio**: Reutiliza e2e/support/applications.ts (añade advanceByApi, DD-03), el estilo de e2e/pipeline-closed.spec.ts (sin IDs fijos, token único) y las aserciones de Playwright que esperan solas (nada síncrono sobre efectos).
- [x] Otros: TypeScript estricto con `erasableSyntaxOnly` (sin *parameter properties* ni `enum`); ficheros ≤ 300
      líneas y funciones ≤ 50; código e identificadores en inglés y textos al usuario en castellano de España. Ejecuta el spec nuevo junto a e2e/pipeline-closed.spec.ts y e2e/applications.spec.ts (DD-05: ahora hay ofertas cerradas creadas por el spec). Otros builders trabajan a la vez en apps/api/test/ y docs/: no los toques. Commits previos: TASK-01, TASK-02 (el puerto real ya está conectado: el diálogo da el número real).

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
- [x] `npx playwright test e2e/jobs-close-applications.spec.ts e2e/pipeline-closed.spec.ts e2e/applications.spec.ts`
- [x] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una afirmación sin
> pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo (un gotcha, un comando, una convención), añádelo al final de tu
> informe en un bloque `APRENDIZAJE`; la sesión lo llevará a la doc del módulo o a `docs/ARCHITECTURE.md`.

## 7. Resultado de la integración
> La rellena `/implementar-hu` con la salida real de los comandos que ejecuta la sesión. Ciclo de arreglo: 0/2.

```
$ npm run typecheck 
> tsc -p tsconfig.json
> tsc -p tsconfig.json
exit=0
$ npx eslint e2e/support/applications.ts e2e/jobs-close-applications.spec.ts e2e/pipeline-closed.spec.ts e2e/applications.spec.ts
exit=0
$ wc -l (ficheros tocados)
      65 e2e/pipeline-closed.spec.ts
      80 e2e/jobs-close-applications.spec.ts
      89 e2e/support/applications.ts
     153 e2e/applications.spec.ts
     387 total
$ npx playwright test e2e/jobs-close-applications.spec.ts e2e/pipeline-closed.spec.ts e2e/applications.spec.ts
  ✓  1 [chromium] › e2e/applications.spec.ts:31:1 › CA-02, CA-14 y CA-19 inscribir desde el pipeline: la tarjeta queda la primera de «Recibida» y la ficha muestra la retención del proceso (1.2s)
  ✓  2 [chromium] › e2e/applications.spec.ts:63:1 › CA-02 buscar por parte del email e inscribir: la tarjeta aparece en «Recibida» (584ms)
  ✓  3 [chromium] › e2e/applications.spec.ts:81:1 › CA-36 inscribir a uno ya inscrito: el aviso fijo, «Ver la inscripción» al detalle existente y ninguna tarjeta nueva (584ms)
  ✓  4 [chromium] › e2e/applications.spec.ts:106:1 › CA-26 y EC-28 borrador por URL y oferta cerrada del seed: el borrador no tiene columnas ni botón; la cerrada, columnas sin botón (483ms)
  ✓  5 [chromium] › e2e/applications.spec.ts:131:1 › RNF-05, EC-39 y EC-45 la búsqueda no sale del panel: ni la URL, ni el título, ni el estado del historial llevan el email (580ms)
  ✓  6 [chromium] › e2e/jobs-close-applications.spec.ts:43:1 › CA-12 y EC-26 cerrar con 2 activas y 1 contratada: diálogo con 2, «Oferta cerrada.», pipeline en solo lectura y detalle «Oferta cerrada» sin nota (606ms)
  ✓  7 [chromium] › e2e/pipeline-closed.spec.ts:31:1 › CA-23, CA-26 y EC-50 oferta cerrada: «Ver pipeline», seis columnas sin acciones y el detalle de un rechazo «Oferta cerrada» sin nota (476ms)
  7 passed (6.4s)
exit=0
INTEGRACION rc=0
```

- **Resultado:** en verde; los tres specs juntos 7 passed y la suite e2e completa 46 passed (informe del builder). Sin cambios en apps/web/. Las mutaciones M1 y M2 las vigilan los tests de API de TASK-02 y TASK-03 (por la regla de la ola, ningún builder muta en paralelo); T1 comprueba el diálogo con 2 y las dos rechazadas.
- **Commit:** el de esta tarea (`[HU-06 TASK-07]`)

