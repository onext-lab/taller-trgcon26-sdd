import { useRef, useState } from 'react';
import { userMessage } from '../../components/http.ts';
import { useLifetimeSignal } from '../../components/use-lifetime-signal.ts';
import { registerConsent, withdrawConsent } from './api.ts';
import type { Candidate } from './types.ts';
import { useFocusReturn, type ConsentControls, type FocusTarget } from './use-consent-focus.ts';

export type { ConsentControls } from './use-consent-focus.ts';

export type ConsentAction = 'register' | 'renew' | 'withdraw';

/** Local feedback of the section: the success text (`status`) or the message of a failed register or renew. */
export type ConsentFeedback = { kind: 'status' | 'alert'; text: string };

const DONE_TEXT: Record<ConsentAction, string> = {
  register: 'Consentimiento registrado.',
  renew: 'Consentimiento renovado.',
  withdraw: 'Consentimiento retirado.',
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

// Withdrawal dialog: whether it is open, the error of a failed withdrawal (shown inside it) and the focus return.
function useWithdrawDialog(controls: ConsentControls, busy: boolean) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const focus = useFocusReturn(controls, busy, open);
  return {
    state: { dialogOpen: open, dialogError: error },
    want: focus.want,
    setOpen,
    setError,
    cancel(): void {
      focus.want('checkbox');
      setError(undefined);
      setOpen(false);
    },
  };
}

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
  const [feedback, setFeedback] = useState<ConsentFeedback | null>(null);
  const dialog = useWithdrawDialog(controls, pending !== null);
  const inFlight = useRef(false);
  const lifetimeSignal = useLifetimeSignal();

  async function run(action: ConsentAction, target: FocusTarget): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    const signal = lifetimeSignal();
    dialog.want(target);
    setPending(action);
    setFeedback(null);
    dialog.setError(undefined);
    try {
      const send = action === 'withdraw' ? withdrawConsent : registerConsent;
      const updated = await send(id, signal);
      if (signal?.aborted === true) return;
      dialog.setOpen(false);
      setFeedback({ kind: 'status', text: DONE_TEXT[action] });
      onChange(updated);
    } catch (caught) {
      if (signal?.aborted === true) return;
      if (action === 'withdraw') dialog.setError(userMessage(caught));
      else setFeedback({ kind: 'alert', text: userMessage(caught) });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return {
    pending,
    feedback,
    ...dialog.state,
    register: () => run('register', 'checkbox'),
    renew: () => run('renew', 'renew'),
    withdraw: () => run('withdraw', 'checkbox'),
    askWithdraw(): void {
      setFeedback(null);
      dialog.setError(undefined);
      dialog.setOpen(true);
    },
    cancelWithdraw: dialog.cancel,
  };
}
