import { ApiError, userMessage } from '../../components/http.ts';
import { FIELD_ORDER, isFieldName, type JobFormErrors } from './job-form-model.ts';

const GONE_MESSAGE = 'Esta oferta ya no existe.';

export type ServerErrors = {
  fields: JobFormErrors;
  form?: string;
  gone?: boolean;
  /** 409: the job changed status elsewhere; `form` carries the API message (DD-06). */
  conflict?: boolean;
};

// A 400 puts each `details[i]` next to its field with the API message; the rest (unknown field, `body`,
// no details) goes to the form alert. A 404 on save means the job was deleted elsewhere (EC-24) and a
// 409 that it was closed elsewhere (EC-44): the container shows the message and reloads the job.
// Anything else shows the message of the error (EC-05, EC-10).
export function splitServerError(error: unknown): ServerErrors {
  if (!(error instanceof ApiError)) return { fields: {}, form: userMessage(error) };
  if (error.status === 404) return { fields: {}, form: GONE_MESSAGE, gone: true };
  if (error.status === 409) return { fields: {}, form: error.message, conflict: true };
  if (error.status === 400) return splitValidationError(error);
  return { fields: {}, form: userMessage(error) };
}

function splitValidationError(error: ApiError): ServerErrors {
  const fields: JobFormErrors = {};
  const others: string[] = [];
  for (const detail of error.details ?? []) {
    if (isFieldName(detail.field)) fields[detail.field] ??= detail.message;
    else others.push(detail.message);
  }
  if (others.length === 0 && Object.keys(fields).length > 0) return { fields };
  return { fields, form: others[0] ?? error.message };
}

export function focusFirstError(form: HTMLFormElement, errors: JobFormErrors): void {
  const first = FIELD_ORDER.find((field) => errors[field] !== undefined);
  const control = first ? form.elements.namedItem(first) : null;
  if (control instanceof HTMLElement) control.focus();
}
