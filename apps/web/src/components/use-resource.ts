import { useEffect, useState, type DependencyList } from 'react';

// Shared read hook (DD-03): one AbortController per load, aborted on unmount and when deps change.
// Stale responses and our own cancellations never reach the state. No cache.

export type ResourceResult<T> =
  | { state: 'loading'; data: undefined; error: undefined }
  | { state: 'success'; data: T; error: undefined }
  | { state: 'error'; data: undefined; error: unknown };

export type Resource<T> = ResourceResult<T> & { retry: () => void };

const LOADING = { state: 'loading', data: undefined, error: undefined } as const;

function sameDeps(a: DependencyList, b: DependencyList): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
): Resource<T> {
  const [result, setResult] = useState<ResourceResult<T>>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const [previousDeps, setPreviousDeps] = useState(deps);

  // Reset to loading during render when deps change, so stale data is never painted for the new deps.
  if (!sameDeps(previousDeps, deps)) {
    setPreviousDeps(deps);
    setResult(LOADING);
  }

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ state: 'success', data, error: undefined });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ state: 'error', data: undefined, error });
      },
    );
    return () => controller.abort();
    // The caller owns the dependency list, as with useEffect; `load` is expected to change with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  function retry(): void {
    setResult(LOADING);
    setAttempt((value) => value + 1);
  }

  return { ...result, retry };
}
