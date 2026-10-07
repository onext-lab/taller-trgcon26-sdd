import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useCandidateSearch, type CandidateSearch } from './use-candidate-search.ts';

export interface EnrollPanelState {
  open: boolean;
  /** Opens or closes from the trigger. */
  toggle: () => void;
  /** Closes, drops text and results and returns the focus to the trigger (RNF-07). */
  close: () => void;
  /** Closes like `close` but leaves the focus alone: the caller moves it to a message (DD-10). */
  dismiss: () => void;
  /** An enrollment is in flight: the buttons are disabled and `Escape` does not close (DD-06). */
  busy: boolean;
  /** Runs the search; it clears the alert of the panel. */
  submit: () => void;
  /** `Escape` inside the panel closes it. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  search: CandidateSearch;
  /** Alert of the panel (the enrollment outcomes): it takes the focus when it appears. */
  alert: string | undefined;
  /** `undefined` clears it, so the same text shown twice in a row moves the focus twice. */
  showAlert: (message: string | undefined) => void;
}

// Focus that moves in effects: to the field when the panel opens (it is painted in the same commit that sets
// `open`, so the field exists) and to the alert when it appears.
function usePanelFocus(
  shown: boolean,
  alert: string | undefined,
  inputRef: RefObject<HTMLInputElement | null>,
  alertRef: RefObject<HTMLParagraphElement | null>,
): void {
  useEffect(() => {
    if (shown) inputRef.current?.focus();
  }, [shown, inputRef]);

  useEffect(() => {
    if (alert !== undefined) alertRef.current?.focus();
  }, [alert, alertRef]);
}

/**
 * Open state, focus and alert of the «Inscribir candidato» panel (DD-02: not modal, no focus trap), composed
 * with its search. `published` is whether the job accepts enrollments: if it stops being so, the panel is dropped.
 * `busy` is an enrollment in flight; `onOpen` runs when the trigger opens the panel (it clears the page message).
 */
export function useEnrollPanel(published: boolean, busy = false, onOpen?: () => void) {
  const [open, setOpen] = useState(false);
  const [alert, setAlert] = useState<string | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const search = useCandidateSearch(inputRef);

  usePanelFocus(open && published, alert, inputRef, alertRef);

  // A reload that brings a job that is no longer `published` drops the panel and what was searched (no focus:
  // the trigger is gone too).
  if (open && !published) dismiss();

  function dismiss(): void {
    setOpen(false);
    setAlert(undefined);
    search.reset();
  }

  function close(): void {
    dismiss();
    triggerRef.current?.focus();
  }

  function submit(): void {
    if (busy) return;
    setAlert(undefined);
    search.submit();
  }

  function toggle(): void {
    if (busy) return;
    if (open) return close();
    onOpen?.();
    setOpen(true);
  }

  const panel: EnrollPanelState = {
    open,
    toggle,
    close,
    dismiss,
    busy,
    submit,
    onKeyDown: (event) => {
      if (event.key === 'Escape' && !busy) close();
    },
    search,
    alert,
    showAlert: setAlert,
  };
  return { panel, triggerRef, inputRef, alertRef };
}
