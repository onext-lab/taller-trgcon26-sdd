import { DEFAULT_PAGE_SIZE } from '../../components/list-controls.ts';

/**
 * Applied search of the candidate list (DD-01). It lives in a module variable, never in the URL, in
 * `history.state` or in browser storage: a name or an email in the URL would leak personal data (RNF-09).
 * Going back to the list restores it; reloading the page starts empty.
 */
export interface CandidateListQuery {
  q: string;
  skill: string;
  page: number;
  pageSize: number;
}

export const INITIAL_LIST_QUERY: CandidateListQuery = {
  q: '',
  skill: '',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

let applied: CandidateListQuery = INITIAL_LIST_QUERY;

export function readListState(): CandidateListQuery {
  return applied;
}

/** Keeps a copy: later changes to `query` do not alter the saved search. */
export function saveListState(query: CandidateListQuery): void {
  applied = { ...query };
}

export function hasFilters(query: CandidateListQuery): boolean {
  return query.q !== '' || query.skill !== '';
}
