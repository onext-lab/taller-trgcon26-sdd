import type { ApplicationsRepository } from './repository.ts';

/** Lo que necesitan los casos de uso de cierre de oferta (HU-06): un subconjunto del repositorio y la retención. */
export interface JobClosingDeps {
  repository: Pick<
    ApplicationsRepository,
    'countActiveByJob' | 'listActiveByJob' | 'updateStage' | 'insertStageChange'
  >;
  /** Operación interna de `candidates` que recalcula `retention_ends_at` (se une a la transacción en curso). */
  recalculateRetention: (candidateId: number) => void;
}

/** Inscripciones de la oferta en etapa no final (RF-02): una sola consulta de agregado, sin traer filas. */
export function countActiveApplications(deps: JobClosingDeps, jobId: number): number {
  return deps.repository.countActiveByJob(jobId);
}

/**
 * Rechaza por cierre cada inscripción activa de la oferta, en orden de `id` (DD-02, DD-03): `UPDATE` con la guarda de
 * la etapa leída, `StageChange` con motivo `job_closed` y recálculo de la retención del candidato. Devuelve cuántas
 * rechazó (0 sin escribir nada). Un `UPDATE` sin fila es una incoherencia: error fijo y `ROLLBACK` (DD-05), sin datos
 * personales. El llamador pone la transacción.
 */
export function rejectActiveApplications(
  deps: JobClosingDeps,
  { jobId, closedAt }: { jobId: number; closedAt: string },
): number {
  const active = deps.repository.listActiveByJob(jobId);
  for (const { id, candidateId, stage } of active) {
    const updated = deps.repository.updateStage({
      id,
      fromStage: stage,
      toStage: 'rejected',
      changedAt: closedAt,
    });
    if (updated === undefined) {
      throw new Error('Inscripción activa sin actualizar al cerrar la oferta');
    }
    deps.repository.insertStageChange({
      applicationId: id,
      fromStage: stage,
      toStage: 'rejected',
      changedAt: closedAt,
      reason: 'job_closed',
      note: null,
    });
    deps.recalculateRetention(candidateId);
  }
  return active.length;
}
