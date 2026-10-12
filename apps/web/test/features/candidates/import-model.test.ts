import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../src/components/http.ts';
import {
  columnLabel,
  EXPECTED_HEADER,
  FILE_TOO_LARGE_MESSAGE,
  FILE_UNREADABLE_MESSAGE,
  isFileError,
  isFileTooLarge,
  MAX_FILE_BYTES,
  reportSummary,
} from '../../../src/features/candidates/import-model.ts';
import type { ImportReport } from '../../../src/features/candidates/types.ts';

function report(created: number, duplicates: number, invalid: number): ImportReport {
  return {
    dataRows: created + duplicates + invalid,
    created,
    duplicates,
    invalid,
    notImported: [],
  };
}

describe('constantes', () => {
  it('cabecera esperada, límite y textos del cliente', () => {
    expect(EXPECTED_HEADER).toBe('nombre,email,telefono');
    expect(MAX_FILE_BYTES).toBe(1_048_576);
    expect(FILE_TOO_LARGE_MESSAGE).toBe(
      'El fichero ocupa más de 1 MiB. Divídelo en ficheros más pequeños.',
    );
    expect(FILE_UNREADABLE_MESSAGE).toBe('No se ha podido leer el fichero. Vuelve a elegirlo.');
  });
});

describe('reportSummary', () => {
  it('plural con 3 y con 0', () => {
    expect(reportSummary(report(3, 0, 0))).toBe('3 creados, 0 duplicados, 0 filas con error.');
  });

  it('singular con 1 en cada recuento (EC-46)', () => {
    expect(reportSummary(report(1, 1, 1))).toBe('1 creado, 1 duplicado, 1 fila con error.');
  });

  it('todo a 0', () => {
    expect(reportSummary(report(0, 0, 0))).toBe('0 creados, 0 duplicados, 0 filas con error.');
  });

  it('mezcla de singular y plural', () => {
    expect(reportSummary(report(2, 1, 4))).toBe('2 creados, 1 duplicado, 4 filas con error.');
  });
});

describe('columnLabel', () => {
  it('fila → «Toda la fila»', () => {
    expect(columnLabel('fila')).toBe('Toda la fila');
  });

  it.each(['nombre', 'email', 'telefono'])('%s va tal cual', (field) => {
    expect(columnLabel(field)).toBe(field);
  });
});

describe('isFileTooLarge (EC-11)', () => {
  it('1 048 576 bytes no pasa de largo; 1 048 577 sí', () => {
    expect(isFileTooLarge({ size: 1_048_576 })).toBe(false);
    expect(isFileTooLarge({ size: 1_048_577 })).toBe(true);
  });

  it('un fichero vacío no es demasiado grande', () => {
    expect(isFileTooLarge({ size: 0 })).toBe(false);
  });
});

describe('isFileError', () => {
  const message = 'La primera línea debe ser la cabecera.';

  it('400 con un detalle de field file → true', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', message, [{ field: 'file', message }]);

    expect(isFileError(error)).toBe(true);
  });

  it('400 con file entre otros detalles → true', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', message, [
      { field: 'x', message },
      { field: 'file', message },
    ]);

    expect(isFileError(error)).toBe(true);
  });

  it('413 → true, con o sin details', () => {
    expect(isFileError(new ApiError(413, 'PAYLOAD_TOO_LARGE', message))).toBe(true);
  });

  it('400 sin file, o sin details → false', () => {
    expect(
      isFileError(new ApiError(400, 'VALIDATION_ERROR', message, [{ field: 'x', message }])),
    ).toBe(false);
    expect(isFileError(new ApiError(400, 'VALIDATION_ERROR', message))).toBe(false);
  });

  it('403, 415 y 500 → false, aunque lleven file', () => {
    for (const status of [403, 415, 500]) {
      const error = new ApiError(status, 'X', message, [{ field: 'file', message }]);

      expect(isFileError(error)).toBe(false);
    }
  });

  it('error de red del cliente y errores que no son ApiError → false', () => {
    expect(isFileError(new ApiError(0, 'CLIENT_NETWORK', message))).toBe(false);
    expect(isFileError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isFileError(undefined)).toBe(false);
  });
});
