import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App.tsx';
import { navigate } from '../../../src/components/router.tsx';
import { mockFetch, type FetchMock, type MockRoute } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';

// Invented data only.
const CANDIDATE = {
  id: 7,
  fullName: 'Lucía Ferrer Soler',
  email: 'lucia.ferrer@example.com',
  phone: '+34 600 000 001',
  summary: 'Backend con Node.',
  skills: ['typescript', 'sql'],
  createdAt: '2026-10-06T09:30:00.000Z',
  consentGivenAt: '2026-10-06T09:30:00.000Z',
  consentVersion: 'v1',
  consentWithdrawnAt: null,
  retentionEndsAt: '2028-10-06',
};
const GET_CANDIDATE: MockRoute = { status: 200, json: CANDIDATE };
const HEALTH: MockRoute = { status: 200, json: { status: 'ok' } };
const INTERNAL_MESSAGE = 'Error interno. Inténtalo de nuevo.';
const INTERNAL: MockRoute = {
  status: 500,
  json: { error: { code: 'INTERNAL_ERROR', message: INTERNAL_MESSAGE } },
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
  const id = field(label)
    .getAttribute('aria-describedby')
    ?.split(' ')
    .find((part) => part.endsWith('-error'));
  return id ? (document.getElementById(id)?.textContent ?? null) : null;
}

async function openEditor(routes: Record<string, MockRoute>): Promise<FetchMock> {
  const mock = mockFetch({
    'GET /api/health': HEALTH,
    'GET /api/candidates/7': GET_CANDIDATE,
    ...routes,
  });
  render(<App />);
  await screen.findByRole('heading', { name: 'Editar candidato' });
  return mock;
}

function patchBodies(mock: FetchMock): unknown[] {
  return mock.calls
    .filter((call) => call.method === 'PATCH')
    .map((call) => JSON.parse(call.body ?? 'null') as unknown);
}

describe('CandidateFormScreen · edición', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/candidates/7/edit');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra «Cargando el candidato…» y después el formulario con los valores actuales y sin consentimiento (CA-07)', async () => {
    mockFetch({ 'GET /api/health': HEALTH, 'GET /api/candidates/7': GET_CANDIDATE });
    render(<App />);
    expect(screen.getByText('Cargando el candidato…').getAttribute('role')).toBe('status');

    expect(await screen.findByRole('heading', { name: 'Editar candidato' })).toBeDefined();
    await waitFor(() => expect(document.title).toBe('Editar candidato · ATS'));
    expect(field('Nombre y apellidos (obligatorio)').value).toBe('Lucía Ferrer Soler');
    expect(field('Email (obligatorio)').value).toBe('lucia.ferrer@example.com');
    expect(field('Teléfono').value).toBe('+34 600 000 001');
    expect(field('Resumen').value).toBe('Backend con Node.');
    expect(field('Skills').value).toBe('typescript, sql');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('group', { name: /Consentimiento/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')).toBe(
      '/candidates/7',
    );
  });

  it('cambiar teléfono y resumen envía PATCH solo con esos campos y vuelve a la ficha con «Cambios guardados.» (CA-08)', async () => {
    const mock = await openEditor({
      'PATCH /api/candidates/7': {
        status: 200,
        json: { ...CANDIDATE, phone: '600 000 002', summary: 'Nuevo.' },
      },
    });

    type('Teléfono', ' 600 000 002 ');
    type('Resumen', 'Nuevo.');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/candidates/7'));
    expect(window.history.state).toEqual({ notice: 'Cambios guardados.' });
    expect(patchBodies(mock)).toEqual([{ phone: '600 000 002', summary: 'Nuevo.' }]);
  });

  it('el mismo email con otra forma se envía sin error en el cliente (CA-09)', async () => {
    const mock = await openEditor({
      'PATCH /api/candidates/7': { status: 200, json: CANDIDATE },
    });

    type('Email (obligatorio)', '  Lucia.Ferrer@Example.com ');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/candidates/7'));
    expect(patchBodies(mock)).toEqual([{ email: 'Lucia.Ferrer@Example.com' }]);
  });

  it('vaciar teléfono, resumen y skills envía null, null y [] (EC-21)', async () => {
    const mock = await openEditor({
      'PATCH /api/candidates/7': {
        status: 200,
        json: { ...CANDIDATE, phone: null, summary: null, skills: [] },
      },
    });

    type('Teléfono', '');
    type('Resumen', '   ');
    type('Skills', ' , ');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/candidates/7'));
    expect(patchBodies(mock)).toEqual([{ phone: null, summary: null, skills: [] }]);
  });

  it('sin cambios no envía ninguna petición y vuelve a la ficha sin aviso (EC-26)', async () => {
    const mock = await openEditor({});

    save();

    await waitFor(() => expect(window.location.pathname).toBe('/candidates/7'));
    expect(window.history.state).toBeNull();
    expect(mock.calls.filter((call) => call.method !== 'GET')).toEqual([]);
  });

  it('un 400 del servidor en el resumen (2 001) se pinta junto al campo y conserva lo escrito (CA-11)', async () => {
    await openEditor({
      'PATCH /api/candidates/7': {
        status: 400,
        json: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Los datos enviados no son válidos.',
            details: [{ field: 'summary', message: 'El resumen es demasiado largo.' }],
          },
        },
      },
    });

    type('Resumen', 'a'.repeat(2000));
    save();

    await waitFor(() => expect(errorOf('Resumen')).toBe('El resumen es demasiado largo.'));
    expect(field('Resumen').value).toBe('a'.repeat(2000));
    await expectFocusOn(() => field('Resumen'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un 409 muestra el message junto al email con el enlace al existente y enfoca el email (CA-12, EC-22)', async () => {
    const mock = await openEditor({
      'PATCH /api/candidates/7': {
        status: 409,
        json: {
          error: {
            code: 'DUPLICATE',
            message: 'Ya existe un candidato con este email.',
            details: [
              { field: 'email', message: 'Ya existe un candidato con este email.', existingId: 9 },
            ],
          },
        },
      },
    });

    type('Email (obligatorio)', 'otra.persona@example.com');
    save();

    await waitFor(() =>
      expect(errorOf('Email (obligatorio)')).toBe('Ya existe un candidato con este email.'),
    );
    expect(
      screen.getByRole('link', { name: 'Ver el candidato existente' }).getAttribute('href'),
    ).toBe('/candidates/9');
    await expectFocusOn(() => field('Email (obligatorio)'));
    expect(field('Email (obligatorio)').value).toBe('otra.persona@example.com');
    expect(window.location.pathname).toBe('/candidates/7/edit');
    expect(mock.calls.filter((call) => call.url === '/api/candidates/9')).toEqual([]);
  });

  it.each([
    [404, 'NOT_FOUND'],
    [400, 'VALIDATION_ERROR'],
  ])(
    'con un %i con envelope al cargar muestra «Candidato no encontrado» (CA-13)',
    async (status, code) => {
      mockFetch({
        'GET /api/health': HEALTH,
        'GET /api/candidates/7': { status, json: { error: { code, message: 'Mensaje.' } } },
      });
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'Candidato no encontrado' })).toBeDefined();
      expect(
        screen.getByRole('link', { name: 'Volver a los candidatos' }).getAttribute('href'),
      ).toBe('/candidates');
      expect(screen.queryByLabelText('Email (obligatorio)')).toBeNull();
    },
  );

  it('con un ID no válido muestra «Candidato no encontrado» sin pedir el candidato (CA-13)', () => {
    window.history.replaceState(null, '', '/candidates/abc/edit');
    const mock = mockFetch({ 'GET /api/health': HEALTH });

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Candidato no encontrado' })).toBeDefined();
    expect(mock.calls.filter((call) => call.url.startsWith('/api/candidates'))).toEqual([]);
  });

  it('con un 500 al cargar muestra la alerta con «Reintentar»', async () => {
    mockFetch({ 'GET /api/health': HEALTH, 'GET /api/candidates/7': INTERNAL });
    render(<App />);

    expect((await screen.findByRole('alert')).textContent).toBe(INTERNAL_MESSAGE);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
  });

  it('un 500 al guardar muestra la alerta, conserva lo escrito y reactiva «Guardar» (CA-14, EC-23)', async () => {
    const mock = await openEditor({ 'PATCH /api/candidates/7': INTERNAL });

    type('Resumen', 'Texto que no se debe perder');
    save();

    expect((await screen.findByRole('alert')).textContent).toBe(INTERNAL_MESSAGE);
    expect(field('Resumen').value).toBe('Texto que no se debe perder');
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(window.location.pathname).toBe('/candidates/7/edit');
    expect(patchBodies(mock)).toHaveLength(1);
  });

  it('un 404 al guardar muestra el message en la alerta con el enlace «Volver a los candidatos»', async () => {
    await openEditor({
      'PATCH /api/candidates/7': {
        status: 404,
        json: { error: { code: 'NOT_FOUND', message: 'El candidato no existe.' } },
      },
    });

    type('Resumen', 'Otro texto');
    save();

    expect((await screen.findByRole('alert')).textContent).toBe('El candidato no existe.');
    expect(screen.getByRole('link', { name: 'Volver a los candidatos' })).toBeDefined();
    expect(field('Resumen').value).toBe('Otro texto');
  });

  it('al volver a la ficha y a la edición se pide de nuevo el candidato y se ven los valores nuevos (EC-38)', async () => {
    let reads = 0;
    mockFetch({
      'GET /api/health': HEALTH,
      'GET /api/candidates/7': () => {
        reads += 1;
        return {
          status: 200,
          json: reads === 1 ? CANDIDATE : { ...CANDIDATE, phone: '911 000 000' },
        };
      },
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Editar candidato' });
    expect(field('Teléfono').value).toBe('+34 600 000 001');

    fireEvent.click(screen.getByRole('link', { name: 'Cancelar' }));
    await waitFor(() => expect(window.location.pathname).toBe('/candidates/7'));
    act(() => navigate('/candidates/7/edit'));

    await waitFor(() => expect(field('Teléfono').value).toBe('911 000 000'));
    expect(reads).toBeGreaterThanOrEqual(2);
  });
});
