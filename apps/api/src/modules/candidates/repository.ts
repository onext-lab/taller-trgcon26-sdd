import type { DatabaseSync } from 'node:sqlite';
import { registerTextSearch } from '../../db/text-search.ts';
import type { Candidate, CandidateListItem } from './schemas.ts';

/** Fila de `candidates` tal como la devuelve SQLite (los CHECK de la migración 002 garantizan los dominios). */
interface CandidateRow {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  summary: string | null;
  skills: string;
  created_at: string;
  consent_given_at: string | null;
  consent_withdrawn_at: string | null;
  consent_version: string | null;
  retention_ends_at: string | null;
}

export function toCandidate(row: CandidateRow): Candidate {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    summary: row.summary,
    skills: JSON.parse(row.skills) as string[],
    createdAt: row.created_at,
    consentGivenAt: row.consent_given_at,
    consentVersion: row.consent_version,
    consentWithdrawnAt: row.consent_withdrawn_at,
    retentionEndsAt: row.retention_ends_at,
  };
}

/** Campos de la ficha que escribe el alta: ya normalizados y con `skills` presente. */
export interface CandidateFields {
  fullName: string;
  email: string;
  phone: string | null;
  summary: string | null;
  skills: string[];
}

/** Consentimiento con el que nace una ficha (`null`: nunca dado). */
export interface InitialConsent {
  givenAt: string;
  version: string;
}

/** Estado de consentimiento de una ficha (`null` en los tres: nunca dado). */
export interface ConsentState {
  givenAt: string | null;
  version: string | null;
  withdrawnAt: string | null;
}

const UPDATE_FIELDS_SQL = `UPDATE candidates
  SET full_name = ?, email = ?, phone = ?, summary = ?, skills = ?
  WHERE id = ?`;

const SET_CONSENT_SQL = `UPDATE candidates
  SET consent_given_at = ?, consent_version = ?, consent_withdrawn_at = ?
  WHERE id = ?`;

// La retención nace `NULL`: solo `recalculateRetention` la escribe (DD-05).
const INSERT_SQL = `INSERT INTO candidates
  (full_name, email, phone, summary, skills, created_at, consent_given_at, consent_version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

/** Filtros del listado, en Y. `q` ya viene plegado con `foldSearchText` y `skill` en minúsculas; `null` = sin filtro. */
export interface CandidateListFilter {
  q: string | null;
  skill: string | null;
}

interface CandidateListRow {
  id: number;
  full_name: string;
  email: string;
  skills: string;
}

// DD-02: `instr` es literal (`%`, `_` y `\` no son comodines). El email ya se guarda en minúsculas y en ASCII, así
// que no necesita `fold_search`. La skill se busca exacta en el JSON de `skills`.
const FILTER_SQL = `WHERE (:q IS NULL OR instr(fold_search(full_name), :q) > 0 OR instr(email, :q) > 0)
    AND (:skill IS NULL OR EXISTS (SELECT 1 FROM json_each(candidates.skills) WHERE value = :skill))`;

const LIST_PAGE_SQL = `SELECT id, full_name, email, skills
  FROM candidates
  ${FILTER_SQL}
  ORDER BY created_at DESC, id DESC
  LIMIT :limit OFFSET :offset`;

const COUNT_SQL = `SELECT COUNT(*) AS total FROM candidates ${FILTER_SQL}`;

const FIND_NAMES_SQL = `SELECT id, full_name FROM candidates WHERE id IN (SELECT value FROM json_each(?))`;

const SQLITE_CONSTRAINT_UNIQUE = 2067;

/** Lecturas de una ficha, de los puertos y del listado paginado; parte de `createCandidatesRepository`. */
function createCandidateQueries(db: DatabaseSync) {
  return {
    findById(id: number): Candidate | undefined {
      const row = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
      return row ? toCandidate(row as unknown as CandidateRow) : undefined;
    },
    /** ¿Existe la ficha? Sin leer ninguna columna (lo usa el puerto de `applications`). */
    existsById(id: number): boolean {
      return db.prepare('SELECT 1 FROM candidates WHERE id = ?').get(id) !== undefined;
    },
    /** Solo `id` y `full_name` (DP-02) de los IDs que existen; un solo parámetro JSON, sin SQL concatenado. */
    findNamesByIds(ids: readonly number[]): Map<number, string> {
      const rows = db.prepare(FIND_NAMES_SQL).all(JSON.stringify(ids));
      return new Map(rows.map((row) => [Number(row.id), String(row.full_name)]));
    },
    findIdByEmail(email: string): number | undefined {
      const row = db.prepare('SELECT id FROM candidates WHERE email = ?').get(email);
      return row ? Number(row.id) : undefined;
    },
    /** Una página del listado: solo `id, full_name, email, skills` (RNF-04). Orden `created_at DESC, id DESC`. */
    listPage(filter: CandidateListFilter, limit: number, offset: number): CandidateListItem[] {
      const rows = db
        .prepare(LIST_PAGE_SQL)
        .all({ q: filter.q, skill: filter.skill, limit, offset }) as unknown as CandidateListRow[];
      return rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        skills: JSON.parse(row.skills) as string[],
      }));
    },
    /** Total del resultado filtrado (mismo `WHERE` que `listPage`). */
    count(filter: CandidateListFilter): number {
      const row = db.prepare(COUNT_SQL).get({ q: filter.q, skill: filter.skill });
      return Number(row?.total ?? 0);
    },
  };
}

/** Alta, edición, consentimiento y retención de una ficha; parte de `createCandidatesRepository`. */
function createCandidateWriteOperations(db: DatabaseSync) {
  return {
    /** Inserta con retención `NULL` y devuelve el ID. El choque con `candidates_email_uq` lo lanza SQLite. */
    insert(fields: CandidateFields, createdAt: string, consent: InitialConsent | null): number {
      const result = db
        .prepare(INSERT_SQL)
        .run(
          fields.fullName,
          fields.email,
          fields.phone,
          fields.summary,
          JSON.stringify(fields.skills),
          createdAt,
          consent?.givenAt ?? null,
          consent?.version ?? null,
        );
      return Number(result.lastInsertRowid);
    },
    /** Escribe las 5 columnas editables (lista fija: nunca la retención ni el consentimiento, RN-10). */
    updateFields(id: number, fields: CandidateFields): void {
      db.prepare(UPDATE_FIELDS_SQL).run(
        fields.fullName,
        fields.email,
        fields.phone,
        fields.summary,
        JSON.stringify(fields.skills),
        id,
      );
    },
    /** Escribe el estado de consentimiento completo (un solo estado, sin historial, DT-03). */
    setConsent(id: number, consent: ConsentState): void {
      db.prepare(SET_CONSENT_SQL).run(consent.givenAt, consent.version, consent.withdrawnAt, id);
    },
    /** Único camino de escritura de `retention_ends_at` (DD-05). */
    setRetention(id: number, date: string | null): void {
      db.prepare('UPDATE candidates SET retention_ends_at = ? WHERE id = ?').run(date, id);
    },
    /** ¿Es el error del `UNIQUE` de `candidates.email`? (DD-04). Distingue el índice por el texto de SQLite. */
    isDuplicateEmailError(error: unknown): boolean {
      if (!(error instanceof Error)) return false;
      const { errcode } = error as Error & { errcode?: number };
      return errcode === SQLITE_CONSTRAINT_UNIQUE && error.message.includes('candidates.email');
    },
  };
}

/** Acceso a `candidates` solo con sentencias preparadas: la entrada nunca se concatena al SQL. */
export function createCandidatesRepository(db: DatabaseSync) {
  // DD-02: la búsqueda (TASK-05) necesita `fold_search` en esta conexión (registrarla dos veces no falla).
  registerTextSearch(db);
  const queries = createCandidateQueries(db);
  const writes = createCandidateWriteOperations(db);
  return {
    ...queries,
    ...writes,
    /**
     * Si `error` es el choque con `candidates_email_uq`, el ID del candidato que ya tenía `email` (la transacción sigue
     * abierta tras el fallo: SQLite deshace solo la sentencia, DD-05); `undefined` en cualquier otro caso.
     */
    existingIdOnDuplicate(error: unknown, email: string): number | undefined {
      return writes.isDuplicateEmailError(error) ? queries.findIdByEmail(email) : undefined;
    },
  };
}

export type CandidatesRepository = ReturnType<typeof createCandidatesRepository>;
