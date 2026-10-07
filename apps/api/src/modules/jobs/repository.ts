import type { DatabaseSync } from 'node:sqlite';
import { registerTextSearch } from '../../db/text-search.ts';
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
// SEC-02: la guarda de estado (una `closed` no se edita) va en el propio `WHERE`, como en `MARK_*_SQL`.
const UPDATE_SQL = `UPDATE job_openings
  SET title = ?, description = ?, location = ?, work_mode = ?, salary_min = ?, salary_max = ?
  WHERE id = ? AND status IN ('draft', 'published')
  RETURNING *`;

// SEC-02: solo se borra un `draft`; sin fila afectada → 0.
const DELETE_DRAFT_SQL = `DELETE FROM job_openings WHERE id = ? AND status = 'draft'`;

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

/** Filtros del listado, en Y. `q` ya viene plegado con `foldSearchText`; `null` = sin filtro. */
export interface JobListFilter {
  status: JobStatus | null;
  q: string | null;
}

// `instr` es literal: `%`, `_` y `\` no son comodines (DD-04). El ORDER BY repite la expresión del índice
// `job_openings_reference_date_idx` (migración 001), para que lo use.
const FILTER_SQL = `WHERE (:status IS NULL OR status = :status)
    AND (:q IS NULL OR instr(fold_search(title), :q) > 0)`;

const LIST_PAGE_SQL = `SELECT id, title, status, COALESCE(published_at, created_at) AS reference_date
  FROM job_openings
  ${FILTER_SQL}
  ORDER BY COALESCE(published_at, created_at) DESC, id DESC
  LIMIT :limit OFFSET :offset`;

const COUNT_SQL = `SELECT COUNT(*) AS total FROM job_openings ${FILTER_SQL}`;

/** Acceso a `job_openings` solo con sentencias preparadas: la entrada nunca se concatena al SQL. */
export function createJobsRepository(db: DatabaseSync) {
  // DD-04: la búsqueda necesita `fold_search` en esta conexión (registrarla dos veces no falla).
  registerTextSearch(db);
  return {
    findById(id: number): Job | undefined {
      const row = db.prepare('SELECT * FROM job_openings WHERE id = ?').get(id);
      return row ? toJob(row as unknown as JobRow) : undefined;
    },
    /** Solo el estado (lo lee el puerto de `applications`); `undefined` si la oferta no existe. */
    findStatusById(id: number): JobStatus | undefined {
      const row = db.prepare('SELECT status FROM job_openings WHERE id = ?').get(id);
      return row ? (row.status as JobStatus) : undefined;
    },
    listPage(filter: JobListFilter, limit: number, offset: number): JobListItem[] {
      const rows = db
        .prepare(LIST_PAGE_SQL)
        .all({ status: filter.status, q: filter.q, limit, offset }) as unknown as JobListRow[];
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        referenceDate: row.reference_date,
      }));
    },
    /** Total del resultado filtrado (mismo `WHERE` que `listPage`). */
    count(filter: JobListFilter): number {
      const row = db.prepare(COUNT_SQL).get({ status: filter.status, q: filter.q });
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
    /** `undefined` si no hay fila con ese `id` o está `closed` (la guarda va en el `WHERE`). */
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
    /** Borrado físico, solo de un `draft`; devuelve las filas borradas (0 si no existe o no está en `draft`). */
    deleteById(id: number): number {
      return Number(db.prepare(DELETE_DRAFT_SQL).run(id).changes);
    },
  };
}

export type JobsRepository = ReturnType<typeof createJobsRepository>;
