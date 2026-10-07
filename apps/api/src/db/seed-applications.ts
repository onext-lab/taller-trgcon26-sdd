import type { DatabaseSync } from 'node:sqlite';
import { createCandidateProcessesReader } from '../modules/applications/candidate-processes.ts';
import {
  createApplicationsRepository,
  type ApplicationsRepository,
} from '../modules/applications/repository.ts';
import type { Application, RejectionReason, Stage } from '../modules/applications/schemas.ts';
import { createCandidatesRepository } from '../modules/candidates/repository.ts';
import { createCandidatesService } from '../modules/candidates/service.ts';
import { withTransaction } from './transaction.ts';

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

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Notas de rechazo del seed: inventadas, breves y sin datos sensibles (RGPD §6.3). */
export const SEED_NOTES: readonly string[] = [
  'Busca jornada parcial y la oferta es a jornada completa.',
  'Ha aceptado otra oferta antes de la entrevista final.',
];

const R = 'received';
const S = 'screening';
const I = 'interview';
const O = 'offer';
const H = 'hired';
const X = 'rejected';

/** Una inscripción prevista: posición del candidato en `SEED_CANDIDATES`, etapas recorridas, y motivo y nota si acaba en `rejected`. */
type Plan = readonly [
  candidate: number,
  path: readonly Stage[],
  reason?: RejectionReason,
  note?: number,
];

/**
 * Ofertas publicadas con inscripciones (posición en `SEED_JOBS`; la 5 se queda vacía). Candidatos 1-20: los 1-10 están
 * en dos ofertas y los 11-20 en una; los 11-20 incluyen una contratación y tres rechazos (EC-51).
 */
const PUBLISHED_PLANS: readonly (readonly [position: number, plans: readonly Plan[]])[] = [
  [
    4,
    [
      [1, [R]],
      [2, [R]],
      [3, [R]],
      [4, [R, S]],
      [5, [R, S]],
      [6, [R, S, I]],
      [7, [R, S, I]],
      [8, [R, S, I, O]],
      [9, [R, S, I, O, H]],
      [10, [R, S, X], 'not_a_fit', 0],
    ],
  ],
  [
    6,
    [
      [1, [R, S]],
      [2, [R]],
      [3, [R, S, I]],
      [4, [R, S, I, O]],
      [5, [R, X], 'candidate_withdrew'],
      [11, [R]],
      [12, [R, S]],
      [13, [R, S, I, O, H]],
      [14, [R, S, I, X], 'other', 1],
      [15, [R, S, X], 'not_a_fit'],
    ],
  ],
  [
    7,
    [
      [6, [R]],
      [7, [R, S]],
      [8, [R, S, I]],
      [9, [R, S, I, O]],
      [10, [R, S, I, X], 'other'],
      [16, [R]],
      [17, [R, S]],
      [18, [R, S, I]],
      [19, [R, S, I, O]],
      [20, [R, S, X], 'candidate_withdrew'],
    ],
  ],
];

/** Ofertas cerradas (candidatos 25-29 en las dos). Sus fechas son las de `SEED_JOBS` (DD-10). */
const CLOSED_PLANS: readonly (readonly [
  position: number,
  publishedAt: string,
  closedAt: string,
  plans: readonly Plan[],
])[] = [
  [
    8,
    '2026-08-27T08:00:00.000Z',
    '2026-09-26T15:30:00.000Z',
    [
      [25, [R, S, I, O, H]],
      [26, [R, S, X], 'not_a_fit'],
      [27, [R, S, X], 'job_closed'],
      [28, [R, X], 'job_closed'],
      [29, [R, S, I, X], 'job_closed'],
    ],
  ],
  [
    9,
    '2026-08-20T09:00:00.000Z',
    '2026-09-15T16:00:00.000Z',
    [
      [29, [R, S, I, O, H]],
      [28, [R, S, I, X], 'other'],
      [25, [R, X], 'job_closed'],
      [26, [R, S, X], 'job_closed'],
      [27, [R, S, I, O, X], 'job_closed'],
    ],
  ],
];

function idAt(ids: readonly number[], position: number): number {
  const id = ids[position];
  if (id === undefined) throw new Error(`El seed no tiene un ID en la posición ${position}`);
  return id;
}

/** Pasos de una ruta con la fecha que da `atOf(paso)`; motivo y nota solo en el rechazo final. */
function buildSteps(
  [, path, reason, note]: Plan,
  atOf: (step: number, last: boolean) => Date,
): SeedStep[] {
  return path.map((stage, step) => {
    const at = atOf(step, step === path.length - 1).toISOString();
    if (stage !== 'rejected') return { stage, at };
    const text = note === undefined ? undefined : SEED_NOTES[note];
    return { stage, at, ...(reason ? { reason } : {}), ...(text ? { note: text } : {}) };
  });
}

/** Publicadas: relativas al reset, todas las fechas en (now - 90 h, now - 1 h] y crecientes (DD-10). */
function publishedSteps(plan: Plan, k: number, now: Date): SeedStep[] {
  const lastAgoMin = (1 + ((k * 7) % 24)) * 60 + ((k * 13) % 60);
  const gapMin = (5 + (k % 4) * 3) * 60;
  const length = plan[1].length;
  return buildSteps(plan, (step) => {
    const agoMin = lastAgoMin + (length - 1 - step) * gapMin;
    return new Date(now.getTime() - agoMin * 60_000);
  });
}

/** Cerradas: entre la publicación y el cierre; un `job_closed` va justo en `closedAt` (INV-07). */
function closedSteps(plan: Plan, row: number, publishedAt: string, closedAt: string): SeedStep[] {
  return buildSteps(plan, (step, last) => {
    if (last && plan[2] === 'job_closed') return new Date(closedAt);
    return new Date(Date.parse(publishedAt) + (2 + 4 * step) * DAY_MS + row * HOUR_MS);
  });
}

/**
 * Escribe las 40 inscripciones del seed con su historial paso a paso (RF-11, DD-10) y recalcula la retención de cada
 * candidato inscrito con el puerto real. `jobIds` y `candidateIds` van en el orden de `SEED_JOBS` y `SEED_CANDIDATES`.
 * Se llama dentro de la transacción de `seed`.
 */
export function seedApplications(
  db: DatabaseSync,
  now: Date,
  jobIds: readonly number[],
  candidateIds: readonly number[],
): void {
  const repository = createApplicationsRepository(db);
  const enrolled = new Set<number>();
  const write = (plan: Plan, position: number, steps: SeedStep[]): void => {
    const candidateId = idAt(candidateIds, plan[0]);
    insertApplicationWithHistory(repository, { candidateId, jobId: idAt(jobIds, position), steps });
    enrolled.add(candidateId);
  };

  let k = 0;
  for (const [position, plans] of PUBLISHED_PLANS) {
    for (const plan of plans) write(plan, position, publishedSteps(plan, k++, now));
  }
  for (const [position, publishedAt, closedAt, plans] of CLOSED_PLANS) {
    plans.forEach((plan, row) =>
      write(plan, position, closedSteps(plan, row, publishedAt, closedAt)),
    );
  }

  // Un solo escritor de la retención (DD-05): el servicio, con el lector real de `applications` (DD-10).
  const candidates = createCandidatesService({
    repository: createCandidatesRepository(db),
    now: () => now,
    transaction: (fn) => withTransaction(db, fn),
    processes: createCandidateProcessesReader(repository),
  });
  for (const candidateId of enrolled) candidates.recalculateRetention(candidateId);
}
