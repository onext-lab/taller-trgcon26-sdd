import { formatDate } from '../../components/format.ts';
import { Link } from '../../components/router.tsx';
import { candidatePaths } from '../candidates/paths.ts';
import { rejectionReasonLabel, stageLabel } from './labels.ts';
import { pipelinePath } from './paths.ts';
import type { ApplicationDetail, HistoryEntry } from './types.ts';

const NO_STAGE = '—';

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const { fromStage, toStage, changedAt, reason, note } = entry;
  return (
    <li>
      <p>
        {fromStage ? stageLabel(fromStage) : NO_STAGE} → {stageLabel(toStage)}
      </p>
      <p>
        Fecha: <time dateTime={changedAt}>{formatDate(changedAt)}</time>
      </p>
      {reason ? <p>Motivo: {rejectionReasonLabel(reason)}</p> : null}
      {note ? (
        <>
          <p>Nota:</p>
          <p className="pre-wrap long-text">{note}</p>
        </>
      ) : null}
    </li>
  );
}

/** Header, current stage and history of an application; presentational, text only (DD-08, DD-09). */
export function ApplicationDetails({ detail }: { detail: ApplicationDetail }) {
  const { candidate, job, stage, history } = detail;
  return (
    <>
      <h1 tabIndex={-1}>Inscripción</h1>
      <dl>
        <dt>Candidato</dt>
        <dd>
          <Link to={candidatePaths.detail(candidate.id)}>{candidate.fullName}</Link>
        </dd>
        <dt>Oferta</dt>
        <dd>
          <Link to={pipelinePath(job.id)}>{job.title}</Link>
        </dd>
        <dt>Etapa actual</dt>
        <dd>{stageLabel(stage)}</dd>
      </dl>
      <h2 id="history-title">Historial</h2>
      <ol className="history" aria-labelledby="history-title">
        {history.map((entry, index) => (
          <HistoryItem key={index} entry={entry} />
        ))}
      </ol>
    </>
  );
}
