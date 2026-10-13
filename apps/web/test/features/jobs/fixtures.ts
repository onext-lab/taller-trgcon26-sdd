import type { Job } from '../../../src/features/jobs/types.ts';

/** A draft job with every field filled in, except the optional date ones (DD-09). Invented data only. */
export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 7,
    title: 'Técnica/o de selección',
    description: 'Gestión de procesos de selección.',
    location: 'Valencia',
    workMode: 'híbrida',
    salaryMin: 30000,
    salaryMax: 36000,
    status: 'draft',
    createdAt: '2026-09-30T09:00:00.000Z',
    publishedAt: null,
    closedAt: null,
    enrollmentDeadline: null,
    ...overrides,
  };
}
