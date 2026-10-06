import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import { JobListScreen } from '../../../src/features/jobs/JobListScreen.tsx';
import type { JobListItem, JobPage } from '../../../src/features/jobs/types.ts';
import { mockFetch, type MockReply } from '../../helpers/fetch.ts';

// Invented data only. Hostile and failure cases of the list (EC-32, EC-33, EC-36).
function item(id: number, title: string): JobListItem {
  return { id, title, status: 'published', referenceDate: '2026-10-01T09:00:00.000Z' };
}

function pageOf(items: JobListItem[]): MockReply {
  const body: JobPage = { items, total: items.length, page: 1, pageSize: 20 };
  return { status: 200, json: body };
}

const TWO = [item(1, 'Oferta inventada 1'), item(2, 'Oferta inventada 2')];

function open(url: string): void {
  window.history.replaceState(null, '', url);
}

function currentUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function field(): HTMLInputElement {
  return screen.getByRole('searchbox', { name: 'Buscar por título' }) as HTMLInputElement;
}

function select(name: string): HTMLSelectElement {
  return screen.getByRole('combobox', { name }) as HTMLSelectElement;
}

function submit(text: string, status = ''): void {
  fireEvent.change(select('Estado'), { target: { value: status } });
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
}

describe('JobListScreen · adversarial', () => {
  beforeEach(() => {
    open('/jobs');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('EC-32 URL manipulada: sort=title → listado normal y la petición sale sin sort', async () => {
    open('/jobs?sort=title&Status=draft&extra=1');
    const mock = mockFetch({ 'GET /api/jobs': pageOf(TWO) });

    render(<JobListScreen />);

    expect(await screen.findByRole('table', { name: 'Ofertas' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mock.calls.map((call) => call.url)).toEqual(['/api/jobs']);
    expect(mock.unmatched).toEqual([]);
  });

  it('EC-32 URL manipulada: pageSize=abc → alerta con «Por página: …» y «Quitar filtros» a /jobs, sin «Reintentar»', async () => {
    open('/jobs?pageSize=abc');
    mockFetch({
      'GET /api/jobs?pageSize=abc': {
        status: 400,
        json: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parámetros no válidos.',
            details: [{ field: 'pageSize', message: 'Debe ser un entero.' }],
          },
        },
      },
      'GET /api/jobs': pageOf(TWO),
    });

    render(<JobListScreen />);

    expect((await screen.findByRole('alert')).textContent).toBe('Parámetros no válidos.');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Por página: Debe ser un entero.',
    ]);
    const clear = screen.getByRole('link', { name: 'Quitar filtros' });
    expect(clear.getAttribute('href')).toBe('/jobs');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();

    fireEvent.click(clear);

    expect(await screen.findByRole('table', { name: 'Ofertas' })).toBeDefined();
    expect(currentUrl()).toBe('/jobs');
  });

  it('EC-33 un tabulador pegado en la búsqueda → error junto al campo, aria-invalid, foco y sin navegar ni pedir', async () => {
    const mock = mockFetch({ 'GET /api/jobs': pageOf(TWO) });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });
    submit('ges\ttion');

    const message = 'La búsqueda no puede tener caracteres de control.';
    expect(await screen.findByText(message)).toBeDefined();
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(
      document.getElementById(field().getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe(message);
    expect(document.activeElement).toBe(field());
    expect(currentUrl()).toBe('/jobs');
    expect(mock.calls).toHaveLength(1);
  });

  it('EC-33 101 caracteres → «La búsqueda no puede pasar de 100 caracteres.» sin navegar ni pedir', async () => {
    const mock = mockFetch({ 'GET /api/jobs': pageOf(TWO) });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });
    submit('a'.repeat(101));

    expect(await screen.findByText('La búsqueda no puede pasar de 100 caracteres.')).toBeDefined();
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field());
    expect(currentUrl()).toBe('/jobs');
    expect(mock.calls).toHaveLength(1);
  });

  it('EC-33 corregido el texto, el error desaparece y la búsqueda se envía', async () => {
    mockFetch({
      'GET /api/jobs': pageOf(TWO),
      'GET /api/jobs?q=gestion': pageOf([item(9, 'Gestión de proveedores')]),
    });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });
    submit('ges\ttion');
    await screen.findByText('La búsqueda no puede tener caracteres de control.');
    submit('gestion');

    await waitFor(() => expect(currentUrl()).toBe('/jobs?q=gestion'));
    await screen.findByRole('link', { name: 'Gestión de proveedores' });
    expect(screen.queryByText('La búsqueda no puede tener caracteres de control.')).toBeNull();
    expect(field().getAttribute('aria-invalid')).not.toBe('true');
  });

  it('EC-36 API caída al filtrar → alerta y «Reintentar»; Estado y texto conservan lo elegido y reintentar recupera', async () => {
    let attempts = 0;
    mockFetch({
      'GET /api/jobs': pageOf(TWO),
      'GET /api/jobs?status=closed&q=datos': () =>
        ++attempts === 1 ? { networkError: true } : pageOf([item(5, 'Analista de datos')]),
    });

    render(<JobListScreen />);
    await screen.findByRole('table', { name: 'Ofertas' });
    submit('datos', 'closed');

    expect((await screen.findByRole('alert')).textContent).toBe(CONNECTION_MESSAGE);
    expect(select('Estado').value).toBe('closed');
    expect(field().value).toBe('datos');
    expect(currentUrl()).toBe('/jobs?status=closed&q=datos');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    const table = await screen.findByRole('table', { name: 'Ofertas' });
    expect(within(table).getByRole('link', { name: 'Analista de datos' })).toBeDefined();
    expect(select('Estado').value).toBe('closed');
    expect(field().value).toBe('datos');
  });
});
