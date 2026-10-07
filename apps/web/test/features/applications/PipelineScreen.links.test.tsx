import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pipeline } from '../../../src/features/applications/types.ts';
import type { MockReply } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import { PAGE, envelope, ok } from './enroll-fixtures.ts';
import { CLOSED_PIPELINE, PUBLISHED_PIPELINE, renderPipeline } from './fixtures.ts';

const PIPELINE = 'GET /api/jobs/7/applications';
const SEARCH = 'GET /api/candidates?q=ana&pageSize=10';
const POST = 'POST /api/applications';
const FIELD = 'Nombre o email';
const DUPLICATE_TEXT = 'Este candidato ya está inscrito en la oferta.';
const EMPTY_TEXT = 'Todavía no hay candidatos inscritos en esta oferta.';

const CLOSED_INTERVIEW: Pipeline = {
  job: CLOSED_PIPELINE.job,
  items: [
    {
      id: 41,
      candidateName: 'Marta Vidal Prat',
      stage: 'interview',
      lastChangeAt: '2026-10-04T08:00:00.000Z',
      rejectionReason: null,
    },
  ],
};

function duplicateWith(details: unknown): MockReply {
  const error = { code: 'DUPLICATE', message: 'Ya inscrito.', details };
  return { status: 409, json: { error } };
}

/** Opens the panel, searches «ana» and enrolls the second result with the given `POST` reply. */
async function enrollWith(post: MockReply): Promise<HTMLElement> {
  renderPipeline('/jobs/7/pipeline', {
    [PIPELINE]: ok(PUBLISHED_PIPELINE),
    [SEARCH]: ok(PAGE),
    [POST]: post,
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Inscribir candidato' }));
  await expectFocusOn(() => screen.getByLabelText(FIELD));
  fireEvent.change(screen.getByLabelText(FIELD), { target: { value: 'ana' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  const table = await screen.findByRole('table', { name: 'Resultados de la búsqueda' });
  fireEvent.click(within(table).getAllByRole('button')[1] as HTMLElement);
  return screen.getByRole('region', { name: 'Inscribir candidato' });
}

describe('PipelineScreen: enlaces al detalle de la inscripción', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    ['published', PUBLISHED_PIPELINE],
    ['closed', CLOSED_PIPELINE],
  ])(
    'CA-22 el nombre de cada tarjeta es un link a /applications/{id} en %s',
    async (_status, pipeline) => {
      renderPipeline('/jobs/7/pipeline', { [PIPELINE]: ok(pipeline) });
      await screen.findByRole('region', { name: 'Recibida' });

      for (const { id, candidateName } of pipeline.items) {
        const link = screen.getByRole('link', { name: candidateName });
        expect(link.getAttribute('href')).toBe(`/applications/${id}`);
        expect(link.closest('li')?.querySelector('p')?.textContent).toBe(candidateName);
      }
    },
  );

  it('CA-36 409 DUPLICATE con existingId → Ver la inscripción a /applications/91; el texto de la alerta no cambia', async () => {
    const panel = await enrollWith(
      duplicateWith([{ field: 'candidateId', message: 'Ya inscrito.', existingId: 91 }]),
    );

    const alert = await within(panel).findByRole('alert');
    expect(alert.textContent).toBe(DUPLICATE_TEXT);
    const link = within(panel).getByRole('link', { name: 'Ver la inscripción' });
    expect(link.getAttribute('href')).toBe('/applications/91');
    expect(alert.contains(link)).toBe(false);
    await expectFocusOn(() => within(panel).getByRole('alert'));
  });

  it.each([
    ['sin details', undefined],
    ['con details sin existingId', [{ field: 'candidateId', message: 'Ya inscrito.' }]],
    ['con un existingId no válido', [{ field: 'candidateId', message: 'x', existingId: -3 }]],
  ])('EC-43 409 DUPLICATE %s → sin enlace', async (_name, details) => {
    const panel = await enrollWith(
      details === undefined ? envelope(409, 'DUPLICATE', 'Ya inscrito.') : duplicateWith(details),
    );

    expect((await within(panel).findByRole('alert')).textContent).toBe(DUPLICATE_TEXT);
    expect(within(panel).queryByRole('link')).toBeNull();
  });

  it('CA-23/EC-49 closed con una tarjeta en interview: sin Avanzar, Rechazar ni Inscribir candidato, nombres enlazados', async () => {
    renderPipeline('/jobs/7/pipeline', { [PIPELINE]: ok(CLOSED_INTERVIEW) });
    await screen.findByRole('region', { name: 'Entrevista' });

    expect(screen.getByRole('link', { name: 'Marta Vidal Prat' }).getAttribute('href')).toBe(
      '/applications/41',
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    for (const name of [/Avanzar/, /Rechazar/, /Inscribir candidato/]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('EC-47 closed vacía: mensaje de vacío y ningún botón', async () => {
    renderPipeline('/jobs/7/pipeline', {
      [PIPELINE]: ok({ job: CLOSED_PIPELINE.job, items: [] }),
    });

    expect(await screen.findByText(EMPTY_TEXT)).toBeDefined();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
