import { useRef, useState, type FormEvent } from 'react';
import { FormField } from '../../components/FormField.tsx';
import {
  validateFilterText,
  validateSearchText,
  type FilterTextResult,
} from '../../components/list-controls.ts';
import { PageSizeSelect } from '../../components/PageSizeSelect.tsx';
import type { CandidateListQuery } from './list-state.ts';

const SKILL_RULES = {
  maxLength: 40,
  tooLong: 'La skill no puede pasar de 40 caracteres.',
  control: 'La skill no puede tener caracteres de control.',
};

export interface CandidateFiltersProps {
  /** The applied search: the starting point of the drafts and the value of «Por página». */
  query: CandidateListQuery;
  /** Applies a validated search (trimmed texts). */
  onSearch: (search: { q: string; skill: string }) => void;
  onPageSize: (pageSize: number) => void;
}

// State of the search form. The drafts start from the applied search (restored without URL, DD-01); a failed
// validation shows the error next to its field, focuses the first one and requests nothing.
function useFilterForm({ query, onSearch }: CandidateFiltersProps) {
  const [q, setQ] = useState(query.q);
  const [skill, setSkill] = useState(query.skill);
  const [qError, setQError] = useState<string | undefined>(undefined);
  const [skillError, setSkillError] = useState<string | undefined>(undefined);
  const qRef = useRef<HTMLInputElement>(null);
  const skillRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const qResult: FilterTextResult = validateSearchText(q);
    const skillResult = validateFilterText(skill, SKILL_RULES);
    setQError(qResult.ok ? undefined : qResult.error);
    setSkillError(skillResult.ok ? undefined : skillResult.error);
    if (!qResult.ok || !skillResult.ok) {
      (qResult.ok ? skillRef : qRef).current?.focus();
      return;
    }
    setQ(qResult.value);
    setSkill(skillResult.value);
    onSearch({ q: qResult.value, skill: skillResult.value });
  }

  return { q, setQ, skill, setSkill, qError, skillError, qRef, skillRef, submit };
}

// Search of the candidate list (RF-04): the two texts apply together with «Buscar»; «Por página», outside the
// form, applies when it changes. Both stay out of the block that changes with the load, so the focus is not lost.
export function CandidateFilters(props: CandidateFiltersProps) {
  const form = useFilterForm(props);

  return (
    <div className="job-filters">
      <form role="search" aria-label="Buscar candidatos" noValidate onSubmit={form.submit}>
        <FormField id="q" label="Buscar por nombre o email" error={form.qError}>
          {(control) => (
            <input
              {...control}
              ref={form.qRef}
              type="search"
              name="q"
              autoComplete="off"
              value={form.q}
              onChange={(event) => form.setQ(event.target.value)}
            />
          )}
        </FormField>
        <FormField id="skill" label="Skill" error={form.skillError}>
          {(control) => (
            <input
              {...control}
              ref={form.skillRef}
              type="search"
              name="skill"
              autoComplete="off"
              value={form.skill}
              onChange={(event) => form.setSkill(event.target.value)}
            />
          )}
        </FormField>
        <button type="submit">Buscar</button>
      </form>
      <PageSizeSelect value={props.query.pageSize} onChange={props.onPageSize} />
    </div>
  );
}
