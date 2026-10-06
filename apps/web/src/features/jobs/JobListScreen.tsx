import { useEffect, useRef } from 'react';
import { ApiError, userMessage } from '../../components/http.ts';
import { Link, useNotice, useSearch } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage, Notice } from '../../components/StatusMessages.tsx';
import { useResource } from '../../components/use-resource.ts';
import { listJobs } from './api.ts';
import { JobFilters } from './JobFilters.tsx';
import { JobPagination } from './JobPagination.tsx';
import { JobTable } from './JobTable.tsx';
import {
  clearFiltersPath,
  hasFilters,
  pagePath,
  readListQuery,
  type ListQuery,
} from './list-query.ts';
import { jobPaths } from './paths.ts';
import type { JobPage } from './types.ts';

// Labels of the `details[i].field` of a 400 of the list: the name of the query parameter.
const PARAM_LABELS: Record<string, string> = {
  status: 'Estado',
  q: 'Buscar por título',
  page: 'Página',
  pageSize: 'Por página',
};

interface ListLinkProps {
  query: ListQuery;
  onNavigate: () => void;
}

function NewJobLink() {
  return (
    <p>
      <Link to={jobPaths.create}>Nueva oferta</Link>
    </p>
  );
}

function ClearFiltersLink({ query, onNavigate }: ListLinkProps) {
  return (
    <p>
      <Link to={clearFiltersPath(query)} onClick={onNavigate}>
        Quitar filtros
      </Link>
    </p>
  );
}

// A 400 comes from a URL with invalid parameters: repeating the request does not fix it, so no «Reintentar».
function InvalidFiltersMessage({ error, query, onNavigate }: ListLinkProps & { error: ApiError }) {
  return (
    <div className="error-message">
      <p role="alert" className="error-text">
        {error.message}
      </p>
      {error.details ? (
        <ul>
          {error.details.map((detail, index) => (
            <li
              key={index}
            >{`${PARAM_LABELS[detail.field] ?? detail.field}: ${detail.message}`}</li>
          ))}
        </ul>
      ) : null}
      <ClearFiltersLink query={query} onNavigate={onNavigate} />
    </div>
  );
}

function ListError({
  error,
  query,
  onNavigate,
  onRetry,
}: ListLinkProps & { error: unknown; onRetry: () => void }) {
  if (error instanceof ApiError && error.status === 400) {
    return <InvalidFiltersMessage error={error} query={query} onNavigate={onNavigate} />;
  }
  return <ErrorMessage message={userMessage(error)} onRetry={onRetry} />;
}

function JobListContent({ data, query, onNavigate }: ListLinkProps & { data: JobPage }) {
  if (data.items.length === 0 && data.total > 0) {
    return (
      <>
        <p>Esta página no tiene ofertas.</p>
        <p>
          <Link to={pagePath(query, 1)} onClick={onNavigate}>
            Ir a la primera página
          </Link>
        </p>
      </>
    );
  }
  if (data.items.length === 0) {
    return hasFilters(query) ? (
      <>
        <p>Ninguna oferta cumple los filtros.</p>
        <ClearFiltersLink query={query} onNavigate={onNavigate} />
      </>
    ) : (
      <>
        <p>Todavía no hay ofertas.</p>
        <NewJobLink />
      </>
    );
  }
  return (
    <>
      <NewJobLink />
      <JobTable items={data.items} />
      <JobPagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        pathFor={(page) => pagePath(query, page)}
        onNavigate={onNavigate}
      />
    </>
  );
}

// Container of the list screen (`/jobs`): the filters live in the URL (DD-01) and each change of the URL loads again.
export function JobListScreen() {
  const notice = useNotice();
  const search = useSearch();
  const query = readListQuery(search);
  const jobs = useResource((signal) => listJobs(query, signal), [search]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterLoad = useRef(false);

  // DD-03: the load provoked by a pagination or «Quitar filtros» link ends with the focus on the h1.
  useEffect(() => {
    if (jobs.state === 'loading' || !focusAfterLoad.current) return;
    focusAfterLoad.current = false;
    headingRef.current?.focus();
  }, [jobs.state]);

  function markFocus(): void {
    focusAfterLoad.current = true;
  }

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        Ofertas
      </h1>
      {notice ? <Notice>{notice}</Notice> : null}
      <JobFilters search={search} />
      {jobs.state === 'loading' ? <LoadingMessage>Cargando ofertas…</LoadingMessage> : null}
      {jobs.state === 'error' ? (
        <ListError error={jobs.error} query={query} onNavigate={markFocus} onRetry={jobs.retry} />
      ) : null}
      {jobs.state === 'success' ? (
        <JobListContent data={jobs.data} query={query} onNavigate={markFocus} />
      ) : null}
    </>
  );
}
