import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import { insertApplicationAt } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestApp } from '../helpers/test-app.ts';

// TASK-02 (DD-02): lecturas y guarda de la escritura del repositorio. Datos inventados.
const START_AT = '2026-10-01T09:00:00.000Z';
const CHANGED_AT = '2026-10-07T10:00:00.000Z';
const KEYS = ['candidateId', 'createdAt', 'id', 'jobId', 'lastChangeAt', 'stage'];

let app: FastifyInstance;
let db: DatabaseSync;
let jobId: number;
let candidateId: number;
let sequence = 0;

beforeEach(async () => {
  ({ app, db } = createTestApp());
  jobId = (await createPublishedJob(app, { title: 'Oferta inventada' })).id;
  candidateId = (
    await createCandidate(app, {
      fullName: 'Candidata Inventada',
      email: 'candidata.repo@example.com',
      phone: '+34 600 000 011',
      consent: false,
    })
  ).id;
});

afterEach(async () => {
  await app.close();
});

function repository() {
  return createApplicationsRepository(db);
}

describe('findById', () => {
  it('findById devuelve la inscripción con 6 campos; inexistente → undefined', () => {
    const inserted = insertApplicationAt(db, {
      jobId,
      candidateId,
      path: ['received', 'screening'],
      startAt: START_AT,
    });

    const found = repository().findById(inserted.id);

    expect(found).toEqual({
      id: inserted.id,
      jobId,
      candidateId,
      stage: 'screening',
      createdAt: START_AT,
      lastChangeAt: '2026-10-01T09:01:00.000Z',
    });
    expect(Object.keys(found!).sort()).toEqual(KEYS);
    expect(repository().findById(inserted.id + 1000)).toBeUndefined();
  });
});

describe('updateStage', () => {
  it('DD-02 updateStage con stage desfasado → undefined y fila intacta', () => {
    const inserted = insertApplicationAt(db, {
      jobId,
      candidateId,
      path: ['received', 'screening'],
      startAt: START_AT,
    });

    const result = repository().updateStage({
      id: inserted.id,
      fromStage: 'received',
      toStage: 'screening',
      changedAt: CHANGED_AT,
    });

    expect(result).toBeUndefined();
    expect(repository().findById(inserted.id)).toEqual(inserted);
  });

  it('updateStage con inscripción inexistente → undefined', () => {
    expect(
      repository().updateStage({
        id: 9999,
        fromStage: 'received',
        toStage: 'screening',
        changedAt: CHANGED_AT,
      }),
    ).toBeUndefined();
  });

  it('updateStage con la etapa actual → la fila con stage y lastChangeAt nuevos', () => {
    const inserted = insertApplicationAt(db, {
      jobId,
      candidateId,
      path: ['received', 'screening'],
      startAt: START_AT,
    });

    const result = repository().updateStage({
      id: inserted.id,
      fromStage: 'screening',
      toStage: 'interview',
      changedAt: CHANGED_AT,
    });

    expect(result).toEqual({ ...inserted, stage: 'interview', lastChangeAt: CHANGED_AT });
    expect(Object.keys(result!).sort()).toEqual(KEYS);
    expect(repository().findById(inserted.id)).toEqual(result);
  });
});

describe('listHistory', () => {
  it('listHistory: una inscripción nueva → 1 cambio sin origen', () => {
    const inserted = insertApplicationAt(db, {
      jobId,
      candidateId,
      path: ['received'],
      startAt: START_AT,
    });

    expect(repository().listHistory(inserted.id)).toEqual([
      { fromStage: null, toStage: 'received', changedAt: START_AT, reason: null, note: null },
    ]);
  });

  it('listHistory en orden de id: 5 cambios de una contratada', () => {
    const inserted = insertApplicationAt(db, {
      jobId,
      candidateId,
      path: ['received', 'screening', 'interview', 'offer', 'hired'],
      startAt: START_AT,
    });

    const history = repository().listHistory(inserted.id);

    expect(history.map((entry) => [entry.fromStage, entry.toStage])).toEqual([
      [null, 'received'],
      ['received', 'screening'],
      ['screening', 'interview'],
      ['interview', 'offer'],
      ['offer', 'hired'],
    ]);
    expect(history.map((entry) => entry.changedAt)).toEqual([
      '2026-10-01T09:00:00.000Z',
      '2026-10-01T09:01:00.000Z',
      '2026-10-01T09:02:00.000Z',
      '2026-10-01T09:03:00.000Z',
      '2026-10-01T09:04:00.000Z',
    ]);
    expect(history.every((entry) => entry.reason === null && entry.note === null)).toBe(true);
  });

  it('listHistory: rechazo con motivo y nota tal cual, con saltos y tabulaciones', () => {
    const note = 'Primera línea.\r\nSegunda\tlínea.\nTercera.';
    const inserted = insertApplicationAt(db, {
      jobId,
      candidateId,
      path: ['received', 'screening', 'rejected'],
      startAt: START_AT,
      reason: 'candidate_withdrew',
      note,
    });

    const history = repository().listHistory(inserted.id);

    expect(history).toHaveLength(3);
    expect(history[2]).toEqual({
      fromStage: 'screening',
      toStage: 'rejected',
      changedAt: '2026-10-01T09:02:00.000Z',
      reason: 'candidate_withdrew',
      note,
    });
    expect(Object.keys(history[2]!).sort()).toEqual([
      'changedAt',
      'fromStage',
      'note',
      'reason',
      'toStage',
    ]);
  });

  it('listHistory solo devuelve los cambios de la inscripción pedida; inexistente → []', async () => {
    const other = (
      await createCandidate(app, {
        fullName: 'Otra Candidata Inventada',
        email: `otra.repo.${sequence++}@example.com`,
        consent: false,
      })
    ).id;
    const mine = insertApplicationAt(db, {
      jobId,
      candidateId,
      path: ['received'],
      startAt: START_AT,
    });
    insertApplicationAt(db, {
      jobId,
      candidateId: other,
      path: ['received', 'screening'],
      startAt: START_AT,
    });

    expect(repository().listHistory(mine.id)).toHaveLength(1);
    expect(repository().listHistory(9999)).toEqual([]);
  });
});
