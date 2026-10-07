import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pipeline } from '../../../src/features/applications/types.ts';
import { installDialogPolyfill, simulateCancel } from '../../helpers/dialog.ts';
import type { FetchMock, MockReply } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import { envelope, ok, sequence } from './enroll-fixtures.ts';
import { PUBLISHED_PIPELINE, renderPipeline } from './fixtures.ts';
import { advanced } from './stage-fixtures.ts';

const PIPELINE = 'GET /api/jobs/7/applications';
const ADVANCE = 'POST /api/applications/27/advance';
const TRIGGER = 'Avanzar a Contratado: Berta Lluch Roca';
const DIALOG = '¿Contratar a este candidato?';
const SERVER_TEXT = 'No se ha podido completar la operación.';

// Berta (application 27) is in `offer`; after hiring her the reload brings her in `hired`.
const HIRED: Pipeline = {
  job: PUBLISHED_PIPELINE.job,
  items: PUBLISHED_PIPELINE.items.map((item) =>
    item.id === 27 ? { ...item, stage: 'hired' as const } : item,
  ),
};

let restoreDialog: () => void = () => undefined;

function renderWith(post: MockReply): FetchMock {
  return renderPipeline('/jobs/7/pipeline', {
    [PIPELINE]: sequence(ok(PUBLISHED_PIPELINE), ok(HIRED)),
    [ADVANCE]: post,
  });
}

// `fireEvent.click` does not move the focus, so focus the trigger first, as a person would.
async function openDialog(): Promise<{ trigger: HTMLElement; dialog: HTMLDialogElement }> {
  const trigger = await screen.findByRole('button', { name: TRIGGER });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = (await screen.findByRole('dialog', { name: DIALOG })) as HTMLDialogElement;
  return { trigger, dialog };
}

function posts(mock: FetchMock): number {
  return mock.calls.filter((call) => call.method === 'POST').length;
}

function column(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

describe('PipelineScreen: contratar', () => {
  beforeEach(() => {
    restoreDialog = installDialogPolyfill();
  });

  afterEach(() => {
    cleanup();
    restoreDialog();
    vi.unstubAllGlobals();
  });

  it('CA-40 Avanzar a Contratado abre el diálogo con foco en Cancelar; Contratar → tarjeta en Contratado sin acciones', async () => {
    const mock = renderWith({ status: 200, json: advanced('hired', 27) });

    const { dialog } = await openDialog();

    expect(within(dialog).getByText('No se puede deshacer.')).toBeTruthy();
    await expectFocusOn(() => within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(posts(mock)).toBe(0);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Contratar' }));

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Inscripción avanzada a Contratado.');
    await expectFocusOn(() => screen.getByRole('status'));
    const post = mock.calls.find((call) => call.method === 'POST');
    expect(post?.body).toBe('{"expectedStage":"offer","toStage":"hired"}');
    expect(posts(mock)).toBe(1);
    expect(dialog.hasAttribute('open')).toBe(false);
    const hired = await within(column('Contratado')).findByText('Berta Lluch Roca');
    const card = hired.closest('li') as HTMLElement;
    expect(within(card).queryAllByRole('button')).toHaveLength(0);
    expect(within(column('Oferta')).queryByText('Berta Lluch Roca')).toBeNull();
  });

  it.each([
    [
      'Cancelar',
      (dialog: HTMLDialogElement) =>
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' })),
    ],
    ['Escape', (dialog: HTMLDialogElement) => simulateCancel(dialog)],
  ])('CA-40 %s → 0 POST y foco de vuelta a Avanzar a Contratado', async (_name, dismiss) => {
    const mock = renderWith({ status: 200, json: advanced('hired', 27) });
    const { trigger, dialog } = await openDialog();

    act(() => dismiss(dialog));

    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    expect(posts(mock)).toBe(0);
    await expectFocusOn(() => trigger);
    expect(screen.queryByRole('status')).toBeNull();
    expect(mock.calls.filter((call) => call.method === 'GET')).toHaveLength(1);
  });

  it('DD-06 500 al contratar → diálogo abierto con role=alert, sin recarga', async () => {
    const mock = renderWith(envelope(500, 'INTERNAL_ERROR', SERVER_TEXT));
    const { dialog } = await openDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Contratar' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toBe(SERVER_TEXT);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(document.activeElement).not.toBe(alert);
    expect(screen.queryByRole('status')).toBeNull();
    expect(mock.calls.filter((call) => call.method === 'GET')).toHaveLength(1);
    expect(within(column('Oferta')).getByText('Berta Lluch Roca')).toBeTruthy();
    for (const name of ['Cancelar', 'Contratar']) {
      expect(within(dialog).getByRole('button', { name }).hasAttribute('disabled')).toBe(false);
    }
  });
});
