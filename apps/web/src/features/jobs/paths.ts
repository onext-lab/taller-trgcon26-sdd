/** Web routes of the jobs feature. */
export const jobPaths = {
  list: '/jobs',
  create: '/jobs/new',
  detail: (id: number): string => `/jobs/${id}`,
  edit: (id: number): string => `/jobs/${id}/edit`,
} as const;

/** Same rule as the API (`apps/api/src/http/validation.ts`): no leading zeros, at most 15 digits. */
const JOB_ID_PATTERN = /^[1-9][0-9]{0,14}$/;

/** Returns the job ID written in a route segment, or `null` if it is not a valid one. */
export function parseJobId(text: string): number | null {
  return JOB_ID_PATTERN.test(text) ? Number(text) : null;
}
