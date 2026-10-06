import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, userMessage } from '../../components/http.ts';
import { Link, matchPath, navigate, usePath } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage } from '../../components/StatusMessages.tsx';
import { useResource } from '../../components/use-resource.ts';
import { createJob, getJob, updateJob } from './api.ts';
import { isNotFound, NotFound } from './JobDetailScreen.tsx';
import { JobForm } from './JobForm.tsx';
import {
  EMPTY_FORM,
  FIELD_ORDER,
  isFieldName,
  jobToForm,
  toCreateInput,
  toPatch,
  validateJobForm,
  type JobFormErrors,
  type JobFormValues,
} from './job-form-model.ts';
import { jobPaths, parseJobId } from './paths.ts';
import type { Job } from './types.ts';

const APP_NAME = 'ATS';
const CREATE_TITLE = 'Nueva oferta';
const EDIT_TITLE = 'Editar oferta';
const GONE_MESSAGE = 'Esta oferta ya no existe.';

type ServerErrors = { fields: JobFormErrors; form?: string; gone?: boolean };

// A 400 puts each `details[i]` next to its field with the API message; the rest (unknown field, `body`,
// no details) goes to the form alert. A 404 on save means the job was deleted elsewhere (EC-24).
// Anything else shows the message of the error (EC-05, EC-10).
function splitServerError(error: unknown): ServerErrors {
  if (error instanceof ApiError && error.status === 404) {
    return { fields: {}, form: GONE_MESSAGE, gone: true };
  }
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

type Submit = (values: JobFormValues) => Promise<void>;

// Submission state: validates on submit, runs `submit` once (the ref guard keeps a double click from
// sending two, EC-06) and keeps the server errors. `submit` navigates on success and throws on failure.
function useJobSubmission(values: JobFormValues, submit: Submit) {
  const [errors, setErrors] = useState<JobFormErrors>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function send(form: HTMLFormElement): Promise<void> {
    try {
      await submit(values);
    } catch (caught) {
      const server = splitServerError(caught);
      setErrors(server.fields);
      setFormError(server.form);
      setGone(server.gone === true);
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
    setGone(false);
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

  return { errors, formError, gone, busy, handleSubmit };
}

function JobFormContainer(props: {
  heading: string;
  initial: JobFormValues;
  cancelTo: string;
  submit: Submit;
}) {
  const { heading, initial, cancelTo, submit } = props;
  const [values, setValues] = useState<JobFormValues>(initial);
  const { errors, formError, gone, busy, handleSubmit } = useJobSubmission(values, submit);

  useEffect(() => {
    document.title = `${heading} · ${APP_NAME}`;
  }, [heading]);

  return (
    <>
      <JobForm
        heading={heading}
        values={values}
        errors={errors}
        formError={formError}
        busy={busy}
        cancelTo={cancelTo}
        onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
        onSubmit={(event) => void handleSubmit(event)}
      />
      {gone ? (
        <p>
          <Link to={jobPaths.list}>Volver a las ofertas</Link>
        </p>
      ) : null}
    </>
  );
}

async function createAndShow(values: JobFormValues): Promise<void> {
  const job = await createJob(toCreateInput(values));
  navigate(jobPaths.detail(job.id), { notice: 'Oferta creada.' });
}

// Sends only what changed; nothing changed means no request at all (an empty PATCH would be a 400).
async function updateAndShow(original: Job, values: JobFormValues): Promise<void> {
  const patch = toPatch(original, values);
  if (Object.keys(patch).length > 0) {
    await updateJob(original.id, patch);
    navigate(jobPaths.detail(original.id), { notice: 'Cambios guardados.' });
  } else {
    navigate(jobPaths.detail(original.id));
  }
}

function EditJobLoader({ id }: { id: number }) {
  const job = useResource((signal) => getJob(id, signal), [id]);

  if (job.state === 'error' && isNotFound(job.error)) return <NotFound />;
  if (job.state === 'loading') return <LoadingMessage>Cargando la oferta…</LoadingMessage>;
  if (job.state === 'error') {
    return <ErrorMessage message={userMessage(job.error)} onRetry={job.retry} />;
  }
  const original = job.data;
  return (
    <JobFormContainer
      key={original.id}
      heading={EDIT_TITLE}
      initial={jobToForm(original)}
      cancelTo={jobPaths.detail(original.id)}
      submit={(values) => updateAndShow(original, values)}
    />
  );
}

// «Editar oferta» (`/jobs/:id/edit`): validates the ID before any request, like the detail (EC-27).
function EditJobScreen() {
  const path = usePath();
  const id = parseJobId(matchPath('/jobs/:id/edit', path)?.id ?? '');
  return id === null ? <NotFound /> : <EditJobLoader id={id} />;
}

// Screen of the job form: «Nueva oferta» (`/jobs/new`) or «Editar oferta» (`/jobs/:id/edit`).
export function JobFormScreen({ mode }: { mode: 'create' | 'edit' }) {
  if (mode === 'edit') return <EditJobScreen />;
  return (
    <JobFormContainer
      heading={CREATE_TITLE}
      initial={EMPTY_FORM}
      cancelTo={jobPaths.list}
      submit={createAndShow}
    />
  );
}
