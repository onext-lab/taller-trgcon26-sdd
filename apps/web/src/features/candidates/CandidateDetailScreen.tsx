import { useState } from 'react';
import { ApiError, userMessage } from '../../components/http.ts';
import { Link, matchPath, useNotice, usePath } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage, Notice } from '../../components/StatusMessages.tsx';
import { useDocumentTitle } from '../../components/use-document-title.ts';
import { useResource } from '../../components/use-resource.ts';
import { getCandidate } from './api.ts';
import { CandidateDetails } from './CandidateDetails.tsx';
import { ConsentSection } from './ConsentSection.tsx';
import { candidatePaths, parseCandidateId } from './paths.ts';
import type { Candidate } from './types.ts';

// The title is fixed: the name never goes to the title, the history or the tabs (DD-08, RNF-09).
const DETAIL_TITLE = 'Ficha de candidato';
const NOT_FOUND_TITLE = 'Candidato no encontrado';

// 404 and 400 from the API show the same as an invalid ID (EC-35).
function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

export function CandidateNotFound() {
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

type ViewProps = { candidate: Candidate; onChange: (updated: Candidate) => void };

function CandidateDetailView({ candidate, onChange }: ViewProps) {
  return (
    <>
      <CandidateDetails candidate={candidate} />
      <p className="actions">
        <Link to={candidatePaths.edit(candidate.id)}>Editar</Link>
      </p>
      <ConsentSection candidate={candidate} onChange={onChange} />
      <p>
        <Link to={candidatePaths.list}>Volver a los candidatos</Link>
      </p>
    </>
  );
}

function CandidateDetailLoader({ id }: { id: number }) {
  const arrivalNotice = useNotice();
  const candidate = useResource((signal) => getCandidate(id, signal), [id]);
  // The notice of arrival gives way to the one of the first consent action.
  const [acted, setActed] = useState(false);
  const missing = candidate.state === 'error' && isNotFound(candidate.error);
  useDocumentTitle(missing ? null : DETAIL_TITLE);

  if (missing) return <CandidateNotFound />;
  return (
    <>
      {arrivalNotice && !acted ? <Notice>{arrivalNotice}</Notice> : null}
      {candidate.state === 'loading' ? (
        <LoadingMessage>Cargando el candidato…</LoadingMessage>
      ) : null}
      {candidate.state === 'error' ? (
        <ErrorMessage message={userMessage(candidate.error)} onRetry={candidate.retry} />
      ) : null}
      {candidate.state === 'success' ? (
        <CandidateDetailView
          candidate={candidate.data}
          onChange={(updated) => {
            setActed(true);
            candidate.setData(updated);
          }}
        />
      ) : null}
    </>
  );
}

// Container of the detail screen (`/candidates/:id`): validates the ID before any request (EC-35), loads the
// candidate and shows loading, not found, error or data. `key={id}` keeps the local state of the consent
// from passing from one candidate to another.
export function CandidateDetailScreen() {
  const path = usePath();
  const id = parseCandidateId(matchPath('/candidates/:id', path)?.id ?? '');
  return id === null ? <CandidateNotFound /> : <CandidateDetailLoader key={id} id={id} />;
}
