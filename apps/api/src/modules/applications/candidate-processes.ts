import type { ApplicationsRepository } from './repository.ts';

/**
 * Lector que implementa el `CandidateProcessesPort` de `candidates` sin importarlo (DD-01): `app.ts` comprueba la
 * forma por tipado estructural. No abre transacción: se ejecuta dentro de la del iniciador (DEC-06).
 */
export function createCandidateProcessesReader(
  repo: Pick<ApplicationsRepository, 'getProcessFacts'>,
) {
  return {
    getProcesses(candidateId: number): {
      hasOpenApplication: boolean;
      hadAnyApplication: boolean;
      lastProcessClosedAt: string | null;
    } {
      const { total, open, lastClosedAt } = repo.getProcessFacts(candidateId);
      return {
        hasOpenApplication: open > 0,
        hadAnyApplication: total > 0,
        // Con una inscripción abierta no hay cierre que contar; sin abiertas y con alguna, `lastClosedAt` no es nulo.
        lastProcessClosedAt: open > 0 ? null : lastClosedAt,
      };
    },
  };
}
