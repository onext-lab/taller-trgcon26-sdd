import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import type { FetchMock, MockReply } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import {
  CREATED,
  CREATED_REPLY,
  PAGE,
  WITH_NEW_CARD,
  envelope,
  ok,
  sequence,
  type Reply,
} from './enroll-fixtures.ts';
import {
  CLOSED_PIPELINE,
  NOT_FOUND_HEADING,
  PUBLISHED_PIPELINE,
  renderPipeline,
} from './fixtures.ts';

const PIPELINE = 'GET /api/jobs/7/applications';
const SEARCH = 'GET /api/candidates?q=ana&pageSize=10';
const POST = 'POST /api/applications';
const TRIGGER = { name: 'Inscribir candidato' };
const FIELD = 'Nombre o email';
const ENROLLED = 'Candidato inscrito.';
const DUPLICATE_TEXT = 'Este candidato ya está inscrito en la oferta.';
const NOT_PUBLISHED_TEXT = 'La oferta ya no está publicada: no admite inscripciones.';
const LOADING_TEXT = 'Cargando el pipeline…';
const SERVER_TEXT = 'No se ha podido completar la operación.';

/** Opens the panel, searches «ana» and leaves the two results on screen. */
async function renderEnroll(post: Reply, ...reloads: Reply[]): Promise<FetchMock> {
  const mock = renderPipeline('/jobs/7/pipeline', {
    [PIPELINE]: sequence(ok(PUBLISHED_PIPELINE), ...reloads),
    [SEARCH]: ok(PAGE),
    [POST]: sequence(post),
  });
  fireEvent.click(await screen.findByRole('button', TRIGGER));
  await expectFocusOn(() => screen.getByLabelText(FIELD));
  fireEvent.change(screen.getByLabelText(FIELD), { target: { value: 'ana' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByRole('table', { name: 'Resultados de la búsqueda' });
  return mock;
}

function enrollButtons(): HTMLElement[] {
  return within(screen.getByRole('table')).getAllByRole('button');
}

function enrollInPanel(index = 1): void {
  fireEvent.click(enrollButtons()[index] as HTMLElement);
}

function panel(): HTMLElement | null {
  return screen.queryByRole('region', TRIGGER);
}

function panelAlert(): HTMLElement {
  return within(panel() as HTMLElement).getByRole('alert');
}

function field(): HTMLInputElement {
  return screen.getByLabelText(FIELD);
}

function recibida(): string[] {
  const column = screen.getByRole('region', { name: 'Recibida' });
  return within(column)
    .getAllByRole('listitem')
    .map((card) => card.querySelector('p')?.textContent ?? '');
}

function pipelineGets(mock: FetchMock): number {
  return mock.calls.filter((call) => call.url === '/api/jobs/7/applications').length;
}

function postBodies(mock: FetchMock): (string | undefined)[] {
  return mock.calls.filter((call) => call.method === 'POST').map((call) => call.body);
}

describe('PipelineScreen: inscribir (RF-08)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-02: POST con {"jobId":7,"candidateId":12}; aviso Candidato inscrito. con el foco; panel cerrado; recarga sin Cargando y la tarjeta la primera de Recibida', async () => {
    let sawLoading = false;
    const reload = (): MockReply => {
      sawLoading = screen.queryByText(LOADING_TEXT) !== null;
      return ok(WITH_NEW_CARD);
    };
    const mock = await renderEnroll(CREATED_REPLY, reload);

    enrollInPanel();

    const notice = await screen.findByText(ENROLLED);
    expect(notice.getAttribute('role')).toBe('status');
    await expectFocusOn(() => screen.getByText(ENROLLED));
    expect(postBodies(mock)).toEqual(['{"jobId":7,"candidateId":12}']);
    expect(panel()).toBeNull();
    expect(screen.queryByLabelText(FIELD)).toBeNull();
    await waitFor(() => expect(recibida()[0]).toBe('Candidata Inventada 12'));
    expect(recibida()).toHaveLength(3);
    expect(pipelineGets(mock)).toBe(2);
    expect(sawLoading).toBe(false);
    expect(screen.queryByText(LOADING_TEXT)).toBeNull();
    expect(screen.getByRole('button', TRIGGER).getAttribute('aria-expanded')).toBe('false');
  });

  it.each([
    [0, 11],
    [1, 12],
  ])('CA-03: el «Inscribir» %i envía un solo candidateId (%i)', async (index, candidateId) => {
    const mock = await renderEnroll({ status: 201, json: { ...CREATED, candidateId } });

    enrollInPanel(index);

    await screen.findByText(ENROLLED);
    expect(postBodies(mock)).toEqual([JSON.stringify({ jobId: 7, candidateId })]);
  });

  it('CA-08/EC-43: DUPLICATE → alerta en el panel sin link, texto y resultados intactos, recarga y ninguna tarjeta nueva', async () => {
    const duplicate = envelope(409, 'DUPLICATE', 'Ya inscrito.');
    const mock = await renderEnroll(duplicate, ok(PUBLISHED_PIPELINE));

    enrollInPanel();

    expect((await within(panel() as HTMLElement).findByRole('alert')).textContent).toBe(
      DUPLICATE_TEXT,
    );
    await expectFocusOn(panelAlert);
    expect(within(panel() as HTMLElement).queryByRole('link')).toBeNull();
    expect(field().value).toBe('ana');
    expect(enrollButtons()).toHaveLength(2);
    expect(enrollButtons().every((button) => !button.hasAttribute('disabled'))).toBe(true);
    await waitFor(() => expect(pipelineGets(mock)).toBe(2));
    expect(screen.queryByText(LOADING_TEXT)).toBeNull();
    expect(recibida()).toEqual(['Marina Ortega Vidal', 'Iván Soler Prats']);
    expect(screen.queryByText(ENROLLED)).toBeNull();
  });

  it('EC-43: un segundo DUPLICATE seguido vuelve a llevar el foco a la alerta del panel', async () => {
    await renderEnroll(envelope(409, 'DUPLICATE', 'Ya inscrito.'));
    enrollInPanel();
    await expectFocusOn(panelAlert);
    field().focus();

    enrollInPanel(0);

    await expectFocusOn(panelAlert);
  });

  it('EC-44: INVALID_TRANSITION → panel cerrado, alerta de la página con el foco, recarga sin Inscribir candidato', async () => {
    const closing = envelope(409, 'INVALID_TRANSITION', 'La oferta no está publicada.');
    const mock = await renderEnroll(closing, ok(CLOSED_PIPELINE));

    enrollInPanel();

    expect((await screen.findByRole('alert')).textContent).toBe(NOT_PUBLISHED_TEXT);
    await expectFocusOn(() => screen.getByRole('alert'));
    expect(panel()).toBeNull();
    await waitFor(() => expect(screen.queryByRole('button', TRIGGER)).toBeNull());
    expect(pipelineGets(mock)).toBe(2);
    expect(screen.queryByLabelText(FIELD)).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe(NOT_PUBLISHED_TEXT);
  });

  it('404 → alerta del panel con el message de la API, con el foco, y recarga', async () => {
    const missing = envelope(404, 'NOT_FOUND', 'El candidato no existe.');
    const mock = await renderEnroll(missing, ok(PUBLISHED_PIPELINE));

    enrollInPanel();

    expect((await within(panel() as HTMLElement).findByRole('alert')).textContent).toBe(
      'El candidato no existe.',
    );
    await expectFocusOn(panelAlert);
    await waitFor(() => expect(pipelineGets(mock)).toBe(2));
    expect(field().value).toBe('ana');
  });

  it('404 con la oferta ya inexistente: la recarga pasa a «Página no encontrada»', async () => {
    const gone = envelope(404, 'NOT_FOUND', 'La oferta no existe.');
    await renderEnroll(gone, gone);

    enrollInPanel();

    expect(await screen.findByRole('heading', { name: NOT_FOUND_HEADING })).toBeDefined();
  });

  it.each([
    ['red', { networkError: true } as MockReply, CONNECTION_MESSAGE],
    ['500', envelope(500, 'INTERNAL_ERROR', SERVER_TEXT), SERVER_TEXT],
    [
      '403',
      envelope(403, 'CROSS_SITE_REQUEST', 'Petición no permitida.'),
      'Petición no permitida.',
    ],
  ])(
    '%s → alerta del panel con el foco, panel abierto y sin recarga',
    async (_name, reply, text) => {
      const mock = await renderEnroll(reply);

      enrollInPanel();

      expect((await within(panel() as HTMLElement).findByRole('alert')).textContent).toBe(text);
      await expectFocusOn(panelAlert);
      expect(field().value).toBe('ana');
      expect(enrollButtons()).toHaveLength(2);
      expect(pipelineGets(mock)).toBe(1);
    },
  );

  it('una recarga que deja la oferta sin publicar descarta el panel y lo buscado', async () => {
    await renderEnroll(envelope(409, 'DUPLICATE', 'Ya inscrito.'), ok(CLOSED_PIPELINE));

    enrollInPanel();

    await waitFor(() => expect(screen.queryByRole('button', TRIGGER)).toBeNull());
    expect(panel()).toBeNull();
    expect(screen.queryByRole('table', { name: 'Resultados de la búsqueda' })).toBeNull();
    expect(screen.queryByText(DUPLICATE_TEXT)).toBeNull();
  });

  it('en curso: botones disabled, «Inscribiendo…» en el pulsado y Escape no cierra', async () => {
    const mock = await renderEnroll({ hang: true });

    enrollInPanel(1);

    await screen.findByRole('button', { name: 'Inscribiendo…' });
    const [first, second] = enrollButtons();
    expect(first?.textContent).toBe('Inscribir');
    expect(second?.textContent).toBe('Inscribiendo…');
    for (const name of ['Buscar', 'Cerrar']) {
      expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    }
    expect(enrollButtons().every((button) => button.hasAttribute('disabled'))).toBe(true);
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(panel()).not.toBeNull();
    fireEvent.click(first as HTMLElement);
    expect(postBodies(mock)).toHaveLength(1);
  });

  it('abrir el panel limpia el aviso de la página', async () => {
    await renderEnroll(CREATED_REPLY);
    enrollInPanel();
    await screen.findByText(ENROLLED);

    fireEvent.click(screen.getByRole('button', TRIGGER));

    await expectFocusOn(field);
    expect(screen.queryByText(ENROLLED)).toBeNull();
  });

  it('abrir el panel limpia la alerta de la página', async () => {
    await renderEnroll(envelope(409, 'INVALID_TRANSITION', 'x'), ok(PUBLISHED_PIPELINE));
    enrollInPanel();
    await screen.findByText(NOT_PUBLISHED_TEXT);

    fireEvent.click(await screen.findByRole('button', TRIGGER));

    await expectFocusOn(field);
    expect(screen.queryByText(NOT_PUBLISHED_TEXT)).toBeNull();
  });
});
