import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Link, matchPath, navigate, useNotice, usePath } from '../../src/components/router.tsx';

function Probe() {
  const path = usePath();
  const notice = useNotice();
  return (
    <div>
      <p>Ruta: {path}</p>
      {notice ? <p role="status">{notice}</p> : null}
      <Link to="/jobs/new">Nueva oferta</Link>
    </div>
  );
}

// Records whether the router prevented the click, then stops jsdom from attempting a real navigation.
function trackDefaultPrevented(): { prevented: boolean | null; stop: () => void } {
  const record: { prevented: boolean | null; stop: () => void } = {
    prevented: null,
    stop: () => {},
  };
  const listener = (event: Event) => {
    record.prevented = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', listener);
  record.stop = () => document.removeEventListener('click', listener);
  return record;
}

describe('router', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs');
  });

  afterEach(() => {
    cleanup();
  });

  it('Link renderiza un enlace real y el clic primario sin modificadores navega sin recargar', () => {
    render(<Probe />);
    const link = screen.getByRole('link', { name: 'Nueva oferta' });
    expect(link.getAttribute('href')).toBe('/jobs/new');
    const click = trackDefaultPrevented();

    fireEvent.click(link, { button: 0 });
    click.stop();

    expect(click.prevented).toBe(true);
    expect(screen.getByText('Ruta: /jobs/new')).toBeDefined();
    expect(window.location.pathname).toBe('/jobs/new');
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
    ['botón no primario', { button: 1 }],
  ])('Link no intercepta el clic con %s', (_name, init) => {
    render(<Probe />);
    const click = trackDefaultPrevented();

    fireEvent.click(screen.getByRole('link', { name: 'Nueva oferta' }), init);
    click.stop();

    expect(click.prevented).toBe(false);
    expect(screen.getByText('Ruta: /jobs')).toBeDefined();
    expect(window.location.pathname).toBe('/jobs');
  });

  it('navigate con notice actualiza la ruta y deja el aviso legible en destino', () => {
    render(<Probe />);
    expect(screen.queryByRole('status')).toBeNull();

    act(() => navigate('/jobs/7', { notice: 'Oferta creada.' }));

    expect(screen.getByText('Ruta: /jobs/7')).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Oferta creada.');
    expect(window.history.state).toEqual({ notice: 'Oferta creada.' });
  });

  it('navigate con replace sustituye la entrada sin añadir otra', () => {
    render(<Probe />);
    const length = window.history.length;

    act(() => navigate('/jobs/9', { replace: true, notice: 'Oferta borrada.' }));

    expect(window.history.length).toBe(length);
    expect(screen.getByText('Ruta: /jobs/9')).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Oferta borrada.');
  });

  it('«atrás» (popstate) actualiza la ruta y el aviso', async () => {
    render(<Probe />);
    act(() => navigate('/jobs/7/edit'));
    act(() => navigate('/jobs/7', { notice: 'Cambios guardados.' }));
    expect(screen.getByRole('status').textContent).toBe('Cambios guardados.');

    act(() => window.history.back());

    await waitFor(() => expect(screen.getByText('Ruta: /jobs/7/edit')).toBeDefined());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ignora en history.state un aviso que no es uno de los textos fijos', () => {
    window.history.replaceState({ notice: 'Ana Pérez' }, '', '/jobs');
    render(<Probe />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('matchPath', () => {
  it('devuelve los parámetros como texto', () => {
    expect(matchPath('/jobs/:id', '/jobs/7')).toEqual({ id: '7' });
    expect(matchPath('/jobs/:id/edit', '/jobs/abc/edit')).toEqual({ id: 'abc' });
    expect(matchPath('/jobs', '/jobs/')).toEqual({});
  });

  it('no casa con otra ruta ni con un parámetro vacío', () => {
    expect(matchPath('/jobs/:id', '/jobs/7/edit')).toBeNull();
    expect(matchPath('/jobs/:id/edit', '/jobs//edit')).toBeNull();
    expect(matchPath('/jobs/new', '/jobs/7')).toBeNull();
  });
});
