import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import { JobListScreen } from '../../../src/features/jobs/JobListScreen.tsx';
import type { JobListItem, JobPage } from '../../../src/features/jobs/types.ts';
import { mockFetch, type MockReply } from '../../helpers/fetch.ts';

// Invented data only.
function item(id: number, title: string, referenceDate = '2026-10-01T09:00:00.000Z'): JobListItem {
  return { id, title, status: 'draft', referenceDate };
}

function page(items: JobListItem[], total = items.length): JobPage {
  return { items, total, page: 1, pageSize: 20 };
}

function manyItems(count: number): JobListItem[] {
  return Array.from({ length: count }, (_, index) =>
    item(index + 1, `Oferta inventada ${index + 1}`),
  );
}

function ok(body: JobPage): MockReply {
  return { status: 200, json: body };
}

function bodyRows(): HTMLElement[] {
  const table = screen.getByRole('table', { name: 'Ofertas' });
  const [, body] = within(table).getAllByRole('rowgroup');
  if (body === undefined) throw new Error('La tabla no tiene tbody');
  return within(body).getAllByRole('row');
}

describe('JobListScreen', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra «Cargando ofertas…» mientras espera la respuesta', () => {
    mockFetch({ 'GET /api/jobs': { hang: true } });

    render(<JobListScreen />);

    expect(screen.getByRole('heading', { name: 'Ofertas' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Cargando ofertas…');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('sin ofertas muestra el estado vacío con el enlace «Nueva oferta» (CA-17, EC-28)', async () => {
    mockFetch({ 'GET /api/jobs': ok(page([])) });

    render(<JobListScreen />);

    expect(await screen.findByText('Todavía no hay ofertas.')).toBeDefined();
    const link = screen.getByRole('link', { name: 'Nueva oferta' });
    expect(link.getAttribute('href')).toBe('/jobs/new');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('con error muestra la alerta sin tabla y «Reintentar» vuelve a pedir y pinta (CA-18, EC-38)', async () => {
    let attempt = 0;
    const mock = mockFetch({
      'GET /api/jobs': () => {
        attempt += 1;
        return attempt === 1
          ? { networkError: true }
          : ok(page([item(1, 'Técnica/o de selección')]));
      },
    });

    render(<JobListScreen />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(CONNECTION_MESSAGE);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryAllByRole('row')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('table', { name: 'Ofertas' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Técnica/o de selección' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mock.calls).toHaveLength(2);
  });

  it('un 500 con envelope muestra su mensaje y ninguna fila (EC-38)', async () => {
    mockFetch({
      'GET /api/jobs': {
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' } },
      },
    });

    render(<JobListScreen />);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Error interno. Inténtalo de nuevo.',
    );
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('con 20 ofertas pinta 20 filas y ningún aviso (CA-15, EC-35)', async () => {
    mockFetch({ 'GET /api/jobs': ok(page(manyItems(20), 20)) });

    render(<JobListScreen />);

    await screen.findByRole('table', { name: 'Ofertas' });
    expect(bodyRows()).toHaveLength(20);
    expect(screen.queryByText(/Se muestran las/)).toBeNull();
  });

  it('con 21 ofertas pinta 20 filas y avisa del total (CA-15, EC-35)', async () => {
    mockFetch({ 'GET /api/jobs': ok(page(manyItems(20), 21)) });

    render(<JobListScreen />);

    await screen.findByRole('table', { name: 'Ofertas' });
    expect(bodyRows()).toHaveLength(20);
    expect(screen.getByText('Se muestran las 20 más recientes de 21.')).toBeDefined();
  });

  it('muestra título enlazado a la ficha, «Borrador» y la fecha en Europe/Madrid (CA-16, EC-36)', async () => {
    mockFetch({
      'GET /api/jobs': ok(
        page([item(7, 'Desarrollador/a backend (Node.js)', '2026-10-06T22:30:00.000Z')]),
      ),
    });

    render(<JobListScreen />);

    const link = await screen.findByRole('link', { name: 'Desarrollador/a backend (Node.js)' });
    expect(link.getAttribute('href')).toBe('/jobs/7');
    const cells = within(bodyRows()[0] as HTMLElement).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'Desarrollador/a backend (Node.js)',
      'Borrador',
      '07/10/2026',
    ]);
    const time = screen.getByText('07/10/2026');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('datetime')).toBe('2026-10-06T22:30:00.000Z');
    expect(screen.getByRole('link', { name: 'Nueva oferta' }).getAttribute('href')).toBe(
      '/jobs/new',
    );
  });

  it('pinta las filas en el orden recibido, sin reordenar (EC-37)', async () => {
    const received = [
      item(3, 'Técnica/o de selección', '2026-09-01T08:00:00.000Z'),
      item(9, 'Desarrollador/a backend (Node.js)', '2026-10-05T08:00:00.000Z'),
      item(1, 'Analista de datos', '2026-09-20T08:00:00.000Z'),
    ];
    mockFetch({ 'GET /api/jobs': ok(page(received)) });

    render(<JobListScreen />);

    await screen.findByRole('table', { name: 'Ofertas' });
    expect(bodyRows().map((row) => within(row).getByRole('link').textContent)).toEqual([
      'Técnica/o de selección',
      'Desarrollador/a backend (Node.js)',
      'Analista de datos',
    ]);
  });

  it('muestra el aviso que llega en history.state', async () => {
    window.history.replaceState({ notice: 'Oferta borrada.' }, '', '/jobs');
    mockFetch({ 'GET /api/jobs': ok(page([])) });

    render(<JobListScreen />);

    await screen.findByText('Todavía no hay ofertas.');
    expect(screen.getByRole('status').textContent).toBe('Oferta borrada.');
  });
});
