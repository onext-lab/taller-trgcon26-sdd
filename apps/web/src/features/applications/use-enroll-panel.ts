import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useCandidateSearch, type CandidateSearch } from './use-candidate-search.ts';

export interface EnrollPanelState {
  open: boolean;
  /** Opens or closes from the trigger. */
  toggle: () => void;
  /** Closes, drops text and results and returns the focus to the trigger (RNF-07). */
  close: () => void;
  /** Runs the search; it clears the alert of the panel. */
  submit: () => void;
  /** `Escape` inside the panel closes it. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  search: CandidateSearch;
  /** Alert of the panel (the enrollment outcomes of TASK-13): it takes the focus when it appears. */
  alert: string | undefined;
  showAlert: (message: string) => void;
}

/**
 * Open state, focus and alert of the «Inscribir candidato» panel (DD-02: not modal, no focus trap), composed
 * with its search. `published` is whether the job accepts enrollments: if it stops being so, the panel is dropped.
 */
export function useEnrollPanel(published: boolean) {
  const [open, setOpen] = useState(false);
  const [alert, setAlert] = useState<string | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const search = useCandidateSearch(inputRef);

  // The panel is painted in the same commit that sets `open`, so its field exists when this runs.
  useEffect(() => {
    if (open && published) inputRef.current?.focus();
  }, [open, published]);

  useEffect(() => {
    if (alert !== undefined) alertRef.current?.focus();
  }, [alert]);

  // A reload that brings a job that is no longer `published` drops the panel and what was searched (no focus:
  // the trigger is gone too).
  if (open && !published) {
    setOpen(false);
    setAlert(undefined);
    search.reset();
  }

  function close(): void {
    setOpen(false);
    setAlert(undefined);
    search.reset();
    triggerRef.current?.focus();
  }

  function submit(): void {
    setAlert(undefined);
    search.submit();
  }

  const panel: EnrollPanelState = {
    open,
    toggle: () => (open ? close() : setOpen(true)),
    close,
    submit,
    onKeyDown: (event) => {
      if (event.key === 'Escape') close();
    },
    search,
    alert,
    showAlert: setAlert,
  };
  return { panel, triggerRef, inputRef, alertRef };
}
