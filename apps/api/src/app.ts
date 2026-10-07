import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { systemClock, type Clock } from './clock.ts';
import { withTransaction } from './db/transaction.ts';
import { registerCrossSiteGuard } from './http/cross-site.ts';
import { registerErrorHandling } from './http/error-handler.ts';
import { ajvOptions } from './http/validation.ts';
import { createCandidateProcessesReader } from './modules/applications/candidate-processes.ts';
import type { JobStatusPort } from './modules/applications/ports.ts';
import { createApplicationsRepository } from './modules/applications/repository.ts';
import { applicationsRoutes } from './modules/applications/routes.ts';
import { createApplicationsService } from './modules/applications/service.ts';
import type { CandidateProcessesPort } from './modules/candidates/processes-port.ts';
import { createCandidatesRepository } from './modules/candidates/repository.ts';
import { candidatesRoutes } from './modules/candidates/routes.ts';
import { createCandidatesService } from './modules/candidates/service.ts';
import type { JobApplicationsPort } from './modules/jobs/applications-port.ts';
import { createJobStatusReader } from './modules/jobs/job-status.ts';
import { createJobsRepository } from './modules/jobs/repository.ts';
import { jobsRoutes } from './modules/jobs/routes.ts';
import { createJobsService } from './modules/jobs/service.ts';

export interface AppOptions {
  db: DatabaseSync;
  logger?: FastifyServerOptions['logger'];
  /** Reloj inyectado (DEC-09) que reciben los servicios; `systemClock` por defecto. */
  now?: Clock;
  /** Puerto de `jobs` hacia `inscripciones` (DD-03); por defecto, la implementación real de `applications` (HU-06): solo se inyecta en tests. */
  jobApplications?: JobApplicationsPort;
  /** Puerto de `candidates` hacia `inscripciones` (DD-06); por defecto, el lector real de `applications`. */
  candidateProcesses?: CandidateProcessesPort;
  /** Puerto «estado de la oferta» de `applications` (DD-08); solo para tests: por defecto, el lector real de `jobs`. */
  jobStatus?: JobStatusPort;
}

function registerHealth(app: FastifyInstance, db: DatabaseSync): void {
  app.get(
    '/api/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: { status: { type: 'string', const: 'ok' } },
            required: ['status'],
          },
        },
      },
    },
    () => {
      db.prepare('SELECT 1').get();
      return { status: 'ok' };
    },
  );
}

interface Services {
  jobs: ReturnType<typeof createJobsService>;
  candidates: ReturnType<typeof createCandidatesService>;
  applications: ReturnType<typeof createApplicationsService>;
}

type Ports = Pick<AppOptions, 'jobApplications' | 'candidateProcesses' | 'jobStatus'>;

/**
 * Único punto de composición (DD-09): sin singletons, cada módulo recibe sus dependencias. Orden (DD-06): repositorios
 * de `jobs` y `applications`, servicio de `candidates`, de `applications` y de `jobs`, que necesita el anterior.
 */
function composeServices(
  db: DatabaseSync,
  now: Clock,
  { jobApplications, candidateProcesses, jobStatus }: Ports,
): Services {
  const jobsRepository = createJobsRepository(db);
  const applicationsRepository = createApplicationsRepository(db);

  // DD-01: ningún módulo importa a otro; el lector de `applications` cumple `CandidateProcessesPort` por tipado
  // estructural y esta asignación lo comprueba al compilar.
  const processesPort: CandidateProcessesPort =
    candidateProcesses ?? createCandidateProcessesReader(applicationsRepository);
  const candidates = createCandidatesService({
    repository: createCandidatesRepository(db),
    now,
    transaction: (fn) => withTransaction(db, fn),
    processes: processesPort,
  });

  // DD-01 y DD-08: `applications` define sus puertos; `jobs` y `candidates` los cumplen por tipado estructural.
  const jobStatusPort: JobStatusPort = jobStatus ?? createJobStatusReader(jobsRepository);
  const applications = createApplicationsService({
    repository: applicationsRepository,
    now,
    transaction: (fn) => withTransaction(db, fn),
    jobStatus: jobStatusPort,
    candidates: {
      exists: (id) => candidates.exists(id),
      findNames: (ids) => candidates.findNames(ids),
    },
    recalculateRetention: (id) => {
      candidates.recalculateRetention(id);
    },
  });

  // DD-06: `jobs` recibe dos lambdas, no el servicio entero; la asignación tipada comprueba la forma (DEC-06).
  const jobApplicationsPort: JobApplicationsPort = jobApplications ?? {
    countActiveApplications: (jobId) => applications.countActiveApplications(jobId),
    rejectActiveApplications: (input) => applications.rejectActiveApplications(input),
  };
  const jobs = createJobsService({
    repository: jobsRepository,
    now,
    transaction: (fn) => withTransaction(db, fn),
    applications: jobApplicationsPort,
  });
  return { jobs, candidates, applications };
}

export function buildApp({
  db,
  logger = false,
  now = systemClock,
  ...ports
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger, ajv: ajvOptions });
  // Antes de cualquier ruta o módulo, para que todos hereden el envelope de error y la guarda entre sitios (DEC-12).
  registerErrorHandling(app);
  registerCrossSiteGuard(app);

  app.addHook('onClose', () => {
    if (db.isOpen) db.close();
  });

  registerHealth(app, db);

  const services = composeServices(db, now, ports);
  app.register(jobsRoutes, { prefix: '/api/jobs', service: services.jobs });
  app.register(candidatesRoutes, { prefix: '/api/candidates', service: services.candidates });
  app.register(applicationsRoutes, { prefix: '/api', service: services.applications });

  return app;
}
