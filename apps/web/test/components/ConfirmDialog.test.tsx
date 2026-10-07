import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../src/components/ConfirmDialog.tsx';
import { installDialogPolyfill, simulateCancel } from '../helpers/dialog.ts';

type HarnessProps = {
  withoutDescription?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  error?: string;
  extra?: string;
  onConfirm?: () => void;
};

function Harness({
  withoutDescription = false,
  busy = false,
  confirmDisabled,
  error,
  extra,
  onConfirm = () => {},
}: HarnessProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Borrar
      </button>
      <ConfirmDialog
        open={open}
        title="¿Borrar la oferta?"
        description={
          withoutDescription
            ? undefined
            : 'Vas a borrar «Desarrollador backend». No se puede deshacer.'
        }
        confirmLabel="Borrar oferta"
        busy={busy}
        confirmDisabled={confirmDisabled}
        error={error}
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      >
        {extra === undefined ? null : <p role="status">{extra}</p>}
      </ConfirmDialog>
    </>
  );
}

function openDialog(): HTMLElement {
  const trigger = screen.getByRole('button', { name: 'Borrar' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

function getDialog(): HTMLDialogElement {
  return screen.getByRole('dialog', { name: '¿Borrar la oferta?' }) as HTMLDialogElement;
}

describe('ConfirmDialog', () => {
  let uninstall: () => void = () => {};
  beforeAll(() => {
    uninstall = installDialogPolyfill();
  });
  afterAll(() => uninstall());
  afterEach(() => cleanup());

  it('abre como modal con nombre, descripción y el foco inicial en «Cancelar»', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();

    openDialog();

    const dialog = getDialog();
    expect(dialog.hasAttribute('open')).toBe(true);
    const descriptionId = dialog.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(descriptionId)?.textContent).toBe(
      'Vas a borrar «Desarrollador backend». No se puede deshacer.',
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('sin description no pinta el párrafo ni aria-describedby', () => {
    render(<Harness withoutDescription extra="Contenido del cuerpo" />);

    openDialog();

    const dialog = getDialog();
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
    expect(dialog.querySelector('p.long-text')).toBeNull();
    expect(dialog.querySelectorAll('p')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('Contenido del cuerpo');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('el evento cancel (Escape) cierra y devuelve el foco al disparador sin confirmar', () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const trigger = openDialog();

    act(() => simulateCancel(getDialog()));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('«Cancelar» cierra, devuelve el foco y no llama a onConfirm', () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const trigger = openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('el botón de confirmación llama a onConfirm', () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Borrar oferta' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('con busy deja los dos botones disabled y Escape no lo cierra', () => {
    render(<Harness busy />);
    openDialog();

    expect(screen.getByRole('button', { name: 'Cancelar' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Borrar oferta' }).hasAttribute('disabled')).toBe(
      true,
    );
    act(() => simulateCancel(getDialog()));
    expect(getDialog().hasAttribute('open')).toBe(true);
  });

  it('con confirmDisabled deshabilita solo el botón de confirmar y «Cancelar» sigue activo', () => {
    const onConfirm = vi.fn();
    render(<Harness confirmDisabled onConfirm={onConfirm} />);
    openDialog();

    const confirm = screen.getByRole('button', { name: 'Borrar oferta' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancelar' }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => simulateCancel(getDialog()));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirmDisabled={false} deja el botón de confirmar activo', () => {
    render(<Harness confirmDisabled={false} />);
    openDialog();

    expect(screen.getByRole('button', { name: 'Borrar oferta' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('children se pinta entre la descripción y el error', () => {
    render(<Harness extra="Comprobando las inscripciones activas…" error="Algo ha fallado." />);
    openDialog();

    const description = document.getElementById(getDialog().getAttribute('aria-describedby') ?? '');
    const status = screen.getByRole('status');
    const alert = screen.getByRole('alert');
    expect(status.textContent).toBe('Comprobando las inscripciones activas…');
    expect(description?.compareDocumentPosition(status)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(status.compareDocumentPosition(alert)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('sin children ni confirmDisabled se comporta como antes (sin role="status")', () => {
    render(<Harness />);
    openDialog();

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Borrar oferta' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('pinta el error con role="alert" dentro del diálogo', () => {
    render(<Harness error="No se ha podido borrar la oferta." />);
    openDialog();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('No se ha podido borrar la oferta.');
    expect(getDialog().contains(alert)).toBe(true);
  });
});
