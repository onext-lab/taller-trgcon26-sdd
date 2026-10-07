import { useRef, useState, type RefObject } from 'react';
import { splitValidationDetails } from '../../components/form-errors.ts';
import type { ApiError } from '../../components/http.ts';
import { validateRejectForm, type RejectFormErrors, type RejectFormValues } from './reject-form.ts';
import type { ManualRejectionReason, RejectInput } from './types.ts';

const EMPTY_VALUES: RejectFormValues = { reason: '', note: '' };

type RejectField = 'reason' | 'note';

function isRejectField(name: string): name is RejectField {
  return name === 'reason' || name === 'note';
}

/** The form of the reject dialog: what is typed, the errors next to each field and the controls to focus. */
export interface RejectForm {
  values: RejectFormValues;
  errors: RejectFormErrors;
  /** First radio of the group: it takes the focus when the reason is missing. */
  firstReasonRef: RefObject<HTMLInputElement | null>;
  noteRef: RefObject<HTMLTextAreaElement | null>;
  setReason: (reason: ManualRejectionReason) => void;
  setNote: (note: string) => void;
  /** Drops what was typed and the errors (cancel, success or stale card). */
  reset: () => void;
  /** Validates before sending (EC-36, EC-37): on failure it paints the errors, focuses the field and gives `null`. */
  validate: () => Omit<RejectInput, 'expectedStage'> | null;
  /** 400: puts each message next to its field and focuses it; gives the text left for the dialog, if any. */
  applyServerError: (error: ApiError) => string | undefined;
}

/**
 * State of the reject form. The note lives only here (DD-05): never in the URL, in `history.state` or in
 * storage. Editing a field drops its error, which no longer describes what is typed.
 */
export function useRejectForm(): RejectForm {
  const [values, setValues] = useState<RejectFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<RejectFormErrors>({});
  const firstReasonRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // The first field with an error, in the order of the form; the controls already exist (the dialog is open).
  function focusFirst(found: RejectFormErrors): void {
    if (found.reason !== undefined) firstReasonRef.current?.focus();
    else if (found.note !== undefined) noteRef.current?.focus();
  }

  return {
    values,
    errors,
    firstReasonRef,
    noteRef,
    setReason(reason) {
      setValues((current) => ({ ...current, reason }));
      setErrors((current) => ({ ...current, reason: undefined }));
    },
    setNote(note) {
      setValues((current) => ({ ...current, note }));
      setErrors((current) => ({ ...current, note: undefined }));
    },
    reset() {
      setValues(EMPTY_VALUES);
      setErrors({});
    },
    validate() {
      const result = validateRejectForm(values);
      if (result.ok) return result.input;
      setErrors(result.errors);
      focusFirst(result.errors);
      return null;
    },
    applyServerError(error) {
      const { fields, form } = splitValidationDetails(error, isRejectField);
      setErrors(fields);
      focusFirst(fields);
      return form;
    },
  };
}
