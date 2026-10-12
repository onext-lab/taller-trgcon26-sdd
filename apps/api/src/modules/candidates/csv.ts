// Lectura de CSV pura (sin Fastify, sin base, sin dependencias): DD-06 y DD-07 de HU-07.
// RFC 4180 con separador `,` y comillas dobles, un solo recorrido, con la línea física de cada registro.

export interface CsvRecord {
  line: number;
  fields: string[];
}

export type CsvParseResult =
  { ok: true; records: CsvRecord[]; recordCount: number } | { ok: false; line: number };

const SEPARATOR = ',';
const QUOTE = '"';

interface Cursor {
  text: string;
  pos: number;
  line: number;
}

type FieldRead = { value: string } | { errorLine: number };
type RecordRead = { fields: string[] } | { errorLine: number };

/** Devuelve el texto, sin BOM inicial, o `null` si los bytes no son UTF-8 válido. */
export function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return null;
  }
}

/** Guarda los primeros `maxKept` registros y cuenta todos; un error de formato da la línea donde se detecta. */
export function parseCsv(text: string, maxKept: number): CsvParseResult {
  const cursor: Cursor = { text, pos: 0, line: 1 };
  const records: CsvRecord[] = [];
  let recordCount = 0;
  while (cursor.pos < text.length) {
    if (skipBlankLine(cursor)) continue;
    const line = cursor.line;
    const read = readRecord(cursor);
    if ('errorLine' in read) return { ok: false, line: read.errorLine };
    recordCount += 1;
    if (records.length < maxKept) records.push({ line, fields: read.fields });
  }
  return { ok: true, records, recordCount };
}

/** Línea sin comillas con solo espacios o tabuladores (o vacía): se consume sin producir registro (DD-07 b). */
function skipBlankLine(cursor: Cursor): boolean {
  const { text } = cursor;
  let i = cursor.pos;
  while (text[i] === ' ' || text[i] === '\t') i += 1;
  const end = endOfLineLength(text, i);
  if (end === 0 && i < text.length) return false;
  cursor.pos = i + end;
  if (end > 0) cursor.line += 1;
  return true;
}

/** Largo del fin de línea en `i` (`\n` = 1, `\r\n` = 2); 0 si no hay, o si es el fin del texto. */
function endOfLineLength(text: string, i: number): number {
  if (text[i] === '\n') return 1;
  if (text[i] === '\r' && text[i + 1] === '\n') return 2;
  return 0;
}

function readRecord(cursor: Cursor): RecordRead {
  const fields: string[] = [];
  for (;;) {
    const read = readField(cursor);
    if ('errorLine' in read) return read;
    fields.push(read.value);
    const { text, pos } = cursor;
    if (text[pos] === SEPARATOR) {
      cursor.pos += 1;
      continue;
    }
    const end = endOfLineLength(text, pos);
    cursor.pos += end;
    if (end > 0) cursor.line += 1;
    return { fields };
  }
}

/** Deja el cursor en el terminador del campo: `,`, fin de línea o fin del texto. */
function readField(cursor: Cursor): FieldRead {
  const { text } = cursor;
  let i = cursor.pos;
  while (text[i] === ' ') i += 1;
  if (text[i] === QUOTE) return readQuoted(cursor, i + 1);
  return readUnquoted(cursor);
}

function readUnquoted(cursor: Cursor): FieldRead {
  const { text } = cursor;
  let i = cursor.pos;
  while (i < text.length && text[i] !== SEPARATOR && endOfLineLength(text, i) === 0) {
    if (text[i] === QUOTE) return { errorLine: cursor.line };
    i += 1;
  }
  const value = text.slice(cursor.pos, i);
  cursor.pos = i;
  return { value };
}

function readQuoted(cursor: Cursor, from: number): FieldRead {
  const { text } = cursor;
  const startLine = cursor.line;
  let value = '';
  let i = from;
  while (i < text.length) {
    const char = text[i];
    if (char === QUOTE && text[i + 1] === QUOTE) {
      value += QUOTE;
      i += 2;
      continue;
    }
    if (char === QUOTE) return closeQuoted(cursor, i + 1, value);
    if (char === '\n') cursor.line += 1;
    value += char;
    i += 1;
  }
  return { errorLine: startLine };
}

/** Tras la comilla de cierre solo se admiten espacios y luego `,`, fin de línea o fin del texto. */
function closeQuoted(cursor: Cursor, from: number, value: string): FieldRead {
  const { text } = cursor;
  let i = from;
  while (text[i] === ' ') i += 1;
  const isTerminator = i >= text.length || text[i] === SEPARATOR || endOfLineLength(text, i) > 0;
  if (!isTerminator) return { errorLine: cursor.line };
  cursor.pos = i;
  return { value };
}
