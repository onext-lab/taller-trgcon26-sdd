import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  Link,
  matchPath,
  navigate,
  parseRouteId,
  useNotice,
  usePath,
  useSearch,
} from '../../src/components/router.tsx';

function Probe() {
  const path = usePath();
  const search = useSearch();
  const notice = useNotice();
  return (
    <div>
      <p>Ruta: {path}</p>
      <p>Query: {search === '' ? '(vacía)' : search}</p>
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

  it('useSearch devuelve window.location.search y sigue a navigate sin cambiar de ruta', () => {
    render(<Probe />);
    expect(screen.getByText('Query: (vacía)')).toBeDefined();

    act(() => navigate('/jobs?status=published&page=2'));

    expect(screen.getByText('Query: ?status=published&page=2')).toBeDefined();
    expect(screen.getByText('Ruta: /jobs')).toBeDefined();
    expect(window.location.search).toBe('?status=published&page=2');
  });

  it('useSearch sigue a «atrás» (popstate)', async () => {
    render(<Probe />);
    act(() => navigate('/jobs?status=draft'));
    act(() => navigate('/jobs?status=closed'));
    expect(screen.getByText('Query: ?status=closed')).toBeDefined();

    act(() => window.history.back());

    await waitFor(() => expect(screen.getByText('Query: ?status=draft')).toBeDefined());
  });

  it('el aviso «Oferta duplicada.» viaja en history.state y se lee en destino', () => {
    render(<Probe />);

    act(() => navigate('/jobs/12', { notice: 'Oferta duplicada.' }));

    expect(screen.getByRole('status').textContent).toBe('Oferta duplicada.');
    expect(window.history.state).toEqual({ notice: 'Oferta duplicada.' });
  });

  it('CA-01 el aviso «Candidato creado.» viaja en history.state y se lee en destino', () => {
    render(<Probe />);

    act(() => navigate('/candidates/12', { notice: 'Candidato creado.' }));

    expect(screen.getByRole('status').textContent).toBe('Candidato creado.');
    expect(window.history.state).toEqual({ notice: 'Candidato creado.' });
  });

  it('ignora en history.state un aviso que no es uno de los textos fijos', () => {
    window.history.replaceState({ notice: 'Nombre Inventado' }, '', '/jobs');
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

describe('parseRouteId', () => {
  it('devuelve el entero positivo seguro escrito solo con dígitos', () => {
    expect(parseRouteId('7')).toBe(7);
    expect(parseRouteId('999999999999999')).toBe(999999999999999);
  });

  it('EC-35 rechaza ceros a la izquierda, signo, decimales, texto y más de 15 dígitos', () => {
    for (const text of [
      '',
      '0',
      '007',
      '-1',
      '+1',
      '1.5',
      '1e3',
      'abc',
      '7 ',
      ' 7',
      '1000000000000000',
    ]) {
      expect(parseRouteId(text)).toBeNull();
    }
  });
});
