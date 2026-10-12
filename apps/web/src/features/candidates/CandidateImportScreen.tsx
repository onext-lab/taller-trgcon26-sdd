import { useRef } from 'react';
import { ErrorMessage, LoadingMessage } from '../../components/StatusMessages.tsx';
import { useDocumentTitle } from '../../components/use-document-title.ts';
import { CandidateImportForm } from './CandidateImportForm.tsx';
import { CandidateImportReport } from './CandidateImportReport.tsx';
import { INITIAL_LIST_QUERY, saveListState } from './list-state.ts';
import { useImportActions } from './use-import-actions.ts';

const ERROR_ID = 'candidate-import-error';

// Container of `/candidates/import`. State only in memory (RNF-03); the name of the file is never painted (DD-07).
export function CandidateImportScreen() {
  useDocumentTitle('Importar candidatos');
  const input = useRef<HTMLInputElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const actions = useImportActions({ input, error, heading });
  const { view } = actions;

  return (
    <>
      <h1>Importar candidatos</h1>
      {view.kind === 'report' ? (
        <CandidateImportReport
          report={view.report}
          headingRef={heading}
          onStartOver={actions.startOver}
          // DD-05: the list opens without filters, so the new candidates show up first.
          onGoToList={() => saveListState(INITIAL_LIST_QUERY)}
        />
      ) : (
        <>
          <CandidateImportForm
            key={actions.formKey}
            inputRef={input}
            hasFile={actions.hasFile}
            busy={view.kind === 'importing'}
            errorId={view.kind === 'error' && view.fileError ? ERROR_ID : undefined}
            onFileChange={actions.chooseFile}
            onSubmit={() => void actions.submit()}
          />
          {view.kind === 'importing' ? <LoadingMessage>Importando…</LoadingMessage> : null}
          {view.kind === 'error' ? (
            <ErrorMessage message={view.message} id={ERROR_ID} ref={error} />
          ) : null}
        </>
      )}
    </>
  );
}
