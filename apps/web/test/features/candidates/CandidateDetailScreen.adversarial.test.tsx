import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BAD_RESPONSE_MESSAGE } from '../../../src/components/http.ts';
import { CandidateDetailScreen } from '../../../src/features/candidates/CandidateDetailScreen.tsx';
import type { Candidate } from '../../../src/features/candidates/types.ts';
import { installDialogPolyfill } from '../../helpers/dialog.ts';
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

const GET_CANDIDATE = 'GET /api/candidates/7';
const CONSENT = 'POST /api/candidates/7/consent';
const WITHDRAWAL = 'POST /api/candidates/7/consent/withdrawal';
const GENERIC = 'Error interno. Inténtalo de nuevo.';

let restoreDialog: () => void = () => undefined;

function envelope(code: string, message: string) {
  return { error: { code, message } };
}

async function renderDetail(candidate: Candidate, routes: Record<string, MockRoute> = {}) {
  const mock = mockFetch({ [GET_CANDIDATE]: { status: 200, json: candidate }, ...routes });
  const view = render(<CandidateDetailScreen />);
  await screen.findByRole('heading', { level: 1, name: candidate.fullName });
  return { mock, container: view.container };
}

function section(): HTMLElement {
  return screen.getByRole('region', { name: 'Consentimiento para futuros procesos' });
}

function checkbox(): HTMLInputElement {
  return within(section()).getByRole('checkbox', { name: 'El candidato da su consentimiento' });
}

function renewButton(): HTMLButtonElement {
  return within(section()).getByRole('button', { name: 'Renovar consentimiento' });
}

function posts(mock: { calls: { method: string; url: string }[] }): string[] {
  return mock.calls.filter((call) => call.method === 'POST').map((call) => call.url);
}

function summaryText(): string {
  return section().querySelector('.consent-summary')?.textContent ?? '';
}

function retentionEnd(): string {
  return screen.getAllByRole('definition').at(-1)?.textContent ?? '';
}

describe('CandidateDetailScreen · HTML y título (RNF-06, RNF-09)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/candidates/7');
    document.title = 'ATS';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('EC-40 / RNF-06 resumen con <script>, nombre con <b> y skill con <i> se ven como texto literal', async () => {
    const hostile: Candidate = {
      ...NEVER,
      fullName: '<b>x</b> Prueba',
      summary: '<script>alert(1)</script>',
      skills: ['<i>x</i>'],
    };

    const { container } = await renderDetail(hostile);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('<b>x</b> Prueba');
    expect(screen.getByText('<script>alert(1)</script>')).toBeDefined();
    expect(screen.getByText('<i>x</i>')).toBeDefined();
    expect(container.querySelectorAll('script, b, i, img').length).toBe(0);
  });

  it('EC-40 / RNF-09 el título es «Ficha de candidato · ATS» y no lleva el nombre', async () => {
    await renderDetail({ ...NEVER, fullName: '<img src=x onerror=alert(1)>' });

    await waitFor(() => expect(document.title).toBe('Ficha de candidato · ATS'));
    expect(document.title).not.toContain('img');
    expect(window.location.pathname).toBe('/candidates/7');
    expect(window.location.search).toBe('');
    expect(JSON.stringify(window.history.state ?? null)).not.toContain('img');
  });
});

describe('CandidateDetailScreen · consentimiento frente a fallos', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/candidates/7');
    restoreDialog = installDialogPolyfill();
  });

  afterEach(() => {
    cleanup();
    restoreDialog();
    vi.unstubAllGlobals();
  });

  it('EC-49 doble clic en la casilla → un solo POST /consent', async () => {
    const { mock } = await renderDetail(NEVER, { [CONSENT]: { hang: true } });

    fireEvent.click(checkbox());
    fireEvent.click(checkbox());
    fireEvent.click(checkbox());

    await waitFor(() => expect(checkbox().disabled).toBe(true));
    expect(posts(mock)).toEqual(['/api/candidates/7/consent']);
  });

  it('EC-49 doble clic en «Renovar consentimiento» → un solo POST /consent', async () => {
    const { mock } = await renderDetail(ACTIVE, { [CONSENT]: { hang: true } });
    const renew = renewButton();

    fireEvent.click(renew);
    fireEvent.click(renew);
    fireEvent.click(renew);

    await waitFor(() => expect(renew.disabled).toBe(true));
    expect(posts(mock)).toEqual(['/api/candidates/7/consent']);
  });

  it('CA-29 / EC-48 404 al registrar → alerta con el message de la API y la ficha no cambia', async () => {
    const message = 'El candidato no existe.';
    await renderDetail(NEVER, {
      [CONSENT]: { status: 404, json: envelope('CANDIDATE_NOT_FOUND', message) },
    });

    fireEvent.click(checkbox());

    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(screen.getByRole('heading', { level: 1, name: NEVER.fullName })).toBeDefined();
    expect(checkbox().checked).toBe(false);
    expect(summaryText()).toBe('No consta consentimiento para futuros procesos.');
    expect(retentionEnd()).toBe('Mientras dure el proceso');
    expect(screen.queryByRole('button', { name: 'Renovar consentimiento' })).toBeNull();
  });

  it('CA-30 / EC-45 500 al registrar → alerta genérica; casilla, resumen y retención como estaban', async () => {
    await renderDetail(NEVER, {
      [CONSENT]: { status: 500, json: envelope('INTERNAL_ERROR', GENERIC) },
    });
    const before = { summary: summaryText(), retention: retentionEnd() };

    fireEvent.click(checkbox());

    expect((await screen.findByRole('alert')).textContent).toBe(GENERIC);
    expect(checkbox().checked).toBe(false);
    expect(checkbox().disabled).toBe(false);
    expect(summaryText()).toBe(before.summary);
    expect(retentionEnd()).toBe(before.retention);
    expect(screen.queryByText('Consentimiento registrado.')).toBeNull();
  });

  it('CA-30 / EC-53 500 al renovar → alerta genérica; casilla, resumen y fin de retención como estaban', async () => {
    await renderDetail(ACTIVE, {
      [CONSENT]: { status: 500, json: envelope('INTERNAL_ERROR', GENERIC) },
    });
    const before = { summary: summaryText(), retention: retentionEnd() };

    fireEvent.click(renewButton());

    expect((await screen.findByRole('alert')).textContent).toBe(GENERIC);
    expect(checkbox().checked).toBe(true);
    expect(summaryText()).toBe(before.summary);
    expect(retentionEnd()).toBe(before.retention);
    expect(renewButton().disabled).toBe(false);
    expect(screen.queryByText('Consentimiento renovado.')).toBeNull();
  });

  it('CA-30 / EC-56 500 al retirar → el error se queda dentro del diálogo y la ficha no cambia', async () => {
    await renderDetail(ACTIVE, {
      [WITHDRAWAL]: { status: 500, json: envelope('INTERNAL_ERROR', GENERIC) },
    });
    const before = { summary: summaryText(), retention: retentionEnd() };
    fireEvent.click(checkbox());
    const dialog = screen.getByRole('dialog', { name: '¿Retirar el consentimiento?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirar' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toBe(GENERIC);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(checkbox().checked).toBe(true);
    expect(summaryText()).toBe(before.summary);
    expect(retentionEnd()).toBe(before.retention);
    expect(screen.queryByText('Consentimiento retirado.')).toBeNull();
  });

  it('EC-56 404 al retirar → el message de la API queda dentro del diálogo', async () => {
    const message = 'El candidato no existe.';
    await renderDetail(ACTIVE, {
      [WITHDRAWAL]: { status: 404, json: envelope('CANDIDATE_NOT_FOUND', message) },
    });
    fireEvent.click(checkbox());
    const dialog = screen.getByRole('dialog', { name: '¿Retirar el consentimiento?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirar' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(message);
    expect(checkbox().checked).toBe(true);
  });
});

describe('CandidateDetailScreen · respuesta con forma inesperada (CLIENT_BAD_RESPONSE)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/candidates/7');
    restoreDialog = installDialogPolyfill();
  });

  afterEach(() => {
    cleanup();
    restoreDialog();
    vi.unstubAllGlobals();
  });

  it('un 200 sin los campos de la ficha → error con «Reintentar» y sin datos a medias', async () => {
    mockFetch({ [GET_CANDIDATE]: { status: 200, json: { id: 7, fullName: 'Solo nombre' } } });

    render(<CandidateDetailScreen />);

    expect((await screen.findByRole('alert')).textContent).toBe(BAD_RESPONSE_MESSAGE);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('definition')).toBeNull();
  });

  it('un 200 que no es JSON → error con «Reintentar»', async () => {
    mockFetch({ [GET_CANDIDATE]: { status: 200, text: '<html>no es JSON</html>' } });

    render(<CandidateDetailScreen />);

    expect((await screen.findByRole('alert')).textContent).toBe(BAD_RESPONSE_MESSAGE);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('un 200 con un tipo equivocado al registrar → alerta CLIENT_BAD_RESPONSE y la ficha no cambia', async () => {
    await renderDetail(NEVER, {
      [CONSENT]: { status: 200, json: { ...ACTIVE, skills: 'node' } },
    });

    fireEvent.click(checkbox());

    expect((await screen.findByRole('alert')).textContent).toBe(BAD_RESPONSE_MESSAGE);
    expect(checkbox().checked).toBe(false);
    expect(summaryText()).toBe('No consta consentimiento para futuros procesos.');
    expect(screen.queryByText('Consentimiento registrado.')).toBeNull();
  });

  it('un 200 con forma inesperada al renovar → alerta CLIENT_BAD_RESPONSE y la ficha no cambia', async () => {
    await renderDetail(ACTIVE, { [CONSENT]: { status: 200, json: { ok: true } } });
    const before = { summary: summaryText(), retention: retentionEnd() };

    fireEvent.click(renewButton());

    expect((await screen.findByRole('alert')).textContent).toBe(BAD_RESPONSE_MESSAGE);
    expect(summaryText()).toBe(before.summary);
    expect(retentionEnd()).toBe(before.retention);
    expect(checkbox().checked).toBe(true);
  });

  it('un 200 con forma inesperada al retirar → el error se queda dentro del diálogo', async () => {
    await renderDetail(ACTIVE, { [WITHDRAWAL]: { status: 200, json: [] } });
    fireEvent.click(checkbox());
    const dialog = screen.getByRole('dialog', { name: '¿Retirar el consentimiento?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirar' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(BAD_RESPONSE_MESSAGE);
    expect(checkbox().checked).toBe(true);
    expect(summaryText()).toContain('Vigente');
  });
});
