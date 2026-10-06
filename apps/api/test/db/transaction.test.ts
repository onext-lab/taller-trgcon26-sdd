import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.ts';
import { withTransaction } from '../../src/db/transaction.ts';

describe('withTransaction', () => {
  let db: DatabaseSync;

  const insert = (name: string) => db.prepare('INSERT INTO items (name) VALUES (?)').run(name);
  const names = () =>
    db
      .prepare('SELECT name FROM items ORDER BY id')
      .all()
      .map((row) => row.name);

  beforeEach(() => {
    db = openDatabase(':memory:');
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
  });

  afterEach(() => {
    db.close();
  });

  it('confirma', () => {
    const result = withTransaction(db, () => {
      insert('Oferta inventada');
      return 'hecho';
    });

    expect(result).toBe('hecho');
    expect(db.isTransaction).toBe(false);
    expect(names()).toEqual(['Oferta inventada']);
  });

  it('deshace y relanza ante error', () => {
    const failure = new Error('fallo simulado');

    expect(() =>
      withTransaction(db, () => {
        insert('Oferta inventada');
        throw failure;
      }),
    ).toThrow(failure);
    expect(db.isTransaction).toBe(false);
    expect(names()).toEqual([]);
  });

  it('se une a una transacción en curso', () => {
    db.exec('BEGIN IMMEDIATE');
    withTransaction(db, () => insert('Dentro de la exterior'));

    // No confirma por su cuenta: la exterior sigue abierta y es quien decide.
    expect(db.isTransaction).toBe(true);
    expect(names()).toEqual(['Dentro de la exterior']);

    const failure = new Error('fallo simulado');
    expect(() =>
      withTransaction(db, () => {
        insert('Segunda');
        throw failure;
      }),
    ).toThrow(failure);
    // Tampoco deshace por su cuenta: relanza y la exterior sigue abierta.
    expect(db.isTransaction).toBe(true);

    db.exec('ROLLBACK');
    expect(names()).toEqual([]);
  });
});
