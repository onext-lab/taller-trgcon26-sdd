import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/errors.ts';
import {
  FILE_TOO_LARGE_MESSAGE,
  INVALID_CSV_MESSAGE,
  INVALID_HEADER_MESSAGE,
  MAX_IMPORT_BYTES,
  NO_CANDIDATES_MESSAGE,
  SEMICOLON_SEPARATOR_MESSAGE,
  TOO_MANY_ROWS_MESSAGE,
  readImportFile,
} from '../../src/modules/candidates/import-file.ts';
import { csvBytes, excelSpanishCsv } from '../helpers/csv.ts';

// Datos inventados. `readImportFile` es pura: sin Fastify ni base.

const HEADER = 'nombre,email,telefono';
const ROW = 'Ana Prueba,ana.prueba@example.com,';

function dataRows(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Persona ${i},persona${i}@example.com,`);
}

function fileError(bytes: Uint8Array): AppError {
  try {
    readImportFile(bytes);
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('readImportFile no lanzó');
}

/** Un 400 del fichero entero: `message` y el único `details` con el mismo texto (DEC-11.4). */
function expectFile400(bytes: Uint8Array, message: string): void {
  const error = fileError(bytes);
  expect(error.code).toBe('VALIDATION_ERROR');
  expect(error.statusCode).toBe(400);
  expect(error.message).toBe(message);
  expect(error.details).toEqual([{ field: 'file', message }]);
}

describe('readImportFile · cabecera', () => {
  it('cabeceras de EC-10 (1 válida, 5 inválidas)', () => {
    const records = readImportFile(csvBytes([' Nombre , EMAIL,Telefono', ROW]));
    expect(records).toEqual([{ line: 2, fields: ['Ana Prueba', 'ana.prueba@example.com', ''] }]);

    const invalid = [
      'nombre,email',
      'nombre,email,telefono,resumen',
      'email,nombre,telefono',
      'nombre,email,email',
      'nombre,email,telefono,',
    ];
    for (const header of invalid) {
      expectFile400(csvBytes([header, ROW]), INVALID_HEADER_MESSAGE);
    }
  });

  it('EC-50 / DT-08 cabecera separada por «;» → mensaje del separador', () => {
    expectFile400(excelSpanishCsv(), SEMICOLON_SEPARATOR_MESSAGE);
    expectFile400(csvBytes([' Nombre ; EMAIL ;Telefono', ROW]), SEMICOLON_SEPARATOR_MESSAGE);

    const notSemicolonHeaders = [
      'nombre;email',
      'email;nombre;telefono',
      'nombre;email;telefono;resumen',
      'nombre;email,telefono',
    ];
    for (const header of notSemicolonHeaders) {
      expectFile400(csvBytes([header, ROW]), INVALID_HEADER_MESSAGE);
    }
  });

  it('EC-50 el aviso del «;» solo aplica a la línea 1, y sin BOM ni CRLF en la comparación', () => {
    expectFile400(csvBytes(['', 'nombre;email;telefono', ROW]), INVALID_HEADER_MESSAGE);
    expectFile400(
      csvBytes(['nombre;email;telefono', ROW], { eol: '\r\n' }),
      SEMICOLON_SEPARATOR_MESSAGE,
    );
    expectFile400(
      csvBytes(['nombre;email;telefono', ROW], { bom: true }),
      SEMICOLON_SEPARATOR_MESSAGE,
    );
  });

  it('EC-50 ningún mensaje contiene la cabecera ni valores de las filas', () => {
    const error = fileError(excelSpanishCsv());
    const text = JSON.stringify([error.message, error.details]);
    for (const leaked of ['nombre;email', 'Lucía', 'lucia.ferrer', '+34 600']) {
      expect(text).not.toContain(leaked);
    }
  });

  it('línea 1 en blanco con contenido → cabecera', () => {
    expectFile400(csvBytes(['', HEADER, ROW]), INVALID_HEADER_MESSAGE);
    expectFile400(csvBytes(['  \t ', HEADER, ROW]), INVALID_HEADER_MESSAGE);
  });

  it('BOM y CRLF con la cabecera correcta → filas de datos con su línea física', () => {
    const bytes = csvBytes([HEADER, '', ROW], { bom: true, eol: '\r\n', finalEol: true });
    expect(readImportFile(bytes)).toEqual([
      { line: 3, fields: ['Ana Prueba', 'ana.prueba@example.com', ''] },
    ]);
  });
});

describe('readImportFile · filas', () => {
  it('0 bytes, solo BOM, solo blancos, solo cabecera → sin filas', () => {
    const empty = [
      new Uint8Array(),
      csvBytes([], { bom: true }),
      csvBytes(['', '  ', '\t'], { finalEol: true }),
      csvBytes([HEADER]),
    ];
    for (const bytes of empty) {
      expectFile400(bytes, NO_CANDIDATES_MESSAGE);
    }
    expectFile400(csvBytes([HEADER, '', '   '], { finalEol: true }), NO_CANDIDATES_MESSAGE);
  });

  it('500 y 500 + 30 blancos pasan; 501 no', () => {
    expect(readImportFile(csvBytes([HEADER, ...dataRows(500)]))).toHaveLength(500);

    const withBlanks = [HEADER, ...dataRows(500).flatMap((row, i) => (i < 30 ? [row, ''] : [row]))];
    expect(readImportFile(csvBytes(withBlanks))).toHaveLength(500);

    expectFile400(csvBytes([HEADER, ...dataRows(501)]), TOO_MANY_ROWS_MESSAGE);
    expectFile400(csvBytes([HEADER, ...dataRows(2_000)]), TOO_MANY_ROWS_MESSAGE);
  });

  it('EC-12 la última fila sin salto de línea cuenta', () => {
    expect(readImportFile(csvBytes([HEADER, ROW, ROW]))).toHaveLength(2);
  });
});

describe('readImportFile · precedencia y límites', () => {
  it('precedencia DT-03: codificación antes que formato, formato antes que cabecera, cabecera antes que filas', () => {
    const latin1 = Uint8Array.from([0x6e, 0x6f, 0x6d, 0x3b, 0xf1, 0x0a, 0x22, 0x41]);
    expectFile400(latin1, INVALID_CSV_MESSAGE);

    const unclosed = csvBytes(['nombre;email;telefono', '"Ana,ana@example.com,']);
    expectFile400(unclosed, `${INVALID_CSV_MESSAGE} Revisa la línea 2.`);

    expectFile400(csvBytes(['nombre,email', ...dataRows(501)]), INVALID_HEADER_MESSAGE);
    expectFile400(csvBytes(['nombre,email']), INVALID_HEADER_MESSAGE);
  });

  it('EC-09 comillas sin cerrar → formato con la línea donde empiezan', () => {
    const bytes = csvBytes([HEADER, ROW, ROW, '"Ana,ana@example.com,', ROW]);
    expectFile400(bytes, `${INVALID_CSV_MESSAGE} Revisa la línea 4.`);
  });

  it('> 1 048 576 bytes → 413 con FILE_TOO_LARGE_MESSAGE', () => {
    const error = fileError(new Uint8Array(MAX_IMPORT_BYTES + 1).fill(0x61));
    expect(error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(error.statusCode).toBe(413);
    expect(error.message).toBe(FILE_TOO_LARGE_MESSAGE);
    expect(error.details).toBeUndefined();

    const atLimit = fileError(new Uint8Array(MAX_IMPORT_BYTES).fill(0x61));
    expect(atLimit.statusCode).toBe(400);
  });

  it('EC-17 el mismo fichero da el mismo error', () => {
    const bytes = csvBytes(['nombre,email', ROW]);
    expect(fileError(bytes)).toEqual(fileError(bytes));
  });
});

describe('readImportFile · privacidad', () => {
  it('ningún mensaje contiene texto del fichero', () => {
    const leaky = 'lucia.ferrer@example.com';
    const files = [
      csvBytes([`nombre,${leaky},telefono`, ROW]),
      csvBytes([`nombre;${leaky};telefono;resumen`, ROW]),
      csvBytes([HEADER, `"${leaky}`]),
      csvBytes([`nombre,${leaky}`]),
      csvBytes([`nombre,${leaky}`, ...dataRows(501)]),
    ];
    for (const bytes of files) {
      const error = fileError(bytes);
      expect(JSON.stringify([error.message, error.details])).not.toContain(leaky);
    }
  });
});
