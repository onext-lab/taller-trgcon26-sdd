import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App.tsx';
import { mockFetch, type FetchMock, type MockRoute } from '../../helpers/fetch.ts';

// Invented data only.
const JOB = {
  id: 7,
  title: 'Desarrollador/a backend (Node.js)',
  description: 'Busca talento.',
  location: 'Valencia',
  workMode: 'híbrida',
  salaryMin: 32000,
  salaryMax: 40000,
  status: 'draft',
  createdAt: '2026-10-06T09:30:00.000Z',
  publishedAt: null,
  closedAt: null,
};
const GET_JOB: MockRoute = { status: 200, json: JOB };
const HEALTH: MockRoute = { status: 200, json: { status: 'ok' } };
const INTERNAL: MockRoute = {
  status: 500,
  json: { error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' } },
};

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function save(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function errorOf(label: string): string | null {
  const id = field(label).getAttribute('aria-describedby');
  return id ? (document.getElementById(id)?.textContent ?? null) : null;
}

async function openEditor(routes: Record<string, MockRoute>): Promise<FetchMock> {
  const mock = mockFetch({ 'GET /api/health': HEALTH, 'GET /api/jobs/7': GET_JOB, ...routes });
  render(<App />);
  await screen.findByRole('heading', { name: 'Editar oferta' });
  return mock;
}

function patchBodies(mock: FetchMock): unknown[] {
  return mock.calls
    .filter((call) => call.method === 'PATCH')
    .map((call) => JSON.parse(call.body ?? 'null') as unknown);
}

describe('JobFormScreen · edición', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/7/edit');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra «Cargando la oferta…» y después el formulario con los valores actuales', async () => {
    mockFetch({ 'GET /api/health': HEALTH, 'GET /api/jobs/7': GET_JOB });
    render(<App />);
    expect(screen.getByText('Cargando la oferta…').getAttribute('role')).toBe('status');

    expect(await screen.findByRole('heading', { name: 'Editar oferta' })).toBeDefined();
    await waitFor(() => expect(document.title).toBe('Editar oferta · ATS'));
    expect(field('Título (obligatorio)').value).toBe(JOB.title);
    expect(field('Descripción').value).toBe('Busca talento.');
    expect(field('Ubicación').value).toBe('Valencia');
    expect(field('Modalidad').value).toBe('híbrida');
    expect(field('Salario mínimo (€/año)').value).toBe('32000');
    expect(field('Salario máximo (€/año)').value).toBe('40000');
    expect(screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')).toBe('/jobs/7');
  });

  it('cambiar descripción y ubicación envía PATCH solo con esos dos campos y vuelve a la ficha (CA-09)', async () => {
    const mock = await openEditor({
      'PATCH /api/jobs/7': {
        status: 200,
        json: { ...JOB, description: 'Nueva.', location: 'Bilbao' },
      },
    });

    type('Descripción', 'Nueva.');
    type('Ubicación', ' Bilbao ');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
    expect(window.history.state).toEqual({ notice: 'Cambios guardados.' });
    expect(patchBodies(mock)).toEqual([{ description: 'Nueva.', location: 'Bilbao' }]);
  });

  it('vaciar la descripción envía null, nunca una cadena vacía (CA-10, EC-21)', async () => {
    const mock = await openEditor({
      'PATCH /api/jobs/7': { status: 200, json: { ...JOB, description: null } },
    });

    type('Descripción', '');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
    expect(patchBodies(mock)).toEqual([{ description: null }]);
  });

  it('con el título vacío marca el campo y no envía ningún PATCH (EC-20)', async () => {
    const mock = await openEditor({});

    type('Título (obligatorio)', '');
    save();

    expect(errorOf('Título (obligatorio)')).toBe('Escribe un título.');
    expect(document.activeElement).toBe(field('Título (obligatorio)'));
    expect(patchBodies(mock)).toEqual([]);
    expect(window.location.pathname).toBe('/jobs/7/edit');
  });

  it('un 400 con title y workMode los pinta junto a cada campo y nada cambia (CA-12)', async () => {
    await openEditor({
      'PATCH /api/jobs/7': {
        status: 400,
        json: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Los datos enviados no son válidos.',
            details: [
              { field: 'title', message: 'El título no es válido.' },
              { field: 'workMode', message: 'La modalidad no es válida.' },
            ],
          },
        },
      },
    });

    type('Título (obligatorio)', 'Otro título');
    save();

    await waitFor(() => expect(errorOf('Título (obligatorio)')).toBe('El título no es válido.'));
    expect(errorOf('Modalidad')).toBe('La modalidad no es válida.');
    expect(field('Título (obligatorio)').value).toBe('Otro título');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(window.location.pathname).toBe('/jobs/7/edit');
  });

  it('un 500 muestra la alerta, conserva lo escrito y reactiva «Guardar» (EC-22)', async () => {
    const mock = await openEditor({ 'PATCH /api/jobs/7': INTERNAL });

    type('Descripción', 'Texto que no se debe perder');
    save();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect(field('Descripción').value).toBe('Texto que no se debe perder');
    const button = screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(window.location.pathname).toBe('/jobs/7/edit');
    expect(patchBodies(mock)).toHaveLength(1);
  });

  it.each([
    [404, 'JOB_NOT_FOUND'],
    [400, 'VALIDATION_ERROR'],
  ])('con un %i con envelope al cargar muestra «Oferta no encontrada»', async (status, code) => {
    mockFetch({
      'GET /api/health': HEALTH,
      'GET /api/jobs/7': { status, json: { error: { code, message: 'Mensaje de la API.' } } },
    });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Oferta no encontrada' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Volver a las ofertas' })).toBeDefined();
    expect(screen.queryByLabelText('Título (obligatorio)')).toBeNull();
  });

  it('con un ID no válido muestra «Oferta no encontrada» sin pedir la oferta', () => {
    window.history.replaceState(null, '', '/jobs/abc/edit');
    const mock = mockFetch({ 'GET /api/health': HEALTH });

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Oferta no encontrada' })).toBeDefined();
    expect(mock.calls.filter((call) => call.url.startsWith('/api/jobs'))).toEqual([]);
  });

  it('con un 500 al cargar muestra la alerta con «Reintentar»', async () => {
    mockFetch({ 'GET /api/health': HEALTH, 'GET /api/jobs/7': INTERNAL });
    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
  });
});
