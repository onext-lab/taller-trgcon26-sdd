import { describe, expect, it } from 'vitest';
import {
  NOTE_CONTROL_MESSAGE,
  NOTE_MAX,
  NOTE_TOO_LONG_MESSAGE,
  REASON_OPTIONS,
  REASON_REQUIRED_MESSAGE,
  noteLength,
  validateRejectForm,
} from '../../../src/features/applications/reject-form.ts';

const valid = (note: string) => validateRejectForm({ reason: 'not_a_fit', note });

describe('opciones del formulario de rechazo', () => {
  it('son los tres motivos manuales y nunca «Oferta cerrada»', () => {
    expect(REASON_OPTIONS).toEqual([
      { code: 'not_a_fit', label: 'No encaja con el perfil' },
      { code: 'candidate_withdrew', label: 'Retirada del candidato' },
      { code: 'other', label: 'Otro' },
    ]);
  });
});

describe('noteLength', () => {
  it('cuenta puntos de código del texto recortado (DD-07)', () => {
    expect(noteLength('  ab  ')).toBe(2);
    expect(noteLength('😀😀')).toBe(2);
    expect(noteLength('   ')).toBe(0);
  });

  it('EC-37: 501 caracteres cuentan 501', () => {
    expect(noteLength('a'.repeat(501))).toBe(501);
  });
});

describe('validateRejectForm', () => {
  it('EC-37: 500 caracteres es válida', () => {
    const result = valid('a'.repeat(NOTE_MAX));

    expect(result.ok).toBe(true);
  });

  it('EC-37: 501 caracteres es un error de la nota', () => {
    expect(valid('a'.repeat(NOTE_MAX + 1))).toEqual({
      ok: false,
      errors: { note: NOTE_TOO_LONG_MESSAGE },
    });
  });

  it('EC-37: 500 emojis (1000 unidades UTF-16) son válidos y se envían', () => {
    const note = '😀'.repeat(NOTE_MAX);

    expect(valid(note)).toEqual({ ok: true, input: { reason: 'not_a_fit', note } });
    expect(valid(note + '😀').ok).toBe(false);
  });

  it('EC-37: los espacios de los extremos no suman al límite', () => {
    const note = 'a'.repeat(NOTE_MAX);

    expect(valid(`  ${note}  `)).toEqual({ ok: true, input: { reason: 'not_a_fit', note } });
  });

  it('EC-12: NUL y U+0007 son caracteres de control', () => {
    for (const control of ['\u0000', '\u0007', '\u007f', '\u001f']) {
      expect(valid(`nota${control}`)).toEqual({
        ok: false,
        errors: { note: NOTE_CONTROL_MESSAGE },
      });
    }
  });

  it('EC-12: salto de línea, retorno y tabulador están permitidos', () => {
    expect(valid('uno\ndos\r\ntres\tcuatro')).toEqual({
      ok: true,
      input: { reason: 'not_a_fit', note: 'uno\ndos\r\ntres\tcuatro' },
    });
  });

  it('EC-13: una nota de solo espacios es válida y viaja sin note', () => {
    const result = valid('   \n\t ');

    expect(result).toEqual({ ok: true, input: { reason: 'not_a_fit' } });
    expect(result.ok && 'note' in result.input).toBe(false);
  });

  it('una nota vacía es válida y viaja sin note', () => {
    expect(valid('')).toEqual({ ok: true, input: { reason: 'not_a_fit' } });
  });

  it('EC-36: sin motivo da «Elige un motivo.»', () => {
    expect(validateRejectForm({ reason: '', note: '' })).toEqual({
      ok: false,
      errors: { reason: REASON_REQUIRED_MESSAGE },
    });
    expect(REASON_REQUIRED_MESSAGE).toBe('Elige un motivo.');
  });

  it('EC-36: sin motivo y con la nota larga devuelve los dos errores', () => {
    expect(validateRejectForm({ reason: '', note: 'a'.repeat(NOTE_MAX + 1) })).toEqual({
      ok: false,
      errors: { reason: 'Elige un motivo.', note: NOTE_TOO_LONG_MESSAGE },
    });
  });

  it('los textos de error son los del PRD', () => {
    expect(NOTE_TOO_LONG_MESSAGE).toBe('La nota no puede pasar de 500 caracteres.');
    expect(NOTE_CONTROL_MESSAGE).toBe('La nota no puede tener caracteres de control.');
  });

  it('EC-13: el motivo viaja tal cual con una nota con texto recortado', () => {
    expect(validateRejectForm({ reason: 'other', note: '  Prefiere jornada parcial.  ' })).toEqual({
      ok: true,
      input: { reason: 'other', note: 'Prefiere jornada parcial.' },
    });
  });
});
