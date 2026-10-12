# HU-07 — Importar candidatos desde un CSV — Diseño técnico (backend)

- **Origen:** `specs/PRD.md` (estado Ready, v1.1, 2026-10-12; mandan DT-01 a DT-06; OQ-01 a OQ-05 con la recomendación
  aplicada, pendientes de ratificar, no bloquean)
- **Generado por:** backend-architect
- **Scope cubierto:** RF-02, RF-03, RF-04, RF-05, la parte API de RF-06 y los RNF-01, RNF-02, RNF-04, RNF-05 y RNF-06.
  RF-01, RF-07 y la parte web de RF-06 (y RNF-03 y RNF-07 en el navegador) son del TD-frontend, que consume el
  **Contrato de API** de este documento tal cual.

## Enfoque técnico

Todo vive en el módulo `candidates`. **Sin migración**, sin dependencias nuevas y **sin tocar `apps/api/src/app.ts`**.

1. **Transporte (DD-01, DEC-13):** la web envía los **bytes del fichero tal cual** como cuerpo de
   `POST /api/candidates/import` con `Content-Type: text/csv`. La ruta vive en un **plugin hijo encapsulado**
   (`import-routes.ts`) que quita los parsers heredados y registra solo `text/csv` con `parseAs: 'buffer'`: JSON,
   `text/plain`, `multipart/form-data` y `x-www-form-urlencoded` siguen dando 415 en esa ruta, y `text/csv` sigue dando
   415 en el resto de la API. Como el cuerpo **es** el fichero, el `bodyLimit: 1_048_576` de la ruta mide exactamente
   lo que pide DT-06 (BOM incluido): 1 048 576 pasa y 1 048 577 da 413 antes de leer (comprobado con Fastify 5.12.5).
2. **Fichero entero** (`csv.ts` y `import-file.ts`, puros): UTF-8 estricto (`TextDecoder` con `fatal: true`, BOM
   ignorado) → *parser* RFC 4180 propio con número de línea física → cabecera → «sin filas» → 500 filas. Un solo error,
   en el orden de DT-03, como 400 `VALIDATION_ERROR` con `details: [{ field: 'file', message }]`.
3. **Cada fila** (`import-rows.ts`): las celdas se normalizan con `normalizeCandidateBody` (la del alta) y se validan
   con el **mismo JSON Schema** del alta (`candidateFieldsSchema`), compilado por el Ajv de la app con
   `request.compileValidationSchema`, y sus errores se traducen con la **misma función** que construye el `details` del
   400 del alta (`toValidationDetails`, que se exporta de `apps/api/src/http/error-handler.ts`). Una sola fuente de
   reglas y de mensajes (DD-03).
4. **Alta todo o nada** (`import.ts`): una sola `withTransaction`; por cada fila válida, en orden: repetida en el
   fichero (mapa en memoria) → «repetido»; si no, `INSERT` y **el índice único decide**: el choque con
   `candidates_email_uq` es «duplicado» con el ID existente (DD-05, aclaración de DEC-08); si entra,
   `recalculateRetention` (alta + 6 meses, la misma fórmula que el alta). Cualquier otro error → `ROLLBACK` y 500.
5. **Informe** (200, también con 0 creados, aclaración de DEC-07): recuentos y filas no importadas con fila, campo,
   motivo y, en los duplicados, el ID existente. Nunca un valor del fichero ni dato del existente.

**Alternativa principal descartada:** `multipart/form-data` con `@fastify/multipart`. Dependencia nueva (DEC-05), el
límite se aplicaría a la parte o al cuerpo con *boundaries* (no a los bytes del fichero, DT-06), escribe a disco si no
se configura con cuidado (RN-13) y abre la puerta a los formularios HTML entre sitios, que pueden enviar `multipart`
sin *preflight*. Ver DD-01.

## Módulos y ficheros afectados

| Módulo | Fichero | Cambio |
|---|---|---|
| candidates | `apps/api/src/modules/candidates/csv.ts` | **nuevo** (~120): `decodeUtf8(bytes)` y `parseCsv(text, maxKept)` puros; resultado discriminado `{ ok: true, records, recordCount } \| { ok: false, line }` (DD-06, DD-07) |
| candidates | `apps/api/src/modules/candidates/import-file.ts` | **nuevo** (~90): `MAX_IMPORT_BYTES = 1_048_576`, `MAX_IMPORT_ROWS = 500`, `EXPECTED_HEADER`, los `*_MESSAGE` de DT-03 y `readImportFile(bytes): CsvRecord[]` (filas de datos o `AppError` 400/413) |
| candidates | `apps/api/src/modules/candidates/import-rows.ts` | **nuevo** (~80): `RowValidator`, `classifyRows(records, validateRow)` → `{ valid: ImportRow[], invalid: NotImportedRow[] }` (DD-03, DD-04) |
| candidates | `apps/api/src/modules/candidates/import.ts` | **nuevo** (~90): `ImportDeps` y `importCandidates(deps, bytes, validateRow): ImportReport` (lectura → clasificación → transacción → informe) (DD-05, DD-09) |
| candidates | `apps/api/src/modules/candidates/import-schemas.ts` | **nuevo** (~90): `importRowSchema` (propiedades de `candidateFieldsSchema`), `importReportSchema` (respuesta 200), tipos `ImportRow`, `NotImportedRow`, `ImportReport`, `ImportField` |
| candidates | `apps/api/src/modules/candidates/import-routes.ts` | **nuevo** (~50): plugin encapsulado `candidateImportRoutes` (parsers, `bodyLimit`, `config.payloadTooLargeMessage`, esquema de respuesta, 415 sin cuerpo) y `rowValidator(request)` |
| candidates | `apps/api/src/modules/candidates/routes.ts` | modificar (120 → ~123): `candidatesRoutes` registra `candidateImportRoutes` con `{ service }` (hereda el prefijo `/api/candidates`) |
| candidates | `apps/api/src/modules/candidates/service.ts` | modificar (189 → ~200): `importCsv(bytes, validateRow)` en `CandidatesService` y en la factoría (delega en `importCandidates` con `recalculate: (id) => recalculateRetention(deps, id)`); `writeUniqueEmail` (`:108-119`) usa `existingIdOnDuplicate` |
| candidates | `apps/api/src/modules/candidates/repository.ts` | modificar (195 → ~205): `existingIdOnDuplicate(error, email): number \| undefined` (= `isDuplicateEmailError` + `findIdByEmail`, `:117-120` y `:179-184`). Sin SQL nuevo |
| transversal | `apps/api/src/http/error-handler.ts` | modificar (125 → ~140): exporta `toValidationDetails` (hoy `toDetails`, `:62-69`, sin cambiar su lógica); el 413 usa `request.routeOptions.config.payloadTooLargeMessage` si la ruta lo declara; ampliación de tipos `declare module 'fastify' { interface FastifyContextConfig { payloadTooLargeMessage?: string } }` (ambiental: compatible con `erasableSyntaxOnly` y con el *type stripping*, comprobado) |
| tests | `apps/api/test/helpers/csv.ts` | **nuevo**: `csvBytes(lines, { bom?, eol?, finalEol? })`, `importCsv(app, bytes, headers?)` |
| tests | `apps/api/test/candidates/csv.test.ts` · `import-file.test.ts` · `import.test.ts` · `import-adversarial.test.ts` · `import-failures-adversarial.test.ts` · `import-privacy.test.ts` | **nuevos** (ver *Estrategia de tests*) |
| tests | `apps/api/test/candidates/performance.test.ts` · `apps/api/test/http/payload-too-large.test.ts` | modificar (RNF-01) · **nuevo** (`error-handler.test.ts` ya tiene 299 líneas) |

No cambian: `app.ts`, `cross-site.ts`, `validation.ts`, `normalize.ts`, `retention.ts`, `schemas.ts`, las migraciones ni
el seed. `module-boundaries.test.ts` sigue valiendo: los ficheros nuevos solo importan de `candidates` y de lo
transversal (`http/`, `errors.ts`).

## Contrato de API

### `POST /api/candidates/import`

**Petición**

| Parte | Contrato |
|---|---|
| Cabecera | `Content-Type: text/csv` (los parámetros, como `; charset=utf-8`, se ignoran: siempre se decodifica como UTF-8). La web la fija **siempre a mano**: el `type` de un `File` puede venir vacío o como `application/vnd.ms-excel` |
| Cuerpo | Los bytes del fichero tal cual (en la web, el `ArrayBuffer` leído del `File`: los mismos bytes), sin envoltorio. Máximo **1 048 576 bytes** (`bodyLimit` de la ruta, BOM incluido) |
| `params` · `querystring` | Ninguno |
| Formato del fichero | UTF-8 (BOM inicial opcional, se ignora); separador `,`; comillas dobles RFC 4180 (`""` escapa una comilla; se admiten espacios alrededor de un campo entrecomillado); fin de línea LF o CRLF; línea 1 = cabecera `nombre,email,telefono` (cada nombre recortado y sin distinguir mayúsculas); ≤ 500 filas de datos; las líneas en blanco (sin caracteres o solo con espacios o tabuladores, DD-07 b) se ignoran y no cuentan |

**Respuesta 200** — el informe (`importReportSchema`, `additionalProperties: false` en todos los niveles):

```json
{
  "dataRows": 5,
  "created": 1,
  "duplicates": 2,
  "invalid": 2,
  "notImported": [
    { "row": 3, "reason": "invalid", "errors": [
      { "field": "nombre", "message": "Es obligatorio." },
      { "field": "email", "message": "Formato no válido." } ] },
    { "row": 4, "reason": "invalid", "errors": [ { "field": "fila", "message": "Número de columnas incorrecto." } ] },
    { "row": 5, "reason": "duplicate", "existingId": 7, "errors": [ { "field": "email", "message": "Duplicado." } ] },
    { "row": 6, "reason": "repeated", "firstRow": 2, "errors": [ { "field": "email", "message": "Repetido en el fichero (fila 2)." } ] }
  ]
}
```

| Campo | Tipo | Regla |
|---|---|---|
| `dataRows` | `integer` | Filas de datos del fichero (sin cabecera ni líneas en blanco). Siempre `created + duplicates + invalid` (INV-03) |
| `created` · `duplicates` · `invalid` | `integer` | `duplicates` incluye `duplicate` y `repeated` |
| `notImported[]` | `array` | Una entrada por fila no importada, **ordenadas por `row`**; nunca las creadas (RNF-04). Sin límite: hasta 500 |
| `.row` | `integer` | Línea física donde empieza el registro; cabecera = línea 1 (RN-04, DT-02) |
| `.reason` | `enum` | `invalid` · `duplicate` (el email ya existía en la base) · `repeated` (repetido en el fichero, email nuevo) |
| `.existingId` | `integer` | Solo en `duplicate`: ID del existente (como el 409 del alta, DEC-11.4) |
| `.firstRow` | `integer` | Solo en `repeated`: fila de la primera fila válida con ese email (RN-08) |
| `.errors[]` | `array` de `{ field, message }` | Un elemento por columna, en el orden `nombre`, `email`, `telefono`; `field` ∈ `nombre`, `email`, `telefono`, `fila`. En `invalid`, los `message` **del alta** (mismo texto que su 400) o «Número de columnas incorrecto.» (`fila`, único elemento); en `duplicate`, «Duplicado.»; en `repeated`, «Repetido en el fichero (fila N).» (DT-03). Nunca el valor recibido |

**Errores** (envelope `{ error: { code, message, details? } }`; un solo error por petición, en el orden de DT-03):

| Código HTTP · `code` | Cuándo | `message` (y `details`) |
|---|---|---|
| 403 `CROSS_SITE_REQUEST` | `Sec-Fetch-Site` distinto de `same-origin`/`none` (DEC-12, hook global, antes de leer el cuerpo) | «Petición no permitida desde otro sitio.» |
| 415 `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` distinto de `text/csv` (JSON, `text/plain`, `multipart/form-data`, `x-www-form-urlencoded`…) **o petición sin cuerpo** (DD-10) | «Tipo de contenido no admitido.» |
| 413 `PAYLOAD_TOO_LARGE` | Más de 1 048 576 bytes (por `Content-Length` sin leer el cuerpo, o al pasarse leyendo) | «El fichero ocupa más de 1 MiB. Divídelo en ficheros más pequeños.» (sin `details`) |
| 400 `VALIDATION_ERROR` · codificación | No es UTF-8 válido (Latin-1, binario) | «Formato CSV inválido: el fichero debe estar en UTF-8 y separado por comas.» |
| 400 `VALIDATION_ERROR` · formato | Comillas sin cerrar, texto tras unas comillas de cierre, comilla dentro de un campo sin comillas | El anterior + « Revisa la línea N.» (N: línea donde empieza el campo entrecomillado, o la del carácter inesperado) |
| 400 `VALIDATION_ERROR` · sin filas | Ninguna línea con contenido (0 bytes, solo BOM, solo líneas en blanco), o solo la cabecera (con o sin líneas en blanco) | «El fichero no tiene candidatos.» |
| 400 `VALIDATION_ERROR` · cabecera | La línea 1 no es exactamente `nombre,email,telefono` (o está en blanco y hay contenido después) | «La cabecera no es válida. La primera línea debe ser exactamente: nombre,email,telefono» |
| 400 `VALIDATION_ERROR` · separador «;» (DT-08) | La cabecera no es válida y, partida por «;», coincide con `nombre`, `email` y `telefono` (misma comparación: recortada y sin distinguir mayúsculas). Se comprueba en `import-file.ts` justo antes de devolver el error de cabecera | «El fichero está separado por «;». Guárdalo separado por comas (CSV UTF-8) y vuelve a importarlo.» |
| 400 `VALIDATION_ERROR` · filas | Más de 500 filas de datos | «El fichero tiene más de 500 filas de candidatos. Divídelo en ficheros más pequeños.» |
| 500 `INTERNAL_ERROR` | Fallo de la base o del puerto de procesos; `ROLLBACK`, 0 creados | «Error interno. Inténtalo de nuevo.» |

En los 400, `message` y el único `details[0]` (`{ field: 'file', message }`) llevan el mismo texto, así que la web
puede pintar siempre `error.message` en 400 y 413. Ningún mensaje repite la cabecera recibida ni nada del fichero.

**Orden de comprobación:** guarda entre sitios (403) → parser de la ruta (415, 413) → cuerpo ausente (415) →
codificación → formato CSV → «sin ninguna línea con contenido» → cabecera → «solo cabecera» → más de 500 filas (400) →
validación de filas (sin error HTTP) → transacción (500 si falla) → 200.

### Firmas internas (para el `api-builder`)

```ts
// csv.ts
export interface CsvRecord { line: number; fields: string[] }
export type CsvParseResult =
  | { ok: true; records: CsvRecord[]; recordCount: number } // records: los primeros `maxKept`; recordCount: todos
  | { ok: false; line: number };                            // error de formato y su línea (DD-07 d)
export function decodeUtf8(bytes: Uint8Array): string | null;            // null si no es UTF-8; quita el BOM
export function parseCsv(text: string, maxKept: number): CsvParseResult;
// import-rows.ts
export type RowValidator = (row: Record<string, unknown>) => ErrorDetail[]; // [] = válida
// import.ts
export interface ImportDeps {
  repository: CandidatesRepository; now: Clock; transaction: <T>(fn: () => T) => T;
  recalculate: (id: number) => void;
}
export function importCandidates(deps: ImportDeps, bytes: Uint8Array, validateRow: RowValidator): ImportReport;
// service.ts (CandidatesService)
importCsv(bytes: Uint8Array, validateRow: RowValidator): ImportReport;
```

`rowValidator(request)` (en `import-routes.ts`): `const validate = request.compileValidationSchema(importRowSchema)`
(Fastify la cachea por esquema y ruta; usa el Ajv de `buildApp` con `ajvOptions` y `format: 'email'`, comprobado) y
devuelve `(row) => validate(row) ? [] : toValidationDetails(validate.errors ?? [], 'row')`. Si los tipos de
`validate.errors` no casan con `FastifySchemaValidationError[]`, se adapta en esa función, no en `error-handler.ts`.

## Migración de datos

N/A — sin cambios de esquema (RN-14). La importación escribe en `candidates`
(`apps/api/src/db/migrations/002-create-candidates.sql`) con el `INSERT` del alta (`repository.ts`, `INSERT_SQL`):
`full_name`, `email` normalizado, `phone` o `NULL`, `summary = NULL`, `skills = '[]'`, `created_at` del reloj y
consentimiento a `NULL`; después `recalculateRetention` escribe `retention_ends_at`. Las invariantes ya están en la
base: `candidates_email_uq` (INV-02), `CHECK` de minúsculas y recorte del email, `CHECK` de longitudes y de
consentimiento (INV-04). Los emails ya guardados cumplen el `CHECK` de minúsculas, así que comparar con el índice vale
sin migrar nada (EC-32). Sin cambios en `seed.ts`.

## Diagrama de secuencia

```mermaid
sequenceDiagram
  participant R as Reclutador
  participant W as Web
  participant A as API (import-routes)
  participant S as import.ts
  participant D as SQLite
  R->>W: elige fichero y pulsa «Importar»
  W->>A: POST /api/candidates/import (Content-Type: text/csv, cuerpo = bytes)
  A->>A: onRequest: guarda entre sitios (403)
  A->>A: parser text/csv con bodyLimit 1 048 576 (415 / 413 sin leer de más)
  A->>S: service.importCsv(bytes, rowValidator(request))
  S->>S: readImportFile: UTF-8 → CSV → cabecera → sin filas → 500 (400 VALIDATION_ERROR)
  S->>S: classifyRows: normalizeCandidateBody + importRowSchema (errores del alta)
  alt hay filas válidas
    S->>D: BEGIN IMMEDIATE
    loop cada fila válida, en orden
      alt email ya creado en este fichero (mapa)
        S->>S: «repeated» (firstRow)
      else
        S->>D: INSERT INTO candidates (…)
        alt choque con candidates_email_uq
          D-->>S: SQLITE_CONSTRAINT_UNIQUE (la sentencia se deshace; la transacción sigue)
          S->>D: SELECT id FROM candidates WHERE email = ?
          S->>S: «duplicate» (existingId)
        else entra
          S->>D: recalculateRetention(id): SELECT ficha, puerto de procesos, UPDATE retention_ends_at
        end
      end
    end
    S->>D: COMMIT (cualquier otro error: ROLLBACK → 500 INTERNAL_ERROR)
  end
  S-->>A: ImportReport
  A-->>W: 200 informe (esquema de respuesta filtra campos)
  W-->>R: recuentos y filas no importadas
```

## Error paths

| Edge case (PRD) | Dónde se detecta | Estrategia | Respuesta o efecto observable | Test |
|---|---|---|---|---|
| EC-01 | API: `decodeUtf8` / `parseCsv` | Decide el contenido: la web envía cualquier fichero como `text/csv` | PNG → 400 «Formato CSV inválido…»; `.txt` válido → 200 informe | `import-adversarial.test.ts` (PNG); web, TD-frontend |
| EC-02 | Web | Botón deshabilitado sin fichero | Sin petición | TD-frontend |
| EC-03 | Web | Error de red / 10 s | `role="alert"`, reintento | TD-frontend |
| EC-04 | Web | Botón deshabilitado al primer clic | Una petición | TD-frontend |
| EC-05 | Web (`isImportReport`) | No pinta un informe a medias | Error genérico | TD-frontend; la API lo evita con `importReportSchema` |
| EC-06 | API: hook `cross-site.ts` | 403 antes de leer el cuerpo; `text/csv` exige *preflight* | 403 `CROSS_SITE_REQUEST`; el nombre del fichero nunca llega a la API | `import-adversarial.test.ts`; título/URL: TD-frontend |
| EC-07 | `import.ts` (índice) | Reimportar = filas «duplicate» | 200, `created: 0` | `import.test.ts` (CA-05) |
| EC-08 | `import-file.ts` (cabecera) | `nombre;email;telefono` es una sola columna ≠ esperada; como partida por «;» coincide, da el mensaje de DT-08 (EC-50) | 400 separador «;» | `import-adversarial.test.ts` (CA-11) |
| EC-09 | `decodeUtf8` · `parseCsv` | `TextDecoder` `fatal`; comillas sin cerrar con su línea | 400 formato (sin línea; sin línea; «Revisa la línea 4.») | `csv.test.ts`, `import-adversarial.test.ts` (CA-12) |
| EC-10 | `import-file.ts` | Exactamente 3 campos, recortados y en minúsculas | ` Nombre , EMAIL,Telefono` → 200; los otros 5 → 400 cabecera | `import-file.test.ts` |
| EC-11 | Parser de la ruta (`bodyLimit`) · `import-file.ts` | Bytes = fichero; filas contadas sin líneas en blanco | 500 y 500 + 30 blancos → 200; 501 → 400 filas; 1 048 576 → 200; 1 048 577 → 413 | `import-adversarial.test.ts` (CA-14), `import-file.test.ts` |
| EC-12 | `import-file.ts` | Sin ninguna línea con contenido o solo cabecera → «sin filas»; BOM y CRLF aceptados; última fila sin `\n` cuenta | 400 «El fichero no tiene candidatos.» (4 casos); 200 | `import-adversarial.test.ts` (CA-13), `csv.test.ts` (CA-03) |
| EC-13 | Web | `File` ilegible | Error sin petición | TD-frontend |
| EC-14 | — | N/A — función pura (PRD) | — | — |
| EC-15 | `parseCsv` | EOF dentro de comillas → línea donde empieza el campo | 400 «… Revisa la línea N.», 0 creados | `csv.test.ts`, `import-adversarial.test.ts` |
| EC-16 | Parser de la ruta | `Content-Length` > límite → 413 sin leer el cuerpo; mensajes con texto fijo | 50 MiB → 413; cabecera con un email → 400 sin el email | `import-adversarial.test.ts`, `import-privacy.test.ts` |
| EC-17 | `import-file.ts` (pura) | Determinista | Mismo 400 dos veces; 0 creados | `import-adversarial.test.ts` |
| EC-18 | `import-rows.ts` | Celda vacía = campo ausente (DD-04); errores por columna | Fila 3: `nombre` «Es obligatorio.», `email` «Formato no válido.»; `telefono` «Formato no válido.» | `import.test.ts` (CA-08) |
| EC-19 | `parseCsv` · `import-rows.ts` | Número de campos ≠ 3 → `fila`; coma entrecomillada no separa | «Número de columnas incorrecto.»; `"Ferrer, Lucía"` → creado sin teléfono | `import.test.ts`, `csv.test.ts` |
| EC-20 | `importRowSchema` (`NO_CONTROL_CHARS`) | Mismo `pattern` del alta; el recorte quita tabuladores en los bordes (igual que el alta), así que el test pone el control **en medio** | NUL, `\t` o salto de línea entrecomillado dentro del nombre → `nombre` «Formato no válido.» | `import.test.ts` |
| EC-21 | `importRowSchema` | Mismas longitudes del alta (puntos de código) | Valen 2, 100, 254, 6 y 20; el resto, error del campo; `"   "` → «Es obligatorio.»; teléfono de espacios → `null` | `import.test.ts` |
| EC-22 | `parseCsv` | `line` = línea física de inicio | Fila inválida de la línea 7 → `row: 7`; los blancos no cuentan | `import.test.ts` (CA-10), `csv.test.ts` |
| EC-23 | — | N/A — validación pura (PRD) | — | — |
| EC-24 | — | N/A — sin estado compartido (PRD) | — | — |
| EC-25 | `import-rows.ts` | `,,` son 3 campos vacíos, no una línea en blanco | Fila con `nombre` y `email` «Es obligatorio.» | `import.test.ts` |
| EC-26 | `import.ts` (sentencias preparadas) | Se guarda tal cual tras recortar | `<script>…`, `=HYPERLINK(…)` y `+34 600 000 031` creados tal cual; sin valores en el informe | `import-adversarial.test.ts` |
| EC-27 | `classifyRows` | Determinista; errores ordenados por columna | Mismo `notImported` dos veces | `import-adversarial.test.ts` (EC-17/EC-27) |
| EC-28 | `normalizeCandidateBody` + índice | Email recortado y en minúsculas antes de insertar | `duplicate` con el ID de Ana | `import.test.ts` (CA-04) |
| EC-29 | `import.ts` (mapa en memoria) | Solo filas válidas entran en el mapa | 1 creado y 499 `repeated` (`firstRow: 2`); fila 2 inválida → entra la 3 | `import.test.ts` (CA-07) |
| EC-30 | `withTransaction` | Cualquier error que no sea el `UNIQUE` → `ROLLBACK` y relanza | 500 `INTERNAL_ERROR`, 0 creados (puerto de procesos que falla) | `import-failures-adversarial.test.ts` |
| EC-31 | Índice `candidates_email_uq` | El choque es una fila `duplicate`; nunca 409 ni 500 en la importación; el alta sigue dando 409 | Un solo candidato; la otra importación lo da `duplicate` (o el alta, 409) | `import-failures-adversarial.test.ts` (CA-06) |
| EC-32 | `CHECK` de la migración 002 | Sin migrar | Duplicado contra un email del alta | `import.test.ts` (CA-04) |
| EC-33 | `importReportSchema` | Solo `existingId`, sin leer nada del existente | Informe sin nombre, email ni teléfono de Ana | `import.test.ts` (CA-04) |
| EC-34 | `import.ts` (DT-01) | El `INSERT` choca en cada repetición de un email existente | Reimportar con repeticiones: todas `duplicate` | `import.test.ts` |
| EC-35 | — | N/A — RF-05 solo recibe filas validadas (PRD) | — | — |
| EC-36 | `import.ts` · `retention.ts` | Un `now()` por importación; misma fórmula | 0 válidas → 200 sin transacción; 1 y 500 → todas; retención 2027-04-13 y 2027-02-28 | `import.test.ts` |
| EC-37 | `withTransaction` | `ROLLBACK` del lote | Trigger en `INSERT` de `candidates` o en `UPDATE OF retention_ends_at` con `id = 250` → 500, 0 creados | `import-failures-adversarial.test.ts` |
| EC-38 | `withTransaction` (`BEGIN IMMEDIATE`) | Serializa con otras escrituras; el manejador es síncrono | Cada operación ve la otra completa; con otra conexión con el cerrojo, `BEGIN` falla → 500 sin cambios y reintento seguro | `import-failures-adversarial.test.ts` (importación + alta a la vez) |
| EC-39 | `withTransaction` | Todo o nada | Recuento de candidatos igual al de antes tras el fallo | `import-failures-adversarial.test.ts` |
| EC-40 | `error-handler.ts` · `import-file.ts` | 500 registra el error de SQLite (columnas, no valores); columna de más → cabecera | 500 sin datos ni *stack*; `consentimiento` → 400 cabecera | `import-privacy.test.ts`, `import-adversarial.test.ts` |
| EC-41 | `withTransaction` | Nada quedó: el reintento crea una vez | Reintento: 3 creados; segundo reintento: 3 `duplicate` | `import-failures-adversarial.test.ts` (CA-15) |
| EC-42 | — | N/A — el informe lo construye el servidor (PRD) | — | — |
| EC-43 | `import.ts` | Sin truncar; hasta 3 errores por fila | 500 filas en `notImported`; fila con 3 errores; suma = `dataRows` | `import.test.ts` |
| EC-44 | — | N/A — si no llega, EC-03 (PRD) | — | — |
| EC-45 | — | N/A — informe por petición, sin persistir (PRD) | — | — |
| EC-46 | `import.ts` | Cada fila en una categoría | `created + duplicates + invalid = dataRows`, blancos fuera | `import.test.ts` |
| EC-47 | `importReportSchema` · web | 0 valores y 0 creadas en el informe | Informe sin «Lucía Ferrer Prat»; navegador: TD-frontend | `import-privacy.test.ts` |
| EC-48 | Web | Sin reenvío al volver atrás | — | TD-frontend |
| EC-49 | `parseCsv` (DD-07 b, DT-07) | Una línea solo con espacios o tabuladores es una línea en blanco: se ignora; `,,` sigue siendo fila | Línea 4 con `   \t ` entre filas → no sale en el informe, `dataRows` no la cuenta y la fila de la línea 5 sale como `row: 5`; un fichero de cabecera + líneas de espacios → «El fichero no tiene candidatos.»; `,,` → fila con `nombre` y `email` «Es obligatorio.» | `csv.test.ts`, `import.test.ts` |
| EC-50 | `import-file.ts` (cabecera, DT-08) | El CSV de Excel en español («;», BOM, CRLF): la cabecera no es válida y, partida por «;», coincide con las columnas esperadas | 400 `VALIDATION_ERROR`, `details: [{ field: 'file' }]`, con el mensaje de DT-08 y 0 creados; `email;nombre;telefono` (partida por «;» no coincide en orden) da el mensaje de cabecera de DT-03 | `import-file.test.ts`, `import-adversarial.test.ts` (CA-11) y el e2e (CA-19), con el fixture de Excel |

## Threat modeling

| STRIDE | Amenaza concreta | Mitigación |
|---|---|---|
| Suplantación | Otra web (u otro puerto local) lanza la importación contra `127.0.0.1:3001` | DEC-12: 403 por `Sec-Fetch-Site`. Además `text/csv` no es un tipo «simple» de CORS: un `fetch` entre orígenes exige *preflight* (la API no responde CORS) y un formulario HTML no puede enviarlo (sus tipos, `multipart` y `urlencoded`, dan 415 en la ruta). Sin login (DEC-04) |
| Manipulación | *Mass assignment* desde el CSV (consentimiento, retención, resumen, origen) | Cabecera exacta de 3 columnas: una columna de más rechaza el fichero; el servidor pone `created_at`, consentimiento `NULL` y la retención (convención «lo que decide el servidor no llega del cliente») |
| Manipulación | Inyección SQL con nombres o emails | Solo sentencias preparadas (`INSERT_SQL` existente); el *parser* no construye SQL |
| Manipulación | Inyección HTML o de fórmulas (`=HYPERLINK`) | Se guarda como texto (RN-16); la web pinta texto. La exportación, con su neutralización, está fuera de scope |
| Repudio | No hay rastro de quién importó qué | Aceptado: RN-12 y RN-14 prohíben persistir el informe y el origen; rol único (DEC-04) |
| Exposición de datos | Valores del fichero en errores, informe o logs | Mensajes fijos (`*_MESSAGE`) y los del alta, que no repiten valores (DEC-11.4); `importReportSchema` filtra campos; los logs no registran cuerpos (`logger.ts`) y los 500 registran el error de SQLite (columnas, no valores) |
| Exposición de datos | Enumerar qué emails existen subiendo un CSV | El informe da el `existingId`, igual que el 409 del alta: aceptado (DEC-04, DEC-07, EC-33). Nunca el nombre ni el email del existente |
| Exposición de datos | Copia del fichero en disco | `parseAs: 'buffer'` en memoria; ningún `node:fs` en el módulo (lo vigila `import-privacy.test.ts`) |
| Denegación de servicio | Fichero enorme | 413 por `Content-Length` antes de leer; si no hay `Content-Length`, Fastify corta al pasar de 1 MiB |
| Denegación de servicio | Fichero de 1 MiB con cientos de miles de líneas `,` | `parseCsv` recorre en O(n) y guarda solo los primeros 502 registros (`maxKept` = cabecera + 501), contando el resto: memoria acotada y precedencia de DT-03 intacta |
| Denegación de servicio | Importación de 500 filas bloquea el bucle de eventos (`node:sqlite` síncrono) | RNF-01 < 500 ms; un único usuario local (DEC-01) |
| Elevación de privilegios | N/A — un solo rol, sin permisos (DEC-04) | Si llegara un login: la ruta exigiría el rol que puede dar altas y el informe seguiría sin datos del existente |

## Datos personales

- **Entran:** nombre y apellidos, email y teléfono de cada fila (RGPD §1), solo en memoria durante la petición
  (`Buffer` del cuerpo, texto decodificado, registros). No se escriben a disco ni se guardan fuera de `candidates`.
- **Se guardan:** los de las filas creadas, como un alta (sin consentimiento, RN-09; retención alta + 6 meses, RGPD §3,
  calculada por `recalculateRetention`). Ni origen, ni fichero, ni informe (RN-13, RN-14).
- **Se devuelven:** solo recuentos, número de fila, columna, motivo fijo y `existingId` (RNF-04). Ningún valor del
  fichero ni dato del existente; las filas creadas no se listan.
- **Se registran:** método, ruta sin query e ID de petición (`apps/api/src/logger.ts`); en un 500, el objeto de error
  de SQLite o del puerto. **Nunca** cuerpos, cabeceras del fichero, valores de filas ni el nombre del fichero (no
  viaja: el cuerpo son los bytes, sin `filename`).
- **Prohibido en logs y errores:** nombres, emails, teléfonos y cualquier línea del fichero, también la cabecera
  recibida (EC-16). Los textos de error son constantes; el único dato variable es un número de línea.
- **Supresión:** un importado es un candidato más; le aplicará la anonimización de la feature A (RGPD §5).
- **Tests:** solo datos inventados (`@example.com`, `+34 600 000 0xx`); el agente `datos-personales-auditor` lo revisa.

## Decisiones de diseño

### DD-01: Cuerpo crudo `text/csv` en un plugin encapsulado
- **Contexto:** hoy `multipart` y `urlencoded` dan 415 (DEC-11.5) y el `bodyLimit` global (1 048 576) cubre todo el
  cuerpo; DT-06 mide el límite sobre los bytes del fichero.
- **Opciones consideradas:** A) bytes crudos con `Content-Type: text/csv`; B) `multipart/form-data` con
  `@fastify/multipart`; C) JSON con el contenido como texto o base64; D) `text/plain`.
- **Elegida:** A, en `import-routes.ts`, registrado con `app.register` **sin** `fastify-plugin`, que hace
  `removeAllContentTypeParsers()` y `addContentTypeParser('text/csv', { parseAs: 'buffer' }, …)`.
- **Razón:** el cuerpo es el fichero, así que el límite de la ruta mide lo que dice DT-06; sin dependencias; nada en
  disco; la encapsulación deja el resto de la API igual (comprobado: `text/csv` en `POST /api/candidates` sigue en 415,
  JSON en la importación da 415). B suma dependencia y *boundaries*; C infla el cuerpo (escape o +33 %) y obligaría a
  subir el límite global; D es un tipo «simple» de CORS (sin *preflight*) y ya tiene un parser global que da 400.
- **Tradeoff:** se pierde el nombre del fichero y cualquier metadato (no se quiere: RN-13). La web tiene que fijar el
  `Content-Type` a mano y no puede reutilizar `requestJson` tal cual. Es una convención nueva: **DEC-13** (aceptada el 2026-10-12).

### DD-02: 1 MiB = `bodyLimit` de la ruta; el 413 lleva su mensaje por `config`
- **Contexto:** DT-03 fija el texto del 413 de la importación, pero el 413 lo genera Fastify
  (`FST_ERR_CTP_BODY_TOO_LARGE`) y el único manejador da un texto genérico.
- **Opciones consideradas:** A) `bodyLimit: MAX_IMPORT_BYTES` y `config: { payloadTooLargeMessage }` en la ruta; el
  manejador único usa ese texto en el 413 si existe; B) *parser* propio que lea el *stream* y cuente bytes; C)
  `errorHandler` propio en la ruta; D) `bodyLimit` mayor y comprobar el tamaño en el servicio.
- **Elegida:** A (comprobado: `request.routeOptions.config` está disponible en el error del *parser*).
- **Razón:** reutiliza el límite probado de Fastify (incluido el corte por `Content-Length` sin leer); un solo
  `setErrorHandler`; 5 líneas en `error-handler.ts`. B reimplementa el límite; C rompe el manejador único; D lee de más
  y daría dos textos distintos según el tamaño.
- **Tradeoff:** `error-handler.ts` conoce una clave de `config` y amplía los tipos de Fastify (`declare module`).
  `readImportFile` repite la comprobación de tamaño como defensa (413 con el mismo texto) por si alguien quita el
  `bodyLimit`.

### DD-03: Las reglas de fila son el esquema del alta, compilado por el Ajv de la app
- **Contexto:** las reglas del alta solo existen como JSON Schema (`candidateFieldsSchema`, `schemas.ts:62-80`) y sus
  mensajes, en el manejador (`error-handler.ts:62-125`). RF-03 exige la misma fuente, no una copia.
- **Opciones consideradas:** A) `importRowSchema` con las **mismas propiedades** de `candidateFieldsSchema`, compilado
  con `request.compileValidationSchema` y traducido con `toValidationDetails` exportado; B) reescribir las reglas en
  TypeScript; C) importar `ajv` directamente; D) `app.inject` interno a `POST /api/candidates` por fila.
- **Elegida:** A.
- **Razón:** mismo esquema, mismas opciones de Ajv (`coerceTypes: false`, `allErrors`, formato `email`) y misma
  función de mensajes: no puede divergir (lo fija un test contrato que compara mensajes del alta y de la fila). B
  duplica; C es una dependencia directa que DEC-11 ya descartó; D son 500 peticiones y 500 transacciones (rompe RF-05).
- **Tradeoff:** el servicio recibe el validador como función desde la ruta (`RowValidator`), porque solo `request` da
  acceso al compilador de Fastify; un test unitario de `classifyRows` necesita una app para obtenerlo.

### DD-04: Celda vacía de `nombre` o `email` = campo ausente
- **Contexto:** con `normalizeCandidateBody` un nombre `"   "` queda `""` y el alta diría «Debe tener al menos 2
  caracteres.»; CA-08 y EC-21 piden «obligatorio».
- **Opciones consideradas:** A) quitar la clave si la celda recortada está vacía, para que salte `required` («Es
  obligatorio.», un mensaje del alta); B) dejar `""` y aceptar el mensaje de longitud.
- **Elegida:** A. El teléfono vacío pasa a `null` como en el alta.
- **Razón:** en un CSV la celda vacía es ausencia; cumple CA-08 con un texto que el alta ya emite.
- **Tradeoff:** para el nombre vacío, la importación y el alta (`""` por JSON) dan textos distintos; está acotado a
  la celda vacía y lo documenta el test contrato.

### DD-05: El índice único decide el duplicado; las repeticiones del fichero, un mapa en memoria
- **Contexto:** convención «el índice único decide el duplicado, sin `SELECT` previo»; DT-01 (la base primero) y RN-08.
- **Opciones consideradas:** A) por fila válida: si su email ya entró en esta importación → `repeated`; si no,
  `INSERT` y, si choca con `candidates_email_uq`, `duplicate` con `existingIdOnDuplicate`; B) `SELECT … IN
  (json_each(?))` previo con todos los emails y luego insertar.
- **Elegida:** A. DT-01 sale solo: una fila cuyo email ya existía choca siempre (no entra en el mapa), aunque se repita.
- **Razón:** sigue la convención; una escritura simultánea nunca da 500 (EC-31, RN-11); sin SQL nuevo en el
  repositorio. Tras un `UNIQUE`, SQLite deshace solo la sentencia y la transacción sigue abierta (gotcha documentado).
- **Tradeoff:** un `INSERT` fallido y un `SELECT` por duplicado (500 duplicados = 1 000 sentencias, dentro del
  presupuesto de RNF-01) frente a una sola consulta en B.

### DD-06: *Parser* CSV propio, puro y con número de línea
- **Contexto:** RN-01 (RFC 4180), RN-04 y DT-02 (línea física de inicio del registro).
- **Opciones consideradas:** A) *parser* propio de un solo recorrido; B) `csv-parse` u otra librería; C) `split('\n')`
  y `split(',')`.
- **Elegida:** A (`csv.ts`, ~120 líneas, funciones ≤ 50 líneas).
- **Razón:** B es una dependencia (DEC-05) y su numeración de líneas y sus errores no coinciden con DT-02/DT-03; C no
  soporta comillas ni comas o saltos dentro de un campo.
- **Tradeoff:** código propio que mantener; lo compensa `csv.test.ts` con cada regla.

### DD-07: Reglas finas del fichero que el PRD deja implícitas
- **Contexto:** RN-01, RN-02 y RN-04 no fijan algunos bordes; se decide la lectura literal salvo en (b), que fija el
  responsable técnico (DT-07 y EC-49 del PRD, 2026-10-12).
- **Reglas fijadas:** (a) la cabecera es la **línea física 1**: si está en blanco (vacía o solo con espacios o tabuladores) y
  hay contenido después, error de cabecera («La primera línea debe ser…»); (b) **línea en blanco** = la que, tras quitar
  `\r\n` o `\n`, no tiene ningún carácter o **solo tiene espacios (U+0020) o tabuladores (U+0009)**, sin comillas: se
  **ignora** como una línea vacía (no es fila, no cuenta en `dataRows` ni en el límite de 500 y no desplaza la
  numeración física). Una línea con `,,` **no** está en blanco: es una fila con errores (DT-02); `  ""  ` tampoco (lleva
  comillas: 1 campo → «Número de columnas incorrecto.»); (c) se admiten **espacios** (U+0020) antes de la
  comilla de apertura y después de la de cierre; (d) una comilla dentro de un campo sin comillas o texto tras la de
  cierre → «Formato CSV inválido… Revisa la línea N.»; (e) un `\r` suelto no es fin de línea: queda en el campo y lo
  rechaza el `pattern` de controles; (f) si el fichero no tiene **ninguna** línea con contenido (todas en blanco según
  (b)), «El fichero no tiene candidatos.» va antes que la cabecera (si no, 0 bytes y «solo BOM» darían error de
  cabecera, contra CA-13).
- **Opciones consideradas:** A) lectura literal en todo, también «línea vacía» = 0 caracteres (una línea de espacios
  sería una fila con «Número de columnas incorrecto.»); B) tolerante en todo (buscar la cabecera en la primera línea no
  vacía, aceptar comillas sueltas); C) literal salvo las líneas solo con espacios o tabuladores, que se ignoran.
- **Elegida:** C (decisión del responsable técnico, DT-07).
- **Razón:** una línea de espacios o tabuladores no aporta datos y es habitual en CSV editados a mano; ignorarla no
  mueve la numeración física. El resto sigue el texto del PRD y CA-13; B movería la numeración y aceptaría ficheros
  ambiguos.
- **Tradeoff:** una fila con una sola celda de espacios no se informa como error: desaparece sin rastro en el informe
  (ni cuenta en `dataRows`).

### DD-08: Forma del informe
- **Contexto:** RF-06 pide fila, campo y motivo y el ID del existente; la web lo pinta sin traducir.
- **Opciones consideradas:** A) `notImported[]` con `reason` (`invalid`/`duplicate`/`repeated`), `errors[]` y
  `existingId`/`firstRow` opcionales, `field` con los **nombres de columna del CSV** (`nombre`, `email`, `telefono`, y
  `fila` para la fila entera); B) tres listas separadas; C) `field` con los nombres de la API (`fullName`, `phone`).
- **Elegida:** A, ordenada por `row` y con los errores en el orden de las columnas.
- **Razón:** una sola lista que la web recorre; el reclutador reconoce las columnas de su fichero; `reason` y los IDs
  permiten el enlace «Ver candidato» sin analizar textos.
- **Tradeoff:** `field` usa un vocabulario distinto del de `details` del alta (`fullName`); la traducción vive en
  `import-rows.ts` (`FIELD_BY_PROPERTY`). Los motivos llevan punto final («Duplicado.», «Repetido en el fichero (fila
  N).») por coherencia con los mensajes del alta; DT-03 los cita sin él.

### DD-09: Un `now()` por importación y `recalculateRetention` por fila
- **Contexto:** RN-10 y DEC-09; «misma fórmula que el alta».
- **Opciones consideradas:** A) `createdAt = deps.now()` una vez y, por fila creada, `recalculate(id)` (la operación
  interna del alta); B) calcular la retención con `computeRetentionEndsAt` y escribirla en el `INSERT`.
- **Elegida:** A. Con 0 filas válidas no se abre transacción.
- **Razón:** `recalculateRetention` es el único escritor de `retention_ends_at` (DD-05 de HU-03); B lo saltaría.
- **Tradeoff:** 4 sentencias más por fila creada (dentro de RNF-01); todas las filas comparten `created_at` y el
  listado las ordena por `id DESC`.

### DD-10: Sin cuerpo o con otro tipo de contenido → 415
- **Contexto:** sin `Content-Type`, Fastify ejecuta el manejador con `body` `undefined` (comprobado).
- **Opciones consideradas:** A) 415 `UNSUPPORTED_MEDIA_TYPE` si `!Buffer.isBuffer(request.body)`; B) tratarlo como
  fichero vacío («El fichero no tiene candidatos.»).
- **Elegida:** A.
- **Razón:** la ruta solo admite `text/csv`; un cuerpo `text/csv` de 0 bytes sí llega como `Buffer` vacío y da «sin
  candidatos» (CA-13).
- **Tradeoff:** un cliente que olvide la cabecera ve 415 y no un mensaje del fichero; la web siempre la envía.

## Impacto en decisiones

| Decisión | Impacto |
|---|---|
| DEC-01, DEC-04, DEC-06, DEC-09, DEC-12 | Se aplican sin cambios (envelope, sin login, todo en `candidates` y el puerto de procesos ya conectado, reloj inyectado, 403 heredado) |
| DEC-05 | Se aplica: **sin dependencias nuevas** (*parser* propio, Ajv de Fastify) |
| **DEC-07** | **Aclaración aceptada y escrita en `DECISIONS.md`** («*Aclaración 2026-10-12 (HU-07 vivo/C)*», DT-05): una operación por lotes que devuelve un informe responde **200** con el informe también con 0 creados; los fallos de cada elemento van en el informe. La decisión no cambia |
| **DEC-08** | **Aclaración aceptada y escrita en `DECISIONS.md`** (DT-05): en un lote, el choque con el índice único es una fila «duplicado» con `existingId`, nunca 409 ni 500; la unicidad la sigue garantizando el índice. La decisión no cambia |
| DEC-11 | Se aplica: 413/415 (11.5), mensajes sin valores (11.4), `withTransaction` (11.7), controles (11.8). **Aclaración de 11.4 aceptada y escrita en `DECISIONS.md`** (DT-05): los errores de un fichero entero llevan un único `details: [{ field: 'file', message }]`; las filas del informe reutilizan los mensajes del esquema del alta |
| **DEC-13 (nueva)** | **Aceptada (2026-10-12) y escrita en `DECISIONS.md`:** «Ficheros subidos: cuerpo crudo con su tipo de medio, sin multipart». Ruta de fichero en un plugin encapsulado con solo su parser (`parseAs: 'buffer'`), `bodyLimit` = límite del fichero (sonda en Fastify 5.12.5: 1 048 576 bytes pasa, 1 048 577 da 413), texto del 413 en `config.payloadTooLargeMessage` para el manejador único, nada a disco; `multipart` y `urlencoded` siguen en 415. Refuerza DEC-12: `text/csv` exige *preflight* y ningún formulario HTML lo envía. Concreta DD-01 y DD-02 |

## Estrategia de tests

Vitest con `app.inject` sobre `:memory:` migrada (`createTestApp`), reloj `createTestClock('2026-10-12T09:00:00.000Z')`
salvo que se diga otra cosa, ficheros construidos en el test con `csvBytes` (sin fixtures en disco en la API). Datos
inventados: `@example.com`, `+34 600 000 0xx`. Sin mocks de módulo: fallos con `failWrites` (trigger real) y
`createProcessesStub({ fail: true })`.

| Fichero (nuevo salvo indicación) | Qué cubre | Tests previstos (nombre) |
|---|---|---|
| `apps/api/test/candidates/csv.test.ts` | `decodeUtf8`, `parseCsv` (unitarios) | «BOM y CRLF», «comillas dobles escapadas y coma entrecomillada», «registro de varias líneas: fila = línea de inicio y las siguientes siguen la física» (DT-02), «comillas sin cerrar → línea de inicio» (EC-15), «texto tras comillas de cierre», «comilla en campo sin comillas», «espacios alrededor de un campo entrecomillado», «EC-49 líneas vacías y solo con espacios o tabuladores ignoradas sin desplazar la numeración; `,,` y `  ""  ` no», «última línea sin salto», «`0xF1` y firma PNG → null» (EC-09), «`maxKept` cuenta todos y guarda N» |
| `apps/api/test/candidates/import-file.test.ts` | `readImportFile` | «cabeceras de EC-10 (1 válida, 5 inválidas)», «línea 1 en blanco con contenido → cabecera», «0 bytes, solo BOM, solo blancos, solo cabecera → sin filas», «500 y 500 + 30 blancos pasan; 501 no», «precedencia DT-03: formato antes que cabecera, cabecera antes que filas», «ningún mensaje contiene texto del fichero» |
| `apps/api/test/candidates/import.test.ts` | Ruta, flujos P/A1/A2/A3 | «CA-01 crea 3 sin consentimiento con retención 2027-04-12 y el informe no lista creadas», «CA-03 BOM + CRLF = mismo resultado», «CA-04 duplicado con existingId y Ana sin cambios», «CA-05 reimportar → 0 creados y 3 duplicate», «EC-34 email existente repetido → todas duplicate», «CA-07 repeated (firstRow) y fila inválida no es primera», «EC-29 500 filas mismo email», «CA-08 errores por columna sin valores», «CA-09 todas inválidas → 200 con 0 creados», «CA-10 numeración física», «EC-49 línea de espacios y tabuladores ignorada: ni en el informe ni en `dataRows`, la siguiente conserva su línea; cabecera + líneas de espacios → sin candidatos», «EC-19/EC-25 columnas y `,,`», «EC-20 controles en medio del nombre», «EC-21 bordes de longitud», «EC-36 retención 22:30Z y 31/08», «EC-43/EC-46 suma = dataRows y 500 sin truncar», «contrato: los mensajes de fila son los del 400 del alta para los mismos valores» |
| `apps/api/test/candidates/import-adversarial.test.ts` `[adversarial]` | E1-E3, tipos y seguridad | «CA-11 tres cabeceras → 400 con la esperada; ` Nombre , EMAIL,Telefono` → 200», «CA-12 Latin-1, PNG y comillas desde la línea 4», «CA-13 cuatro ficheros sin candidatos», «CA-14 500/501 filas y 1 048 576/1 048 577 bytes (cabecera + 1 fila + relleno de `\n`)», «EC-16 50 MiB → 413», «EC-17/EC-27 mismo resultado dos veces», «415: JSON, `text/plain`, `multipart`, `urlencoded` y sin cuerpo», «`text/csv` en `POST /api/candidates` sigue en 415», «EC-06 cross-site → 403», «EC-26 `<script>`, `=HYPERLINK` y `+34…` guardados tal cual», «EC-40 columna `consentimiento` → cabecera» |
| `apps/api/test/candidates/import-failures-adversarial.test.ts` `[adversarial]` | E4, concurrencia, idempotencia | «CA-15 falla el recálculo de la 2.ª fila (`UPDATE OF retention_ends_at`, `id = 2`) → 500 y 0 creados; sin el trigger, 3 creados una vez» (EC-41), «EC-37 falla el `INSERT` → 500, 0 creados; fila 250 de 500 → 0 creados» (EC-39), «EC-30 puerto de procesos que falla → 500», «CA-06/EC-31 dos importaciones a la vez → 1 creado y 1 duplicate, ninguna 500», «EC-31 importación y alta a la vez → `duplicate` o 409», «EC-38 recuento intacto tras un fallo» |
| `apps/api/test/candidates/import-privacy.test.ts` `[adversarial]` | CA-17, RNF-02, RNF-03 (API), RNF-04, RNF-06 | Logger capturado (patrón de `privacy-logs.test.ts`): «ni logs, ni `message`/`details`, ni informe contienen valores de CA-01/CA-04 en la importación y en los errores de CA-08, CA-11 a CA-15», «el informe solo tiene claves del esquema y `existingId` de los existentes», «ningún fichero nuevo de `os.tmpdir()` contiene el marcador del CSV», «ningún fichero de `apps/api/src/modules/candidates/` importa `node:fs`», «500 sin *stack trace*» |
| `apps/api/test/candidates/performance.test.ts` (modificar) | RNF-01 | «importar 500 filas nuevas < 500 ms con 1 000 candidatos» |
| `apps/api/test/http/payload-too-large.test.ts` | DD-02 | «413 con `config.payloadTooLargeMessage` usa ese texto; sin él, el genérico» |

**Tabla criterio → test (API):**

| Criterio | Test |
|---|---|
| CA-01, CA-03, CA-04, CA-05, CA-07, CA-08, CA-09, CA-10 | `import.test.ts` |
| CA-06 | `import-failures-adversarial.test.ts` |
| CA-11, CA-12, CA-13, CA-14 | `import-adversarial.test.ts` (+ `import-file.test.ts`, `csv.test.ts`) |
| CA-15 | `import-failures-adversarial.test.ts` |
| CA-17 · RNF-02 · RNF-04 · RNF-06 | `import-privacy.test.ts` |
| RNF-01 | `performance.test.ts` |
| RNF-05 | `import-adversarial.test.ts` (CA-14, EC-16) |
| CA-02, CA-16, CA-18, RNF-03 (navegador), RNF-07 | TD-frontend (Testing Library y e2e) |

### Orden de implementación (base de `/task-planner`; 5 tareas de API)

1. **(M)** `csv.ts` + `csv.test.ts`.
2. **(M)** `import-schemas.ts`, `import-file.ts`, `import-rows.ts`; exportar `toValidationDetails` y el 413 por
   `config` en `error-handler.ts`; `import-file.test.ts` y `payload-too-large.test.ts`.
3. **(L)** `existingIdOnDuplicate` en `repository.ts`, `import.ts`, `importCsv` en `service.ts`,
   `import-routes.ts` y su registro en `routes.ts`; `apps/api/test/helpers/csv.ts` e `import.test.ts`.
4. **(M) `[adversarial]`** `import-adversarial.test.ts` e `import-failures-adversarial.test.ts`.
5. **(M) `[adversarial]`** `import-privacy.test.ts` y RNF-01 en `performance.test.ts`.

Con el frontend (pantalla, cliente `text/csv`, informe, enlace en el listado) y el e2e con fixtures, la HU queda en
unas 10-11 tareas, por debajo del techo de 15.

## Riesgos

| Riesgo | Probabilidad (1–5) | Impacto (1–5) | Mitigación |
|---|---|---|---|
| El *parser* propio acepta o rechaza un CSV de Excel/LibreOffice de forma inesperada (comillas, CRLF dentro de campos) | 3 | 3 | `csv.test.ts` cubre cada regla de DD-07; el e2e usa un CSV exportado a mano con CRLF y BOM |
| Cambia una OQ pendiente (OQ-03 `;`, OQ-04 límites) | 2 | 2 | Separador, límites y cabecera son constantes de `import-file.ts` y `csv.ts`; los tests de borde las usan |
| `request.compileValidationSchema` cambia de comportamiento al subir Fastify | 1 | 3 | Test contrato «mensajes de fila = mensajes del alta»; versión fijada (DEC-05) |
| `error-handler.ts` (transversal) rompe otros 413 | 1 | 3 | Sin `config`, el texto genérico; lo fijan `error-handler.test.ts` (existente) y `payload-too-large.test.ts` |
| Rendimiento con 500 filas (≈ 2 500 sentencias preparadas sin caché) | 2 | 2 | Medido en `performance.test.ts`; HU-06 recalcula 200 en 12-24 ms |
| La web envía el `type` del `File` en vez de `text/csv` y recibe 415 | 2 | 3 | El contrato lo exige; el TD-frontend lo fija con un test que comprueba la cabecera enviada |

## Open Decisions

No hay decisiones abiertas. DEC-13 y las aclaraciones de DEC-07, DEC-08 y DEC-11.4 están aceptadas y escritas en
`DECISIONS.md` (2026-10-12).

## Fuera de scope
- Todo lo de «Fuera de scope» del PRD (previsualización, mapeo de columnas, `;`, otras codificaciones, resumen, skills
  y consentimiento en el CSV, actualizar existentes, informe persistido, deshacer, inscribir, asincronía, plantilla,
  exportación, origen del dato).
- Caché de sentencias preparadas en el repositorio y lectura de columnas explícitas en `recalculateRetention` (deuda
  abierta del módulo).
- Lista de `Host` en `cross-site.ts` (deuda SEC-06).

_Cambio de la sesión (2026-10-12), sin vuelta del arquitecto: DT-08 del PRD v1.3 (mensaje específico para «;»), fila del contrato, EC-08 y EC-50 en Error paths. Lo decidió el responsable técnico tras aprobar el diseño._

## Notas de la review (ronda 1, 2026-10-12)

Desviaciones de lo implementado frente a este diseño, aceptadas y anotadas en los briefs (§7):

- Los tests que este documento asigna a `import.test.ts` (CA-08, CA-10, EC-49, EC-19/25, EC-20, EC-21, EC-43/46,
  EC-36 y el test de contrato) están en sus hermanos `import-rows.test.ts` e `import-contract.test.ts`, por el umbral de
  300 líneas (decisión del responsable técnico).
- La web envía el `ArrayBuffer` leído del `File` (los mismos bytes), no el `File` tal cual (DD-09 del TD-frontend).
- Este documento cita el PRD v1.1; el PRD está en v1.3 (DT-07 y DT-08, recogidos en DD-07 b y en la nota anterior).
- Las referencias `fichero:línea` del código existente son anteriores al cambio (por ejemplo, `toValidationDetails`
  está ahora en `apps/api/src/http/error-handler.ts`, y `writeUniqueEmail` e `isDuplicateEmailError` se han movido unas
  líneas). Los símbolos existen; las líneas no se actualizan en un diseño cerrado.
