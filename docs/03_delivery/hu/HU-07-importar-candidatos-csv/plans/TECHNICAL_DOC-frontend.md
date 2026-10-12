# HU-07 — Importar candidatos desde un CSV — Diseño técnico (frontend)

- **Origen:** `specs/PRD.md` (estado Ready, v1.1, 2026-10-12; DT-01 a DT-06 cerradas; OQ-01 a OQ-05 con la
  recomendación aplicada, pendientes de ratificar, sin bloquear el diseño)
- **Generado por:** frontend-architect
- **Scope cubierto:** RF-01 (entero), la parte web de RF-02 y RF-06 (mostrar los errores del fichero y el informe),
  RF-07 (e2e) y RNF-03 y RNF-07. RF-03, RF-04 y RF-05 son solo backend: la web pinta lo que devuelven.

## Enfoque técnico

Pantalla nueva `/candidates/import` en la feature `candidates`, con el patrón del repo: un contenedor
(`CandidateImportScreen`) que pinta el estado de un hook de acciones (`use-import-actions.ts`), dos presentacionales
(formulario e informe) y un cliente tipado con guarda `isImportReport` en `api.ts`. Sin librerías nuevas.

- **Transporte (DD-01 del TD-backend; DD-09 aquí):** la web lee los bytes del fichero (`File.arrayBuffer()`) y los
  envía **tal cual** en el cuerpo de un `POST /api/candidates/import` con `Content-Type: text/csv` fijado a mano (nunca
  el `type` del `File`, que daría 415). Así el 1 MiB de DT-06 se mide sobre los bytes exactos (BOM incluido) y la API
  valida la codificación sobre los bytes reales. `http.ts` gana una función `postBytes` que reutiliza el tiempo de
  espera y la interpretación del envelope de `requestJson`.
- **Leer antes de enviar:** si el navegador no puede leer el fichero (borrado o cambiado tras elegirlo, EC-13), el
  error sale en pantalla **sin petición**. Antes de leer, la web compara `File.size` con 1 048 576 (DT-06, solo
  experiencia): por encima, el texto de DT-03 sin petición.
- **Estado solo en memoria del componente:** el `File`, los bytes y el informe nunca van a la URL, al título, a
  `history.state` ni al almacenamiento (RNF-03). Recargar o volver atrás deja la pantalla en el estado inicial.
- **La web no valida el CSV:** ni extensión, ni cabecera, ni filas (RN-15, anti-patrón 5 de `QUALITY-GATES.md` §4).
  Muestra tal cual el `message` de la API (también en 400 y 413, que ya traen el texto de DT-03) y los motivos del
  informe.

**Alternativa principal descartada:** `FormData` con `multipart/form-data` (descartada también por DD-01 del
TD-backend): exige `@fastify/multipart` (DEC-05) y el *boundary* cuenta en el `bodyLimit` (un fichero de 1 048 576
bytes daría 413, CA-14 fallaría, DT-06). Enviar el texto en JSON también se descarta: `File.text()` sustituye los bytes
no UTF-8 por U+FFFD y la API ya no podría detectar el Latin-1 de CA-12.

## Dependencias

**Contrato consumido tal cual:** `plans/TECHNICAL_DOC-backend.md`, sección «Contrato de API» (`POST
/api/candidates/import`), DD-01 (transporte), DD-02 (413 con el texto de DT-03) y DD-08 (forma del informe) del
backend. Si cambia, solo cambian `types.ts`, `api.ts` (`isImportReport`, `importCandidates`) e `import-model.ts`.

| ID | Contrato del backend que usa la web | Fuente (TD-backend) |
|---|---|---|
| S-01 | `POST /api/candidates/import`, sin query ni params; cuerpo = bytes del fichero tal cual, ≤ 1 048 576 (BOM incluido); `Content-Type: text/csv` **fijado a mano**, nunca el `type` del `File` (puede venir vacío o `application/vnd.ms-excel` → 415). Sin cuerpo o con otro tipo → 415 | «Contrato de API», DD-01, DD-10 |
| S-02 | 200 con el informe (también con 0 creados), `additionalProperties: false`: `{ dataRows, created, duplicates, invalid, notImported }`. Enteros ≥ 0, `dataRows = created + duplicates + invalid` (INV-03), `duplicates` incluye `duplicate` y `repeated`. `notImported[]` ordenada por `row`, sin las creadas: `{ row, reason: 'invalid' \| 'duplicate' \| 'repeated', errors: [{ field, message }], existingId?, firstRow? }`; `existingId` solo en `duplicate`, `firstRow` solo en `repeated` | DD-08 |
| S-03 | `field` con los **nombres de columna del CSV**: `nombre`, `email`, `telefono` y `fila` (fila entera, único elemento, «Número de columnas incorrecto.»), en ese orden. Motivos: en `invalid`, los `message` del alta; en `duplicate`, «Duplicado.»; en `repeated`, «Repetido en el fichero (fila N).», con N = `firstRow`. Nunca el valor recibido | DD-08 |
| S-04 | 400 `VALIDATION_ERROR` (codificación, formato con « Revisa la línea N.», sin candidatos, cabecera, más de 500 filas): `message` = texto de DT-03 y `details: [{ field: 'file', message }]` con el mismo texto | «Contrato de API» |
| S-05 | 413 `PAYLOAD_TOO_LARGE`: `message` = «El fichero ocupa más de 1 MiB. Divídelo en ficheros más pequeños.» (DT-03), sin `details` | DD-02 |
| S-06 | 403 `CROSS_SITE_REQUEST`, 415 `UNSUPPORTED_MEDIA_TYPE` y 500 `INTERNAL_ERROR` («Error interno. Inténtalo de nuevo.») en el envelope | «Contrato de API», DEC-12 |

La web **pinta siempre `error.message`** en 400 y 413 (S-04, S-05) y los `message` del informe tal cual: no compone
textos propios a partir de `reason`, `firstRow` ni `field` (salvo «Toda la fila» para `fila`, DD-06).

- **Orden en el plan:** las tareas web de cliente y pantalla solo dependen del contrato (con `fetch` simulado); el e2e
  va **después** de la ruta de la API.

## Módulos y ficheros afectados

| Módulo | Fichero | Cambio |
|---|---|---|
| transversal | `apps/web/src/components/http.ts` (158 líneas) | modificar: `postBytes(path, bytes, { contentType, signal?, timeoutMs? })` con el mismo tiempo de espera, `send` e `interpret` que `requestJson` (≈ +25) (DD-01) |
| transversal | `apps/web/src/components/StatusMessages.tsx` | modificar: `ErrorMessage` acepta `id?` y `ref?` (como `Notice`), para dar el foco al error (DT-04) y enlazarlo con `aria-describedby` |
| candidatos (`candidates`) | `apps/web/src/features/candidates/types.ts` | modificar: `ImportReason` (`'invalid' \| 'duplicate' \| 'repeated'`), `ImportRowError` (`{ field, message }`), `NotImportedRow` (`{ row, reason, errors, existingId?, firstRow? }`) e `ImportReport` (`{ dataRows, created, duplicates, invalid, notImported }`) (S-02, S-03) |
| candidatos | `apps/web/src/features/candidates/api.ts` (141) | modificar: `isImportReport` (ver «Pantallas y estados», guarda) e `importCandidates(bytes, signal?)`, que llama a `postBytes` con `contentType: 'text/csv'` fijo (≈ +50) |
| candidatos | `apps/web/src/features/candidates/paths.ts` | modificar: `candidatePaths.import = '/candidates/import'` |
| candidatos | `apps/web/src/features/candidates/import-model.ts` | **nuevo**, puro: `EXPECTED_HEADER`, `MAX_FILE_BYTES`, `FILE_TOO_LARGE_MESSAGE` (mismo texto que el 413, solo para la comprobación en cliente), `FILE_UNREADABLE_MESSAGE`, `isFileTooLarge`, `isFileError`, `reportSummary`, `columnLabel` (DD-04, DD-06) |
| candidatos | `apps/web/src/features/candidates/use-import-actions.ts` | **nuevo**: estado de la pantalla, envío único, lectura del fichero, foco (DD-02, DD-03) |
| candidatos | `apps/web/src/features/candidates/CandidateImportForm.tsx` | **nuevo**, presentacional: selector, ayuda con la cabecera y «Importar» |
| candidatos | `apps/web/src/features/candidates/CandidateImportReport.tsx` | **nuevo**, presentacional: h2, recuentos, tabla de filas no importadas, «Ver candidato», «Importar otro fichero», «Ir al listado» |
| candidatos | `apps/web/src/features/candidates/CandidateImportScreen.tsx` | **nuevo**, contenedor |
| candidatos | `apps/web/src/features/candidates/CandidateListScreen.tsx` | modificar: enlace «Importar CSV» junto a «Nuevo candidato» |
| transversal | `apps/web/src/App.tsx` | modificar: ruta `candidatePaths.import` en `ROUTES` **antes** de `/candidates/:id` |
| tests | `apps/web/test/helpers/fetch.ts` | modificar: `RecordedCall.bytes` con el cuerpo binario (hoy solo guarda cuerpos `string`) |
| tests | `apps/web/test/components/http.bytes.test.ts` | **nuevo** (hermano: `http.test.ts` tiene 256 líneas) |
| tests | `apps/web/test/features/candidates/import-api.test.ts`, `import-model.test.ts` | **nuevos** |
| tests | `apps/web/test/features/candidates/import-fixtures.ts` | **nuevo**: `csvFile`, `report`, `renderImport`, `chooseFile`, `IMPORT_ROUTE` |
| tests | `apps/web/test/features/candidates/CandidateImportScreen.test.tsx`, `CandidateImportScreen.adversarial.test.tsx` | **nuevos** |
| tests | `apps/web/test/App.test.tsx` (242) · `apps/web/test/features/candidates/CandidateListScreen.test.tsx` (197) | modificar: ruta y enlace (≈ +15 cada uno) |
| e2e | `e2e/candidates-import.spec.ts` | **nuevo** (DD-08); usa `uniqueToken` y `createCandidateByApi` de `e2e/support/applications.ts` |

Sin cambios en `apps/web/src/styles.css`: se reutilizan `.visually-hidden` (línea 305), `.error-text`, `.form-field`,
`.field-help` y los estilos de tabla.

## Pantallas y estados

### Listado · `/candidates` (modificar)

`<p>` actual con «Nuevo candidato» → dos enlaces (`Link`): «Nuevo candidato» y «Importar CSV» (`candidatePaths.import`).
Nada más cambia.

### Importar candidatos · `/candidates/import` (nueva)

- **Título:** «Importar candidatos · ATS» (constante, `useDocumentTitle` y `title` en `ROUTES`). **h1:** «Importar
  candidatos». El nombre del fichero no se pinta nunca (DD-07).
- **Árbol:**

| Componente | Tipo | Props / responsabilidad |
|---|---|---|
| `CandidateImportScreen` | contenedor | `useDocumentTitle`, `useImportActions()`; elige qué pintar según `view.kind`; sin `fetch` propio |
| `useImportActions` | hook | `view`, `file`, `formKey`, `chooseFile(file \| null)`, `submit()`, `startOver()`, `refs { input, error, heading }`; guarda `inFlight` por `ref`, `useLifetimeSignal`, foco en efecto (DD-02, DD-03) |
| `CandidateImportForm` | presentacional | `{ inputRef, hasFile, busy, errorId?, onFileChange, onSubmit }`; `key={formKey}` para vaciar el selector |
| `CandidateImportReport` | presentacional | `{ report, headingRef, onStartOver, onGoToList }` |
| `ErrorMessage` (compartido) | presentacional | `{ message, id, ref }`, sin «Reintentar»: reintentar es pulsar «Importar» (el fichero sigue elegido) |
| `LoadingMessage` (compartido) | presentacional | «Importando…» |

- **Estados** (`view.kind`; INV-07):

| Estado | Qué se ve | Controles | Anuncio / foco |
|---|---|---|---|
| `ready` sin fichero (inicial; es el «vacío») | h1; formulario con ayuda y cabecera | selector activo; «Importar» **deshabilitado** (EC-02) | — |
| `ready` con fichero | igual | «Importar» activo | — |
| `importing` (el «cargando») | formulario + «Importando…» | selector y «Importar» **deshabilitados** (EC-04) | `role="status"` «Importando…» |
| `error` | formulario (el fichero **sigue elegido**, DT-04) + mensaje | selector y «Importar» activos | `role="alert"`; foco al mensaje (DT-04). Si es error del fichero, el selector lleva `aria-invalid` y `aria-describedby` al mensaje |
| `report` (el «con datos») | sin formulario; sección del informe | «Ver candidato» por duplicado, «Importar otro fichero», «Ir al listado» | recuentos en `role="status"`; foco al h2 «Resultado de la importación» (DT-04) |

  Elegir otro fichero en `error` vuelve a `ready`. «Importar otro fichero» → `ready` sin fichero (`formKey + 1`) y foco
  al selector. Desmontar la pantalla aborta la petición en curso (`useLifetimeSignal`).

- **Formulario** (`<form noValidate>` con un solo campo):

| Control | Rol · nombre accesible | Atributos | Reglas en cliente |
|---|---|---|---|
| Selector | `<input type="file">` · `label` «Fichero CSV» | `id="candidate-import-file"`, `accept=".csv"`, `aria-describedby="candidate-import-help"` (+ `candidate-import-error` si el error es del fichero) | Sin fichero, «Importar» deshabilitado. `File.size` > 1 048 576 → error de DT-03 sin petición. **No** se mira extensión ni tipo MIME (RN-15) |
| Ayuda | `<p id="candidate-import-help">` | — | «La primera línea debe ser exactamente esta cabecera: `nombre,email,telefono` (en `<code>`). CSV en UTF-8 separado por comas; el teléfono puede ir vacío. Como máximo, 500 candidatos y 1 MiB.» |
| «Importar» | `button` (`type="submit"`) «Importar» | `disabled` sin fichero o en `importing` | El nombre no cambia mientras importa (tests estables); el anuncio lo da el `status` |

- **Informe** (`<section aria-labelledby="candidate-import-result">`):

| Elemento | Detalle |
|---|---|
| h2 | «Resultado de la importación», `tabIndex={-1}` para el foco |
| Recuentos | `<p role="status">` con `reportSummary`: «3 creados, 0 duplicados, 0 filas con error.»; singular con 1 («1 creado, 1 duplicado, 1 fila con error.») (DD-06) |
| Vacío de la lista | `notImported: []` → «Se han importado todas las filas.» (sin tabla) |
| Tabla | `<table>` con `<caption>` «Filas no importadas»; columnas `th scope="col"` «Fila», «Columna», «Motivo». **Una fila de tabla por elemento de `errors`** de cada `notImported[]`, en el orden recibido (una fila del CSV con 3 errores = 3 filas de tabla, cada una con su `row`; EC-43); sin paginar ni truncar (hasta 500 filas). «Columna»: `columnLabel(field)` → el `field` tal cual (`nombre`, `email`, `telefono`, que ya son las columnas del CSV) y «Toda la fila» para `fila`. «Motivo»: el `message` tal cual («Duplicado.», «Repetido en el fichero (fila 2).», que el backend compone con `firstRow`, o el del alta) |
| «Ver candidato» | Solo en `reason === 'duplicate'` con su `existingId`. `<a href={candidatePaths.detail(id)} target="_blank" rel="noopener noreferrer">Ver candidato<span className="visually-hidden"> (se abre en una pestaña nueva)</span></a>` dentro de la celda «Motivo»: nombre accesible «Ver candidato (se abre en una pestaña nueva)» (CA-18). `<a>` nativo, no `Link`. No carga ni muestra nada del existente (EC-33) |
| Acciones | `button` «Importar otro fichero» → `startOver`; `Link` «Ir al listado» → `/candidates`, que antes guarda `INITIAL_LIST_QUERY` en `list-state.ts` (DD-05) |

- **Textos de error** (la web pinta el `message` de la API; solo dos textos son propios, del cliente):

| Origen | Texto mostrado |
|---|---|
| `File.size` > 1 048 576 (cliente, sin petición) | `FILE_TOO_LARGE_MESSAGE` = «El fichero ocupa más de 1 MiB. Divídelo en ficheros más pequeños.» (DT-03, mismo texto que el 413 de S-05) |
| `file.arrayBuffer()` rechaza (cliente, EC-13) | `FILE_UNREADABLE_MESSAGE` = «No se ha podido leer el fichero. Vuelve a elegirlo.» (DD-04) |
| 400 del fichero (S-04), 413 (S-05), 403, 415 y 500 (S-06) | `error.message` del envelope tal cual (`userMessage`). `isFileError` (400 con `details[].field === 'file'` o 413) solo decide `aria-invalid` y `aria-describedby` en el selector |
| Red caída, 5xx sin envelope, timeout de 10 s | `CONNECTION_MESSAGE` de `http.ts` |
| 2xx que no es JSON o no pasa `isImportReport` (EC-05) | `BAD_RESPONSE_MESSAGE` de `http.ts`; no se pinta ningún informe |

- **Guarda `isImportReport`** (`api.ts`, S-02): objeto con `dataRows`, `created`, `duplicates` e `invalid` enteros
  seguros ≥ 0 y `notImported` array; cada elemento con `row` ID válido (`isValidId`), `reason` del *enum*, `errors`
  array no vacío de `{ field: string, message: string }`, `existingId` válido **obligatorio** si `reason ===
  'duplicate'` y `firstRow` válido **obligatorio** si `reason === 'repeated'`. Si falla algo → `badResponseError()`
  (EC-05). No comprueba INV-03 (`dataRows` = suma): eso es de la API (EC-46).
- **Teclado y lector:** orden de tabulación selector → «Importar»; en el informe, enlaces «Ver candidato» en orden de
  fila → «Importar otro fichero» → «Ir al listado». Sin diálogos (no hay trampa de foco). Foco visible con los estilos
  existentes. Contraste: solo clases existentes.

## Migración de datos

N/A — sin cambios de esquema ni de seed (PRD «Modelo de datos»). La web no persiste nada; el e2e escribe en
`data/e2e.db`, que `playwright.config.ts` regenera en cada ejecución.

## Diagrama de secuencia

**Flujo 1 y 2 del PRD (CA-02, CA-04, CA-18)**

```mermaid
sequenceDiagram
  participant R as Reclutador
  participant W as Web (CandidateImportScreen)
  participant A as API
  participant D as SQLite
  R->>W: /candidates → «Importar CSV»
  W-->>R: h1 «Importar candidatos», cabecera esperada, «Importar» deshabilitado
  R->>W: elige candidatos.csv
  W-->>R: «Importar» activo
  R->>W: «Importar»
  W->>W: inFlight = true · File.size ≤ 1 048 576 · view = importing («Importando…», role=status)
  W->>W: bytes = await file.arrayBuffer()
  W->>A: POST /api/candidates/import (Content-Type: text/csv, bytes tal cual)
  A->>D: validar fichero y filas · deduplicar · BEGIN IMMEDIATE · INSERT + retención · COMMIT
  A-->>W: 200 { dataRows, created, duplicates, invalid, notImported }
  W->>W: isImportReport → view = report · foco al h2
  W-->>R: «2 creados, 1 duplicado, 1 fila con error.» (role=status) + tabla
  R->>W: «Ver candidato (se abre en una pestaña nueva)»
  W-->>R: pestaña nueva /candidates/:existingId; el informe sigue en esta
  R->>W: «Ir al listado»
  W-->>R: /candidates sin filtros, con los creados primero
```

**Flujos 3 y 4 del PRD (CA-11 a CA-16, EC-13)**

```mermaid
sequenceDiagram
  participant R as Reclutador
  participant W as Web
  participant A as API
  R->>W: «Importar» con un fichero de 1 048 577 bytes
  W-->>R: alert «El fichero ocupa más de 1 MiB…» (sin petición) · foco al mensaje
  R->>W: «Importar» con un fichero borrado del disco
  W->>W: file.arrayBuffer() rechaza
  W-->>R: alert «No se ha podido leer el fichero…» (sin petición)
  R->>W: «Importar» con cabecera nombre;email;telefono
  W->>A: POST /api/candidates/import
  A-->>W: 400 VALIDATION_ERROR message (= details[0].message, field 'file')
  W-->>R: alert con error.message (cabecera esperada) · el fichero sigue elegido
  R->>W: «Importar» con la API caída
  W->>A: POST /api/candidates/import
  A--xW: sin respuesta (o 500 INTERNAL_ERROR)
  W-->>R: alert genérico · «Importar» activo para reintentar
```

## Error paths

Los EC solo de backend se citan con «Ver TD-backend»; la web pinta lo que devuelva la API. Ficheros de test: `Screen` =
`apps/web/test/features/candidates/CandidateImportScreen.test.tsx`, `Adv` = `…/CandidateImportScreen.adversarial.test.tsx`,
`Api` = `…/import-api.test.ts`, `Model` = `…/import-model.test.ts`, `e2e` = `e2e/candidates-import.spec.ts`.

| Edge case (PRD) | Dónde se detecta | Estrategia | Respuesta o efecto observable | Test |
|---|---|---|---|---|
| EC-01 `foto.png` / `.txt` válido | Nada en la web (RN-15) | Enviar siempre los bytes con `text/csv`, sin mirar extensión ni MIME | PNG → alert con el `message` del 400; `.txt` → informe | `Adv` |
| EC-02 «Importar» sin fichero | `CandidateImportForm` y `submit` | `disabled` sin fichero + guarda en `submit` | 0 peticiones | `Screen` |
| EC-03 API caída o 10 s | `postBytes` (`CLIENT_NETWORK` / `CLIENT_TIMEOUT`) | `view = error` | alert `CONNECTION_MESSAGE`; fichero elegido; «Importar» activo | `Screen` (red), `http.bytes.test.ts` (timeout) |
| EC-04 doble clic | `useImportActions` | `inFlight` por `ref` + `disabled` | 1 `POST` | `Adv` |
| EC-05 200 con otra forma | `isImportReport` en `importCandidates` | `badResponseError()` | alert `BAD_RESPONSE_MESSAGE`; sin h2 de informe | `Api`, `Adv` |
| EC-06 nombre de fichero con datos; otra web | Pantalla; API (DEC-12) | El nombre no se pinta ni va a título, URL, `history.state` ni almacenamiento; 403 → su `message` | Título fijo; 403 en alert | `Adv`; 403: Ver TD-backend |
| EC-07 «Importar otro fichero» + mismo fichero | `startOver` | Nueva petición, sin caché | Segundo `POST`; informe «0 creados, 3 duplicados…» | `Screen` |
| EC-08 cabecera con `;` | API | Ver TD-backend. Web: `error.message` (S-04) | alert con `nombre,email,telefono` | `Screen` (CA-11), `e2e` T2 |
| EC-09 Latin-1, PNG, comillas sin cerrar | API | Ver TD-backend. Web: envía los bytes sin decodificar | alert «Formato CSV inválido… Revisa la línea 4.» | `Screen` (CA-12); bytes intactos en `Api` |
| EC-10 variantes de cabecera | API | Ver TD-backend | — | API |
| EC-11 500/501 filas; 1 048 576 / 1 048 577 bytes | Cliente (`isFileTooLarge`) y API | > 1 048 576 → error sin petición; = 1 048 576 → se envía; 413 de la API → su `message` (S-05) | Texto de DT-03 | `Adv` (los dos bordes), `Model`; filas: Ver TD-backend |
| EC-12 0 bytes, solo BOM, solo cabecera, CRLF | API | Ver TD-backend. Web: no rechaza 0 bytes; envía el BOM | alert «El fichero no tiene candidatos.» | `Screen` (CA-13); BOM y CRLF intactos en `Api` (CA-03) |
| EC-13 fichero ilegible | `file.arrayBuffer()` en `useImportActions` | Capturar antes de enviar | alert `FILE_UNREADABLE_MESSAGE`; 0 peticiones | `Adv` |
| EC-14 | — | N/A — función pura de la API | — | — |
| EC-15 exportación cortada | API | Ver TD-backend | alert con la línea | API |
| EC-16 50 MiB; cabecera con email real | Cliente y API | Cliente: rechazo por `File.size` sin leer ni enviar (no carga 50 MiB en memoria); API: 413 para clientes que no son la web | Texto de DT-03, sin nada del fichero | `Adv` (1 048 577 bytes); API |
| EC-17 mismo inválido dos veces | Pantalla | Sin caché ni memoria del error | Mismo alert, 2 `POST` | `Adv` |
| EC-18 a EC-25 | API | Ver TD-backend (validación de fila, numeración, DT-02) | La web pinta fila, columna y motivo tal cual | API; render: `Screen` (CA-08, CA-10) |
| EC-26 HTML, fórmula, «+» | API (guarda) y web (pinta) | Todo texto de la API como texto JSX; sin `dangerouslySetInnerHTML` | `message` con `<img onerror>` → texto literal, 0 `img` | `Adv` |
| EC-27 | API | Ver TD-backend | — | API |
| EC-28 a EC-32 | API | Ver TD-backend (normalización, repetidos, fallo de lectura, concurrencia, legacy) | Render de «Duplicado.» (`reason: 'duplicate'`) y «Repetido en el fichero (fila 2).» (`reason: 'repeated'`, `firstRow: 2`) | API; render: `Screen` (CA-04, CA-07) |
| EC-33 email de un existente | `CandidateImportReport` | Solo `reason: 'duplicate'` + `existingId` → enlace; no se pide la ficha | 1 sola petición (`POST`); 0 `GET /api/candidates/:id` | `Adv`, `e2e` T1 |
| EC-34 reimportar | API | Ver TD-backend | Informe «0 creados» | `Screen` (EC-07) |
| EC-35 | — | N/A — RF-05 recibe filas ya validadas | — | — |
| EC-36 a EC-41 | API | Ver TD-backend (transacción, retención, reintento) | 500 → alert, fichero elegido, reintento | API; web: `Screen` (CA-15) |
| EC-42 | — | N/A — el informe lo construye el servidor | — | — |
| EC-43 500 filas; fila con 3 errores | `CandidateImportReport` | Sin paginar ni truncar; una fila de tabla por elemento de `errors` | 500 filas de tabla; 3 filas con la fila 5 (`nombre`, `email`, `telefono`) | `Adv` |
| EC-44, EC-45 | — | N/A (PRD) | — | — |
| EC-46 recuentos mezclados | API (INV-03) | La web no recalcula ni comprueba `dataRows`: pinta `created`, `duplicates`, `invalid` | Recuentos tal cual | API; `Model` (`reportSummary`) |
| EC-47 informe con datos de «Lucía Ferrer Prat» | Pantalla | Estado solo en memoria | URL `/candidates/import`, título fijo, `history.state` `null`, `localStorage` y `sessionStorage` vacíos | `Adv`, `e2e` T1 |
| EC-48 «Importar otro fichero»; «Atrás» | Pantalla | `startOver` vacía todo; no hay entradas de historial nuevas | Estado inicial; volver no reenvía | `Adv` |

## Threat modeling

DEC-04: sin login, rol único. Superficie nueva: un selector de fichero y una escritura masiva.

| STRIDE | Amenaza concreta | Mitigación |
|---|---|---|
| Suplantación | Otra web lanza la importación desde el navegador del reclutador | DEC-12 (403 `CROSS_SITE_REQUEST`); `text/csv` no es un tipo «simple» de CORS (exige *preflight*); la web va por el proxy `same-origin` |
| Manipulación | Doble clic o reenvío al volver atrás crean dos veces | `inFlight` + `disabled` (EC-04); sin entradas de historial ni estado persistido (EC-48); la API deduplica por índice único (CA-05) |
| Repudio | Qué filas entraron | El informe solo vive en pantalla por decisión (RN-12); no hay registro, como el resto del ATS |
| Exposición de datos | El nombre del fichero o el informe acaban en título, URL, historial o almacenamiento; el informe enseña datos del existente | Estado solo en el componente (DD-07); «Ver candidato» solo con el ID y sin cargar la ficha (EC-33); la web no pinta `file.name` |
| Exposición de datos (XSS) | Motivos de la API o la ficha con `<script>` | Texto JSX; la ficha ya pinta nombres como texto (HU-03); `rel="noopener noreferrer"` evita `window.opener` y el *referrer* en la pestaña nueva |
| Denegación de servicio | Fichero enorme que el navegador lee entero | `File.size` antes de `arrayBuffer()` (EC-16); la API tiene su propio límite (413) |
| Elevación de privilegios | El CSV fija consentimiento o retención | No hay columnas; la API rechaza la cabecera (EC-40). La web no añade campos |

## Datos personales

- **Entran:** el fichero del reclutador (nombres, emails y teléfonos). La web lo tiene en memoria como `File` y como
  `ArrayBuffer` solo durante el envío; el `ArrayBuffer` es una variable local de `submit` y no se guarda en el estado.
- **Se envían:** los bytes tal cual a `POST /api/candidates/import` (mismo origen, proxy de Vite).
- **Se muestran:** recuentos, número de fila, columna, motivo y, en duplicados, un enlace con el ID (RNF-04). Ningún
  valor del fichero ni dato del existente. El nombre del fichero no se pinta (puede contener un nombre, EC-06).
- **Nunca:** en la URL (la ruta no lleva nada), `document.title` (constante), `history.state` (la pantalla no navega
  con `notice`), `localStorage` ni `sessionStorage`. La web no registra nada en consola.
- **Retención:** la del alta (alta + 6 meses, sin consentimiento), la decide la API; la web no la muestra en el
  informe.
- **Tests y e2e:** datos inventados (`@example.com`, teléfonos `+34 600 000 0xx`, RGPD §6.3). El e2e genera los CSV
  en memoria con un *token* único (`setInputFiles` con `buffer`), sin ficheros en disco (DD-08).

## Decisiones de diseño

### DD-01: `postBytes` en `http.ts` con el `ArrayBuffer` del fichero
- **Contexto:** `requestJson` solo envía JSON; el fichero tiene que llegar con sus bytes exactos (DT-06, CA-03, CA-12).
- **Opciones consideradas:** A) `postBytes(path, bytes, { contentType, signal?, timeoutMs? })` que comparte señal,
  `send` e `interpret` con `requestJson`; B) añadir `rawBody` a `RequestOptions`; C) `fetch` directo en `api.ts`.
- **Elegida:** A, con `contentType: 'text/csv'` desde `importCandidates`.
- **Razón:** A no cambia la firma ni el comportamiento de `requestJson` (sus 256 líneas de tests no se tocan); C
  duplicaría el envelope, el tiempo de espera y la traducción de errores.
- **Tradeoff:** dos puntos de entrada en `http.ts`; el tiempo de espera de 10 s vale para importar (RNF-01 < 500 ms),
  pero no se ajusta por fichero.

### DD-02: Hook `use-import-actions.ts` con una unión discriminada de estados
- **Contexto:** RF-01 exige cuatro estados explícitos (INV-07) y un solo envío; la convención pide un hook
  `use-*-actions` por pantalla con escrituras.
- **Opciones consideradas:** A) `view: ready | importing | error | report` en un `useState`; B) varios booleanos
  (`busy`, `error`, `report`); C) `useResource`.
- **Elegida:** A.
- **Razón:** A hace imposibles combinaciones como «error e informe a la vez»; C es para lecturas al montar, no para un
  envío a demanda.
- **Tradeoff:** el `File` vive fuera de la unión (se conserva entre `error` y `ready`), así que hay dos estados que
  mantener coherentes (`startOver` limpia los dos).

### DD-03: Selector no controlado, vaciado con `key`, y foco por `ref` en efecto
- **Contexto:** React no puede fijar el `value` de un `input type="file"`; DT-04 pide conservar el fichero tras un
  error, y el foco al error o al h2.
- **Opciones consideradas:** A) input no controlado; el `File` se copia al estado en `onChange`; `key={formKey}` lo
  vacía en «Importar otro fichero»; foco por `ref` en un `useEffect` sobre `view.kind`; B) `form.reset()` y foco con
  `document.querySelector`.
- **Elegida:** A.
- **Razón:** mantener montado el formulario en `error` conserva la `FileList` del navegador sin código; el foco por
  `ref` sigue `use-consent-focus.ts`.
- **Tradeoff:** el foco cambia en un efecto pasivo: los tests usan `expectFocusOn` (`QUALITY-GATES.md` §4.12).

### DD-04: Leer el fichero antes de enviar y comprobar `File.size`
- **Contexto:** EC-13 pide el error sin petición; DT-06, la comprobación de tamaño en la web.
- **Opciones consideradas:** A) `isFileTooLarge(file)` → `await file.arrayBuffer()` → `postBytes`; B) pasar el `File`
  como cuerpo de `fetch` (el navegador lo lee al enviar).
- **Elegida:** A. Texto nuevo para EC-13: «No se ha podido leer el fichero. Vuelve a elegirlo.»
- **Razón:** con B un fichero ilegible es un `TypeError` de `fetch`, indistinguible de la red caída (`CLIENT_NETWORK`),
  y el reclutador leería «No se ha podido conectar con el servidor».
- **Tradeoff:** el fichero (≤ 1 MiB) está dos veces en memoria durante el envío.

### DD-05: «Ir al listado» abre el listado sin filtros
- **Contexto:** CA-02: «Ir al listado» muestra a los creados. `list-state.ts` restaura la última búsqueda, que puede
  ocultarlos.
- **Opciones consideradas:** A) guardar `INITIAL_LIST_QUERY` antes de navegar; B) restaurar la búsqueda anterior.
- **Elegida:** A.
- **Razón:** el listado ordena por alta descendente: sin filtros, los creados salen en la primera página.
- **Tradeoff:** se pierde la búsqueda anterior al volver por este enlace (la de «Candidatos» del menú la conserva).

### DD-06: Recuentos con singular y una fila de tabla por error
- **Contexto:** RF-06 pide recuentos y la lista sin repetir valores; EC-43, una fila con 3 errores con los 3.
- **Opciones consideradas:** A) «N creados, M duplicados, K filas con error.» con singular para 1, y tabla plana
  (fila, columna, motivo) con una fila por error; B) una fila de tabla por fila del CSV con una lista de errores
  dentro; C) `rowSpan`.
- **Elegida:** A.
- **Razón:** cada fila de la tabla se entiende sola con lector de pantalla; B y C complican la lectura por celdas.
- **Tradeoff:** el número de fila se repite en las filas con varios errores.

### DD-07: El nombre del fichero no se pinta
- **Contexto:** EC-06 (`candidatos_lucia_ferrer.csv`); el selector nativo ya enseña el nombre.
- **Opciones consideradas:** A) no pintarlo nunca; B) «Fichero elegido: …» junto al selector.
- **Elegida:** A.
- **Razón:** minimización (RGPD §6.2); el control nativo basta para saber qué se eligió.
- **Tradeoff:** en el informe no se ve de qué fichero era.

### DD-08: e2e con CSV generados en memoria
- **Contexto:** RF-07 pide CSV inventados; la base de e2e es compartida por todos los specs y cada test necesita
  emails únicos.
- **Opciones consideradas:** A) `setInputFiles({ name, mimeType: 'text/csv', buffer })` con un *token* único;
  B) ficheros fijos en `e2e/fixtures/`.
- **Elegida:** A.
- **Razón:** con B el segundo test que importara el mismo fichero vería duplicados y dependería del orden; A no deja
  ficheros con datos en disco.
- **Tradeoff:** los CSV del e2e no se pueden abrir a mano; los fixtures en disco, si los hay, son del TD-backend.

### DD-09: Transporte = bytes crudos con `Content-Type: text/csv` fijado a mano (cierra la antigua OD-01)
- **Contexto:** `requestJson` solo envía JSON y DEC-11.5 da 415 a lo demás; el 1 MiB de DT-06 se mide sobre los bytes
  del fichero. Lo decide el backend: DD-01 del TD-backend.
- **Opciones consideradas:** A) bytes del fichero tal cual con `Content-Type: text/csv`; B) `multipart/form-data`
  (`@fastify/multipart`, DEC-05; el *boundary* rompe CA-14); C) JSON con el texto o base64 (pierde la detección de
  Latin-1 o infla el cuerpo un 33 %).
- **Elegida:** A, la de DD-01 del TD-backend. `importCandidates(bytes, signal)` llama a `postBytes(IMPORT_URL, bytes,
  { contentType: 'text/csv', signal })`; **nunca** usa `file.type`. El TD-backend pone de ejemplo `body: file`; la web
  envía el `ArrayBuffer` leído de ese `File` (DD-04), que son los mismos bytes.
- **Razón:** sin dependencias; el `bodyLimit` de la ruta mide exactamente el fichero (CA-14); la API valida los bytes
  reales (CA-12); `text/csv` no es un tipo «simple» de CORS y además pasa por DEC-12.
- **Tradeoff:** la web no puede reutilizar `requestJson` tal cual (DD-01) y depende de fijar la cabecera a mano: un
  `Content-Type` olvidado o tomado del `File` da 415.

## Impacto en decisiones

- **DEC-01** (envelope): se aplica; la web solo lee `code`, `message` y `details`.
- **DEC-04** (sin login) y **DEC-12** (403 entre sitios): se aplican sin cambios.
- **DEC-05** (dependencias): **ninguna nueva** (ni `@testing-library/user-event`, ni CSV en la web, ni multipart). Los
  tests eligen el fichero con `fireEvent.change(input, { target: { files: [file] } })`.
- **DEC-11.5** (415 a lo que no es JSON): la enmienda para esta ruta la **DEC-13** que propone DD-01 del TD-backend
  (cuerpo crudo `text/csv` en un plugin encapsulado). La web solo aplica su parte: `Content-Type: text/csv` a mano
  (DD-09).
- **DEC-07** y **DEC-08** (200 con informe; choque = fila «duplicado»): las aclaraciones de DT-05 son del TD-backend;
  la web solo trata 200 como informe.
- **Convenciones del repo** (`docs/ARCHITECTURE.md`): guarda `isImportReport` en `api.ts`; hook
  `use-import-actions.ts`; tests hermanos (`*.adversarial.test.tsx`, `import-fixtures.ts`). `isNotFound` no aplica:
  la pantalla no carga ningún recurso por ID.

## Estrategia de tests

**Vitest + Testing Library**, consultas por rol y `label`; `fetch` simulado con `mockFetch`
(`apps/web/test/helpers/fetch.ts`), ruta `'POST /api/candidates/import'`. Foco y título con `expectFocusOn` o `await
waitFor` (`QUALITY-GATES.md` §4.12); las aserciones negativas sobre el título esperan antes al positivo. El fichero se
elige con `fireEvent.change` sobre `getByLabelText('Fichero CSV')`. Datos inventados.

| Fichero | Qué cubre |
|---|---|
| `apps/web/test/components/http.bytes.test.ts` | `postBytes`: método `POST`, `Content-Type` dado, bytes intactos en `RecordedCall.bytes`, 2xx JSON, envelope 400/413/500, 5xx sin envelope → `CLIENT_NETWORK`, timeout → `CLIENT_TIMEOUT` (con `timeoutMs` corto), aborto propio relanzado |
| `apps/web/test/features/candidates/import-api.test.ts` | `isImportReport` (el ejemplo del «Contrato de API» del TD-backend → `true`; recuento negativo o no entero, `reason` fuera del *enum*, `errors` vacío, `duplicate` sin `existingId` válido, `repeated` sin `firstRow` → `false`); `importCandidates` envía `Content-Type: text/csv` aunque el `File` tenga `type` vacío o `application/vnd.ms-excel`, y los bytes con BOM y CRLF sin tocar (CA-03, EC-09, EC-12); 200 con otra forma → `CLIENT_BAD_RESPONSE` (EC-05) |
| `apps/web/test/features/candidates/import-model.test.ts` | `reportSummary` (0, 1, 3; singular), `columnLabel` (`fila` → «Toda la fila»; `nombre`, `email`, `telefono` tal cual), `isFileTooLarge` (1 048 576 / 1 048 577), `isFileError` (400 con `file` y 413 → `true`; 400 sin `file`, 403, 500 y red → `false`) |
| `CandidateImportScreen.test.tsx` | Criterios de aceptación con superficie web (tabla de abajo) |
| `CandidateImportScreen.adversarial.test.tsx` `[adversarial]` | EC-01, EC-04, EC-05, EC-06, EC-11, EC-13, EC-16, EC-17, EC-26, EC-33, EC-43, EC-47, EC-48 |
| `apps/web/test/App.test.tsx` | `/candidates/import` pinta «Importar candidatos» (no la ficha con ID `import`) y el título |
| `CandidateListScreen.test.tsx` | Enlace «Importar CSV» con `href="/candidates/import"` |

**Playwright · `e2e/candidates-import.spec.ts`** (API y web reales sobre `data/e2e.db`, sin IDs fijos, *web-first*):

| Test | Preparación | Pasos y aserciones |
|---|---|---|
| T1 «flujo de la demo: 2 creados, 1 duplicado y 1 fila con error» | `createCandidateByApi` (existente); CSV en memoria: cabecera, 2 filas nuevas con *token*, el email del existente en mayúsculas, `,mal@,` | Listado → «Importar CSV» → h1 → `setInputFiles` → «Importar» → «2 creados, 1 duplicado, 1 fila con error.»; fila del duplicado con enlace de nombre «Ver candidato (se abre en una pestaña nueva)», `target="_blank"`, `rel="noopener noreferrer"`, `href` `/candidates/{id}`; al activarlo, la pestaña nueva (`context.waitForEvent('page')`) muestra el h1 del existente y la original sigue con «Resultado de la importación»; RNF-03: URL, título «Importar candidatos · ATS», `history.state`, `localStorage` y `sessionStorage` (`page.evaluate` con `globalThis`, *gotcha* del tsconfig); «Ir al listado» → buscar el *token* → 2 filas |
| T2 «fichero rechazado, corregido y reimportado» | CSV con `nombre;email;telefono` y el mismo corregido | Alert con `nombre,email,telefono` y 0 informe → elegir el corregido → «1 creado…» → «Importar otro fichero» → el mismo → «0 creados, 1 duplicado, 0 filas con error.» |

**Criterio → test** (los CA solo de API, en el TD-backend):

| Criterio | Test web |
|---|---|
| CA-01 (parte web) | `Screen` «muestra 3 creados y no lista filas creadas» |
| CA-02 | `Screen` «pantalla inicial: h1, cabecera, selector con label y accept .csv, Importar deshabilitado»; «Importando… con Importar deshabilitado hasta el informe; foco al h2»; `e2e` T1 |
| CA-03 (parte web) | `Api` «envía BOM y CRLF tal cual» |
| CA-04 (parte web) | `Screen` «fila `duplicate` con «Duplicado.» y Ver candidato a `existingId`, sin datos del existente»; `e2e` T1 |
| CA-05 / EC-07 | `Screen` «Importar otro fichero y el mismo: segundo POST y 0 creados»; `e2e` T2 |
| CA-07, CA-08, CA-10 (render) | `Screen` «pinta «Repetido en el fichero (fila 2).», los errores de `nombre` y `email` de la fila 3, «Toda la fila» con «Número de columnas incorrecto.» en la 4, y la fila 7» |
| CA-09 | `Screen` «200 con 0 creados es un informe, no un error» |
| CA-11 | `Screen` «400 de cabecera: alert con nombre,email,telefono, foco al alert, fichero conservado»; `e2e` T2 |
| CA-12 | `Screen` «400 de formato con la línea 4» |
| CA-13 | `Screen` «400 sin candidatos» |
| CA-14 | `Screen` «400 de 501 filas»; «413 → su `message`, con `aria-invalid` en el selector»; `Adv` bordes de 1 048 576 / 1 048 577 |
| CA-15 | `Screen` «500: alert, fichero conservado; reintento → informe» |
| CA-16 | `Screen` «API caída: alert, fichero conservado, Importar activo» |
| CA-17 (parte web) / RNF-03 | `Adv` «nada en URL, título, history.state ni almacenamiento»; `e2e` T1 |
| CA-18 | `Screen` «nombre accesible, target y rel del enlace»; `e2e` T1 (pestaña nueva, informe intacto) |
| RNF-07 | Todos los controles se localizan por rol y nombre en `Screen`; `status` y `alert` asertados en cada cambio |
| RF-07 | `e2e` T1 y T2 |

**`[adversarial]` de los RF Must con web:** RF-01 y RF-06 → `CandidateImportScreen.adversarial.test.tsx`; RF-02 (parte
web) → los bordes de tamaño y EC-13 del mismo fichero.

**Qué se simula:** solo `fetch` y, en EC-13, `arrayBuffer` del `File` (`Object.defineProperty` que rechaza). Nada en el
e2e.

## Checklist de implementación

Cuatro tareas web (las «unas 3 + 1» de FEAT-04), en este orden; el e2e, después de la ruta de la API.

1. **Cliente y modelo** (`Capa: web`, M): `postBytes` en `http.ts` + `RecordedCall.bytes` en `test/helpers/fetch.ts`
   + tipos en `types.ts` + `isImportReport` e `importCandidates` en `api.ts` + `import-model.ts`; tests
   `http.bytes.test.ts`, `import-api.test.ts`, `import-model.test.ts`.
2. **Pantalla** (`Capa: web`, L): `ErrorMessage` con `id` y `ref`; `CandidateImportForm`, `CandidateImportReport`,
   `use-import-actions.ts`, `CandidateImportScreen`; `paths.ts`, ruta en `App.tsx`, enlace en `CandidateListScreen`;
   tests `import-fixtures.ts`, `CandidateImportScreen.test.tsx` y los de `App.test.tsx` y `CandidateListScreen.test.tsx`.
3. **`[adversarial]` web** (`Capa: web`, M): `CandidateImportScreen.adversarial.test.tsx`.
4. **e2e** (`Capa: e2e`, M): `e2e/candidates-import.spec.ts` (T1, T2). Depende de la ruta de la API.

Verificación de cada una, con salida pegada: `npm test -w apps/web`, `npm run typecheck`, `npm run lint` (y
`npm run e2e` en la 4).

## Riesgos

| Riesgo | Probabilidad (1–5) | Impacto (1–5) | Mitigación |
|---|---|---|---|
| El contrato del backend cambia durante la implementación (S-01 a S-06) | 2 | 2 | Todo el contrato está en `types.ts`, `api.ts` e `import-model.ts`; los tests de `import-api.test.ts` usan el ejemplo del «Contrato de API» del TD-backend |
| La web enviara el `type` del `File` y la API respondería 415 | 2 | 3 | `importCandidates` fija `text/csv`; test con `type` vacío y `application/vnd.ms-excel` (DD-09) |
| El `ArrayBuffer` de jsdom es de otro *realm* y `instanceof ArrayBuffer` falla en el *mock* | 2 | 2 | `fetch.ts` reconoce el cuerpo con `Object.prototype.toString.call` y `ArrayBuffer.isView`, no con `instanceof` |
| Tiempo de espera de 10 s vencido con la importación ya hecha en la API: el reclutador ve un error y al reintentar, duplicados | 1 | 2 | RNF-01 < 500 ms; reintentar es seguro (EC-41) y el informe lo explica con «Duplicado» |
| Salir de la pantalla durante la importación: la API la termina pero no se ve el informe | 2 | 2 | Aceptado: volver a importar da «Duplicado» en las que entraron (CA-05); no se reenvía solo |
| Un fichero editado en disco tras elegirlo: Chrome rechaza `arrayBuffer()` | 3 | 1 | Es EC-13: «Vuelve a elegirlo» |
| `CandidateImportScreen.test.tsx` pasa de 300 líneas tras Prettier | 3 | 1 | Ficheros hermanos ya previstos (`import-fixtures.ts`, `*.adversarial`); si hace falta, `CandidateImportScreen.errors.test.tsx` |
| Una región `role="status"` insertada no siempre se anuncia | 2 | 2 | Patrón vigente del repo (`LoadingMessage`, `Notice`), y el foco al h2 o al error (DT-04) asegura la lectura |

## Open Decisions

No hay decisiones abiertas. La antigua OD-01 (transporte del fichero) la cerró DD-01 del TD-backend con la
opción recomendada; queda como DD-09.

## Fuera de scope

- Previsualización, validación en seco, mapeo de columnas o comprobación del CSV en el navegador (PRD «Fuera de
  scope»; la web no valida contenido).
- Arrastrar y soltar el fichero, barra de progreso o importación asíncrona.
- Informe descargable, persistido o con historial; plantilla CSV descargable (la cabecera se muestra como texto).
- Mostrar el nombre del fichero (DD-07) o datos del candidato existente en el informe.
- `@testing-library/user-event` u otra dependencia de test.
