import { describe, expect, it } from 'vitest';
import { isJob } from '../../../src/features/jobs/api.ts';
import { makeJob } from './fixtures.ts';

describe('isJob · fecha límite de inscripción', () => {
  it('acepta una fecha de calendario', () => {
    expect(isJob(makeJob({ enrollmentDeadline: '2026-10-13' }))).toBe(true);
  });

  it('acepta null', () => {
    expect(isJob(makeJob({ enrollmentDeadline: null }))).toBe(true);
  });

  it('una oferta sin el campo no es válida', () => {
    const { enrollmentDeadline: _omitted, ...withoutField } = makeJob();
    expect(isJob(withoutField)).toBe(false);
  });

  it.each(['2026-02-31', '13/10/2026', '2026-10-13T00:00:00Z', ''])(
    'rechaza «%s» como fecha límite',
    (value) => {
      expect(isJob(makeJob({ enrollmentDeadline: value }))).toBe(false);
    },
  );

  it('rechaza un valor que no es texto', () => {
    expect(isJob({ ...makeJob(), enrollmentDeadline: 20261013 })).toBe(false);
  });
});
