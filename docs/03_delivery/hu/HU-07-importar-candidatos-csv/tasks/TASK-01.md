# TASK-01 — Decodificador UTF-8 y *parser* CSV puro con número de línea física (`csv.ts`) [setup]

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-02, RF-03)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Base de toda la importación: dos funciones **puras** en el módulo `candidates`, sin Fastify, sin base y sin
dependencias nuevas (DEC-05, DD-06). Nada las usa todavía: las conecta TASK-02.

`apps/api/src/modules/candidates/csv.ts` (**nuevo**, ~120 líneas, ninguna función de más de 50):

```ts
export interface CsvRecord { line: number; fields: string[] }
export type CsvParseResult =
  | { ok: true; records: CsvRecord[]; recordCount: number } // records: los primeros `maxKept`; recordCount: todos
  | { ok: false; line: number };                            // error de formato y la línea donde se detecta
export function decodeUtf8(bytes: Uint8Array): string | null; // null si no es UTF-8; quita el BOM inicial
export function parseCsv(text: string, maxKept: number): CsvParseResult;
```

1. **`decodeUtf8`**: `new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })` dentro de `try/catch`; cualquier
   excepción → `null` (Latin-1 con `0xF1`, firma PNG). El BOM inicial (U+FEFF) se quita (con `ignoreBOM: false` lo
   quita el propio decodificador; compruébalo en el test).
2. **`parseCsv`**: un solo recorrido O(n) carácter a carácter, RFC 4180 con separador `,` y comillas dobles:
   - Fin de línea: `\n` o `\r\n`. Un `\r` suelto **no** es fin de línea: se queda en el campo (lo rechazará el
     `pattern` de controles del alta, DD-07 e).
   - `""` dentro de un campo entrecomillado es una comilla; dentro de comillas, `,`, `\n` y `\r\n` son texto.
   - Se admiten espacios (U+0020) **antes** de la comilla de apertura y **después** de la de cierre (DD-07 c); el
     espacio no forma parte del valor.
   - Errores de formato (→ `{ ok: false, line }`, DD-07 d): comillas sin cerrar al llegar al final (`line` = línea
     **donde empieza** el campo entrecomillado, EC-15); texto que no sea espacio, `,` o fin de línea tras unas comillas
     de cierre; una comilla dentro de un campo sin comillas (`line` = la del carácter inesperado).
   - **Línea en blanco** (DD-07 b, DT-07, EC-49): la línea física que, sin su `\n`/`\r\n`, no tiene caracteres o solo
     tiene espacios (U+0020) y tabuladores (U+0009), **sin comillas**, no produce registro, no cuenta en `recordCount`
     y **no desplaza** la numeración física. `,,` **no** es línea en blanco (3 campos vacíos, DT-02); `  ""  `
     tampoco (1 campo).
   - `CsvRecord.line` = línea física (1-based) donde **empieza** el registro; un registro entrecomillado de varias
     líneas no altera la numeración de los siguientes, que siguen con su línea física real (DT-02).
   - La última línea sin salto final cuenta como registro (EC-12).
   - Memoria acotada: guarda solo los primeros `maxKept` registros en `records` y sigue contando todos en
     `recordCount` (TASK-02 lo llama con `maxKept = 502`: cabecera + 501).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/candidates/csv.ts` | crear | `CsvRecord`, `CsvParseResult`, `decodeUtf8`, `parseCsv` |
| `apps/api/test/candidates/csv.test.ts` | crear | Unitarios de cada regla de DD-06 y DD-07 |

## Implementa
- RF: RF-02 (UTF-8, BOM, RFC 4180, LF/CRLF), RF-03 (numeración física, líneas en blanco) · Edge cases: EC-09, EC-12,
  EC-15, EC-19 (coma entrecomillada), EC-22, EC-25, EC-49 · DD-06, DD-07 (a-f, las del *parser*)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (2), § Firmas internas, § DD-06, § DD-07, § Estrategia
  de tests (`csv.test.ts`), § Orden de implementación 1

## Dependencias
- **Depende de:** nada
- **Bloquea:** TASK-02

## Criterios de done
- [ ] `npm test -w apps/api -- candidates/csv` en verde con **1** fichero y, como mínimo, estos tests:
  - `BOM y CRLF`: `﻿nombre,email,telefono\r\nA,b,c\r\n` decodificado y partido da 2 registros sin BOM ni `\r`.
  - `comillas dobles escapadas y coma entrecomillada`: `"Ferrer, Lucía",x@example.com,` → 3 campos, el primero
    `Ferrer, Lucía`; `"Di ""Pepe"""` → `Di "Pepe"`.
  - `registro de varias líneas: fila = línea de inicio y las siguientes siguen la física` (DT-02).
  - `comillas sin cerrar → línea de inicio` (EC-15): campo entrecomillado abierto en la línea 4 → `{ ok: false, line: 4 }`.
  - `texto tras comillas de cierre` y `comilla en campo sin comillas` → `ok: false` con su línea.
  - `espacios alrededor de un campo entrecomillado` → valor sin esos espacios.
  - `EC-49 líneas vacías y solo con espacios o tabuladores ignoradas sin desplazar la numeración; ,, y "  \"\"  " no`:
    con `   \t ` en la línea 4, el registro de la línea 5 lleva `line: 5` y `recordCount` no cuenta la 4.
  - `última línea sin salto` → cuenta.
  - `\r suelto queda en el campo`.
  - `0xF1 y firma PNG → null` (EC-09) y `UTF-8 válido con ñ y emoji → texto`.
  - `maxKept cuenta todos y guarda N`: 600 registros con `maxKept = 502` → `records.length === 502`,
    `recordCount === 600`.
- [ ] `csv.ts` ≤ 300 líneas y ninguna función de más de 50 (lo mide `npm run lint`); no importa nada fuera de
      `node:`/estándar (sin `node:fs`).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/candidates/csv.ts apps/api/test/candidates/csv.test.ts` sin errores.
- [ ] Commit único `feat(api): pure CSV parser with physical line numbers [HU-07 TASK-01]` con los 2 ficheros.

## Notas de implementación
- **Solo coma** (OQ-03, pendiente de ratificar): el separador es una constante del módulo; no detectes `;` aquí. La
  pista de «separado por `;`» (DT-08) la da TASK-02 sobre la cabecera ya parseada.
- La función de recorrido tiende a crecer: parte en un bucle principal + `readQuoted`/`readUnquoted` (o una pequeña
  máquina de estados) para no pasar de 50 líneas por función.
- Los tests construyen el texto o los bytes en línea (sin ficheros en disco). Datos inventados (`@example.com`).
- No uses `split('\n')`/`split(',')`: rompe comillas y saltos dentro de campos (DD-06 C, descartada).
