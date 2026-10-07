import { useEffect, useRef, useState, type RefObject } from 'react';
import { splitValidationDetails } from '../../components/form-errors.ts';
import { ApiError, userMessage } from '../../components/http.ts';
import { validateSearchText } from '../../components/list-controls.ts';
import type { CandidatePage } from '../candidates/types.ts';
import { searchCandidates } from './api.ts';

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; page: CandidatePage }
  /** `alert` is the message for the panel; a 400 only about `q` has none (it goes next to the field). */
  | { status: 'error'; alert: string | undefined };

export interface CandidateSearch {
  text: string;
  setText: (text: string) => void;
  /** Error next to the field: client validation (EC-40) or a 400 about `q` from the API. */
  fieldError: string | undefined;
  state: SearchState;
  submit: () => void;
  /** Drops text, error and results and aborts the search in flight (closing the panel). */
  reset: () => void;
}

const IDLE: SearchState = { status: 'idle' };
const LOADING: SearchState = { status: 'loading' };

function isQ(name: string): name is 'q' {
  return name === 'q';
}

// A 400 with details on `q` goes next to the field; anything else is an alert of the panel (EC-42).
function describeFailure(error: unknown): { fieldError?: string; alert?: string } {
  if (error instanceof ApiError && error.status === 400) {
    const { fields, form } = splitValidationDetails(error, isQ);
    if (fields.q !== undefined) return { fieldError: fields.q, alert: form };
  }
  return { alert: userMessage(error) };
}

/**
 * Search of the «Inscribir candidato» panel. The text and the results live only in this state (DD-03): never in
 * the URL, the title, `history.state` or the storage. One `AbortController` per search; a new one aborts the last.
 */
export function useCandidateSearch(inputRef: RefObject<HTMLInputElement | null>): CandidateSearch {
  const [text, setText] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [state, setState] = useState<SearchState>(IDLE);
  const current = useRef<AbortController | null>(null);

  function cancel(): void {
    current.current?.abort();
    current.current = null;
  }

  // Leaving the screen cancels the request in flight; so does going back to idle (reset or a failed validation).
  useEffect(() => cancel, []);
  useEffect(() => {
    if (state.status === 'idle') cancel();
  }, [state.status]);

  function fail(error: unknown): void {
    const failure = describeFailure(error);
    setFieldError(failure.fieldError);
    setState({ status: 'error', alert: failure.alert });
    if (failure.fieldError !== undefined) inputRef.current?.focus();
  }

  function submit(): void {
    cancel();
    const checked = validateSearchText(text);
    if (!checked.ok) {
      setFieldError(checked.error);
      setState(IDLE);
      inputRef.current?.focus();
      return;
    }
    const controller = new AbortController();
    current.current = controller;
    setFieldError(undefined);
    setState(LOADING);
    searchCandidates(checked.value, controller.signal).then(
      (page) => {
        if (!controller.signal.aborted) setState({ status: 'success', page });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) fail(error);
      },
    );
  }

  // State only, so it can also run while rendering; the effect above aborts what is in flight.
  function reset(): void {
    setText('');
    setFieldError(undefined);
    setState(IDLE);
  }

  return { text, setText, fieldError, state, submit, reset };
}
