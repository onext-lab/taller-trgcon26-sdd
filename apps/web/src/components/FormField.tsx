import type { ReactNode } from 'react';

// Props the field hands to its control (input, textarea or select) so label, help and error stay linked.
export type FieldControlProps = {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
};

export type FormFieldProps = {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: (control: FieldControlProps) => ReactNode;
};

export function FormField({ id, label, help, error, children }: FormFieldProps) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ');
  const control: FieldControlProps = { id };
  if (error) control['aria-invalid'] = true;
  if (describedBy) control['aria-describedby'] = describedBy;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children(control)}
      {help ? (
        <p id={helpId} className="field-help">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
