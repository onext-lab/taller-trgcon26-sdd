import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobListScreen } from '../../../src/features/jobs/JobListScreen.tsx';
import type { JobListItem, JobPage } from '../../../src/features/jobs/types.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import { mockFetch, type MockReply } from '../../helpers/fetch.ts';

// Invented data only.
function item(id: number, title: string): JobListItem {
  return { id, title, status: 'published', referenceDate: '2026-10-01T09:00:00.000Z' };
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

function open(url: string): void {
  window.history.replaceState(null, '', url);
}

function currentUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function select(name: string): HTMLSelectElement {
  return screen.getByRole('combobox', { name }) as HTMLSelectElement;
}

describe('JobListScreen · paginación', () => {
  beforeEach(() => {
    open('/jobs');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-18 «Siguiente» navega a page=2 y, al terminar la carga, el foco va al h1 «Ofertas»', async () => {
    open('/jobs?status=published');
    mockFetch({
      'GET /api/jobs?status=published': pageOf(manyItems(20), 25),
      'GET /api/jobs?status=published&page=2': pageOf(manyItems(5), 25, 2),
    });

    render(<JobListScreen />);
    await screen.findByText('Página 1 de 2 (25 ofertas)');
    expect(screen.queryByRole('link', { name: 'Anterior' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Siguiente' }));

    expect(await screen.findByText('Página 2 de 2 (25 ofertas)')).toBeDefined();
    expect(currentUrl()).toBe('/jobs?status=published&page=2');
    await expectFocusOn(() => screen.getByRole('heading', { name: 'Ofertas' }));
    expect(screen.queryByRole('link', { name: 'Siguiente' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Anterior' }).getAttribute('href')).toBe(
      '/jobs?status=published',
    );
  });

  it('CA-18 «Por página» 50 navega a la página 1 con el mismo filtro', async () => {
    open('/jobs?status=published&page=2');
    mockFetch({
      'GET /api/jobs?status=published&page=2': pageOf(manyItems(5), 25, 2),
      'GET /api/jobs?status=published&pageSize=50': pageOf(manyItems(25), 25, 1, 50),
    });

    render(<JobListScreen />);
    await screen.findByText('Página 2 de 2 (25 ofertas)');
    fireEvent.change(select('Por página'), { target: { value: '50' } });

    expect(await screen.findByText('Página 1 de 1 (25 ofertas)')).toBeDefined();
    expect(currentUrl()).toBe('/jobs?status=published&pageSize=50');
    expect(select('Por página').value).toBe('50');
  });

  it('con una sola oferta dice «(1 oferta)» en singular (EC-34)', async () => {
    mockFetch({ 'GET /api/jobs': pageOf(manyItems(1), 1) });

    render(<JobListScreen />);

    expect(await screen.findByText('Página 1 de 1 (1 oferta)')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Siguiente' })).toBeNull();
  });

  it('EC-34 con 20 de 20 no hay «Siguiente» y con 21 hay «Página 1 de 2» y «Siguiente»', async () => {
    mockFetch({ 'GET /api/jobs': pageOf(manyItems(20), 20) });
    const first = render(<JobListScreen />);
    await screen.findByText('Página 1 de 1 (20 ofertas)');
    expect(screen.queryByRole('link', { name: 'Siguiente' })).toBeNull();
    first.unmount();

    mockFetch({ 'GET /api/jobs': pageOf(manyItems(20), 21) });
    render(<JobListScreen />);
    await screen.findByText('Página 1 de 2 (21 ofertas)');
    expect(screen.getByRole('link', { name: 'Siguiente' })).toBeDefined();
  });

  it('CA-17 una página más allá de la última muestra el aviso y «Ir a la primera página» con los mismos filtros', async () => {
    open('/jobs?status=draft&page=9&pageSize=50');
    mockFetch({
      'GET /api/jobs?status=draft&page=9&pageSize=50': pageOf([], 4, 9, 50),
      'GET /api/jobs?status=draft&pageSize=50': pageOf(manyItems(4), 4, 1, 50),
    });

    render(<JobListScreen />);

    expect(await screen.findByText('Esta página no tiene ofertas.')).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
    const link = screen.getByRole('link', { name: 'Ir a la primera página' });
    expect(link.getAttribute('href')).toBe('/jobs?status=draft&pageSize=50');
    fireEvent.click(link);

    expect(await screen.findByRole('table', { name: 'Ofertas' })).toBeDefined();
    await expectFocusOn(() => screen.getByRole('heading', { name: 'Ofertas' }));
  });
});
