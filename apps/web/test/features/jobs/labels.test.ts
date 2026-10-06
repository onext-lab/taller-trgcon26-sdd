import { describe, expect, it } from 'vitest';
import {
  formatSalaryBand,
  jobStatusLabel,
  workModeLabel,
} from '../../../src/features/jobs/labels.ts';
import { WORK_MODES } from '../../../src/features/jobs/types.ts';

describe('formatSalaryBand', () => {
  it('con mínimo y máximo iguales (EC-13)', () => {
    expect(formatSalaryBand(40000, 40000)).toBe('40.000 – 40.000 €/año');
  });

  it('con mínimo y máximo distintos', () => {
    expect(formatSalaryBand(32000, 40000)).toBe('32.000 – 40.000 €/año');
  });

  it('solo con mínimo (EC-13)', () => {
    expect(formatSalaryBand(32000, null)).toBe('Desde 32.000 €/año');
  });

  it('solo con máximo (EC-13)', () => {
    expect(formatSalaryBand(null, 40000)).toBe('Hasta 40.000 €/año');
  });

  it('sin ninguno → «Sin indicar»', () => {
    expect(formatSalaryBand(null, null)).toBe('Sin indicar');
  });
});

describe('etiquetas', () => {
  it('estado de la oferta', () => {
    expect(jobStatusLabel('draft')).toBe('Borrador');
    expect(jobStatusLabel('published')).toBe('Publicada');
    expect(jobStatusLabel('closed')).toBe('Cerrada');
  });

  it('modalidad, con «híbrida» en NFC como la API', () => {
    expect(WORK_MODES).toEqual(['presencial', 'híbrida'.normalize('NFC'), 'remota']);
    expect(WORK_MODES.map(workModeLabel)).toEqual(['Presencial', 'Híbrida', 'Remota']);
    expect(workModeLabel(null)).toBe('Sin indicar');
  });
});
