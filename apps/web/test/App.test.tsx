import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra el estado de la API cuando /api/health responde ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ status: 'ok' }))),
    );

    render(<App />);

    expect(screen.getByRole('heading', { name: 'ATS' })).toBeDefined();
    expect(await screen.findByText('Estado de la API: ok')).toBeDefined();
  });

  it('avisa de que no hay conexión cuando /api/health falla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    render(<App />);

    expect(await screen.findByText('Estado de la API: sin conexión')).toBeDefined();
  });
});
