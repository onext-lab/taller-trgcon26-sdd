import type { Ref } from 'react';
import { formatDate } from '../../components/format.ts';
import { formatSalaryBand, jobStatusLabel, NOT_SPECIFIED_TEXT, workModeLabel } from './labels.ts';
import type { Job } from './types.ts';

export const CLOSED_READ_ONLY_TEXT =
  'Esta oferta está cerrada y no se puede modificar. Para volver a publicarla, duplícala.';

// A date that the job does not have (`null`) is not painted at all, not even as «Sin indicar» (EC-42).
function DateEntry({ label, iso }: { label: string; iso: string | null }) {
  if (iso === null) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <time dateTime={iso}>{formatDate(iso)}</time>
      </dd>
    </>
  );
}

type Props = {
  job: Job;
  /** The container moves the focus here after an action (DD-07). */
  headingRef?: Ref<HTMLHeadingElement>;
};

// Presentational detail of a job (RF-06). Every value is rendered as JSX text (RNF-04): never as HTML.
// The actions of each status live in `JobActions`.
export function JobDetails({ job, headingRef }: Props) {
  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        {job.title}
      </h1>
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
        <DateEntry label="Fecha de creación" iso={job.createdAt} />
        <DateEntry label="Fecha de publicación" iso={job.publishedAt} />
        <DateEntry label="Fecha de cierre" iso={job.closedAt} />
      </dl>
      {job.status === 'closed' ? <p>{CLOSED_READ_ONLY_TEXT}</p> : null}
    </>
  );
}
