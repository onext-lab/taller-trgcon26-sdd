import type { FormEvent, RefObject } from 'react';
import { FormField } from '../../components/FormField.tsx';
import { ErrorMessage, LoadingMessage, Notice } from '../../components/StatusMessages.tsx';
import type { CandidateListItem } from '../candidates/types.ts';
import { Link } from '../../components/router.tsx';
import { SEARCH_LIMIT } from './api.ts';
import { applicationPath } from './paths.ts';
import type { SearchState } from './use-candidate-search.ts';
import type { EnrollPanelState } from './use-enroll-panel.ts';

const NO_RESULTS_TEXT = 'Ningún candidato coincide con la búsqueda.';
const MORE_RESULTS_TEXT = 'Hay más resultados: afina la búsqueda.';

type EnrollPanelProps = {
  panel: EnrollPanelState;
  inputRef: RefObject<HTMLInputElement | null>;
  alertRef: RefObject<HTMLParagraphElement | null>;
  /** Candidate being enrolled, or `null`: it paints «Inscribiendo…» and disables the buttons (DD-06). */
  pendingId: number | null;
  /** Enrolls this candidate (connected by the screen). */
  onEnroll: (candidate: CandidateListItem) => void;
};

// Names and emails are JSX text, never HTML (RNF-06). `skills` come in the item but are not painted (RGPD §6.2).
function ResultRow({
  candidate,
  pendingId,
  onEnroll,
}: {
  candidate: CandidateListItem;
  pendingId: number | null;
  onEnroll: EnrollPanelProps['onEnroll'];
}) {
  const nameId = `enroll-result-${candidate.id}`;
  return (
    <tr>
      <td id={nameId}>{candidate.fullName}</td>
      <td>{candidate.email}</td>
      <td>
        <button
          type="button"
          aria-describedby={nameId}
          disabled={pendingId !== null}
          onClick={() => onEnroll(candidate)}
        >
          {pendingId === candidate.id ? 'Inscribiendo…' : 'Inscribir'}
        </button>
      </td>
    </tr>
  );
}

function EnrollResults({
  state,
  pendingId,
  onEnroll,
}: {
  state: SearchState;
  pendingId: number | null;
  onEnroll: EnrollPanelProps['onEnroll'];
}) {
  if (state.status === 'loading') return <LoadingMessage>Buscando candidatos…</LoadingMessage>;
  if (state.status === 'error' && state.alert !== undefined) {
    return <ErrorMessage message={state.alert} />;
  }
  if (state.status !== 'success') return null;
  const { items, total } = state.page;
  if (items.length === 0) return <Notice>{NO_RESULTS_TEXT}</Notice>;
  return (
    <>
      <table>
        <caption>Resultados de la búsqueda</caption>
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Email</th>
            <th scope="col">Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, SEARCH_LIMIT).map((candidate) => (
            <ResultRow
              key={candidate.id}
              candidate={candidate}
              pendingId={pendingId}
              onEnroll={onEnroll}
            />
          ))}
        </tbody>
      </table>
      {total > SEARCH_LIMIT ? <Notice>{MORE_RESULTS_TEXT}</Notice> : null}
    </>
  );
}

// The «Ver la inscripción» link goes in its own `<p>` after the alert, so the alert text stays exact (DD-10).
function EnrollAlert({ panel, alertRef }: Pick<EnrollPanelProps, 'panel' | 'alertRef'>) {
  if (panel.alert === undefined) return null;
  return (
    <>
      <p role="alert" className="error-text" ref={alertRef} tabIndex={-1}>
        {panel.alert}
      </p>
      {panel.alertLinkId !== undefined ? (
        <p>
          <Link to={applicationPath(panel.alertLinkId)}>Ver la inscripción</Link>
        </p>
      ) : null}
    </>
  );
}

/** Inline panel (not a dialog, DD-02): search form, messages and results table (RF-08). */
export function EnrollPanel({ panel, inputRef, alertRef, pendingId, onEnroll }: EnrollPanelProps) {
  const { search } = panel;
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    panel.submit();
  }

  return (
    <section
      id="enroll-panel"
      className="enroll-panel"
      aria-labelledby="enroll-panel-title"
      onKeyDown={panel.onKeyDown}
    >
      <h2 id="enroll-panel-title">Inscribir candidato</h2>
      <form
        role="search"
        aria-label="Buscar candidatos para inscribir"
        noValidate
        onSubmit={submit}
      >
        <FormField id="enroll-q" label="Nombre o email" error={search.fieldError}>
          {(control) => (
            <input
              {...control}
              ref={inputRef}
              type="search"
              autoComplete="off"
              value={search.text}
              onChange={(event) => search.setText(event.target.value)}
            />
          )}
        </FormField>
        <div className="actions">
          <button type="submit" disabled={panel.busy}>
            Buscar
          </button>
          <button type="button" disabled={panel.busy} onClick={panel.close}>
            Cerrar
          </button>
        </div>
      </form>
      <EnrollAlert panel={panel} alertRef={alertRef} />
      <EnrollResults state={search.state} pendingId={pendingId} onEnroll={onEnroll} />
    </section>
  );
}
