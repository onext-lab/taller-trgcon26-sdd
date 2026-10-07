import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import { CandidateDetailScreen } from '../../../src/features/candidates/CandidateDetailScreen.tsx';
import type { Candidate } from '../../../src/features/candidates/types.ts';
import { mockFetch } from '../../helpers/fetch.ts';

// Invented data only.
const ACTIVE: Candidate = {
  id: 7,
  fullName: 'Lucía Ejemplo Prueba',
  email: 'lucia.ejemplo@example.com',
  phone: '+34 600 000 000',
  summary: 'Desarrolladora backend.\nExperiencia con APIs.',
  skills: ['node', 'sql'],
  createdAt: '2026-10-06T22:30:00.000Z',
  consentGivenAt: '2026-10-06T22:30:00.000Z',
  consentVersion: 'v1',
  consentWithdrawnAt: null,
  retentionEndsAt: '2027-04-06',
};

const WITHDRAWN: Candidate = {
  ...ACTIVE,
  consentWithdrawnAt: '2026-11-02T10:00:00.000Z',
  retentionEndsAt: null,
};

const NEVER: Candidate = {
  ...ACTIVE,
  consentGivenAt: null,
  consentVersion: null,
  retentionEndsAt: null,
};

const NAME_ONLY: Candidate = {
  ...NEVER,
  id: 8,
  fullName: 'Mario Mínimo Prueba',
  email: 'mario.minimo@example.com',
  phone: null,
  summary: null,
  skills: [],
};

const GET_CANDIDATE = 'GET /api/candidates/7';

function visit(path: string): void {
  window.history.replaceState(null, '', path);
}

function envelope(code: string, message: string) {
  return { error: { code, message } };
}

function consentSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Consentimiento para futuros procesos' });
}

function checkbox(): HTMLInputElement {
  return within(consentSection()).getByRole('checkbox', {
    name: 'El candidato da su consentimiento',
  });
}

async function showDetail(candidate: Candidate, id = 7): Promise<void> {
  visit(`/candidates/${id}`);
  mockFetch({ [`GET /api/candidates/${id}`]: { status: 200, json: candidate } });
  render(<CandidateDetailScreen />);
  await screen.findByRole('heading', { level: 1, name: candidate.fullName });
}

function expectNotFoundScreen(): void {
  expect(screen.getByRole('heading', { level: 1, name: 'Candidato no encontrado' })).toBeDefined();
  expect(screen.getByText('El candidato que buscas no existe.')).toBeDefined();
  const link = screen.getByRole('link', { name: 'Volver a los candidatos' });
  expect(link.getAttribute('href')).toBe('/candidates');
  expect(screen.queryByRole('definition')).toBeNull();
  expect(screen.queryByRole('region')).toBeNull();
}

describe('CandidateDetailScreen', () => {
  beforeEach(() => {
    visit('/candidates/7');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra «Cargando el candidato…» mientras espera la respuesta', () => {
    mockFetch({ [GET_CANDIDATE]: { hang: true } });

    render(<CandidateDetailScreen />);

    expect(screen.getByRole('status').textContent).toBe('Cargando el candidato…');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('muestra la ficha completa con consentimiento vigente, casilla marcada y «Renovar» (CA-22)', async () => {
    mockFetch({ [GET_CANDIDATE]: { status: 200, json: ACTIVE } });

    render(<CandidateDetailScreen />);

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Lucía Ejemplo Prueba');
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Email',
      'Teléfono',
      'Resumen',
      'Skills',
      'Fecha de alta',
      'Fin de retención',
    ]);
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual([
      'lucia.ejemplo@example.com',
      '+34 600 000 000',
      'Desarrolladora backend.\nExperiencia con APIs.',
      'node, sql',
      '07/10/2026',
      '06/04/2027',
    ]);
    expect(screen.getByRole('link', { name: 'Editar' }).getAttribute('href')).toBe(
      '/candidates/7/edit',
    );
    expect(
      screen.getByText('Vigente: otorgado el 07/10/2026 con la versión v1 del texto.'),
    ).toBeDefined();
    expect(screen.getByText('Versión del texto: v1.')).toBeDefined();
    expect(checkbox().checked).toBe(true);
    expect(
      within(consentSection()).getByRole('button', { name: 'Renovar consentimiento' }),
    ).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('con el consentimiento retirado, la casilla va desmarcada y sin «Renovar» (CA-22)', async () => {
    await showDetail(WITHDRAWN);
    expect(
      screen.getByText(
        'Retirado el 02/11/2026. Se otorgó el 07/10/2026 con la versión v1 del texto.',
      ),
    ).toBeDefined();
    expect(checkbox().checked).toBe(false);
    expect(screen.queryByRole('button', { name: 'Renovar consentimiento' })).toBeNull();
  });

  it('con consentimiento nunca dado, la casilla va desmarcada y sin «Renovar» (CA-22)', async () => {
    await showDetail(NEVER);
    expect(screen.getByText('No consta consentimiento para futuros procesos.')).toBeDefined();
    expect(checkbox().checked).toBe(false);
    expect(screen.queryByRole('button', { name: 'Renovar consentimiento' })).toBeNull();
  });

  it('con solo nombre y email muestra «Sin indicar» sin «null» ni huecos (EC-36)', async () => {
    await showDetail(NAME_ONLY, 8);
    const values = screen.getAllByRole('definition').map((value) => value.textContent);
    expect(values).toEqual([
      'mario.minimo@example.com',
      'Sin indicar',
      'Sin indicar',
      'Sin indicar',
      '07/10/2026',
      'Mientras dure el proceso',
    ]);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('null');
    expect(text).not.toContain('undefined');
    for (const value of values) expect(value).not.toBe('');
  });

  it('el alta 2026-10-06T22:30:00Z se ve como 07/10/2026 y el fin 2027-04-06 como 06/04/2027 (EC-36, CA-01)', async () => {
    await showDetail(ACTIVE);
    const times = [...document.querySelectorAll('dd time')];
    expect(times.map((time) => [time.getAttribute('datetime'), time.textContent])).toEqual([
      ['2026-10-06T22:30:00.000Z', '07/10/2026'],
      ['2027-04-06', '06/04/2027'],
    ]);
  });

  it('con retentionEndsAt null muestra «Mientras dure el proceso» (EC-55)', async () => {
    await showDetail(WITHDRAWN);
    const values = screen.getAllByRole('definition').map((value) => value.textContent);
    expect(values.at(-1)).toBe('Mientras dure el proceso');
  });

  it('el título es fijo y no contiene el nombre del candidato (RNF-09)', async () => {
    await showDetail(ACTIVE);
    await waitFor(() => expect(document.title).toBe('Ficha de candidato · ATS'));
    await waitFor(() => expect(document.title).not.toContain('Lucía'));
  });

  it('un 404 de la API muestra «Candidato no encontrado» sin datos (CA-23)', async () => {
    mockFetch({
      [GET_CANDIDATE]: { status: 404, json: envelope('NOT_FOUND', 'El candidato no existe.') },
    });

    render(<CandidateDetailScreen />);

    await screen.findByRole('heading', { level: 1, name: 'Candidato no encontrado' });
    expectNotFoundScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(document.title).toBe('Candidato no encontrado · ATS'));
  });

  it('un 400 de la API se trata como candidato no encontrado (CA-23)', async () => {
    mockFetch({
      [GET_CANDIDATE]: { status: 400, json: envelope('VALIDATION_ERROR', 'ID no válido.') },
    });

    render(<CandidateDetailScreen />);

    await screen.findByRole('heading', { level: 1, name: 'Candidato no encontrado' });
    expectNotFoundScreen();
  });

  it.each(['/candidates/abc', '/candidates/1.5', '/candidates/0'])(
    '%s muestra «Candidato no encontrado» sin llamar a la API (EC-35)',
    (path) => {
      visit(path);
      const mock = mockFetch({});

      render(<CandidateDetailScreen />);

      expectNotFoundScreen();
      expect(mock.calls).toEqual([]);
    },
  );

  it('con error de red muestra la alerta sin datos y «Reintentar» vuelve a pedir (CA-24, EC-37)', async () => {
    let attempt = 0;
    const mock = mockFetch({
      [GET_CANDIDATE]: () => {
        attempt += 1;
        return attempt === 1 ? { networkError: true } : { status: 200, json: ACTIVE };
      },
    });

    render(<CandidateDetailScreen />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(CONNECTION_MESSAGE);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('definition')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    await waitFor(() => expect(document.title).toBe('Ficha de candidato · ATS'));

    fireEvent.click(
      within(alert.parentElement as HTMLElement).getByRole('button', { name: 'Reintentar' }),
    );

    await screen.findByRole('heading', { level: 1, name: 'Lucía Ejemplo Prueba' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mock.calls).toHaveLength(2);
  });

  it('un 500 con envelope muestra su mensaje en la alerta y sin datos (CA-24)', async () => {
    mockFetch({
      [GET_CANDIDATE]: {
        status: 500,
        json: envelope('INTERNAL_ERROR', 'Error interno. Inténtalo de nuevo.'),
      },
    });

    render(<CandidateDetailScreen />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('muestra el aviso de llegada guardado en el historial', async () => {
    window.history.replaceState({ notice: 'Candidato creado.' }, '', '/candidates/7');
    mockFetch({ [GET_CANDIDATE]: { status: 200, json: ACTIVE } });

    render(<CandidateDetailScreen />);

    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('status').textContent).toBe('Candidato creado.');
  });
});
