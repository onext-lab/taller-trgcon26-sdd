import { describe, expect, it } from 'vitest';
import {
  EMPTY_FORM,
  toCreateInput,
  validateJobForm,
  type JobFormValues,
} from '../../../src/features/jobs/job-form-model.ts';

// Invented data only.
function form(overrides: Partial<JobFormValues> = {}): JobFormValues {
  return { ...EMPTY_FORM, title: 'Desarrollador/a backend (Node.js)', ...overrides };
}

describe('validateJobForm · título (CA-03, EC-04)', () => {
  it('acepta solo el título', () => {
    expect(validateJobForm(form())).toEqual({});
  });

  it('un título vacío o solo de espacios pide escribir un título', () => {
    expect(validateJobForm(form({ title: '' })).title).toBe('Escribe un título.');
    expect(validateJobForm(form({ title: '   \t ' })).title).toBe('Escribe un título.');
  });

  it.each([
    [2, true],
    [3, false],
    [120, false],
    [121, true],
  ])('un título de %i caracteres: error = %s', (size, hasError) => {
    const errors = validateJobForm(form({ title: 'a'.repeat(size) }));
    expect(errors.title).toBe(
      hasError ? 'El título debe tener entre 3 y 120 caracteres.' : undefined,
    );
  });

  it('recorta antes de contar', () => {
    expect(validateJobForm(form({ title: `  ${'a'.repeat(2)}  ` })).title).toBeDefined();
    expect(validateJobForm(form({ title: `  ${'a'.repeat(120)}  ` })).title).toBeUndefined();
  });

  it('cuenta puntos de código: 120 emoji son válidos y 121 no', () => {
    expect(validateJobForm(form({ title: '🎨'.repeat(120) })).title).toBeUndefined();
    expect(validateJobForm(form({ title: '🎨'.repeat(121) })).title).toBeDefined();
  });
});

describe('validateJobForm · descripción y ubicación (CA-04, EC-11)', () => {
  it('la descripción admite 5 000 caracteres y rechaza 5 001', () => {
    expect(validateJobForm(form({ description: 'a'.repeat(5000) })).description).toBeUndefined();
    expect(validateJobForm(form({ description: 'a'.repeat(5001) })).description).toBe(
      'La descripción no puede pasar de 5 000 caracteres.',
    );
  });

  it.each([
    [1, true],
    [2, false],
    [120, false],
    [121, true],
  ])('una ubicación de %i caracteres: error = %s', (size, hasError) => {
    const errors = validateJobForm(form({ location: 'a'.repeat(size) }));
    expect(errors.location).toBe(
      hasError ? 'La ubicación debe tener entre 2 y 120 caracteres.' : undefined,
    );
  });

  it('una ubicación de solo espacios cuenta como vacía; una de 1 carácter con espacios, no', () => {
    expect(validateJobForm(form({ location: '    ' })).location).toBeUndefined();
    expect(validateJobForm(form({ location: '  a  ' })).location).toBeDefined();
  });
});

describe('validateJobForm · modalidad y salarios (CA-05 a CA-07, EC-12, EC-13, EC-17)', () => {
  it('la modalidad es una de las tres o vacía', () => {
    for (const workMode of ['', 'presencial', 'híbrida', 'remota']) {
      expect(validateJobForm(form({ workMode })).workMode).toBeUndefined();
    }
    expect(validateJobForm(form({ workMode: 'hibrida' })).workMode).toBe(
      'Elige presencial, híbrida o remota.',
    );
  });

  it.each(['0', '-1', '40000.5', '40.000', '40 000', 'abc', '1e3'])(
    'el salario «%s» no es válido',
    (salary) => {
      const message = 'Escribe un número entero mayor que 0, sin puntos ni espacios.';
      expect(validateJobForm(form({ salaryMin: salary })).salaryMin).toBe(message);
      expect(validateJobForm(form({ salaryMax: salary })).salaryMax).toBe(message);
    },
  );

  it('rechaza un entero que no es seguro', () => {
    expect(validateJobForm(form({ salaryMax: '9'.repeat(20) })).salaryMax).toBeDefined();
  });

  it('mínimo mayor que máximo da error en el mínimo', () => {
    const errors = validateJobForm(form({ salaryMin: '50000', salaryMax: '40000' }));
    expect(errors).toEqual({ salaryMin: 'El salario mínimo no puede ser mayor que el máximo.' });
  });

  it('mínimo igual al máximo, o solo uno de los dos, son válidos', () => {
    expect(validateJobForm(form({ salaryMin: '40000', salaryMax: '40000' }))).toEqual({});
    expect(validateJobForm(form({ salaryMin: '40000' }))).toEqual({});
    expect(validateJobForm(form({ salaryMax: '40000' }))).toEqual({});
  });

  it('acumula los errores de varios campos', () => {
    const errors = validateJobForm(form({ title: '', workMode: 'x', salaryMax: '0' }));
    expect(Object.keys(errors).sort()).toEqual(['salaryMax', 'title', 'workMode']);
  });
});

describe('toCreateInput (CA-02, EC-02, EC-03)', () => {
  it('con solo el título envía solo el título', () => {
    expect(toCreateInput(form())).toEqual({ title: 'Desarrollador/a backend (Node.js)' });
  });

  it('recorta los textos, convierte los salarios y conserva «híbrida» en NFC', () => {
    const input = toCreateInput(
      form({
        title: '  Técnica/o de selección  ',
        description: '  Busca talento.  ',
        location: ' Valencia ',
        workMode: 'híbrida',
        salaryMin: '32000',
        salaryMax: ' 40000 ',
      }),
    );

    expect(input).toEqual({
      title: 'Técnica/o de selección',
      description: 'Busca talento.',
      location: 'Valencia',
      workMode: 'híbrida',
      salaryMin: 32000,
      salaryMax: 40000,
    });
    expect(input.workMode?.normalize('NFC')).toBe(input.workMode);
  });

  it('omite los opcionales vacíos o de solo espacios', () => {
    const input = toCreateInput(form({ description: '   ', location: '', workMode: '' }));
    expect(Object.keys(input)).toEqual(['title']);
  });

  it('nunca incluye status, createdAt ni id', () => {
    const input = toCreateInput(form({ description: 'x', salaryMin: '1' }));
    for (const key of ['status', 'createdAt', 'id']) expect(key in input).toBe(false);
  });
});
