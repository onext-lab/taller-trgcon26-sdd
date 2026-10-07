-- HU-04: inscripciones (Application) e historial (StageChange). Dueño: applications (DEC-06). Las FK a candidates y
-- job_openings son integridad referencial de la base, no acoplamiento de código (aclaración de DEC-06).
CREATE TABLE applications (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id   INTEGER NOT NULL REFERENCES candidates (id) ON DELETE RESTRICT,
  job_id         INTEGER NOT NULL REFERENCES job_openings (id) ON DELETE RESTRICT,
  stage          TEXT    NOT NULL CHECK (stage IN ('received','screening','interview','offer','hired','rejected')),
  created_at     TEXT    NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  last_change_at TEXT    NOT NULL CHECK (last_change_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  CHECK (last_change_at >= created_at)
);
CREATE UNIQUE INDEX applications_candidate_job_uq ON applications (candidate_id, job_id);  -- INV-01, DEC-08
CREATE INDEX applications_job_pipeline_idx ON applications (job_id, last_change_at DESC, id DESC);

CREATE TABLE stage_changes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications (id) ON DELETE RESTRICT,
  from_stage     TEXT,
  to_stage       TEXT    NOT NULL,
  changed_at     TEXT    NOT NULL CHECK (changed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  reason         TEXT    CHECK (reason IS NULL OR reason IN ('not_a_fit','candidate_withdrew','other','job_closed')),
  note           TEXT    CHECK (note IS NULL OR length(note) BETWEEN 1 AND 500),                -- INV-10
  CHECK ((from_stage IS NULL AND to_stage = 'received')
      OR (from_stage IS 'received'  AND to_stage IN ('screening','rejected'))
      OR (from_stage IS 'screening' AND to_stage IN ('interview','rejected'))
      OR (from_stage IS 'interview' AND to_stage IN ('offer','rejected'))
      OR (from_stage IS 'offer'     AND to_stage IN ('hired','rejected'))),                   -- INV-04, EC-13
  CHECK ((reason IS NOT NULL) = (to_stage = 'rejected')),                                      -- INV-07
  CHECK (note IS NULL OR to_stage = 'rejected')                                                -- INV-10
);
CREATE INDEX stage_changes_application_idx ON stage_changes (application_id, id);
CREATE UNIQUE INDEX stage_changes_one_initial_uq ON stage_changes (application_id) WHERE from_stage IS NULL;
CREATE UNIQUE INDEX stage_changes_one_final_uq ON stage_changes (application_id) WHERE to_stage IN ('hired','rejected');

-- INV-03: los únicos triggers del esquema (DT-07). Única excepción, RGPD §5 (anonimizar el texto libre):
-- UPDATE stage_changes SET note = NULL. Cualquier otro cambio de columna, o una nota distinta de NULL, aborta.
CREATE TRIGGER stage_changes_no_update BEFORE UPDATE ON stage_changes
WHEN NEW.id IS NOT OLD.id
  OR NEW.application_id IS NOT OLD.application_id
  OR NEW.from_stage IS NOT OLD.from_stage
  OR NEW.to_stage IS NOT OLD.to_stage
  OR NEW.changed_at IS NOT OLD.changed_at
  OR NEW.reason IS NOT OLD.reason
  OR NEW.note IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'stage_changes es inmutable'); END;
CREATE TRIGGER stage_changes_no_delete BEFORE DELETE ON stage_changes
BEGIN SELECT RAISE(ABORT, 'stage_changes es inmutable'); END;
