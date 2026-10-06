/**
 * Puerto de `jobs` hacia `inscripciones` (DD-03, DEC-06). `jobs` no importa nada de `applications`: quien lo
 * implemente (HU-05) se inyecta desde `buildApp`.
 */
export interface JobApplicationsPort {
  /** Lectura (DT-01): inscripciones de la oferta en etapa no final. Síncrona. */
  countActiveApplications(jobId: number): number;
  /**
   * Operación interna (DT-02, UC-19): se llama dentro de la transacción del cierre, después del UPDATE y solo en la
   * transición real. Devuelve cuántas rechazó. Si lanza, se deshace todo.
   */
  rejectActiveApplications(input: { jobId: number; closedAt: string }): number;
}

/** Implementación por defecto mientras no existe `applications`: no hay inscripciones y no hace nada. */
export const noJobApplications: JobApplicationsPort = {
  countActiveApplications: () => 0,
  rejectActiveApplications: () => 0,
};
