import { useEffect, useId, useRef, type SyntheticEvent } from 'react';

// Native modal <dialog> (DD-05): showModal() makes the rest of the page inert and Escape fires `cancel`.
// Initial focus goes to «Cancelar» (DT-02); on close, focus returns to the element that opened it.

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Open/close lifecycle: showModal() on open, initial focus on «Cancelar», focus back to the trigger on close.
function useModalDialog(open: boolean, busy: boolean, onCancel: () => void) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  // Escape: keep the dialog controlled by `open`; the parent closes it through onCancel.
  function handleCancelEvent(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    if (!busy) onCancel();
  }

  // The browser may still close it on its own (e.g. repeated Escape); keep the parent in sync.
  function handleCloseEvent(): void {
    if (open) onCancel();
  }

  return { dialogRef, cancelRef, handleCancelEvent, handleCloseEvent };
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { dialogRef, cancelRef, handleCancelEvent, handleCloseEvent } = useModalDialog(
    open,
    busy,
    onCancel,
  );
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={handleCancelEvent}
      onClose={handleCloseEvent}
    >
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId} className="long-text">
        {description}
      </p>
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
      <div className="dialog-actions">
        <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
