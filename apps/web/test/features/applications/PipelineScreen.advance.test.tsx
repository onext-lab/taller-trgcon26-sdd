import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import type { Pipeline, Stage } from '../../../src/features/applications/types.ts';
import type { FetchMock, MockReply } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import { envelope, ok, sequence } from './enroll-fixtures.ts';
import { PUBLISHED_PIPELINE, renderPipeline } from './fixtures.ts';
import { advanced } from './stage-fixtures.ts';

const PIPELINE = 'GET /api/jobs/7/applications';
const ADVANCE = 'POST /api/applications/28/advance';
const ORIOL_ADVANCE = 'Avanzar a Oferta: Oriol Mas Puig';
const SERVER_TEXT = 'No se ha podido completar la operación.';

/** The published pipeline with Oriol (application 28) moved to `stage`, as the reload would bring it. */
function withOriolIn(stage: Stage): Pipeline {
  return {
    job: PUBLISHED_PIPELINE.job,
    items: PUBLISHED_PIPELINE.items.map((item) => (item.id === 28 ? { ...item, stage } : item)),
  };
}

function renderWith(post: MockReply, reload: MockReply = ok(withOriolIn('offer'))): FetchMock {
  return renderPipeline('/jobs/7/pipeline', {
    [PIPELINE]: sequence(ok(PUBLISHED_PIPELINE), reload),
    [ADVANCE]: post,
  });
}

// Oriol is in `interview`: his next stage is `offer`.
async function advanceOriol(): Promise<HTMLElement> {
  const trigger = await screen.findByRole('button', {
    name: ORIOL_ADVANCE,
  });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

function names(column: string): string[] {
  const region = screen.getByRole('region', { name: column });
  return within(region)
    .queryAllByRole('listitem')
    .map((card) => card.querySelector('p')?.textContent ?? '');
}

function gets(mock: FetchMock): number {
  return mock.calls.filter((call) => call.method === 'GET').length;
}

function cardButtons(): HTMLElement[] {
  return screen
    .queryAllByRole('button')
    .filter((button) => /^(Avanzar a|Avanzando|Rechazar)/.test(button.textContent ?? ''));
}

describe('PipelineScreen: avanzar de etapa', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-22/EC-31 published: Avanzar y Rechazar solo en las 4 no finales, con nombres accesibles distintos (Avanzar a Entrevista: Oriol Mas Puig)', async () => {
    renderPipeline('/jobs/7/pipeline', { [PIPELINE]: ok(PUBLISHED_PIPELINE) });

    await screen.findByRole('button', { name: 'Avanzar a Entrevista: Nuria Casas Ferrer' });

    const expected: Record<string, string> = {
      Recibida: 'Avanzar a Cribado',
      Cribado: 'Avanzar a Entrevista',
      Entrevista: 'Avanzar a Oferta',
      Oferta: 'Avanzar a Contratado',
    };
    for (const [column, label] of Object.entries(expected)) {
      const region = screen.getByRole('region', { name: column });
      for (const card of within(region).getAllByRole('listitem')) {
        const person = card.querySelector('p')?.textContent ?? '';
        expect(within(card).getAllByRole('button')).toHaveLength(2);
        expect(within(card).getByRole('button', { name: `${label}: ${person}` })).toBeTruthy();
        expect(within(card).getByRole('button', { name: `Rechazar: ${person}` })).toBeTruthy();
      }
    }
    for (const column of ['Contratado', 'Rechazado']) {
      const region = screen.getByRole('region', { name: column });
      expect(within(region).queryAllByRole('button')).toHaveLength(0);
    }
    const accessibleNames = cardButtons().map((button) => button.textContent);
    expect(accessibleNames).toHaveLength(10);
    expect(new Set(accessibleNames).size).toBe(10);
  });

  it('CA-02 Avanzar a Entrevista → cuerpo {"expectedStage":"screening","toStage":"interview"}, aviso con foco (expectFocusOn) y tarjeta en Entrevista tras la recarga', async () => {
    const reloaded: Pipeline = {
      job: PUBLISHED_PIPELINE.job,
      items: PUBLISHED_PIPELINE.items.map((item) =>
        item.id === 29 ? { ...item, stage: 'interview' as const } : item,
      ),
    };
    const mock = renderPipeline('/jobs/7/pipeline', {
      [PIPELINE]: sequence(ok(PUBLISHED_PIPELINE), ok(reloaded)),
      'POST /api/applications/29/advance': ok(advanced('interview', 29)),
    });
    const trigger = await screen.findByRole('button', {
      name: 'Avanzar a Entrevista: Nuria Casas Ferrer',
    });
    trigger.focus();

    fireEvent.click(trigger);

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Inscripción avanzada a Entrevista.');
    await expectFocusOn(() => screen.getByRole('status'));
    const post = mock.calls.find((call) => call.method === 'POST');
    expect(post?.body).toBe('{"expectedStage":"screening","toStage":"interview"}');
    expect(mock.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    await vi.waitFor(() => expect(names('Entrevista')).toContain('Nuria Casas Ferrer'));
    expect(names('Cribado')).toEqual([]);
    expect(gets(mock)).toBe(2);
  });

  it.each([
    [409, 'STAGE_MISMATCH', 'La inscripción ha cambiado de etapa: revisa el pipeline actualizado.'],
    [409, 'INVALID_TRANSITION', 'La inscripción ya no admite ese cambio.'],
    [404, 'NOT_FOUND', 'La inscripción ya no existe.'],
  ])('EC-33 %i %s → texto de DT-06, foco en la alerta y recarga', async (status, code, text) => {
    const mock = renderWith(envelope(status, code, 'Mensaje del servidor que no se pinta.'));
    await advanceOriol();

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe(text);
    await expectFocusOn(() => screen.getByRole('alert'));
    await vi.waitFor(() => expect(names('Oferta')).toContain('Oriol Mas Puig'));
    expect(names('Entrevista')).not.toContain('Oriol Mas Puig');
    expect(gets(mock)).toBe(2);
  });

  it.each([
    ['red', { networkError: true } as MockReply, CONNECTION_MESSAGE],
    ['500', envelope(500, 'INTERNAL_ERROR', SERVER_TEXT), SERVER_TEXT],
  ])(
    'EC-32 %s → alerta userMessage sin recarga y botones activos de nuevo',
    async (_name, reply, text) => {
      const mock = renderWith(reply);
      await advanceOriol();

      const alert = await screen.findByRole('alert');

      expect(alert.textContent).toBe(text);
      await expectFocusOn(() => screen.getByRole('alert'));
      await vi.waitFor(() =>
        expect(cardButtons().every((b) => !b.hasAttribute('disabled'))).toBe(true),
      );
      expect(cardButtons()).toHaveLength(10);
      expect(gets(mock)).toBe(1);
      expect(names('Entrevista')).toContain('Oriol Mas Puig');
    },
  );

  it('con una acción en vuelo todos los botones de tarjeta disabled y el pulsado dice Avanzando…', async () => {
    const mock = renderWith({ hang: true });
    await advanceOriol();

    const pressed = await screen.findByRole('button', { name: 'Avanzando…: Oriol Mas Puig' });

    expect(pressed.hasAttribute('disabled')).toBe(true);
    expect(cardButtons()).toHaveLength(10);
    expect(cardButtons().every((button) => button.hasAttribute('disabled'))).toBe(true);
    expect(cardButtons().filter((b) => b.textContent?.startsWith('Avanzando…'))).toHaveLength(1);
    fireEvent.click(pressed);
    fireEvent.click(screen.getByRole('button', { name: 'Avanzar a Cribado: Iván Soler Prats' }));
    expect(mock.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
  });

  it('salir de la pantalla con el avance en vuelo → sin aviso ni error', async () => {
    const mock = renderWith({ hang: true });
    await advanceOriol();
    await screen.findByRole('button', { name: 'Avanzando…: Oriol Mas Puig' });

    cleanup();
    await act(async () => undefined);

    const calls = (fetch as unknown as Mock).mock.calls as [string, RequestInit][];
    const post = calls.find(([url]) => url === '/api/applications/28/advance');
    expect(post?.[1].signal?.aborted).toBe(true);
    expect(document.body.textContent).toBe('');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(gets(mock)).toBe(1);
  });
});
