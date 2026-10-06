import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import { CandidateDetailScreen } from '../../../src/features/candidates/CandidateDetailScreen.tsx';
import type { Candidate } from '../../../src/features/candidates/types.ts';
import { installDialogPolyfill, simulateCancel } from '../../helpers/dialog.ts';
import { mockFetch, type MockRoute } from '../../helpers/fetch.ts';

// Invented data only.
const NEVER: Candidate = {
  id: 7,
  fullName: 'Lucía Ejemplo Prueba',
  email: 'lucia.ejemplo@example.com',
  phone: null,
  summary: null,
  skills: ['node'],
  createdAt: '2026-09-01T09:00:00.000Z',
  consentGivenAt: null,
  consentVersion: null,
  consentWithdrawnAt: null,
  retentionEndsAt: null,
};

const ACTIVE: Candidate = {
  ...NEVER,
  consentGivenAt: '2026-10-06T22:30:00.000Z',
  consentVersion: 'v1',
  retentionEndsAt: '2028-10-06',
};

// Withdrawn long ago: the new retention end is already in the past and it is shown all the same (EC-43).
const WITHDRAWN_PAST: Candidate = {
  ...ACTIVE,
  consentWithdrawnAt: '2026-10-07T08:00:00.000Z',
  retentionEndsAt: '2026-04-01',
};

const GET_CANDIDATE = 'GET /api/candidates/7';
const CONSENT = 'POST /api/candidates/7/consent';
const WITHDRAWAL = 'POST /api/candidates/7/consent/withdrawal';

let restoreDialog: () => void = () => undefined;

function envelope(code: string, message: string) {
  return { error: { code, message } };
}

async function renderDetail(candidate: Candidate, routes: Record<string, MockRoute> = {}) {
  const mock = mockFetch({ [GET_CANDIDATE]: { status: 200, json: candidate }, ...routes });
  render(<CandidateDetailScreen />);
  await screen.findByRole('heading', { level: 1, name: candidate.fullName });
  return mock;
}

function section(): HTMLElement {
  return screen.getByRole('region', { name: 'Consentimiento para futuros procesos' });
}

function checkbox(): HTMLInputElement {
  return within(section()).getByRole('checkbox', { name: 'El candidato da su consentimiento' });
}

function renewButton(name = 'Renovar consentimiento'): HTMLButtonElement {
  return within(section()).getByRole('button', { name }) as HTMLButtonElement;
}

function openWithdrawDialog(): HTMLDialogElement {
  fireEvent.click(checkbox());
  return screen.getByRole('dialog', { name: '¿Retirar el consentimiento?' }) as HTMLDialogElement;
}

function posts(mock: { calls: { method: string; url: string }[] }): string[] {
  return mock.calls.filter((call) => call.method === 'POST').map((call) => call.url);
}

describe('CandidateDetailScreen · consentimiento', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/candidates/7');
    restoreDialog = installDialogPolyfill();
  });

  afterEach(() => {
    cleanup();
    restoreDialog();
    vi.unstubAllGlobals();
  });

  it('marcar la casilla envía POST /consent sin cuerpo y la deshabilita con «Registrando el consentimiento…» (CA-25)', async () => {
    const mock = await renderDetail(NEVER, { [CONSENT]: { hang: true } });

    fireEvent.click(checkbox());

    await waitFor(() => expect(checkbox().disabled).toBe(true));
    expect(screen.getByRole('status').textContent).toBe('Registrando el consentimiento…');
    expect(checkbox().checked).toBe(false);
    const post = mock.calls.find((call) => call.method === 'POST');
    expect(post?.url).toBe('/api/candidates/7/consent');
    expect(post?.body).toBeUndefined();
    expect(post?.headers['content-type']).toBeUndefined();
  });

  it('al registrar muestra el aviso, la fecha, la versión y el nuevo fin de retención, y el foco vuelve a la casilla (CA-25)', async () => {
    const mock = await renderDetail(NEVER, { [CONSENT]: { status: 200, json: ACTIVE } });

    fireEvent.click(checkbox());

    expect((await screen.findByRole('status')).textContent).toBe('Consentimiento registrado.');
    expect(
      screen.getByText('Vigente: otorgado el 07/10/2026 con la versión v1 del texto.'),
    ).toBeDefined();
    expect(checkbox().checked).toBe(true);
    expect(checkbox().disabled).toBe(false);
    expect(screen.getAllByRole('definition').at(-1)?.textContent).toBe('06/10/2028');
    expect(renewButton()).toBeDefined();
    expect(posts(mock)).toEqual(['/api/candidates/7/consent']);
    await waitFor(() => expect(document.activeElement).toBe(checkbox()));
  });

  it('un fallo al registrar muestra la alerta, no cambia la ficha y devuelve el foco a la casilla (CA-24)', async () => {
    await renderDetail(NEVER, { [CONSENT]: { networkError: true } });

    fireEvent.click(checkbox());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(CONNECTION_MESSAGE);
    expect(alert.closest('section')).toBe(section());
    expect(checkbox().checked).toBe(false);
    expect(screen.getByText('No consta consentimiento para futuros procesos.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Renovar consentimiento' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(checkbox()));
  });

  it('desmarcar abre «¿Retirar el consentimiento?» con el foco en «Cancelar» y el aviso de retención (CA-26, EC-43)', async () => {
    const mock = await renderDetail(ACTIVE);

    const dialog = openWithdrawDialog();

    const cancel = within(dialog).getByRole('button', { name: 'Cancelar' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    expect(within(dialog).getByRole('button', { name: 'Retirar' })).toBeDefined();
    expect(dialog.textContent).toContain(
      'La fecha de fin de retención se recalculará sin el consentimiento y puede quedar ya vencida.',
    );
    expect(posts(mock)).toEqual([]);
    expect(checkbox().checked).toBe(true);
  });

  it('«Cancelar» cierra el diálogo sin petición y devuelve el foco a la casilla (CA-26)', async () => {
    const mock = await renderDetail(ACTIVE);
    const dialog = openWithdrawDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    expect(posts(mock)).toEqual([]);
    expect(checkbox().checked).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(checkbox()));
  });

  it('Escape cierra el diálogo sin petición y nada cambia (CA-26)', async () => {
    const mock = await renderDetail(ACTIVE);
    const dialog = openWithdrawDialog();

    simulateCancel(dialog);

    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    expect(posts(mock)).toEqual([]);
    expect(checkbox().checked).toBe(true);
    expect(
      screen.getByText('Vigente: otorgado el 07/10/2026 con la versión v1 del texto.'),
    ).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(checkbox()));
  });

  it('«Retirar» envía POST /consent/withdrawal y muestra la retirada con la fecha de retención ya pasada (CA-26, EC-43)', async () => {
    const mock = await renderDetail(ACTIVE, {
      [WITHDRAWAL]: { status: 200, json: WITHDRAWN_PAST },
    });
    const dialog = openWithdrawDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirar' }));

    expect((await screen.findByRole('status')).textContent).toBe('Consentimiento retirado.');
    expect(posts(mock)).toEqual(['/api/candidates/7/consent/withdrawal']);
    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    expect(
      screen.getByText(
        'Retirado el 07/10/2026. Se otorgó el 07/10/2026 con la versión v1 del texto.',
      ),
    ).toBeDefined();
    expect(checkbox().checked).toBe(false);
    expect(screen.queryByRole('button', { name: 'Renovar consentimiento' })).toBeNull();
    expect(screen.getAllByRole('definition').at(-1)?.textContent).toBe('01/04/2026');
    await waitFor(() => expect(document.activeElement).toBe(checkbox()));
  });

  it('un fallo al retirar se queda dentro del diálogo y la ficha no cambia (CA-26)', async () => {
    await renderDetail(ACTIVE, {
      [WITHDRAWAL]: {
        status: 500,
        json: envelope('INTERNAL_ERROR', 'Error interno. Inténtalo de nuevo.'),
      },
    });
    const dialog = openWithdrawDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirar' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(checkbox().checked).toBe(true);
    expect(within(dialog).getByRole('button', { name: 'Retirar' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('«Renovar consentimiento» envía POST /consent y pasa por «Renovando…» deshabilitado (CA-27)', async () => {
    const mock = await renderDetail(ACTIVE, { [CONSENT]: { hang: true } });

    fireEvent.click(renewButton());

    await waitFor(() => expect(renewButton('Renovando…').disabled).toBe(true));
    expect(checkbox().disabled).toBe(true);
    expect(posts(mock)).toEqual(['/api/candidates/7/consent']);
  });

  it('al renovar muestra «Consentimiento renovado.» con la nueva fecha y el foco vuelve a «Renovar» (CA-27)', async () => {
    const renewed: Candidate = {
      ...ACTIVE,
      consentGivenAt: '2026-12-01T10:00:00.000Z',
      retentionEndsAt: '2028-12-01',
    };
    await renderDetail(ACTIVE, { [CONSENT]: { status: 200, json: renewed } });

    fireEvent.click(renewButton());

    expect((await screen.findByRole('status')).textContent).toBe('Consentimiento renovado.');
    expect(
      screen.getByText('Vigente: otorgado el 01/12/2026 con la versión v1 del texto.'),
    ).toBeDefined();
    expect(screen.getAllByRole('definition').at(-1)?.textContent).toBe('01/12/2028');
    await waitFor(() => expect(document.activeElement).toBe(renewButton()));
  });

  it('un fallo al renovar muestra la alerta de la sección y devuelve el foco a «Renovar» (CA-27)', async () => {
    await renderDetail(ACTIVE, { [CONSENT]: { networkError: true } });

    fireEvent.click(renewButton());

    expect((await screen.findByRole('alert')).textContent).toBe(CONNECTION_MESSAGE);
    expect(renewButton().disabled).toBe(false);
    expect(checkbox().checked).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(renewButton()));
  });

  it('con el consentimiento retirado, marcar la casilla registra y nunca retira (CA-28)', async () => {
    const mock = await renderDetail(WITHDRAWN_PAST, { [CONSENT]: { status: 200, json: ACTIVE } });
    expect(checkbox().checked).toBe(false);

    fireEvent.click(checkbox());

    expect((await screen.findByRole('status')).textContent).toBe('Consentimiento registrado.');
    expect(posts(mock)).toEqual(['/api/candidates/7/consent']);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(checkbox().checked).toBe(true);
  });

  it('sin consentimiento previo, marcar registra sin abrir el diálogo de retirada (CA-28)', async () => {
    const mock = await renderDetail(NEVER, { [CONSENT]: { status: 200, json: ACTIVE } });

    fireEvent.click(checkbox());

    await screen.findByText('Consentimiento registrado.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(posts(mock)).toEqual(['/api/candidates/7/consent']);
  });
});
