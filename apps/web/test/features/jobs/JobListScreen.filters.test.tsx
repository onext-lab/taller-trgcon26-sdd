import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import { JobListScreen } from '../../../src/features/jobs/JobListScreen.tsx';
import type { JobListItem, JobPage } from '../../../src/features/jobs/types.ts';
import { mockFetch, type MockReply } from '../../helpers/fetch.ts';

// Invented data only.
function item(id: number, title: string, status: JobListItem['status'] = 'published'): JobListItem {
  return { id, title, status, referenceDate: '2026-10-01T09:00:00.000Z' };
}

function pageOf(items: JobListItem[], total = items.length, page = 1, pageSize = 20): MockReply {
  const body: JobPage = { items, total, page, pageSize };
  return { status: 200, json: body };
}

function manyItems(count: number): JobListItem[] {
  return Array.from({ length: count }, (_, index) =>
    item(index + 1, `Oferta inventada ${index + 1}`),
  );
}

function badRequest(details: Array<{ field: string; message: string }>): MockReply {
  return {
    status: 400,
    json: { error: { code: 'VALIDATION_ERROR', message: 'Parámetros no válidos.', details } },
  };
}

function open(url: string): void {
  window.history.replaceState(null, '', url);
}

function currentUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function titles(): string[] {
  const table = screen.getByRole('table', { name: 'Ofertas' });
  return within(table)
    .getAllByRole('link')
    .map((link) => link.textContent ?? '');
}

function field(name: string): HTMLInputElement {
  return screen.getByRole('searchbox', { name }) as HTMLInputElement;
}

function select(name: string): HTMLSelectElement {
  return screen.getByRole('combobox', { name }) as HTMLSelectElement;
}

function search(status: string, text: string): void {
  fireEvent.change(select('Estado'), { target: { value: status } });
  fireEvent.change(field('Buscar por título'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
}

describe('JobListScreen · filtros, paginación y estados', () => {
  beforeEach(() => {
    open('/jobs');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-16 Estado «Publicada» + «gestion» + «Buscar» navega y pide la URL con el filtro, en el orden recibido', async () => {
    const mock = mockFetch({
      'GET /api/jobs': pageOf(manyItems(2)),
      'GET /api/jobs?status=published&q=gestion': pageOf([
        item(9, 'GESTIÓN de proveedores'),
        item(3, 'Responsable de gestión de talento'),
      ]),
    });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });
    search('published', 'gestion');

    await waitFor(() =>
      expect(titles()).toEqual(['GESTIÓN de proveedores', 'Responsable de gestión de talento']),
    );
    expect(currentUrl()).toBe('/jobs?status=published&q=gestion');
    expect(mock.calls.map((call) => call.url)).toEqual([
      '/api/jobs',
      '/api/jobs?status=published&q=gestion',
    ]);
    expect(screen.getByRole('search', { name: 'Filtrar ofertas' })).toBeDefined();
  });

  it('los controles arrancan con los valores de la URL y el selector ofrece 20, 50 y 100', async () => {
    open('/jobs?status=closed&q=datos&pageSize=50');
    mockFetch({
      'GET /api/jobs?status=closed&q=datos&pageSize=50': pageOf(
        [item(1, 'Analista de datos', 'closed')],
        1,
        1,
        50,
      ),
    });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });

    expect(select('Estado').value).toBe('closed');
    expect(field('Buscar por título').value).toBe('datos');
    expect(select('Por página').value).toBe('50');
    expect(
      within(select('Por página'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['20', '50', '100']);
    expect(
      within(select('Estado'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Todos', 'Borrador', 'Publicada', 'Cerrada']);
  });

  it('CA-18 un tamaño válido de la URL que no se ofrece se añade delante en «Por página»', async () => {
    open('/jobs?pageSize=7');
    mockFetch({ 'GET /api/jobs?pageSize=7': pageOf(manyItems(3), 3, 1, 7) });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });

    const options = within(select('Por página')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['7', '20', '50', '100']);
    expect(select('Por página').value).toBe('7');
  });

  it('vacío con filtros muestra «Ninguna oferta cumple los filtros.» y «Quitar filtros» lleva a /jobs', async () => {
    open('/jobs?q=zzz');
    mockFetch({
      'GET /api/jobs?q=zzz': pageOf([]),
      'GET /api/jobs': pageOf(manyItems(2)),
    });

    render(<JobListScreen />);
    expect(await screen.findByText('Ninguna oferta cumple los filtros.')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Nueva oferta' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Quitar filtros' }));

    expect(await screen.findByRole('table', { name: 'Ofertas' })).toBeDefined();
    expect(currentUrl()).toBe('/jobs');
    expect(field('Buscar por título').value).toBe('');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Ofertas' }));
  });

  it('vacío sin filtros muestra «Todavía no hay ofertas.» y «Nueva oferta»', async () => {
    mockFetch({ 'GET /api/jobs': pageOf([]) });

    render(<JobListScreen />);

    expect(await screen.findByText('Todavía no hay ofertas.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Nueva oferta' }).getAttribute('href')).toBe(
      '/jobs/new',
    );
    expect(screen.queryByRole('link', { name: 'Quitar filtros' })).toBeNull();
  });

  it('CA-19 a CA-21 un 400 muestra el mensaje, un detalle por parámetro con su etiqueta y «Quitar filtros», sin «Reintentar»', async () => {
    open('/jobs?status=x&pageSize=101');
    mockFetch({
      'GET /api/jobs?status=x&pageSize=101': badRequest([
        { field: 'status', message: 'Debe ser uno de estos valores: draft, published, closed.' },
        { field: 'pageSize', message: 'Formato no válido.' },
      ]),
    });

    render(<JobListScreen />);

    expect((await screen.findByRole('alert')).textContent).toBe('Parámetros no válidos.');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Estado: Debe ser uno de estos valores: draft, published, closed.',
      'Por página: Formato no válido.',
    ]);
    expect(screen.getByRole('link', { name: 'Quitar filtros' }).getAttribute('href')).toBe('/jobs');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(select('Estado').value).toBe('');
  });

  it('EC-36 un fallo de red conserva los controles y ofrece «Reintentar»', async () => {
    mockFetch({
      'GET /api/jobs': pageOf(manyItems(2)),
      'GET /api/jobs?status=published&q=gestion': { networkError: true },
    });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });
    search('published', 'gestion');

    expect((await screen.findByRole('alert')).textContent).toBe(CONNECTION_MESSAGE);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
    expect(select('Estado').value).toBe('published');
    expect(field('Buscar por título').value).toBe('gestion');
    expect(screen.queryByRole('link', { name: 'Quitar filtros' })).toBeNull();
  });

  it('EC-33 una búsqueda de 101 caracteres no navega, muestra el error y enfoca el campo', async () => {
    const mock = mockFetch({ 'GET /api/jobs': pageOf(manyItems(2)) });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });
    search('', 'a'.repeat(101));

    const input = field('Buscar por título');
    expect(await screen.findByText('La búsqueda no puede pasar de 100 caracteres.')).toBeDefined();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('q-error');
    expect(document.getElementById('q-error')?.textContent).toBe(
      'La búsqueda no puede pasar de 100 caracteres.',
    );
    expect(document.activeElement).toBe(input);
    expect(currentUrl()).toBe('/jobs');
    expect(mock.calls).toHaveLength(1);
  });

  it('EC-34 una búsqueda de exactamente 100 caracteres se envía', async () => {
    const text = 'ñ'.repeat(100);
    mockFetch({
      'GET /api/jobs': pageOf(manyItems(2)),
      [`GET /api/jobs?q=${encodeURIComponent(text)}`]: pageOf([item(1, 'Oferta inventada 1')]),
    });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });
    search('', `  ${text}  `);

    await waitFor(() => expect(currentUrl()).toBe(`/jobs?q=${encodeURIComponent(text)}`));
    expect(await screen.findByRole('table', { name: 'Ofertas' })).toBeDefined();
    expect(screen.queryByText('La búsqueda no puede pasar de 100 caracteres.')).toBeNull();
  });

  it('una búsqueda con un carácter de control no navega y muestra su error', async () => {
    const mock = mockFetch({ 'GET /api/jobs': pageOf(manyItems(2)) });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });
    search('', 'ges\u0007tion');

    expect(
      await screen.findByText('La búsqueda no puede tener caracteres de control.'),
    ).toBeDefined();
    expect(mock.calls).toHaveLength(1);
  });

  it('EC-32 un parámetro desconocido se ignora y no viaja a la API', async () => {
    open('/jobs?sort=title');
    const mock = mockFetch({ 'GET /api/jobs': pageOf(manyItems(2)) });

    render(<JobListScreen />);

    expect(await screen.findByRole('table', { name: 'Ofertas' })).toBeDefined();
    expect(mock.calls.map((call) => call.url)).toEqual(['/api/jobs']);
  });

  it('«Atrás» del navegador resincroniza los controles con la URL', async () => {
    mockFetch({
      'GET /api/jobs': pageOf(manyItems(2)),
      'GET /api/jobs?status=published&q=gestion': pageOf([item(9, 'GESTIÓN de proveedores')]),
    });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });
    search('published', 'gestion');
    await screen.findByRole('link', { name: 'GESTIÓN de proveedores' });
    expect(select('Estado').value).toBe('published');

    act(() => {
      window.history.back();
    });

    await waitFor(() => expect(currentUrl()).toBe('/jobs'));
    await waitFor(() => expect(select('Estado').value).toBe(''));
    expect(field('Buscar por título').value).toBe('');
    expect(await screen.findAllByRole('link', { name: /Oferta inventada/ })).toHaveLength(2);
  });
});
