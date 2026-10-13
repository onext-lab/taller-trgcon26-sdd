import type { JobsRepository } from './repository.ts';
import type { JobStatus } from './schemas.ts';

/**
 * Lector que implementa el `JobStatusPort` de `applications` sin importarlo (DD-01): `app.ts` comprueba la forma por
 * tipado estructural. `null` si la oferta no existe.
 */
export function createJobStatusReader(
  repo: Pick<
    JobsRepository,
    'findStatusById' | 'findSummaryById' | 'findEnrollmentDeadlineById'
  >,
) {
  return {
    getJobStatus(jobId: number): JobStatus | null {
      return repo.findStatusById(jobId) ?? null;
    },
    getJobSummary(jobId: number): { status: JobStatus; title: string } | null {
      return repo.findSummaryById(jobId) ?? null;
    },
    /** 'AAAA-MM-DD' o `null` (sin plazo u oferta inexistente). */
    getEnrollmentDeadline(jobId: number): string | null {
      return repo.findEnrollmentDeadlineById(jobId) ?? null;
    },
  };
}
