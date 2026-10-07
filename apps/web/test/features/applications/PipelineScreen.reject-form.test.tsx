import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NOTE_CONTROL_MESSAGE,
  NOTE_TOO_LONG_MESSAGE,
  REASON_REQUIRED_MESSAGE,
} from '../../../src/features/applications/reject-form.ts';
import { installDialogPolyfill } from '../../helpers/dialog.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import {
  clickReject,
  openRejectDialog,
  pickReason,
  postedBody,
  posts,
  renderReject,
  typeNote,
} from './reject-fixtures.ts';
import { rejected } from './stage-fixtures.ts';

const NOT_A_FIT = 'No encaja con el perfil';
const EMOJI = '\u{1F600}';

let restoreDialog: () => void = () => undefined;

function renderOk() {
  return renderReject({ status: 200, json: rejected() });
}

function noteBox(dialog: HTMLElement): HTMLTextAreaElement {
  return within(dialog).getByRole('textbox', { name: 'Nota (opcional)' }) as HTMLTextAreaElement;
}

// The reject went through: the notice of the page is there and the dialog is closed.
async function expectSent(dialog: HTMLDialogElement): Promise<void> {
  expect((await screen.findByRole('status')).textContent).toBe('Inscripción rechazada.');
  await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
}

describe('PipelineScreen: formulario de rechazo', () => {
  beforeEach(() => {
    restoreDialog = installDialogPolyfill();
  });

  afterEach(() => {
    cleanup();
    restoreDialog();
    vi.unstubAllGlobals();
  });

  it('EC-36 sin motivo → Elige un motivo., foco en el primer radio y 0 POST', async () => {
    const mock = renderOk();
    const { dialog } = await openRejectDialog();
    typeNote(dialog, 'Una nota.');

    clickReject(dialog);

    const error = within(dialog).getByText(REASON_REQUIRED_MESSAGE);
    expect(error.id).toBe('reject-reason-error');
    expect(error.className).toBe('error-text');
    await expectFocusOn(() => within(dialog).getByRole('radio', { name: NOT_A_FIT }));
    for (const radio of within(dialog).getAllByRole('radio')) {
      expect(radio.getAttribute('aria-invalid')).toBe('true');
      expect(radio.getAttribute('aria-describedby')).toBe('reject-reason-error');
    }
    expect(noteBox(dialog).value).toBe('Una nota.');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(posts(mock)).toBe(0);

    pickReason(dialog, 'Otro');
    expect(within(dialog).queryByText(REASON_REQUIRED_MESSAGE)).toBeNull();
  });

  it('EC-36/EC-12 nota con U+0007 → error de control y 0 POST; \\n y \\t se envían', async () => {
    const mock = renderOk();
    const { dialog } = await openRejectDialog();
    pickReason(dialog, NOT_A_FIT);
    typeNote(dialog, 'Aviso\u0007 en la nota');

    clickReject(dialog);

    expect(within(dialog).getByText(NOTE_CONTROL_MESSAGE).className).toBe('error-text');
    await expectFocusOn(() => noteBox(dialog));
    expect(noteBox(dialog).getAttribute('aria-invalid')).toBe('true');
    expect(posts(mock)).toBe(0);

    typeNote(dialog, 'Primera línea\nSegunda\tcolumna');
    expect(within(dialog).queryByText(NOTE_CONTROL_MESSAGE)).toBeNull();
    clickReject(dialog);

    await expectSent(dialog);
    expect(postedBody(mock)).toEqual({
      expectedStage: 'interview',
      reason: 'not_a_fit',
      note: 'Primera línea\nSegunda\tcolumna',
    });
    expect(posts(mock)).toBe(1);
  });

  it('EC-37 501 → error y 501/500', async () => {
    const mock = renderOk();
    const { dialog } = await openRejectDialog();
    pickReason(dialog, NOT_A_FIT);
    typeNote(dialog, 'a'.repeat(501));

    expect(within(dialog).getByText('501/500')).toBeTruthy();
    clickReject(dialog);

    expect(within(dialog).getByText(NOTE_TOO_LONG_MESSAGE)).toBeTruthy();
    await expectFocusOn(() => noteBox(dialog));
    expect(within(dialog).getByText('501/500')).toBeTruthy();
    expect(posts(mock)).toBe(0);
  });

  it.each([
    ['500', 'a'.repeat(500), 'a'.repeat(500), '500/500'],
    ['500 emojis', EMOJI.repeat(500), EMOJI.repeat(500), '500/500'],
    ['con espacios alrededor', `  ${'a'.repeat(500)}  `, 'a'.repeat(500), '500/500'],
  ])('EC-37 %s se envía', async (_name, typed, sent, counter) => {
    const mock = renderOk();
    const { dialog } = await openRejectDialog();
    pickReason(dialog, 'Retirada del candidato');
    typeNote(dialog, typed);

    expect(within(dialog).getByText(counter)).toBeTruthy();
    clickReject(dialog);

    await expectSent(dialog);
    expect(postedBody(mock)).toEqual({
      expectedStage: 'interview',
      reason: 'candidate_withdrew',
      note: sent,
    });
    expect(posts(mock)).toBe(1);
  });

  it('EC-37 solo espacios → cuerpo sin note', async () => {
    const mock = renderOk();
    const { dialog } = await openRejectDialog();
    pickReason(dialog, 'Otro');
    typeNote(dialog, ' \n\t  ');

    expect(within(dialog).getByText('0/500')).toBeTruthy();
    clickReject(dialog);

    await expectSent(dialog);
    expect(postedBody(mock)).toEqual({ expectedStage: 'interview', reason: 'other' });
    expect(posts(mock)).toBe(1);
  });

  it('EC-37 sin nota → cuerpo sin note', async () => {
    const mock = renderOk();
    const { dialog } = await openRejectDialog();
    pickReason(dialog, NOT_A_FIT);

    clickReject(dialog);

    await expectSent(dialog);
    expect(postedBody(mock)).toEqual({ expectedStage: 'interview', reason: 'not_a_fit' });
  });
});
