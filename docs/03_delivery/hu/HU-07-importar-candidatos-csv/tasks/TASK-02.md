# TASK-02 — Validación del fichero entero, reglas de fila del alta y 413 con texto propio

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-02, RF-03, RF-06)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
Todo lo que decide **qué** se importa, sin ruta todavía (la ruta y la transacción son TASK-03). Cinco piezas:

1. **`apps/api/src/modules/candidates/import-schemas.ts`** (**nuevo**, ~90 líneas):
   - `importRowSchema`: objeto con las **mismas propiedades** `fullName`, `email`, `phone` de `candidateFieldsSchema`
     (`schemas.ts`), importadas por referencia (no copiadas), `required: ['fullName', 'email']`,
     `additionalProperties: false` (DD-03).
   - `importReportSchema` (respuesta 200, `additionalProperties: false` en **todos** los niveles):
     `{ dataRows, created, duplicates, invalid, notImported[] }`; cada elemento `{ row, reason, errors[], existingId?,
     firstRow? }`, `reason` ∈ `invalid` · `duplicate` · `repeated`, `errors[]` de `{ field, message }` con `field` ∈
     `nombre` · `email` · `telefono` · `fila` (DD-08).
   - Tipos `ImportField`, `ImportRow` (fila válida: `{ row, fullName, email, phone }`), `NotImportedRow`, `ImportReport`.
2. **`apps/api/src/modules/candidates/import-file.ts`** (**nuevo**, ~100 líneas). Constantes exportadas y
   `readImportFile(bytes: Uint8Array): CsvRecord[]` (las filas de datos, sin la cabecera) o lanza `AppError`:
   ```ts
   export const MAX_IMPORT_BYTES = 1_048_576;
   export const MAX_IMPORT_ROWS = 500;
   export const EXPECTED_HEADER = ['nombre', 'email', 'telefono'] as const;
   export const INVALID_CSV_MESSAGE = 'Formato CSV inválido: el fichero debe estar en UTF-8 y separado por comas.';
   export const NO_CANDIDATES_MESSAGE = 'El fichero no tiene candidatos.';
   export const INVALID_HEADER_MESSAGE =
     'La cabecera no es válida. La primera línea debe ser exactamente: nombre,email,telefono';
   export const SEMICOLON_SEPARATOR_MESSAGE =
     'El fichero está separado por «;». Guárdalo separado por comas (CSV UTF-8) y vuelve a importarlo.';
   export const TOO_MANY_ROWS_MESSAGE =
     'El fichero tiene más de 500 filas de candidatos. Divídelo en ficheros más pequeños.';
   export const FILE_TOO_LARGE_MESSAGE = 'El fichero ocupa más de 1 MiB. Divídelo en ficheros más pequeños.';
   ```
   Orden (DT-03, «Orden de comprobación» del TD), **un solo error**:
   1. `bytes.length > MAX_IMPORT_BYTES` → 413 `PAYLOAD_TOO_LARGE` con `FILE_TOO_LARGE_MESSAGE` (defensa por si alguien
      quita el `bodyLimit`, DD-02).
   2. `decodeUtf8` → `null` → 400 con `INVALID_CSV_MESSAGE`.
   3. `parseCsv(text, MAX_IMPORT_ROWS + 2)` → `ok: false` → 400 con `` `${INVALID_CSV_MESSAGE} Revisa la línea ${line}.` ``.
   4. `recordCount === 0` (0 bytes, solo BOM, solo líneas en blanco) → 400 `NO_CANDIDATES_MESSAGE` (DD-07 f).
   5. Cabecera: el primer registro tiene que empezar en la **línea 1** (DD-07 a) y tener exactamente 3 campos que,
      recortados y en minúsculas, sean `EXPECTED_HEADER` en orden (EC-10). Si no vale:
      - **DT-08 / EC-50:** si ese primer registro es de la línea 1, tiene **un único campo** y, partido por `;`, da
        exactamente 3 partes que recortadas y en minúsculas son `nombre`, `email`, `telefono` →
        400 `SEMICOLON_SEPARATOR_MESSAGE`;
      - en cualquier otro caso → 400 `INVALID_HEADER_MESSAGE`.
   6. `recordCount === 1` (solo cabecera, con o sin blancos) → 400 `NO_CANDIDATES_MESSAGE`.
   7. `recordCount - 1 > MAX_IMPORT_ROWS` → 400 `TOO_MANY_ROWS_MESSAGE` (**la guarda de M2**).

   Todos los 400 son `AppError('VALIDATION_ERROR', 400, message, [{ field: 'file', message }])`: `message` y
   `details[0].message` con el **mismo** texto (aclaración de DEC-11.4). Ningún mensaje lleva nada del fichero: el
   único dato variable es el número de línea.
3. **`apps/api/src/modules/candidates/import-rows.ts`** (**nuevo**, ~80 líneas):
   ```ts
   export type RowValidator = (row: Record<string, unknown>) => ErrorDetail[]; // [] = válida
   export function classifyRows(records: CsvRecord[], validateRow: RowValidator):
     { valid: ImportRow[]; invalid: NotImportedRow[] };
   ```
   Por registro, en orden: número de campos ≠ 3 → `invalid` con el único error `{ field: 'fila', message: 'Número de
   columnas incorrecto.' }`. Si no, construye el cuerpo del alta (`fullName`, `email`, `phone`) con **DD-04**: celda de
   `nombre` o `email` vacía tras recortar → la clave **no se pone** (salta `required`, «Es obligatorio.»); `phone` se
   pone siempre (vacío → `null` lo hace la normalización). Pasa por `normalizeCandidateBody` (la del alta, sin copiarla)
   y por `validateRow`; traduce `field` con `FIELD_BY_PROPERTY` (`fullName` → `nombre`, `email` → `email`, `phone` →
   `telefono`) y ordena los errores por columna. `row` = `CsvRecord.line`.
4. **`apps/api/src/http/error-handler.ts`** (modificar, 125 → ~140): exportar `toDetails` como
   `toValidationDetails` **sin cambiar su lógica** (renombra también su uso interno); en el 413, si
   `request.routeOptions.config.payloadTooLargeMessage` existe, ese texto; si no, el genérico de hoy. Ampliación de
   tipos ambiental: `declare module 'fastify' { interface FastifyContextConfig { payloadTooLargeMessage?: string } }`.
5. **`apps/api/test/helpers/csv.ts`** (**nuevo**): `csvBytes(lines: string[], { bom?, eol?, finalEol? })` (UTF-8,
   `eol` `'\n'` por defecto) y el **fixture de Excel en español** `excelSpanishCsv(rows?: string[][])`: cabecera
   `nombre;email;telefono` y filas unidas por `;`, con **BOM** y **CRLF** (y CRLF final), como exporta Excel en un
   equipo en español. Por defecto, las 3 filas de CA-01 (`Lucía Ferrer Prat;lucia.ferrer@example.com;+34 600 000 012`,
   …). Sin comillas, para que el error sea el de cabecera y no el de formato. TASK-03 añade `importCsv`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/candidates/import-schemas.ts` | crear | `importRowSchema`, `importReportSchema`, tipos del informe |
| `apps/api/src/modules/candidates/import-file.ts` | crear | Límites, `*_MESSAGE` (incluido `SEMICOLON_SEPARATOR_MESSAGE`), `readImportFile` |
| `apps/api/src/modules/candidates/import-rows.ts` | crear | `RowValidator`, `FIELD_BY_PROPERTY`, `classifyRows` |
| `apps/api/src/http/error-handler.ts` | modificar | `toValidationDetails` exportado; 413 con `config.payloadTooLargeMessage`; `declare module` |
| `apps/api/test/helpers/csv.ts` | crear | `csvBytes` y fixture `excelSpanishCsv` (`;`, BOM, CRLF) |
| `apps/api/test/candidates/import-file.test.ts` | crear | `readImportFile`: cabeceras, DT-08, sin filas, límites, precedencia, sin texto del fichero |
| `apps/api/test/http/payload-too-large.test.ts` | crear | 413 con y sin `config.payloadTooLargeMessage` |

## Implementa
- RF: RF-02 (fichero entero), RF-03 (reglas de fila = alta), RF-06 (mensajes sin valores) · Edge cases: EC-08, EC-10,
  EC-11 (filas), EC-12, EC-16 (mensajes), EC-17, EC-40 (columna de más), **EC-50 (DT-08)** · DD-02, DD-03, DD-04,
  DD-07 (a, f), DD-08
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (2, 3), § Contrato de API (Errores, Orden de
  comprobación), § DD-02, DD-03, DD-04, DD-07, DD-08, § Estrategia de tests (`import-file.test.ts`,
  `payload-too-large.test.ts`), § Orden de implementación 2, § Contrato de API (fila «separador «;» (DT-08)»), § Error
  paths (EC-08, EC-50) · PRD v1.3 DT-03, **DT-08 / EC-50** (cambio del responsable técnico del 2026-10-12)

## Dependencias
- **Depende de:** TASK-01
- **Bloquea:** TASK-03

## Criterios de done
- [x] `npm test -w apps/api -- candidates/import-file http/payload-too-large` en verde con **2** ficheros y, como
      mínimo:
  - `cabeceras de EC-10 (1 válida, 5 inválidas)`: ` Nombre , EMAIL,Telefono` pasa; `nombre,email`,
    `nombre,email,telefono,resumen`, `email,nombre,telefono`, `nombre,email,email` y `nombre,email,telefono,` → 400
    `INVALID_HEADER_MESSAGE`.
  - `EC-50 / DT-08 cabecera separada por «;» → mensaje del separador`: `excelSpanishCsv()` y ` Nombre ; EMAIL ;Telefono`
    → 400 `SEMICOLON_SEPARATOR_MESSAGE` con `details: [{ field: 'file', message: SEMICOLON_SEPARATOR_MESSAGE }]`;
    `nombre;email`, `email;nombre;telefono`, `nombre;email;telefono;resumen` y `nombre;email,telefono` →
    `INVALID_HEADER_MESSAGE`. Ningún mensaje contiene `nombre;email` ni valores de las filas.
  - `línea 1 en blanco con contenido → cabecera`.
  - `0 bytes, solo BOM, solo blancos, solo cabecera → sin filas` (4 casos, `NO_CANDIDATES_MESSAGE`).
  - `500 y 500 + 30 blancos pasan; 501 no` (**tumba M2**: con la guarda quitada, 501 no lanza).
  - `precedencia DT-03: codificación antes que formato, formato antes que cabecera, cabecera antes que filas`
    (p. ej. Latin-1 con cabecera mala → codificación; comillas sin cerrar con `;` en la cabecera → formato; cabecera
    mala con 501 filas → cabecera).
  - `> 1 048 576 bytes → 413 con FILE_TOO_LARGE_MESSAGE` (defensa de DD-02).
  - `ningún mensaje contiene texto del fichero` (cabecera con un email inventado → el 400 no lo contiene; EC-16).
  - `payload-too-large.test.ts › 413 con config.payloadTooLargeMessage usa ese texto; sin él, el genérico`.
- [x] `npm test -w apps/api -- http/ candidates/` en verde: `error-handler.test.ts` y `error-details.test.ts` sin
      cambios (el renombre de `toDetails` no cambia ningún mensaje).
- [x] Ningún fichero tocado pasa de 300 líneas ni ninguna función de `src` de 50 (`npm run lint`).
- [x] `npm run typecheck` sin errores (el `declare module` compila con `erasableSyntaxOnly`).
- [x] `npx eslint apps/api/src/modules/candidates/import-schemas.ts apps/api/src/modules/candidates/import-file.ts apps/api/src/modules/candidates/import-rows.ts apps/api/src/http/error-handler.ts apps/api/test/helpers/csv.ts apps/api/test/candidates/import-file.test.ts apps/api/test/http/payload-too-large.test.ts`
      sin errores.
- [x] Commit único `feat(api): CSV file validation, row rules and 413 message [HU-07 TASK-02]` con los 7 ficheros.

## Notas de implementación
- **DT-08 no adivina el separador**: solo cambia el **texto** del error de cabecera. Las filas nunca se parten por `;`
  y el fichero se rechaza entero igual (400, 0 creados). El BOM ya lo quita `decodeUtf8` y el `\r` del CRLF lo quita
  el *parser*: si alguno se colara, la última parte sería `telefono\r` o la primera `﻿nombre` y el fixture
  daría `INVALID_HEADER_MESSAGE`; el test de EC-50 lo delata.
- `classifyRows` no se prueba aquí: necesita el validador compilado por la app (`request.compileValidationSchema`,
  DD-03 tradeoff). Sus tests van por la ruta en TASK-03.
- `importRowSchema` **referencia** `candidateFieldsSchema.fullName` / `.email` / `.phone`: si alguien cambia una regla
  del alta, cambia en la importación (RF-03, «misma fuente de reglas»). El test contrato está en TASK-03.
- `module-boundaries.test.ts`: los ficheros nuevos solo importan de `candidates` y de lo transversal (`http/`,
  `errors.ts`).
- Los textos `*_MESSAGE` son exactos: los comparan los tests con `toBe`, también en el e2e (TASK-09) a través de la
  web, que pinta `error.message` tal cual.
