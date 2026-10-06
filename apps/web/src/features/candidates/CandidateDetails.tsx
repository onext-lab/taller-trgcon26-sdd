import { formatCalendarDate, formatDate } from '../../components/format.ts';
import type { Candidate } from './types.ts';

const NOT_SPECIFIED_TEXT = 'Sin indicar';
const WHILE_PROCESS_TEXT = 'Mientras dure el proceso';

// An optional that the candidate does not have (`null` or empty) shows as «Sin indicar», never as a hole.
function orNotSpecified(value: string | null): string {
  return value === null || value === '' ? NOT_SPECIFIED_TEXT : value;
}

function RetentionEnd({ date }: { date: string | null }) {
  if (date === null) return <>{WHILE_PROCESS_TEXT}</>;
  return <time dateTime={date}>{formatCalendarDate(date)}</time>;
}

// Presentational detail of a candidate (RF-05). Every value is rendered as JSX text (RNF-06): never as HTML.
// The consent lives in `ConsentSection`.
export function CandidateDetails({ candidate }: { candidate: Candidate }) {
  return (
    <>
      <h1 tabIndex={-1}>{candidate.fullName}</h1>
      <dl>
        <dt>Email</dt>
        <dd>{candidate.email}</dd>
        <dt>Teléfono</dt>
        <dd>{orNotSpecified(candidate.phone)}</dd>
        <dt>Resumen</dt>
        <dd className="pre-wrap">{orNotSpecified(candidate.summary)}</dd>
        <dt>Skills</dt>
        <dd>{orNotSpecified(candidate.skills.join(', '))}</dd>
        <dt>Fecha de alta</dt>
        <dd>
          <time dateTime={candidate.createdAt}>{formatDate(candidate.createdAt)}</time>
        </dd>
        <dt>Fin de retención</dt>
        <dd>
          <RetentionEnd date={candidate.retentionEndsAt} />
        </dd>
      </dl>
    </>
  );
}
