import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx';
import { ApiError, userMessage } from '../../components/http.ts';
import { closeJob, getClosePreview } from './api.ts';
import { activeApplicationsText } from './labels.ts';
import type { Job } from './types.ts';

const CHECKING_TEXT = 'Comprobando las inscripciones activas…';

type Preview =
  | { kind: 'loading' }
  | { kind: 'ready'; activeApplications: number }
  | { kind: 'error'; message: string };

const LOADING: Preview = { kind: 'loading' };

function isStatus(error: unknown, status: number): error is ApiError {
  return error instanceof ApiError && error.status === status;
}

// Reads how many active applications a close would reject (DD-04). The dialog opens at once and this read
// starts with it; closing the dialog aborts it. A 404 means the job is gone: the container says so.
function useClosePreview(id: number, open: boolean, onGone: () => void) {
  const [preview, setPreview] = useState<Preview>(LOADING);
  const reportGone = useEffectEvent(onGone);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    getClosePreview(id, controller.signal).then(
      (value) => {
        if (controller.signal.aborted) return;
        setPreview({ kind: 'ready', activeApplications: value.activeApplications });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (isStatus(error, 404)) reportGone();
        else setPreview({ kind: 'error', message: userMessage(error) });
      },
    );
    return () => controller.abort();
  }, [id, open]);

  return { preview, resetPreview: () => setPreview(LOADING) };
}

type CloseHandlers = {
  onClosed: (job: Job) => void;
  onConflict: (message: string) => void;
  onGone: () => void;
};

// State and API call of the close. Confirming sends one `POST` (the ref guard keeps a double click from
// sending two). 200 → onClosed; 409 → onConflict; 404 → onGone; anything else stays in the dialog (CA-09).
function useCloseJob(id: number, handlers: CloseHandlers) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const inFlight = useRef(false);

  async function confirm(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      handlers.onClosed(await closeJob(id));
    } catch (caught) {
      if (isStatus(caught, 404)) handlers.onGone();
      else if (isStatus(caught, 409)) handlers.onConflict(caught.message);
      else setError(userMessage(caught));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return { busy, error, confirm, clearError: () => setError(undefined) };
}

// The count as a polite status; on a failed read the dialog `error` says it instead.
function PreviewStatus({ preview }: { preview: Preview }) {
  if (preview.kind === 'error') return null;
  return (
    <p role="status">
      {preview.kind === 'ready'
        ? activeApplicationsText(preview.activeApplications)
        : CHECKING_TEXT}
    </p>
  );
}

type Props = CloseHandlers & { id: number; disabled?: boolean };

// «Cerrar» button + confirmation dialog (RF-02, DT-08). Cancelling never calls `POST`. The dialog does not
// name the job (EC-15).
export function CloseJobAction({ id, disabled = false, onClosed, onConflict, onGone }: Props) {
  const [open, setOpen] = useState(false);
  const { preview, resetPreview } = useClosePreview(id, open, onGone);
  const { busy, error, confirm, clearError } = useCloseJob(id, {
    onClosed: (job) => {
      setOpen(false);
      onClosed(job);
    },
    onConflict: (message) => {
      setOpen(false);
      onConflict(message);
    },
    onGone,
  });

  function openDialog(): void {
    resetPreview();
    setOpen(true);
  }

  function cancel(): void {
    setOpen(false);
    clearError();
  }

  return (
    <>
      <button type="button" onClick={openDialog} disabled={disabled}>
        Cerrar
      </button>
      <ConfirmDialog
        open={open}
        title="¿Cerrar la oferta?"
        description="Una oferta cerrada no se puede reabrir: para volver a publicarla, duplícala."
        confirmLabel="Cerrar oferta"
        busy={busy}
        confirmDisabled={preview.kind !== 'ready'}
        error={error ?? (preview.kind === 'error' ? preview.message : undefined)}
        onConfirm={() => void confirm()}
        onCancel={cancel}
      >
        <PreviewStatus preview={preview} />
      </ConfirmDialog>
    </>
  );
}
