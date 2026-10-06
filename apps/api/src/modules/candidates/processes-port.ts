/** Lo que `candidates` necesita saber de los procesos de un candidato (DD-06): una sola lectura, tres respuestas. */
export interface CandidateProcesses {
  /** ¿Alguna inscripción en etapa no final? */
  hasOpenApplication: boolean;
  /** ¿Tuvo alguna inscripción alguna vez? */
  hadAnyApplication: boolean;
  /**
   * Instante ISO UTC del cierre del último proceso. Contrato: no nulo si `hadAnyApplication` y no
   * `hasOpenApplication`; quien lo incumple hace fallar el cálculo de la retención.
   */
  lastProcessClosedAt: string | null;
}

/**
 * Puerto de `candidates` hacia `inscripciones` (DEC-06). `candidates` no importa nada de `applications`: quien lo
 * implemente (HU-04) se inyecta desde `buildApp`. Síncrono, dentro de la transacción del iniciador.
 */
export interface CandidateProcessesPort {
  getProcesses(candidateId: number): CandidateProcesses;
}

/** Implementación por defecto mientras no existe `applications`: nadie tiene ni tuvo inscripciones. */
export const noCandidateProcesses: CandidateProcessesPort = {
  getProcesses: () => ({
    hasOpenApplication: false,
    hadAnyApplication: false,
    lastProcessClosedAt: null,
  }),
};
