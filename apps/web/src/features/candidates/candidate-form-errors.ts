import {
  focusFirstError as focusFirstFieldError,
  splitValidationDetails,
} from '../../components/form-errors.ts';
import { ApiError, userMessage } from '../../components/http.ts';
import { FIELD_ORDER, isFieldName, type CandidateFormErrors } from './candidate-form-model.ts';

export type CandidateServerErrors = {
  fields: CandidateFormErrors;
  /** Alert of the form: what does not belong to any field. */
  form?: string;
  /** 409: ID of the candidate that already has the email; the link goes to it, nothing else is asked (DD-06). */
  duplicateId?: number;
  /** 404: the candidate does not exist (any more); the alert comes with a link back to the list. */
  gone?: boolean;
};

// 409 puts the API message next to the email and keeps `existingId` (already validated by `http.ts`).
function splitDuplicate(error: ApiError): CandidateServerErrors {
  const detail = error.details?.find((item) => item.field === 'email');
  return { fields: { email: error.message }, duplicateId: detail?.existingId };
}

/**
 * A 400 puts each `details[i]` next to its field with the API message; the rest (unknown field, `body`,
 * no details) goes to the form alert. A 409 is the duplicated email (EC-07, EC-22) and a 404 a candidate
 * that is gone. Anything else (403, 413, 415, 500, network, timeout, unexpected shape) shows the message
 * of the error. Nothing here ever touches what the person typed.
 */
export function splitCandidateServerError(error: unknown): CandidateServerErrors {
  if (!(error instanceof ApiError)) return { fields: {}, form: userMessage(error) };
  if (error.status === 400) return splitValidationDetails(error, isFieldName);
  if (error.status === 409) return splitDuplicate(error);
  if (error.status === 404) return { fields: {}, form: error.message, gone: true };
  return { fields: {}, form: userMessage(error) };
}

export function focusFirstError(form: HTMLFormElement, errors: CandidateFormErrors): void {
  focusFirstFieldError(form, FIELD_ORDER, errors);
}
