import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BAD_RESPONSE_MESSAGE, CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import type { Pipeline, Stage } from '../../../src/features/applications/types.ts';
import { installDialogPolyfill } from '../../helpers/dialog.ts';
import type { FetchMock, MockReply, MockRoute } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import { envelope, ok, sequence } from './enroll-fixtures.ts';
import { CLOSED_PIPELINE, PUBLISHED_PIPELINE, renderPipeline } from './fixtures.ts';
import {
  clickReject,
  gets,
  openRejectDialog,
  PIPELINE,
  pickReason,
  postedBody,
  posts,
  renderReject,
  typeNote,
} from './reject-fixtures.ts';
import { advanced, rejected } from './stage-fixtures.ts';

// Adversarial tests of the stage changes in the pipeline (TASK-14): hostile names and notes, double submits,
// failures, browser leaks and a job that closes under the page. Invented data only.
const ADVANCE = 'POST /api/applications/28/advance';
const ORIOL_ADVANCE = 'Avanzar a Oferta: Oriol Mas Puig';
const HOSTILE = '<img src=x onerror=alert(1)>';
const TITLE = 'Pipeline de la oferta · ATS';
const NOTE = 'Escribió a ana.mas@example.com <img src=x onerror=alert(1)>';
const TRACE = /ana\.mas|example\.com|onerror|<img/;

let restoreDialog: () => void = () => undefined;

function withOriolIn(stage: Stage): Pipeline {
  return {
    job: PUBLISHED_PIPELINE.job,
    items: PUBLISHED_PIPELINE.items.map((item) => (item.id === 28 ? { ...item, stage } : item)),
  };
}

function renderAdvance(post: MockRoute, reload: MockReply = ok(withOriolIn('offer'))): FetchMock {
  return renderPipeline('/jobs/7/pipeline', {
    [PIPELINE]: sequence(ok(PUBLISHED_PIPELINE), reload),
    [ADVANCE]: post,
  });
}

function cardButtons(): HTMLElement[] {
  return screen.queryAllByRole('button');
}

async function clickOriolAdvance(): Promise<HTMLElement> {
  const button = await screen.findByRole('button', { name: ORIOL_ADVANCE });
  button.focus();
  fireEvent.click(button);
  return button;
}

describe('PipelineScreen: cambios de etapa frente a hostiles y dobles envíos', () => {
  beforeEach(() => {
    restoreDialog = installDialogPolyfill();
  });

  afterEach(() => {
    cleanup();
    restoreDialog();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('EC-34 nombre con HTML en el enlace y en los nombres accesibles: texto, ningún img', async () => {
    const first = { ...PUBLISHED_PIPELINE.items[0], candidateName: HOSTILE };
    const pipeline = {
      ...PUBLISHED_PIPELINE,
      items: [first, ...PUBLISHED_PIPELINE.items.slice(1)],
    };
    renderPipeline('/jobs/7/pipeline', { [PIPELINE]: ok(pipeline) });

    const link = await screen.findByRole('link', { name: HOSTILE });
    expect(link.getAttribute('href')).toBe('/applications/31');
    expect(screen.getByRole('button', { name: `Avanzar a Cribado: ${HOSTILE}` })).toBeDefined();
    const reject = screen.getByRole('button', { name: `Rechazar: ${HOSTILE}` });
    fireEvent.click(reject);
    await screen.findByRole('dialog', { name: 'Rechazar la inscripción' });

    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('[onerror]')).toBeNull();
    expect(document.body.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('EC-35 doble clic en Avanzar = 1 POST', async () => {
    const mock = renderPipeline('/jobs/7/pipeline', {
      [PIPELINE]: ok(PUBLISHED_PIPELINE),
      'POST /api/applications/29/advance': { hang: true },
    });
    const button = await screen.findByRole('button', {
      name: 'Avanzar a Entrevista: Nuria Casas Ferrer',
    });

    // Both clicks land before React re-renders and disables the buttons: only the ref guard stops the second.
    act(() => {
      button.click();
      button.click();
    });
    const pressed = await screen.findByRole('button', { name: 'Avanzando…: Nuria Casas Ferrer' });
    fireEvent.click(pressed);
    fireEvent.click(screen.getByRole('button', { name: 'Avanzar a Cribado: Iván Soler Prats' }));

    expect(posts(mock)).toBe(1);
    expect(pressed.hasAttribute('disabled')).toBe(true);
  });

  it('EC-41 doble clic en Rechazar del diálogo = 1 POST', async () => {
    const mock = renderReject({ hang: true });
    const { dialog } = await openRejectDialog();
    pickReason(dialog, 'Otro');
    const confirm = within(dialog).getByRole('button', { name: 'Rechazar' });

    act(() => {
      confirm.click();
      confirm.click();
    });
    await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(true));
    fireEvent.click(confirm);

    expect(posts(mock)).toBe(1);
    expect(dialog.hasAttribute('open')).toBe(true);
  });

  it('EC-10 un 200 de reintento es éxito', async () => {
    const mock = renderAdvance(sequence({ networkError: true }, ok(advanced('offer'))));
    await clickOriolAdvance();
    expect((await screen.findByRole('alert')).textContent).toBe(CONNECTION_MESSAGE);
    await waitFor(() => expect(cardButtons().every((b) => !b.hasAttribute('disabled'))).toBe(true));
    expect(gets(mock)).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: ORIOL_ADVANCE }));

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Inscripción avanzada a Oferta.');
    await expectFocusOn(() => screen.getByRole('status'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(posts(mock)).toBe(2);
    const bodies = mock.calls.filter((call) => call.method === 'POST').map((call) => call.body);
    expect(bodies[1]).toBe(bodies[0]);
    const offer = screen.getByRole('region', { name: 'Oferta' });
    await waitFor(() => expect(within(offer).getByText('Oriol Mas Puig')).toBeDefined());
    expect(gets(mock)).toBe(2);
  });

  it.each<[string, MockReply, string]>([
    ['400', envelope(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.'), 'Los datos'],
    [
      '403',
      envelope(403, 'CROSS_SITE_REQUEST', 'Petición no permitida.'),
      'Petición no permitida.',
    ],
    ['200 con etapa desconocida', { status: 200, json: { ...advanced('offer'), stage: 'x' } }, ''],
    ['200 de otra inscripción', { status: 200, json: advanced('offer', 99) }, ''],
    ['200 sin forma de inscripción', { status: 200, json: { ok: true } }, ''],
  ])(
    'EC-01/EC-09 400, 403 y forma inesperada → alerta sin recarga: %s',
    async (_name, reply, serverText) => {
      const mock = renderAdvance(reply);
      await clickOriolAdvance();

      const alert = await screen.findByRole('alert');

      const text = serverText === '' ? BAD_RESPONSE_MESSAGE : serverText;
      expect(alert.textContent).toContain(text);
      expect(alert.textContent).not.toMatch(/\bat\b.*\.js|Error:|stack|Oriol|@/);
      await expectFocusOn(() => screen.getByRole('alert'));
      await waitFor(() =>
        expect(cardButtons().every((b) => !b.hasAttribute('disabled'))).toBe(true),
      );
      expect(screen.queryByRole('status')).toBeNull();
      expect(posts(mock)).toBe(1);
      expect(gets(mock)).toBe(1);
      const entrevista = screen.getByRole('region', { name: 'Entrevista' });
      expect(within(entrevista).getByText('Oriol Mas Puig')).toBeDefined();
    },
  );

  // After each step of the reject: URL, title, history.state and both storages know nothing of the note.
  async function expectNoTrace(): Promise<void> {
    expect(window.location.pathname).toBe('/jobs/7/pipeline');
    expect(window.location.href).not.toMatch(TRACE);
    await waitFor(() => expect(document.title).toBe(TITLE));
    expect(window.history.state).toBeNull();
    for (const store of [window.localStorage, window.sessionStorage]) {
      expect(store.length).toBe(0);
      expect(JSON.stringify(Object.entries(store))).not.toMatch(TRACE);
    }
  }

  it('EC-40 nota fuera de URL, título, history.state, localStorage, sessionStorage y tarjeta', async () => {
    const logs = ['log', 'info', 'warn', 'error', 'debug'].map((name) =>
      vi.spyOn(console, name as 'log').mockImplementation(() => undefined),
    );
    const mock = renderReject({ status: 200, json: rejected() });
    await expectNoTrace();

    const { dialog } = await openRejectDialog();
    await expectNoTrace();
    pickReason(dialog, 'No encaja con el perfil');
    typeNote(dialog, NOTE);
    expect((within(dialog).getByRole('textbox') as HTMLTextAreaElement).value).toBe(NOTE);
    await expectNoTrace();
    clickReject(dialog);
    await screen.findByText('Inscripción rechazada.');
    expect(postedBody(mock)).toEqual({
      expectedStage: 'interview',
      reason: 'not_a_fit',
      note: NOTE,
    });
    await expectNoTrace();

    const column = screen.getByRole('region', { name: 'Rechazado' });
    const card = (await within(column).findByText('Oriol Mas Puig')).closest('li') as HTMLElement;
    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    expect(within(card).getByText('Motivo: No encaja con el perfil')).toBeDefined();
    expect(card.textContent).not.toMatch(TRACE);
    expect(document.body.textContent).not.toMatch(TRACE);
    expect(document.body.innerHTML).not.toMatch(/ana\.mas|onerror/);
    expect(document.querySelector('img')).toBeNull();
    expect(gets(mock)).toBe(2);
    await expectNoTrace();
    expect(logs.every((log) => log.mock.calls.length === 0)).toBe(true);
  });

  it.each([
    ['avanzar', 'Inscripción avanzada a Oferta.'],
    ['rechazar', 'Inscripción rechazada.'],
  ])('EC-48 la recarga trae closed: sin acciones ni diálogos (%s)', async (action, text) => {
    if (action === 'avanzar') {
      renderAdvance(ok(advanced('offer')), ok(CLOSED_PIPELINE));
      await clickOriolAdvance();
    } else {
      renderReject(ok(rejected()), ok(CLOSED_PIPELINE));
      const { dialog } = await openRejectDialog();
      pickReason(dialog, 'Otro');
      clickReject(dialog);
    }

    expect((await screen.findByRole('status')).textContent).toBe(text);

    await screen.findByText('Elena Mora Lara');
    expect(cardButtons()).toHaveLength(0);
    expect(document.querySelectorAll('dialog')).toHaveLength(0);
    expect(screen.queryByText('Oriol Mas Puig')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Inscribir candidato' })).toBeNull();
  });
});
