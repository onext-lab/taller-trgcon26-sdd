import { useId, useRef } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx';
import { CONSENT_TEXT, CONSENT_VERSION, consentStatus, consentSummary } from './consent.ts';
import type { Candidate } from './types.ts';
import { useConsentActions, type ConsentActions } from './use-consent-actions.ts';

const REGISTERING_TEXT = 'Registrando el consentimiento…';

// Success text, or the alert of a failed register or renew; while registering, the progress text instead.
function Feedback({ actions }: { actions: ConsentActions }) {
  if (actions.pending === 'register') return <p role="status">{REGISTERING_TEXT}</p>;
  const { feedback } = actions;
  if (feedback === null) return null;
  if (feedback.kind === 'alert') {
    return (
      <p role="alert" className="error-text">
        {feedback.text}
      </p>
    );
  }
  return <p role="status">{feedback.text}</p>;
}

type Props = {
  candidate: Candidate;
  /** Receives the candidate that the API answers with: the container replaces its data with it. */
  onChange: (updated: Candidate) => void;
};

// Consent section of the detail (RF-06): the checkbox shows what is saved (DD-05). Checking it registers at
// once; unchecking asks first. The version shown as accepted is the saved one; `CONSENT_VERSION` only goes
// with the text of the checkbox (DD-04).
export function ConsentSection({ candidate, onChange }: Props) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const renewRef = useRef<HTMLButtonElement>(null);
  const actions = useConsentActions(candidate.id, onChange, { checkboxRef, renewRef });
  const headingId = useId();
  const textId = useId();
  const status = consentStatus(candidate);
  const busy = actions.pending !== null;

  // With a current consent a click always means «withdraw»; without one it only registers (CA-28).
  function toggle(): void {
    if (status === 'active') actions.askWithdraw();
    else void actions.register();
  }

  return (
    <section aria-labelledby={headingId} tabIndex={-1} className="consent-section">
      <h2 id={headingId}>Consentimiento para futuros procesos</h2>
      <p className="consent-summary">{consentSummary(candidate)}</p>
      <p id={textId} className="long-text">
        {CONSENT_TEXT}
      </p>
      <p>Versión del texto: {CONSENT_VERSION}.</p>
      <label className="consent-checkbox">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={status === 'active'}
          disabled={busy}
          aria-describedby={textId}
          onChange={toggle}
        />
        El candidato da su consentimiento
      </label>
      {status === 'active' ? (
        <p>
          <button
            ref={renewRef}
            type="button"
            disabled={busy}
            onClick={() => void actions.renew()}
          >
            {actions.pending === 'renew' ? 'Renovando…' : 'Renovar consentimiento'}
          </button>
        </p>
      ) : null}
      <Feedback actions={actions} />
      <ConfirmDialog
        open={actions.dialogOpen}
        title="¿Retirar el consentimiento?"
        description="Se guardará la fecha de retirada y se conservarán la de otorgamiento y la versión. La fecha de fin de retención se recalculará sin el consentimiento y puede quedar ya vencida."
        confirmLabel="Retirar"
        busy={actions.pending === 'withdraw'}
        error={actions.dialogError}
        onConfirm={() => void actions.withdraw()}
        onCancel={actions.cancelWithdraw}
      />
    </section>
  );
}
