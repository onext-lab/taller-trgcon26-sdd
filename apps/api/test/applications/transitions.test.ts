import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/errors.ts';
import { STAGES, type Stage } from '../../src/modules/applications/schemas.ts';
import {
  decideAdvance,
  decideReject,
  isFinal,
  NEXT_STAGE,
  STAGE_MISMATCH_MESSAGE,
} from '../../src/modules/applications/transitions.ts';

// Resultado esperado, escrito como datos (no se recalcula la regla):
//   A = 'apply'; N = 'noop'; M = STAGE_MISMATCH; F = INVALID_TRANSITION de etapa final;
//   S = INVALID_TRANSITION «solo la etapa siguiente»; H = INVALID_TRANSITION de contratada.
type Code = 'A' | 'N' | 'M' | 'F' | 'S' | 'H';

const MISMATCH = { code: 'STAGE_MISMATCH', message: STAGE_MISMATCH_MESSAGE };
const EXPECTED_ERROR: Record<'M' | 'F' | 'S' | 'H', { code: string; message: string }> = {
  M: MISMATCH,
  F: {
    code: 'INVALID_TRANSITION',
    message: 'La inscripción está en una etapa final: no admite cambios.',
  },
  S: { code: 'INVALID_TRANSITION', message: 'Solo se puede avanzar a la etapa siguiente.' },
  H: { code: 'INVALID_TRANSITION', message: 'Una inscripción contratada no se puede rechazar.' },
};

// Filas = etapa esperada; columnas = destino. Orden de ambos: STAGES
// (received, screening, interview, offer, hired, rejected).
const ADVANCE: Record<Stage, Code[][]> = {
  received: [
    ['S', 'A', 'S', 'S', 'S', 'S'],
    ['M', 'M', 'M', 'M', 'M', 'M'],
    ['M', 'M', 'M', 'M', 'M', 'M'],
    ['M', 'M', 'M', 'M', 'M', 'M'],
    ['M', 'M', 'M', 'M', 'M', 'M'],
    ['M', 'M', 'M', 'M', 'M', 'M'],
  ],
  screening: [
    ['M', 'N', 'M', 'M', 'M', 'M'],
    ['S', 'N', 'A', 'S', 'S', 'S'],
    ['M', 'N', 'M', 'M', 'M', 'M'],
    ['M', 'N', 'M', 'M', 'M', 'M'],
    ['M', 'N', 'M', 'M', 'M', 'M'],
    ['M', 'N', 'M', 'M', 'M', 'M'],
  ],
  interview: [
    ['M', 'M', 'N', 'M', 'M', 'M'],
    ['M', 'M', 'N', 'M', 'M', 'M'],
    ['S', 'S', 'N', 'A', 'S', 'S'],
    ['M', 'M', 'N', 'M', 'M', 'M'],
    ['M', 'M', 'N', 'M', 'M', 'M'],
    ['M', 'M', 'N', 'M', 'M', 'M'],
  ],
  offer: [
    ['M', 'M', 'M', 'N', 'M', 'M'],
    ['M', 'M', 'M', 'N', 'M', 'M'],
    ['M', 'M', 'M', 'N', 'M', 'M'],
    ['S', 'S', 'S', 'N', 'A', 'S'],
    ['M', 'M', 'M', 'N', 'M', 'M'],
    ['M', 'M', 'M', 'N', 'M', 'M'],
  ],
  hired: [
    ['M', 'M', 'M', 'M', 'N', 'M'],
    ['M', 'M', 'M', 'M', 'N', 'M'],
    ['M', 'M', 'M', 'M', 'N', 'M'],
    ['M', 'M', 'M', 'M', 'N', 'M'],
    ['F', 'F', 'F', 'F', 'N', 'F'],
    ['M', 'M', 'M', 'M', 'N', 'M'],
  ],
  rejected: [
    ['M', 'M', 'M', 'M', 'M', 'M'],
    ['M', 'M', 'M', 'M', 'M', 'M'],
    ['M', 'M', 'M', 'M', 'M', 'M'],
    ['M', 'M', 'M', 'M', 'M', 'M'],
    ['M', 'M', 'M', 'M', 'M', 'M'],
    ['F', 'F', 'F', 'F', 'F', 'F'],
  ],
};

// Filas = etapa actual; columnas = etapa esperada.
const REJECT: Record<Stage, Code[]> = {
  received: ['A', 'M', 'M', 'M', 'M', 'M'],
  screening: ['M', 'A', 'M', 'M', 'M', 'M'],
  interview: ['M', 'M', 'A', 'M', 'M', 'M'],
  offer: ['M', 'M', 'M', 'A', 'M', 'M'],
  hired: ['M', 'M', 'M', 'M', 'H', 'M'],
  rejected: ['N', 'N', 'N', 'N', 'N', 'N'],
};

function outcomeOf(run: () => 'apply' | 'noop'): Code | AppError {
  try {
    return run() === 'apply' ? 'A' : 'N';
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
}

function expectOutcome(actual: Code | AppError, code: Code): void {
  if (code === 'A' || code === 'N') {
    expect(actual).toBe(code);
    return;
  }
  expect(actual).toBeInstanceOf(AppError);
  const error = actual as AppError;
  expect({ code: error.code, message: error.message }).toEqual(EXPECTED_ERROR[code]);
  expect(error.statusCode).toBe(409);
  expect(error.details).toBeUndefined();
}

const advanceCases = STAGES.flatMap((current) =>
  STAGES.flatMap((expected, e) =>
    STAGES.map((to, t) => ({ current, expected, to, code: ADVANCE[current][e]![t]! })),
  ),
);
const rejectCases = STAGES.flatMap((current) =>
  STAGES.map((expected, e) => ({ current, expected, code: REJECT[current][e]! })),
);

describe('decideAdvance', () => {
  it('decideAdvance: tabla completa etapa actual × esperada × destino', () => {
    expect(advanceCases).toHaveLength(216);
  });

  it.each(advanceCases)(
    'decideAdvance: actual $current, esperada $expected, destino $to -> $code',
    ({ current, expected, to, code }) => {
      const actual = outcomeOf(() =>
        decideAdvance(current, { expectedStage: expected, toStage: to }),
      );
      expectOutcome(actual, code);
    },
  );

  it('RV-23: interview con esperada screening y destino interview es noop', () => {
    expect(decideAdvance('interview', { expectedStage: 'screening', toStage: 'interview' })).toBe(
      'noop',
    );
  });

  it('EC-04: received -> received y rejected -> rejected con la esperada al día son INVALID_TRANSITION', () => {
    expect(() =>
      decideAdvance('received', { expectedStage: 'received', toStage: 'received' }),
    ).toThrow(EXPECTED_ERROR.S.message);
    expect(() =>
      decideAdvance('rejected', { expectedStage: 'rejected', toStage: 'rejected' }),
    ).toThrow(EXPECTED_ERROR.F.message);
  });

  it('CA-08: hired y rejected con su etapa como esperada dan el mensaje de etapa final', () => {
    for (const stage of ['hired', 'rejected'] as const) {
      const actual = outcomeOf(() =>
        decideAdvance(stage, { expectedStage: stage, toStage: 'received' }),
      );
      expectOutcome(actual, 'F');
    }
  });

  it('DD-05: esperada desactualizada con destino rejected es STAGE_MISMATCH', () => {
    const actual = outcomeOf(() =>
      decideAdvance('screening', { expectedStage: 'received', toStage: 'rejected' }),
    );
    expectOutcome(actual, 'M');
  });
});

describe('decideReject', () => {
  it('decideReject: tabla completa 6 × 6', () => {
    expect(rejectCases).toHaveLength(36);
  });

  it.each(rejectCases)(
    'decideReject: actual $current, esperada $expected -> $code',
    ({ current, expected, code }) => {
      expectOutcome(
        outcomeOf(() => decideReject(current, expected)),
        code,
      );
    },
  );
});

describe('NEXT_STAGE e isFinal', () => {
  it('encadena received -> screening -> interview -> offer -> hired y no define salida para las finales', () => {
    expect(NEXT_STAGE).toEqual({
      received: 'screening',
      screening: 'interview',
      interview: 'offer',
      offer: 'hired',
    });
    expect(STAGES.filter(isFinal)).toEqual(['hired', 'rejected']);
  });
});
