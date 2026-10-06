-- HU-03: candidatos (Candidate) y su consentimiento. Instantes en ISO 8601 UTC con milisegundos, como los da
-- Date#toISOString(); retention_ends_at es un día natural (AAAA-MM-DD, Europe/Madrid). Sin borrado: INV-05.
CREATE TABLE candidates (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name             TEXT    NOT NULL CHECK (length(full_name) BETWEEN 2 AND 100),
  email                 TEXT    NOT NULL CHECK (length(email) BETWEEN 3 AND 254 AND email = lower(trim(email))), -- INV-02
  phone                 TEXT    CHECK (phone IS NULL OR length(phone) BETWEEN 6 AND 21),
  summary               TEXT    CHECK (summary IS NULL OR length(summary) BETWEEN 1 AND 2000),
  skills                TEXT    NOT NULL DEFAULT '[]'
                                CHECK (json_valid(skills) AND json_type(skills) = 'array' AND json_array_length(skills) <= 20),
  created_at            TEXT    NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  consent_given_at      TEXT    CHECK (consent_given_at IS NULL OR consent_given_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  consent_withdrawn_at  TEXT    CHECK (consent_withdrawn_at IS NULL OR consent_withdrawn_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  consent_version       TEXT    CHECK (consent_version IS NULL OR consent_version GLOB 'v[0-9]*'),
  retention_ends_at     TEXT    CHECK (retention_ends_at IS NULL OR retention_ends_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK ((consent_given_at IS NULL) = (consent_version IS NULL)),                                              -- INV-04
  CHECK (consent_withdrawn_at IS NULL OR consent_given_at IS NOT NULL)                                         -- INV-04
);

CREATE UNIQUE INDEX candidates_email_uq ON candidates (email);                                                 -- INV-01, DEC-08

CREATE INDEX candidates_created_at_idx ON candidates (created_at DESC, id DESC);
