import { readdirSync, readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';

const SCHEMA_URL = new URL('./schema.sql', import.meta.url);
const MIGRATIONS_URL = new URL('./migrations/', import.meta.url);

/** Aplica schema.sql y, en orden alfabético, las migraciones .sql que aún no constan en schema_migrations. */
export function migrate(db: DatabaseSync): string[] {
  db.exec(readFileSync(SCHEMA_URL, 'utf8'));
  const applied = new Set(
    db
      .prepare('SELECT name FROM schema_migrations')
      .all()
      .map((row) => String(row.name)),
  );
  const pending = readdirSync(MIGRATIONS_URL)
    .filter((file) => file.endsWith('.sql') && !applied.has(file))
    .sort();
  for (const file of pending) {
    const sql = readFileSync(new URL(file, MIGRATIONS_URL), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`La migración ${file} ha fallado`, { cause: error });
    }
  }
  return pending;
}
