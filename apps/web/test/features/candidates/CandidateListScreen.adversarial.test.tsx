import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateListScreen } from '../../../src/features/candidates/CandidateListScreen.tsx';
import { INITIAL_LIST_QUERY, saveListState } from '../../../src/features/candidates/list-state.ts';
import type { CandidateListItem, CandidatePage } from '../../../src/features/candidates/types.ts';
import { mockFetch } from '../../helpers/fetch.ts';

// Invented data only.
const HOSTILE_NAME = '<img src=x onerror=alert(1)>';
const HOSTILE_Q = "' OR 1=1 --";

function item(id: number, fullName = `Candidato inventado ${id}`): CandidateListItem {
  return { id, fullName, email: `c${id}@example.com`, skills: ['sql'] };
}

function page(items: CandidateListItem[]): { status: number; json: CandidatePage } {
  return { status: 200, json: { items, total: items.length, page: 1, pageSize: 20 } };
}

function box(name: string): HTMLInputElement {
  return screen.getByRole('searchbox', { name }) as HTMLInputElement;
}

function search(q: string, skill = ''): void {
  fireEvent.change(box('Buscar por nombre o email'), { target: { value: q } });
  fireEvent.change(box('Skill'), { target: { value: skill } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
}

async function showList(extra: Record<string, ReturnType<typeof page>> = {}) {
  const mock = mockFetch({ 'GET /api/candidates': page([item(1)]), ...extra });
  render(<CandidateListScreen />);
  await screen.findByRole('table', { name: 'Candidatos' });
  return mock;
}

describe('CandidateListScreen · filtros hostiles y fallos', () => {
  beforeEach(() => {
    saveListState(INITIAL_LIST_QUERY);
    window.history.replaceState(null, '', '/candidates');
    document.title = 'ATS';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-20 q de 101 caracteres → error junto al campo y ninguna petición nueva', async () => {
    const mock = await showList();

    search('a'.repeat(101));

    const input = box('Buscar por nombre o email');
    expect(await screen.findByText('La búsqueda no puede pasar de 100 caracteres.')).toBeDefined();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(mock.calls).toHaveLength(1);
  });

  it('CA-20 q de 100 caracteres → se pide con la q completa', async () => {
    const q = 'a'.repeat(100);
    const mock = await showList({ [`GET /api/candidates?q=${q}`]: page([item(2)]) });

    search(q);

    await waitFor(() => expect(mock.calls).toHaveLength(2));
    expect(mock.calls[1]?.url).toBe(`/api/candidates?q=${q}`);
    expect(screen.queryByText('La búsqueda no puede pasar de 100 caracteres.')).toBeNull();
    expect(mock.unmatched).toEqual([]);
  });

  it('CA-20 q de 100 puntos de código (emoji) se pide; 101 no', async () => {
    const hundred = '\u{1F600}'.repeat(100);
    const mock = await showList({
      [`GET /api/candidates?q=${encodeURIComponent(hundred)}`]: page([item(2)]),
    });

    search('\u{1F600}'.repeat(101));
    expect(await screen.findByText('La búsqueda no puede pasar de 100 caracteres.')).toBeDefined();
    expect(mock.calls).toHaveLength(1);

    search(hundred);
    await waitFor(() => expect(mock.calls).toHaveLength(2));
    expect(mock.unmatched).toEqual([]);
  });

  it('CA-20 q con un carácter de control → error junto al campo y ninguna petición nueva', async () => {
    const mock = await showList();

    search('ana\u0007');

    expect(
      await screen.findByText('La búsqueda no puede tener caracteres de control.'),
    ).toBeDefined();
    expect(box('Buscar por nombre o email').getAttribute('aria-invalid')).toBe('true');
    expect(mock.calls).toHaveLength(1);
  });

  it('CA-20 skill de 41 caracteres → error junto al campo y ninguna petición nueva', async () => {
    const mock = await showList();

    search('', 'a'.repeat(41));

    expect(await screen.findByText('La skill no puede pasar de 40 caracteres.')).toBeDefined();
    expect(box('Skill').getAttribute('aria-invalid')).toBe('true');
    expect(mock.calls).toHaveLength(1);
  });

  it('CA-20 skill con carácter de control → error junto al campo y ninguna petición nueva', async () => {
    const mock = await showList();

    search('', 'sql\u007f');

    expect(await screen.findByText('La skill no puede tener caracteres de control.')).toBeDefined();
    expect(mock.calls).toHaveLength(1);
  });

  it("EC-33 q «' OR 1=1 --» viaja codificada y no toca la URL, el history.state ni el título", async () => {
    const url = `/api/candidates?q=${encodeURIComponent(HOSTILE_Q)}`;
    const mock = await showList({ [`GET ${url}`]: page([]) });

    search(HOSTILE_Q);

    await waitFor(() => expect(mock.calls).toHaveLength(2));
    expect(mock.calls[1]?.url).toBe(url);
    // `encodeURIComponent` leaves the apostrophe as is and encodes the spaces and the «=».
    expect(url).toBe("/api/candidates?q='%20OR%201%3D1%20--");
    expect(await screen.findByText('Ningún candidato coincide con la búsqueda.')).toBeDefined();
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/candidates');
    expect(JSON.stringify(window.history.state ?? null)).not.toContain('OR');
    expect(document.title).toBe('Candidatos · ATS');
    expect(mock.unmatched).toEqual([]);
  });

  it('EC-33 / RNF-06 un nombre con <img onerror> se ve como texto y no crea elementos img', async () => {
    mockFetch({ 'GET /api/candidates': page([item(1, HOSTILE_NAME), item(2, '<b>x</b> Prueba')]) });

    const { container } = render(<CandidateListScreen />);

    const link = await screen.findByRole('link', { name: HOSTILE_NAME });
    expect(link.textContent).toBe(HOSTILE_NAME);
    expect(screen.getByRole('link', { name: '<b>x</b> Prueba' })).toBeDefined();
    expect(container.querySelectorAll('img, script, b, i').length).toBe(0);
  });

  it('EC-33 un skill con HTML se ve como texto en la tabla', async () => {
    mockFetch({
      'GET /api/candidates': page([
        { ...item(1), skills: ['<i>x</i>', '<script>alert(1)</script>'] },
      ]),
    });

    const { container } = render(<CandidateListScreen />);

    expect(await screen.findByText('<i>x</i>, <script>alert(1)</script>')).toBeDefined();
    expect(container.querySelectorAll('img, script, b, i').length).toBe(0);
  });
});
