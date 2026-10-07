import { useRef, useState } from 'react';
import { useLifetimeSignal } from '../../components/use-lifetime-signal.ts';
import { advanceApplication, rejectApplication } from './api.ts';
import { classifyStageError } from './stage-errors.ts';
import type { Application, PipelineItem, RejectInput, Stage } from './types.ts';

/** Where each outcome of an advance or a reject goes (DD-05): the screen decides what each one paints. */
export interface StageChangeCallbacks {
  /** 200, also the retry of one that already went through (EC-35). */
  onChanged: (application: Application) => void;
  /** 409 `STAGE_MISMATCH`, 409 `INVALID_TRANSITION` or 404: the card is no longer where the page thought. */
  onStale: (kind: 'stage-mismatch' | 'invalid-transition' | 'not-found') => void;
  /** Network, timeout, 400, 403, 413, 415, 500 or an invalid answer; the screen builds the text from it. */
  onFailed: (error: unknown) => void;
}

export interface StageChange {
  /** Application whose request is in flight, or `null`. */
  pendingId: number | null;
  /** Sends one `POST advance`; while one stage action is in flight, any other call does nothing. */
  advance: (item: PipelineItem, toStage: Stage, callbacks: StageChangeCallbacks) => Promise<void>;
  /** Sends one `POST reject` with the stage of the card as `expectedStage`; same guard as `advance`. */
  reject: (
    item: PipelineItem,
    input: Omit<RejectInput, 'expectedStage'>,
    callbacks: StageChangeCallbacks,
  ) => Promise<void>;
}

function failureOutcome(error: unknown, callbacks: StageChangeCallbacks): () => void {
  const kind = classifyStageError(error);
  if (kind === 'other') return () => callbacks.onFailed(error);
  return () => callbacks.onStale(kind);
}

/**
 * One stage action at a time in the whole screen (DD-01). The ref guard keeps a second click, made before the
 * re-render disables the buttons, from sending another request; leaving the screen cancels the request in
 * flight and drops its outcome.
 */
export function useStageChange(): StageChange {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const inFlight = useRef(false);
  const lifetimeSignal = useLifetimeSignal();

  async function run(
    item: PipelineItem,
    send: (signal: AbortSignal | undefined) => Promise<Application>,
    callbacks: StageChangeCallbacks,
  ): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    const signal = lifetimeSignal();
    setPendingId(item.id);
    let outcome: () => void;
    try {
      const application = await send(signal);
      outcome = () => callbacks.onChanged(application);
    } catch (error) {
      outcome = failureOutcome(error, callbacks);
    }
    inFlight.current = false;
    setPendingId(null);
    if (signal?.aborted !== true) outcome();
  }

  return {
    pendingId,
    advance: (item, toStage, callbacks) =>
      run(
        item,
        (signal) => advanceApplication(item.id, { expectedStage: item.stage, toStage }, signal),
        callbacks,
      ),
    reject: (item, input, callbacks) =>
      run(
        item,
        (signal) => rejectApplication(item.id, { ...input, expectedStage: item.stage }, signal),
        callbacks,
      ),
  };
}
