import { describe, expect, it } from 'vitest';
import {
  canEnroll,
  deadlinePassedText,
  groupByStage,
  nextStage,
  rejectionReasonLabel,
  stageLabel,
} from '../../../src/features/applications/labels.ts';
import {
  REJECTION_REASONS,
  STAGES,
  type PipelineJobStatus,
} from '../../../src/features/applications/types.ts';
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

describe('nextStage', () => {
  it('sigue la tabla de INV-04 en las 6 etapas', () => {
    expect(STAGES.map(nextStage)).toEqual(['screening', 'interview', 'offer', 'hired', null, null]);
  });

  it('EC-04 nextStage nunca devuelve received ni rejected; null en hired y rejected', () => {
    const results = STAGES.map(nextStage);

    expect(results).not.toContain('received');
    expect(results).not.toContain('rejected');
    expect(nextStage('hired')).toBeNull();
    expect(nextStage('rejected')).toBeNull();
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

describe('plazo de inscripción', () => {
  it('deadlinePassedText da el texto de DT-01 con la fecha dd/mm/aaaa', () => {
    expect(deadlinePassedText('2026-10-13')).toBe(
      'El plazo de inscripción terminó el 13/10/2026: no se pueden inscribir más candidatos.',
    );
  });

  it.each<[PipelineJobStatus, boolean, boolean]>([
    ['draft', false, false],
    ['draft', true, false],
    ['published', false, true],
    ['published', true, false],
    ['closed', false, false],
    ['closed', true, false],
  ])('canEnroll(%s, vencido: %s) → %s', (status, enrollmentDeadlinePassed, expected) => {
    expect(canEnroll({ status, enrollmentDeadlinePassed })).toBe(expected);
  });
});
