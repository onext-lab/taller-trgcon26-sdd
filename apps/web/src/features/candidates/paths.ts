import { parseRouteId } from '../../components/router.tsx';

/** Web routes of the candidates feature: only IDs travel in the URL, never personal data. */
export const candidatePaths = {
  list: '/candidates',
  create: '/candidates/new',
  detail: (id: number): string => `/candidates/${id}`,
  edit: (id: number): string => `/candidates/${id}/edit`,
} as const;

/** Returns the candidate ID written in a route segment, or `null` if it is not a valid one. */
export function parseCandidateId(text: string): number | null {
  return parseRouteId(text);
}
