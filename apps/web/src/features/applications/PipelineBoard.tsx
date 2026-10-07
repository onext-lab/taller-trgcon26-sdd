import { formatDate } from '../../components/format.ts';
import { Link } from '../../components/router.tsx';
import { groupByStage, nextStage, rejectionReasonLabel, stageLabel } from './labels.ts';
import { applicationPath } from './paths.ts';
import { STAGES, type PipelineItem, type Stage } from './types.ts';

/** What the cards can do (W4): present only in a published job; `null` is the read-only board (DT-09). */
export interface CardActions {
  /** Application with a request in flight: every button of every card is disabled while it is not `null`. */
  pendingId: number | null;
  onAdvance: (item: PipelineItem) => void;
  onReject: (item: PipelineItem) => void;
}

// The visible text comes first and the name of the candidate follows hidden, so each name is unique (DD-04).
function CardActionButtons({ item, actions }: { item: PipelineItem; actions: CardActions }) {
  const next = nextStage(item.stage);
  if (next === null) return null;
  const suffix = <span className="visually-hidden">: {item.candidateName}</span>;
  const disabled = actions.pendingId !== null;
  return (
    <div className="card-actions">
      <button type="button" disabled={disabled} onClick={() => actions.onAdvance(item)}>
        {actions.pendingId === item.id ? 'Avanzando…' : `Avanzar a ${stageLabel(next)}`}
        {suffix}
      </button>
      <button type="button" disabled={disabled} onClick={() => actions.onReject(item)}>
        Rechazar{suffix}
      </button>
    </div>
  );
}

// The card paints only these fields, even if the item carries more (RNF-04, EC-30). The name is JSX text,
// a link to the application (RNF-06); the first `<p>` stays the name.
function PipelineCard({ item, actions }: { item: PipelineItem; actions: CardActions | null }) {
  return (
    <li className="pipeline-card">
      <p>
        <Link to={applicationPath(item.id)}>{item.candidateName}</Link>
      </p>
      <p>
        Último cambio: <time dateTime={item.lastChangeAt}>{formatDate(item.lastChangeAt)}</time>
      </p>
      {item.stage === 'rejected' && item.rejectionReason !== null ? (
        <p>Motivo: {rejectionReasonLabel(item.rejectionReason)}</p>
      ) : null}
      {actions === null ? null : <CardActionButtons item={item} actions={actions} />}
    </li>
  );
}

type ColumnProps = { stage: Stage; items: readonly PipelineItem[]; actions: CardActions | null };

function StageColumn({ stage, items, actions }: ColumnProps) {
  const headingId = `pipeline-stage-${stage}`;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{stageLabel(stage)}</h2>
      {items.length === 0 ? (
        <p>Sin candidatos.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <PipelineCard key={item.id} item={item} actions={actions} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Six columns in stage order; inside each one, the order received from the API (DD-08). */
export function PipelineBoard({
  items,
  actions,
}: {
  items: readonly PipelineItem[];
  actions: CardActions | null;
}) {
  const groups = groupByStage(items);
  return (
    <div className="pipeline">
      {STAGES.map((stage) => (
        <StageColumn key={stage} stage={stage} items={groups[stage]} actions={actions} />
      ))}
    </div>
  );
}
