import type { ReactElement } from 'react';
import { isNotFound, userMessage } from '../../components/http.ts';
import { usePath } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage } from '../../components/StatusMessages.tsx';
import { useDocumentTitle } from '../../components/use-document-title.ts';
import { useResource } from '../../components/use-resource.ts';
import { getApplicationDetail } from './api.ts';
import { ApplicationDetails } from './ApplicationDetails.tsx';
import { parseApplicationId } from './paths.ts';

const TITLE = 'Inscripción';

type ScreenProps = {
  /** What to show when the application does not exist or the ID is not valid (DD-09). */
  notFound: ReactElement;
};

function ApplicationLoader({ id, notFound }: ScreenProps & { id: number }) {
  const application = useResource((signal) => getApplicationDetail(id, signal), [id]);
  if (application.state === 'error' && isNotFound(application.error)) return notFound;
  if (application.state === 'success') return <ApplicationDetails detail={application.data} />;
  return (
    <>
      <h1 tabIndex={-1}>{TITLE}</h1>
      {application.state === 'loading' ? (
        <LoadingMessage>Cargando la inscripción…</LoadingMessage>
      ) : (
        <ErrorMessage message={userMessage(application.error)} onRetry={application.retry} />
      )}
    </>
  );
}

/** Container of `/applications/:id`: an invalid ID is «not found» without a request (EC-42). */
export function ApplicationDetailScreen({ notFound }: ScreenProps) {
  const id = parseApplicationId(usePath());
  useDocumentTitle(TITLE);
  if (id === null) return notFound;
  return <ApplicationLoader key={id} id={id} notFound={notFound} />;
}
