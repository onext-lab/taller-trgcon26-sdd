import type { ReactNode, Ref } from 'react';

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

/** With a `ref` the notice can take focus (`tabIndex={-1}`: focusable by code, not by Tab). */
export function Notice({
  children,
  ref,
}: {
  children: ReactNode;
  ref?: Ref<HTMLParagraphElement>;
}) {
  return (
    <p role="status" className="notice" ref={ref} tabIndex={ref ? -1 : undefined}>
      {children}
    </p>
  );
}
