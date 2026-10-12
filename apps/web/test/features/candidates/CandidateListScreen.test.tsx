import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import { CandidateListScreen } from '../../../src/features/candidates/CandidateListScreen.tsx';
import { INITIAL_LIST_QUERY, saveListState } from '../../../src/features/candidates/list-state.ts';
import type { CandidateListItem, CandidatePage } from '../../../src/features/candidates/types.ts';
import { mockFetch, type MockReply } from '../../helpers/fetch.ts';

// Invented data only.
function item(id: number, fullName: string, skills: string[] = []): CandidateListItem {
  return { id, fullName, email: `candidato${id}@example.com`, skills };
}

function pageOf(items: CandidateListItem[], total = items.length, page = 1, size = 20): MockReply {
  const body: CandidatePage = { items, total, page, pageSize: size };
  return { status: 200, json: body };
}

function manyItems(count: number): CandidateListItem[] {
  return Array.from({ length: count }, (_, index) =>
    item(index + 1, `Candidato inventado ${index + 1}`, ['node']),
  );
}

function box(name: string): HTMLInputElement {
  return screen.getByRole('searchbox', { name }) as HTMLInputElement;
}

function search(q: string, skill: string): void {
  fireEvent.change(box('Buscar por nombre o email'), { target: { value: q } });
  fireEvent.change(box('Skill'), { target: { value: skill } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
}

describe('CandidateListScreen · estados y tabla', () => {
  beforeEach(() => {
    saveListState(INITIAL_LIST_QUERY);
    window.history.replaceState(null, '', '/candidates');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('cargando muestra «Cargando candidatos…» con role status, sin tabla ni paginación', () => {
    mockFetch({ 'GET /api/candidates': { hang: true } });

    render(<CandidateListScreen />);

    expect(screen.getByRole('status').textContent).toBe('Cargando candidatos…');
    expect(screen.getByRole('heading', { level: 1, name: 'Candidatos' })).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  });

  it('CA-16 sin filtros pide exactamente /api/candidates', async () => {
    const mock = mockFetch({ 'GET /api/candidates': pageOf(manyItems(2)) });

    render(<CandidateListScreen />);
    await screen.findByRole('table', { name: 'Candidatos' });

    expect(mock.calls.map((call) => call.url)).toEqual(['/api/candidates']);
    expect(screen.getByRole('link', { name: 'Nuevo candidato' }).getAttribute('href')).toBe(
      '/candidates/new',
    );
  });

  it('enlace «Importar CSV» con href="/candidates/import"', async () => {
    mockFetch({ 'GET /api/candidates': pageOf(manyItems(1)) });

    render(<CandidateListScreen />);
    await screen.findByRole('table', { name: 'Candidatos' });

    expect(screen.getByRole('link', { name: 'Importar CSV' }).getAttribute('href')).toBe(
      '/candidates/import',
    );
  });

  it('CA-15 pinta tres columnas, skills unidas por «, » y «Sin indicar», en el orden recibido', async () => {
    mockFetch({
      'GET /api/candidates': pageOf([
        item(9, 'Zoe Zapata Prueba', ['sql', 'node']),
        item(3, 'Ana Álvarez Prueba'),
      ]),
    });

    render(<CandidateListScreen />);
    const table = await screen.findByRole('table', { name: 'Candidatos' });

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Nombre y apellidos', 'Email', 'Skills']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((td) => td.textContent),
      ),
    ).toEqual([
      ['Zoe Zapata Prueba', 'candidato9@example.com', 'sql, node'],
      ['Ana Álvarez Prueba', 'candidato3@example.com', 'Sin indicar'],
    ]);
    expect(
      within(table).getByRole('link', { name: 'Zoe Zapata Prueba' }).getAttribute('href'),
    ).toBe('/candidates/9');
  });

  it('vacío sin filtros muestra «Todavía no hay candidatos.» y ni tabla ni paginación', async () => {
    mockFetch({ 'GET /api/candidates': pageOf([]) });

    render(<CandidateListScreen />);

    expect(await screen.findByText('Todavía no hay candidatos.')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  });

  it('CA-18 vacío con filtros muestra «Ningún candidato coincide con la búsqueda.»', async () => {
    mockFetch({
      'GET /api/candidates': pageOf(manyItems(2)),
      'GET /api/candidates?q=zzz': pageOf([]),
    });

    render(<CandidateListScreen />);
    await screen.findByRole('table', { name: 'Candidatos' });
    search('zzz', '');

    expect(await screen.findByText('Ningún candidato coincide con la búsqueda.')).toBeDefined();
    expect(screen.queryByText('Todavía no hay candidatos.')).toBeNull();
    expect(box('Buscar por nombre o email').value).toBe('zzz');
  });

  it('CA-21 / EC-30 red caída: alerta, «Reintentar» repite la misma URL y los campos conservan lo escrito', async () => {
    let attempts = 0;
    const mock = mockFetch({
      'GET /api/candidates': pageOf(manyItems(2)),
      'GET /api/candidates?q=lucia&skill=SQL': () => {
        attempts += 1;
        return attempts === 1 ? { networkError: true } : pageOf([item(5, 'Lucía Ejemplo')]);
      },
    });

    render(<CandidateListScreen />);
    await screen.findByRole('table', { name: 'Candidatos' });
    search('lucia', 'SQL');

    expect((await screen.findByRole('alert')).textContent).toBe(CONNECTION_MESSAGE);
    expect(box('Buscar por nombre o email').value).toBe('lucia');
    expect(box('Skill').value).toBe('SQL');
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('link', { name: 'Lucía Ejemplo' })).toBeDefined();
    expect(mock.calls.map((call) => call.url)).toEqual([
      '/api/candidates',
      '/api/candidates?q=lucia&skill=SQL',
      '/api/candidates?q=lucia&skill=SQL',
    ]);
    expect(box('Buscar por nombre o email').value).toBe('lucia');
  });

  it('EC-28 q solo con espacios no viaja; 20 candidatos no ofrecen «Siguiente»', async () => {
    const mock = mockFetch({
      'GET /api/candidates?q=ana': pageOf(manyItems(2)),
      'GET /api/candidates': pageOf(manyItems(20)),
    });
    saveListState({ ...INITIAL_LIST_QUERY, q: 'ana' });

    render(<CandidateListScreen />);
    await screen.findByRole('table', { name: 'Candidatos' });
    search('   ', '');

    await waitFor(() => expect(mock.calls).toHaveLength(2));
    await screen.findByText('Página 1 de 1 (20 candidatos)');
    expect(mock.calls.map((call) => call.url)).toEqual([
      '/api/candidates?q=ana',
      '/api/candidates',
    ]);
    expect(screen.getByText('Página 1 de 1 (20 candidatos)')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Anterior' })).toBeNull();
  });

  it('EC-28 21 candidatos muestran «Página 1 de 2» y «Siguiente»', async () => {
    mockFetch({ 'GET /api/candidates': pageOf(manyItems(20), 21) });

    render(<CandidateListScreen />);

    expect(await screen.findByText('Página 1 de 2 (21 candidatos)')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDefined();
  });

  it('DD-07 los dos campos de búsqueda no autocompletan', async () => {
    mockFetch({ 'GET /api/candidates': pageOf(manyItems(1)) });

    render(<CandidateListScreen />);
    await screen.findByRole('table', { name: 'Candidatos' });

    expect(box('Buscar por nombre o email').getAttribute('autocomplete')).toBe('off');
    expect(box('Skill').getAttribute('autocomplete')).toBe('off');
    expect(screen.getByRole('search', { name: 'Buscar candidatos' })).toBeDefined();
  });
});
