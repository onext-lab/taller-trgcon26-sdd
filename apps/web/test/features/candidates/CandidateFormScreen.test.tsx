import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App.tsx';
import { CandidateFormScreen } from '../../../src/features/candidates/CandidateFormScreen.tsx';
import { CONSENT_TEXT } from '../../../src/features/candidates/consent.ts';
import { mockFetch } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';

// Invented data only.
const FULL_NAME = 'Lucía Ferrer Soler';
const CREATED = {
  id: 7,
  fullName: FULL_NAME,
  email: 'lucia.ferrer@example.com',
  phone: null,
  summary: null,
  skills: ['typescript', 'sql'],
  createdAt: '2026-10-06T09:30:00.000Z',
  consentGivenAt: null,
  consentVersion: null,
  consentWithdrawnAt: null,
  retentionEndsAt: '2027-04-06',
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

function fillRequired(): void {
  type('Nombre y apellidos (obligatorio)', FULL_NAME);
  type('Email (obligatorio)', 'lucia.ferrer@example.com');
}

describe('CandidateFormScreen · alta', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/candidates/new');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra «Nuevo candidato» con sus cinco campos, «Guardar» y «Cancelar» al listado', async () => {
    mockFetch({});
    render(<CandidateFormScreen mode="create" />);

    expect(screen.getByRole('heading', { name: 'Nuevo candidato' })).toBeDefined();
    await waitFor(() => expect(document.title).toBe('Nuevo candidato · ATS'));
    for (const label of [
      'Nombre y apellidos (obligatorio)',
      'Email (obligatorio)',
      'Teléfono',
      'Resumen',
      'Skills',
    ]) {
      expect(field(label).getAttribute('autocomplete')).toBe('off');
      expect(field(label).hasAttribute('maxlength')).toBe(false);
    }
    expect(field('Email (obligatorio)').getAttribute('inputmode')).toBe('email');
    expect(field('Teléfono').getAttribute('inputmode')).toBe('tel');
    expect(screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')).toBe('/candidates');
  });

  it('con nombre, email y skills envía el cuerpo tal cual y navega a la ficha con «Candidato creado.» (CA-01)', async () => {
    const mock = mockFetch({ 'POST /api/candidates': { status: 201, json: CREATED } });
    render(<CandidateFormScreen mode="create" />);

    type('Nombre y apellidos (obligatorio)', FULL_NAME);
    type('Email (obligatorio)', 'Lucia.Ferrer@Example.com ');
    type('Skills', 'TypeScript, sql, typescript,   ');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/candidates/7'));
    expect(window.history.state).toEqual({ notice: 'Candidato creado.' });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]).toMatchObject({ method: 'POST', url: '/api/candidates' });
    expect(mock.calls[0]?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(mock.calls[0]?.body ?? '')).toEqual({
      fullName: FULL_NAME,
      email: 'Lucia.Ferrer@Example.com',
      skills: ['TypeScript', 'sql', 'typescript'],
      consent: false,
    });
  });

  it('la casilla de consentimiento está desmarcada, con el texto y «Versión del texto: v1.» en su ayuda (CA-03)', () => {
    mockFetch({});
    render(<CandidateFormScreen mode="create" />);

    const group = screen.getByRole('group', { name: 'Consentimiento para futuros procesos' });
    const checkbox = screen.getByRole('checkbox', {
      name: 'El candidato da su consentimiento',
    }) as HTMLInputElement;
    expect(group.contains(checkbox)).toBe(true);
    expect(checkbox.checked).toBe(false);
    const help = document.getElementById(checkbox.getAttribute('aria-describedby') ?? '');
    expect(help?.textContent).toContain(CONSENT_TEXT);
    expect(help?.textContent).toContain('Versión del texto: v1.');
  });

  it('con la casilla marcada envía consent: true (CA-03)', async () => {
    const mock = mockFetch({ 'POST /api/candidates': { status: 201, json: CREATED } });
    render(<CandidateFormScreen mode="create" />);

    fillRequired();
    fireEvent.click(screen.getByRole('checkbox', { name: 'El candidato da su consentimiento' }));
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/candidates/7'));
    expect(JSON.parse(mock.calls[0]?.body ?? '')).toEqual({
      fullName: FULL_NAME,
      email: 'lucia.ferrer@example.com',
      consent: true,
    });
  });

  it('con errores de cliente marca cada campo, enfoca el primero y no envía ninguna petición (CA-04)', async () => {
    const mock = mockFetch({});
    render(<CandidateFormScreen mode="create" />);

    type('Email (obligatorio)', 'ana.gil');
    type('Teléfono', '12345');
    save();

    const name = field('Nombre y apellidos (obligatorio)');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(errorOf('Nombre y apellidos (obligatorio)')).toBe('Escribe el nombre y los apellidos.');
    expect(errorOf('Email (obligatorio)')).toBe(
      'Escribe un email válido, como nombre@example.com.',
    );
    expect(errorOf('Teléfono')).toContain('Escribe entre 6 y 20 dígitos');
    expect(field('Skills').getAttribute('aria-invalid')).toBeNull();
    await expectFocusOn(() => name);
    expect(field('Email (obligatorio)').value).toBe('ana.gil');
    expect(mock.calls).toEqual([]);
    expect(window.location.pathname).toBe('/candidates/new');
  });

  it('un 400 del servidor se pinta junto a su campo con el message de la API y conserva lo escrito (CA-04)', async () => {
    mockFetch({
      'POST /api/candidates': {
        status: 400,
        json: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Los datos enviados no son válidos.',
            details: [
              { field: 'summary', message: 'El resumen es demasiado largo.' },
              { field: 'email', message: 'El email no es válido.' },
            ],
          },
        },
      },
    });
    render(<CandidateFormScreen mode="create" />);
    fillRequired();
    type('Resumen', 'Backend con Node.');

    save();

    await waitFor(() => expect(errorOf('Email (obligatorio)')).toBe('El email no es válido.'));
    expect(errorOf('Resumen')).toBe('El resumen es demasiado largo.');
    await expectFocusOn(() => field('Email (obligatorio)'));
    expect(field('Resumen').value).toBe('Backend con Node.');
    expect(field('Nombre y apellidos (obligatorio)').value).toBe(FULL_NAME);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(window.location.pathname).toBe('/candidates/new');
  });

  it('un 500 muestra el message del envelope en la alerta, conserva lo escrito y sigue en el formulario (CA-06, EC-04, EC-53, EC-56)', async () => {
    const mock = mockFetch({
      'POST /api/candidates': {
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' } },
      },
    });
    render(<CandidateFormScreen mode="create" />);
    fillRequired();
    type('Skills', 'sql, node');
    fireEvent.click(screen.getByRole('checkbox', { name: 'El candidato da su consentimiento' }));

    save();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect(field('Nombre y apellidos (obligatorio)').value).toBe(FULL_NAME);
    expect(field('Email (obligatorio)').value).toBe('lucia.ferrer@example.com');
    expect(field('Skills').value).toBe('sql, node');
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'El candidato da su consentimiento',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(window.location.pathname).toBe('/candidates/new');
    expect(mock.calls).toHaveLength(1);
  });

  it('un 400 con details de un campo que no es del formulario va a la alerta (EC-02)', async () => {
    mockFetch({
      'POST /api/candidates': {
        status: 400,
        json: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Los datos enviados no son válidos.',
            details: [{ field: 'body', message: 'El cuerpo no es válido.' }],
          },
        },
      },
    });
    render(<CandidateFormScreen mode="create" />);
    fillRequired();

    save();

    expect((await screen.findByRole('alert')).textContent).toBe('El cuerpo no es válido.');
    expect(field('Email (obligatorio)').getAttribute('aria-invalid')).toBeNull();
  });

  it('un 409 pone el message junto al email y el enlace por ID, y enfoca el email (CA-05, EC-07)', async () => {
    const mock = mockFetch({
      'POST /api/candidates': {
        status: 409,
        json: {
          error: {
            code: 'DUPLICATE',
            message: 'Ya existe un candidato con este email.',
            details: [
              { field: 'email', message: 'Ya existe un candidato con este email.', existingId: 42 },
            ],
          },
        },
      },
    });
    render(<CandidateFormScreen mode="create" />);
    fillRequired();

    save();

    await waitFor(() =>
      expect(errorOf('Email (obligatorio)')).toBe('Ya existe un candidato con este email.'),
    );
    expect(
      screen.getByRole('link', { name: 'Ver el candidato existente' }).getAttribute('href'),
    ).toBe('/candidates/42');
    await expectFocusOn(() => field('Email (obligatorio)'));
    expect(mock.calls.filter((call) => call.url === '/api/candidates/42')).toEqual([]);
  });

  it('mientras envía, «Guardar» queda deshabilitado con «Guardando…»', async () => {
    mockFetch({ 'POST /api/candidates': { hang: true } });
    render(<CandidateFormScreen mode="create" />);
    fillRequired();

    save();

    const button = await screen.findByRole('button', { name: 'Guardando…' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('en la aplicación, «/candidates/new» muestra el formulario con su título', () => {
    mockFetch({ 'GET /api/health': { status: 200, json: { status: 'ok' } } });

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Nuevo candidato' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Candidato no encontrado' })).toBeNull();
  });
});
