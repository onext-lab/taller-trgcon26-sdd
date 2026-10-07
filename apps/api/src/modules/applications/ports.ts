/** Estado de una oferta tal como lo necesita `applications` (forma propia: ningún módulo importa a otro, DD-01). */
export type JobStatus = 'draft' | 'published' | 'closed';

/** Lo mínimo de una oferta que necesita `applications`: su estado y su título (DD-04). */
export interface JobSummary {
  status: JobStatus;
  title: string;
}

/**
 * Puerto «estado de la oferta» (DEC-06), lo define `applications` y lo implementa `jobs`. Síncrono, dentro de la
 * transacción del iniciador. `app.ts` comprueba por tipado estructural que la implementación lo cumple.
 */
export interface JobStatusPort {
  /** `null` si la oferta no existe. */
  getJobStatus(jobId: number): JobStatus | null;
  /** Estado y título de la oferta (DT-07); `null` si la oferta no existe. */
  getJobSummary(jobId: number): JobSummary | null;
}

/** Puerto de lectura de candidatos (DEC-06), lo define `applications` y lo implementa `candidates`. Solo `id` y `full_name`. */
export interface CandidateLookupPort {
  exists(candidateId: number): boolean;
  /** Solo `id` → `full_name`; los IDs que no existen no salen en el `Map`. */
  findNames(candidateIds: readonly number[]): Map<number, string>;
}
