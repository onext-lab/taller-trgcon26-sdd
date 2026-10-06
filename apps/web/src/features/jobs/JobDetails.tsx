import { formatDate } from '../../components/format.ts';
import { Link } from '../../components/router.tsx';
import { DeleteJobAction } from './DeleteJobAction.tsx';
import { formatSalaryBand, jobStatusLabel, NOT_SPECIFIED_TEXT, workModeLabel } from './labels.ts';
import { jobPaths } from './paths.ts';
import type { Job } from './types.ts';

// Actions depend on the status so that later stories only add theirs here.
function JobActions({ job }: { job: Job }) {
  if (job.status !== 'draft') return null;
  return (
    <div className="actions">
      <Link to={jobPaths.edit(job.id)}>Editar</Link>
      <DeleteJobAction id={job.id} title={job.title} />
    </div>
  );
}

// Presentational detail of a job (RF-06). Every value is rendered as JSX text (RNF-04): never as HTML.
export function JobDetails({ job }: { job: Job }) {
  return (
    <>
      <h1>{job.title}</h1>
      <dl>
        <dt>Estado</dt>
        <dd>{jobStatusLabel(job.status)}</dd>
        <dt>Descripción</dt>
        <dd className="pre-wrap">{job.description ?? NOT_SPECIFIED_TEXT}</dd>
        <dt>Ubicación</dt>
        <dd>{job.location ?? NOT_SPECIFIED_TEXT}</dd>
        <dt>Modalidad</dt>
        <dd>{workModeLabel(job.workMode)}</dd>
        <dt>Banda salarial</dt>
        <dd>{formatSalaryBand(job.salaryMin, job.salaryMax)}</dd>
        <dt>Fecha de creación</dt>
        <dd>
          <time dateTime={job.createdAt}>{formatDate(job.createdAt)}</time>
        </dd>
      </dl>
      <JobActions job={job} />
    </>
  );
}
