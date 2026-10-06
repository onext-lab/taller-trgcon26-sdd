import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// Minimal router on top of the History API (DD-01). Never put personal data in the URL or in history.state:
// the only thing that travels in history.state is one of the fixed notices below.

export type NoticeText = 'Oferta creada.' | 'Cambios guardados.' | 'Oferta borrada.';

const NOTICES: readonly NoticeText[] = ['Oferta creada.', 'Cambios guardados.', 'Oferta borrada.'];
const NAVIGATE_EVENT = 'ats:navigate';

export type NavigateOptions = { replace?: boolean; notice?: NoticeText };

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

function getPath(): string {
  return window.location.pathname;
}

export function readNotice(): NoticeText | null {
  const state: unknown = window.history.state;
  if (typeof state !== 'object' || state === null || !('notice' in state)) return null;
  const notice = state.notice;
  return NOTICES.find((text) => text === notice) ?? null;
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, getPath);
}

export function useNotice(): NoticeText | null {
  return useSyncExternalStore(subscribe, readNotice);
}

export function navigate(to: string, options: NavigateOptions = {}): void {
  const state = options.notice ? { notice: options.notice } : null;
  if (options.replace) window.history.replaceState(state, '', to);
  else window.history.pushState(state, '', to);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

function isPlainPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };

export function Link({ to, onClick, ...rest }: LinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    onClick?.(event);
    if (event.defaultPrevented || !isPlainPrimaryClick(event)) return;
    if (rest.target !== undefined && rest.target !== '_self') return;
    event.preventDefault();
    navigate(to);
  }
  return <a {...rest} href={to} onClick={handleClick} />;
}

function splitPath(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

// matchPath('/jobs/:id', '/jobs/7') → { id: '7' }. Parameters stay as text; callers convert them.
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = splitPath(pattern);
  const pathParts = splitPath(path);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of patternParts.entries()) {
    const value = pathParts[index] ?? '';
    if (part.startsWith(':')) {
      if (value === '') return null;
      params[part.slice(1)] = value;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}
