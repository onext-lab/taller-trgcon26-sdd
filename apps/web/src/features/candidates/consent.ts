import { formatDate } from '../../components/format.ts';
import type { Candidate } from './types.ts';

/** Text of the consent (DT-01, DD-04): the same constant as the API (S10). */
export const CONSENT_TEXT =
  'El candidato consiente que conservemos sus datos durante 24 meses para tenerle en cuenta en futuros procesos de selección. Puede retirar este consentimiento en cualquier momento.';

/** Version of the text shown next to the checkbox of the sign-up form. */
export const CONSENT_VERSION = 'v1';

export type ConsentStatus = 'active' | 'withdrawn' | 'none';

type ConsentFields = Pick<Candidate, 'consentGivenAt' | 'consentVersion' | 'consentWithdrawnAt'>;

/** `active`: given and not withdrawn; `withdrawn`: given and withdrawn; `none`: never given. */
export function consentStatus(candidate: ConsentFields): ConsentStatus {
  if (candidate.consentGivenAt === null) return 'none';
  return candidate.consentWithdrawnAt === null ? 'active' : 'withdrawn';
}

function givenText(candidate: ConsentFields, verb: 'otorgado' | 'Se otorgó'): string {
  const date = formatDate(candidate.consentGivenAt ?? '');
  const version =
    candidate.consentVersion === null
      ? ''
      : ` con la versión ${candidate.consentVersion} del texto`;
  return `${verb} el ${date}${version}.`;
}

/** Summary line of the consent section; the version shown is the saved one, never the current text's. */
export function consentSummary(candidate: ConsentFields): string {
  const status = consentStatus(candidate);
  if (status === 'none') return 'No consta consentimiento para futuros procesos.';
  if (status === 'active') return `Vigente: ${givenText(candidate, 'otorgado')}`;
  const withdrawn = formatDate(candidate.consentWithdrawnAt ?? '');
  return `Retirado el ${withdrawn}. ${givenText(candidate, 'Se otorgó')}`;
}
