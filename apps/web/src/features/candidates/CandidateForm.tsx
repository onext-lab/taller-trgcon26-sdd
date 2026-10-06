import type { FormEvent } from 'react';
import { FormField } from '../../components/FormField.tsx';
import { Link } from '../../components/router.tsx';
import type {
  CandidateFormErrors,
  CandidateFormValues,
  FieldName,
} from './candidate-form-model.ts';
import { CONSENT_TEXT, CONSENT_VERSION } from './consent.ts';
import { candidatePaths } from './paths.ts';

type Props = {
  heading: string;
  /** Only the sign-up form has the consent; editing never touches it (RF-06). */
  withConsent: boolean;
  values: CandidateFormValues;
  errors: CandidateFormErrors;
  /** Error that does not belong to any field; shown in a `role="alert"` above the buttons. */
  formError?: string;
  /** 409: ID of the candidate that already has the email; shown as a link under the email. */
  duplicateId?: number;
  busy: boolean;
  cancelTo: string;
  onChange: (field: FieldName, value: string) => void;
  onConsentChange: (checked: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type FieldProps = {
  name: FieldName;
  label: string;
  help?: string;
  inputMode?: 'email' | 'tel';
  values: CandidateFormValues;
  errors: CandidateFormErrors;
  onChange: Props['onChange'];
};

// No native `maxLength` on any control: it counts UTF-16 units and would cut valid text with emoji.
// `autoComplete="off"`: the browser must not keep the personal data of a third party (DD-07).
function TextInput({ name, label, help, inputMode, values, errors, onChange }: FieldProps) {
  return (
    <FormField id={name} label={label} help={help} error={errors[name]}>
      {(control) => (
        <input
          {...control}
          name={name}
          type="text"
          autoComplete="off"
          inputMode={inputMode}
          value={values[name]}
          onChange={(event) => onChange(name, event.target.value)}
        />
      )}
    </FormField>
  );
}

function SummaryField({
  values,
  errors,
  onChange,
}: Pick<FieldProps, 'values' | 'errors' | 'onChange'>) {
  return (
    <FormField id="summary" label="Resumen" help="Hasta 2 000 caracteres." error={errors.summary}>
      {(control) => (
        <textarea
          {...control}
          name="summary"
          rows={6}
          autoComplete="off"
          value={values.summary}
          onChange={(event) => onChange('summary', event.target.value)}
        />
      )}
    </FormField>
  );
}

// The box starts unchecked; the help carries the text that the person is consenting to and its version (DT-01).
function ConsentFieldset({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <fieldset>
      <legend>Consentimiento para futuros procesos</legend>
      <p>
        <input
          id="consent"
          name="consent"
          type="checkbox"
          aria-describedby="consent-help"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />{' '}
        <label htmlFor="consent">El candidato da su consentimiento</label>
      </p>
      <p id="consent-help" className="field-help">
        {`${CONSENT_TEXT} Versión del texto: ${CONSENT_VERSION}.`}
      </p>
    </fieldset>
  );
}

// Presentational candidate form (`noValidate`: validation runs on submit, in the container).
export function CandidateForm({
  heading,
  withConsent,
  values,
  errors,
  formError,
  duplicateId,
  busy,
  cancelTo,
  onChange,
  onConsentChange,
  onSubmit,
}: Props) {
  const shared = { values, errors, onChange };
  return (
    <>
      <h1>{heading}</h1>
      <form noValidate onSubmit={onSubmit}>
        <TextInput name="fullName" label="Nombre y apellidos (obligatorio)" {...shared} />
        <TextInput name="email" label="Email (obligatorio)" inputMode="email" {...shared} />
        {duplicateId === undefined ? null : (
          <p>
            <Link to={candidatePaths.detail(duplicateId)}>Ver el candidato existente</Link>
          </p>
        )}
        <TextInput name="phone" label="Teléfono" inputMode="tel" {...shared} />
        <SummaryField {...shared} />
        <TextInput
          name="skills"
          label="Skills"
          help="Separadas por comas. Hasta 20, de 40 caracteres como máximo cada una."
          {...shared}
        />
        {withConsent ? (
          <ConsentFieldset checked={values.consent} onChange={onConsentChange} />
        ) : null}
        {formError ? (
          <p role="alert" className="error-text">
            {formError}
          </p>
        ) : null}
        <p>
          <button type="submit" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>{' '}
          <Link to={cancelTo}>Cancelar</Link>
        </p>
      </form>
    </>
  );
}
