import { Link } from '../../components/router.tsx';
import { Pagination } from '../../components/Pagination.tsx';

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

const NOUN = { singular: 'oferta', plural: 'ofertas' };

// Presentational pagination (RF-05, DD-03): real links, none at the edges.
export function JobPagination({ page, pageSize, total, pathFor, onNavigate }: JobPaginationProps) {
  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      noun={NOUN}
      renderStep={(target, label) => (
        <Link to={pathFor(target)} onClick={onNavigate}>
          {label}
        </Link>
      )}
    />
  );
}
