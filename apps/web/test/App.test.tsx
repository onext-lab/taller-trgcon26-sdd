import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { mockFetch } from './helpers/fetch.ts';

const HEALTH_OK = { 'GET /api/health': { status: 200, json: { status: 'ok' } } };
const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 20 };

// Same starting point as the browser: the route and the title of index.html.
function startAt(path: string): void {
  window.history.replaceState(null, '', path);
  document.title = 'ATS';
}

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('«/» redirige con replace a «/jobs» y muestra el listado', async () => {
    startAt('/');
    const historyLength = window.history.length;
    mockFetch({ ...HEALTH_OK, 'GET /api/jobs': { status: 200, json: EMPTY_PAGE } });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Ofertas' })).toBeDefined();
    expect(window.location.pathname).toBe('/jobs');
    expect(window.history.length).toBe(historyLength);
    expect(await screen.findByText('Todavía no hay ofertas.')).toBeDefined();
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Ofertas' }).getAttribute('aria-current')).toBe(
      'page',
    );
    // The redirect is part of the first load: focus and title do not move.
    expect(document.activeElement).not.toBe(screen.getByRole('main'));
    expect(document.title).toBe('ATS');
  });

  it('una ruta desconocida muestra «Página no encontrada» con el enlace «Ir a las ofertas»', async () => {
    startAt('/no-existe');
    mockFetch({ ...HEALTH_OK, 'GET /api/jobs': { status: 200, json: EMPTY_PAGE } });

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeDefined();
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(
      within(nav).getByRole('link', { name: 'Ofertas' }).getAttribute('aria-current'),
    ).toBeNull();
    const link = screen.getByRole('link', { name: 'Ir a las ofertas' });
    expect(link.getAttribute('href')).toBe('/jobs');

    fireEvent.click(link);

    expect(await screen.findByRole('heading', { name: 'Ofertas' })).toBeDefined();
    expect(window.location.pathname).toBe('/jobs');
    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(document.title).toBe('Ofertas · ATS');
  });

  it('muestra «Estado de la API: ok» en el pie', async () => {
    startAt('/no-existe');
    mockFetch(HEALTH_OK);

    render(<App />);

    const footer = screen.getByRole('contentinfo');
    expect(await within(footer).findByText('Estado de la API: ok')).toBeDefined();
    expect(within(screen.getByRole('banner')).getByText('ATS')).toBeDefined();
  });

  it('avisa en el pie de que no hay conexión cuando /api/health falla', async () => {
    startAt('/no-existe');
    mockFetch({ 'GET /api/health': { networkError: true } });

    render(<App />);

    const footer = screen.getByRole('contentinfo');
    expect(await within(footer).findByText('Estado de la API: sin conexión')).toBeDefined();
  });
});
