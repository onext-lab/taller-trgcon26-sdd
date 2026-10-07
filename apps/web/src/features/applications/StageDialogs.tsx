import { ConfirmDialog } from '../../components/ConfirmDialog.tsx';
import type { StageActions } from './use-stage-actions.ts';

// «Cancelar» and Escape do nothing while the request is in flight (`ConfirmDialog` ignores them when `busy`).
function HireDialog({ actions }: { actions: StageActions }) {
  return (
    <ConfirmDialog
      open={actions.dialog.kind === 'hire'}
      title="¿Contratar a este candidato?"
      description="No se puede deshacer."
      confirmLabel="Contratar"
      busy={actions.pendingId !== null}
      error={actions.dialogError}
      onConfirm={actions.confirmHire}
      onCancel={actions.cancelDialog}
    />
  );
}

/** The dialogs of the pipeline: one per screen, not one per card (DD-02). Reject arrives with TASK-13. */
export function StageDialogs({ actions }: { actions: StageActions }) {
  return <HireDialog actions={actions} />;
}
