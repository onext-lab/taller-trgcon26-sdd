import type { DatabaseSync } from 'node:sqlite';

/**
 * Ejecuta `fn` (síncrona) en una transacción (DEC-06, DEC-11.7). Si ya hay una en curso, se une a ella sin abrir
 * otra: un error deshace también la exterior. Si no, `BEGIN IMMEDIATE` y `COMMIT`; ante error, `ROLLBACK` y relanza
 * el error original.
 */
export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  if (db.isTransaction) return fn();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    // SQLite deshace solo algunas transacciones al fallar; un ROLLBACK sin transacción taparía el error original.
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}
