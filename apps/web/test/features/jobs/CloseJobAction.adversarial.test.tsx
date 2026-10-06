import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BAD_RESPONSE_MESSAGE, CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import { JobDetailScreen } from '../../../src/features/jobs/JobDetailScreen.tsx';
import type { Job } from '../../../src/features/jobs/types.ts';
import { installDialogPolyfill } from '../../helpers/dialog.ts';
import { mockFetch, type MockRoute } from '../../helpers/fetch.ts';

// [adversarial] RF-02 / RF-06 on the close dialog and the detail (TASK-12). Invented data only.
const HOSTILE = '<img src=x onerror=alert(1)>';

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

const GET_JOB = 'GET /api/jobs/7';
const PREVIEW = 'GET /api/jobs/7/close-preview';
const CLOSE = 'POST /api/jobs/7/close';
const READY: MockRoute = { status: 200, json: { activeApplications: 0 } };

let restoreDialog: () => void = () => undefined;

function envelope(code: string, message: string) {
  return { error: { code, message } };
}

async function renderDetail(routes: Record<string, MockRoute>, job: Job = PUBLISHED) {
  const mock = mockFetch({ [GET_JOB]: { status: 200, json: job }, ...routes });
  const view = render(<JobDetailScreen />);
  await screen.findByRole('heading', { level: 1, name: job.title });
  return { mock, container: view.container };
}

function button(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function openDialog(): HTMLDialogElement {
  fireEvent.click(button('Cerrar'));
  return screen.getByRole('dialog', { name: '¿Cerrar la oferta?' }) as HTMLDialogElement;
}

async function openReadyDialog(): Promise<HTMLDialogElement> {
  const dialog = openDialog();
  await waitFor(() => expect(button('Cerrar oferta').disabled).toBe(false));
  return dialog;
}

function postCalls(mock: { calls: { method: string }[] }): number {
  return mock.calls.filter((call) => call.method === 'POST').length;
}

describe('CloseJobAction · casos hostiles y de fallo', () => {
  beforeEach(() => {
    restoreDialog = installDialogPolyfill();
    window.history.replaceState(null, '', '/jobs/7');
  });

  afterEach(() => {
    cleanup();
    restoreDialog();
    vi.unstubAllGlobals();
  });

  it('EC-16 doble clic en Cerrar oferta = 1 POST', async () => {
    const { mock } = await renderDetail({ [PREVIEW]: READY, [CLOSE]: { hang: true } });
    await openReadyDialog();

    fireEvent.click(button('Cerrar oferta'));
    fireEvent.click(button('Cerrar oferta'));

    expect(postCalls(mock)).toBe(1);
    expect(button('Cerrar oferta').disabled).toBe(true);
    expect(button('Cancelar').disabled).toBe(true);
  });

  it('EC-15 título hostil con el diálogo abierto: texto literal, 0 img y el diálogo no lo nombra', async () => {
    const { container } = await renderDetail(
      { [PREVIEW]: READY },
      { ...PUBLISHED, title: HOSTILE },
    );

    const dialog = await openReadyDialog();

    expect(container.querySelector('img')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(HOSTILE);
    expect(dialog.textContent).not.toContain(HOSTILE);
    expect(dialog.textContent).not.toContain('onerror');
  });

  it('EC-15 el error del cierre solo muestra el message, no details ni el cuerpo', async () => {
    await renderDetail({
      [PREVIEW]: READY,
      [CLOSE]: {
        status: 500,
        json: {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Error interno. Inténtalo de nuevo.',
            details: [{ field: 'title', message: HOSTILE }],
          },
        },
      },
    });
    const dialog = await openReadyDialog();

    fireEvent.click(button('Cerrar oferta'));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect(document.querySelector('img')).toBeNull();
  });

  it('EC-43 red caída al cerrar: alerta en el diálogo, botones reactivados y la ficha sigue «Publicada»', async () => {
    const { mock } = await renderDetail({ [PREVIEW]: READY, [CLOSE]: { networkError: true } });
    const dialog = await openReadyDialog();

    fireEvent.click(button('Cerrar oferta'));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toBe(CONNECTION_MESSAGE);
    expect(button('Cerrar oferta').disabled).toBe(false);
    expect(button('Cancelar').disabled).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(screen.getByText('Publicada')).toBeDefined();
    expect(screen.queryByText('Fecha de cierre')).toBeNull();
    expect(screen.queryByText('Oferta cerrada.')).toBeNull();
    expect(postCalls(mock)).toBe(1);
  });

  it('EC-43 tras un fallo de red se puede reintentar y el segundo intento cierra', async () => {
    let attempts = 0;
    const closed: Job = { ...PUBLISHED, status: 'closed', closedAt: '2026-10-06T09:00:00.000Z' };
    const { mock } = await renderDetail({
      [PREVIEW]: READY,
      [CLOSE]: () => {
        attempts += 1;
        return attempts === 1 ? { networkError: true } : { status: 200, json: closed };
      },
    });
    const dialog = await openReadyDialog();
    fireEvent.click(button('Cerrar oferta'));
    await within(dialog).findByRole('alert');

    fireEvent.click(button('Cerrar oferta'));

    await screen.findByText('Oferta cerrada.');
    expect(postCalls(mock)).toBe(2);
    expect(screen.getByText('Cerrada')).toBeDefined();
  });

  it('una lectura previa sin activeApplications da «La respuesta del servidor no es válida…»', async () => {
    await renderDetail({ [PREVIEW]: { status: 200, json: {} } });
    const dialog = openDialog();

    const alert = await within(dialog).findByRole('alert');

    expect(alert.textContent).toBe(BAD_RESPONSE_MESSAGE);
    expect(button('Cerrar oferta').disabled).toBe(true);
    expect(button('Cancelar').disabled).toBe(false);
  });

  it('una lectura previa con un número no entero o en texto también es una respuesta inválida', async () => {
    await renderDetail({ [PREVIEW]: { status: 200, json: { activeApplications: '3' } } });
    const dialog = openDialog();

    const alert = await within(dialog).findByRole('alert');

    expect(alert.textContent).toBe(BAD_RESPONSE_MESSAGE);
    expect(button('Cerrar oferta').disabled).toBe(true);
  });

  it('un 404 al cerrar cierra el diálogo, dice «Esta oferta ya no existe.» y deja la ficha sin acciones', async () => {
    const { mock } = await renderDetail({
      [PREVIEW]: READY,
      [CLOSE]: { status: 404, json: envelope('NOT_FOUND', 'No existe esa oferta.') },
    });
    const dialog = await openReadyDialog();

    fireEvent.click(button('Cerrar oferta'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Esta oferta ya no existe.');
    expect(screen.getByRole('link', { name: 'Volver a las ofertas' }).getAttribute('href')).toBe(
      '/jobs',
    );
    expect(dialog.isConnected).toBe(false);
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();
    expect(postCalls(mock)).toBe(1);
  });

  it('EC-44 un 409 al cerrar y la recarga con un 404 (otra pestaña la borró) dejan «Esta oferta ya no existe.»', async () => {
    let loads = 0;
    await renderDetail({
      [GET_JOB]: () => {
        loads += 1;
        return loads === 1
          ? { status: 200, json: PUBLISHED }
          : { status: 404, json: envelope('NOT_FOUND', 'No existe esa oferta.') };
      },
      [PREVIEW]: READY,
      [CLOSE]: { status: 409, json: envelope('INVALID_STATE', 'La oferta ya no se puede cerrar.') },
    });
    await openReadyDialog();

    fireEvent.click(button('Cerrar oferta'));

    await screen.findByRole('heading', { level: 1, name: 'Oferta no encontrada' });
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
