import { describe, expect, it } from 'vitest';
import {
  EMPTY_FORM,
  toPatch,
  validateJobForm,
  type JobFormValues,
} from '../../../src/features/jobs/job-form-model.ts';
import type { Job } from '../../../src/features/jobs/types.ts';

// Invented data only.
const REQUIRED = 'Obligatorio en una oferta publicada.';
const PUBLISHED = { published: true };

function form(overrides: Partial<JobFormValues> = {}): JobFormValues {
  return {
    ...EMPTY_FORM,
    title: 'Desarrollador/a backend (Node.js)',
    description: 'Busca talento.',
    location: 'Valencia',
    workMode: 'híbrida',
    ...overrides,
  };
}

const JOB: Job = {
  id: 7,
  title: 'Desarrollador/a backend (Node.js)',
  description: 'Busca talento.',
  location: 'Valencia',
  workMode: 'híbrida',
  salaryMin: 32000,
  salaryMax: 40000,
  status: 'published',
  createdAt: '2026-10-06T09:30:00.000Z',
  publishedAt: '2026-10-06T10:00:00.000Z',
  closedAt: null,
  enrollmentDeadline: null,
};

describe('validateJobForm · oferta publicada (CA-11, EC-17, DD-08)', () => {
  it('acepta una oferta con los cuatro obligatorios y sin banda', () => {
    expect(validateJobForm(form(), PUBLISHED)).toEqual({});
  });

  it('una descripción vacía pide «Obligatorio en una oferta publicada.»', () => {
    expect(validateJobForm(form({ description: '' }), PUBLISHED)).toEqual({
      description: REQUIRED,
    });
  });

  it('una descripción solo de espacios cuenta como vacía', () => {
    expect(validateJobForm(form({ description: ' \t  ' }), PUBLISHED)).toEqual({
      description: REQUIRED,
    });
  });

  it('una ubicación vacía o de espacios pide el obligatorio', () => {
    expect(validateJobForm(form({ location: '' }), PUBLISHED)).toEqual({ location: REQUIRED });
    expect(validateJobForm(form({ location: '   ' }), PUBLISHED)).toEqual({ location: REQUIRED });
  });

  it('una modalidad sin valor pide el obligatorio', () => {
    expect(validateJobForm(form({ workMode: '' }), PUBLISHED)).toEqual({ workMode: REQUIRED });
  });

  it('un título vacío sigue con su mensaje de siempre', () => {
    expect(validateJobForm(form({ title: ' ' }), PUBLISHED)).toEqual({
      title: 'Escribe un título.',
    });
  });

  it('suma los obligatorios y los errores de la banda', () => {
    const errors = validateJobForm(
      form({ description: '', location: '', workMode: '', salaryMin: '50000', salaryMax: '40000' }),
      PUBLISHED,
    );
    expect(errors).toEqual({
      description: REQUIRED,
      location: REQUIRED,
      workMode: REQUIRED,
      salaryMin: 'El salario mínimo no puede ser mayor que el máximo.',
    });
  });

  it('una ubicación de un solo carácter conserva su mensaje de longitud', () => {
    expect(validateJobForm(form({ location: 'V' }), PUBLISHED).location).toBe(
      'La ubicación debe tener entre 2 y 120 caracteres.',
    );
  });
});

describe('validateJobForm · sin la opción published (borrador, como HU-01)', () => {
  it('acepta solo el título', () => {
    expect(validateJobForm({ ...EMPTY_FORM, title: 'Desarrollador/a' })).toEqual({});
    expect(validateJobForm({ ...EMPTY_FORM, title: 'Desarrollador/a' }, {})).toEqual({});
    expect(
      validateJobForm({ ...EMPTY_FORM, title: 'Desarrollador/a' }, { published: false }),
    ).toEqual({});
  });
});

describe('toPatch · oferta publicada (EC-19, EC-23)', () => {
  it('cambiar solo la banda envía solo salaryMin', () => {
    const patch = toPatch(JOB, { ...form(), salaryMin: '35000', salaryMax: '40000' });
    expect(patch).toEqual({ salaryMin: 35000 });
  });

  it('nunca envía status, fechas ni id', () => {
    const same = { salaryMin: '32000', salaryMax: '40000' };
    const patch = toPatch(JOB, form({ ...same, title: 'Otro título', description: 'Otra.' }));
    expect(Object.keys(patch).sort()).toEqual(['description', 'title']);
  });

  it('EC-23 [adversarial] cambiando todos los campos solo salen los editables, nunca status ni fechas', () => {
    const patch = toPatch(
      JOB,
      form({
        title: 'Otro título',
        description: '',
        location: 'Bilbao',
        workMode: 'remota',
        salaryMin: '',
        salaryMax: '',
      }),
    );
    expect(Object.keys(patch).sort()).toEqual([
      'description',
      'location',
      'salaryMax',
      'salaryMin',
      'title',
      'workMode',
    ]);
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('publishedAt');
    expect(patch).not.toHaveProperty('closedAt');
  });

  it('EC-23 [adversarial] un valor que parece status o fecha en un campo de texto no crea esas claves', () => {
    const values = form({
      title: 'closed',
      description: '2026-10-06T10:00:00.000Z',
      location: 'published',
      salaryMin: '32000',
      salaryMax: '40000',
    });
    const patch = toPatch(JOB, {
      ...values,
      status: 'closed',
      publishedAt: 'x',
      closedAt: 'y',
    } as JobFormValues);
    expect(Object.keys(patch).sort()).toEqual(['description', 'location', 'title']);
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('publishedAt');
    expect(patch).not.toHaveProperty('closedAt');
  });

  it('EC-23 [adversarial] sin cambios devuelve {} aunque la oferta tenga fechas y estado', () => {
    expect(
      toPatch(
        { ...JOB, status: 'closed', closedAt: '2026-10-07T08:00:00.000Z' },
        form({ salaryMin: '32000', salaryMax: '40000' }),
      ),
    ).toEqual({});
  });
});
