import { describe, expect, it } from 'vitest';
import {
  activeApplicationsText,
  formatSalaryBand,
  jobFieldLabel,
  jobStatusLabel,
  missingFieldsText,
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

describe('textos del ciclo de vida', () => {
  it('jobFieldLabel traduce los cuatro campos obligatorios', () => {
    expect(['title', 'description', 'location', 'workMode'].map(jobFieldLabel)).toEqual([
      'Título',
      'Descripción',
      'Ubicación',
      'Modalidad',
    ]);
  });

  it('missingFieldsText lista las etiquetas en el orden recibido (CA-03)', () => {
    expect(missingFieldsText(['description', 'workMode'])).toBe(
      'Para publicar falta: Descripción, Modalidad.',
    );
    expect(missingFieldsText(['title'])).toBe('Para publicar falta: Título.');
  });

  it('activeApplicationsText: 0, 1 y 2 (DD-04)', () => {
    expect(activeApplicationsText(0)).toBe('Se rechazarán 0 inscripciones activas.');
    expect(activeApplicationsText(1)).toBe('Se rechazará 1 inscripción activa.');
    expect(activeApplicationsText(2)).toBe('Se rechazarán 2 inscripciones activas.');
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
