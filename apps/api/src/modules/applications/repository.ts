import type { DatabaseSync } from 'node:sqlite';
import type { Application, RejectionReason, Stage } from './schemas.ts';

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
