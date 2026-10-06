import { useEffect } from 'react';
import { ApiError, userMessage } from '../../components/http.ts';
import { Link, matchPath, useNotice, usePath } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage, Notice } from '../../components/StatusMessages.tsx';
import { useResource } from '../../components/use-resource.ts';
import { getJob } from './api.ts';
import { JobDetails } from './JobDetails.tsx';
import { jobPaths, parseJobId } from './paths.ts';

const APP_NAME = 'ATS';
const NOT_FOUND_TITLE = 'Oferta no encontrada';

function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (title !== null) document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}

// 404 and 400 from the API show the same as an invalid ID (EC-43); `status` is never 400/404 unless the
// API said so in its envelope.
function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

function NotFound() {
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

function JobDetailLoader({ id }: { id: number }) {
  const notice = useNotice();
  const job = useResource((signal) => getJob(id, signal), [id]);
  useDocumentTitle(job.state === 'success' ? job.data.title : null);

  if (job.state === 'error' && isNotFound(job.error)) return <NotFound />;
  return (
    <>
      {notice ? <Notice>{notice}</Notice> : null}
      {job.state === 'loading' ? <LoadingMessage>Cargando la oferta…</LoadingMessage> : null}
      {job.state === 'error' ? (
        <ErrorMessage message={userMessage(job.error)} onRetry={job.retry} />
      ) : null}
      {job.state === 'success' ? <JobDetails job={job.data} /> : null}
    </>
  );
}

// Container of the detail screen (`/jobs/:id`): validates the ID before any request (EC-27), loads the
// job and shows loading, not found, error or data.
export function JobDetailScreen() {
  const path = usePath();
  const id = parseJobId(matchPath('/jobs/:id', path)?.id ?? '');
  return id === null ? <NotFound /> : <JobDetailLoader id={id} />;
}
