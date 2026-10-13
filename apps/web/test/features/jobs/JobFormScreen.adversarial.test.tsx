import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App.tsx';
import { JobFormScreen } from '../../../src/features/jobs/JobFormScreen.tsx';
import { mockFetch, type FetchMock, type MockRoute } from '../../helpers/fetch.ts';

// Adversarial tests of the job form (TASK-14), apart from the happy path. Invented data only.
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
  enrollmentDeadline: null,
};

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement;
}

function formOf(button: HTMLButtonElement): HTMLFormElement {
  const form = button.closest('form');
  if (!form) throw new Error('El botón no está dentro de un formulario.');
  return form;
}

function patches(mock: FetchMock): FetchMock['calls'] {
  return mock.calls.filter((call) => call.method === 'PATCH');
}

async function openEditor(extra: Record<string, MockRoute> = {}): Promise<FetchMock> {
  const mock = mockFetch({
    'GET /api/health': { status: 200, json: { status: 'ok' } },
    'GET /api/jobs/7': { status: 200, json: JOB },
    ...extra,
  });
  render(<App />);
  await screen.findByRole('heading', { name: 'Editar oferta' });
  return mock;
}

describe('JobFormScreen · alta · adversarial', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/new');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('EC-06 doble clic en «Guardar» con el POST pendiente = 1 fetch y botón deshabilitado', async () => {
    const mock = mockFetch({ 'POST /api/jobs': { hang: true } });
    render(<JobFormScreen mode="create" />);
    type('Título (obligatorio)', JOB.title);
    const form = formOf(saveButton());

    fireEvent.click(saveButton());
    // The button is already disabled: submitting the form directly checks that the ref guard stops it too.
    fireEvent.submit(form);
    fireEvent.submit(form);

    const busy = await screen.findByRole('button', { name: 'Guardando…' });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]).toMatchObject({ method: 'POST', url: '/api/jobs' });
  });
});

describe('JobFormScreen · edición · adversarial', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/7/edit');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('EC-19 «Guardar» sin cambios no llama a la API (nunca PATCH {}) y vuelve a la ficha', async () => {
    const mock = await openEditor();

    fireEvent.click(saveButton());

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
    expect(patches(mock)).toEqual([]);
    expect(window.history.state).toBeNull();
    expect(mock.unmatched).toEqual([]);
  });

  it('EC-19 un cambio que solo añade espacios sobrantes tampoco envía PATCH', async () => {
    const mock = await openEditor();

    type('Ubicación', '  Valencia  ');
    fireEvent.click(saveButton());

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
    expect(patches(mock)).toEqual([]);
  });

  it('EC-06 doble envío en edición con el PATCH pendiente = 1 PATCH', async () => {
    const mock = await openEditor({ 'PATCH /api/jobs/7': { hang: true } });
    type('Descripción', 'Texto nuevo.');
    const form = formOf(saveButton());

    fireEvent.click(saveButton());
    fireEvent.submit(form);
    fireEvent.submit(form);

    const busy = await screen.findByRole('button', { name: 'Guardando…' });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(patches(mock)).toHaveLength(1);
  });

  it('EC-24/EC-30 un 404 al guardar muestra «Esta oferta ya no existe.» y conserva lo escrito', async () => {
    const mock = await openEditor({
      'PATCH /api/jobs/7': {
        status: 404,
        json: { error: { code: 'NOT_FOUND', message: 'No existe esa oferta.' } },
      },
    });

    type('Descripción', 'Texto que no se debe perder');
    fireEvent.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Esta oferta ya no existe.');
    const back = screen.getByRole('link', { name: 'Volver a las ofertas' });
    expect(back.getAttribute('href')).toBe('/jobs');
    expect((screen.getByLabelText('Descripción') as HTMLTextAreaElement).value).toBe(
      'Texto que no se debe perder',
    );
    expect(window.location.pathname).toBe('/jobs/7/edit');
    expect(patches(mock)).toHaveLength(1);
  });
});
