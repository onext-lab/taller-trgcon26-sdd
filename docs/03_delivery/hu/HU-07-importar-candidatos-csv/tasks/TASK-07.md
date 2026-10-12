# TASK-07 — Pantalla «Importar candidatos» con su informe, la ruta y el enlace desde el listado

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-01, RF-02 parte web, RF-06 parte web)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Pantalla nueva `/candidates/import` con el patrón del repo: contenedor + hook de acciones + dos presentacionales.
Usa el cliente y el modelo de TASK-06; `fetch` simulado (`mockFetch`, ruta `'POST /api/candidates/import'`).

1. **`apps/web/src/components/StatusMessages.tsx`**: `ErrorMessage` acepta `id?` y `ref?` (como `Notice`, con
   `tabIndex={-1}` si hay `ref`), para dar el foco al error (DT-04) y enlazarlo con `aria-describedby`. Sin cambio para
   quien no los pasa.
2. **`apps/web/src/features/candidates/paths.ts`**: `candidatePaths.import = '/candidates/import'`.
3. **`apps/web/src/features/candidates/use-import-actions.ts`** (**nuevo**, DD-02, DD-03, DD-04): `view` como unión
   discriminada `ready | importing | error | report`; `file` fuera de la unión (se conserva entre `error` y `ready`);
   `formKey`; `chooseFile(file | null)` (en `error` vuelve a `ready`); `submit()` con guarda `inFlight` por `ref`
   (EC-04) → sin fichero no hace nada (EC-02) → `isFileTooLarge` → error `FILE_TOO_LARGE_MESSAGE` sin petición →
   `await file.arrayBuffer()` (si rechaza, `FILE_UNREADABLE_MESSAGE` sin petición, EC-13) → `importCandidates(bytes,
   signal)` con `useLifetimeSignal` → `report` o `error` con `userMessage(error)` y `isFileError(error)`;
   `startOver()` (`ready` sin fichero, `formKey + 1`, foco al selector); `refs { input, error, heading }` y foco en un
   efecto sobre `view.kind` (al mensaje en `error`, al h2 en `report`). El `ArrayBuffer` es local de `submit`: nunca
   va al estado.
4. **`apps/web/src/features/candidates/CandidateImportForm.tsx`** (**nuevo**, presentacional, `<form noValidate>`):
   `label` «Fichero CSV» para `<input type="file" id="candidate-import-file" accept=".csv">` con
   `aria-describedby="candidate-import-help"` (+ `candidate-import-error` y `aria-invalid` si el error es del
   fichero); ayuda `<p id="candidate-import-help">` con «La primera línea debe ser exactamente esta cabecera:
   `<code>nombre,email,telefono</code>`. CSV en UTF-8 separado por comas; el teléfono puede ir vacío. Como máximo, 500
   candidatos y 1 MiB.»; botón `submit` «Importar», `disabled` sin fichero o en `importing` (el nombre no cambia).
   `key={formKey}` lo pone el contenedor.
5. **`apps/web/src/features/candidates/CandidateImportReport.tsx`** (**nuevo**, presentacional):
   `<section aria-labelledby="candidate-import-result">`; h2 «Resultado de la importación» con `tabIndex={-1}`;
   `<p role="status">` con `reportSummary`; sin filas no importadas, «Se han importado todas las filas.» (sin tabla);
   si no, `<table>` con `<caption>` «Filas no importadas» y `th scope="col"` «Fila», «Columna», «Motivo», **una fila
   de tabla por elemento de `errors`** (EC-43), «Columna» = `columnLabel(field)`, «Motivo» = `message` tal cual; en
   `duplicate`, dentro de «Motivo», `<a href={candidatePaths.detail(existingId)} target="_blank" rel="noopener
   noreferrer">Ver candidato<span className="visually-hidden"> (se abre en una pestaña nueva)</span></a>` (`<a>`
   nativo, CA-18); botón «Importar otro fichero» (`startOver`) y `Link` «Ir al listado» a `/candidates` que antes
   guarda `INITIAL_LIST_QUERY` en `list-state.ts` (DD-05).
6. **`apps/web/src/features/candidates/CandidateImportScreen.tsx`** (**nuevo**, contenedor):
   `useDocumentTitle('Importar candidatos · ATS')`, h1 «Importar candidatos», `useImportActions()`; pinta formulario
   (+ `LoadingMessage` «Importando…» en `importing`, + `ErrorMessage` con `id="candidate-import-error"` y `ref` en
   `error`) o el informe. El nombre del fichero no se pinta nunca (DD-07).
7. **`apps/web/src/App.tsx`**: ruta `candidatePaths.import` en `ROUTES` con su `title`, **antes** de
   `/candidates/:id`.
8. **`apps/web/src/features/candidates/CandidateListScreen.tsx`**: en el `<p>` de «Nuevo candidato», un segundo
   `Link` «Importar CSV» a `candidatePaths.import`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/components/StatusMessages.tsx` | modificar | `ErrorMessage` con `id?` y `ref?` |
| `apps/web/src/features/candidates/paths.ts` | modificar | `candidatePaths.import` |
| `apps/web/src/features/candidates/use-import-actions.ts` | crear | Estado, envío único, lectura del fichero, foco |
| `apps/web/src/features/candidates/CandidateImportForm.tsx` | crear | Selector, ayuda con la cabecera, «Importar» |
| `apps/web/src/features/candidates/CandidateImportReport.tsx` | crear | Recuentos, tabla, «Ver candidato», acciones |
| `apps/web/src/features/candidates/CandidateImportScreen.tsx` | crear | Contenedor |
| `apps/web/src/App.tsx` | modificar | Ruta antes de `/candidates/:id` |
| `apps/web/src/features/candidates/CandidateListScreen.tsx` | modificar | Enlace «Importar CSV» |
| `apps/web/test/features/candidates/import-fixtures.ts` | crear | `csvFile`, `report`, `renderImport`, `chooseFile`, `IMPORT_ROUTE` |
| `apps/web/test/features/candidates/CandidateImportScreen.test.tsx` | crear | CA con superficie web |
| `apps/web/test/App.test.tsx` | modificar | `/candidates/import` pinta la pantalla, no la ficha con ID `import` |
| `apps/web/test/features/candidates/CandidateListScreen.test.tsx` | modificar | Enlace «Importar CSV» |

## Implementa
- RF: RF-01, RF-02 (errores del fichero en pantalla), RF-06 (informe) · CA-01 (web), CA-02, CA-04 (web), CA-05/EC-07,
  CA-07, CA-08, CA-10 (render), CA-09, CA-11, CA-12, CA-13, CA-14, CA-15, CA-16, CA-18 · RNF-07 · Edge cases: EC-02,
  EC-03, EC-08/EC-50 (render del mensaje), EC-34 · DD-02, DD-03, DD-05, DD-06, DD-07 del TD-frontend · DT-04
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados, § Diagrama de secuencia, § Error paths, § DD-02,
  DD-03, DD-05, DD-06, DD-07, § Estrategia de tests (`CandidateImportScreen.test.tsx`, `App.test.tsx`,
  `CandidateListScreen.test.tsx`, Criterio → test), § Checklist 2

## Dependencias
- **Depende de:** TASK-06
- **Bloquea:** TASK-08, TASK-09

## Criterios de done
- [ ] `npm test -w apps/web -- CandidateImportScreen.test App.test CandidateListScreen.test` en verde con **3**
      ficheros y, como mínimo (nombres del TD-frontend):
  - `pantalla inicial: h1, cabecera, selector con label y accept .csv, Importar deshabilitado` (CA-02, EC-02: 0
    peticiones).
  - `Importando… con Importar deshabilitado hasta el informe; foco al h2` (CA-02).
  - `muestra 3 creados y no lista filas creadas` (CA-01).
  - `fila duplicate con «Duplicado.» y Ver candidato a existingId, sin datos del existente` (CA-04) y `nombre
    accesible, target y rel del enlace` (CA-18).
  - `Importar otro fichero y el mismo: segundo POST y 0 creados` (CA-05, EC-07).
  - `pinta «Repetido en el fichero (fila 2).», los errores de nombre y email de la fila 3, «Toda la fila» con «Número
    de columnas incorrecto.» en la 4, y la fila 7` (CA-07, CA-08, CA-10).
  - `200 con 0 creados es un informe, no un error` (CA-09).
  - `400 de cabecera: alert con nombre,email,telefono, foco al alert, fichero conservado` (CA-11) y `CA-19 400 del
    separador «;»: alert con el texto de la API tal cual, foco al alert, fichero conservado y aria-invalid en el
    selector` (EC-50: la respuesta simulada lleva el texto de DT-08 y la web no lo cambia).
  - `400 de formato con la línea 4` (CA-12); `400 sin candidatos` (CA-13); `400 de 501 filas` y `413 → su message,
    con aria-invalid en el selector` (CA-14).
  - `500: alert, fichero conservado; reintento → informe` (CA-15); `API caída: alert, fichero conservado, Importar
    activo` (CA-16).
  - `App.test.tsx › /candidates/import pinta «Importar candidatos» y su título`.
  - `CandidateListScreen.test.tsx › enlace «Importar CSV» con href="/candidates/import"`.
- [ ] `npm test -w apps/web` en verde (toda la web).
- [ ] Ningún fichero tocado pasa de 300 líneas (incluidos `App.test.tsx`, 242, y `CandidateListScreen.test.tsx`, 197)
      ni ninguna función de `src` de 50 (`npm run lint`).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/components/StatusMessages.tsx apps/web/src/features/candidates/paths.ts apps/web/src/features/candidates/use-import-actions.ts apps/web/src/features/candidates/CandidateImportForm.tsx apps/web/src/features/candidates/CandidateImportReport.tsx apps/web/src/features/candidates/CandidateImportScreen.tsx apps/web/src/App.tsx apps/web/src/features/candidates/CandidateListScreen.tsx apps/web/test/features/candidates/import-fixtures.ts apps/web/test/features/candidates/CandidateImportScreen.test.tsx apps/web/test/App.test.tsx apps/web/test/features/candidates/CandidateListScreen.test.tsx`
      sin errores.
- [ ] Commit único `feat(web): candidate CSV import screen and report [HU-07 TASK-07]` con los 12 ficheros.

## Notas de implementación
- El fichero se elige con `fireEvent.change(getByLabelText('Fichero CSV'), { target: { files: [file] } })` (sin
  `@testing-library/user-event`, DEC-05). Foco y título con `expectFocusOn` o `await waitFor` (`QUALITY-GATES.md`
  §4.12); las aserciones negativas del título esperan antes al positivo.
- La web pinta **siempre `error.message`** en 400 y 413; no compone textos a partir de `reason`, `firstRow` ni
  `field` (salvo «Toda la fila»). Todo texto de la API como texto JSX: nada de `dangerouslySetInnerHTML`.
- `CandidateImportScreen.test.tsx` puede pasar de 300 líneas tras Prettier: ya están previstos `import-fixtures.ts` y
  el `*.adversarial` (TASK-08); si aun así no cabe, **para y avisa** antes de crear un
  `CandidateImportScreen.errors.test.tsx` (lo menciona el TD-frontend como salida; lo aprueba el responsable técnico).
- Estado solo en memoria del componente: nada a la URL, al título, a `history.state` ni al almacenamiento (RNF-03;
  lo comprueba TASK-08).
- Datos inventados en los tests (`@example.com`, `+34 600 000 0xx`).
