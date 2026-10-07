import { useState } from 'react';
import { ApiError, userMessage } from '../../components/http.ts';
import { nextStage, stageLabel } from './labels.ts';
import {
  INVALID_TRANSITION_MESSAGE,
  NOT_FOUND_MESSAGE,
  STAGE_MISMATCH_MESSAGE,
} from './stage-errors.ts';
import type { PipelineItem, Stage } from './types.ts';
import type { PipelineFeedback } from './use-pipeline-feedback.ts';
import { useRejectForm, type RejectForm } from './use-reject-form.ts';
import { useStageChange, type StageChangeCallbacks } from './use-stage-change.ts';

/** The one dialog of the screen and the card it is about (DD-02). */
export type StageDialog =
  { kind: 'none' } | { kind: 'hire'; item: PipelineItem } | { kind: 'reject'; item: PipelineItem };

export interface StageActions {
  /** Application whose request is in flight: every card button is disabled while it is not `null`. */
  pendingId: number | null;
  dialog: StageDialog;
  /** Generic failure of the open dialog (DD-06); `undefined` when there is none. */
  dialogError: string | undefined;
  /** The form of the reject dialog (reason and note, errors and controls to focus). */
  rejectForm: RejectForm;
  /** «Avanzar a …»: sends the advance, or opens the hire dialog when the next stage is `hired`. */
  onAdvance: (item: PipelineItem) => void;
  /** «Rechazar» of a card: opens the reject dialog with an empty form. */
  onReject: (item: PipelineItem) => void;
  confirmHire: () => void;
  /** «Rechazar» of the dialog: validates and, if it passes, sends the reject. */
  confirmReject: () => void;
  cancelDialog: () => void;
}

const NONE: StageDialog = { kind: 'none' };
const REJECTED_TEXT = 'Inscripción rechazada.';

const STALE_MESSAGES = {
  'stage-mismatch': STAGE_MISMATCH_MESSAGE,
  'invalid-transition': INVALID_TRANSITION_MESSAGE,
  'not-found': NOT_FOUND_MESSAGE,
} as const;

interface Screen {
  feedback: PipelineFeedback;
  reload: () => void;
  closeDialog: () => void;
}

// Success and stale card close the dialog, say it on the page and reload; `onFailed` is each action's own.
function stageCallbacks(
  { feedback, reload, closeDialog }: Screen,
  successText: string,
  onFailed: StageChangeCallbacks['onFailed'],
): StageChangeCallbacks {
  return {
    onChanged() {
      closeDialog();
      feedback.show('notice', successText);
      reload();
    },
    onStale(kind) {
      closeDialog();
      feedback.show('alert', STALE_MESSAGES[kind]);
      reload();
    },
    onFailed,
  };
}

// A 400 puts each message next to its field and leaves the rest for the dialog; anything else goes to the dialog.
function rejectFailureText(error: unknown, form: RejectForm): string | undefined {
  if (error instanceof ApiError && error.status === 400) return form.applyServerError(error);
  return userMessage(error);
}

// The open dialog and its generic error; opening or closing one drops what the reject form had.
function useDialogState(feedback: PipelineFeedback, rejectForm: RejectForm) {
  const [dialog, setDialog] = useState<StageDialog>(NONE);
  const [error, setError] = useState<string | undefined>(undefined);
  return {
    dialog,
    error,
    setError,
    close() {
      setDialog(NONE);
      setError(undefined);
      rejectForm.reset();
    },
    open(next: StageDialog) {
      feedback.clear();
      rejectForm.reset();
      setError(undefined);
      setDialog(next);
    },
  };
}

/**
 * Connects the stage actions to the page message and to the reload of the pipeline (DT-06). A success or a
 * stale card (409, 404) closes the dialog, shows the message and reloads; any other failure leaves the
 * dialog open with its own error and does not reload (DD-06).
 */
export function useStageActions(feedback: PipelineFeedback, reload: () => void): StageActions {
  const change = useStageChange();
  const rejectForm = useRejectForm();
  const state = useDialogState(feedback, rejectForm);
  const { dialog, setError } = state;
  const screen = { feedback, reload, closeDialog: state.close };

  function advance(item: PipelineItem, toStage: Stage, inDialog: boolean): void {
    feedback.clear();
    setError(undefined);
    const text = `Inscripción avanzada a ${stageLabel(toStage)}.`;
    const onFailed = (error: unknown): void => {
      if (inDialog) setError(userMessage(error));
      else feedback.show('alert', userMessage(error));
    };
    void change.advance(item, toStage, stageCallbacks(screen, text, onFailed));
  }

  function reject(item: PipelineItem): void {
    const input = rejectForm.validate();
    if (input === null) return;
    feedback.clear();
    setError(undefined);
    const onFailed = (error: unknown): void => setError(rejectFailureText(error, rejectForm));
    void change.reject(item, input, stageCallbacks(screen, REJECTED_TEXT, onFailed));
  }

  function onAdvance(item: PipelineItem): void {
    const toStage = nextStage(item.stage);
    if (toStage === null) return;
    if (toStage !== 'hired') return advance(item, toStage, false);
    state.open({ kind: 'hire', item });
  }

  return {
    pendingId: change.pendingId,
    dialog,
    dialogError: state.error,
    rejectForm,
    onAdvance,
    onReject: (item) => state.open({ kind: 'reject', item }),
    confirmHire() {
      if (dialog.kind === 'hire') advance(dialog.item, 'hired', true);
    },
    confirmReject() {
      if (dialog.kind === 'reject') reject(dialog.item);
    },
    cancelDialog: state.close,
  };
}
