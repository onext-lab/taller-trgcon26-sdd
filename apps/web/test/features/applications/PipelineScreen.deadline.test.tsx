import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pipeline } from '../../../src/features/applications/types.ts';
import {
  CLOSED_PIPELINE,
  EMPTY_PUBLISHED_PIPELINE,
  EXPIRED_EMPTY_PIPELINE,
  EXPIRED_PIPELINE,
  PUBLISHED_PIPELINE,
  renderPipeline,
} from './fixtures.ts';

const KEY = 'GET /api/jobs/7/applications';
const PATH = '/jobs/7/pipeline';
const BUTTON = { name: 'Inscribir candidato' };
const EMPTY_TEXT = 'Todavía no hay candidatos inscritos en esta oferta.';
const EXPIRED_TEXT =
  'El plazo de inscripción terminó el 10/10/2026: no se pueden inscribir más candidatos.';

function withJob(pipeline: Pipeline, job: Partial<Pipeline['job']>): Pipeline {
  return { ...pipeline, job: { ...pipeline.job, ...job } };
}

function ok(json: unknown) {
  return { [KEY]: { status: 200, json } };
}

describe('PipelineScreen: plazo de inscripción', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-12 vencida con inscripciones: sin botón, texto en status y «Avanzar»/«Rechazar» presentes', async () => {
    renderPipeline(PATH, ok(EXPIRED_PIPELINE));

    const status = (await screen.findByText(EXPIRED_TEXT)).closest('[role="status"]');
    expect(status?.textContent).toBe(EXPIRED_TEXT);
    expect(screen.queryByRole('button', BUTTON)).toBeNull();
    expect(screen.getAllByRole('region')).toHaveLength(6);
    expect(screen.getAllByRole('button', { name: /^Avanzar a / }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Rechazar/ }).length).toBeGreaterThan(0);
  });

  it('CA-12 vencida sin inscripciones: texto y vacío', async () => {
    renderPipeline(PATH, ok(EXPIRED_EMPTY_PIPELINE));

    expect((await screen.findByText(EXPIRED_TEXT)).getAttribute('role')).toBe('status');
    expect(screen.getByText(EMPTY_TEXT)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('CA-06 con enrollmentDeadlinePassed false tras ampliar, el pipeline vuelve a ofrecer «Inscribir candidato»', async () => {
    const extended = withJob(EXPIRED_PIPELINE, {
      enrollmentDeadline: '2026-12-31',
      enrollmentDeadlinePassed: false,
    });
    renderPipeline(PATH, ok(extended));

    expect(await screen.findByRole('button', BUTTON)).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(/El plazo de inscripción terminó/)).toBeNull();
  });

  it.each([
    ['plazo hoy (passed: false) con botón', '2026-10-13', false, true],
    ['plazo ayer (passed: true) sin botón', '2026-10-12', true, false],
  ])('EC-25 %s', async (_name, enrollmentDeadline, enrollmentDeadlinePassed, hasButton) => {
    const pipeline = withJob(EMPTY_PUBLISHED_PIPELINE, {
      enrollmentDeadline,
      enrollmentDeadlinePassed,
    });
    renderPipeline(PATH, ok(pipeline));

    expect(await screen.findByText(EMPTY_TEXT)).toBeDefined();
    expect(screen.queryByRole('button', BUTTON) !== null).toBe(hasButton);
    expect(screen.queryByRole('status') !== null).toBe(!hasButton);
  });

  it('EC-14 sin plazo, con botón y sin texto del plazo', async () => {
    renderPipeline(PATH, ok(PUBLISHED_PIPELINE));

    expect(await screen.findByRole('button', BUTTON)).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('EC-28 una cerrada con el plazo vencido no muestra el texto del plazo', async () => {
    renderPipeline(
      PATH,
      ok(withJob(CLOSED_PIPELINE, { ...EXPIRED_PIPELINE.job, status: 'closed' })),
    );

    expect(await screen.findAllByRole('region')).toHaveLength(6);
    expect(screen.queryByText(/El plazo de inscripción terminó/)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('EC-30 «Reintentar» tras un error mantiene el estado vencido: sin botón y con el texto', async () => {
    let attempts = 0;
    renderPipeline(PATH, {
      [KEY]: () =>
        ++attempts === 1
          ? { status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Fallo.' } } }
          : { status: 200, json: EXPIRED_PIPELINE },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect((await screen.findByText(EXPIRED_TEXT)).getAttribute('role')).toBe('status');
    expect(screen.queryByRole('button', BUTTON)).toBeNull();
    expect(attempts).toBe(2);
  });
});
