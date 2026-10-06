import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App.tsx';
import { mockFetch, type FetchMock, type MockRoute } from '../../helpers/fetch.ts';

// Invented data only.
const PUBLISHED = {
  id: 7,
  title: 'Desarrollador/a backend (Node.js)',
  description: 'Busca talento.',
  location: 'Valencia',
  workMode: 'híbrida',
  salaryMin: 32000,
  salaryMax: 40000,
  status: 'published',
  createdAt: '2026-10-06T09:30:00.000Z',
  publishedAt: '2026-10-06T10:00:00.000Z',
  closedAt: null,
};
const CLOSED = { ...PUBLISHED, status: 'closed', closedAt: '2026-10-07T08:00:00.000Z' };
const HEALTH: MockRoute = { status: 200, json: { status: 'ok' } };
const REQUIRED = 'Obligatorio en una oferta publicada.';
const CLOSED_EDIT = 'Una oferta cerrada no se puede editar.';

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function save(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

function errorOf(label: string): string | null {
  const ids = screen.getByLabelText(label).getAttribute('aria-describedby') ?? '';
  const errorId = ids.split(' ').find((id) => id.endsWith('-error'));
  return errorId ? (document.getElementById(errorId)?.textContent ?? null) : null;
}

async function openEditor(routes: Record<string, MockRoute>): Promise<FetchMock> {
  const mock = mockFetch({ 'GET /api/health': HEALTH, ...routes });
  render(<App />);
  await screen.findByRole('heading', { name: 'Editar oferta' });
  return mock;
}

function patches(mock: FetchMock): unknown[] {
  return mock.calls
    .filter((call) => call.method === 'PATCH')
    .map((call) => JSON.parse(call.body ?? 'null') as unknown);
}

describe('JobFormScreen · edición de una publicada', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/7/edit');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('marca los cuatro obligatorios con «(obligatorio)» y required', async () => {
    await openEditor({ 'GET /api/jobs/7': { status: 200, json: PUBLISHED } });

    for (const label of [
      'Título (obligatorio)',
      'Descripción (obligatorio)',
      'Ubicación (obligatorio)',
      'Modalidad (obligatorio)',
    ]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).required).toBe(true);
    }
    expect((screen.getByLabelText('Salario mínimo (€/año)') as HTMLInputElement).required).toBe(
      false,
    );
  });

  it('CA-11, EC-17: una descripción en espacios da el error junto al campo, con foco y sin PATCH', async () => {
    const mock = await openEditor({ 'GET /api/jobs/7': { status: 200, json: PUBLISHED } });

    type('Descripción (obligatorio)', '   ');
    save();

    await waitFor(() => expect(errorOf('Descripción (obligatorio)')).toBe(REQUIRED));
    expect(document.activeElement).toBe(screen.getByLabelText('Descripción (obligatorio)'));
    expect(patches(mock)).toEqual([]);
  });

  it('EC-17: ubicación vacía y modalidad sin valor dan el error en cada campo, sin PATCH', async () => {
    const mock = await openEditor({ 'GET /api/jobs/7': { status: 200, json: PUBLISHED } });

    type('Ubicación (obligatorio)', '');
    type('Modalidad (obligatorio)', '');
    save();

    await waitFor(() => expect(errorOf('Ubicación (obligatorio)')).toBe(REQUIRED));
    expect(errorOf('Modalidad (obligatorio)')).toBe(REQUIRED);
    expect(document.activeElement).toBe(screen.getByLabelText('Ubicación (obligatorio)'));
    expect(patches(mock)).toEqual([]);
  });

  it('EC-17: un 400 del servidor con ese details se pinta junto al campo y conserva lo escrito', async () => {
    await openEditor({
      'GET /api/jobs/7': { status: 200, json: PUBLISHED },
      'PATCH /api/jobs/7': {
        status: 400,
        json: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos no válidos.',
            details: [{ field: 'description', message: REQUIRED }],
          },
        },
      },
    });

    type('Descripción (obligatorio)', 'Texto nuevo.');
    type('Salario mínimo (€/año)', '33000');
    save();

    await waitFor(() => expect(errorOf('Descripción (obligatorio)')).toBe(REQUIRED));
    expect(document.activeElement).toBe(screen.getByLabelText('Descripción (obligatorio)'));
    expect((screen.getByLabelText('Salario mínimo (€/año)') as HTMLInputElement).value).toBe(
      '33000',
    );
  });

  it('EC-19: cambiar solo la banda envía PATCH { salaryMin } y vuelve a la ficha «Publicada»', async () => {
    const mock = await openEditor({
      'GET /api/jobs/7': { status: 200, json: PUBLISHED },
      'PATCH /api/jobs/7': { status: 200, json: { ...PUBLISHED, salaryMin: 35000 } },
    });

    type('Salario mínimo (€/año)', '35000');
    save();

    expect(await screen.findByText('Cambios guardados.')).toBeDefined();
    expect(patches(mock)).toEqual([{ salaryMin: 35000 }]);
    expect(window.location.pathname).toBe('/jobs/7');
    expect(await screen.findByText('Publicada')).toBeDefined();
  });

  it('EC-20 un 500 al guardar una publicada muestra la alerta y conserva lo escrito', async () => {
    const mock = await openEditor({
      'GET /api/jobs/7': { status: 200, json: PUBLISHED },
      'PATCH /api/jobs/7': {
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' } },
      },
    });

    type('Descripción (obligatorio)', 'Texto nuevo.');
    type('Salario mínimo (€/año)', '33000');
    save();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect((screen.getByLabelText('Descripción (obligatorio)') as HTMLTextAreaElement).value).toBe(
      'Texto nuevo.',
    );
    expect((screen.getByLabelText('Salario mínimo (€/año)') as HTMLInputElement).value).toBe(
      '33000',
    );
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(window.location.pathname).toBe('/jobs/7/edit');
    expect(patches(mock)).toEqual([{ description: 'Texto nuevo.', salaryMin: 33000 }]);
  });

  it('CA-12, EC-44: un 409 al guardar muestra el message de la API, «Ver la oferta» y vuelve a pedir la oferta', async () => {
    let reads = 0;
    const mock = await openEditor({
      'GET /api/jobs/7': () => {
        reads += 1;
        return { status: 200, json: reads === 1 ? PUBLISHED : CLOSED };
      },
      'PATCH /api/jobs/7': {
        status: 409,
        json: { error: { code: 'CONFLICT', message: CLOSED_EDIT } },
      },
    });

    type('Descripción (obligatorio)', 'Texto nuevo.');
    save();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(CLOSED_EDIT);
    expect(screen.getByRole('heading', { name: 'Editar oferta' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Ver la oferta' }).getAttribute('href')).toBe(
      '/jobs/7',
    );
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    expect(screen.queryByLabelText('Descripción (obligatorio)')).toBeNull();
    expect(reads).toBe(2);
    expect(patches(mock)).toHaveLength(1);
  });
});

describe('JobFormScreen · edición de una cerrada', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/7/edit');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-10: la URL de una cerrada muestra el aviso fijo y «Ver la oferta», sin formulario', async () => {
    const mock = await openEditor({ 'GET /api/jobs/7': { status: 200, json: CLOSED } });

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Esta oferta está cerrada y no se puede editar.',
    );
    expect(screen.getByRole('link', { name: 'Ver la oferta' }).getAttribute('href')).toBe(
      '/jobs/7',
    );
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    await waitFor(() => expect(document.title).toBe('Editar oferta · ATS'));
    expect(mock.calls.filter((call) => call.method === 'PATCH')).toEqual([]);
  });
});

describe('JobFormScreen · edición de un borrador (HU-01 intacta)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/7/edit');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('solo el título es obligatorio y se puede guardar sin descripción', async () => {
    const draft = { ...PUBLISHED, status: 'draft', publishedAt: null, description: null };
    const mock = await openEditor({
      'GET /api/jobs/7': { status: 200, json: draft },
      'PATCH /api/jobs/7': { status: 200, json: { ...draft, location: 'Bilbao' } },
    });

    expect(screen.getByLabelText('Descripción')).toBeDefined();
    expect((screen.getByLabelText('Ubicación') as HTMLInputElement).required).toBe(false);
    type('Ubicación', 'Bilbao');
    save();

    await waitFor(() => expect(patches(mock)).toEqual([{ location: 'Bilbao' }]));
  });
});
