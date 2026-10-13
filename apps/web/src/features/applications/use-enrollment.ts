import { useRef, useState } from 'react';
import { ApiError, userMessage } from '../../components/http.ts';
import { useLifetimeSignal } from '../../components/use-lifetime-signal.ts';
import { enrollCandidate } from './api.ts';
import { classifyEnrollError } from './enroll-errors.ts';

/** Where each outcome of `POST /api/applications` goes (DD-05): the screen decides what each one paints. */
export interface EnrollCallbacks {
  onEnrolled: () => void;
  /** 409 `DUPLICATE`; `existingId` is the application that already exists, if the API sent a valid one. */
  onDuplicate: (existingId: number | undefined) => void;
  /** 409 `INVALID_TRANSITION`: the job is no longer published. */
  onNotPublished: () => void;
  /** 409 `ENROLLMENT_DEADLINE_PASSED`: the `message` of the API, which carries the date it used (DD-05). */
  onDeadlinePassed: (message: string) => void;
  /** 404 `NOT_FOUND`: the `message` of the API (it carries no personal data). */
  onNotFound: (message: string) => void;
  /** Network, timeout, 400, 403, 413, 415, 500 or an invalid answer: `userMessage(error)`. */
  onFailed: (message: string) => void;
}

// The first detail that carries an `existingId` (`http.ts` keeps it only if it is a valid ID).
function existingIdOf(error: unknown): number | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return error.details?.find((detail) => detail.existingId !== undefined)?.existingId;
}

function failureOutcome(error: unknown, callbacks: EnrollCallbacks): () => void {
  switch (classifyEnrollError(error)) {
    case 'duplicate':
      return () => callbacks.onDuplicate(existingIdOf(error));
    case 'not-published':
      return callbacks.onNotPublished;
    case 'deadline-passed':
      return () => callbacks.onDeadlinePassed(userMessage(error));
    case 'not-found':
      return () => callbacks.onNotFound(userMessage(error));
    default:
      return () => callbacks.onFailed(userMessage(error));
  }
}

export interface Enrollment {
  /** Candidate being enrolled, or `null`. */
  pendingId: number | null;
  /** Sends one `POST`; while one is in flight, any other call does nothing (EC-46). */
  enroll: (candidateId: number, callbacks: EnrollCallbacks) => Promise<void>;
}

/**
 * Enrolls a candidate in the job (RF-08). The ref guard keeps a second click, made before the re-render
 * disables the buttons, from sending another request (DD-06); leaving the screen cancels the request and
 * drops its outcome.
 */
export function useEnrollment(jobId: number): Enrollment {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const inFlight = useRef(false);
  const lifetimeSignal = useLifetimeSignal();

  async function enroll(candidateId: number, callbacks: EnrollCallbacks): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    const signal = lifetimeSignal();
    setPendingId(candidateId);
    let outcome: () => void;
    try {
      await enrollCandidate({ jobId, candidateId }, signal);
      outcome = callbacks.onEnrolled;
    } catch (error) {
      outcome = failureOutcome(error, callbacks);
    }
    inFlight.current = false;
    setPendingId(null);
    if (signal?.aborted !== true) outcome();
  }

  return { pendingId, enroll };
}
