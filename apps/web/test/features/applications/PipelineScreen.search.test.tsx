import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import type { FetchMock, MockRoute } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import {
  ELEVEN_CANDIDATES_PAGE,
  EMPTY_CANDIDATE_PAGE,
  EMPTY_PUBLISHED_PIPELINE,
  PUBLISHED_PIPELINE,
  TEN_CANDIDATES_PAGE,
  renderPipeline,
} from './fixtures.ts';

const PIPELINE = 'GET /api/jobs/7/applications';
const ANA = 'GET /api/candidates?q=ana&pageSize=10';
const ALL = 'GET /api/candidates?pageSize=10';
const TRIGGER = { name: 'Inscribir candidato' };
const FIELD = 'Nombre o email';
const MORE_TEXT = 'Hay más resultados: afina la búsqueda.';
const NONE_TEXT = 'Ningún candidato coincide con la búsqueda.';

function ok(json: unknown): MockRoute {
  return { status: 200, json };
}

function candidateCalls(mock: FetchMock): string[] {
  return mock.calls.filter((call) => call.url.startsWith('/api/candidates')).map((c) => c.url);
}

async function renderOpen(routes: Record<string, MockRoute> = {}): Promise<FetchMock> {
  const pipeline = { [PIPELINE]: ok(PUBLISHED_PIPELINE) };
  const mock = renderPipeline('/jobs/7/pipeline', { ...pipeline, ...routes });
  fireEvent.click(await screen.findByRole('button', TRIGGER));
  await expectFocusOn(() => screen.getByLabelText(FIELD));
  return mock;
}

function field(): HTMLInputElement {
  return screen.getByLabelText(FIELD);
}

function type(text: string): void {
  fireEvent.change(field(), { target: { value: text } });
}

function search(text: string): void {
  type(text);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
}

function panel(): HTMLElement {
  return screen.getByRole('region', TRIGGER);
}

describe('PipelineScreen: panel y búsqueda (RF-08)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('abrir: el foco va a «Nombre o email», aria-expanded pasa a true y el panel tiene su h2', async () => {
    renderPipeline('/jobs/7/pipeline', { [PIPELINE]: ok(EMPTY_PUBLISHED_PIPELINE) });
    const trigger = await screen.findByRole('button', TRIGGER);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe('enroll-panel');
    expect(screen.queryByRole('region', TRIGGER)).toBeNull();

    fireEvent.click(trigger);

    await expectFocusOn(() => screen.getByLabelText(FIELD));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel().id).toBe('enroll-panel');
    expect(
      within(panel()).getByRole('heading', { level: 2, name: 'Inscribir candidato' }),
    ).toBeDefined();
    expect(screen.getByRole('search', { name: 'Buscar candidatos para inscribir' })).toBeDefined();
  });

  it('todos los controles del buscador tienen label o nombre visible', async () => {
    await renderOpen();

    expect(field().type).toBe('search');
    expect(field().autocomplete).toBe('off');
    expect(screen.getByRole('button', { name: 'Buscar' }).getAttribute('type')).toBe('submit');
    expect(screen.getByRole('button', { name: 'Cerrar' }).getAttribute('type')).toBe('button');
  });

  it('Enter envía la búsqueda: GET /api/candidates?q=ana&pageSize=10', async () => {
    const mock = await renderOpen({ [ANA]: ok(TEN_CANDIDATES_PAGE) });
    type('  ana  ');

    fireEvent.submit(screen.getByRole('search'));

    expect(await screen.findByRole('table', { name: 'Resultados de la búsqueda' })).toBeDefined();
    expect(candidateCalls(mock)).toEqual(['/api/candidates?q=ana&pageSize=10']);
  });

  it('«Buscar» envía la búsqueda y muestra «Buscando candidatos…» mientras responde', async () => {
    const mock = await renderOpen({ [ANA]: { hang: true } });

    search('ana');

    expect((await screen.findByRole('status')).textContent).toBe('Buscando candidatos…');
    expect(candidateCalls(mock)).toEqual(['/api/candidates?q=ana&pageSize=10']);
  });

  it('búsqueda vacía: GET /api/candidates?pageSize=10 (los 10 más recientes, DD-07)', async () => {
    const mock = await renderOpen({ [ALL]: ok(TEN_CANDIDATES_PAGE) });

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByRole('table')).toBeDefined();
    expect(candidateCalls(mock)).toEqual(['/api/candidates?pageSize=10']);
  });

  it('una búsqueda nueva aborta la anterior y solo pinta la última respuesta', async () => {
    let first = true;
    const route: MockRoute = () => {
      const reply = first ? { hang: true as const } : { status: 200, json: TEN_CANDIDATES_PAGE };
      first = false;
      return reply;
    };
    const mock = await renderOpen({ [ALL]: route });

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect((await screen.findByRole('status')).textContent).toBe('Buscando candidatos…');
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByRole('table')).toBeDefined();
    expect(screen.queryByText('Buscando candidatos…')).toBeNull();
    expect(candidateCalls(mock)).toHaveLength(2);
  });

  it('EC-41: 10 resultados, sin nota; en la tabla, en el orden de la API y sin skills', async () => {
    await renderOpen({ [ALL]: ok(TEN_CANDIDATES_PAGE) });

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    const table = await screen.findByRole('table', { name: 'Resultados de la búsqueda' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Nombre', 'Email', 'Acción']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(10);
    expect(within(rows[0] as HTMLElement).getByText('Candidata Inventada 1')).toBeDefined();
    expect(within(rows[9] as HTMLElement).getByText('candidata10@example.com')).toBeDefined();
    expect(screen.queryByText('typescript')).toBeNull();
    expect(screen.queryByText(MORE_TEXT)).toBeNull();
  });

  it('EC-41: 11 resultados → las 10 filas y la nota «Hay más resultados: afina la búsqueda.»', async () => {
    await renderOpen({ [ALL]: ok(ELEVEN_CANDIDATES_PAGE) });

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText(MORE_TEXT)).toBeDefined();
    expect(screen.getByText(MORE_TEXT).getAttribute('role')).toBe('status');
    expect(screen.getAllByRole('button', { name: 'Inscribir' })).toHaveLength(10);
  });

  it('EC-41: 0 resultados → «Ningún candidato coincide con la búsqueda.» y sin tabla', async () => {
    await renderOpen({ [ANA]: ok(EMPTY_CANDIDATE_PAGE) });

    search('ana');

    expect((await screen.findByText(NONE_TEXT)).getAttribute('role')).toBe('status');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('cada «Inscribir» describe su fila: aria-describedby apunta a la celda del nombre', async () => {
    await renderOpen({ [ALL]: ok(TEN_CANDIDATES_PAGE) });

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    const buttons = await screen.findAllByRole('button', { name: 'Inscribir' });
    expect(buttons).toHaveLength(10);
    for (const [index, button] of buttons.entries()) {
      const name = document.getElementById(button.getAttribute('aria-describedby') ?? '');
      expect(name?.textContent).toBe(`Candidata Inventada ${index + 1}`);
    }
    expect(
      screen.getByRole('button', { name: 'Inscribir', description: 'Candidata Inventada 3' }),
    ).toBeDefined();
  });
});

describe('PipelineScreen: errores y cierre del panel', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    ['101 caracteres', 'a'.repeat(101), 'La búsqueda no puede pasar de 100 caracteres.'],
    ['un carácter de control', 'an\u0007a', 'La búsqueda no puede tener caracteres de control.'],
  ])('EC-40 %s → error junto al campo, foco en él y 0 peticiones', async (_name, text, message) => {
    const mock = await renderOpen();
    screen.getByRole('button', TRIGGER).focus();

    search(text);

    await expectFocusOn(() => field());
    expect(field().getAttribute('aria-invalid')).toBe('true');
    const errorId = field().getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(errorId)?.textContent).toBe(message);
    expect(field().value).toBe(text);
    expect(candidateCalls(mock)).toEqual([]);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('EC-42 error de red al buscar → alerta en el panel y el texto se conserva', async () => {
    const mock = await renderOpen({ [ANA]: { networkError: true } });

    search('ana');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(CONNECTION_MESSAGE);
    expect(panel().contains(alert)).toBe(true);
    expect(field().value).toBe('ana');
    expect(screen.queryByRole('table')).toBeNull();
    expect(candidateCalls(mock)).toHaveLength(1);
  });

  it('EC-42 un 400 con details en q → mensaje de la API junto al campo, sin alerta', async () => {
    const message = 'La búsqueda no es válida.';
    const error = { code: 'VALIDATION_ERROR', message: 'Datos no válidos.' };
    const details = [{ field: 'q', message }];
    await renderOpen({ [ANA]: { status: 400, json: { error: { ...error, details } } } });

    search('ana');

    await expectFocusOn(() => field());
    expect(field().getAttribute('aria-invalid')).toBe('true');
    const errorId = field().getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(errorId)?.textContent).toBe(message);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(field().value).toBe('ana');
  });

  it('RNF-07 «Cerrar» devuelve el foco a «Inscribir candidato» y descarta texto y resultados', async () => {
    await renderOpen({ [ANA]: ok(TEN_CANDIDATES_PAGE) });
    search('ana');
    await screen.findByRole('table');

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    await expectFocusOn(() => screen.getByRole('button', TRIGGER));
    expect(screen.getByRole('button', TRIGGER).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('region', TRIGGER)).toBeNull();

    fireEvent.click(screen.getByRole('button', TRIGGER));
    await expectFocusOn(() => field());
    expect(field().value).toBe('');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('RNF-07 «Escape» dentro del panel lo cierra, devuelve el foco y descarta lo buscado', async () => {
    await renderOpen({ [ANA]: ok(TEN_CANDIDATES_PAGE) });
    search('ana');
    await screen.findByRole('table');

    fireEvent.keyDown(field(), { key: 'Escape' });

    await expectFocusOn(() => screen.getByRole('button', TRIGGER));
    expect(screen.queryByRole('region', TRIGGER)).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('el disparador también cierra el panel; cerrar aborta la búsqueda en curso', async () => {
    const mock = await renderOpen({ [ANA]: { hang: true } });
    search('ana');
    await screen.findByText('Buscando candidatos…');

    fireEvent.click(screen.getByRole('button', TRIGGER));

    expect(screen.queryByRole('region', TRIGGER)).toBeNull();
    expect(screen.queryByText('Buscando candidatos…')).toBeNull();
    expect(mock.unmatched).toEqual([]);
  });

  it('RNF-05 la búsqueda no sale del estado: ni URL, ni título, ni history.state, ni almacenamiento', async () => {
    await renderOpen({ [ANA]: ok(TEN_CANDIDATES_PAGE) });
    const before = { href: window.location.href, title: document.title };

    search('ana');
    await screen.findByRole('table');

    expect(window.location.href).toBe(before.href);
    expect(document.title).toBe(before.title);
    expect(window.history.state).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
