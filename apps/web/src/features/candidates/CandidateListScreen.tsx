import { useEffect, useRef, useState } from 'react';
import { Pagination } from '../../components/Pagination.tsx';
import { userMessage } from '../../components/http.ts';
import { Link, useNotice } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage, Notice } from '../../components/StatusMessages.tsx';
import { useDocumentTitle } from '../../components/use-document-title.ts';
import { useResource } from '../../components/use-resource.ts';
import { listCandidates } from './api.ts';
import { CandidateFilters } from './CandidateFilters.tsx';
import { CandidateTable } from './CandidateTable.tsx';
import { hasFilters, readListState, saveListState, type CandidateListQuery } from './list-state.ts';
import { candidatePaths } from './paths.ts';
import type { CandidatePage } from './types.ts';

const NOUN = { singular: 'candidato', plural: 'candidatos' };

interface ListContentProps {
  data: CandidatePage;
  query: CandidateListQuery;
  onPage: (page: number) => void;
}

function CandidateListContent({ data, query, onPage }: ListContentProps) {
  if (data.total === 0) {
    return (
      <p>
        {hasFilters(query)
          ? 'Ningún candidato coincide con la búsqueda.'
          : 'Todavía no hay candidatos.'}
      </p>
    );
  }
  return (
    <>
      <CandidateTable items={data.items} />
      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        noun={NOUN}
        renderStep={(target, label) => (
          <button type="button" onClick={() => onPage(target)}>
            {label}
          </button>
        )}
      />
    </>
  );
}

// Container of the list screen (`/candidates`): the applied search lives in `list-state.ts`, not in the URL
// (DD-01), and each change of it loads again. «Reintentar» repeats the same applied search.
export function CandidateListScreen() {
  useDocumentTitle('Candidatos');
  const notice = useNotice();
  const [query, setQuery] = useState(readListState);
  const candidates = useResource(
    (signal) => listCandidates(query, signal),
    [query.q, query.skill, query.page, query.pageSize],
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterLoad = useRef(false);

  // DD-03: the load provoked by a pagination button ends with the focus on the h1 (the button may be gone).
  useEffect(() => {
    if (candidates.state === 'loading' || !focusAfterLoad.current) return;
    focusAfterLoad.current = false;
    headingRef.current?.focus();
  }, [candidates.state]);

  function apply(next: CandidateListQuery): void {
    saveListState(next);
    setQuery(next);
  }

  function goToPage(page: number): void {
    focusAfterLoad.current = true;
    apply({ ...query, page });
  }

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        Candidatos
      </h1>
      {notice ? <Notice>{notice}</Notice> : null}
      <p>
        <Link to={candidatePaths.create}>Nuevo candidato</Link>{' '}
        <Link to={candidatePaths.import}>Importar CSV</Link>
      </p>
      <CandidateFilters
        query={query}
        onSearch={(search) => apply({ ...query, ...search, page: 1 })}
        onPageSize={(pageSize) => apply({ ...query, page: 1, pageSize })}
      />
      {candidates.state === 'loading' ? (
        <LoadingMessage>Cargando candidatos…</LoadingMessage>
      ) : null}
      {candidates.state === 'error' ? (
        <ErrorMessage message={userMessage(candidates.error)} onRetry={candidates.retry} />
      ) : null}
      {candidates.state === 'success' ? (
        <CandidateListContent data={candidates.data} query={query} onPage={goToPage} />
      ) : null}
    </>
  );
}
