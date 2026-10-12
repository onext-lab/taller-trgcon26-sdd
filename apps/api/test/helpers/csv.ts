// Ayudas de los tests de la importación por CSV (HU-07). Datos inventados.

export interface CsvBytesOptions {
  /** Antepone el BOM de UTF-8 (U+FEFF), como hace Excel. */
  bom?: boolean;
  /** Fin de línea entre las líneas; `\n` por defecto. */
  eol?: string;
  /** Añade un fin de línea tras la última línea. */
  finalEol?: boolean;
}

const BOM = String.fromCodePoint(0xfeff);

/** Bytes UTF-8 de un fichero con esas líneas. */
export function csvBytes(
  lines: string[],
  { bom = false, eol = '\n', finalEol = false }: CsvBytesOptions = {},
): Uint8Array {
  const text = lines.join(eol) + (finalEol ? eol : '');
  return new TextEncoder().encode(bom ? BOM + text : text);
}

/** Las 3 filas de CA-01. */
export const CA01_ROWS: string[][] = [
  ['Lucía Ferrer Prat', 'lucia.ferrer@example.com', '+34 600 000 012'],
  ['Marcos Vidal Roca', ' Marcos.Vidal@Example.com ', ''],
  ['Noa Serra Gil', 'noa.serra@example.com', '+34 600 000 014'],
];

/**
 * Fichero como lo exporta Excel en un equipo en español: separado por «;», con BOM y CRLF (también al final). Sin
 * comillas, para que el error sea el de cabecera y no el de formato.
 */
export function excelSpanishCsv(rows: string[][] = CA01_ROWS): Uint8Array {
  const lines = [['nombre', 'email', 'telefono'], ...rows].map((cells) => cells.join(';'));
  return csvBytes(lines, { bom: true, eol: '\r\n', finalEol: true });
}
