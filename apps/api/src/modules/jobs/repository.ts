import type { DatabaseSync } from 'node:sqlite';
import type { Job, JobInput, JobStatus, WorkMode } from './schemas.ts';

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

/** Acceso a `job_openings` solo con sentencias preparadas: la entrada nunca se concatena al SQL. */
export function createJobsRepository(db: DatabaseSync) {
  return {
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
  };
}

export type JobsRepository = ReturnType<typeof createJobsRepository>;
