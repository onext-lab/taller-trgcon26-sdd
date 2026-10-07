import type { JobsRepository } from './repository.ts';
import type { JobStatus } from './schemas.ts';

/**
 * Lector que implementa el `JobStatusPort` de `applications` sin importarlo (DD-01): `app.ts` comprueba la forma por
 * tipado estructural. `null` si la oferta no existe.
 */
export function createJobStatusReader(repo: Pick<JobsRepository, 'findStatusById'>) {
  return {
    getJobStatus(jobId: number): JobStatus | null {
      return repo.findStatusById(jobId) ?? null;
    },
  };
}
