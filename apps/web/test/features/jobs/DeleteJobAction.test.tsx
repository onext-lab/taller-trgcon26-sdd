import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteJobAction } from '../../../src/features/jobs/DeleteJobAction.tsx';
import { JobDetailScreen } from '../../../src/features/jobs/JobDetailScreen.tsx';
import { installDialogPolyfill, simulateCancel } from '../../helpers/dialog.ts';
import { mockFetch } from '../../helpers/fetch.ts';

// Invented data only.
const TITLE = 'Desarrollador/a backend (Node.js)';

let restoreDialog: () => void = () => undefined;

function openDialog(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
  return screen.getByRole('dialog', { name: '¿Borrar la oferta?' });
}

describe('DeleteJobAction', () => {
  beforeEach(() => {
    restoreDialog = installDialogPolyfill();
    window.history.replaceState(null, '', '/jobs/7');
  });

  afterEach(() => {
    cleanup();
    restoreDialog();
    vi.unstubAllGlobals();
  });

  it('abre el diálogo que nombra la oferta, con el foco en «Cancelar» (DT-02)', () => {
    const mock = mockFetch({});
    render(<DeleteJobAction id={7} title={TITLE} />);

    const dialog = openDialog();

    expect(dialog.textContent).toContain(`Vas a borrar «${TITLE}». No se puede deshacer.`);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Borrar oferta' })).toBeDefined();
    expect(mock.calls).toEqual([]);
  });

  it('«Cancelar» cierra el diálogo, devuelve el foco a «Borrar» y no llama a la API', async () => {
    const mock = mockFetch({});
    render(<DeleteJobAction id={7} title={TITLE} />);
    const trigger = screen.getByRole('button', { name: 'Borrar' });
    trigger.focus();
    const dialog = openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    expect(document.activeElement).toBe(trigger);
    expect(mock.calls).toEqual([]);
    expect(window.location.pathname).toBe('/jobs/7');
  });

  it('Escape cierra el diálogo sin llamar a la API', async () => {
    const mock = mockFetch({});
    render(<DeleteJobAction id={7} title={TITLE} />);
    const dialog = openDialog() as HTMLDialogElement;

    act(() => simulateCancel(dialog));

    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    expect(mock.calls).toEqual([]);
  });

  it('«Borrar oferta» envía DELETE sin cuerpo y navega a /jobs con «Oferta borrada.» (CA-13)', async () => {
    const mock = mockFetch({ 'DELETE /api/jobs/7': { status: 204 } });
    render(<DeleteJobAction id={7} title={TITLE} />);
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Borrar oferta' }));

    await waitFor(() => expect(window.location.pathname).toBe('/jobs'));
    expect(window.history.state).toEqual({ notice: 'Oferta borrada.' });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]).toMatchObject({ method: 'DELETE', url: '/api/jobs/7', body: undefined });
    expect(mock.calls[0]?.headers['content-type']).toBeUndefined();
  });

  it('un 500 muestra la alerta en el diálogo, reactiva los botones y no navega (EC-29)', async () => {
    mockFetch({
      'DELETE /api/jobs/7': {
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' } },
      },
    });
    render(<DeleteJobAction id={7} title={TITLE} />);
    const dialog = openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Borrar oferta' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Error interno. Inténtalo de nuevo.');
    expect(dialog.contains(alert)).toBe(true);
    expect(dialog.hasAttribute('open')).toBe(true);
    const cancel = screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement;
    const confirm = screen.getByRole('button', { name: 'Borrar oferta' }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(false);
    expect(confirm.disabled).toBe(false);
    expect(window.location.pathname).toBe('/jobs/7');
  });

  it('EC-33 doble clic en «Borrar oferta» con el DELETE pendiente = 1 fetch y botones deshabilitados', () => {
    const mock = mockFetch({ 'DELETE /api/jobs/7': { hang: true } });
    render(<DeleteJobAction id={7} title={TITLE} />);
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Borrar oferta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar oferta' }));

    const cancel = screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement;
    const confirm = screen.getByRole('button', { name: 'Borrar oferta' }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    expect(confirm.disabled).toBe(true);
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]).toMatchObject({ method: 'DELETE', url: '/api/jobs/7' });
    expect(window.location.pathname).toBe('/jobs/7');
  });

  it('CA-14 un 404 al borrar muestra «Esta oferta ya no existe.» y el enlace al listado', async () => {
    const mock = mockFetch({
      'DELETE /api/jobs/7': {
        status: 404,
        json: { error: { code: 'NOT_FOUND', message: 'No existe esa oferta.' } },
      },
    });
    render(<DeleteJobAction id={7} title={TITLE} />);
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Borrar oferta' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Esta oferta ya no existe.');
    const back = screen.getByRole('link', { name: 'Volver a las ofertas' });
    expect(back.getAttribute('href')).toBe('/jobs');
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull();
    expect(mock.calls).toHaveLength(1);
    expect(window.location.pathname).toBe('/jobs/7');
  });

  it('EC-21 409 al borrar → onConflict con el message, el diálogo se cierra y no navega', async () => {
    const onConflict = vi.fn();
    const message = 'Solo se puede borrar un borrador.';
    const mock = mockFetch({
      'DELETE /api/jobs/7': { status: 409, json: { error: { code: 'CONFLICT', message } } },
    });
    render(<DeleteJobAction id={7} title={TITLE} onConflict={onConflict} />);
    const dialog = openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Borrar oferta' }));

    await waitFor(() => expect(onConflict).toHaveBeenCalledWith(message));
    expect(onConflict).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mock.calls).toHaveLength(1);
    expect(window.location.pathname).toBe('/jobs/7');
  });

  it('EC-21, CA-13 en la ficha: un 409 al borrar muestra la alerta y la oferta recargada, sin «Borrar»', async () => {
    const draft = {
      id: 7,
      title: TITLE,
      description: null,
      location: null,
      workMode: null,
      salaryMin: null,
      salaryMax: null,
      status: 'draft',
      createdAt: '2026-09-30T09:00:00.000Z',
      publishedAt: null,
      closedAt: null,
    };
    const message = 'Solo se puede borrar un borrador.';
    let loads = 0;
    const mock = mockFetch({
      'GET /api/jobs/7': () => {
        loads += 1;
        return {
          status: 200,
          json:
            loads === 1 ? draft : { ...draft, status: 'published', publishedAt: draft.createdAt },
        };
      },
      'DELETE /api/jobs/7': { status: 409, json: { error: { code: 'CONFLICT', message } } },
    });
    render(<JobDetailScreen />);
    await screen.findByRole('heading', { level: 1, name: TITLE });
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Borrar oferta' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(message);
    await screen.findByText('Publicada');
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDefined();
    expect(loads).toBe(2);
    expect(mock.calls.filter((call) => call.method === 'DELETE')).toHaveLength(1);
    expect(window.location.pathname).toBe('/jobs/7');
  });
});
