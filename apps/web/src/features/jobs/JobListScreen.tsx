import { userMessage } from '../../components/http.ts';
import { Link, useNotice } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage, Notice } from '../../components/StatusMessages.tsx';
import { useResource } from '../../components/use-resource.ts';
import { listJobs } from './api.ts';
import { JobTable } from './JobTable.tsx';
import { jobPaths } from './paths.ts';
import type { JobPage } from './types.ts';

function NewJobLink() {
  return (
    <p>
      <Link to={jobPaths.create}>Nueva oferta</Link>
    </p>
  );
}

function JobListContent({ page }: { page: JobPage }) {
  if (page.items.length === 0) {
    return (
      <>
        <p>Todavía no hay ofertas.</p>
        <NewJobLink />
      </>
    );
  }
  return (
    <>
      <NewJobLink />
      <JobTable items={page.items} />
      {page.total > page.items.length ? (
        <p>
          Se muestran las {page.items.length} más recientes de {page.total}.
        </p>
      ) : null}
    </>
  );
}

// Container of the list screen (`/jobs`): loads the first page and shows loading, empty, error or data.
export function JobListScreen() {
  const notice = useNotice();
  const jobs = useResource((signal) => listJobs([], signal), []);

  return (
    <>
      <h1>Ofertas</h1>
      {notice ? <Notice>{notice}</Notice> : null}
      {jobs.state === 'loading' ? <LoadingMessage>Cargando ofertas…</LoadingMessage> : null}
      {jobs.state === 'error' ? (
        <ErrorMessage message={userMessage(jobs.error)} onRetry={jobs.retry} />
      ) : null}
      {jobs.state === 'success' ? <JobListContent page={jobs.data} /> : null}
    </>
  );
}
