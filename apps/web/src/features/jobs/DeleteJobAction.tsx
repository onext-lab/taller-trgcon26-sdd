import { useRef, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx';
import { ApiError, userMessage } from '../../components/http.ts';
import { Link, navigate } from '../../components/router.tsx';
import { deleteJob } from './api.ts';
import { jobPaths } from './paths.ts';

const GONE_MESSAGE = 'Esta oferta ya no existe.';

type Props = { id: number; title: string };

// «Borrar» button + confirmation dialog (DT-02, DD-05). Cancelling never calls the API; confirming sends
// one DELETE (the ref guard keeps a double click from sending two) and returns to the list with a notice.
export function DeleteJobAction({ id, title }: Props) {
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
      } else {
        setError(userMessage(caught));
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

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
      <button type="button" onClick={() => setOpen(true)}>
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
