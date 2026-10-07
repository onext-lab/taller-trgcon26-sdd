import { ConfirmDialog } from '../../components/ConfirmDialog.tsx';
import { FormField } from '../../components/FormField.tsx';
import { NOTE_MAX, noteLength, REASON_OPTIONS } from './reject-form.ts';
import type { RejectForm } from './use-reject-form.ts';
import type { StageActions } from './use-stage-actions.ts';

const NOTE_HELP =
  'No incluyas datos sensibles (salud, origen, ideología, religión…) ni nada que no sea necesario para la decisión.';
const REASON_ERROR_ID = 'reject-reason-error';
const COUNTER_ID = 'reject-note-counter';

// «Cancelar» and Escape do nothing while the request is in flight (`ConfirmDialog` ignores them when `busy`).
function HireDialog({ actions }: { actions: StageActions }) {
  return (
    <ConfirmDialog
      open={actions.dialog.kind === 'hire'}
      title="¿Contratar a este candidato?"
      description="No se puede deshacer."
      confirmLabel="Contratar"
      busy={actions.pendingId !== null}
      error={actions.dialogError}
      onConfirm={actions.confirmHire}
      onCancel={actions.cancelDialog}
    />
  );
}

// Three radios, none checked; the error hangs from every one of them (RNF-08).
function ReasonFieldset({ form }: { form: RejectForm }) {
  const { errors, values } = form;
  return (
    <fieldset>
      <legend>Motivo</legend>
      {REASON_OPTIONS.map(({ code, label }, index) => (
        <p key={code}>
          <label>
            <input
              type="radio"
              name="reject-reason"
              value={code}
              ref={index === 0 ? form.firstReasonRef : undefined}
              checked={values.reason === code}
              aria-invalid={errors.reason ? true : undefined}
              aria-describedby={errors.reason ? REASON_ERROR_ID : undefined}
              onChange={() => form.setReason(code)}
            />{' '}
            {label}
          </label>
        </p>
      ))}
      {errors.reason ? (
        <p id={REASON_ERROR_ID} className="error-text">
          {errors.reason}
        </p>
      ) : null}
    </fieldset>
  );
}

// The counter counts what the rule checks: the trimmed text in code points (DD-07). It is not a live region.
function NoteField({ form }: { form: RejectForm }) {
  const { errors, values } = form;
  return (
    <FormField id="reject-note" label="Nota (opcional)" help={NOTE_HELP} error={errors.note}>
      {(control) => (
        <>
          <textarea
            {...control}
            ref={form.noteRef}
            aria-describedby={`${control['aria-describedby'] ?? ''} ${COUNTER_ID}`.trim()}
            rows={4}
            autoComplete="off"
            value={values.note}
            onChange={(event) => form.setNote(event.target.value)}
          />
          <p id={COUNTER_ID} className="field-help">
            {noteLength(values.note)}/{NOTE_MAX}
          </p>
        </>
      )}
    </FormField>
  );
}

// Enter in the note is a line break: «Rechazar» is a plain button, not a submit (DD-03).
function RejectDialog({ actions }: { actions: StageActions }) {
  return (
    <ConfirmDialog
      open={actions.dialog.kind === 'reject'}
      title="Rechazar la inscripción"
      confirmLabel="Rechazar"
      busy={actions.pendingId !== null}
      error={actions.dialogError}
      onConfirm={actions.confirmReject}
      onCancel={actions.cancelDialog}
    >
      <ReasonFieldset form={actions.rejectForm} />
      <NoteField form={actions.rejectForm} />
    </ConfirmDialog>
  );
}

/** The dialogs of the pipeline: one of each per screen, not one per card (DD-02). */
export function StageDialogs({ actions }: { actions: StageActions }) {
  return (
    <>
      <HireDialog actions={actions} />
      <RejectDialog actions={actions} />
    </>
  );
}
