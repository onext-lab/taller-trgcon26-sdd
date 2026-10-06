import { Link } from '../../components/router.tsx';
import { totalPages } from './list-query.ts';

export interface JobPaginationProps {
  /** `page`, `pageSize` and `total` of the API response, not of the URL. */
  page: number;
  pageSize: number;
  total: number;
  /** Web path of another page, with the same filters and size. */
  pathFor: (page: number) => string;
  /** Called on the click of «Anterior» or «Siguiente», before navigating (the container restores the focus). */
  onNavigate: () => void;
}

// Presentational pagination (RF-05, DD-03): real links, none at the edges.
export function JobPagination({ page, pageSize, total, pathFor, onNavigate }: JobPaginationProps) {
  const pages = totalPages(total, pageSize);
  return (
    <nav aria-label="Paginación" className="pagination">
      {page > 1 ? (
        <Link to={pathFor(page - 1)} onClick={onNavigate}>
          Anterior
        </Link>
      ) : null}
      <span>{`Página ${page} de ${pages} (${total} ${total === 1 ? 'oferta' : 'ofertas'})`}</span>
      {page < pages ? (
        <Link to={pathFor(page + 1)} onClick={onNavigate}>
          Siguiente
        </Link>
      ) : null}
    </nav>
  );
}
