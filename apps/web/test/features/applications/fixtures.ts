import { render } from '@testing-library/react';
import { createElement } from 'react';
import { PipelineScreen } from '../../../src/features/applications/PipelineScreen.tsx';
import type { Pipeline, PipelineItem } from '../../../src/features/applications/types.ts';
import type { CandidatePage } from '../../../src/features/candidates/types.ts';
import { mockFetch, type FetchMock, type MockRoute } from '../../helpers/fetch.ts';

/** Invented data only: no real people; emails always `@example.com`. */

export const JOB_ID = 7;

function item(
  id: number,
  candidateName: string,
  stage: PipelineItem['stage'],
  lastChangeAt: string,
  rejectionReason: PipelineItem['rejectionReason'] = null,
): PipelineItem {
  return { id, candidateName, stage, lastChangeAt, rejectionReason };
}

/** Published job with cards in the six stages (the API order: `lastChangeAt` DESC, `id` DESC). */
export const PUBLISHED_PIPELINE: Pipeline = {
  job: {
    id: JOB_ID,
    status: 'published',
    enrollmentDeadline: null,
    enrollmentDeadlinePassed: false,
  },
  items: [
    item(31, 'Marina Ortega Vidal', 'received', '2026-10-06T10:00:00.000Z'),
    item(30, 'Iván Soler Prats', 'received', '2026-10-05T09:00:00.000Z'),
    item(29, 'Nuria Casas Ferrer', 'screening', '2026-10-05T08:00:00.000Z'),
    item(28, 'Oriol Mas Puig', 'interview', '2026-10-04T08:00:00.000Z'),
    item(27, 'Berta Lluch Roca', 'offer', '2026-10-03T08:00:00.000Z'),
    item(26, 'Hugo Serra Camps', 'hired', '2026-10-02T08:00:00.000Z'),
    item(25, 'Lola Pons Arnau', 'rejected', '2026-10-01T08:00:00.000Z', 'not_a_fit'),
    item(24, 'Jordi Vila Sala', 'rejected', '2026-09-30T08:00:00.000Z', 'candidate_withdrew'),
    item(23, 'Carla Bosch Ruiz', 'rejected', '2026-09-29T08:00:00.000Z', 'other'),
    item(22, 'Pau Garcia Mir', 'rejected', '2026-09-28T08:00:00.000Z', 'job_closed'),
  ],
};

export const EMPTY_PUBLISHED_PIPELINE: Pipeline = {
  job: {
    id: JOB_ID,
    status: 'published',
    enrollmentDeadline: null,
    enrollmentDeadlinePassed: false,
  },
  items: [],
};

export const DRAFT_PIPELINE: Pipeline = {
  job: { id: JOB_ID, status: 'draft', enrollmentDeadline: null, enrollmentDeadlinePassed: false },
  items: [],
};

export const CLOSED_PIPELINE: Pipeline = {
  job: { id: JOB_ID, status: 'closed', enrollmentDeadline: null, enrollmentDeadlinePassed: false },
  items: [
    item(12, 'Elena Mora Lara', 'hired', '2026-09-20T08:00:00.000Z'),
    item(11, 'Sergi Roig Font', 'rejected', '2026-09-20T07:00:00.000Z', 'job_closed'),
  ],
};

/** Published job whose deadline (`2026-10-10`) has passed according to the API clock, with cards (CA-12). */
export const EXPIRED_PIPELINE: Pipeline = {
  ...PUBLISHED_PIPELINE,
  job: {
    id: JOB_ID,
    status: 'published',
    enrollmentDeadline: '2026-10-10',
    enrollmentDeadlinePassed: true,
  },
};

/** Same, without enrollments. */
export const EXPIRED_EMPTY_PIPELINE: Pipeline = { ...EXPIRED_PIPELINE, items: [] };

function candidatePage(count: number, total: number): CandidatePage {
  return {
    items: Array.from({ length: count }, (_value, index) => ({
      id: index + 1,
      fullName: `Candidata Inventada ${index + 1}`,
      email: `candidata${index + 1}@example.com`,
      skills: ['typescript'],
    })),
    total,
    page: 1,
    pageSize: 10,
  };
}

export const EMPTY_CANDIDATE_PAGE: CandidatePage = candidatePage(0, 0);
/** Exactly the limit: no «more results» note. */
export const TEN_CANDIDATES_PAGE: CandidatePage = candidatePage(10, 10);
/** `total > 10`: ten rows and the «more results» note. */
export const ELEVEN_CANDIDATES_PAGE: CandidatePage = candidatePage(10, 11);

/** Stand-in for the `NotFoundScreen` of `App.tsx`, which reaches the screen by prop (DD-09). */
export const NOT_FOUND_HEADING = 'Página no encontrada';

/** Starts at `path`, simulates the network with `routes` and renders the pipeline screen. */
export function renderPipeline(path: string, routes: Record<string, MockRoute>): FetchMock {
  window.history.replaceState(null, '', path);
  const mock = mockFetch(routes);
  render(
    createElement(PipelineScreen, {
      jobPath: (id: number) => `/jobs/${id}`,
      notFound: createElement('h1', null, NOT_FOUND_HEADING),
    }),
  );
  return mock;
}
