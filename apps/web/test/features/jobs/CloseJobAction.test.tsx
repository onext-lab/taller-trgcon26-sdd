import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { BAD_RESPONSE_MESSAGE, CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import { JobDetailScreen } from '../../../src/features/jobs/JobDetailScreen.tsx';
import type { Job } from '../../../src/features/jobs/types.ts';
import { installDialogPolyfill, simulateCancel } from '../../helpers/dialog.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import { mockFetch, type MockRoute } from '../../helpers/fetch.ts';

// Invented data only.
const PUBLISHED: Job = {
  id: 7,
  title: 'Desarrollador/a backend (Node.js)',
  description: 'Equipo pequeño.',
  location: 'Valencia',
  workMode: 'híbrida',
  salaryMin: 40000,
  salaryMax: 48000,
  status: 'published',
  createdAt: '2026-09-30T09:00:00.000Z',
  publishedAt: '2026-10-01T09:00:00.000Z',
  closedAt: null,
};

const CLOSED: Job = { ...PUBLISHED, status: 'closed', closedAt: '2026-10-06T22:30:00.000Z' };

const GET_JOB = 'GET /api/jobs/7';
const PREVIEW = 'GET /api/jobs/7/close-preview';
const CLOSE = 'POST /api/jobs/7/close';

let restoreDialog: () => void = () => undefined;

function envelope(code: string, message: string) {
  return { error: { code, message } };
}

const previewOf = (activeApplications: number): MockRoute => ({
  status: 200,
  json: { activeApplications },
});

async function renderDetail(routes: Record<string, MockRoute>) {
  const mock = mockFetch({ [GET_JOB]: { status: 200, json: PUBLISHED }, ...routes });
  render(<JobDetailScreen />);
  await screen.findByRole('heading', { level: 1, name: PUBLISHED.title });
  return mock;
}

// `fireEvent.click` does not move the focus, so focus the trigger first, as a person would.
function openDialog(): HTMLDialogElement {
  const trigger = screen.getByRole('button', { name: 'Cerrar' });
  trigger.focus();
  fireEvent.click(trigger);
  return screen.getByRole('dialog', { name: '¿Cerrar la oferta?' }) as HTMLDialogElement;
}

function button(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function postCalls(mock: { calls: { method: string }[] }): number {
  return mock.calls.filter((call) => call.method === 'POST').length;
}

function previewSignal(): AbortSignal {
  const calls = (fetch as unknown as Mock).mock.calls as [string, RequestInit][];
  const call = calls.find(([url]) => url === '/api/jobs/7/close-preview');
  return call?.[1].signal as AbortSignal;
}

describe('CloseJobAction', () => {
  beforeEach(() => {
    restoreDialog = installDialogPolyfill();
    window.history.replaceState(null, '', '/jobs/7');
  });

  afterEach(() => {
    cleanup();
    restoreDialog();
    vi.unstubAllGlobals();
  });

  it('CA-05, EC-11: abre al instante con el foco en «Cancelar» y espera el número', async () => {
    await renderDetail({ [PREVIEW]: previewOf(0) });

    const dialog = openDialog();

    expect(dialog.textContent).toContain(
      'Una oferta cerrada no se puede reabrir: para volver a publicarla, duplícala.',
    );
    expect(document.activeElement).toBe(button('Cancelar'));
    expect(within(dialog).getByRole('status').textContent).toBe(
      'Comprobando las inscripciones activas…',
    );
    expect(button('Cerrar oferta').disabled).toBe(true);

    await waitFor(() =>
      expect(within(dialog).getByRole('status').textContent).toBe(
        'Se rechazarán 0 inscripciones activas.',
      ),
    );
    expect(button('Cerrar oferta').disabled).toBe(false);
    expect(button('Cancelar').disabled).toBe(false);
  });

  it('con 1 inscripción activa usa el singular (DD-04)', async () => {
    await renderDetail({ [PREVIEW]: previewOf(1) });

    const dialog = openDialog();

    await within(dialog).findByText('Se rechazará 1 inscripción activa.');
  });

  it('el diálogo no nombra la oferta (EC-15)', async () => {
    await renderDetail({ [PREVIEW]: previewOf(0) });

    const dialog = openDialog();

    expect(dialog.textContent).not.toContain(PUBLISHED.title);
  });

  it('CA-06: «Cancelar» cierra sin POST, aborta la lectura y devuelve el foco a «Cerrar»', async () => {
    const mock = await renderDetail({ [PREVIEW]: { hang: true } });
    const dialog = openDialog();
    expect(previewSignal().aborted).toBe(false);

    fireEvent.click(button('Cancelar'));

    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    expect(previewSignal().aborted).toBe(true);
    expect(document.activeElement).toBe(button('Cerrar'));
    expect(postCalls(mock)).toBe(0);
    expect(screen.getByText('Publicada')).toBeDefined();
  });

  it('CA-06: Escape cierra sin POST, aborta la lectura y devuelve el foco a «Cerrar»', async () => {
    const mock = await renderDetail({ [PREVIEW]: { hang: true } });
    const dialog = openDialog();

    act(() => simulateCancel(dialog));

    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    expect(previewSignal().aborted).toBe(true);
    expect(document.activeElement).toBe(button('Cerrar'));
    expect(postCalls(mock)).toBe(0);
  });

  it('CA-05: confirmar envía POST sin cuerpo y la ficha pasa a «Cerrada» con aviso y foco en el h1', async () => {
    const mock = await renderDetail({
      [PREVIEW]: previewOf(0),
      [CLOSE]: { status: 200, json: CLOSED },
    });
    openDialog();
    await waitFor(() => expect(button('Cerrar oferta').disabled).toBe(false));

    fireEvent.click(button('Cerrar oferta'));

    const notice = await screen.findByText('Oferta cerrada.');
    expect(notice.getAttribute('role')).toBe('status');
    const close = mock.calls.filter((call) => call.method === 'POST');
    expect(close).toHaveLength(1);
    expect(close[0]).toMatchObject({ url: '/api/jobs/7/close', body: undefined });
    expect(close[0]?.headers['content-type']).toBeUndefined();
    expect(screen.getByText('Cerrada')).toBeDefined();
    expect(screen.getByText('Fecha de cierre')).toBeDefined();
    expect(screen.getByText('07/10/2026')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await expectFocusOn(() => screen.getByRole('heading', { level: 1 }));
    expect(mock.calls.filter((call) => call.url === '/api/jobs/7')).toHaveLength(1);
  });

  it('EC-13: un 200 con el cierre de antes se trata como éxito y pinta esa fecha', async () => {
    const earlier: Job = { ...CLOSED, closedAt: '2026-10-02T09:00:00.000Z' };
    await renderDetail({ [PREVIEW]: previewOf(0), [CLOSE]: { status: 200, json: earlier } });
    openDialog();
    await waitFor(() => expect(button('Cerrar oferta').disabled).toBe(false));

    fireEvent.click(button('Cerrar oferta'));

    await screen.findByText('Oferta cerrada.');
    expect(screen.getByText('02/10/2026')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-09, EC-12: un 500 al cerrar muestra la alerta en el diálogo y reactiva los botones', async () => {
    const mock = await renderDetail({
      [PREVIEW]: previewOf(0),
      [CLOSE]: {
        status: 500,
        json: envelope('INTERNAL_ERROR', 'Error interno. Inténtalo de nuevo.'),
      },
    });
    const dialog = openDialog();
    await waitFor(() => expect(button('Cerrar oferta').disabled).toBe(false));

    fireEvent.click(button('Cerrar oferta'));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect(button('Cerrar oferta').disabled).toBe(false);
    expect(button('Cancelar').disabled).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(postCalls(mock)).toBe(1);
    fireEvent.click(button('Cancelar'));
    expect(screen.getByText('Publicada')).toBeDefined();
    expect(screen.queryByText('Fecha de cierre')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('EC-43: un error de red al cerrar muestra el mensaje de conexión en el diálogo', async () => {
    const dialogRoutes = { [PREVIEW]: previewOf(0), [CLOSE]: { networkError: true } as const };
    await renderDetail(dialogRoutes);
    const dialog = openDialog();
    await waitFor(() => expect(button('Cerrar oferta').disabled).toBe(false));

    fireEvent.click(button('Cerrar oferta'));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toBe(CONNECTION_MESSAGE);
    expect(button('Cerrar oferta').disabled).toBe(false);
  });

  it('un 500 al pedir el número muestra la alerta y deja «Cerrar oferta» deshabilitado', async () => {
    await renderDetail({
      [PREVIEW]: {
        status: 500,
        json: envelope('INTERNAL_ERROR', 'Error interno. Inténtalo de nuevo.'),
      },
    });
    const dialog = openDialog();

    const alert = await within(dialog).findByRole('alert');

    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(button('Cerrar oferta').disabled).toBe(true);
    expect(button('Cancelar').disabled).toBe(false);
  });

  it('un número con forma inválida da «La respuesta del servidor no es válida…»', async () => {
    await renderDetail({ [PREVIEW]: { status: 200, json: { activeApplications: -1 } } });
    const dialog = openDialog();

    const alert = await within(dialog).findByRole('alert');

    expect(alert.textContent).toBe(BAD_RESPONSE_MESSAGE);
    expect(button('Cerrar oferta').disabled).toBe(true);
  });

  it('un 404 al pedir el número cierra el diálogo y la ficha dice «Esta oferta ya no existe.»', async () => {
    await renderDetail({
      [PREVIEW]: { status: 404, json: envelope('NOT_FOUND', 'No existe esa oferta.') },
    });
    const dialog = openDialog();

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe('Esta oferta ya no existe.');
    expect(screen.getByRole('link', { name: 'Volver a las ofertas' }).getAttribute('href')).toBe(
      '/jobs',
    );
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();
    expect(dialog.isConnected).toBe(false);
  });

  it('un 409 al cerrar cierra el diálogo, muestra el mensaje y recarga la ficha', async () => {
    let loads = 0;
    const mock = await renderDetail({
      [GET_JOB]: () => {
        loads += 1;
        return { status: 200, json: loads === 1 ? PUBLISHED : CLOSED };
      },
      [PREVIEW]: previewOf(0),
      [CLOSE]: {
        status: 409,
        json: envelope('INVALID_STATE', 'La oferta ya estaba cerrada por otra persona.'),
      },
    });
    openDialog();
    await waitFor(() => expect(button('Cerrar oferta').disabled).toBe(false));

    fireEvent.click(button('Cerrar oferta'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('La oferta ya estaba cerrada por otra persona.');
    await screen.findByText('Cerrada');
    expect(screen.getByRole('alert').textContent).toBe(
      'La oferta ya estaba cerrada por otra persona.',
    );
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
    expect(
      mock.calls.filter((call) => call.method === 'GET' && call.url === '/api/jobs/7'),
    ).toHaveLength(2);
    await expectFocusOn(() => screen.getByRole('heading', { level: 1 }));
  });
});
