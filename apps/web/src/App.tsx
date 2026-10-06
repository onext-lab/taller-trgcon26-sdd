import { useEffect, useState } from 'react';

type ApiStatus = 'comprobando' | 'ok' | 'sin conexión';

export function App() {
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

  return (
    <main>
      <h1>ATS</h1>
      <p role="status">Estado de la API: {status}</p>
    </main>
  );
}
