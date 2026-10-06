import { Link } from '../../components/router.tsx';
import { candidatePaths } from './paths.ts';
import type { CandidateListItem } from './types.ts';

// Presentational list of candidates (RF-04). Rows are painted in the order received, never re-sorted.
// Only JSX interpolation: API text is always escaped by React (RNF-04).
export function CandidateTable({ items }: { items: readonly CandidateListItem[] }) {
  return (
    <table>
      <caption>Candidatos</caption>
      <thead>
        <tr>
          <th scope="col">Nombre y apellidos</th>
          <th scope="col">Email</th>
          <th scope="col">Skills</th>
        </tr>
      </thead>
      <tbody>
        {items.map((candidate) => (
          <tr key={candidate.id}>
            <td>
              <Link to={candidatePaths.detail(candidate.id)}>{candidate.fullName}</Link>
            </td>
            <td>{candidate.email}</td>
            <td>{candidate.skills.length > 0 ? candidate.skills.join(', ') : 'Sin indicar'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
