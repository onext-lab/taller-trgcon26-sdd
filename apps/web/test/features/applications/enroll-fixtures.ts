import type { Pipeline, PipelineItem } from '../../../src/features/applications/types.ts';
import type { CandidatePage } from '../../../src/features/candidates/types.ts';
import type { MockReply } from '../../helpers/fetch.ts';
import { PUBLISHED_PIPELINE } from './fixtures.ts';

/** Invented data only: emails always `@example.com`. */

export const PAGE: CandidatePage = {
  items: [11, 12].map((id) => ({
    id,
    fullName: `Candidata Inventada ${id}`,
    email: `candidata${id}@example.com`,
    skills: [],
  })),
  total: 2,
  page: 1,
  pageSize: 10,
};
export const CREATED = {
  id: 32,
  jobId: 7,
  candidateId: 12,
  stage: 'received',
  createdAt: '2026-10-07T09:00:00.000Z',
  lastChangeAt: '2026-10-07T09:00:00.000Z',
};
export const NEW_CARD: PipelineItem = {
  id: 32,
  candidateName: 'Candidata Inventada 12',
  stage: 'received',
  lastChangeAt: '2026-10-07T09:00:00.000Z',
  rejectionReason: null,
};
export const WITH_NEW_CARD: Pipeline = {
  job: PUBLISHED_PIPELINE.job,
  items: [NEW_CARD, ...PUBLISHED_PIPELINE.items],
};

export type Reply = MockReply | (() => MockReply);

export function envelope(status: number, code: string, message: string): MockReply {
  return { status, json: { error: { code, message } } };
}

export function ok(json: unknown): MockReply {
  return { status: 200, json };
}

export const CREATED_REPLY: MockReply = { status: 201, json: CREATED };

/** Replies in order and repeats the last one: the first `GET` is the load, the next ones are reloads. */
export function sequence(...replies: Reply[]) {
  let next = 0;
  return (): MockReply => {
    const reply = replies[Math.min(next++, replies.length - 1)] as Reply;
    return typeof reply === 'function' ? reply() : reply;
  };
}
