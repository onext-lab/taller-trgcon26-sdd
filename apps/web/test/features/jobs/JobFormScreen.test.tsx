import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App.tsx';
import { JobFormScreen } from '../../../src/features/jobs/JobFormScreen.tsx';
import { mockFetch } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';

// Invented data only.
const TITLE = 'Desarrollador/a backend (Node.js)';
const CREATED_AT = '2026-10-06T09:30:00.000Z';

function createdJob(id: number, title: string): Record<string, unknown> {
  return {
    id,
    title,
    description: null,
    location: null,
    workMode: null,
    salaryMin: null,
    salaryMax: null,
    status: 'draft',
    createdAt: CREATED_AT,
    publishedAt: null,
    closedAt: null,
  };
}

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function save(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

function describedError(control: HTMLElement): HTMLElement {
  const id = control
    .getAttribute('aria-describedby')
    ?.split(' ')
    .find((part) => part.endsWith('-error'));
  const error = id ? document.getElementById(id) : null;
  if (!error) throw new Error('El campo no apunta a un mensaje de error.');
  return error;
}

describe('JobFormScreen · alta', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/new');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('con solo el título envía POST /api/jobs y navega a la ficha con «Oferta creada.» (CA-01)', async () => {
    const mock = mockFetch({ 'POST /api/jobs': { status: 201, json: createdJob(7, TITLE) } });
    render(<JobFormScreen mode="create" />);
    expect(screen.getByRole('heading', { name: 'Nueva oferta' })).toBeDefined();
    await waitFor(() => expect(document.title).toBe('Nueva oferta · ATS'));

    type('Título (obligatorio)', TITLE);
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
    expect(window.history.state).toEqual({ notice: 'Oferta creada.' });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]).toMatchObject({ method: 'POST', url: '/api/jobs' });
    expect(mock.calls[0]?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(mock.calls[0]?.body ?? '')).toEqual({ title: TITLE });
  });

  it('envía los textos recortados, omite los opcionales vacíos y nunca status, createdAt ni id (CA-02, EC-02, EC-03)', async () => {
    const mock = mockFetch({
      'POST /api/jobs': { status: 201, json: createdJob(8, 'Técnica/o de selección') },
    });
    render(<JobFormScreen mode="create" />);

    type('Título (obligatorio)', '  Técnica/o de selección  ');
    type('Modalidad', 'híbrida');
    type('Ubicación', ' Valencia ');
    type('Salario mínimo (€/año)', '32000');
    type('Salario máximo (€/año)', '40000');
    type('Descripción', '   ');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/8'));
    const body: unknown = JSON.parse(mock.calls[0]?.body ?? '');
    expect(body).toEqual({
      title: 'Técnica/o de selección',
      workMode: 'híbrida',
      location: 'Valencia',
      salaryMin: 32000,
      salaryMax: 40000,
    });
  });

  it('los valores de las opciones de Modalidad son los literales de la API, en NFC', () => {
    mockFetch({});
    render(<JobFormScreen mode="create" />);

    const options = Array.from(
      (screen.getByLabelText('Modalidad') as HTMLSelectElement).options,
      (option) => option.value,
    );

    expect(options).toEqual(['', 'presencial', 'híbrida', 'remota']);
    for (const value of options) expect(value.normalize('NFC')).toBe(value);
  });

  it('con errores de cliente marca cada campo, enfoca el primero y no envía ninguna petición', async () => {
    const mock = mockFetch({});
    render(<JobFormScreen mode="create" />);

    type('Ubicación', 'a');
    type('Salario mínimo (€/año)', '40.000');
    save();

    const title = screen.getByLabelText('Título (obligatorio)');
    const location = screen.getByLabelText('Ubicación');
    const salary = screen.getByLabelText('Salario mínimo (€/año)');
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(title.getAttribute('aria-describedby')).toBe('title-error');
    expect(describedError(title).textContent).toBe('Escribe un título.');
    expect(describedError(location).textContent).toBe(
      'La ubicación debe tener entre 2 y 120 caracteres.',
    );
    expect(describedError(salary).textContent).toBe(
      'Escribe un número entero mayor que 0, sin puntos ni espacios.',
    );
    expect(screen.getByLabelText('Salario máximo (€/año)').getAttribute('aria-invalid')).toBeNull();
    await expectFocusOn(() => title);
    expect(mock.calls).toEqual([]);
    expect(window.location.pathname).toBe('/jobs/new');
  });

  it('un 400 con details de title y workMode los pinta junto a cada campo y enfoca el primero (CA-03, CA-05, EC-10)', async () => {
    mockFetch({
      'POST /api/jobs': {
        status: 400,
        json: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Los datos enviados no son válidos.',
            details: [
              { field: 'workMode', message: 'La modalidad no es válida.' },
              { field: 'title', message: 'El título no es válido.' },
            ],
          },
        },
      },
    });
    render(<JobFormScreen mode="create" />);
    type('Título (obligatorio)', TITLE);

    save();

    const title = screen.getByLabelText('Título (obligatorio)');
    const workMode = screen.getByLabelText('Modalidad');
    await waitFor(() => expect(title.getAttribute('aria-invalid')).toBe('true'));
    expect(describedError(title).textContent).toBe('El título no es válido.');
    expect(workMode.getAttribute('aria-invalid')).toBe('true');
    expect(describedError(workMode).textContent).toBe('La modalidad no es válida.');
    await expectFocusOn(() => title);
    expect((title as HTMLInputElement).value).toBe(TITLE);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(window.location.pathname).toBe('/jobs/new');
  });

  it.each(['status', 'body'])(
    'un 400 con details de «%s», que no es del formulario, va a la alerta (EC-01, EC-02)',
    async (field) => {
      mockFetch({
        'POST /api/jobs': {
          status: 400,
          json: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Los datos enviados no son válidos.',
              details: [{ field, message: `Problema en ${field}.` }],
            },
          },
        },
      });
      render(<JobFormScreen mode="create" />);
      type('Título (obligatorio)', TITLE);

      save();

      expect((await screen.findByRole('alert')).textContent).toBe(`Problema en ${field}.`);
      expect(screen.getByLabelText('Título (obligatorio)').getAttribute('aria-invalid')).toBeNull();
    },
  );

  it('un 413 muestra su mensaje en la alerta y conserva lo escrito (EC-17)', async () => {
    mockFetch({
      'POST /api/jobs': {
        status: 413,
        json: {
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'El cuerpo de la petición es demasiado grande.',
          },
        },
      },
    });
    render(<JobFormScreen mode="create" />);
    type('Título (obligatorio)', TITLE);

    save();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('El cuerpo de la petición es demasiado grande.');
    expect((screen.getByLabelText('Título (obligatorio)') as HTMLInputElement).value).toBe(TITLE);
  });

  it('con la red caída hace una sola llamada, sin reintento, y conserva lo escrito (EC-09)', async () => {
    const mock = mockFetch({ 'POST /api/jobs': { networkError: true } });
    render(<JobFormScreen mode="create" />);
    type('Título (obligatorio)', TITLE);

    save();

    expect((await screen.findByRole('alert')).textContent).toContain('No se ha podido conectar');
    expect(mock.calls).toHaveLength(1);
    expect((screen.getByLabelText('Título (obligatorio)') as HTMLInputElement).value).toBe(TITLE);
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('un 500 muestra la alerta, conserva lo escrito y reactiva «Guardar» sin reintentar (EC-05)', async () => {
    const mock = mockFetch({
      'POST /api/jobs': {
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' } },
      },
    });
    render(<JobFormScreen mode="create" />);
    type('Título (obligatorio)', TITLE);
    type('Descripción', 'Texto de prueba');

    save();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect((screen.getByLabelText('Título (obligatorio)') as HTMLInputElement).value).toBe(TITLE);
    expect((screen.getByLabelText('Descripción') as HTMLTextAreaElement).value).toBe(
      'Texto de prueba',
    );
    const button = screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(window.location.pathname).toBe('/jobs/new');
    expect(mock.calls).toHaveLength(1);
  });

  it('mientras envía, «Guardar» queda deshabilitado con «Guardando…»', async () => {
    mockFetch({ 'POST /api/jobs': { hang: true } });
    render(<JobFormScreen mode="create" />);
    type('Título (obligatorio)', TITLE);

    save();

    const button = await screen.findByRole('button', { name: 'Guardando…' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('«Cancelar» es un enlace a /jobs', () => {
    mockFetch({});
    render(<JobFormScreen mode="create" />);

    expect(screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')).toBe('/jobs');
  });

  it('en la aplicación, «/jobs/new» muestra el formulario y no la ficha', () => {
    mockFetch({ 'GET /api/health': { status: 200, json: { status: 'ok' } } });

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Nueva oferta' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Oferta no encontrada' })).toBeNull();
  });
});
