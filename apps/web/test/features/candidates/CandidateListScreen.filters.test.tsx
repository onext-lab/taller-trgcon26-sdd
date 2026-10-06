import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateListScreen } from '../../../src/features/candidates/CandidateListScreen.tsx';
import { INITIAL_LIST_QUERY, saveListState } from '../../../src/features/candidates/list-state.ts';
import type { CandidateListItem, CandidatePage } from '../../../src/features/candidates/types.ts';
import { mockFetch, type MockReply } from '../../helpers/fetch.ts';

// Invented data only.
function item(id: number): CandidateListItem {
  return {
    id,
    fullName: `Candidato inventado ${id}`,
    email: `c${id}@example.com`,
    skills: ['sql'],
  };
}

function pageOf(count: number, total: number, page: number, pageSize: number): MockReply {
  const items = Array.from({ length: count }, (_, index) => item(index + 1));
  const body: CandidatePage = { items, total, page, pageSize };
  return { status: 200, json: body };
}

function box(name: string): HTMLInputElement {
  return screen.getByRole('searchbox', { name }) as HTMLInputElement;
}

function sizeSelect(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: 'Por página' }) as HTMLSelectElement;
}

function type(q: string, skill: string): void {
  fireEvent.change(box('Buscar por nombre o email'), { target: { value: q } });
  fireEvent.change(box('Skill'), { target: { value: skill } });
}

describe('CandidateListScreen · búsqueda, paginación y estado sin URL', () => {
  beforeEach(() => {
    saveListState(INITIAL_LIST_QUERY);
    window.history.replaceState(null, '', '/candidates');
    document.title = 'ATS';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-17 q «jose» + skill «SQL» pide /api/candidates?q=jose&skill=SQL y no toca la URL', async () => {
    const mock = mockFetch({
      'GET /api/candidates': pageOf(2, 2, 1, 20),
      'GET /api/candidates?q=jose&skill=SQL': pageOf(1, 1, 1, 20),
    });

    render(<CandidateListScreen />);
    await screen.findByRole('table', { name: 'Candidatos' });
    type('  jose ', 'SQL');
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(mock.calls).toHaveLength(2));
    expect(mock.calls[1]?.url).toBe('/api/candidates?q=jose&skill=SQL');
    expect(await screen.findAllByRole('link', { name: /Candidato inventado/ })).toHaveLength(1);
    expect(box('Buscar por nombre o email').value).toBe('jose');
    expect(window.location.search).toBe('');
  });

  it('CA-19 «Siguiente» pide page=2, muestra «Página 2 de 2» y deja el foco en el h1 al terminar', async () => {
    const mock = mockFetch({
      'GET /api/candidates': pageOf(20, 21, 1, 20),
      'GET /api/candidates?page=2': pageOf(1, 21, 2, 20),
    });

    render(<CandidateListScreen />);
    await screen.findByText('Página 1 de 2 (21 candidatos)');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Página 2 de 2 (21 candidatos)')).toBeDefined();
    expect(mock.calls.map((call) => call.url)).toEqual([
      '/api/candidates',
      '/api/candidates?page=2',
    ]);
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('CA-19 «Por página» 100 pide pageSize=100 y página 1 con la búsqueda aplicada, no los borradores', async () => {
    const mock = mockFetch({
      'GET /api/candidates?q=ana': pageOf(1, 1, 1, 20),
      'GET /api/candidates?q=ana&pageSize=100': pageOf(1, 1, 1, 100),
    });
    saveListState({ ...INITIAL_LIST_QUERY, q: 'ana' });

    render(<CandidateListScreen />);
    await screen.findByRole('table', { name: 'Candidatos' });
    type('borrador', 'otra');
    expect(
      within(sizeSelect())
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['20', '50', '100']);
    fireEvent.change(sizeSelect(), { target: { value: '100' } });

    await waitFor(() => expect(mock.calls).toHaveLength(2));
    expect(mock.calls[1]?.url).toBe('/api/candidates?q=ana&pageSize=100');
    await screen.findByRole('table', { name: 'Candidatos' });
    expect(sizeSelect().value).toBe('100');
    expect(box('Buscar por nombre o email').value).toBe('borrador');
  });

  it('una búsqueda nueva vuelve a la página 1 con el tamaño actual', async () => {
    const mock = mockFetch({
      'GET /api/candidates?page=2&pageSize=50': pageOf(1, 51, 2, 50),
      'GET /api/candidates?q=ana&pageSize=50': pageOf(1, 1, 1, 50),
    });
    saveListState({ ...INITIAL_LIST_QUERY, page: 2, pageSize: 50 });

    render(<CandidateListScreen />);
    await screen.findByRole('table', { name: 'Candidatos' });
    type('ana', '');
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(mock.calls).toHaveLength(2));
    expect(mock.calls[1]?.url).toBe('/api/candidates?q=ana&pageSize=50');
  });

  it('DD-01 / RNF-09 desmontar y volver a montar restaura q, skill, página y tamaño sin URL ni history.state', async () => {
    const mock = mockFetch({
      'GET /api/candidates': pageOf(20, 45, 1, 20),
      'GET /api/candidates?q=ana&skill=sql': pageOf(20, 45, 1, 20),
      'GET /api/candidates?q=ana&skill=sql&page=2': pageOf(5, 45, 2, 20),
    });

    const first = render(<CandidateListScreen />);
    await screen.findByRole('table', { name: 'Candidatos' });
    type('ana', 'sql');
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByText('Página 1 de 3 (45 candidatos)');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Página 2 de 3 (45 candidatos)');
    first.unmount();

    render(<CandidateListScreen />);
    await screen.findByText('Página 2 de 3 (45 candidatos)');

    expect(mock.calls.at(-1)?.url).toBe('/api/candidates?q=ana&skill=sql&page=2');
    expect(box('Buscar por nombre o email').value).toBe('ana');
    expect(box('Skill').value).toBe('sql');
    expect(window.location.search).toBe('');
    expect(JSON.stringify(window.history.state ?? null)).not.toContain('ana');
    expect(document.title).toBe('Candidatos · ATS');
  });

  it('DD-01 el estado guardado se restaura con su tamaño de página en el selector', async () => {
    mockFetch({ 'GET /api/candidates?pageSize=50': pageOf(3, 3, 1, 50) });
    saveListState({ ...INITIAL_LIST_QUERY, pageSize: 50 });

    render(<CandidateListScreen />);
    await screen.findByRole('table', { name: 'Candidatos' });

    expect(sizeSelect().value).toBe('50');
  });
});
