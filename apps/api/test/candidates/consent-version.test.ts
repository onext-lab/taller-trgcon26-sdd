import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Tie between the web and the API without importing across workspaces (DD-07): both files are read as text and the
 * constant is extracted with a strict regex that throws if it is not found, so a rename cannot silence the test.
 */
const WEB_CONSENT = new URL('../../../web/src/features/candidates/consent.ts', import.meta.url);
const API_SCHEMAS = new URL('../../src/modules/candidates/schemas.ts', import.meta.url);
const API_RETENTION = new URL('../../src/modules/candidates/retention.ts', import.meta.url);

function extract(file: URL, pattern: RegExp, name: string): string {
  const match = pattern.exec(readFileSync(file, 'utf8'));
  if (match?.[1] === undefined) throw new Error(`${name} not found in ${file.pathname}`);
  return match[1];
}

function webVersion(): string {
  return extract(WEB_CONSENT, /^export const CONSENT_VERSION = '([^']+)';$/m, 'CONSENT_VERSION');
}

function apiVersion(): string {
  return extract(
    API_SCHEMAS,
    /^export const CONSENT_TEXT_VERSION = '([^']+)';$/m,
    'CONSENT_TEXT_VERSION',
  );
}

describe('versión del consentimiento atada entre web y API (T-04)', () => {
  it('T-04 CONSENT_VERSION de la web y CONSENT_TEXT_VERSION de la API coinciden', () => {
    expect(webVersion()).toBe(apiVersion());
  });

  it('T-04 el texto del consentimiento menciona los meses de CONSENT_MONTHS de la retención', () => {
    const months = extract(API_RETENTION, /^const CONSENT_MONTHS = (\d+);$/m, 'CONSENT_MONTHS');
    const text = extract(
      WEB_CONSENT,
      /^export const CONSENT_TEXT =\s*'([^']+)';$/m,
      'CONSENT_TEXT',
    );

    expect(text).toContain(`${months} meses`);
  });
});
