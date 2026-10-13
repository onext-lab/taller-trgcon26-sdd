import { useEffect, useRef, useState } from 'react';
import { ApiError, userMessage, type ApiErrorDetail } from '../../components/http.ts';
import { navigate } from '../../components/router.tsx';
import { useLifetimeSignal } from '../../components/use-lifetime-signal.ts';
import { duplicateJob, publishJob } from './api.ts';
import type { PendingAction } from './JobActions.tsx';
import { missingFieldsText } from './labels.ts';
import { jobPaths } from './paths.ts';
import type { Job } from './types.ts';

// Fields that the API names in the 400 of a publish with an incomplete draft (RF-01, EC-02).
const PUBLISH_FIELDS: readonly string[] = ['title', 'description', 'location', 'workMode'];
const DEADLINE_FIELD = 'enrollmentDeadline';

/** What the container does with a failed action. */
type Outcome =
  { kind: 'gone' } | { kind: 'conflict'; message: string } | { kind: 'alert'; message: string };

export type JobActionHandlers = {
  onPublished: (job: Job) => void;
  /** Sets the action alert; `null` clears it when a new action starts. */
  onAlert: (message: string | null) => void;
  /** 409 of a publish: shows the API message and reloads the job. */
  onConflict: (message: string) => void;
  /** 404: the job is gone and the actions go with it. */
  onGone: () => void;
};

function isMissingFieldsList(details: ApiErrorDetail[] | undefined): details is ApiErrorDetail[] {
  return (
    details !== undefined &&
    details.length > 0 &&
    details.every(({ field }) => PUBLISH_FIELDS.includes(field))
  );
}

// DD-06: a 400 that names the expired deadline reads «Para publicar falta: …» (if fields are missing) and the
// API message of the deadline, separated by a space. Details with any other field fall back to `error.message`.
function publishDeadlineText(details: ApiErrorDetail[] | undefined): string | null {
  const deadline = details?.find(({ field }) => field === DEADLINE_FIELD);
  if (!details || !deadline) return null;
  const rest = details.filter((detail) => detail !== deadline);
  if (rest.length > 0 && !isMissingFieldsList(rest)) return null;
  const missing = rest.length > 0 ? `${missingFieldsText(rest.map(({ field }) => field))} ` : '';
  return `${missing}${deadline.message}`;
}

// DD-05: 404 → gone; 409 (publish) → message + reload; 400 with the pending fields → their labels; any other
// failure (other 400, network, timeout, 500) → its message, and the button comes back.
function classify(error: unknown, action: PendingAction): Outcome {
  if (!(error instanceof ApiError)) return { kind: 'alert', message: userMessage(error) };
  if (error.status === 404) return { kind: 'gone' };
  if (action === 'publish' && error.status === 409) {
    return { kind: 'conflict', message: error.message };
  }
  if (action === 'publish' && error.status === 400 && isMissingFieldsList(error.details)) {
    return { kind: 'alert', message: missingFieldsText(error.details.map(({ field }) => field)) };
  }
  const deadlineText =
    action === 'publish' && error.status === 400 ? publishDeadlineText(error.details) : null;
  return { kind: 'alert', message: deadlineText ?? error.message };
}

// The focus goes back to the pressed button once it is enabled again (DD-07). The effect only reads refs.
function useReturnFocus(pending: PendingAction | null) {
  const pressed = useRef<HTMLElement | null>(null);
  const wanted = useRef(false);

  useEffect(() => {
    if (pending !== null || !wanted.current) return;
    wanted.current = false;
    pressed.current?.focus();
  }, [pending]);

  return {
    remember(): void {
      const active = document.activeElement;
      pressed.current = active instanceof HTMLElement && active !== document.body ? active : null;
    },
    want(): void {
      wanted.current = true;
    },
  };
}

/**
 * Publish and duplicate of the job detail (RF-01, RF-04). `pending` says which one is in flight; the ref guard
 * keeps a second click, made before the re-render disables the buttons, from sending another request
 * (EC-09, EC-31). No confirmation (DT-08).
 */
export function useJobActions(id: number, handlers: JobActionHandlers) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const inFlight = useRef(false);
  const focus = useReturnFocus(pending);
  const lifetimeSignal = useLifetimeSignal();

  function report(outcome: Outcome): void {
    if (outcome.kind === 'gone') return handlers.onGone();
    if (outcome.kind === 'conflict') return handlers.onConflict(outcome.message);
    focus.want();
    handlers.onAlert(outcome.message);
  }

  async function run(
    action: PendingAction,
    request: (signal?: AbortSignal) => Promise<Job>,
    onDone: (job: Job) => void,
  ): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    const signal = lifetimeSignal();
    focus.remember();
    setPending(action);
    handlers.onAlert(null);
    try {
      onDone(await request(signal));
    } catch (caught) {
      if (signal?.aborted !== true) report(classify(caught, action));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return {
    pending,
    publish: () => run('publish', (signal) => publishJob(id, signal), handlers.onPublished),
    duplicate: () =>
      run(
        'duplicate',
        (signal) => duplicateJob(id, signal),
        (copy) => navigate(jobPaths.detail(copy.id), { notice: 'Oferta duplicada.' }),
      ),
  };
}
