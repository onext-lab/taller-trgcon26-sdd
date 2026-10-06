-- Esquema base de data/ats.db. Las tablas del dominio llegan con las migraciones de cada HU
-- (src/db/migrations/NNN-descripcion.sql); este fichero solo crea la tabla que las registra.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
