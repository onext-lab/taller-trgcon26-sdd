import { describe, expect, it } from 'vitest';
import {
  focusFirstError,
  hasBadInput,
  splitValidationDetails,
} from '../../src/components/form-errors.ts';
import { ApiError } from '../../src/components/http.ts';

const FIELDS = ['fullName', 'email', 'skills'] as const;
type Field = (typeof FIELDS)[number];

function isField(name: string): name is Field {
  return (FIELDS as readonly string[]).includes(name);
}

function validationError(details?: Array<{ field: string; message: string }>): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', 'Hay campos con errores.', details);
}

describe('splitValidationDetails', () => {
  it('CA-04 cada detail de un campo va junto a ese campo y no hay alerta del formulario', () => {
    const error = validationError([
      { field: 'email', message: 'Escribe un email válido.' },
      { field: 'skills', message: 'Demasiadas skills.' },
    ]);

    expect(splitValidationDetails(error, isField)).toEqual({
      fields: { email: 'Escribe un email válido.', skills: 'Demasiadas skills.' },
    });
  });

  it('con varios details del mismo campo gana el primero', () => {
    const error = validationError([
      { field: 'email', message: 'Primero.' },
      { field: 'email', message: 'Segundo.' },
    ]);
    expect(splitValidationDetails(error, isField).fields).toEqual({ email: 'Primero.' });
  });

  it('S9 un campo desconocido va a la alerta del formulario con su mensaje, sin perder los de campo', () => {
    const error = validationError([
      { field: 'fullName', message: 'Escribe el nombre.' },
      { field: 'body', message: 'Hay campos no permitidos.' },
    ]);

    expect(splitValidationDetails(error, isField)).toEqual({
      fields: { fullName: 'Escribe el nombre.' },
      form: 'Hay campos no permitidos.',
    });
  });

  it('sin details (o vacíos) la alerta es el mensaje del error', () => {
    expect(splitValidationDetails(validationError(), isField)).toEqual({
      fields: {},
      form: 'Hay campos con errores.',
    });
    expect(splitValidationDetails(validationError([]), isField)).toEqual({
      fields: {},
      form: 'Hay campos con errores.',
    });
  });
});

describe('hasBadInput', () => {
  function markBadInput(input: Element): void {
    Object.defineProperty(input, 'validity', { value: { badInput: true }, configurable: true });
  }

  it('EC-17 hasBadInput: true solo para el control con badInput', () => {
    const form = document.createElement('form');
    for (const name of ['when', 'other']) {
      const input = document.createElement('input');
      input.name = name;
      form.append(input);
    }
    markBadInput(form.elements.namedItem('when') as Element);

    expect(hasBadInput(form, 'when')).toBe(true);
    expect(hasBadInput(form, 'other')).toBe(false);
  });

  it('un nombre que no existe en el formulario es false', () => {
    expect(hasBadInput(document.createElement('form'), 'ghost')).toBe(false);
  });
});

describe('focusFirstError', () => {
  function buildForm(): HTMLFormElement {
    const form = document.createElement('form');
    for (const name of FIELDS) {
      const input = document.createElement('input');
      input.name = name;
      form.append(input);
    }
    document.body.append(form);
    return form;
  }

  it('enfoca el primer campo del orden dado que tiene error, no el primero de los errores', () => {
    const form = buildForm();

    focusFirstError(form, FIELDS, { skills: 'x', email: 'y' });

    // efecto-síncrono: la función pura focusFirstError llama a focus() en la propia llamada, sin efecto de React
    expect(document.activeElement).toBe(form.elements.namedItem('email'));
    form.remove();
  });

  it('sin errores o con un campo que no existe en el formulario no mueve el foco', () => {
    const form = buildForm();
    const before = document.activeElement;

    focusFirstError(form, FIELDS, {});
    focusFirstError(form, ['ghost'], { ghost: 'x' });

    // efecto-síncrono: la función pura focusFirstError llama a focus() en la propia llamada, sin efecto de React
    expect(document.activeElement).toBe(before);
    form.remove();
  });
});
