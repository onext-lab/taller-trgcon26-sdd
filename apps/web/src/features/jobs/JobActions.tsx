import { Link } from '../../components/router.tsx';
import { CloseJobAction } from './CloseJobAction.tsx';
import { DeleteJobAction } from './DeleteJobAction.tsx';
import { jobPaths } from './paths.ts';
import type { Job } from './types.ts';

/** Which lifecycle action is in flight; it disables the other buttons and renames the pressed one. */
export type PendingAction = 'publish' | 'duplicate';

type Props = {
  job: Job;
  pending: PendingAction | null;
  onPublish: () => void;
  onDuplicate: () => void;
  onClosed: (job: Job) => void;
  onConflict: (message: string) => void;
  onGone: () => void;
};

function DuplicateButton({ pending, onDuplicate }: Pick<Props, 'pending' | 'onDuplicate'>) {
  return (
    <button type="button" onClick={onDuplicate} disabled={pending !== null}>
      {pending === 'duplicate' ? 'Duplicando…' : 'Duplicar'}
    </button>
  );
}

// Actions per status (RF-06): draft edits, publishes, deletes or duplicates; published edits, closes or
// duplicates; closed only duplicates (CA-10, CA-13, CA-22, CA-23, EC-24).
export function JobActions(props: Props) {
  const { job, pending, onPublish, onDuplicate, onClosed, onConflict, onGone } = props;
  const busy = pending !== null;
  const duplicate = <DuplicateButton pending={pending} onDuplicate={onDuplicate} />;
  if (job.status === 'closed') return <div className="actions">{duplicate}</div>;

  const edit = <Link to={jobPaths.edit(job.id)}>Editar</Link>;
  if (job.status === 'published') {
    return (
      <div className="actions">
        {edit}
        <CloseJobAction
          id={job.id}
          disabled={busy}
          onClosed={onClosed}
          onConflict={onConflict}
          onGone={onGone}
        />
        {duplicate}
      </div>
    );
  }
  return (
    <div className="actions">
      {edit}
      <button type="button" onClick={onPublish} disabled={busy}>
        {pending === 'publish' ? 'Publicando…' : 'Publicar'}
      </button>
      <DeleteJobAction id={job.id} title={job.title} disabled={busy} onConflict={onConflict} />
      {duplicate}
    </div>
  );
}
