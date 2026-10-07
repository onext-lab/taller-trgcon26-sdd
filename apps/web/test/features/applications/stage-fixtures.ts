import type {
  Application,
  ApplicationDetail,
  HistoryEntry,
  RejectionReason,
  Stage,
} from '../../../src/features/applications/types.ts';

/** Invented data only, for the stage-change tests: no real people; emails always `@example.com`. */

export const APPLICATION_ID = 28;

const CANDIDATE = { id: 12, fullName: 'Oriol Mas Puig' };
const JOB = { id: 7, title: 'Desarrolladora de frontend', status: 'published' } as const;

export const MULTILINE_NOTE = 'Prefiere jornada parcial.\nPuede incorporarse en noviembre.';

function entry(
  fromStage: Stage | null,
  toStage: Stage,
  changedAt: string,
  rejection?: { reason: RejectionReason; note: string | null },
): HistoryEntry {
  return {
    fromStage,
    toStage,
    changedAt,
    reason: rejection?.reason ?? null,
    note: rejection?.note ?? null,
  };
}

function detail(stage: Stage, history: HistoryEntry[]): ApplicationDetail {
  const last = history[history.length - 1];
  return {
    id: APPLICATION_ID,
    stage,
    createdAt: '2026-10-01T08:00:00.000Z',
    lastChangeAt: last?.changedAt ?? '2026-10-01T08:00:00.000Z',
    candidate: CANDIDATE,
    job: JOB,
    history,
  };
}

/** One change: the enrollment (`received`). */
export const DETAIL_ONE_CHANGE: ApplicationDetail = detail('received', [
  entry(null, 'received', '2026-10-01T08:00:00.000Z'),
]);

/** Three changes: received → screening → interview. */
export const DETAIL_THREE_CHANGES: ApplicationDetail = detail('interview', [
  entry(null, 'received', '2026-10-01T08:00:00.000Z'),
  entry('received', 'screening', '2026-10-02T09:30:00.000Z'),
  entry('screening', 'interview', '2026-10-04T10:15:00.000Z'),
]);

/** Five changes: the whole way up to `hired`. */
export const DETAIL_FIVE_CHANGES: ApplicationDetail = detail('hired', [
  entry(null, 'received', '2026-10-01T08:00:00.000Z'),
  entry('received', 'screening', '2026-10-02T09:30:00.000Z'),
  entry('screening', 'interview', '2026-10-04T10:15:00.000Z'),
  entry('interview', 'offer', '2026-10-05T11:00:00.000Z'),
  entry('offer', 'hired', '2026-10-06T12:45:00.000Z'),
]);

/** Rejected by hand, with a multiline note. */
export const DETAIL_REJECTED_WITH_NOTE: ApplicationDetail = detail('rejected', [
  entry(null, 'received', '2026-10-01T08:00:00.000Z'),
  entry('received', 'screening', '2026-10-02T09:30:00.000Z'),
  entry('screening', 'rejected', '2026-10-03T16:20:00.000Z', {
    reason: 'candidate_withdrew',
    note: MULTILINE_NOTE,
  }),
]);

/** Rejected by closing the job: reason `job_closed` and no note. */
export const DETAIL_REJECTED_JOB_CLOSED: ApplicationDetail = detail('rejected', [
  entry(null, 'received', '2026-10-01T08:00:00.000Z'),
  entry('received', 'rejected', '2026-10-03T16:20:00.000Z', {
    reason: 'job_closed',
    note: null,
  }),
]);

/** 200 of `advance` (and of its retry): the `Application` of six fields with the new stage. */
export function advanced(toStage: Stage, id: number = APPLICATION_ID): Application {
  return {
    id,
    jobId: JOB.id,
    candidateId: CANDIDATE.id,
    stage: toStage,
    createdAt: '2026-10-01T08:00:00.000Z',
    lastChangeAt: '2026-10-07T09:00:00.000Z',
  };
}

/** 200 of `reject`: the `Application` in `rejected` (the note never comes back). */
export function rejected(id: number = APPLICATION_ID): Application {
  return advanced('rejected', id);
}
