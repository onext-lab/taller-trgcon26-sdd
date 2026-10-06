import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import { JobDetailScreen } from '../../../src/features/jobs/JobDetailScreen.tsx';
import type { Job } from '../../../src/features/jobs/types.ts';
import { mockFetch } from '../../helpers/fetch.ts';

// Invented data only.
const FULL_JOB: Job = {
  id: 7,
  title: 'Desarrollador/a backend (Node.js)',
  description: 'Equipo pequeño.\nTrabajo con APIs.',
  location: 'Valencia',
  workMode: 'híbrida',
  salaryMin: 40000,
  salaryMax: 48000,
  status: 'draft',
  createdAt: '2026-10-06T22:30:00.000Z',
  publishedAt: null,
  closedAt: null,
};

const TITLE_ONLY: Job = {
  ...FULL_JOB,
  id: 8,
  title: 'Técnica/o de selección',
  description: null,
  location: null,
  workMode: null,
  salaryMin: null,
  salaryMax: null,
};

function visit(path: string): void {
  window.history.replaceState(null, '', path);
}

function envelope(code: string, message: string) {
  return { error: { code, message } };
}

function expectNotFoundScreen(): void {
  expect(screen.getByRole('heading', { level: 1, name: 'Oferta no encontrada' })).toBeDefined();
  const link = screen.getByRole('link', { name: 'Volver a las ofertas' });
  expect(link.getAttribute('href')).toBe('/jobs');
  expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull();
  expect(screen.queryByRole('definition')).toBeNull();
}

describe('JobDetailScreen', () => {
  beforeEach(() => {
    visit('/jobs/7');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra «Cargando la oferta…» mientras espera la respuesta', () => {
    mockFetch({ 'GET /api/jobs/7': { hang: true } });

    render(<JobDetailScreen />);

    expect(screen.getByRole('status').textContent).toBe('Cargando la oferta…');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('muestra la ficha completa con solo «Editar» y «Borrar» como acciones (CA-19)', async () => {
    mockFetch({ 'GET /api/jobs/7': { status: 200, json: FULL_JOB } });

    render(<JobDetailScreen />);

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Desarrollador/a backend (Node.js)');
    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    expect(terms).toEqual([
      'Estado',
      'Descripción',
      'Ubicación',
      'Modalidad',
      'Banda salarial',
      'Fecha de creación',
    ]);
    const values = screen.getAllByRole('definition').map((value) => value.textContent);
    expect(values).toEqual([
      'Borrador',
      'Equipo pequeño.\nTrabajo con APIs.',
      'Valencia',
      'Híbrida',
      '40.000 – 48.000 €/año',
      '07/10/2026',
    ]);
    const edit = screen.getByRole('link', { name: 'Editar' });
    expect(edit.getAttribute('href')).toBe('/jobs/7/edit');
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeDefined();
    const main = screen.getAllByRole('link').length + screen.getAllByRole('button').length;
    expect(main).toBe(2);
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.title).toBe('Desarrollador/a backend (Node.js) · ATS');
  });

  it('con solo el título muestra «Sin indicar» en el resto, sin «null» ni celdas vacías (EC-44)', async () => {
    visit('/jobs/8');
    mockFetch({ 'GET /api/jobs/8': { status: 200, json: TITLE_ONLY } });

    render(<JobDetailScreen />);

    await screen.findByRole('heading', { level: 1, name: 'Técnica/o de selección' });
    const values = screen.getAllByRole('definition').map((value) => value.textContent);
    expect(values).toEqual([
      'Borrador',
      'Sin indicar',
      'Sin indicar',
      'Sin indicar',
      'Sin indicar',
      '07/10/2026',
    ]);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('null');
    expect(text).not.toContain('undefined');
    for (const value of values) expect(value).not.toBe('');
  });

  it('un 404 de la API muestra «Oferta no encontrada» sin datos (CA-20)', async () => {
    mockFetch({
      'GET /api/jobs/7': { status: 404, json: envelope('NOT_FOUND', 'No existe esa oferta.') },
    });

    render(<JobDetailScreen />);

    await screen.findByRole('heading', { level: 1, name: 'Oferta no encontrada' });
    expectNotFoundScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.title).toBe('Oferta no encontrada · ATS');
  });

  it('un 400 de la API se trata como oferta no encontrada (EC-43)', async () => {
    mockFetch({
      'GET /api/jobs/7': { status: 400, json: envelope('VALIDATION_ERROR', 'ID no válido.') },
    });

    render(<JobDetailScreen />);

    await screen.findByRole('heading', { level: 1, name: 'Oferta no encontrada' });
    expectNotFoundScreen();
  });

  it.each(['/jobs/abc', '/jobs/1.5'])(
    '%s muestra «Oferta no encontrada» sin llamar a la API (EC-27)',
    (path) => {
      visit(path);
      const mock = mockFetch({});

      render(<JobDetailScreen />);

      expectNotFoundScreen();
      expect(mock.calls).toEqual([]);
    },
  );

  it('con error de red muestra la alerta sin datos y «Reintentar» vuelve a pedir (EC-45)', async () => {
    let attempt = 0;
    const mock = mockFetch({
      'GET /api/jobs/7': () => {
        attempt += 1;
        return attempt === 1 ? { networkError: true } : { status: 200, json: FULL_JOB };
      },
    });

    render(<JobDetailScreen />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(CONNECTION_MESSAGE);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('definition')).toBeNull();

    fireEvent.click(
      within(alert.parentElement as HTMLElement).getByRole('button', { name: 'Reintentar' }),
    );

    await screen.findByRole('heading', { level: 1, name: 'Desarrollador/a backend (Node.js)' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mock.calls).toHaveLength(2);
  });

  it('un 500 con envelope muestra su mensaje en la alerta y sin datos (EC-45)', async () => {
    mockFetch({
      'GET /api/jobs/7': {
        status: 500,
        json: envelope('INTERNAL_ERROR', 'Error interno. Inténtalo de nuevo.'),
      },
    });

    render(<JobDetailScreen />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
    expect(screen.queryByRole('definition')).toBeNull();
  });

  it('muestra el aviso de llegada «Oferta creada.»', async () => {
    window.history.replaceState({ notice: 'Oferta creada.' }, '', '/jobs/7');
    mockFetch({ 'GET /api/jobs/7': { status: 200, json: FULL_JOB } });

    render(<JobDetailScreen />);

    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('status').textContent).toBe('Oferta creada.');
  });
});
