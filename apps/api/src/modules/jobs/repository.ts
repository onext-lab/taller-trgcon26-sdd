import type { DatabaseSync } from 'node:sqlite';
import type { Job, JobInput, JobListItem, JobStatus, WorkMode } from './schemas.ts';

/** Fila de `job_openings` tal como la devuelve SQLite (los CHECK de la migración 001 garantizan los dominios). */
interface JobRow {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  work_mode: WorkMode | null;
  salary_min: number | null;
  salary_max: number | null;
  status: JobStatus;
  created_at: string;
  published_at: string | null;
  closed_at: string | null;
}

export function toJob(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    workMode: row.work_mode,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    closedAt: row.closed_at,
  };
}

const INSERT_SQL = `INSERT INTO job_openings
  (title, description, location, work_mode, salary_min, salary_max, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)
  RETURNING *`;

// DD-05: lista fija de las 6 columnas editables; nunca un `SET` construido con las claves recibidas.
const UPDATE_SQL = `UPDATE job_openings
  SET title = ?, description = ?, location = ?, work_mode = ?, salary_min = ?, salary_max = ?
  WHERE id = ?
  RETURNING *`;

// DD-08: la guarda de estado va en el propio UPDATE; sin fila afectada → `undefined`.
const MARK_PUBLISHED_SQL = `UPDATE job_openings SET status = 'published', published_at = ?
  WHERE id = ? AND status = 'draft'
  RETURNING *`;

const MARK_CLOSED_SQL = `UPDATE job_openings SET status = 'closed', closed_at = ?
  WHERE id = ? AND status = 'published'
  RETURNING *`;

/** Los 6 campos editables ya fusionados (todos presentes). */
export interface JobEditableFields {
  title: string;
  description: string | null;
  location: string | null;
  workMode: WorkMode | null;
  salaryMin: number | null;
  salaryMax: number | null;
}

interface JobListRow {
  id: number;
  title: string;
  status: JobStatus;
  reference_date: string;
}

// Misma expresión que el índice `job_openings_reference_date_idx` (migración 001), para que lo use.
const LIST_PAGE_SQL = `SELECT id, title, status, COALESCE(published_at, created_at) AS reference_date
  FROM job_openings
  ORDER BY COALESCE(published_at, created_at) DESC, id DESC
  LIMIT ? OFFSET ?`;

/** Acceso a `job_openings` solo con sentencias preparadas: la entrada nunca se concatena al SQL. */
export function createJobsRepository(db: DatabaseSync) {
  return {
    findById(id: number): Job | undefined {
      const row = db.prepare('SELECT * FROM job_openings WHERE id = ?').get(id);
      return row ? toJob(row as unknown as JobRow) : undefined;
    },
    listPage(limit: number, offset: number): JobListItem[] {
      const rows = db.prepare(LIST_PAGE_SQL).all(limit, offset) as unknown as JobListRow[];
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        referenceDate: row.reference_date,
      }));
    },
    count(): number {
      const row = db.prepare('SELECT COUNT(*) AS total FROM job_openings').get();
      return Number(row?.total ?? 0);
    },
    insert(input: JobInput, createdAt: string): Job {
      const row = db
        .prepare(INSERT_SQL)
        .get(
          input.title,
          input.description ?? null,
          input.location ?? null,
          input.workMode ?? null,
          input.salaryMin ?? null,
          input.salaryMax ?? null,
          createdAt,
        );
      if (!row) throw new Error('INSERT ... RETURNING no devolvió la fila');
      return toJob(row as unknown as JobRow);
    },
    /** `undefined` si no hay fila con ese `id`. */
    update(id: number, fields: JobEditableFields): Job | undefined {
      const row = db
        .prepare(UPDATE_SQL)
        .get(
          fields.title,
          fields.description,
          fields.location,
          fields.workMode,
          fields.salaryMin,
          fields.salaryMax,
          id,
        );
      return row ? toJob(row as unknown as JobRow) : undefined;
    },
    /** `draft` → `published`; `undefined` si no existe o no está en `draft`. */
    markPublished(id: number, publishedAt: string): Job | undefined {
      const row = db.prepare(MARK_PUBLISHED_SQL).get(publishedAt, id);
      return row ? toJob(row as unknown as JobRow) : undefined;
    },
    /** `published` → `closed`; `undefined` si no existe o no está en `published`. */
    markClosed(id: number, closedAt: string): Job | undefined {
      const row = db.prepare(MARK_CLOSED_SQL).get(closedAt, id);
      return row ? toJob(row as unknown as JobRow) : undefined;
    },
    /** Borrado físico; devuelve las filas borradas (0 o 1). */
    deleteById(id: number): number {
      return Number(db.prepare('DELETE FROM job_openings WHERE id = ?').run(id).changes);
    },
  };
}

export type JobsRepository = ReturnType<typeof createJobsRepository>;
