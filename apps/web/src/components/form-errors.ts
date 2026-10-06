import type { ApiError } from './http.ts';

export type ValidationSplit<Field extends string> = {
  fields: Partial<Record<Field, string>>;
  /** Alert of the form: the first message that is not for a field, or the error message. */
  form?: string;
};

/**
 * A 400 puts each `details[i]` next to its field with the API message (the first one of a field); the rest
 * (unknown field, `body`, no details) goes to the form alert. If every detail is for a field, there is no alert.
 */
export function splitValidationDetails<Field extends string>(
  error: ApiError,
  isField: (name: string) => name is Field,
): ValidationSplit<Field> {
  const fields: Partial<Record<Field, string>> = {};
  const others: string[] = [];
  for (const detail of error.details ?? []) {
    if (isField(detail.field)) fields[detail.field] ??= detail.message;
    else others.push(detail.message);
  }
  if (others.length === 0 && Object.keys(fields).length > 0) return { fields };
  return { fields, form: others[0] ?? error.message };
}

/** Focuses the control of the first field (in `order`) that has an error. */
export function focusFirstError<Field extends string>(
  form: HTMLFormElement,
  order: readonly Field[],
  errors: Partial<Record<Field, string>>,
): void {
  const first = order.find((field) => errors[field] !== undefined);
  const control = first ? form.elements.namedItem(first) : null;
  if (control instanceof HTMLElement) control.focus();
}
