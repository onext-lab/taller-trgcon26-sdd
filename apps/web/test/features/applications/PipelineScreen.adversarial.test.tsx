import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BAD_RESPONSE_MESSAGE, CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import type { FetchMock, MockReply } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import {
  CREATED_REPLY,
  PAGE,
  WITH_NEW_CARD,
  envelope,
  ok,
  sequence,
  type Reply,
} from './enroll-fixtures.ts';
import { PUBLISHED_PIPELINE, renderPipeline } from './fixtures.ts';

// Adversarial tests of the pipeline and the enroll panel (TASK-14): hostile data and failures. Invented data only.
const PIPELINE = 'GET /api/jobs/7/applications';
const SEARCH = 'GET /api/candidates?q=ana&pageSize=10';
const EMAIL = 'candidata12@example.com';
const EMAIL_SEARCH = `GET /api/candidates?q=${encodeURIComponent(EMAIL)}&pageSize=10`;
const POST = 'POST /api/applications';
const TRIGGER = { name: 'Inscribir candidato' };
const FIELD = 'Nombre o email';
const HOSTILE = '<img src=x onerror=alert(1)>';
const DUPLICATE_TEXT = 'Este candidato ya está inscrito en la oferta.';

/** Opens the panel, searches «ana» and leaves the results on screen. */
async function openAndSearch(
  post: Reply,
  pipeline: Reply[] = [ok(PUBLISHED_PIPELINE)],
  page: unknown = PAGE,
  query = 'ana',
): Promise<FetchMock> {
  const mock = renderPipeline('/jobs/7/pipeline', {
    [PIPELINE]: sequence(...pipeline),
    [query === 'ana' ? SEARCH : EMAIL_SEARCH]: ok(page),
    [POST]: sequence(post),
  });
  fireEvent.click(await screen.findByRole('button', TRIGGER));
  await expectFocusOn(() => screen.getByLabelText(FIELD));
  fireEvent.change(screen.getByLabelText(FIELD), { target: { value: query } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByRole('table', { name: 'Resultados de la búsqueda' });
  return mock;
}

function enrollButtons(): HTMLElement[] {
  return within(screen.getByRole('table')).getAllByRole('button');
}

function panel(): HTMLElement {
  return screen.getByRole('region', TRIGGER);
}

function posts(mock: FetchMock): number {
  return mock.calls.filter((call) => call.method === 'POST').length;
}

function pipelineGets(mock: FetchMock): number {
  return mock.calls.filter((call) => call.url === '/api/jobs/7/applications').length;
}

function recibida(): string[] {
  const column = screen.getByRole('region', { name: 'Recibida' });
  return within(column)
    .getAllByRole('listitem')
    .map((card) => card.querySelector('p')?.textContent ?? '');
}

describe('PipelineScreen: hostiles y fallos (RF-07, RF-08)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('EC-38/RNF-06: un nombre con HTML se pinta como texto en la tarjeta y en los resultados; ningún img', async () => {
    const card = { ...PUBLISHED_PIPELINE.items[0], candidateName: HOSTILE };
    const pipeline = { ...PUBLISHED_PIPELINE, items: [card, ...PUBLISHED_PIPELINE.items.slice(1)] };
    const hostilePage = {
      ...PAGE,
      items: [{ ...PAGE.items[0], fullName: HOSTILE }, PAGE.items[1]],
    };

    await openAndSearch(CREATED_REPLY, [ok(pipeline)], hostilePage);

    expect(recibida()[0]).toBe(HOSTILE);
    expect(within(screen.getByRole('table')).getByRole('cell', { name: HOSTILE })).toBeDefined();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('[onerror]')).toBeNull();
    expect(document.body.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('EC-46: doble clic en Inscribir (el primero se queda colgado) → un solo POST', async () => {
    const mock = await openAndSearch({ hang: true });
    const button = enrollButtons()[1] as HTMLElement;

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(enrollButtons()[0] as HTMLElement);

    await screen.findByRole('button', { name: 'Inscribiendo…' });
    expect(posts(mock)).toBe(1);
  });

  it('EC-46: dos clics antes de que React repinte (guarda por ref) → un solo POST', async () => {
    const mock = await openAndSearch({ hang: true });
    const button = enrollButtons()[1] as HTMLElement;

    act(() => {
      button.click();
      button.click();
    });

    await screen.findByRole('button', { name: 'Inscribiendo…' });
    expect(posts(mock)).toBe(1);
  });

  it('EC-42/EC-43: timeout y reintento → 409 DUPLICATE verídico, alerta en el panel y la recarga enseña la tarjeta en Recibida', async () => {
    const duplicate = envelope(409, 'DUPLICATE', 'Ya inscrito.');
    const mock = await openAndSearch(duplicate, [ok(PUBLISHED_PIPELINE), ok(WITH_NEW_CARD)]);
    // The first POST gets a signal that has already timed out: the client raises CLIENT_TIMEOUT.
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    const expired = vi.spyOn(AbortSignal, 'timeout').mockImplementationOnce(() => {
      const controller = new AbortController();
      controller.abort(new DOMException('timeout', 'TimeoutError'));
      return controller.signal;
    });

    fireEvent.click(enrollButtons()[1] as HTMLElement);

    expect((await within(panel()).findByRole('alert')).textContent).toBe(CONNECTION_MESSAGE);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(pipelineGets(mock)).toBe(1);
    expired.mockImplementation(realTimeout);
    expect(recibida()).toEqual(['Marina Ortega Vidal', 'Iván Soler Prats']);

    fireEvent.click(enrollButtons()[1] as HTMLElement);

    await waitFor(() =>
      expect(within(panel()).getByRole('alert').textContent).toBe(DUPLICATE_TEXT),
    );
    await waitFor(() => expect(recibida()[0]).toBe('Candidata Inventada 12'));
    expect(posts(mock)).toBe(2);
    expect(pipelineGets(mock)).toBe(2);
    expect(panel()).toBeDefined();
  });

  it.each<[string, MockReply, string]>([
    [
      'EC-42: 400',
      envelope(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.'),
      'Los datos enviados no son válidos.',
    ],
    [
      'EC-42: 403',
      envelope(403, 'CROSS_SITE_REQUEST', 'Petición no permitida.'),
      'Petición no permitida.',
    ],
    [
      'EC-42: 500',
      envelope(500, 'INTERNAL_ERROR', 'No se ha podido completar la operación.'),
      'No se ha podido completar la operación.',
    ],
    [
      'EC-42: 500 sin envelope y con stack',
      { status: 500, text: 'Error: boom\n    at run (/srv/app.js:1:1)' },
      CONNECTION_MESSAGE,
    ],
    [
      'EC-42: 201 con forma inesperada',
      { status: 201, json: { id: 'x', jobId: 7 } },
      BAD_RESPONSE_MESSAGE,
    ],
    ['EC-42: 201 que no es JSON', { status: 201, text: '<html>ok</html>' }, BAD_RESPONSE_MESSAGE],
  ])(
    '%s → alerta userMessage en el panel sin stack, panel abierto con lo escrito y sin recarga',
    async (_name, reply, text) => {
      const mock = await openAndSearch(reply);

      fireEvent.click(enrollButtons()[1] as HTMLElement);

      const alert = await within(panel()).findByRole('alert');
      expect(alert.textContent).toBe(text);
      expect(alert.textContent).not.toMatch(/\bat\b.*\.js|Error:|stack/);
      await expectFocusOn(() => within(panel()).getByRole('alert'));
      expect((screen.getByLabelText(FIELD) as HTMLInputElement).value).toBe('ana');
      expect(enrollButtons()).toHaveLength(2);
      expect(enrollButtons().every((button) => !button.hasAttribute('disabled'))).toBe(true);
      expect(screen.queryByText('Candidato inscrito.')).toBeNull();
      expect(posts(mock)).toBe(1);
      expect(pipelineGets(mock)).toBe(1);
    },
  );
});

describe('PipelineScreen: datos en el navegador (EC-39, EC-45, RNF-05)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  async function expectNoTrace(): Promise<void> {
    expect(window.location.pathname).toBe('/jobs/7/pipeline');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toMatch(/candidata|example|ana/i);
    await waitFor(() => expect(document.title).toBe('Pipeline de la oferta · ATS'));
    expect(window.history.state).toBeNull();
    for (const store of [window.localStorage, window.sessionStorage]) {
      const dump = JSON.stringify(Object.entries(store));
      expect(dump).not.toContain(EMAIL);
      expect(dump).not.toContain('Candidata Inventada');
    }
  }

  it('EC-45/EC-39/RNF-05: tras buscar por un email, URL, título, history.state y almacenamiento sin rastro', async () => {
    const logs = ['log', 'info', 'warn', 'error', 'debug'].map((name) =>
      vi.spyOn(console, name as 'log').mockImplementation(() => undefined),
    );
    await openAndSearch(CREATED_REPLY, [ok(PUBLISHED_PIPELINE)], PAGE, EMAIL);

    await expectNoTrace();
    expect((screen.getByLabelText(FIELD) as HTMLInputElement).autocomplete).toBe('off');
    expect(logs.every((log) => log.mock.calls.length === 0)).toBe(true);
  });

  it('EC-45/EC-39/RNF-05: tras inscribir, el panel cerrado no deja rastro del email ni del nombre', async () => {
    await openAndSearch(CREATED_REPLY, [ok(PUBLISHED_PIPELINE), ok(WITH_NEW_CARD)], PAGE, EMAIL);

    fireEvent.click(enrollButtons()[1] as HTMLElement);

    await screen.findByText('Candidato inscrito.');
    await waitFor(() => expect(recibida()[0]).toBe('Candidata Inventada 12'));
    await expectNoTrace();
    expect(document.body.textContent).not.toContain(EMAIL);
  });
});
