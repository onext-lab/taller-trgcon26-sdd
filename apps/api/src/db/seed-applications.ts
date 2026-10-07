import type { ApplicationsRepository } from '../modules/applications/repository.ts';
import type { Application, RejectionReason, Stage } from '../modules/applications/schemas.ts';

/** Un paso del historial de una inscripción: la etapa a la que pasa, cuándo y, si es un rechazo, motivo y nota. */
export interface SeedStep {
  stage: Stage;
  /** Instante ISO UTC; no decreciente a lo largo de los pasos (INV-06). */
  at: string;
  reason?: RejectionReason;
  note?: string;
}

export interface SeedApplication {
  candidateId: number;
  jobId: number;
  /** Al menos uno; el primero es `received` (INV-04) y el último es la etapa actual. */
  steps: readonly SeedStep[];
}

/**
 * Escribe una inscripción con su etapa final y un `StageChange` por paso (`from_stage` = etapa anterior, `NULL` en el
 * inicial). `created_at` es la fecha del primer paso y `last_change_at` la del último (INV-06). Las usan los tests y
 * el seed de la HU; la base rechaza cualquier historial que incumpla INV-04, INV-07 o INV-10.
 */
export function insertApplicationWithHistory(
  repo: Pick<ApplicationsRepository, 'insert' | 'insertStageChange'>,
  { candidateId, jobId, steps }: SeedApplication,
): Application {
  const first = steps[0];
  const last = steps[steps.length - 1];
  if (!first || !last) throw new Error('Una inscripción necesita al menos un paso');
  const application = repo.insert({
    candidateId,
    jobId,
    stage: last.stage,
    createdAt: first.at,
    lastChangeAt: last.at,
  });
  steps.forEach((step, index) => {
    repo.insertStageChange({
      applicationId: application.id,
      fromStage: index === 0 ? null : (steps[index - 1]?.stage ?? null),
      toStage: step.stage,
      changedAt: step.at,
      reason: step.reason ?? null,
      note: step.note ?? null,
    });
  });
  return application;
}
