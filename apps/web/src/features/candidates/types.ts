/**
 * Candidates contract consumed by the web. The source of truth is the «Contrato de API» section of
 * `docs/03_delivery/hu/HU-03-candidatos-consentimiento/plans/TECHNICAL_DOC-backend.md` (assumptions S1-S4 of
 * the frontend design). If it changes, only `types.ts`, `api.ts` and `consent.ts` change.
 */

/** Full candidate (`POST` 201, `GET /:id` 200, `PATCH` 200 and the consent actions). Optionals are `null`. */
export interface Candidate {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  summary: string | null;
  skills: string[];
  /** ISO 8601 UTC. */
  createdAt: string;
  /** ISO 8601 UTC, or `null` if consent was never given. */
  consentGivenAt: string | null;
  consentVersion: string | null;
  consentWithdrawnAt: string | null;
  /** Calendar date `AAAA-MM-DD`, or `null` while the process lasts. */
  retentionEndsAt: string | null;
}

/** Item of `GET /api/candidates`: exactly these four fields (RNF-04). */
export type CandidateListItem = Pick<Candidate, 'id' | 'fullName' | 'email' | 'skills'>;

export interface CandidatePage {
  items: CandidateListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Query of `GET /api/candidates`; an empty or default value is left out of the URL. */
export interface CandidateListParams {
  q?: string;
  skill?: string;
  page?: number;
  pageSize?: number;
}

/** Body of `POST /api/candidates`: an empty optional is omitted; `consent` is always a boolean. */
export interface CandidateInput {
  fullName: string;
  email: string;
  phone?: string;
  summary?: string;
  skills?: string[];
  consent: boolean;
}

/** Body of `PATCH /api/candidates/:id`: only the changed fields; `null` empties `phone` or `summary`. */
export interface CandidatePatch {
  fullName?: string;
  email?: string;
  phone?: string | null;
  summary?: string | null;
  skills?: string[];
}

/** Why a CSV row was not imported (`reason` of `notImported[]`, S-02). */
export type ImportReason = 'invalid' | 'duplicate' | 'repeated';

/** One error of a row: `field` is a CSV column (`nombre`, `email`, `telefono`) or `fila` for the whole row (S-03). */
export interface ImportRowError {
  field: string;
  message: string;
}

/** A row that was not imported; `existingId` only in `duplicate`, `firstRow` only in `repeated`. */
export interface NotImportedRow {
  row: number;
  reason: ImportReason;
  errors: ImportRowError[];
  existingId?: number;
  firstRow?: number;
}

/** 200 of `POST /api/candidates/import` (S-02): counts plus the rows that were not imported. */
export interface ImportReport {
  dataRows: number;
  created: number;
  duplicates: number;
  invalid: number;
  notImported: NotImportedRow[];
}
