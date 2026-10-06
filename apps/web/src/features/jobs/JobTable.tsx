import { formatDate } from '../../components/format.ts';
import { Link } from '../../components/router.tsx';
import { jobStatusLabel } from './labels.ts';
import { jobPaths } from './paths.ts';
import type { JobListItem } from './types.ts';

// Presentational list of jobs (RF-05). Rows are painted in the order received, never re-sorted (EC-37).
// Only JSX interpolation: API text is always escaped by React (RNF-04).
export function JobTable({ items }: { items: readonly JobListItem[] }) {
  return (
    <table>
      <caption>Ofertas</caption>
      <thead>
        <tr>
          <th scope="col">Título</th>
          <th scope="col">Estado</th>
          <th scope="col">Fecha</th>
        </tr>
      </thead>
      <tbody>
        {items.map((job) => (
          <tr key={job.id}>
            <td>
              <Link to={jobPaths.detail(job.id)}>{job.title}</Link>
            </td>
            <td>{jobStatusLabel(job.status)}</td>
            <td>
              <time dateTime={job.referenceDate}>{formatDate(job.referenceDate)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
