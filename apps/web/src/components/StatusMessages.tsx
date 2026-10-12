import type { ReactNode, Ref } from 'react';

export function LoadingMessage({ children }: { children: ReactNode }) {
  return <p role="status">{children}</p>;
}

/** With a `ref` the alert can take focus (`tabIndex={-1}`); with an `id` a control can point to it. */
export function ErrorMessage({
  message,
  onRetry,
  id,
  ref,
}: {
  message: string;
  onRetry?: () => void;
  id?: string;
  ref?: Ref<HTMLParagraphElement>;
}) {
  return (
    <div className="error-message">
      <p role="alert" className="error-text" id={id} ref={ref} tabIndex={ref ? -1 : undefined}>
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
