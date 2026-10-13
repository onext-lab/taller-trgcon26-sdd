import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pipeline } from '../../../src/features/applications/types.ts';
import type { FetchMock } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import { PAGE, envelope, ok as okReply, sequence, type Reply } from './enroll-fixtures.ts';
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

const SEARCH = 'GET /api/candidates?q=ana&pageSize=10';
const POST = 'POST /api/applications';
const FIELD = 'Nombre o email';
const LATE_MESSAGE = 'El plazo de inscripción de esta oferta terminó el 13/10/2026.';
const LOADING_TEXT = 'Cargando el pipeline…';
const LATE_REPLY = envelope(409, 'ENROLLMENT_DEADLINE_PASSED', LATE_MESSAGE);
const OLD_PAGE_EXPIRED = withJob(PUBLISHED_PIPELINE, {
  enrollmentDeadline: '2026-10-13',
  enrollmentDeadlinePassed: true,
});

// The page was loaded before midnight: the first GET still offers «Inscribir candidato»; `reloads` follow.
async function enrollOnOldPage(...reloads: Reply[]): Promise<FetchMock> {
  const mock = renderPipeline(PATH, {
    [KEY]: sequence(okReply(PUBLISHED_PIPELINE), ...reloads),
    [SEARCH]: okReply(PAGE),
    [POST]: LATE_REPLY,
  });
  fireEvent.click(await screen.findByRole('button', BUTTON));
  await expectFocusOn(() => screen.getByLabelText(FIELD));
  fireEvent.change(screen.getByLabelText(FIELD), { target: { value: 'ana' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  const table = await screen.findByRole('table', { name: 'Resultados de la búsqueda' });
  fireEvent.click(within(table).getAllByRole('button')[1] as HTMLElement);
  return mock;
}

function pipelineGets(mock: FetchMock): number {
  return mock.calls.filter((call) => call.url === '/api/jobs/7/applications').length;
}

describe('PipelineScreen: 409 ENROLLMENT_DEADLINE_PASSED · adversarial', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-10 pipeline viejo: el 409 cierra el panel, alerta con el mensaje y foco, y la recarga quita el botón', async () => {
    const mock = await enrollOnOldPage(okReply(OLD_PAGE_EXPIRED));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(LATE_MESSAGE);
    await expectFocusOn(() => screen.getByRole('alert'));
    expect(screen.queryByRole('region', BUTTON)).toBeNull();
    await waitFor(() => expect(screen.queryByRole('button', BUTTON)).toBeNull());
    expect(screen.getByRole('status').textContent).toBe(
      'El plazo de inscripción terminó el 13/10/2026: no se pueden inscribir más candidatos.',
    );
    expect(pipelineGets(mock)).toBe(2);
    expect(screen.queryByText(LOADING_TEXT)).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe(LATE_MESSAGE);
  });

  it('EC-26 el 409 con la recarga en 500: alerta y error con «Reintentar»', async () => {
    const failing = envelope(500, 'INTERNAL_ERROR', 'Error interno. Inténtalo de nuevo.');
    await enrollOnOldPage(failing);

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeDefined();
    const texts = screen.getAllByRole('alert').map((alert) => alert.textContent);
    expect(texts).toHaveLength(2);
    expect(texts).toContain(LATE_MESSAGE);
    expect(texts).toContain('Error interno. Inténtalo de nuevo.');
    expect(screen.queryByRole('button', BUTTON)).toBeNull();
  });

  it('EC-15 la alerta del 409 no añade el nombre del candidato', async () => {
    await enrollOnOldPage(okReply(OLD_PAGE_EXPIRED));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(LATE_MESSAGE);
    expect(alert.textContent).not.toMatch(/Candidata Inventada|example\.com/);
  });
});
