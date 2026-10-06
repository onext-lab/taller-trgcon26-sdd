import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Link } from '../../src/components/router.tsx';
import { Pagination } from '../../src/components/Pagination.tsx';

const NOUN = { singular: 'candidato', plural: 'candidatos' };

describe('Pagination', () => {
  afterEach(() => cleanup());

  it('CA-19 pinta «Página N de M (X plural)» dentro de la navegación «Paginación»', () => {
    render(<Pagination page={2} pageSize={20} total={25} noun={NOUN} renderStep={() => null} />);

    const nav = screen.getByRole('navigation', { name: 'Paginación' });
    expect(nav.textContent).toBe('Página 2 de 2 (25 candidatos)');
  });

  it('usa el singular con un solo elemento y 1 página con 0', () => {
    const { rerender } = render(
      <Pagination page={1} pageSize={20} total={1} noun={NOUN} renderStep={() => null} />,
    );
    expect(screen.getByText('Página 1 de 1 (1 candidato)')).toBeDefined();

    rerender(<Pagination page={1} pageSize={20} total={0} noun={NOUN} renderStep={() => null} />);
    expect(screen.getByText('Página 1 de 1 (0 candidatos)')).toBeDefined();
  });

  it('renderStep con botones: «Siguiente» en la primera página, «Anterior» en la última, ambos en medio', () => {
    const go = vi.fn();
    const renderStep = (target: number, label: string) => (
      <button type="button" onClick={() => go(target)}>
        {label}
      </button>
    );
    const { rerender } = render(
      <Pagination page={1} pageSize={20} total={50} noun={NOUN} renderStep={renderStep} />,
    );
    expect(screen.queryByRole('button', { name: 'Anterior' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(go).toHaveBeenLastCalledWith(2);

    rerender(<Pagination page={2} pageSize={20} total={50} noun={NOUN} renderStep={renderStep} />);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Anterior',
      'Siguiente',
    ]);

    rerender(<Pagination page={3} pageSize={20} total={50} noun={NOUN} renderStep={renderStep} />);
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(go).toHaveBeenLastCalledWith(2);
  });

  it('renderStep con enlaces (ofertas): href del destino y sin pasos en los extremos', () => {
    render(
      <Pagination
        page={2}
        pageSize={20}
        total={60}
        noun={{ singular: 'oferta', plural: 'ofertas' }}
        renderStep={(target, label) => <Link to={`/jobs?page=${target}`}>{label}</Link>}
      />,
    );

    expect(screen.getByRole('link', { name: 'Anterior' }).getAttribute('href')).toBe(
      '/jobs?page=1',
    );
    expect(screen.getByRole('link', { name: 'Siguiente' }).getAttribute('href')).toBe(
      '/jobs?page=3',
    );
    expect(screen.getByText('Página 2 de 3 (60 ofertas)')).toBeDefined();
  });
});
