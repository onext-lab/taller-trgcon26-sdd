import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResource } from '../../src/components/use-resource.ts';

type Item = { name: string };

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function Probe({ load }: { load: (signal: AbortSignal) => Promise<Item> }) {
  const resource = useResource(load, []);
  return (
    <div>
      <p>Estado: {resource.state}</p>
      {resource.state === 'success' ? <p>Dato: {resource.data.name}</p> : null}
      <button type="button" onClick={() => resource.setData({ name: 'Nuevo dato' })}>
        Poner dato
      </button>
      <button type="button" onClick={resource.retry}>
        Reintentar
      </button>
      <button type="button" onClick={resource.reload}>
        Recargar
      </button>
    </div>
  );
}

describe('useResource', () => {
  afterEach(() => {
    cleanup();
  });

  it('setData pasa el recurso a success con ese dato y sin ninguna petición', async () => {
    const load = vi.fn(() => Promise.resolve({ name: 'Dato inicial' }));
    render(<Probe load={load} />);
    expect(await screen.findByText('Dato: Dato inicial')).toBeDefined();
    expect(load).toHaveBeenCalledTimes(1);

    act(() => screen.getByRole('button', { name: 'Poner dato' }).click());

    expect(screen.getByText('Dato: Nuevo dato')).toBeDefined();
    expect(screen.getByText('Estado: success')).toBeDefined();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('setData también sustituye un estado de error, sin petición', async () => {
    const load = vi.fn(() => Promise.reject(new Error('fallo inventado')));
    render(<Probe load={load} />);
    expect(await screen.findByText('Estado: error')).toBeDefined();

    act(() => screen.getByRole('button', { name: 'Poner dato' }).click());

    expect(screen.getByText('Dato: Nuevo dato')).toBeDefined();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retry sigue volviendo a pedir el dato', async () => {
    const load = vi.fn(() => Promise.resolve({ name: 'Dato inicial' }));
    render(<Probe load={load} />);
    await screen.findByText('Dato: Dato inicial');

    act(() => screen.getByRole('button', { name: 'Reintentar' }).click());

    expect(await screen.findByText('Dato: Dato inicial')).toBeDefined();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reload mantiene el dato mientras pide y luego lo sustituye', async () => {
    const second = deferred<Item>();
    const load = vi
      .fn<(signal: AbortSignal) => Promise<Item>>()
      .mockResolvedValueOnce({ name: 'Dato inicial' })
      .mockReturnValueOnce(second.promise);
    render(<Probe load={load} />);
    await screen.findByText('Dato: Dato inicial');

    act(() => screen.getByRole('button', { name: 'Recargar' }).click());

    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Estado: success')).toBeDefined();
    expect(screen.getByText('Dato: Dato inicial')).toBeDefined();

    await act(async () => second.resolve({ name: 'Dato recargado' }));

    expect(screen.getByText('Dato: Dato recargado')).toBeDefined();
    expect(screen.queryByText('Estado: loading')).toBeNull();
  });

  it('un error de reload pasa a error', async () => {
    const load = vi
      .fn<(signal: AbortSignal) => Promise<Item>>()
      .mockResolvedValueOnce({ name: 'Dato inicial' })
      .mockRejectedValueOnce(new Error('fallo inventado'));
    render(<Probe load={load} />);
    await screen.findByText('Dato: Dato inicial');

    act(() => screen.getByRole('button', { name: 'Recargar' }).click());

    expect(await screen.findByText('Estado: error')).toBeDefined();
    expect(screen.queryByText('Dato: Dato inicial')).toBeNull();
  });

  it('una respuesta vieja de reload no pisa a la nueva', async () => {
    const first = deferred<Item>();
    const second = deferred<Item>();
    const load = vi
      .fn<(signal: AbortSignal) => Promise<Item>>()
      .mockResolvedValueOnce({ name: 'Dato inicial' })
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<Probe load={load} />);
    await screen.findByText('Dato: Dato inicial');

    act(() => screen.getByRole('button', { name: 'Recargar' }).click());
    act(() => screen.getByRole('button', { name: 'Recargar' }).click());
    await act(async () => second.resolve({ name: 'Dato nuevo' }));
    await act(async () => first.resolve({ name: 'Dato viejo' }));

    expect(screen.getByText('Dato: Dato nuevo')).toBeDefined();
    expect(screen.queryByText('Dato: Dato viejo')).toBeNull();
  });
});
