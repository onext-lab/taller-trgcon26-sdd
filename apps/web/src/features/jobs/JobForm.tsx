import type { FormEvent } from 'react';
import { FormField } from '../../components/FormField.tsx';
import { Link } from '../../components/router.tsx';
import type { FieldName, JobFormErrors, JobFormValues } from './job-form-model.ts';

// Option values are the exact literals of the API; the «í» of «híbrida» is NFC (U+00ED).
const WORK_MODE_OPTIONS = [
  { value: '', label: 'Sin indicar' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'híbrida', label: 'Híbrida' },
  { value: 'remota', label: 'Remota' },
] as const;

type Props = {
  heading: string;
  values: JobFormValues;
  errors: JobFormErrors;
  /** Error that does not belong to any field; shown in a `role="alert"` above the buttons. */
  formError?: string;
  busy: boolean;
  cancelTo: string;
  onChange: (field: FieldName, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type FieldProps = {
  name: FieldName;
  label: string;
  values: JobFormValues;
  errors: JobFormErrors;
  onChange: Props['onChange'];
};

// No native `maxLength` on any control: it counts UTF-16 units and would cut valid titles with emoji (EC-04).
function TextInput({ name, label, values, errors, onChange }: FieldProps) {
  const numeric = name === 'salaryMin' || name === 'salaryMax';
  return (
    <FormField id={name} label={label} error={errors[name]}>
      {(control) => (
        <input
          {...control}
          name={name}
          type="text"
          required={name === 'title'}
          inputMode={numeric ? 'numeric' : undefined}
          value={values[name]}
          onChange={(event) => onChange(name, event.target.value)}
        />
      )}
    </FormField>
  );
}

function DescriptionField({ values, errors, onChange }: Omit<FieldProps, 'name' | 'label'>) {
  return (
    <FormField
      id="description"
      label="Descripción"
      help="Hasta 5 000 caracteres."
      error={errors.description}
    >
      {(control) => (
        <textarea
          {...control}
          name="description"
          rows={6}
          value={values.description}
          onChange={(event) => onChange('description', event.target.value)}
        />
      )}
    </FormField>
  );
}

function WorkModeField({ values, errors, onChange }: Omit<FieldProps, 'name' | 'label'>) {
  return (
    <FormField id="workMode" label="Modalidad" error={errors.workMode}>
      {(control) => (
        <select
          {...control}
          name="workMode"
          value={values.workMode}
          onChange={(event) => onChange('workMode', event.target.value)}
        >
          {WORK_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}

// Presentational job form (`noValidate`: validation runs on submit, in the container).
export function JobForm({
  heading,
  values,
  errors,
  formError,
  busy,
  cancelTo,
  onChange,
  onSubmit,
}: Props) {
  const shared = { values, errors, onChange };
  return (
    <>
      <h1>{heading}</h1>
      <form noValidate onSubmit={onSubmit}>
        <TextInput name="title" label="Título (obligatorio)" {...shared} />
        <DescriptionField {...shared} />
        <TextInput name="location" label="Ubicación" {...shared} />
        <WorkModeField {...shared} />
        <TextInput name="salaryMin" label="Salario mínimo (€/año)" {...shared} />
        <TextInput name="salaryMax" label="Salario máximo (€/año)" {...shared} />
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
