import { useEffect, useRef, useState, type RefObject } from 'react';
import { isNotFound, userMessage } from '../../components/http.ts';
import { Link, matchPath, useNotice, usePath } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage, Notice } from '../../components/StatusMessages.tsx';
import { useDocumentTitle } from '../../components/use-document-title.ts';
import { useResource, type Resource } from '../../components/use-resource.ts';
import { getJob } from './api.ts';
import { JobActions } from './JobActions.tsx';
import { JobDetails } from './JobDetails.tsx';
import { jobPaths, parseJobId } from './paths.ts';
import type { Job } from './types.ts';
import { useJobActions } from './use-job-actions.ts';

const NOT_FOUND_TITLE = 'Oferta no encontrada';
const GONE_MESSAGE = 'Esta oferta ya no existe.';
const CLOSED_NOTICE = 'Oferta cerrada.';
const PUBLISHED_NOTICE = 'Oferta publicada.';

export function NotFound() {
  useDocumentTitle(NOT_FOUND_TITLE);
  return (
    <>
      <h1>{NOT_FOUND_TITLE}</h1>
      <p>La oferta que buscas no existe o ya no está disponible.</p>
      <p>
        <Link to={jobPaths.list}>Volver a las ofertas</Link>
      </p>
    </>
  );
}

// Local feedback of the actions (DD-05 to DD-07). It lives above the resource, so the alert survives a
// `retry()` and the notice replaces the arrival one. The focus effect only reads a ref: it never sets state.
function useActionFeedback(job: Resource<Job>, headingRef: RefObject<HTMLHeadingElement | null>) {
  const [notice, setNotice] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const refocus = useRef(false);

  useEffect(() => {
    if (job.state !== 'success' || !refocus.current) return;
    refocus.current = false;
    headingRef.current?.focus();
  }, [job.state, job.data, headingRef]);

  // Close and publish answer with the updated job: it replaces the data, with its own notice (DD-05).
  function showUpdated(updated: Job, text: string): void {
    refocus.current = true;
    setAlert(null);
    setNotice(text);
    job.setData(updated);
  }

  return {
    notice,
    alert,
    gone,
    onClosed: (updated: Job) => showUpdated(updated, CLOSED_NOTICE),
    onPublished: (updated: Job) => showUpdated(updated, PUBLISHED_NOTICE),
    onAlert: setAlert,
    onConflict(message: string): void {
      refocus.current = true;
      setAlert(message);
      job.retry();
    },
    onGone(): void {
      setAlert(null);
      setGone(true);
    },
  };
}

type Feedback = ReturnType<typeof useActionFeedback>;

// A 404 of an action: the job is gone, so there are no actions left (like `DeleteJobAction`).
function GoneMessage() {
  return (
    <div className="error-message">
      <p role="alert" className="error-text">
        {GONE_MESSAGE}
      </p>
      <Link to={jobPaths.list}>Volver a las ofertas</Link>
    </div>
  );
}

type ViewProps = {
  job: Job;
  headingRef: RefObject<HTMLHeadingElement | null>;
  feedback: Feedback;
  actions: ReturnType<typeof useJobActions>;
};

function JobDetailView({ job, headingRef, feedback, actions }: ViewProps) {
  return (
    <>
      <JobDetails job={job} headingRef={headingRef} />
      {feedback.gone ? (
        <GoneMessage />
      ) : (
        <JobActions
          job={job}
          pending={actions.pending}
          onPublish={() => void actions.publish()}
          onDuplicate={() => void actions.duplicate()}
          onClosed={feedback.onClosed}
          onConflict={feedback.onConflict}
          onGone={feedback.onGone}
        />
      )}
    </>
  );
}

function JobDetailLoader({ id }: { id: number }) {
  const arrivalNotice = useNotice();
  const job = useResource((signal) => getJob(id, signal), [id]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const feedback = useActionFeedback(job, headingRef);
  const actions = useJobActions(id, feedback);
  useDocumentTitle(job.state === 'success' ? job.data.title : null);

  if (job.state === 'error' && isNotFound(job.error)) return <NotFound />;
  const notice = feedback.notice ?? arrivalNotice;
  return (
    <>
      {notice ? <Notice>{notice}</Notice> : null}
      {job.state === 'loading' ? <LoadingMessage>Cargando la oferta…</LoadingMessage> : null}
      {job.state === 'error' ? (
        <ErrorMessage message={userMessage(job.error)} onRetry={job.retry} />
      ) : null}
      {job.state === 'success' ? (
        <JobDetailView
          job={job.data}
          headingRef={headingRef}
          feedback={feedback}
          actions={actions}
        />
      ) : null}
      {feedback.alert ? (
        <p role="alert" className="error-text">
          {feedback.alert}
        </p>
      ) : null}
    </>
  );
}

// Container of the detail screen (`/jobs/:id`): validates the ID before any request (EC-27), loads the
// job and shows loading, not found, error or data. `key={id}` keeps the notice, the alert and the local
// state from passing from one job to another (DD-05).
export function JobDetailScreen() {
  const path = usePath();
  const id = parseJobId(matchPath('/jobs/:id', path)?.id ?? '');
  return id === null ? <NotFound /> : <JobDetailLoader key={id} id={id} />;
}
