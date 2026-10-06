import { rmSync } from 'node:fs';
import { DEFAULT_DB_PATH, openDatabase } from './connection.ts';
import { migrate } from './migrate.ts';
import { seed } from './seed.ts';

// Regenera data/ats.db desde cero: schema.sql + migraciones + seed.
const path = process.env.ATS_DB_PATH ?? DEFAULT_DB_PATH;
for (const suffix of ['', '-wal', '-shm']) rmSync(`${path}${suffix}`, { force: true });

const db = openDatabase(path);
const applied = migrate(db);
seed(db);
db.close();

console.log(`Base regenerada en ${path} (${applied.length} migraciones aplicadas).`);
