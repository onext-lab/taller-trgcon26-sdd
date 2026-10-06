import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResource } from '../../src/components/use-resource.ts';

type Item = { name: string };

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
});
