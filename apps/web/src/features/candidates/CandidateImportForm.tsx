import type { ChangeEvent, FormEvent, RefObject } from 'react';
import { EXPECTED_HEADER } from './import-model.ts';

const FILE_ID = 'candidate-import-file';
const HELP_ID = 'candidate-import-help';

interface CandidateImportFormProps {
  inputRef: RefObject<HTMLInputElement | null>;
  hasFile: boolean;
  busy: boolean;
  /** Present when the error shown is about the file: the selector points to it and is marked invalid. */
  errorId?: string;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
}

// Presentational. The web does not look at the extension, the type or the content of the file (RN-15).
export function CandidateImportForm({
  inputRef,
  hasFile,
  busy,
  errorId,
  onFileChange,
  onSubmit,
}: CandidateImportFormProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onFileChange(event.currentTarget.files?.[0] ?? null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor={FILE_ID}>Fichero CSV</label>
        <p id={HELP_ID} className="field-help">
          La primera línea debe ser exactamente esta cabecera: <code>{EXPECTED_HEADER}</code>. CSV
          en UTF-8 separado por comas; el teléfono puede ir vacío. Como máximo, 500 candidatos y 1
          MiB.
        </p>
        <input
          ref={inputRef}
          id={FILE_ID}
          type="file"
          accept=".csv"
          disabled={busy}
          aria-describedby={errorId ? `${HELP_ID} ${errorId}` : HELP_ID}
          aria-invalid={errorId ? true : undefined}
          onChange={handleChange}
        />
      </div>
      <button type="submit" disabled={!hasFile || busy}>
        Importar
      </button>
    </form>
  );
}
