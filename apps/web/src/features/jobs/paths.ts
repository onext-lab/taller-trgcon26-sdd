import { parseRouteId } from '../../components/router.tsx';

/** Web routes of the jobs feature. */
export const jobPaths = {
  list: '/jobs',
  create: '/jobs/new',
  detail: (id: number): string => `/jobs/${id}`,
  edit: (id: number): string => `/jobs/${id}/edit`,
} as const;

/** Returns the job ID written in a route segment, or `null` if it is not a valid one (same rule as the API). */
export function parseJobId(text: string): number | null {
  return parseRouteId(text);
}
