import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

/** data/ats.db en la raíz del repo. Se puede cambiar con ATS_DB_PATH (los tests usan ':memory:'). */
export const DEFAULT_DB_PATH = fileURLToPath(new URL('../../../../data/ats.db', import.meta.url));

export function openDatabase(
  path: string = process.env.ATS_DB_PATH ?? DEFAULT_DB_PATH,
): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  return db;
}
