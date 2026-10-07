import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pipeline, PipelineItem } from '../../../src/features/applications/types.ts';
import { PUBLISHED_PIPELINE, renderPipeline } from './fixtures.ts';

const PIPELINE_URL = 'GET /api/jobs/7/applications';
const STAGE_NAMES = ['Recibida', 'Cribado', 'Entrevista', 'Oferta', 'Contratado', 'Rechazado'];

async function renderBoard(pipeline: Pipeline = PUBLISHED_PIPELINE): Promise<void> {
  renderPipeline('/jobs/7/pipeline', { [PIPELINE_URL]: { status: 200, json: pipeline } });
  await screen.findByRole('region', { name: 'Recibida' });
}

function region(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

function cardsOf(name: string): HTMLElement[] {
  return within(region(name)).queryAllByRole('listitem');
}

function withStage(stage: PipelineItem['stage'], lastChangeAt: string): Pipeline {
  const rejectionReason = stage === 'rejected' ? 'other' : null;
  const item: PipelineItem = {
    id: 1,
    candidateName: 'Ana Prueba',
    stage,
    lastChangeAt,
    rejectionReason,
  };
  return { job: { id: 7, status: 'published' }, items: [item] };
}

describe('PipelineScreen: columnas y tarjetas', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-12: 6 region en orden con sus nombres, bajo un h1 y con h2 por columna', async () => {
    await renderBoard();

    const regions = screen.getAllByRole('region');
    expect(regions).toHaveLength(6);
    // Each region is named by its h2 (`aria-labelledby`), in DOM order.
    const names = regions.map((section) => {
      const heading = document.getElementById(section.getAttribute('aria-labelledby') ?? '');
      expect(heading?.tagName).toBe('H2');
      return heading?.textContent;
    });
    expect(names).toEqual(STAGE_NAMES);
    for (const name of STAGE_NAMES) expect(region(name)).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Pipeline de la oferta' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Volver a la oferta' }).getAttribute('href')).toBe(
      '/jobs/7',
    );
  });

  it('CA-12: la tarjeta es un nombre en texto sin link, con fecha; el motivo solo en Rechazado', async () => {
    await renderBoard();

    const [first] = cardsOf('Recibida');
    expect(first?.textContent).toBe('Marina Ortega VidalÚltimo cambio: 06/10/2026');
    expect(within(first as HTMLElement).queryByRole('link')).toBeNull();
    expect(first?.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-06T10:00:00.000Z');
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Volver a la oferta',
    ]);
    const reasons = cardsOf('Rechazado').map((card) => card.textContent?.split('Motivo: ')[1]);
    expect(reasons).toEqual([
      'No encaja con el perfil',
      'Retirada del candidato',
      'Otro',
      'Oferta cerrada',
    ]);
    for (const name of STAGE_NAMES.slice(0, 5)) {
      for (const card of cardsOf(name)) expect(card.textContent).not.toContain('Motivo');
    }
  });

  it('CA-12: cada tarjeta va a su columna y se conserva el orden recibido', async () => {
    await renderBoard();

    const namesOf = (name: string) => cardsOf(name).map((c) => c.querySelector('p')?.textContent);
    expect(namesOf('Recibida')).toEqual(['Marina Ortega Vidal', 'Iván Soler Prats']);
    expect(namesOf('Cribado')).toEqual(['Nuria Casas Ferrer']);
    expect(namesOf('Entrevista')).toEqual(['Oriol Mas Puig']);
    expect(namesOf('Oferta')).toEqual(['Berta Lluch Roca']);
    expect(namesOf('Contratado')).toEqual(['Hugo Serra Camps']);
    expect(namesOf('Rechazado')).toEqual([
      'Lola Pons Arnau',
      'Jordi Vila Sala',
      'Carla Bosch Ruiz',
      'Pau Garcia Mir',
    ]);
  });

  it('CA-12: una columna sin tarjetas dice «Sin candidatos.» y no pinta lista', async () => {
    await renderBoard(withStage('screening', '2026-10-06T10:00:00.000Z'));

    expect(within(region('Recibida')).getByText('Sin candidatos.')).toBeDefined();
    expect(cardsOf('Recibida')).toHaveLength(0);
    expect(within(region('Cribado')).queryByText('Sin candidatos.')).toBeNull();
    expect(cardsOf('Cribado')).toHaveLength(1);
    expect(screen.getAllByText('Sin candidatos.')).toHaveLength(5);
  });

  it('EC-36: 2026-12-31T23:30:00.000Z se muestra como 01/01/2027 (Europe/Madrid)', async () => {
    await renderBoard(withStage('received', '2026-12-31T23:30:00.000Z'));

    const [card] = cardsOf('Recibida');
    expect(card?.querySelector('time')?.textContent).toBe('01/01/2027');
    expect(card?.querySelector('time')?.getAttribute('datetime')).toBe('2026-12-31T23:30:00.000Z');
  });

  it('EC-27: 200 tarjetas en una columna, todas pintadas y sin paginar', async () => {
    const items = Array.from({ length: 200 }, (_value, index): PipelineItem => ({
      id: 1000 - index,
      candidateName: `Candidata Inventada ${index + 1}`,
      stage: 'received',
      lastChangeAt: '2026-10-06T10:00:00.000Z',
      rejectionReason: null,
    }));
    await renderBoard({ job: { id: 7, status: 'published' }, items });

    const cards = cardsOf('Recibida');
    expect(cards).toHaveLength(200);
    expect(cards[0]?.querySelector('p')?.textContent).toBe('Candidata Inventada 1');
    expect(cards[199]?.querySelector('p')?.textContent).toBe('Candidata Inventada 200');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('EC-30: un elemento con email, phone o note de más no los pinta', async () => {
    const [base] = PUBLISHED_PIPELINE.items;
    const extra = {
      ...base,
      email: 'marina.ortega@example.com',
      phone: '+34 600 000 000',
      note: 'Nota interna inventada',
    };
    renderPipeline('/jobs/7/pipeline', {
      [PIPELINE_URL]: { status: 200, json: { job: PUBLISHED_PIPELINE.job, items: [extra] } },
    });
    await screen.findByRole('region', { name: 'Recibida' });

    const [card] = cardsOf('Recibida');
    expect(card?.textContent).toBe('Marina Ortega VidalÚltimo cambio: 06/10/2026');
    for (const leak of ['marina.ortega@example.com', '+34 600 000 000', 'Nota interna inventada']) {
      expect(screen.queryByText(leak, { exact: false })).toBeNull();
    }
  });
});
