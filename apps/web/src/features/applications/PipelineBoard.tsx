import { formatDate } from '../../components/format.ts';
import { groupByStage, rejectionReasonLabel, stageLabel } from './labels.ts';
import { STAGES, type PipelineItem, type Stage } from './types.ts';

// The card paints only these fields, even if the item carries more (RNF-04, EC-30). The name is JSX text
// and never a link (DT-01, RNF-06).
function PipelineCard({ item }: { item: PipelineItem }) {
  return (
    <li className="pipeline-card">
      <p>{item.candidateName}</p>
      <p>
        Último cambio: <time dateTime={item.lastChangeAt}>{formatDate(item.lastChangeAt)}</time>
      </p>
      {item.stage === 'rejected' && item.rejectionReason !== null ? (
        <p>Motivo: {rejectionReasonLabel(item.rejectionReason)}</p>
      ) : null}
    </li>
  );
}

function StageColumn({ stage, items }: { stage: Stage; items: readonly PipelineItem[] }) {
  const headingId = `pipeline-stage-${stage}`;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{stageLabel(stage)}</h2>
      {items.length === 0 ? (
        <p>Sin candidatos.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <PipelineCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Six columns in stage order; inside each one, the order received from the API (DD-08). */
export function PipelineBoard({ items }: { items: readonly PipelineItem[] }) {
  const groups = groupByStage(items);
  return (
    <div className="pipeline">
      {STAGES.map((stage) => (
        <StageColumn key={stage} stage={stage} items={groups[stage]} />
      ))}
    </div>
  );
}
