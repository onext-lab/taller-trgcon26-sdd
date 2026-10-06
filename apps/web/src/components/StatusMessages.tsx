import type { ReactNode } from 'react';

export function LoadingMessage({ children }: { children: ReactNode }) {
  return <p role="status">{children}</p>;
}

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-message">
      <p role="alert" className="error-text">
        {message}
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="notice">
      {children}
    </p>
  );
}
