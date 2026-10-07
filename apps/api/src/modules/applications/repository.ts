import type { DatabaseSync } from 'node:sqlite';
import type { Application, RejectionReason, Stage, StageChangeEntry } from './schemas.ts';

/** Fila de `applications` tal como la devuelve SQLite (los CHECK de la migración 003 garantizan los dominios). */
interface ApplicationRow {
  id: number;
  job_id: number;
  candidate_id: number;
  stage: Stage;
  created_at: string;
  last_change_at: string;
}

function toApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    jobId: row.job_id,
    candidateId: row.candidate_id,
    stage: row.stage,
    createdAt: row.created_at,
    lastChangeAt: row.last_change_at,
  };
}

/** Fila del pipeline: lo mínimo de una inscripción más el motivo de su rechazo (sin datos del candidato). */
export interface PipelineRow {
  id: number;
  candidateId: number;
  stage: Stage;
  lastChangeAt: string;
  rejectionReason: RejectionReason | null;
}

function toPipelineRow(row: Record<string, unknown>): PipelineRow {
  return {
    id: Number(row.id),
    candidateId: Number(row.candidate_id),
    stage: row.stage as Stage,
    lastChangeAt: String(row.last_change_at),
    rejectionReason: (row.rejection_reason as RejectionReason | null) ?? null,
  };
}

/** Datos de una inscripción nueva: la primera escritura de la fila (`last_change_at` ≥ `created_at`). */
export interface ApplicationInsert {
  candidateId: number;
  jobId: number;
  stage: Stage;
  createdAt: string;
  lastChangeAt: string;
}

/** Un paso del historial; `fromStage` es `null` solo en el inicial (INV-04). */
export interface StageChangeInsert {
  applicationId: number;
  fromStage: Stage | null;
  toStage: Stage;
  changedAt: string;
  reason: RejectionReason | null;
  note: string | null;
}

/** Hechos de los procesos de un candidato: lo único que `candidates` necesita saber (DD-06). */
export interface ProcessFacts {
  total: number;
  open: number;
  lastClosedAt: string | null;
}

const INSERT_SQL = `INSERT INTO applications (candidate_id, job_id, stage, created_at, last_change_at)
  VALUES (?, ?, ?, ?, ?)
  RETURNING id, job_id, candidate_id, stage, created_at, last_change_at`;

const INSERT_STAGE_CHANGE_SQL = `INSERT INTO stage_changes
  (application_id, from_stage, to_stage, changed_at, reason, note)
  VALUES (?, ?, ?, ?, ?, ?)`;

// DD-06: una sola consulta sobre `applications`. Por INV-06, `last_change_at` de una inscripción final es la fecha de
// su `StageChange` final. Sin filas, `COUNT` da 0, `COALESCE` da 0 en `open` y `MAX` da NULL.
const PROCESS_FACTS_SQL = `SELECT
    COUNT(*) AS total,
    COALESCE(SUM(stage NOT IN ('hired', 'rejected')), 0) AS open,
    MAX(CASE WHEN stage IN ('hired', 'rejected') THEN last_change_at END) AS last_closed_at
  FROM applications
  WHERE candidate_id = ?`;

// DD-07: sin `JOIN` con `candidates` (DEC-06). `stage_changes_one_final_uq` deja como mucho un cambio final por
// inscripción, así que el `LEFT JOIN` al cambio a `rejected` no duplica filas; `reason` solo existe en un rechazo (INV-07).
const LIST_BY_JOB_SQL = `SELECT a.id, a.candidate_id, a.stage, a.last_change_at, sc.reason AS rejection_reason
  FROM applications a
  LEFT JOIN stage_changes sc ON sc.application_id = a.id AND sc.to_stage = 'rejected'
  WHERE a.job_id = ?
  ORDER BY a.last_change_at DESC, a.id DESC`;

const FIND_ID_BY_PAIR_SQL = `SELECT id FROM applications WHERE candidate_id = ? AND job_id = ?`;

const FIND_BY_ID_SQL = `SELECT id, job_id, candidate_id, stage, created_at, last_change_at
  FROM applications WHERE id = ?`;

// DD-02: la guarda de la etapa esperada va en el propio UPDATE (SEC-02 de HU-04); 0 filas → `undefined`.
const UPDATE_STAGE_SQL = `UPDATE applications SET stage = ?, last_change_at = ?
  WHERE id = ? AND stage = ?
  RETURNING id, job_id, candidate_id, stage, created_at, last_change_at`;

// Orden por `id` (autoincremental): el historial en el orden en que se escribió; usa `stage_changes_application_idx`.
const LIST_HISTORY_SQL = `SELECT from_stage, to_stage, changed_at, reason, note
  FROM stage_changes WHERE application_id = ? ORDER BY id`;

/** Cambio de etapa ya decidido por `transitions.ts`; el repositorio solo aplica la guarda del `WHERE`. */
export interface StageUpdate {
  id: number;
  fromStage: Stage;
  toStage: Stage;
  changedAt: string;
}

function toStageChangeEntry(row: Record<string, unknown>): StageChangeEntry {
  return {
    fromStage: (row.from_stage as Stage | null) ?? null,
    toStage: row.to_stage as Stage,
    changedAt: String(row.changed_at),
    reason: (row.reason as RejectionReason | null) ?? null,
    note: typeof row.note === 'string' ? row.note : null,
  };
}

/** Inscripción activa de una oferta: lo mínimo para rechazarla por cierre (sin datos del candidato). */
export interface ActiveApplicationRow {
  id: number;
  candidateId: number;
  stage: Stage;
}

// HU-06 (DD-02): activas = no finales; `ORDER BY id` fija un orden determinista de rechazo.
const COUNT_ACTIVE_BY_JOB_SQL = `SELECT COUNT(*) AS active FROM applications
  WHERE job_id = ? AND stage NOT IN ('hired', 'rejected')`;

const LIST_ACTIVE_BY_JOB_SQL = `SELECT id, candidate_id, stage FROM applications
  WHERE job_id = ? AND stage NOT IN ('hired', 'rejected') ORDER BY id`;

function toActiveApplicationRow(row: Record<string, unknown>): ActiveApplicationRow {
  return { id: Number(row.id), candidateId: Number(row.candidate_id), stage: row.stage as Stage };
}

/** Recuento y listado de las inscripciones activas de una oferta (HU-06); parte de `createApplicationsRepository`. */
function createActiveByJobQueries(db: DatabaseSync) {
  return {
    /** Cuántas inscripciones de la oferta no están en una etapa final: un agregado, sin traer filas. */
    countActiveByJob(jobId: number): number {
      const row = db.prepare(COUNT_ACTIVE_BY_JOB_SQL).get(jobId);
      return Number(row?.active ?? 0);
    },
    /** Las inscripciones activas de la oferta en orden de `id`, solo con ID, candidato y etapa. */
    listActiveByJob(jobId: number): ActiveApplicationRow[] {
      return db.prepare(LIST_ACTIVE_BY_JOB_SQL).all(jobId).map(toActiveApplicationRow);
    },
  };
}

const SQLITE_CONSTRAINT_UNIQUE = 2067;

/** Lecturas de una inscripción y su historial, y el cambio de etapa guardado (HU-05); parte de `createApplicationsRepository`. */
function createStageOperations(db: DatabaseSync) {
  return {
    /** La inscripción con sus 6 campos, o `undefined` si no existe. */
    findById(id: number): Application | undefined {
      const row = db.prepare(FIND_BY_ID_SQL).get(id);
      return row ? toApplication(row as unknown as ApplicationRow) : undefined;
    },
    /**
     * Pasa la inscripción a `toStage` solo si sigue en `fromStage` (guarda en el `WHERE`, DD-02). `undefined` si no
     * existe o la etapa ya no es `fromStage`; no decide si la transición es válida.
     */
    updateStage({ id, fromStage, toStage, changedAt }: StageUpdate): Application | undefined {
      const row = db.prepare(UPDATE_STAGE_SQL).get(toStage, changedAt, id, fromStage);
      return row ? toApplication(row as unknown as ApplicationRow) : undefined;
    },
    /** Historial de la inscripción, del más antiguo al más reciente; `note` sale tal cual se guardó. */
    listHistory(applicationId: number): StageChangeEntry[] {
      return db.prepare(LIST_HISTORY_SQL).all(applicationId).map(toStageChangeEntry);
    },
  };
}

/** Acceso a `applications` y `stage_changes` solo con sentencias preparadas: la entrada nunca se concatena al SQL. */
export function createApplicationsRepository(db: DatabaseSync) {
  return {
    /** Inserta la inscripción y la devuelve con columnas explícitas. El choque con el índice único lo lanza SQLite. */
    insert(row: ApplicationInsert): Application {
      const inserted = db
        .prepare(INSERT_SQL)
        .get(row.candidateId, row.jobId, row.stage, row.createdAt, row.lastChangeAt);
      if (!inserted) throw new Error('INSERT ... RETURNING no devolvió la fila');
      return toApplication(inserted as unknown as ApplicationRow);
    },
    insertStageChange(change: StageChangeInsert): void {
      db.prepare(INSERT_STAGE_CHANGE_SQL).run(
        change.applicationId,
        change.fromStage,
        change.toStage,
        change.changedAt,
        change.reason,
        change.note,
      );
    },
    /** ID de la inscripción de la pareja, si existe: solo para el 409 tras el choque con el índice único (DD-03). */
    findIdByPair(candidateId: number, jobId: number): number | undefined {
      const row = db.prepare(FIND_ID_BY_PAIR_SQL).get(candidateId, jobId);
      return typeof row?.id === 'number' ? row.id : undefined;
    },
    ...createStageOperations(db),
    ...createActiveByJobQueries(db),
    /** ¿El error es el choque con el índice único `(candidate_id, job_id)`? (INV-01, DEC-08). */
    isDuplicatePairError(error: unknown): boolean {
      if (!(error instanceof Error)) return false;
      const { errcode } = error as Error & { errcode?: number };
      return (
        errcode === SQLITE_CONSTRAINT_UNIQUE && error.message.includes('applications.candidate_id')
      );
    },
    /** Inscripciones de la oferta, la más reciente primero (`last_change_at` y `id` descendentes), sin paginar (S-18). */
    listByJob(jobId: number): PipelineRow[] {
      return db.prepare(LIST_BY_JOB_SQL).all(jobId).map(toPipelineRow);
    },
    /** Total, abiertas y fecha del último cierre del candidato (0, 0 y `null` si no tiene inscripciones). */
    getProcessFacts(candidateId: number): ProcessFacts {
      const row = db.prepare(PROCESS_FACTS_SQL).get(candidateId);
      return {
        total: Number(row?.total ?? 0),
        open: Number(row?.open ?? 0),
        lastClosedAt: typeof row?.last_closed_at === 'string' ? row.last_closed_at : null,
      };
    },
  };
}

export type ApplicationsRepository = ReturnType<typeof createApplicationsRepository>;
