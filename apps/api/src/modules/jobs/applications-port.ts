/**
 * Puerto de `jobs` hacia `inscripciones` (DD-03, DEC-06). `jobs` no importa nada de `applications`: lo implementa
 * `applications` (HU-06) y se conecta en `buildApp`.
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

/** Doble neutro para tests de `jobs` (DD-07): no hay inscripciones y no hace nada. `buildApp` ya no lo usa. */
export const noJobApplications: JobApplicationsPort = {
  countActiveApplications: () => 0,
  rejectActiveApplications: () => 0,
};
