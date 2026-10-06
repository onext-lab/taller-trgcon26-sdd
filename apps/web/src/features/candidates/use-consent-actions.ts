import { useEffect, useRef, useState, type RefObject } from 'react';
import { userMessage } from '../../components/http.ts';
import { useLifetimeSignal } from '../../components/use-lifetime-signal.ts';
import { registerConsent, withdrawConsent } from './api.ts';
import type { Candidate } from './types.ts';

export type ConsentAction = 'register' | 'renew' | 'withdraw';

/** Which control gets the focus back: the checkbox or «Renovar consentimiento» (falls back to the checkbox). */
type FocusTarget = 'checkbox' | 'renew';

/** Local feedback of the section: the success text (`status`) or the message of a failed register or renew. */
export type ConsentFeedback = { kind: 'status' | 'alert'; text: string };

const DONE_TEXT: Record<ConsentAction, string> = {
  register: 'Consentimiento registrado.',
  renew: 'Consentimiento renovado.',
  withdraw: 'Consentimiento retirado.',
};

// DD-12: the focus goes back to the control that started the action, by `ref` (never `document.activeElement`,
// which Safari does not move on click). It waits until nothing is in flight and the dialog is closed, so the
// control is enabled again. The effect only reads refs.
function useFocusReturn(
  controls: ConsentControls,
  pending: ConsentAction | null,
  dialogOpen: boolean,
) {
  const { checkboxRef, renewRef } = controls;
  const wanted = useRef<FocusTarget | null>(null);

  useEffect(() => {
    if (pending !== null || dialogOpen || wanted.current === null) return;
    const target = wanted.current;
    wanted.current = null;
    const renew = target === 'renew' ? renewRef.current : null;
    (renew ?? checkboxRef.current)?.focus();
  }, [checkboxRef, renewRef, pending, dialogOpen]);

  return {
    want(target: FocusTarget): void {
      wanted.current = target;
    },
  };
}

/** The two controls that can get the focus back; the section creates the refs and attaches them. */
export type ConsentControls = {
  checkboxRef: RefObject<HTMLInputElement | null>;
  renewRef: RefObject<HTMLButtonElement | null>;
};

export type ConsentActions = {
  pending: ConsentAction | null;
  dialogOpen: boolean;
  feedback: ConsentFeedback | null;
  /** Error of a failed withdrawal: it stays inside the dialog. */
  dialogError: string | undefined;
  register: () => Promise<void>;
  renew: () => Promise<void>;
  withdraw: () => Promise<void>;
  askWithdraw: () => void;
  cancelWithdraw: () => void;
};

/**
 * Register, renew and withdraw the consent of a candidate (RF-06). Nothing is optimistic (DD-05): the section
 * only changes with the API answer, which goes to `onChange`. The ref guard keeps a second click, made before
 * the re-render disables the controls, from sending another request.
 */
export function useConsentActions(
  id: number,
  onChange: (updated: Candidate) => void,
  controls: ConsentControls,
): ConsentActions {
  const [pending, setPending] = useState<ConsentAction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<ConsentFeedback | null>(null);
  const [dialogError, setDialogError] = useState<string | undefined>(undefined);
  const inFlight = useRef(false);
  const lifetimeSignal = useLifetimeSignal();
  const focus = useFocusReturn(controls, pending, dialogOpen);

  async function run(action: ConsentAction, target: FocusTarget): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    const signal = lifetimeSignal();
    focus.want(target);
    setPending(action);
    setFeedback(null);
    setDialogError(undefined);
    try {
      const send = action === 'withdraw' ? withdrawConsent : registerConsent;
      const updated = await send(id, signal);
      if (signal?.aborted === true) return;
      setDialogOpen(false);
      setFeedback({ kind: 'status', text: DONE_TEXT[action] });
      onChange(updated);
    } catch (caught) {
      if (signal?.aborted === true) return;
      if (action === 'withdraw') setDialogError(userMessage(caught));
      else setFeedback({ kind: 'alert', text: userMessage(caught) });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return {
    pending,
    dialogOpen,
    feedback,
    dialogError,
    register: () => run('register', 'checkbox'),
    renew: () => run('renew', 'renew'),
    withdraw: () => run('withdraw', 'checkbox'),
    askWithdraw(): void {
      setFeedback(null);
      setDialogError(undefined);
      setDialogOpen(true);
    },
    cancelWithdraw(): void {
      focus.want('checkbox');
      setDialogError(undefined);
      setDialogOpen(false);
    },
  };
}
