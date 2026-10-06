import type { FastifyInstance } from 'fastify';
import type {
  CandidateProcesses,
  CandidateProcessesPort,
} from '../../src/modules/candidates/processes-port.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';

const NO_PROCESSES: CandidateProcesses = {
  hasOpenApplication: false,
  hadAnyApplication: false,
  lastProcessClosedAt: null,
};

/**
 * Doble del puerto de procesos, sin mocks de módulo: devuelve `processes` (sin inscripciones por defecto) o, con
 * `fail`, lanza un error real para probar que la operación se deshace entera (EC-53).
 */
export function createProcessesStub({
  processes = NO_PROCESSES,
  fail = false,
}: { processes?: CandidateProcesses; fail?: boolean } = {}): CandidateProcessesPort {
  return {
    getProcesses() {
      if (fail) throw new Error('fallo simulado del puerto');
      return processes;
    },
  };
}

/** Crea un candidato con `POST /api/candidates` y lo devuelve; falla si la respuesta no es 201. */
export async function createCandidate(
  app: FastifyInstance,
  body: Record<string, unknown>,
): Promise<Candidate> {
  const response = await app.inject({ method: 'POST', url: '/api/candidates', payload: body });
  if (response.statusCode !== 201) {
    throw new Error(`POST /api/candidates respondió ${response.statusCode}: ${response.body}`);
  }
  return response.json<Candidate>();
}
