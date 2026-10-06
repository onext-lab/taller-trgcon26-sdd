import { describe, expect, it } from 'vitest';
import {
  noCandidateProcesses,
  type CandidateProcesses,
} from '../../src/modules/candidates/processes-port.ts';
import {
  addMonthsClamped,
  computeRetentionEndsAt,
  madridCalendarDate,
  type RetentionFacts,
} from '../../src/modules/candidates/retention.ts';

// Datos inventados. La fórmula es pura: sin reloj ni base.
const NEVER: CandidateProcesses = noCandidateProcesses.getProcesses(1);
const OPEN: CandidateProcesses = {
  hasOpenApplication: true,
  hadAnyApplication: true,
  lastProcessClosedAt: null,
};
function closedAt(instant: string): CandidateProcesses {
  return { hasOpenApplication: false, hadAnyApplication: true, lastProcessClosedAt: instant };
}

function facts(overrides: Partial<RetentionFacts> = {}): RetentionFacts {
  return {
    createdAt: '2026-10-06T10:00:00.000Z',
    consentGivenAt: null,
    consentWithdrawnAt: null,
    processes: NEVER,
    ...overrides,
  };
}

describe('puerto por defecto', () => {
  it('CA-31 noCandidateProcesses responde sin inscripciones y sin cierre', () => {
    expect(noCandidateProcesses.getProcesses(42)).toEqual({
      hasOpenApplication: false,
      hadAnyApplication: false,
      lastProcessClosedAt: null,
    });
  });
});

describe('madridCalendarDate', () => {
  it.each<[string, string, string]>([
    ['pasada la medianoche en horario de verano', '2026-10-06T22:30:00.000Z', '2026-10-07'],
    ['en invierno (UTC+1)', '2026-12-31T23:30:00.000Z', '2027-01-01'],
    ['mediodía sin cambio de día', '2026-07-15T12:00:00.000Z', '2026-07-15'],
    ['antes del cambio de hora de otoño', '2026-10-25T00:30:00.000Z', '2026-10-25'],
  ])('devuelve el día natural de Madrid: %s', (_case, instant, expected) => {
    expect(madridCalendarDate(instant)).toBe(expected);
  });

  it('lanza RangeError con un instante no válido', () => {
    expect(() => madridCalendarDate('no-es-una-fecha')).toThrow(RangeError);
  });
});

describe('addMonthsClamped', () => {
  it.each<[string, number, string]>([
    ['2026-10-07', 6, '2027-04-07'],
    ['2026-08-31', 6, '2027-02-28'],
    ['2027-08-31', 6, '2028-02-29'],
    ['2026-03-31', 6, '2026-09-30'],
    ['2026-07-31', 24, '2028-07-31'],
    ['2026-11-30', 3, '2027-02-28'],
  ])('%s + %i meses = %s', (date, months, expected) => {
    expect(addMonthsClamped(date, months)).toBe(expected);
  });

  it('EC-44 2028-02-29 + 24 meses = 2030-02-28', () => {
    expect(addMonthsClamped('2028-02-29', 24)).toBe('2030-02-28');
  });

  it('lanza RangeError con una fecha mal formada', () => {
    expect(() => addMonthsClamped('2026-10', 6)).toThrow(RangeError);
  });
});

describe('CA-02 / EC-51 alta + 6 meses sin inscripciones ni consentimiento', () => {
  it.each<[string, string, string]>([
    ['alta a las 22:30Z, ya día 07 en Madrid', '2026-10-06T22:30:00.000Z', '2027-04-07'],
    ['alta 31 de agosto, febrero corto', '2026-08-31T10:00:00.000Z', '2027-02-28'],
    ['alta 31 de agosto, febrero bisiesto', '2027-08-31T10:00:00.000Z', '2028-02-29'],
    ['alta en la noche del cambio de hora', '2026-10-25T00:30:00.000Z', '2027-04-25'],
    ['alta 31 de marzo, septiembre corto', '2026-03-31T10:00:00.000Z', '2026-09-30'],
  ])('%s', (_case, createdAt, expected) => {
    expect(computeRetentionEndsAt(facts({ createdAt }))).toBe(expected);
  });
});

describe('CA-31 filas de RGPD §3', () => {
  it('inscripción abierta: sin fecha de fin', () => {
    expect(computeRetentionEndsAt(facts({ processes: OPEN }))).toBeNull();
  });

  it('proceso cerrado sin consentimiento: cierre + 6 meses', () => {
    const processes = closedAt('2026-09-15T08:00:00.000Z');
    expect(computeRetentionEndsAt(facts({ processes }))).toBe('2027-03-15');
  });

  it('consentimiento vigente: consentimiento + 24 meses', () => {
    const consentGivenAt = '2026-10-06T10:00:00.000Z';
    expect(computeRetentionEndsAt(facts({ consentGivenAt }))).toBe('2028-10-06');
  });

  it('sin inscripciones ni consentimiento: alta + 6 meses', () => {
    expect(computeRetentionEndsAt(facts())).toBe('2027-04-06');
  });

  it('consentimiento retirado sin inscripciones: vuelve a alta + 6 meses', () => {
    const f = facts({
      consentGivenAt: '2026-10-07T10:00:00.000Z',
      consentWithdrawnAt: '2026-10-08T10:00:00.000Z',
    });
    expect(computeRetentionEndsAt(f)).toBe('2027-04-06');
  });

  it('proceso cerrado con consentimiento retirado: cierre + 6 meses', () => {
    const f = facts({
      consentGivenAt: '2025-01-10T10:00:00.000Z',
      consentWithdrawnAt: '2025-02-10T10:00:00.000Z',
      processes: closedAt('2026-09-15T08:00:00.000Z'),
    });
    expect(computeRetentionEndsAt(f)).toBe('2027-03-15');
  });
});

describe('varias filas a la vez', () => {
  it('EC-52 consentimiento del 2025-01-10 y cierre del 2026-09-15: gana la más tardía (2027-03-15)', () => {
    const f = facts({
      consentGivenAt: '2025-01-10T10:00:00.000Z',
      processes: closedAt('2026-09-15T08:00:00.000Z'),
    });
    expect(computeRetentionEndsAt(f)).toBe('2027-03-15');
  });

  it('gana el consentimiento cuando es más tardío que cierre + 6 meses', () => {
    const f = facts({
      consentGivenAt: '2026-09-01T10:00:00.000Z',
      processes: closedAt('2026-03-15T08:00:00.000Z'),
    });
    expect(computeRetentionEndsAt(f)).toBe('2028-09-01');
  });
});

describe('EC-55 y puerto incoherente', () => {
  it('EC-55 inscripción abierta y cierre anterior con consentimiento retirado: sin fecha de fin', () => {
    const f = facts({
      consentGivenAt: '2025-01-10T10:00:00.000Z',
      consentWithdrawnAt: '2025-06-10T10:00:00.000Z',
      processes: {
        hasOpenApplication: true,
        hadAnyApplication: true,
        lastProcessClosedAt: '2026-09-15T08:00:00.000Z',
      },
    });
    expect(computeRetentionEndsAt(f)).toBeNull();
  });

  it('EC-55 la inscripción abierta manda aunque el consentimiento siga vigente', () => {
    const f = facts({ consentGivenAt: '2026-10-01T10:00:00.000Z', processes: OPEN });
    expect(computeRetentionEndsAt(f)).toBeNull();
  });

  it('lanza Error si hay inscripciones, ninguna abierta, sin cierre y sin consentimiento vigente', () => {
    const processes: CandidateProcesses = {
      hasOpenApplication: false,
      hadAnyApplication: true,
      lastProcessClosedAt: null,
    };
    expect(() => computeRetentionEndsAt(facts({ processes }))).toThrow(Error);
  });

  it('lanza Error también con el consentimiento retirado si el puerto incumple su contrato', () => {
    const f = facts({
      consentGivenAt: '2025-01-10T10:00:00.000Z',
      consentWithdrawnAt: '2025-06-10T10:00:00.000Z',
      processes: { hasOpenApplication: false, hadAnyApplication: true, lastProcessClosedAt: null },
    });
    expect(() => computeRetentionEndsAt(f)).toThrow(/incoherente/);
  });
});

describe('EC-57 idempotencia', () => {
  it('dos llamadas con los mismos datos dan la misma fecha y no mutan la entrada', () => {
    const f = facts({
      consentGivenAt: '2025-01-10T10:00:00.000Z',
      processes: closedAt('2026-09-15T08:00:00.000Z'),
    });
    const snapshot = structuredClone(f);
    expect(computeRetentionEndsAt(f)).toBe(computeRetentionEndsAt(f));
    expect(f).toEqual(snapshot);
  });
});
