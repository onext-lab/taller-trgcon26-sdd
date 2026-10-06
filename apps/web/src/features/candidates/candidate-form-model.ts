import type { Candidate, CandidateInput, CandidatePatch } from './types.ts';

/**
 * Pure model of the candidate form (DD-09, DD-10): the state is kept as strings (plus the consent box),
 * validation mirrors RF-02 (the API has the last word) and `toCreateInput` builds the body of
 * `POST /api/candidates`; `candidateToForm` and `toPatch` serve the edit mode.
 */

export const FIELD_ORDER = ['fullName', 'email', 'phone', 'summary', 'skills'] as const;
export type FieldName = (typeof FIELD_ORDER)[number];

export type CandidateFormValues = Record<FieldName, string> & { consent: boolean };
export type CandidateFormErrors = Partial<Record<FieldName, string>>;

export const EMPTY_FORM: CandidateFormValues = {
  fullName: '',
  email: '',
  phone: '',
  summary: '',
  skills: '',
  consent: false,
};

export function isFieldName(value: string): value is FieldName {
  return (FIELD_ORDER as readonly string[]).includes(value);
}

const NAME_RANGE = { min: 2, max: 100 };
const EMAIL_MAX = 254;
const SUMMARY_MAX = 2000;
const SKILL_MAX = 40;
const SKILLS_MAX_COUNT = 20;
// Lax on purpose: the API has the last word on the format of the email.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9 ()-]{6,20}$/;
const PHONE_MIN_DIGITS = 6;

const MESSAGES = {
  nameEmpty: 'Escribe el nombre y los apellidos.',
  nameRange: 'El nombre y los apellidos deben tener entre 2 y 100 caracteres.',
  emailEmpty: 'Escribe el email.',
  emailLong: 'El email no puede pasar de 254 caracteres.',
  emailFormat: 'Escribe un email válido, como nombre@example.com.',
  phone:
    'Escribe entre 6 y 20 dígitos, espacios, guiones o paréntesis, con al menos 6 dígitos y un «+» opcional delante.',
  summary: 'El resumen no puede pasar de 2 000 caracteres.',
  skillsCount: 'Indica como máximo 20 skills distintas.',
  skillsLength: 'Cada skill puede tener como máximo 40 caracteres.',
  control: 'No puede tener caracteres de control.',
} as const;

// Length in code points, like Ajv in the API: `text.length` counts UTF-16 units and would reject emoji.
function length(text: string): number {
  return Array.from(text).length;
}

// C0 and DEL; the summary (long text) also admits tab, line feed and carriage return (DT-06).
function hasControl(text: string, allowWhitespace = false): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (allowWhitespace && (code === 9 || code === 10 || code === 13)) continue;
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/** Skills of the text: split by commas, trimmed, empty ones dropped; no lower-casing, no deduplication. */
export function parseSkills(text: string): string[] {
  return text
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token !== '');
}

// What the server will store (RN-04): lower case, first appearance wins. Counts and sizes use this list.
function distinctSkills(tokens: string[]): string[] {
  return [...new Set(tokens.map((token) => token.toLowerCase()))];
}

function fullNameError(raw: string): string | undefined {
  const text = raw.trim();
  const size = length(text);
  if (size === 0) return MESSAGES.nameEmpty;
  if (size < NAME_RANGE.min || size > NAME_RANGE.max) return MESSAGES.nameRange;
  return hasControl(text) ? MESSAGES.control : undefined;
}

function emailError(raw: string): string | undefined {
  const text = raw.trim();
  if (text === '') return MESSAGES.emailEmpty;
  if (length(text) > EMAIL_MAX) return MESSAGES.emailLong;
  if (!EMAIL_PATTERN.test(text)) return MESSAGES.emailFormat;
  return hasControl(text) ? MESSAGES.control : undefined;
}

function phoneError(raw: string): string | undefined {
  const text = raw.trim();
  if (text === '') return undefined;
  const digits = text.replace(/[^0-9]/g, '').length;
  return PHONE_PATTERN.test(text) && digits >= PHONE_MIN_DIGITS ? undefined : MESSAGES.phone;
}

function summaryError(raw: string): string | undefined {
  const text = raw.trim();
  if (length(text) > SUMMARY_MAX) return MESSAGES.summary;
  return hasControl(text, true) ? MESSAGES.control : undefined;
}

function skillsError(raw: string): string | undefined {
  const distinct = distinctSkills(parseSkills(raw));
  if (distinct.length > SKILLS_MAX_COUNT) return MESSAGES.skillsCount;
  if (distinct.some((skill) => length(skill) > SKILL_MAX)) return MESSAGES.skillsLength;
  return hasControl(raw) ? MESSAGES.control : undefined;
}

/** Errors by field, with the messages of RF-02; an empty object means the form is valid. */
export function validateCandidateForm(values: CandidateFormValues): CandidateFormErrors {
  const found: CandidateFormErrors = {
    fullName: fullNameError(values.fullName),
    email: emailError(values.email),
    phone: phoneError(values.phone),
    summary: summaryError(values.summary),
    skills: skillsError(values.skills),
  };
  const errors: CandidateFormErrors = {};
  for (const field of FIELD_ORDER) {
    const message = found[field];
    if (message !== undefined) errors[field] = message;
  }
  return errors;
}

/**
 * Body of `POST /api/candidates` from a valid form: trimmed texts, empty optionals omitted, skills as the
 * trimmed tokens in their order (the server lower-cases and deduplicates, DD-10), `consent` always a boolean.
 * Never `id`, dates, consent version or `retentionEndsAt`.
 */
export function toCreateInput(values: CandidateFormValues): CandidateInput {
  const input: CandidateInput = {
    fullName: values.fullName.trim(),
    email: values.email.trim(),
    consent: values.consent,
  };
  const phone = values.phone.trim();
  if (phone !== '') input.phone = phone;
  const summary = values.summary.trim();
  if (summary !== '') input.summary = summary;
  const skills = parseSkills(values.skills);
  if (skills.length > 0) input.skills = skills;
  return input;
}

/** Form values of an existing candidate: `null` becomes an empty string, skills go separated by commas. */
export function candidateToForm(candidate: Candidate): CandidateFormValues {
  return {
    fullName: candidate.fullName,
    email: candidate.email,
    phone: candidate.phone ?? '',
    summary: candidate.summary ?? '',
    skills: candidate.skills.join(', '),
    consent: false,
  };
}

// Text fields are compared already trimmed; an empty optional is `null`, never `""`.
function textOrNull(raw: string): string | null {
  const text = raw.trim();
  return text === '' ? null : text;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Body of `PATCH /api/candidates/:id` from a valid form (DD-09): only the fields whose trimmed value differs
 * from `original`; an emptied `phone` or `summary` goes as `null` and emptied skills as `[]`. `{}` means
 * nothing changed (the caller sends no request). Never the consent, `id`, dates or `retentionEndsAt`.
 */
export function toPatch(original: Candidate, values: CandidateFormValues): CandidatePatch {
  const patch: CandidatePatch = {};
  const fullName = values.fullName.trim();
  if (fullName !== original.fullName) patch.fullName = fullName;
  const email = values.email.trim();
  if (email !== original.email) patch.email = email;
  const phone = textOrNull(values.phone);
  if (phone !== original.phone) patch.phone = phone;
  const summary = textOrNull(values.summary);
  if (summary !== original.summary) patch.summary = summary;
  const skills = parseSkills(values.skills);
  if (!sameList(skills, original.skills)) patch.skills = skills;
  return patch;
}
