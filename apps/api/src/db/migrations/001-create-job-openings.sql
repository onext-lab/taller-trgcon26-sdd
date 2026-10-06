-- HU-01: ofertas (JobOpening). Instantes en ISO 8601 UTC con milisegundos, como los da Date#toISOString().
CREATE TABLE job_openings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description  TEXT    CHECK (description IS NULL OR length(description) BETWEEN 1 AND 5000),
  location     TEXT    CHECK (location IS NULL OR length(location) BETWEEN 2 AND 120),
  work_mode    TEXT    CHECK (work_mode IS NULL OR work_mode IN ('presencial', 'híbrida', 'remota')),
  salary_min   INTEGER CHECK (salary_min IS NULL OR (typeof(salary_min) = 'integer' AND salary_min > 0)),
  salary_max   INTEGER CHECK (salary_max IS NULL OR (typeof(salary_max) = 'integer' AND salary_max > 0)),
  status       TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at   TEXT    NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  published_at TEXT    CHECK (published_at IS NULL OR published_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  closed_at    TEXT    CHECK (closed_at IS NULL OR closed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max),                 -- INV-07
  CHECK ((status = 'draft'     AND published_at IS NULL     AND closed_at IS NULL)
      OR (status = 'published' AND published_at IS NOT NULL AND closed_at IS NULL)
      OR (status = 'closed'    AND published_at IS NOT NULL AND closed_at IS NOT NULL)),          -- INV-01, INV-04, INV-05 (fechas)
  CHECK (status = 'draft' OR (description IS NOT NULL AND location IS NOT NULL AND work_mode IS NOT NULL)) -- INV-04
);

CREATE INDEX job_openings_reference_date_idx
  ON job_openings (COALESCE(published_at, created_at) DESC, id DESC);
