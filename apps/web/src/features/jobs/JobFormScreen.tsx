import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isNotFound, userMessage } from '../../components/http.ts';
import { Link, matchPath, navigate, usePath } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage } from '../../components/StatusMessages.tsx';
import { useDocumentTitle } from '../../components/use-document-title.ts';
import { useResource } from '../../components/use-resource.ts';
import { createJob, getJob, updateJob } from './api.ts';
import { NotFound } from './JobDetailScreen.tsx';
import { JobForm } from './JobForm.tsx';
import { focusFirstError, splitServerError } from './job-form-errors.ts';
import {
  EMPTY_FORM,
  jobToForm,
  toCreateInput,
  toPatch,
  validateJobForm,
  type JobFormErrors,
  type JobFormValues,
} from './job-form-model.ts';
import { jobPaths, parseJobId } from './paths.ts';
import type { Job } from './types.ts';

const CREATE_TITLE = 'Nueva oferta';
const EDIT_TITLE = 'Editar oferta';
const CLOSED_MESSAGE = 'Esta oferta está cerrada y no se puede editar.';

type Submit = (values: JobFormValues) => Promise<void>;

type SubmissionOptions = {
  /** Editing a published job: the four required fields are validated (RF-03). */
  published: boolean;
  /** 409 on save: the container shows the API message and reloads the job (DD-06). */
  onConflict?: (message: string) => void;
};

// Submission state: validates on submit, runs `submit` once (the ref guard keeps a double click from
// sending two, EC-06) and keeps the server errors. `submit` navigates on success and throws on failure.
function useJobSubmission(values: JobFormValues, submit: Submit, options: SubmissionOptions) {
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
      if (server.conflict && options.onConflict) {
        options.onConflict(server.form ?? CLOSED_MESSAGE);
        return;
      }
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
    const found = validateJobForm(values, { published: options.published });
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

type ContainerProps = {
  heading: string;
  initial: JobFormValues;
  cancelTo: string;
  submit: Submit;
  published?: boolean;
  onConflict?: (message: string) => void;
};

function JobFormContainer(props: ContainerProps) {
  const { heading, initial, cancelTo, submit, published = false, onConflict } = props;
  const [values, setValues] = useState<JobFormValues>(initial);
  const { errors, formError, gone, busy, handleSubmit } = useJobSubmission(values, submit, {
    published,
    onConflict,
  });

  useDocumentTitle(heading);

  return (
    <>
      <JobForm
        heading={heading}
        published={published}
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

// A closed job has no form (CA-10, DD-06): the message of the 409 when we come from saving, or the fixed
// one when the URL was opened directly. After a 409 the form is gone, so the focus goes to the heading.
function ClosedJobNotice({ id, message }: { id: number; message: string | null }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useDocumentTitle(EDIT_TITLE);
  useEffect(() => {
    if (message !== null) headingRef.current?.focus();
  }, [message]);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        {EDIT_TITLE}
      </h1>
      <p role="alert" className="error-text">
        {message ?? CLOSED_MESSAGE}
      </p>
      <p>
        <Link to={jobPaths.detail(id)}>Ver la oferta</Link>
      </p>
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

// The alert of a 409 lives here, above the resource, so it survives the reload of the job (DD-06).
function EditJobLoader({ id }: { id: number }) {
  const job = useResource((signal) => getJob(id, signal), [id]);
  const [conflict, setConflict] = useState<string | null>(null);

  if (job.state === 'error' && isNotFound(job.error)) return <NotFound />;
  if (job.state === 'loading') return <LoadingMessage>Cargando la oferta…</LoadingMessage>;
  if (job.state === 'error') {
    return <ErrorMessage message={userMessage(job.error)} onRetry={job.retry} />;
  }
  const original = job.data;
  if (original.status === 'closed') return <ClosedJobNotice id={id} message={conflict} />;
  return (
    <JobFormContainer
      key={original.id}
      heading={EDIT_TITLE}
      initial={jobToForm(original)}
      cancelTo={jobPaths.detail(original.id)}
      submit={(values) => updateAndShow(original, values)}
      published={original.status === 'published'}
      onConflict={(message) => {
        setConflict(message);
        job.retry();
      }}
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
