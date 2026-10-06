import { describe, expect, it } from 'vitest';
import {
  CONSENT_TEXT,
  CONSENT_VERSION,
  consentStatus,
  consentSummary,
} from '../../../src/features/candidates/consent.ts';

const NEVER = { consentGivenAt: null, consentVersion: null, consentWithdrawnAt: null };
const ACTIVE = {
  consentGivenAt: '2026-10-06T22:30:00.000Z',
  consentVersion: 'v1',
  consentWithdrawnAt: null,
};
const WITHDRAWN = { ...ACTIVE, consentWithdrawnAt: '2026-12-31T23:00:00.000Z' };

describe('texto y versión del consentimiento (DT-01, S10)', () => {
  it('CA-03 el texto es literal el de DT-01 y la versión es v1', () => {
    expect(CONSENT_TEXT).toBe(
      'El candidato consiente que conservemos sus datos durante 24 meses para tenerle en cuenta en futuros procesos de selección. Puede retirar este consentimiento en cualquier momento.',
    );
    expect(CONSENT_VERSION).toBe('v1');
  });
});

describe('consentStatus', () => {
  it('CA-22 vigente, retirado o nunca dado', () => {
    expect(consentStatus(ACTIVE)).toBe('active');
    expect(consentStatus(WITHDRAWN)).toBe('withdrawn');
    expect(consentStatus(NEVER)).toBe('none');
  });
});

describe('consentSummary', () => {
  it('CA-22 vigente: fecha en Europe/Madrid y la versión guardada', () => {
    expect(consentSummary(ACTIVE)).toBe(
      'Vigente: otorgado el 07/10/2026 con la versión v1 del texto.',
    );
  });

  it('CA-22 retirado: las dos fechas y la versión con la que se otorgó', () => {
    expect(consentSummary(WITHDRAWN)).toBe(
      'Retirado el 01/01/2027. Se otorgó el 07/10/2026 con la versión v1 del texto.',
    );
  });

  it('CA-22 nunca dado', () => {
    expect(consentSummary(NEVER)).toBe('No consta consentimiento para futuros procesos.');
  });

  it('muestra la versión guardada, no la del texto actual', () => {
    expect(consentSummary({ ...ACTIVE, consentVersion: 'v0' })).toContain('versión v0');
  });
});
