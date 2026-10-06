import { useEffect, useRef } from 'react';

// One AbortController for the life of the screen: leaving it cancels a request in flight, so a late
// duplicate never navigates from somewhere else. Re-created on each mount (StrictMode runs the effect twice).
export function useLifetimeSignal(): () => AbortSignal | undefined {
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const own = new AbortController();
    controller.current = own;
    return () => own.abort();
  }, []);
  return () => controller.current?.signal;
}
