import { useState } from 'react';
import { userMessage } from '../../components/http.ts';
import { nextStage, stageLabel } from './labels.ts';
import {
  INVALID_TRANSITION_MESSAGE,
  NOT_FOUND_MESSAGE,
  STAGE_MISMATCH_MESSAGE,
} from './stage-errors.ts';
import type { PipelineItem, Stage } from './types.ts';
import type { PipelineFeedback } from './use-pipeline-feedback.ts';
import { useStageChange, type StageChangeCallbacks } from './use-stage-change.ts';

/** The one dialog of the screen and the card it is about (DD-02); `reject` arrives with TASK-13. */
export type StageDialog = { kind: 'none' } | { kind: 'hire'; item: PipelineItem };

export interface StageActions {
  /** Application whose request is in flight: every card button is disabled while it is not `null`. */
  pendingId: number | null;
  dialog: StageDialog;
  /** Generic failure of the open dialog (DD-06); `undefined` when there is none. */
  dialogError: string | undefined;
  /** «Avanzar a …»: sends the advance, or opens the hire dialog when the next stage is `hired`. */
  onAdvance: (item: PipelineItem) => void;
  /** «Rechazar»: it has no effect until TASK-13 connects the reject dialog. */
  onReject: (item: PipelineItem) => void;
  confirmHire: () => void;
  cancelDialog: () => void;
}

const NONE: StageDialog = { kind: 'none' };

const STALE_MESSAGES = {
  'stage-mismatch': STAGE_MISMATCH_MESSAGE,
  'invalid-transition': INVALID_TRANSITION_MESSAGE,
  'not-found': NOT_FOUND_MESSAGE,
} as const;

/**
 * Connects the stage actions to the page message and to the reload of the pipeline (DT-06). A success or a
 * stale card (409, 404) closes the dialog, shows the message and reloads; any other failure leaves the
 * dialog open with its own error and does not reload (DD-06).
 */
export function useStageActions(feedback: PipelineFeedback, reload: () => void): StageActions {
  const change = useStageChange();
  const [dialog, setDialog] = useState<StageDialog>(NONE);
  const [dialogError, setDialogError] = useState<string | undefined>(undefined);

  function callbacks(toStage: Stage, inDialog: boolean): StageChangeCallbacks {
    return {
      onChanged() {
        setDialog(NONE);
        feedback.show('notice', `Inscripción avanzada a ${stageLabel(toStage)}.`);
        reload();
      },
      onStale(kind) {
        setDialog(NONE);
        feedback.show('alert', STALE_MESSAGES[kind]);
        reload();
      },
      onFailed(error) {
        if (inDialog) setDialogError(userMessage(error));
        else feedback.show('alert', userMessage(error));
      },
    };
  }

  function send(item: PipelineItem, toStage: Stage, inDialog: boolean): void {
    feedback.clear();
    setDialogError(undefined);
    void change.advance(item, toStage, callbacks(toStage, inDialog));
  }

  function onAdvance(item: PipelineItem): void {
    const toStage = nextStage(item.stage);
    if (toStage === null) return;
    if (toStage !== 'hired') return send(item, toStage, false);
    feedback.clear();
    setDialogError(undefined);
    setDialog({ kind: 'hire', item });
  }

  return {
    pendingId: change.pendingId,
    dialog,
    dialogError,
    onAdvance,
    onReject: () => undefined,
    confirmHire() {
      if (dialog.kind === 'hire') send(dialog.item, 'hired', true);
    },
    cancelDialog() {
      setDialog(NONE);
      setDialogError(undefined);
    },
  };
}
