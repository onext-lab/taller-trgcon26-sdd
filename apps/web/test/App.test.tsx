import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { mockFetch } from './helpers/fetch.ts';
import { expectFocusOn } from './helpers/focus.ts';

const HEALTH_OK = { 'GET /api/health': { status: 200, json: { status: 'ok' } } };
const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 20 };
const JOB = {
  description: 'Gestión de procesos de selección.',
  location: 'Valencia',
  workMode: 'híbrida',
  salaryMin: 30000,
  salaryMax: 36000,
  createdAt: '2026-09-30T09:00:00.000Z',
  publishedAt: '2026-10-01T09:00:00.000Z',
  closedAt: null,
};

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
    await waitFor(() => expect(document.title).toBe('Ofertas · ATS'));
  });

  it('«Candidatos» en «Principal» lleva a /candidates con aria-current, título y foco en <main>', async () => {
    startAt('/jobs');
    mockFetch({
      ...HEALTH_OK,
      'GET /api/jobs': { status: 200, json: EMPTY_PAGE },
      'GET /api/candidates': { status: 200, json: EMPTY_PAGE },
    });

    render(<App />);
    await screen.findByText('Todavía no hay ofertas.');
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const link = within(nav).getByRole('link', { name: 'Candidatos' });
    expect(link.getAttribute('aria-current')).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Ofertas' }).getAttribute('aria-current')).toBe(
      'page',
    );
    fireEvent.click(link);

    expect(await screen.findByRole('heading', { level: 1, name: 'Candidatos' })).toBeDefined();
    expect(await screen.findByText('Todavía no hay candidatos.')).toBeDefined();
    expect(window.location.pathname).toBe('/candidates');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(
      within(nav).getByRole('link', { name: 'Ofertas' }).getAttribute('aria-current'),
    ).toBeNull();
    await waitFor(() => expect(document.title).toBe('Candidatos · ATS'));
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('la carga directa de /candidates fija el título «Candidatos · ATS» y marca el enlace', async () => {
    startAt('/candidates');
    mockFetch({ ...HEALTH_OK, 'GET /api/candidates': { status: 200, json: EMPTY_PAGE } });

    render(<App />);

    expect(await screen.findByText('Todavía no hay candidatos.')).toBeDefined();
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Candidatos' }).getAttribute('aria-current')).toBe(
      'page',
    );
    await waitFor(() => expect(document.title).toBe('Candidatos · ATS'));
  });

  it('RF-07/EC-39: «Ver pipeline» desde la ficha abre /jobs/7/pipeline con su título y el foco en <main>', async () => {
    startAt('/jobs/7');
    const job = { id: 7, title: 'Técnica/o de selección', status: 'published' };
    const mock = mockFetch({
      ...HEALTH_OK,
      'GET /api/jobs/7': { status: 200, json: { ...JOB, ...job } },
      'GET /api/jobs/7/applications': {
        status: 200,
        json: { job: { id: 7, status: 'published' }, items: [] },
      },
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Ver pipeline' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pipeline de la oferta' }),
    ).toBeDefined();
    expect(
      await screen.findByText('Todavía no hay candidatos inscritos en esta oferta.'),
    ).toBeDefined();
    expect(window.location.pathname).toBe('/jobs/7/pipeline');
    await waitFor(() => expect(document.title).toBe('Pipeline de la oferta · ATS'));
    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(mock.calls.filter((call) => call.url.endsWith('/applications'))).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Volver a la oferta' }).getAttribute('href')).toBe(
      '/jobs/7',
    );
  });

  it('EC-35/EC-39: /jobs/abc/pipeline muestra «Página no encontrada» sin petición y con el título del pipeline', async () => {
    startAt('/jobs/abc/pipeline');
    const mock = mockFetch(HEALTH_OK);

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Ir a las ofertas' }).getAttribute('href')).toBe(
      '/jobs',
    );
    await waitFor(() => expect(document.title).toBe('Pipeline de la oferta · ATS'));
    expect(window.location.pathname).toBe('/jobs/abc/pipeline');
    await within(screen.getByRole('contentinfo')).findByText('Estado de la API: ok');
    expect(mock.calls.map((call) => call.url)).toEqual(['/api/health']);
  });

  it('RF-07: /applications/32 desde una tarjeta abre el detalle con título «Inscripción · ATS» y el foco en <main>', async () => {
    startAt('/jobs/7/pipeline');
    const item = {
      id: 32,
      candidateName: 'Oriol Mas Puig',
      stage: 'received',
      lastChangeAt: '2026-10-01T08:00:00.000Z',
      rejectionReason: null,
    };
    const detail = {
      id: 32,
      stage: 'received',
      createdAt: '2026-10-01T08:00:00.000Z',
      lastChangeAt: '2026-10-01T08:00:00.000Z',
      candidate: { id: 12, fullName: 'Oriol Mas Puig' },
      job: { id: 7, title: 'Técnica/o de selección', status: 'published' },
      history: [
        {
          fromStage: null,
          toStage: 'received',
          changedAt: '2026-10-01T08:00:00.000Z',
          reason: null,
          note: null,
        },
      ],
    };
    const mock = mockFetch({
      ...HEALTH_OK,
      'GET /api/jobs/7/applications': {
        status: 200,
        json: { job: { id: 7, status: 'published' }, items: [item] },
      },
      'GET /api/applications/32': { status: 200, json: detail },
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Oriol Mas Puig' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Historial' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Inscripción' })).toBeDefined();
    expect(window.location.pathname).toBe('/applications/32');
    await waitFor(() => expect(document.title).toBe('Inscripción · ATS'));
    await expectFocusOn(() => screen.getByRole('main'));
    expect(mock.calls.filter((call) => call.url === '/api/applications/32')).toHaveLength(1);
  });

  it('EC-42: /applications/abc muestra «Página no encontrada» sin petición y con el título «Inscripción · ATS»', async () => {
    startAt('/applications/abc');
    const mock = mockFetch(HEALTH_OK);

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeDefined();
    await waitFor(() => expect(document.title).toBe('Inscripción · ATS'));
    expect(window.location.pathname).toBe('/applications/abc');
    await within(screen.getByRole('contentinfo')).findByText('Estado de la API: ok');
    expect(mock.calls.map((call) => call.url)).toEqual(['/api/health']);
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
