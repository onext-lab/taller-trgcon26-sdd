import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  hasControlCharacter,
  PAGE_SIZES,
  SEARCH_CONTROL_TEXT,
  SEARCH_TOO_LONG_TEXT,
  totalPages,
  validateFilterText,
  validateSearchText,
} from '../../src/components/list-controls.ts';

describe('validateSearchText (q)', () => {
  it('EC-27 100 caracteres es válido y 101 da error', () => {
    expect(validateSearchText('a'.repeat(100))).toEqual({ ok: true, value: 'a'.repeat(100) });
    expect(validateSearchText('a'.repeat(101))).toEqual({ ok: false, error: SEARCH_TOO_LONG_TEXT });
  });

  it('EC-28 cuenta puntos de código, no unidades UTF-16', () => {
    expect(validateSearchText('😀'.repeat(100)).ok).toBe(true);
    expect(validateSearchText('😀'.repeat(101)).ok).toBe(false);
  });

  it('EC-28 recorta los extremos y un texto solo con espacios es «sin filtro»', () => {
    expect(validateSearchText(`  ${'a'.repeat(100)}  `)).toEqual({
      ok: true,
      value: 'a'.repeat(100),
    });
    expect(validateSearchText('   ')).toEqual({ ok: true, value: '' });
  });

  it('EC-27 rechaza un carácter de control (tabulador, DEL, NUL)', () => {
    const error = { ok: false, error: SEARCH_CONTROL_TEXT };
    expect(validateSearchText('a\tb')).toEqual(error);
    expect(validateSearchText('a\u007Fb')).toEqual(error);
    expect(validateSearchText('a\u0000b')).toEqual(error);
  });

  it('no normaliza: conserva mayúsculas y tildes', () => {
    expect(validateSearchText('GESTIÓN')).toEqual({ ok: true, value: 'GESTIÓN' });
  });

  it('los textos son los fijados por el diseño', () => {
    expect(SEARCH_TOO_LONG_TEXT).toBe('La búsqueda no puede pasar de 100 caracteres.');
    expect(SEARCH_CONTROL_TEXT).toBe('La búsqueda no puede tener caracteres de control.');
  });
});

describe('validateFilterText (reglas propias, S8 de la skill)', () => {
  const rules = {
    maxLength: 40,
    tooLong: 'La skill no puede pasar de 40 caracteres.',
    control: 'La skill no puede tener caracteres de control.',
  };

  it('40 puntos de código es válido y 41 da el texto de la regla', () => {
    expect(validateFilterText('é'.repeat(40), rules)).toEqual({ ok: true, value: 'é'.repeat(40) });
    expect(validateFilterText('é'.repeat(41), rules)).toEqual({ ok: false, error: rules.tooLong });
    expect(validateFilterText('😀'.repeat(41), rules).ok).toBe(false);
  });

  it('recorta antes de medir y rechaza el control con el texto de la regla', () => {
    expect(validateFilterText(`  ${'a'.repeat(40)} `, rules)).toEqual({
      ok: true,
      value: 'a'.repeat(40),
    });
    expect(validateFilterText('sql\u0000', rules)).toEqual({ ok: false, error: rules.control });
    expect(validateFilterText('sq\tl', rules)).toEqual({ ok: false, error: rules.control });
  });

  it('el control recortable (espacios, saltos al final) no cuenta: se recorta antes', () => {
    expect(validateFilterText('sql\n', rules)).toEqual({ ok: true, value: 'sql' });
  });
});

describe('hasControlCharacter', () => {
  it('detecta C0 y DEL, y no los acentos ni los emojis', () => {
    expect(hasControlCharacter('a\u001Fb')).toBe(true);
    expect(hasControlCharacter('a\u007Fb')).toBe(true);
    expect(hasControlCharacter('José 😀')).toBe(false);
    expect(hasControlCharacter('')).toBe(false);
  });
});

describe('tamaños y páginas', () => {
  it('ofrece 20, 50 y 100, con 20 por defecto', () => {
    expect(PAGE_SIZES).toEqual([20, 50, 100]);
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });

  it('totalPages nunca baja de 1', () => {
    expect(totalPages(0, 20)).toBe(1);
    expect(totalPages(20, 20)).toBe(1);
    expect(totalPages(21, 20)).toBe(2);
    expect(totalPages(25, 100)).toBe(1);
  });
});
