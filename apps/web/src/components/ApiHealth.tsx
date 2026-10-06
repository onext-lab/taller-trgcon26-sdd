import { useEffect, useState } from 'react';

type ApiStatus = 'comprobando' | 'ok' | 'sin conexión';

// API health line for the footer (DD-07); same text as before so docs/SETUP.md and README.md still apply.
export function ApiHealth() {
  const [status, setStatus] = useState<ApiStatus>('comprobando');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((body: { status?: string }) => setStatus(body.status === 'ok' ? 'ok' : 'sin conexión'))
      .catch(() => {
        if (!controller.signal.aborted) setStatus('sin conexión');
      });
    return () => controller.abort();
  }, []);

  return <p role="status">Estado de la API: {status}</p>;
}
