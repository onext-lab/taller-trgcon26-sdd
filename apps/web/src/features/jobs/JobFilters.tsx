import { useRef, useState, type FormEvent } from 'react';
import { FormField } from '../../components/FormField.tsx';
import { PageSizeSelect } from '../../components/PageSizeSelect.tsx';
import { navigate } from '../../components/router.tsx';
import { jobStatusLabel } from './labels.ts';
import { listPath, listView, readListQuery, validateSearchText } from './list-query.ts';
import { JOB_STATUSES } from './types.ts';

// State of the search form. It starts from the URL and is resynchronized when the URL changes (e.g. «Atrás»),
// adjusting the state during render (as `useResource` does), not in an effect.
function useFilterForm(search: string) {
  const view = listView(readListQuery(search));
  const [previousSearch, setPreviousSearch] = useState(search);
  const [status, setStatus] = useState<string>(view.status);
  const [q, setQ] = useState(view.q);
  const [error, setError] = useState<string | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);

  if (previousSearch !== search) {
    setPreviousSearch(search);
    setStatus(view.status);
    setQ(view.q);
    setError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = validateSearchText(q);
    if (!result.ok) {
      setError(result.error);
      searchRef.current?.focus();
      return;
    }
    setError(undefined);
    setQ(result.value);
    navigate(listPath({ status, q: result.value, pageSize: view.pageSize }));
  }

  return { view, status, setStatus, q, setQ, error, searchRef, submit };
}

function changePageSize(view: ReturnType<typeof listView>, pageSize: number): void {
  navigate(listPath({ status: view.status, q: view.q, pageSize }));
}

// Filters of the list (RF-05, DD-02): Estado and text apply with «Buscar»; «Por página», outside the form,
// applies when it changes. Both stay out of the block that changes with the load, so the focus is not lost.
export function JobFilters({ search }: { search: string }) {
  const form = useFilterForm(search);

  return (
    <div className="job-filters">
      <form role="search" aria-label="Filtrar ofertas" noValidate onSubmit={form.submit}>
        <FormField id="status" label="Estado">
          {(control) => (
            <select
              {...control}
              name="status"
              value={form.status}
              onChange={(event) => form.setStatus(event.target.value)}
            >
              <option value="">Todos</option>
              {JOB_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {jobStatusLabel(value)}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField id="q" label="Buscar por título" error={form.error}>
          {(control) => (
            <input
              {...control}
              ref={form.searchRef}
              type="search"
              name="q"
              value={form.q}
              onChange={(event) => form.setQ(event.target.value)}
            />
          )}
        </FormField>
        <button type="submit">Buscar</button>
      </form>
      <PageSizeSelect
        value={form.view.pageSize}
        onChange={(size) => changePageSize(form.view, size)}
      />
    </div>
  );
}
