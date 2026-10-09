import { useRef, useState, type FormEvent } from 'react';
import { isNotFound, userMessage } from '../../components/http.ts';
import { Link, matchPath, navigate, usePath } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage } from '../../components/StatusMessages.tsx';
import { useDocumentTitle } from '../../components/use-document-title.ts';
import { useLifetimeSignal } from '../../components/use-lifetime-signal.ts';
import { useResource } from '../../components/use-resource.ts';
import { createCandidate, getCandidate, updateCandidate } from './api.ts';
import { CandidateForm } from './CandidateForm.tsx';
import {
  focusFirstError,
  splitCandidateServerError,
  type CandidateServerErrors,
} from './candidate-form-errors.ts';
import {
  candidateToForm,
  EMPTY_FORM,
  toCreateInput,
  toPatch,
  validateCandidateForm,
  type CandidateFormValues,
} from './candidate-form-model.ts';
import { candidatePaths, parseCandidateId } from './paths.ts';
import type { Candidate } from './types.ts';

const CREATE_TITLE = 'Nuevo candidato';
const EDIT_TITLE = 'Editar candidato';
const NOT_FOUND_TITLE = 'Candidato no encontrado';

type Submit = (values: CandidateFormValues, signal?: AbortSignal) => Promise<void>;

const NO_FEEDBACK: CandidateServerErrors = { fields: {} };

function CandidateNotFound() {
  useDocumentTitle(NOT_FOUND_TITLE);
  return (
    <>
      <h1>{NOT_FOUND_TITLE}</h1>
      <p>El candidato que buscas no existe.</p>
      <p>
        <Link to={candidatePaths.list}>Volver a los candidatos</Link>
      </p>
    </>
  );
}

// Submission state: validates on submit, runs `submit` once (the ref guard keeps a double click from
// sending two, EC-08) and keeps the errors. `submit` navigates on success and throws on failure; what the
// person typed is never touched here.
function useCandidateSubmission(values: CandidateFormValues, submit: Submit) {
  const [feedback, setFeedback] = useState<CandidateServerErrors>(NO_FEEDBACK);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const lifetimeSignal = useLifetimeSignal();

  async function send(form: HTMLFormElement): Promise<void> {
    const signal = lifetimeSignal();
    try {
      await submit(values, signal);
    } catch (caught) {
      if (signal?.aborted) return;
      const server = splitCandidateServerError(caught);
      setFeedback(server);
      focusFirstError(form, server.fields);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const found = validateCandidateForm(values);
    setFeedback({ fields: found });
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

  return { feedback, busy, handleSubmit };
}

type ContainerProps = {
  heading: string;
  withConsent: boolean;
  initial: CandidateFormValues;
  cancelTo: string;
  submit: Submit;
};

function CandidateFormContainer(props: ContainerProps) {
  const { heading, withConsent, initial, cancelTo, submit } = props;
  const [values, setValues] = useState<CandidateFormValues>(initial);
  const { feedback, busy, handleSubmit } = useCandidateSubmission(values, submit);

  useDocumentTitle(heading);

  return (
    <>
      <CandidateForm
        heading={heading}
        withConsent={withConsent}
        values={values}
        errors={feedback.fields}
        formError={feedback.form}
        duplicateId={feedback.duplicateId}
        busy={busy}
        cancelTo={cancelTo}
        onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
        onConsentChange={(consent) => setValues((current) => ({ ...current, consent }))}
        onSubmit={(event) => void handleSubmit(event)}
      />
      {feedback.gone ? (
        <p>
          <Link to={candidatePaths.list}>Volver a los candidatos</Link>
        </p>
      ) : null}
    </>
  );
}

async function createAndShow(values: CandidateFormValues, signal?: AbortSignal): Promise<void> {
  const candidate = await createCandidate(toCreateInput(values), signal);
  navigate(candidatePaths.detail(candidate.id), { notice: 'Candidato creado.' });
}

// Sends only what changed; nothing changed means no request at all (an empty PATCH would be a 400).
async function updateAndShow(
  original: Candidate,
  values: CandidateFormValues,
  signal?: AbortSignal,
): Promise<void> {
  const patch = toPatch(original, values);
  if (Object.keys(patch).length === 0) {
    navigate(candidatePaths.detail(original.id));
    return;
  }
  await updateCandidate(original.id, patch, signal);
  navigate(candidatePaths.detail(original.id), { notice: 'Cambios guardados.' });
}

// Every mount asks for the candidate again, so coming back from the detail never shows stale values (EC-38).
function EditCandidateLoader({ id }: { id: number }) {
  const candidate = useResource((signal) => getCandidate(id, signal), [id]);

  if (candidate.state === 'error' && isNotFound(candidate.error)) return <CandidateNotFound />;
  if (candidate.state === 'loading') return <LoadingMessage>Cargando el candidato…</LoadingMessage>;
  if (candidate.state === 'error') {
    return <ErrorMessage message={userMessage(candidate.error)} onRetry={candidate.retry} />;
  }
  const original = candidate.data;
  return (
    <CandidateFormContainer
      key={original.id}
      heading={EDIT_TITLE}
      withConsent={false}
      initial={candidateToForm(original)}
      cancelTo={candidatePaths.detail(original.id)}
      submit={(values, signal) => updateAndShow(original, values, signal)}
    />
  );
}

// «Editar candidato» (`/candidates/:id/edit`): validates the ID before any request.
function EditCandidateScreen() {
  const path = usePath();
  const id = parseCandidateId(matchPath('/candidates/:id/edit', path)?.id ?? '');
  return id === null ? <CandidateNotFound /> : <EditCandidateLoader id={id} />;
}

// Screen of the candidate form: «Nuevo candidato» (`/candidates/new`) or «Editar candidato» (`/candidates/:id/edit`).
export function CandidateFormScreen({ mode }: { mode: 'create' | 'edit' }) {
  if (mode === 'edit') return <EditCandidateScreen />;
  return (
    <CandidateFormContainer
      heading={CREATE_TITLE}
      withConsent
      initial={EMPTY_FORM}
      cancelTo={candidatePaths.list}
      submit={createAndShow}
    />
  );
}
