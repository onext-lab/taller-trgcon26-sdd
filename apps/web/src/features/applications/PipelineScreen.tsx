import type { ReactElement } from 'react';
import { isNotFound, userMessage } from '../../components/http.ts';
import { Link, usePath } from '../../components/router.tsx';
import { ErrorMessage, LoadingMessage, Notice } from '../../components/StatusMessages.tsx';
import { useDocumentTitle } from '../../components/use-document-title.ts';
import { useResource } from '../../components/use-resource.ts';
import type { CandidateListItem } from '../candidates/types.ts';
import { getPipeline } from './api.ts';
import { DUPLICATE_MESSAGE, NOT_PUBLISHED_MESSAGE } from './enroll-errors.ts';
import { EnrollPanel } from './EnrollPanel.tsx';
import { PipelineBoard } from './PipelineBoard.tsx';
import { parsePipelineJobId } from './paths.ts';
import { StageDialogs } from './StageDialogs.tsx';
import type { Pipeline } from './types.ts';
import { useEnrollment, type EnrollCallbacks } from './use-enrollment.ts';
import { useEnrollPanel, type EnrollPanelState } from './use-enroll-panel.ts';
import { usePipelineFeedback, type PipelineFeedback } from './use-pipeline-feedback.ts';
import { useStageActions, type StageActions } from './use-stage-actions.ts';

const TITLE = 'Pipeline de la oferta';
const DRAFT_TEXT = 'Esta oferta es un borrador: publícala para inscribir candidatos.';
const EMPTY_TEXT = 'Todavía no hay candidatos inscritos en esta oferta.';
const ENROLLED_TEXT = 'Candidato inscrito.';

type ScreenProps = {
  /** Path of the job detail: `applications` does not import `features/jobs` (DD-01). */
  jobPath: (jobId: number) => string;
  /** What to show when the job does not exist or the ID is not valid (DD-09). */
  notFound: ReactElement;
};

type PanelProps = ReturnType<typeof useEnrollPanel>;

function EnrollButton({ panel, triggerRef }: Pick<PanelProps, 'panel' | 'triggerRef'>) {
  return (
    <p>
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={panel.open}
        aria-controls="enroll-panel"
        disabled={panel.busy}
        onClick={panel.toggle}
      >
        Inscribir candidato
      </button>
    </p>
  );
}

type ContentProps = PanelProps & {
  pipeline: Pipeline;
  pendingId: number | null;
  onEnroll: (candidate: CandidateListItem) => void;
  stageActions: StageActions;
};

function PipelineContent({ pipeline, pendingId, onEnroll, stageActions, ...props }: ContentProps) {
  const { panel, triggerRef, inputRef, alertRef } = props;
  const { status } = pipeline.job;
  if (status === 'draft') return <p>{DRAFT_TEXT}</p>;
  return (
    <>
      {status === 'published' ? <EnrollButton panel={panel} triggerRef={triggerRef} /> : null}
      {panel.open && status === 'published' ? (
        <EnrollPanel
          panel={panel}
          inputRef={inputRef}
          alertRef={alertRef}
          pendingId={pendingId}
          onEnroll={onEnroll}
        />
      ) : null}
      {pipeline.items.length === 0 ? (
        <p>{EMPTY_TEXT}</p>
      ) : (
        <PipelineBoard
          items={pipeline.items}
          actions={status === 'published' ? stageActions : null}
        />
      )}
      {status === 'published' ? <StageDialogs actions={stageActions} /> : null}
    </>
  );
}

// Where each outcome of the enrollment goes (DD-05, DD-10). Every failure but the generic one reloads.
function enrollCallbacks(
  panel: EnrollPanelState,
  feedback: PipelineFeedback,
  reload: () => void,
): EnrollCallbacks {
  return {
    onEnrolled() {
      panel.dismiss();
      feedback.show('notice', ENROLLED_TEXT);
      reload();
    },
    onDuplicate(existingId) {
      panel.showAlert(DUPLICATE_MESSAGE, existingId);
      reload();
    },
    onNotPublished() {
      panel.dismiss();
      feedback.show('alert', NOT_PUBLISHED_MESSAGE);
      reload();
    },
    onNotFound(message) {
      panel.showAlert(message);
      reload();
    },
    onFailed: panel.showAlert,
  };
}

function PageMessage({ feedback }: { feedback: PipelineFeedback }) {
  const { feedback: message, messageRef } = feedback;
  if (message === null) return null;
  if (message.kind === 'notice') return <Notice ref={messageRef}>{message.text}</Notice>;
  return (
    <p role="alert" className="error-text" ref={messageRef} tabIndex={-1}>
      {message.text}
    </p>
  );
}

function PipelineLoader({ id, jobPath, notFound }: ScreenProps & { id: number }) {
  const pipeline = useResource((signal) => getPipeline(id, signal), [id]);
  const published = pipeline.state === 'success' && pipeline.data.job.status === 'published';
  const feedback = usePipelineFeedback();
  const enrollment = useEnrollment(id);
  const stageActions = useStageActions(feedback, pipeline.reload);
  const enrollPanel = useEnrollPanel(published, enrollment.pendingId !== null, feedback.clear);
  function enroll(candidate: CandidateListItem): void {
    enrollPanel.panel.showAlert(undefined);
    void enrollment.enroll(
      candidate.id,
      enrollCallbacks(enrollPanel.panel, feedback, pipeline.reload),
    );
  }
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
      <PageMessage feedback={feedback} />
      {pipeline.state === 'success' ? (
        <PipelineContent
          pipeline={pipeline.data}
          pendingId={enrollment.pendingId}
          onEnroll={enroll}
          stageActions={stageActions}
          {...enrollPanel}
        />
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
