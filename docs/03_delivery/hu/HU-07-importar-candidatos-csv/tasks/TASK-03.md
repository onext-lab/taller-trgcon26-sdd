# TASK-03 — `POST /api/candidates/import` de punta a punta: alta todo o nada, deduplicación e informe

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-02, RF-03, RF-04, RF-05, RF-06)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
La ruta nueva con su transporte (DEC-13), la transacción y el informe. **Sin migración**, sin dependencias nuevas y
**sin tocar `apps/api/src/app.ts`**.

1. **Repositorio** (`apps/api/src/modules/candidates/repository.ts`, 195 → ~205): `existingIdOnDuplicate(error,
   email): number | undefined` = `isDuplicateEmailError(error)` + `findIdByEmail(email)` (las dos ya existen). Sin SQL
   nuevo.
2. **Servicio** (`apps/api/src/modules/candidates/service.ts`, 189 → ~200): `writeUniqueEmail` pasa a usar
   `existingIdOnDuplicate` (mismo 409 que hoy) y `CandidatesService` gana
   `importCsv(bytes: Uint8Array, validateRow: RowValidator): ImportReport`, que en la factoría delega en
   `importCandidates({ repository, now, transaction, recalculate: (id) => recalculateRetention(deps, id) }, bytes,
   validateRow)`.
3. **`apps/api/src/modules/candidates/import.ts`** (**nuevo**, ~90):
   ```ts
   export interface ImportDeps {
     repository: CandidatesRepository; now: Clock; transaction: <T>(fn: () => T) => T;
     recalculate: (id: number) => void;
   }
   export function importCandidates(deps: ImportDeps, bytes: Uint8Array, validateRow: RowValidator): ImportReport;
   ```
   `readImportFile` (TASK-02) → `classifyRows` → si hay filas válidas, **una sola** `deps.transaction` (DD-05, DD-09):
   `createdAt = deps.now()` **una vez**; por cada fila válida en orden: si su email ya entró en **esta** importación
   (mapa en memoria `email → row`) → `repeated` con `firstRow`; si no, `INSERT` del alta (`INSERT_SQL` existente:
   `summary = NULL`, `skills = '[]'`, consentimiento a `NULL`) y **el índice único decide**: si
   `existingIdOnDuplicate` devuelve un ID → `duplicate` con `existingId` (la fila **no** entra en el mapa: así una
   repetición de un email existente vuelve a chocar y sale `duplicate`, DT-01); si entra → mapa +
   `deps.recalculate(id)`. Cualquier otro error se relanza (→ `ROLLBACK` y 500). Con 0 válidas no se abre transacción.
   Informe: `dataRows = created + duplicates + invalid`, `duplicates` incluye `duplicate` y `repeated`, `notImported`
   ordenado por `row`, sin las creadas; motivos «Duplicado.» y `` `Repetido en el fichero (fila ${firstRow}).` ``
   (DD-08).
4. **`apps/api/src/modules/candidates/import-routes.ts`** (**nuevo**, ~50): plugin **encapsulado**
   `candidateImportRoutes` (registrado con `app.register`, **sin** `fastify-plugin`, DD-01):
   - `app.removeAllContentTypeParsers()` y `app.addContentTypeParser('text/csv', { parseAs: 'buffer' }, (_req, body,
     done) => done(null, body))`: solo `text/csv` (los parámetros como `; charset=utf-8` se ignoran).
   - `POST /import` con `bodyLimit: MAX_IMPORT_BYTES`, `config: { payloadTooLargeMessage: FILE_TOO_LARGE_MESSAGE }` y
     `response: { 200: importReportSchema }`.
   - Manejador: `if (!Buffer.isBuffer(request.body))` → 415 `UNSUPPORTED_MEDIA_TYPE` «Tipo de contenido no admitido.»
     (DD-10); si no, `service.importCsv(new Uint8Array(request.body), rowValidator(request))` → 200.
   - `rowValidator(request)`: `const validate = request.compileValidationSchema(importRowSchema)` y
     `(row) => validate(row) ? [] : toValidationDetails(validate.errors ?? [], 'row')` (adapta aquí los tipos si no
     casan, no en `error-handler.ts`).
5. **`apps/api/src/modules/candidates/routes.ts`** (120 → ~123): `candidatesRoutes` registra
   `candidateImportRoutes` con `{ service }` (hereda el prefijo `/api/candidates`).
6. **`apps/api/test/helpers/csv.ts`** (modificar): `importCsv(app, bytes, headers?)` = `app.inject({ method: 'POST',
   url: '/api/candidates/import', headers: { 'content-type': 'text/csv', ...headers }, payload: Buffer.from(bytes) })`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/candidates/repository.ts` | modificar | `existingIdOnDuplicate` |
| `apps/api/src/modules/candidates/service.ts` | modificar | `importCsv` en `CandidatesService` y la factoría; `writeUniqueEmail` usa `existingIdOnDuplicate` |
| `apps/api/src/modules/candidates/import.ts` | crear | `ImportDeps`, `importCandidates` |
| `apps/api/src/modules/candidates/import-routes.ts` | crear | Plugin encapsulado, parser `text/csv`, `bodyLimit`, 415 sin cuerpo, `rowValidator` |
| `apps/api/src/modules/candidates/routes.ts` | modificar | Registro de `candidateImportRoutes` |
| `apps/api/test/helpers/csv.ts` | modificar | `importCsv(app, bytes, headers?)` |
| `apps/api/test/candidates/import.test.ts` | crear | Flujos P, A1, A2, A3 y test contrato |

## Implementa
- RF: RF-02 (ruta y transporte), RF-03 (filas por la ruta), RF-04, RF-05, RF-06 (informe) · CA-01, CA-03, CA-04,
  CA-05, CA-07, CA-08, CA-09, CA-10 · Edge cases: EC-07, EC-18, EC-19, EC-20, EC-21, EC-22, EC-25, EC-28, EC-29, EC-32,
  EC-33, EC-34, EC-36, EC-43, EC-46, EC-49 · DD-01, DD-03, DD-05, DD-08, DD-09, DD-10 · DEC-13 y aclaraciones de
  DEC-07/DEC-08
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (1, 3, 4, 5), § Contrato de API, § Firmas internas,
  § Diagrama de secuencia, § DD-01, DD-05, DD-09, DD-10, § Estrategia de tests (`import.test.ts`), § Orden de
  implementación 3

## Dependencias
- **Depende de:** TASK-02
- **Bloquea:** TASK-04, TASK-05, TASK-09

## Criterios de done
- [ ] `npm test -w apps/api -- candidates/import.test` en verde con **1** fichero y estos tests (nombres del TD):
  - `CA-01 crea 3 sin consentimiento con retención 2027-04-12 y el informe no lista creadas`.
  - `CA-03 BOM + CRLF = mismo resultado`.
  - **`CA-04 duplicado con existingId y Ana sin cambios`** (**tumba M1**): Ana creada por `createCandidate`; CSV con
    ` Ana G.,ANA.GIL@example.com,+34 600 000 021` en la línea 2 y una fila nueva. Asierta **a la vez**: 200;
    `created: 1`, `duplicates: 1`, `invalid: 0`, `dataRows: 2`; `notImported` exactamente `[{ row: 2, reason:
    'duplicate', existingId: ana.id, errors: [{ field: 'email', message: 'Duplicado.' }] }]`; `SELECT COUNT(*) FROM
    candidates` = antes + 1; `SELECT COUNT(*) … WHERE email = 'ana.gil@example.com'` = 1; la ficha de Ana (nombre,
    teléfono, consentimiento, fin de retención) igual que antes; el cuerpo no contiene «Ana G.» ni su email (EC-33).
  - **`CA-05 reimportar → 0 creados y 3 duplicate`** (**tumba M1**): recuento de candidatos igual tras la segunda.
  - **`EC-34 email existente repetido → todas duplicate`** (**tumba M1**, DT-01): ninguna `repeated`, ningún alta.
  - `CA-07 repeated (firstRow) y fila inválida no es primera`; `EC-29 500 filas mismo email` (1 creado, 499
    `repeated` con `firstRow: 2`).
  - `CA-08 errores por columna sin valores`; `CA-09 todas inválidas → 200 con 0 creados`; `CA-10 numeración física`.
  - `EC-49 línea de espacios y tabuladores ignorada: ni en el informe ni en dataRows, la siguiente conserva su línea;
    cabecera + líneas de espacios → sin candidatos`.
  - `EC-19/EC-25 columnas y ,,`; `EC-20 controles en medio del nombre`; `EC-21 bordes de longitud`.
  - `EC-36 retención 22:30Z y 31/08` (2027-04-13 y 2027-02-28).
  - `EC-43/EC-46 suma = dataRows y 500 sin truncar` (incluye una fila con 3 errores en orden `nombre`, `email`,
    `telefono`).
  - `contrato: los mensajes de fila son los del 400 del alta para los mismos valores` (mismo valor por
    `POST /api/candidates` y por la importación → mismos `message`; documenta la excepción de DD-04 para el nombre
    vacío).
- [ ] `npm test -w apps/api` en verde (toda la API): `create*.test.ts` siguen dando 409 con `existingId`;
      `module-boundaries.test.ts` sin cambios; `text/csv` no se acepta fuera de la ruta (lo afina TASK-04).
- [ ] Ningún fichero tocado pasa de 300 líneas ni ninguna función de `src` de 50 (`npm run lint`).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/candidates/repository.ts apps/api/src/modules/candidates/service.ts apps/api/src/modules/candidates/import.ts apps/api/src/modules/candidates/import-routes.ts apps/api/src/modules/candidates/routes.ts apps/api/test/helpers/csv.ts apps/api/test/candidates/import.test.ts`
      sin errores.
- [ ] Commit único `feat(api): POST /api/candidates/import with all-or-nothing creation and report [HU-07 TASK-03]`
      con los 7 ficheros.

## Notas de implementación
- **Mutación M1** («una fila cuyo email ya existe en la base crea igualmente un registro»): la tumban `CA-04 …`,
  `CA-05 …` y `EC-34 …` de este fichero porque asertan **el informe y la base** a la vez (si la mutación cuenta la fila
  como creada, falla el informe; si la inserta de otra forma o la deja pasar a 500, fallan el recuento y el 200).
  También `import-failures-adversarial.test.ts › CA-06/EC-31 …` (TASK-05) y el e2e T1 (TASK-09). Aplica la mutación a
  mano (p. ej., tratar el choque del índice como alta), comprueba el rojo y deshazla, sin commitearla.
- **Gotcha de SQLite** (DD-05): tras un `SQLITE_CONSTRAINT_UNIQUE`, SQLite deshace **solo la sentencia**; la
  transacción sigue abierta. No hagas `ROLLBACK` ahí.
- `withTransaction` usa `BEGIN IMMEDIATE` y se une a una en curso (DEC-11.7); el manejador es síncrono.
- **Tamaño de `import.test.ts`**: son ~18 tests; si tras Prettier pasa de 300 líneas, **para y avisa** antes de
  repartirlo: un fichero hermano (propuesta: `apps/api/test/candidates/import-rows.test.ts` con los de A3 y EC-18 a
  EC-25/EC-49) no está en el TD y lo aprueba el responsable técnico (ver «Decisión pendiente» del ROADMAP).
- Reloj `createTestClock('2026-10-12T09:00:00.000Z')` salvo EC-36; ficheros con `csvBytes` (sin disco); datos
  inventados (`@example.com`, `+34 600 000 0xx`).
- `INSERT` solo con sentencias preparadas (`INSERT_SQL`); ningún valor del fichero en `AppError`, logs ni informe.
