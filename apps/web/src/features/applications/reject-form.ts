import { rejectionReasonLabel } from './labels.ts';
import { MANUAL_REJECTION_REASONS } from './types.ts';
import type { ManualRejectionReason } from './types.ts';

export const NOTE_MAX = 500;

export const REASON_REQUIRED_MESSAGE = 'Elige un motivo.';
export const NOTE_TOO_LONG_MESSAGE = 'La nota no puede pasar de 500 caracteres.';
export const NOTE_CONTROL_MESSAGE = 'La nota no puede tener caracteres de control.';

/** The three reasons of the form, in order; `job_closed` is never offered (DD-03). */
export const REASON_OPTIONS: readonly { code: ManualRejectionReason; label: string }[] =
  MANUAL_REJECTION_REASONS.map((code) => ({ code, label: rejectionReasonLabel(code) }));

export interface RejectFormValues {
  reason: ManualRejectionReason | '';
  note: string;
}

export interface RejectFormErrors {
  reason?: string;
  note?: string;
}

export type RejectFormResult =
  | { ok: true; input: { reason: ManualRejectionReason; note?: string } }
  | { ok: false; errors: RejectFormErrors };

/** Code points of the trimmed note: the same count as the API (Ajv) and the counter of the form (DD-07). */
export function noteLength(text: string): number {
  return Array.from(text.trim()).length;
}

// C0 and DEL except tab, line feed and carriage return.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function noteError(note: string): string | undefined {
  if (noteLength(note) > NOTE_MAX) return NOTE_TOO_LONG_MESSAGE;
  if (CONTROL_CHARS.test(note)) return NOTE_CONTROL_MESSAGE;
  return undefined;
}

function isManualReason(reason: string): reason is ManualRejectionReason {
  return (MANUAL_REJECTION_REASONS as readonly string[]).includes(reason);
}

/** Validates the form before sending: a note of only spaces is valid and travels without `note` (EC-13). */
export function validateRejectForm(values: RejectFormValues): RejectFormResult {
  const { reason } = values;
  const errors: RejectFormErrors = {};
  if (!isManualReason(reason)) errors.reason = REASON_REQUIRED_MESSAGE;
  const note = noteError(values.note);
  if (note) errors.note = note;
  if (!isManualReason(reason) || note) return { ok: false, errors };
  const trimmed = values.note.trim();
  return { ok: true, input: trimmed === '' ? { reason } : { reason, note: trimmed } };
}
