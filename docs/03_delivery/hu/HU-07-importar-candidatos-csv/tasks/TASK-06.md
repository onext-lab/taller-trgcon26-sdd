# TASK-06 — Cliente de importación en la web: `postBytes`, tipos, guarda `isImportReport` y modelo puro

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-01, RF-02 parte web, RF-06 parte web)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Todo lo que la pantalla (TASK-07) necesita para hablar con la API, sin componentes. Consume el **Contrato de API**
del TD-backend tal cual (S-01 a S-06 del TD-frontend), con `fetch` simulado: no necesita la ruta real.

1. **`apps/web/src/components/http.ts`** (158 → ~185): `postBytes(path, bytes, { contentType, signal?, timeoutMs? })`
   que envía `method: 'POST'`, `headers: { 'Content-Type': contentType }` y `body: bytes` (el `ArrayBuffer` tal
   cual), reutilizando el tiempo de espera (`DEFAULT_TIMEOUT_MS`), `send` e `interpret` de `requestJson`. **No**
   cambia la firma ni el comportamiento de `requestJson` (DD-01).
2. **`apps/web/test/helpers/fetch.ts`** (83 → ~95): `RecordedCall.bytes?: Uint8Array` con el cuerpo binario (hoy solo
   guarda cuerpos `string`). Reconoce el cuerpo con `Object.prototype.toString.call(body) === '[object ArrayBuffer]'`
   o `ArrayBuffer.isView`, **no** con `instanceof` (otro *realm* en jsdom).
3. **`apps/web/src/features/candidates/types.ts`**: `ImportReason` (`'invalid' | 'duplicate' | 'repeated'`),
   `ImportRowError` (`{ field: string; message: string }`), `NotImportedRow` (`{ row; reason; errors; existingId?;
   firstRow? }`) e `ImportReport` (`{ dataRows; created; duplicates; invalid; notImported }`).
4. **`apps/web/src/features/candidates/api.ts`** (141 → ~190):
   - `isImportReport(value)`: objeto con `dataRows`, `created`, `duplicates`, `invalid` enteros seguros ≥ 0 y
     `notImported` array; cada elemento con `row` válido (`isValidId`), `reason` del *enum*, `errors` array **no
     vacío** de `{ field: string, message: string }`, `existingId` válido **obligatorio** si `duplicate` y `firstRow`
     válido **obligatorio** si `repeated`. No comprueba que `dataRows` sea la suma (eso es de la API, EC-46).
   - `importCandidates(bytes: ArrayBuffer, signal?)`: `postBytes('/api/candidates/import', bytes, { contentType:
     'text/csv', signal })` y, si la respuesta no pasa `isImportReport`, `throw badResponseError()` (EC-05).
     **Nunca** usa `file.type` (DD-09).
5. **`apps/web/src/features/candidates/import-model.ts`** (**nuevo**, puro): `EXPECTED_HEADER = 'nombre,email,telefono'`,
   `MAX_FILE_BYTES = 1_048_576`, `FILE_TOO_LARGE_MESSAGE` («El fichero ocupa más de 1 MiB. Divídelo en ficheros más
   pequeños.», mismo texto que el 413), `FILE_UNREADABLE_MESSAGE` («No se ha podido leer el fichero. Vuelve a
   elegirlo.»), `isFileTooLarge(file)` (`file.size > MAX_FILE_BYTES`), `isFileError(error)` (400 con algún
   `details[].field === 'file'` o 413), `reportSummary(report)` («3 creados, 0 duplicados, 0 filas con error.»;
   singular con 1: «1 creado, 1 duplicado, 1 fila con error.») y `columnLabel(field)` (`fila` → «Toda la fila»; el
   resto tal cual).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/components/http.ts` | modificar | `postBytes` |
| `apps/web/test/helpers/fetch.ts` | modificar | `RecordedCall.bytes` |
| `apps/web/src/features/candidates/types.ts` | modificar | Tipos del informe |
| `apps/web/src/features/candidates/api.ts` | modificar | `isImportReport`, `importCandidates` |
| `apps/web/src/features/candidates/import-model.ts` | crear | Constantes y funciones puras de la pantalla |
| `apps/web/test/components/http.bytes.test.ts` | crear | `postBytes` |
| `apps/web/test/features/candidates/import-api.test.ts` | crear | `isImportReport`, `importCandidates` |
| `apps/web/test/features/candidates/import-model.test.ts` | crear | Modelo puro |

## Implementa
- RF: RF-01 (envío único y errores en pantalla), RF-02 (comprobación de tamaño en cliente, bytes intactos), RF-06
  (forma del informe) · CA-03 (parte web), EC-03 (timeout), EC-05, EC-09/EC-12 (bytes intactos), EC-11 (bordes),
  EC-46 (`reportSummary`) · DD-01, DD-04, DD-06, DD-09 del TD-frontend
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Enfoque técnico, § Dependencias (S-01 a S-06), § Pantallas y estados
  (Guarda `isImportReport`, Textos de error), § DD-01, DD-04, DD-06, DD-09, § Estrategia de tests (`http.bytes`,
  `import-api`, `import-model`), § Checklist 1

## Dependencias
- **Depende de:** nada (solo el contrato del TD-backend, con `fetch` simulado). En el orden del ROADMAP va después de
  las tareas de API.
- **Bloquea:** TASK-07

## Criterios de done
- [ ] `npm test -w apps/web -- http.bytes import-api import-model` en verde con **3** ficheros y, como mínimo:
  - `http.bytes.test.ts`: método `POST`, `Content-Type` dado, bytes intactos en `RecordedCall.bytes`, 2xx JSON,
    envelope 400/413/500 → `ApiError` con su `message`, 5xx sin envelope → `CLIENT_NETWORK`, timeout corto →
    `CLIENT_TIMEOUT`, aborto propio relanzado.
  - `import-api.test.ts › el ejemplo del Contrato de API del TD-backend pasa isImportReport` y los casos que no
    (recuento negativo o no entero, `reason` fuera del *enum*, `errors` vacío, `duplicate` sin `existingId` válido,
    `repeated` sin `firstRow`).
  - `import-api.test.ts › envía Content-Type text/csv aunque el File tenga type vacío o application/vnd.ms-excel`
    (complementa M3 desde la web: la web nunca manda otro tipo).
  - `import-api.test.ts › envía BOM, CRLF y ; tal cual` con los bytes del fichero de Excel en español
    (`﻿nombre;email;telefono\r\n…`): la web no decodifica ni corrige nada (CA-03, EC-09, EC-12, EC-50).
  - `import-api.test.ts › 200 con otra forma → CLIENT_BAD_RESPONSE` (EC-05).
  - `import-model.test.ts`: `reportSummary` (0, 1, 3; singular), `columnLabel`, `isFileTooLarge` (1 048 576 →
    `false`, 1 048 577 → `true`), `isFileError` (400 con `file` y 413 → `true`; 400 sin `file`, 403, 500 y red →
    `false`).
- [ ] `npm test -w apps/web` en verde: `http.test.ts` (256 líneas) sin cambios.
- [ ] Ningún fichero tocado pasa de 300 líneas ni ninguna función de `src` de 50 (`npm run lint`).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/components/http.ts apps/web/test/helpers/fetch.ts apps/web/src/features/candidates/types.ts apps/web/src/features/candidates/api.ts apps/web/src/features/candidates/import-model.ts apps/web/test/components/http.bytes.test.ts apps/web/test/features/candidates/import-api.test.ts apps/web/test/features/candidates/import-model.test.ts`
      sin errores.
- [ ] Commit único `feat(web): CSV import client, report guard and model [HU-07 TASK-06]` con los 8 ficheros.

## Notas de implementación
- La web **no valida el CSV** (RN-15): ni extensión, ni tipo MIME, ni cabecera, ni `;`. El mensaje de DT-08 lo da la
  API y la web lo pinta tal cual (`userMessage`); **no** lo copies como constante en la web.
- `FILE_TOO_LARGE_MESSAGE` es el único texto de la API que la web repite, solo para la comprobación previa por
  `File.size` (DT-06, experiencia).
- Sin dependencias nuevas (DEC-05).
- Datos inventados en los tests (`@example.com`, `+34 600 000 0xx`).
