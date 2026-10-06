import { useRef, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx';
import { ApiError, userMessage } from '../../components/http.ts';
import { Link, navigate } from '../../components/router.tsx';
import { deleteJob } from './api.ts';
import { jobPaths } from './paths.ts';

const GONE_MESSAGE = 'Esta oferta ya no existe.';

type Props = {
  id: number;
  title: string;
  /** Disables only «Borrar» while another action of the detail is in flight. */
  disabled?: boolean;
  /** 409 (the job is no longer a draft): the dialog closes; the container shows `message` and reloads. */
  onConflict?: (message: string) => void;
};

// State and API call of the delete flow. Confirming sends one DELETE (the ref guard keeps a double click
// from sending two) and returns to the list with a notice.
function useDeleteJob(id: number, onConflict?: (message: string) => void) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [gone, setGone] = useState(false);
  const inFlight = useRef(false);

  function close(): void {
    setOpen(false);
    setError(undefined);
  }

  async function confirm(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await deleteJob(id);
      navigate(jobPaths.list, { notice: 'Oferta borrada.' });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        setOpen(false);
        setGone(true);
      } else if (caught instanceof ApiError && caught.status === 409 && onConflict) {
        setOpen(false);
        onConflict(caught.message);
      } else {
        setError(userMessage(caught));
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return { open, setOpen, busy, error, gone, close, confirm };
}

// «Borrar» button + confirmation dialog (DT-02, DD-05). Cancelling never calls the API.
export function DeleteJobAction({ id, title, disabled = false, onConflict }: Props) {
  const { open, setOpen, busy, error, gone, close, confirm } = useDeleteJob(id, onConflict);

  if (gone) {
    return (
      <div className="error-message">
        <p role="alert" className="error-text">
          {GONE_MESSAGE}
        </p>
        <Link to={jobPaths.list}>Volver a las ofertas</Link>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={disabled}>
        Borrar
      </button>
      <ConfirmDialog
        open={open}
        title="¿Borrar la oferta?"
        description={`Vas a borrar «${title}». No se puede deshacer.`}
        confirmLabel="Borrar oferta"
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
        onCancel={close}
      />
    </>
  );
}
