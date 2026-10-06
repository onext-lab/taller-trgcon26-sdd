import { useEffect } from 'react';

const APP_NAME = 'ATS';

/** Sets `document.title` to «{title} · ATS»; `null` leaves the title as it is (e.g. while loading). */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (title !== null) document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}
