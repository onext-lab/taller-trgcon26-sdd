import { useEffect, useRef, type RefObject } from 'react';

/** Which control gets the focus back: the checkbox or «Renovar consentimiento» (falls back to the checkbox). */
export type FocusTarget = 'checkbox' | 'renew';

/** The two controls that can get the focus back; the section creates the refs and attaches them. */
export type ConsentControls = {
  checkboxRef: RefObject<HTMLInputElement | null>;
  renewRef: RefObject<HTMLButtonElement | null>;
};

export type FocusReturn = { want: (target: FocusTarget) => void };

// DD-12: the focus goes back to the control that started the action, by `ref` (never `document.activeElement`,
// which Safari does not move on click). It waits until nothing is in flight and the dialog is closed, so the
// control is enabled again. The effect only reads refs.
export function useFocusReturn(
  controls: ConsentControls,
  busy: boolean,
  dialogOpen: boolean,
): FocusReturn {
  const { checkboxRef, renewRef } = controls;
  const wanted = useRef<FocusTarget | null>(null);

  useEffect(() => {
    if (busy || dialogOpen || wanted.current === null) return;
    const target = wanted.current;
    wanted.current = null;
    const renew = target === 'renew' ? renewRef.current : null;
    (renew ?? checkboxRef.current)?.focus();
  }, [checkboxRef, renewRef, busy, dialogOpen]);

  return {
    want(target: FocusTarget): void {
      wanted.current = target;
    },
  };
}
