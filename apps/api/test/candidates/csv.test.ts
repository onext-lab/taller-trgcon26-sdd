import { describe, expect, it } from 'vitest';
import { decodeUtf8, parseCsv } from '../../src/modules/candidates/csv.ts';
import type { CsvRecord } from '../../src/modules/candidates/csv.ts';

// Datos inventados. El parser es puro: sin Fastify ni base.

function parseOk(text: string, maxKept = 502): { records: CsvRecord[]; recordCount: number } {
  const result = parseCsv(text, maxKept);
  if (!result.ok) throw new Error(`unexpected format error at line ${result.line}`);
  return result;
}

describe('decodeUtf8', () => {
  it('BOM y CRLF: decodificado y partido da 2 registros sin BOM ni \\r', () => {
    const bytes = new TextEncoder().encode('﻿nombre,email,telefono\r\nA,b,c\r\n');
    const text = decodeUtf8(bytes);
    expect(text).toBe('nombre,email,telefono\r\nA,b,c\r\n');
    const { records, recordCount } = parseOk(text ?? '');
    expect(recordCount).toBe(2);
    expect(records).toEqual([
      { line: 1, fields: ['nombre', 'email', 'telefono'] },
      { line: 2, fields: ['A', 'b', 'c'] },
    ]);
  });

  it('EC-09 0xF1 (Latin-1) y firma PNG → null', () => {
    expect(decodeUtf8(Uint8Array.from([0x4e, 0x75, 0xf1, 0x65, 0x7a]))).toBeNull();
    expect(
      decodeUtf8(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBeNull();
  });

  it('UTF-8 válido con ñ y emoji → texto', () => {
    const text = 'Núñez, Íñigo 😀';
    expect(decodeUtf8(new TextEncoder().encode(text))).toBe(text);
  });

  it('cero bytes y solo BOM → cadena vacía', () => {
    expect(decodeUtf8(new Uint8Array())).toBe('');
    expect(decodeUtf8(Uint8Array.from([0xef, 0xbb, 0xbf]))).toBe('');
  });
});

describe('parseCsv — comillas', () => {
  it('EC-19 comillas dobles escapadas y coma entrecomillada', () => {
    const { records } = parseOk('"Ferrer, Lucía",x@example.com,\n"Di ""Pepe""",y@example.com,\n');
    expect(records[0]?.fields).toEqual(['Ferrer, Lucía', 'x@example.com', '']);
    expect(records[1]?.fields).toEqual(['Di "Pepe"', 'y@example.com', '']);
  });

  it('registro de varias líneas: fila = línea de inicio y las siguientes siguen la física (DT-02)', () => {
    const text = 'nombre,email,telefono\n"Ana\nMaría\r\nGil",a@example.com,\nB,b@example.com,\n';
    const { records, recordCount } = parseOk(text);
    expect(recordCount).toBe(3);
    expect(records.map((r) => r.line)).toEqual([1, 2, 5]);
    expect(records[1]?.fields[0]).toBe('Ana\nMaría\r\nGil');
  });

  it('EC-15 comillas sin cerrar → línea de inicio', () => {
    const text =
      'nombre,email,telefono\nA,a@example.com,\nB,b@example.com,\n"C,c@example.com,\nD,d@example.com,\n';
    expect(parseCsv(text, 502)).toEqual({ ok: false, line: 4 });
  });

  it('texto tras comillas de cierre → ok: false con su línea', () => {
    expect(parseCsv('a,b,c\n"x"y,b,c\n', 502)).toEqual({ ok: false, line: 2 });
    expect(parseCsv('"x" \r,b,c\n', 502)).toEqual({ ok: false, line: 1 });
    expect(parseCsv('"a\nb"x,c\n', 502)).toEqual({ ok: false, line: 2 });
  });

  it('comilla en campo sin comillas → ok: false con su línea', () => {
    expect(parseCsv('a,b,c\nd,e"f,g\n', 502)).toEqual({ ok: false, line: 2 });
    expect(parseCsv('a,b\n', 502)).toMatchObject({ ok: true });
    expect(parseCsv('a,b c"\n', 502)).toEqual({ ok: false, line: 1 });
  });

  it('espacios alrededor de un campo entrecomillado → valor sin esos espacios', () => {
    const { records } = parseOk('  "A B"  ,   "c"\n');
    expect(records[0]?.fields).toEqual(['A B', 'c']);
  });

  it('espacios dentro de un campo sin comillas se conservan', () => {
    const { records } = parseOk(' a b ,c\n');
    expect(records[0]?.fields).toEqual([' a b ', 'c']);
  });
});

describe('parseCsv — líneas', () => {
  it('EC-49 líneas vacías y solo con espacios o tabuladores ignoradas sin desplazar la numeración', () => {
    const text = 'h1,h2\nA,a\n\n   \t \nB,b\n\t\nC,c';
    const { records, recordCount } = parseOk(text);
    expect(recordCount).toBe(4);
    expect(records.map((r) => r.line)).toEqual([1, 2, 5, 7]);
  });

  it('EC-49 ,, no es línea en blanco (3 campos vacíos) y "  \\"\\"  " tampoco (1 campo)', () => {
    const { records, recordCount } = parseOk(',,\n  ""  \n');
    expect(recordCount).toBe(2);
    expect(records[0]).toEqual({ line: 1, fields: ['', '', ''] });
    expect(records[1]).toEqual({ line: 2, fields: [''] });
  });

  it('EC-49 texto vacío y solo líneas en blanco no producen registros', () => {
    expect(parseOk('')).toMatchObject({ records: [], recordCount: 0 });
    expect(parseOk(' \t\r\n\n  ')).toMatchObject({ records: [], recordCount: 0 });
  });

  it('EC-12 última línea sin salto → cuenta', () => {
    const { records, recordCount } = parseOk('h1,h2\nA,a');
    expect(recordCount).toBe(2);
    expect(records[1]).toEqual({ line: 2, fields: ['A', 'a'] });
  });

  it('coma final al final del texto da un último campo vacío', () => {
    expect(parseOk('A,').records[0]?.fields).toEqual(['A', '']);
  });

  it('\\r suelto queda en el campo', () => {
    const { records } = parseOk('a\rb,c\r\nd,e\r');
    expect(records[0]?.fields).toEqual(['a\rb', 'c']);
    expect(records[1]).toEqual({ line: 2, fields: ['d', 'e\r'] });
  });

  it('EC-22 y EC-25 el recorrido es lineal: un campo enorme no se cuelga', () => {
    const big = 'x'.repeat(200_000);
    const { records } = parseOk(`"${big}",b\n${big},c\n`);
    expect(records[0]?.fields[0]).toHaveLength(200_000);
    expect(records[1]?.fields[0]).toHaveLength(200_000);
  });
});

describe('parseCsv — memoria acotada', () => {
  it('maxKept cuenta todos y guarda N', () => {
    const text = Array.from({ length: 600 }, (_, i) => `n${i},e${i}@example.com,`).join('\n');
    const result = parseOk(text, 502);
    expect(result.records).toHaveLength(502);
    expect(result.recordCount).toBe(600);
    expect(result.records[501]?.line).toBe(502);
  });
});
