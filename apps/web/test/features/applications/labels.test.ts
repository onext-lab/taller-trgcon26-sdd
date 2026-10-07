import { describe, expect, it } from 'vitest';
import {
  groupByStage,
  rejectionReasonLabel,
  stageLabel,
} from '../../../src/features/applications/labels.ts';
import { REJECTION_REASONS, STAGES } from '../../../src/features/applications/types.ts';
import { PUBLISHED_PIPELINE } from './fixtures.ts';

describe('etiquetas de inscripciones', () => {
  it('las 6 etapas tienen su etiqueta, en el orden del pipeline', () => {
    expect(STAGES.map(stageLabel)).toEqual([
      'Recibida',
      'Cribado',
      'Entrevista',
      'Oferta',
      'Contratado',
      'Rechazado',
    ]);
  });

  it('los 4 motivos de rechazo tienen su etiqueta', () => {
    expect(REJECTION_REASONS.map(rejectionReasonLabel)).toEqual([
      'No encaja con el perfil',
      'Retirada del candidato',
      'Otro',
      'Oferta cerrada',
    ]);
  });
});

describe('groupByStage', () => {
  it('agrupa por etapa conservando el orden recibido (DD-08)', () => {
    const groups = groupByStage(PUBLISHED_PIPELINE.items);

    expect(groups.received.map((card) => card.id)).toEqual([31, 30]);
    expect(groups.rejected.map((card) => card.id)).toEqual([25, 24, 23, 22]);
    expect(groups.hired.map((card) => card.id)).toEqual([26]);
  });

  it('no reordena: un orden distinto del habitual se respeta', () => {
    const [first, second] = PUBLISHED_PIPELINE.items.slice(0, 2);
    if (!first || !second) throw new Error('Fixture sin elementos');

    expect(groupByStage([second, first]).received.map((card) => card.id)).toEqual([30, 31]);
  });

  it('devuelve siempre las 6 columnas, también vacías', () => {
    const groups = groupByStage([]);

    expect(Object.keys(groups)).toEqual([...STAGES]);
    expect(Object.values(groups).every((cards) => cards.length === 0)).toBe(true);
  });
});
