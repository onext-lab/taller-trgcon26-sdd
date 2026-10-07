import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import {
  INVALID_TRANSITION_MESSAGE,
  NOT_FOUND_MESSAGE,
  STAGE_MISMATCH_MESSAGE,
} from '../../../src/features/applications/stage-errors.ts';
import { installDialogPolyfill, simulateCancel } from '../../helpers/dialog.ts';
import type { MockReply } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import { envelope } from './enroll-fixtures.ts';
import {
  clickReject,
  gets,
  openRejectDialog,
  pickReason,
  postedBody,
  posts,
  renderReject,
  SERVER_TEXT,
  typeNote,
} from './reject-fixtures.ts';
import { rejected } from './stage-fixtures.ts';

const NOTE_HELP =
  'No incluyas datos sensibles (salud, origen, ideología, religión…) ni nada que no sea necesario para la decisión.';

let restoreDialog: () => void = () => undefined;

function column(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

function describedBy(control: HTMLElement): string[] {
  const ids = (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
  return ids.map((id) => document.getElementById(id)?.textContent ?? '');
}

function withDetails(field: string, message: string): MockReply {
  const error = {
    code: 'VALIDATION_ERROR',
    message: 'Datos no válidos.',
    details: [{ field, message }],
  };
  return { status: 400, json: { error } };
}

describe('PipelineScreen: rechazar', () => {
  beforeEach(() => {
    restoreDialog = installDialogPolyfill();
  });

  afterEach(() => {
    cleanup();
    restoreDialog();
    vi.unstubAllGlobals();
  });

  it('CA-13 diálogo Rechazar la inscripción: group Motivo con 3 radio sin marcar, textbox Nota (opcional) con el aviso y 0/500 en su descripción, foco en Cancelar', async () => {
    const mock = renderReject({ status: 200, json: rejected() });

    const { dialog } = await openRejectDialog();

    const group = within(dialog).getByRole('group', { name: 'Motivo' });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((radio) => radio.labels?.[0]?.textContent?.trim())).toEqual([
      'No encaja con el perfil',
      'Retirada del candidato',
      'Otro',
    ]);
    expect(radios.every((radio) => !radio.checked)).toBe(true);
    expect(within(dialog).queryByRole('radio', { name: 'Oferta cerrada' })).toBeNull();
    const note = within(dialog).getByRole('textbox', { name: 'Nota (opcional)' });
    expect(describedBy(note)).toEqual([NOTE_HELP, '0/500']);
    expect(note.hasAttribute('maxlength')).toBe(false);
    expect(dialog.querySelector('[aria-live]')).toBeNull();
    await expectFocusOn(() => within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(posts(mock)).toBe(0);
  });

  it('CA-13 No encaja con el perfil + nota → aviso Inscripción rechazada. con foco y tarjeta en Rechazado con Motivo: No encaja con el perfil y sin la nota', async () => {
    const mock = renderReject({ status: 200, json: rejected() });
    const { dialog } = await openRejectDialog();

    pickReason(dialog, 'No encaja con el perfil');
    typeNote(dialog, 'Sin experiencia en React.\nNo cubre el nivel.');
    clickReject(dialog);

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Inscripción rechazada.');
    await expectFocusOn(() => screen.getByRole('status'));
    expect(postedBody(mock)).toEqual({
      expectedStage: 'interview',
      reason: 'not_a_fit',
      note: 'Sin experiencia en React.\nNo cubre el nivel.',
    });
    expect(posts(mock)).toBe(1);
    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    const name = await within(column('Rechazado')).findByText('Oriol Mas Puig');
    const card = name.closest('li') as HTMLElement;
    expect(within(card).getByText('Motivo: No encaja con el perfil')).toBeTruthy();
    expect(card.textContent).not.toContain('Sin experiencia');
    expect(within(card).queryAllByRole('button')).toHaveLength(0);
    expect(within(column('Entrevista')).queryByText('Oriol Mas Puig')).toBeNull();
    expect(document.body.textContent).not.toContain('Sin experiencia');
    expect(gets(mock)).toBe(2);
  });

  it.each([
    [
      'Cancelar',
      (dialog: HTMLDialogElement) =>
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' })),
    ],
    ['Escape', (dialog: HTMLDialogElement) => simulateCancel(dialog)],
  ])('RNF-08 %s descarta motivo y nota y devuelve el foco a Rechazar', async (_name, dismiss) => {
    const mock = renderReject({ status: 200, json: rejected() });
    const { trigger, dialog } = await openRejectDialog();
    pickReason(dialog, 'Otro');
    typeNote(dialog, 'Nota que se descarta.');

    act(() => dismiss(dialog));

    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    await expectFocusOn(() => trigger);
    expect(posts(mock)).toBe(0);
    expect(screen.queryByRole('status')).toBeNull();
    expect(gets(mock)).toBe(1);

    const again = await openRejectDialog();
    expect(
      (within(again.dialog).getByRole('radio', { name: 'Otro' }) as HTMLInputElement).checked,
    ).toBe(false);
    const note = within(again.dialog).getByRole('textbox', { name: 'Nota (opcional)' });
    expect((note as HTMLTextAreaElement).value).toBe('');
    expect(describedBy(note)[1]).toBe('0/500');
  });

  it.each([
    ['red', { networkError: true } as MockReply, CONNECTION_MESSAGE],
    ['500', envelope(500, 'INTERNAL_ERROR', SERVER_TEXT), SERVER_TEXT],
  ])(
    'EC-38 %s → diálogo abierto con motivo y nota y role=alert dentro del dialog, sin recarga',
    async (_name, reply, text) => {
      const mock = renderReject(reply);
      const { dialog } = await openRejectDialog();
      pickReason(dialog, 'Retirada del candidato');
      typeNote(dialog, 'Ha aceptado otra oferta.');

      clickReject(dialog);

      const alert = await within(dialog).findByRole('alert');
      expect(alert.textContent).toBe(text);
      expect(dialog.hasAttribute('open')).toBe(true);
      expect(
        (within(dialog).getByRole('radio', { name: 'Retirada del candidato' }) as HTMLInputElement)
          .checked,
      ).toBe(true);
      const note = within(dialog).getByRole('textbox', {
        name: 'Nota (opcional)',
      }) as HTMLTextAreaElement;
      expect(note.value).toBe('Ha aceptado otra oferta.');
      expect(document.activeElement).not.toBe(alert);
      expect(screen.queryByRole('status')).toBeNull();
      expect(gets(mock)).toBe(1);
      expect(within(column('Entrevista')).getByText('Oriol Mas Puig')).toBeTruthy();
      for (const name of ['Cancelar', 'Rechazar']) {
        expect(within(dialog).getByRole('button', { name }).hasAttribute('disabled')).toBe(false);
      }
    },
  );

  it.each([
    ['STAGE_MISMATCH', 409, STAGE_MISMATCH_MESSAGE],
    ['INVALID_TRANSITION', 409, INVALID_TRANSITION_MESSAGE],
    ['NOT_FOUND', 404, NOT_FOUND_MESSAGE],
  ])('EC-39 %s → diálogo cerrado, alerta con foco y recarga', async (code, status, text) => {
    const mock = renderReject(envelope(status, code, 'Texto del servidor que no se pinta.'));
    const { dialog } = await openRejectDialog();
    pickReason(dialog, 'No encaja con el perfil');
    typeNote(dialog, 'Nota que se descarta.');

    clickReject(dialog);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(text);
    await expectFocusOn(() => screen.getByRole('alert'));
    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    expect(screen.queryByText('Texto del servidor que no se pinta.')).toBeNull();
    await waitFor(() => expect(gets(mock)).toBe(2));
    expect(await within(column('Rechazado')).findByText('Oriol Mas Puig')).toBeTruthy();
    const again = await openRejectDialog().catch(() => null);
    expect(again).toBeNull();
  });

  it('400 con details de note → error junto a la nota y diálogo abierto', async () => {
    const mock = renderReject(withDetails('note', 'La nota no es válida.'));
    const { dialog } = await openRejectDialog();
    pickReason(dialog, 'Otro');
    typeNote(dialog, 'Una nota.');

    clickReject(dialog);

    const note = within(dialog).getByRole('textbox', { name: 'Nota (opcional)' });
    await expectFocusOn(() => note);
    expect(within(dialog).getByText('La nota no es válida.').className).toBe('error-text');
    expect(note.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(note)).toContain('La nota no es válida.');
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect((note as HTMLTextAreaElement).value).toBe('Una nota.');
    expect(gets(mock)).toBe(1);
    expect(posts(mock)).toBe(1);
  });

  it('400 con details de reason y de otro campo → error junto a los radio, foco en el primero y el resto en el alert', async () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: 'Datos no válidos.',
      details: [
        { field: 'reason', message: 'El motivo no es válido.' },
        { field: 'body', message: 'Cuerpo no válido.' },
      ],
    };
    renderReject({ status: 400, json: { error } });
    const { dialog } = await openRejectDialog();
    pickReason(dialog, 'Otro');

    clickReject(dialog);

    await expectFocusOn(() =>
      within(dialog).getByRole('radio', { name: 'No encaja con el perfil' }),
    );
    expect(within(dialog).getByText('El motivo no es válido.')).toBeTruthy();
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Cuerpo no válido.');
    for (const radio of within(dialog).getAllByRole('radio')) {
      expect(radio.getAttribute('aria-invalid')).toBe('true');
      expect(radio.getAttribute('aria-describedby')).toBe('reject-reason-error');
    }
  });
});
