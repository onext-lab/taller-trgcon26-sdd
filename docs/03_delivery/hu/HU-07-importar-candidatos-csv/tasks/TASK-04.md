# TASK-04 — Ficheros hostiles, tipos de contenido y límites por la ruta de importación [adversarial]

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** test
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-02, RF-03; RNF-01, RNF-05)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Adversarial del fichero entero (UC-20 · E1, E2, E3) y de la superficie de la ruta, por `app.inject`, más la medida
de rendimiento de RNF-01. **Solo tests**: si alguno destapa un fallo en `apps/api/src/`, el arreglo va en esta tarea
(dentro del techo de 2 ciclos) y se nombra en el commit.

1. **`apps/api/test/candidates/import-adversarial.test.ts`** (**nuevo**): con `createTestApp`, `importCsv`,
   `csvBytes` y `excelSpanishCsv` (`apps/api/test/helpers/csv.ts`). «0 creados» = `SELECT COUNT(*) FROM candidates`
   igual antes y después.
2. **`apps/api/test/candidates/performance.test.ts`** (modificar, 108 → ~130): un test más con el patrón de los
   existentes.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/candidates/import-adversarial.test.ts` | crear | E1-E3, EC-50, tipos de contenido, 403, inyección, idempotencia |
| `apps/api/test/candidates/performance.test.ts` | modificar | RNF-01: importar 500 filas nuevas < 500 ms con 1 000 candidatos |

## Implementa
- RF: RF-02, RF-03 (seguridad e idempotencia de la fila) · RNF-01, RNF-05 · CA-11, CA-12, CA-13, CA-14 · Edge cases:
  EC-01 (PNG), EC-06 (403), EC-08, EC-09, EC-11, EC-12, EC-15, EC-16, EC-17, EC-26, EC-27, EC-40 (cabecera),
  **EC-50 (fixture de Excel en español)**
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths, § Threat modeling, § Estrategia de tests
  (`import-adversarial.test.ts`, `performance.test.ts`), § Orden de implementación 4 y 5 (reparto en «Ajustes» del
  ROADMAP) · PRD DT-08 / EC-50

## Dependencias
- **Depende de:** TASK-03
- **Bloquea:** nada

## Criterios de done
- [ ] `npm test -w apps/api -- candidates/import-adversarial candidates/performance` en verde con **2** ficheros y,
      como mínimo:
  - **`EC-50 CSV de Excel en español (;, BOM y CRLF) → 400 con el mensaje del separador y 0 creados`**: `importCsv(app,
    excelSpanishCsv())` → 400; cuerpo `{ error: { code: 'VALIDATION_ERROR', message: SEMICOLON_SEPARATOR_MESSAGE,
    details: [{ field: 'file', message: SEMICOLON_SEPARATOR_MESSAGE }] } }` (con `toEqual`); el cuerpo no contiene
    `nombre;email`, `Lucía` ni `@example.com`; recuento de candidatos igual que antes. Es la prueba de directo: usa el
    texto exacto de la constante, no un `toContain`.
  - `CA-11 cabeceras: ; → separador; otro orden y columna de más → cabecera esperada; " Nombre , EMAIL,Telefono" → 200`:
    `nombre;email;telefono` (sin BOM ni CRLF) → `SEMICOLON_SEPARATOR_MESSAGE`; `email,nombre,telefono` y
    `nombre,email,telefono,resumen` → `INVALID_HEADER_MESSAGE` (contiene `nombre,email,telefono`); los tres con 0 creados.
  - `CA-12 Latin-1, PNG y comillas desde la línea 4` → `INVALID_CSV_MESSAGE` (el tercero con « Revisa la línea 4.»).
  - `CA-13 cuatro ficheros sin candidatos` (0 bytes con `text/csv`, solo BOM, solo cabecera, cabecera + blancos).
  - **`CA-14 500 → 500 creados; 501 → 400 con el límite de filas y 0 creados; 1 048 576 → informe; 1 048 577 → 413`**
    (**tumba M2**): 501 filas válidas y nuevas → 400 `TOO_MANY_ROWS_MESSAGE` y recuento igual; 1 048 576 bytes
    (cabecera + 1 fila + relleno de `\n`) → 200; 1 048 577 → 413 `PAYLOAD_TOO_LARGE` con `FILE_TOO_LARGE_MESSAGE`.
  - `EC-16 50 MiB → 413` (por `Content-Length`, sin procesarlo).
  - **`415 con un CSV válido como cuerpo: application/json, text/plain, multipart/form-data, application/x-www-form-urlencoded, application/vnd.ms-excel, application/octet-stream y sin Content-Type`**
    (**tumba M3**, `it.each`): cada uno con los bytes de un CSV **válido** de filas nuevas → 415, `code:
    'UNSUPPORTED_MEDIA_TYPE'`, «Tipo de contenido no admitido.» y recuento igual (si la ruta aceptara el tipo,
    crearía filas o daría 400/200 en vez de 415). Control positivo: `text/csv; charset=utf-8` → 200.
  - `text/csv en POST /api/candidates sigue en 415` (la encapsulación no se escapa al resto de la API).
  - `EC-06 cross-site → 403` (`Sec-Fetch-Site: cross-site`, 0 creados).
  - `EC-17/EC-27 mismo resultado dos veces` (mismo 400 y mismo `notImported` en dos importaciones).
  - `EC-26 <script>, =HYPERLINK y +34… guardados tal cual` (sin valores en el informe).
  - `EC-40 columna consentimiento → cabecera`.
  - `performance.test.ts › RNF-01 importar 500 filas nuevas < 500 ms con 1 000 candidatos`.
- [ ] `npm test -w apps/api` en verde (toda la API).
- [ ] `import-adversarial.test.ts` ≤ 300 líneas y `performance.test.ts` ≤ 300 tras Prettier.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/candidates/import-adversarial.test.ts apps/api/test/candidates/performance.test.ts`
      sin errores.
- [ ] Commit único `test(api): adversarial import files, media types and limits [HU-07 TASK-04]` con los ficheros.

## Notas de implementación
- **Mutación M2** (quitar la guarda de 500 filas de `readImportFile`): la tumba `CA-14 …` (aquí, por la ruta) y
  `import-file.test.ts › 500 y 500 + 30 blancos pasan; 501 no` (TASK-02). Sin la guarda, `parseCsv` guarda 502
  registros y se crearían 501.
- **Mutación M3** (aceptar un `Content-Type` distinto de `text/csv` en la ruta: un parser `*`, no quitar los
  heredados, registrar `application/octet-stream`/`application/vnd.ms-excel`, o quitar la comprobación de
  `Buffer.isBuffer`): la tumba el `it.each` de 415. El cuerpo de cada caso es un CSV **válido** para que aceptar el
  tipo se note (200 con filas creadas o 400 de JSON en vez de 415). `application/vnd.ms-excel` es el `type` que da
  Windows a un `.csv`: es la mutación más probable si alguien «arregla» un 415 desde la web.
- Aplica M2 y M3 a mano, ver el rojo y deshacerlas, sin commitearlas.
- En `sin Content-Type`, comprueba con el primer rojo que `inject` no añade una cabecera por su cuenta; si la añade,
  bórrala de forma explícita en el test.
- El 50 MiB se hace con `Content-Length` grande y un cuerpo corto o con un `Buffer.alloc` reutilizado: no ocupes
  memoria de más en la suite.
- RNF-01: prepara 1 000 candidatos por SQL directo antes de medir (no por la API) y mide solo el `inject` de la
  importación; un calentamiento previo con otro fichero para no medir la primera compilación del esquema.
- Datos inventados (`@example.com`, `+34 600 000 0xx`).
