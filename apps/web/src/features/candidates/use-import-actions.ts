import { useEffect, useRef, useState, type RefObject } from 'react';
import { userMessage } from '../../components/http.ts';
import { useLifetimeSignal } from '../../components/use-lifetime-signal.ts';
import { importCandidates } from './api.ts';
import {
  FILE_TOO_LARGE_MESSAGE,
  FILE_UNREADABLE_MESSAGE,
  isFileError,
  isFileTooLarge,
} from './import-model.ts';
import type { ImportReport } from './types.ts';

/** What the screen shows (INV-07). The chosen `File` lives outside: it is kept between `error` and `ready`. */
export type ImportView =
  | { kind: 'ready' }
  | { kind: 'importing' }
  | { kind: 'error'; message: string; fileError: boolean }
  | { kind: 'report'; report: ImportReport };

export type ImportRefs = {
  input: RefObject<HTMLInputElement | null>;
  error: RefObject<HTMLParagraphElement | null>;
  heading: RefObject<HTMLHeadingElement | null>;
};

export type ImportActions = {
  view: ImportView;
  hasFile: boolean;
  formKey: number;
  chooseFile: (file: File | null) => void;
  submit: () => Promise<void>;
  startOver: () => void;
};

function failure(message: string, fileError: boolean): ImportView {
  return { kind: 'error', message, fileError };
}

// DD-04: read the bytes before sending, so an unreadable file (EC-13) is told apart from a network failure.
async function readBytes(file: File): Promise<ArrayBuffer | null> {
  try {
    return await file.arrayBuffer();
  } catch {
    return null;
  }
}

// DT-04: the focus goes to the error message or to the report heading, by `ref`, in an effect after the commit
// (never `document.activeElement`); `startOver` asks for the selector, which is a new element after the `key` change.
function useImportFocus(view: ImportView, formKey: number, refs: ImportRefs) {
  const wantInput = useRef(false);

  useEffect(() => {
    if (view.kind === 'error') refs.error.current?.focus();
    else if (view.kind === 'report') refs.heading.current?.focus();
    else if (view.kind === 'ready' && wantInput.current) refs.input.current?.focus();
    wantInput.current = false;
  }, [view, formKey, refs]);

  return {
    wantInput(): void {
      wantInput.current = true;
    },
  };
}

// The request: read the file, send the bytes, and leave the answer in `view`. The `ArrayBuffer` is local to
// `send`: it never goes to the state. The ref guard (EC-04) keeps a second click, made before the re-render
// disables «Importar», from sending another request.
function useSendImport(setView: (view: ImportView) => void) {
  const inFlight = useRef(false);
  const lifetimeSignal = useLifetimeSignal();

  async function send(chosen: File): Promise<void> {
    inFlight.current = true;
    const signal = lifetimeSignal();
    const left = (): boolean => signal?.aborted === true;
    setView({ kind: 'importing' });
    try {
      const bytes = await readBytes(chosen);
      if (left()) return;
      if (bytes === null) {
        setView(failure(FILE_UNREADABLE_MESSAGE, true));
        return;
      }
      const report = await importCandidates(bytes, signal);
      if (!left()) setView({ kind: 'report', report });
    } catch (caught) {
      if (!left()) setView(failure(userMessage(caught), isFileError(caught)));
    } finally {
      inFlight.current = false;
    }
  }

  return { send, inFlight };
}

/**
 * State and actions of the import screen (DD-02, DD-03). The screen creates the refs and attaches them (as
 * `ConsentSection` does); the hook moves the focus to them.
 */
export function useImportActions(refs: ImportRefs): ImportActions {
  const [view, setView] = useState<ImportView>({ kind: 'ready' });
  const [file, setFile] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0);
  const { send, inFlight } = useSendImport(setView);
  const focus = useImportFocus(view, formKey, refs);

  return {
    view,
    hasFile: file !== null,
    formKey,
    chooseFile(chosen: File | null): void {
      setFile(chosen);
      if (view.kind === 'error') setView({ kind: 'ready' });
    },
    async submit(): Promise<void> {
      if (inFlight.current || file === null) return;
      if (isFileTooLarge(file)) setView(failure(FILE_TOO_LARGE_MESSAGE, true));
      else await send(file);
    },
    startOver(): void {
      focus.wantInput();
      setFile(null);
      setView({ kind: 'ready' });
      setFormKey((key) => key + 1);
    },
  };
}
