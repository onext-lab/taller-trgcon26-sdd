import type { ReactElement } from 'react';
import { ApiError, userMessage } from '../../components/http.ts';
import { Link, usePath } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage } from '../../components/StatusMessages.tsx';
import { useDocumentTitle } from '../../components/use-document-title.ts';
import { useResource } from '../../components/use-resource.ts';
import type { CandidateListItem } from '../candidates/types.ts';
import { getPipeline } from './api.ts';
import { EnrollPanel } from './EnrollPanel.tsx';
import { PipelineBoard } from './PipelineBoard.tsx';
import { parsePipelineJobId } from './paths.ts';
import type { Pipeline } from './types.ts';
import { useEnrollPanel } from './use-enroll-panel.ts';

const TITLE = 'Pipeline de la oferta';
const DRAFT_TEXT = 'Esta oferta es un borrador: publícala para inscribir candidatos.';
const EMPTY_TEXT = 'Todavía no hay candidatos inscritos en esta oferta.';

type ScreenProps = {
  /** Path of the job detail: `applications` does not import `features/jobs` (DD-01). */
  jobPath: (jobId: number) => string;
  /** What to show when the job does not exist or the ID is not valid (DD-09). */
  notFound: ReactElement;
};

// 404 and 400 from the API show the same as an invalid ID in the URL (DD-09).
function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

type PanelProps = ReturnType<typeof useEnrollPanel>;

function EnrollButton({ panel, triggerRef }: Pick<PanelProps, 'panel' | 'triggerRef'>) {
  return (
    <p>
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={panel.open}
        aria-controls="enroll-panel"
        onClick={panel.toggle}
      >
        Inscribir candidato
      </button>
    </p>
  );
}

// Enrolling a result is connected in TASK-13.
function enrollLater(_candidate: CandidateListItem): void {}

function PipelineContent({ pipeline, ...props }: PanelProps & { pipeline: Pipeline }) {
  const { panel, triggerRef, inputRef, alertRef } = props;
  const { status } = pipeline.job;
  if (status === 'draft') return <p>{DRAFT_TEXT}</p>;
  return (
    <>
      {status === 'published' ? <EnrollButton panel={panel} triggerRef={triggerRef} /> : null}
      {panel.open && status === 'published' ? (
        <EnrollPanel panel={panel} inputRef={inputRef} alertRef={alertRef} onEnroll={enrollLater} />
      ) : null}
      {pipeline.items.length === 0 ? <p>{EMPTY_TEXT}</p> : <PipelineBoard items={pipeline.items} />}
    </>
  );
}

function PipelineLoader({ id, jobPath, notFound }: ScreenProps & { id: number }) {
  const pipeline = useResource((signal) => getPipeline(id, signal), [id]);
  const published = pipeline.state === 'success' && pipeline.data.job.status === 'published';
  const enrollPanel = useEnrollPanel(published);
  if (pipeline.state === 'error' && isNotFound(pipeline.error)) return notFound;
  return (
    <>
      <h1 tabIndex={-1}>{TITLE}</h1>
      <p>
        <Link to={jobPath(id)}>Volver a la oferta</Link>
      </p>
      {pipeline.state === 'loading' ? <LoadingMessage>Cargando el pipeline…</LoadingMessage> : null}
      {pipeline.state === 'error' ? (
        <ErrorMessage message={userMessage(pipeline.error)} onRetry={pipeline.retry} />
      ) : null}
      {pipeline.state === 'success' ? (
        <PipelineContent pipeline={pipeline.data} {...enrollPanel} />
      ) : null}
    </>
  );
}

/** Container of `/jobs/:id/pipeline`: an invalid ID is «not found» without a request (EC-35). */
export function PipelineScreen({ jobPath, notFound }: ScreenProps) {
  const id = parsePipelineJobId(usePath());
  useDocumentTitle(TITLE);
  if (id === null) return notFound;
  return <PipelineLoader key={id} id={id} jobPath={jobPath} notFound={notFound} />;
}
