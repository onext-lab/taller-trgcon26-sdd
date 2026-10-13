import { describe, expect, it } from 'vitest';
import {
  EMPTY_FORM,
  FIELD_ORDER,
  jobToForm,
  toCreateInput,
  toPatch,
  validateJobForm,
  type JobFormValues,
} from '../../../src/features/jobs/job-form-model.ts';
import { makeJob } from './fixtures.ts';

// Invented data only.
function form(overrides: Partial<JobFormValues> = {}): JobFormValues {
  return { ...EMPTY_FORM, title: 'Desarrollador/a backend (Node.js)', ...overrides };
}

describe('modelo del formulario · fecha límite de inscripción', () => {
  it('el campo va el último de FIELD_ORDER y el formulario vacío lo tiene vacío', () => {
    expect(FIELD_ORDER.at(-1)).toBe('enrollmentDeadline');
    expect(EMPTY_FORM.enrollmentDeadline).toBe('');
  });

  it('CA-01 vacío es válido y una fecha con forma de día también', () => {
    expect(validateJobForm(form())).toEqual({});
    expect(validateJobForm(form({ enrollmentDeadline: '2026-10-13' }))).toEqual({});
    expect(validateJobForm(form({ enrollmentDeadline: '2020-01-01' }))).toEqual({});
  });

  it.each(['2026-02-31', '13/10/2026', '2026-10-13T00:00:00Z', 'mañana', ' '])(
    'EC-17 «%s» no es una fecha válida',
    (enrollmentDeadline) => {
      const errors = validateJobForm(form({ enrollmentDeadline }));
      expect(errors).toEqual({ enrollmentDeadline: 'Introduce una fecha válida.' });
    },
  );

  it('el error de la fecha convive con los de otros campos y con los de publicada', () => {
    const errors = validateJobForm(form({ title: '', enrollmentDeadline: 'x' }), {
      published: true,
    });
    expect(errors.title).toBe('Escribe un título.');
    expect(errors.description).toBe('Obligatorio en una oferta publicada.');
    expect(errors.enrollmentDeadline).toBe('Introduce una fecha válida.');
  });

  it('toCreateInput omite una fecha vacía y envía la escrita', () => {
    expect(toCreateInput(form())).not.toHaveProperty('enrollmentDeadline');
    expect(toCreateInput(form({ enrollmentDeadline: '2026-12-31' }))).toEqual({
      title: 'Desarrollador/a backend (Node.js)',
      enrollmentDeadline: '2026-12-31',
    });
  });

  it('EC-21 jobToForm convierte null en cadena vacía y conserva la fecha', () => {
    expect(jobToForm(makeJob({ enrollmentDeadline: null })).enrollmentDeadline).toBe('');
    expect(jobToForm(makeJob({ enrollmentDeadline: '2026-12-31' })).enrollmentDeadline).toBe(
      '2026-12-31',
    );
  });

  it('CA-03 toPatch envía solo la fecha cuando cambia', () => {
    const original = makeJob({ status: 'published', enrollmentDeadline: '2026-12-31' });
    const values = { ...jobToForm(original), enrollmentDeadline: '2027-01-15' };
    expect(toPatch(original, values)).toEqual({ enrollmentDeadline: '2027-01-15' });
  });

  it('CA-03/EC-18 toPatch envía null al vaciar una fecha que existía', () => {
    const original = makeJob({ enrollmentDeadline: '2026-12-31' });
    const values = { ...jobToForm(original), enrollmentDeadline: '' };
    expect(toPatch(original, values)).toEqual({ enrollmentDeadline: null });
  });

  it('CA-05/EC-23 toPatch no envía la fecha si no cambia, también la vencida y la vacía', () => {
    for (const enrollmentDeadline of ['2020-01-01', null]) {
      const original = makeJob({ enrollmentDeadline });
      const values = { ...jobToForm(original), description: 'Otra descripción.' };
      expect(toPatch(original, values)).toEqual({ description: 'Otra descripción.' });
      expect(toPatch(original, jobToForm(original))).toEqual({});
    }
  });
});
