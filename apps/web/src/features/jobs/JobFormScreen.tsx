import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, userMessage } from '../../components/http.ts';
import { navigate } from '../../components/router.tsx';
import { createJob } from './api.ts';
import { JobForm } from './JobForm.tsx';
import {
  EMPTY_FORM,
  FIELD_ORDER,
  isFieldName,
  toCreateInput,
  validateJobForm,
  type FieldName,
  type JobFormErrors,
  type JobFormValues,
} from './job-form-model.ts';
import { jobPaths } from './paths.ts';

const APP_NAME = 'ATS';
const CREATE_TITLE = 'Nueva oferta';

type ServerErrors = { fields: JobFormErrors; form?: string };

// A 400 puts each `details[i]` next to its field with the API message; the rest (unknown field, `body`,
// no details) goes to the form alert. Anything else shows the message of the error (EC-05, EC-10).
function splitServerError(error: unknown): ServerErrors {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return { fields: {}, form: userMessage(error) };
  }
  const fields: JobFormErrors = {};
  const others: string[] = [];
  for (const detail of error.details ?? []) {
    if (isFieldName(detail.field)) fields[detail.field] ??= detail.message;
    else others.push(detail.message);
  }
  const hasFields = Object.keys(fields).length > 0;
  if (others.length === 0 && hasFields) return { fields };
  return { fields, form: others[0] ?? error.message };
}

function focusFirstError(form: HTMLFormElement, errors: JobFormErrors): void {
  const first = FIELD_ORDER.find((field) => errors[field] !== undefined);
  const control = first ? form.elements.namedItem(first) : null;
  if (control instanceof HTMLElement) control.focus();
}

// Container of «Nueva oferta» (`/jobs/new`): validates on submit, sends one POST (the ref guard keeps a
// double click from sending two, EC-06) and goes to the detail with a notice. TASK-13 adds the edit mode.
export function JobFormScreen({ mode }: { mode: 'create' }) {
  const [values, setValues] = useState<JobFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<JobFormErrors>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    document.title = `${CREATE_TITLE} · ${APP_NAME}`;
  }, [mode]);

  function handleChange(field: FieldName, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function send(form: HTMLFormElement): Promise<void> {
    try {
      const job = await createJob(toCreateInput(values));
      navigate(jobPaths.detail(job.id), { notice: 'Oferta creada.' });
    } catch (caught) {
      const server = splitServerError(caught);
      setErrors(server.fields);
      setFormError(server.form);
      focusFirstError(form, server.fields);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const found = validateJobForm(values);
    setErrors(found);
    setFormError(undefined);
    if (Object.keys(found).length > 0) {
      focusFirstError(form, found);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      await send(form);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <JobForm
      heading={CREATE_TITLE}
      values={values}
      errors={errors}
      formError={formError}
      busy={busy}
      cancelTo={jobPaths.list}
      onChange={handleChange}
      onSubmit={(event) => void handleSubmit(event)}
    />
  );
}
