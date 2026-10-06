import { useEffect, useRef, useState, type RefObject } from 'react';
import { ApiError, userMessage } from '../../components/http.ts';
import { Link, matchPath, useNotice, usePath } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage, Notice } from '../../components/StatusMessages.tsx';
import { useResource, type Resource } from '../../components/use-resource.ts';
import { getJob } from './api.ts';
import { JobActions } from './JobActions.tsx';
import { JobDetails } from './JobDetails.tsx';
import { jobPaths, parseJobId } from './paths.ts';
import type { Job } from './types.ts';

const APP_NAME = 'ATS';
const NOT_FOUND_TITLE = 'Oferta no encontrada';
const GONE_MESSAGE = 'Esta oferta ya no existe.';
const CLOSED_NOTICE = 'Oferta cerrada.';

function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (title !== null) document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}

// 404 and 400 from the API show the same as an invalid ID (EC-43); `status` is never 400/404 unless the
// API said so in its envelope.
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

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

  return {
    notice,
    alert,
    gone,
    onClosed(updated: Job): void {
      refocus.current = true;
      setAlert(null);
      setNotice(CLOSED_NOTICE);
      job.setData(updated);
    },
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
};

function JobDetailView({ job, headingRef, feedback }: ViewProps) {
  return (
    <>
      <JobDetails job={job} headingRef={headingRef} />
      {feedback.gone ? (
        <GoneMessage />
      ) : (
        <JobActions
          job={job}
          pending={null}
          // TASK-10 connects publish and duplicate; until then they only paint.
          onPublish={() => undefined}
          onDuplicate={() => undefined}
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
        <JobDetailView job={job.data} headingRef={headingRef} feedback={feedback} />
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
