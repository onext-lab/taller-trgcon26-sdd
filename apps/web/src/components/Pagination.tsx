import type { ReactNode } from 'react';
import { totalPages } from './list-controls.ts';

export interface PaginationProps {
  /** `page`, `pageSize` and `total` of the API response, not of the URL. */
  page: number;
  pageSize: number;
  total: number;
  /** Noun for the total, e.g. `{ singular: 'oferta', plural: 'ofertas' }`. */
  noun: { singular: string; plural: string };
  /** Paints «Anterior» or «Siguiente» (a link in jobs, a button in candidates) for the target page. */
  renderStep: (target: number, label: 'Anterior' | 'Siguiente') => ReactNode;
}

// Presentational pagination: «Página N de M (X {noun})»; no step at the edges.
export function Pagination({ page, pageSize, total, noun, renderStep }: PaginationProps) {
  const pages = totalPages(total, pageSize);
  const word = total === 1 ? noun.singular : noun.plural;
  return (
    <nav aria-label="Paginación" className="pagination">
      {page > 1 ? renderStep(page - 1, 'Anterior') : null}
      <span>{`Página ${page} de ${pages} (${total} ${word})`}</span>
      {page < pages ? renderStep(page + 1, 'Siguiente') : null}
    </nav>
  );
}
