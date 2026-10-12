import type { RefObject } from 'react';
import { Link } from '../../components/router.tsx';
import { columnLabel, reportSummary } from './import-model.ts';
import { candidatePaths } from './paths.ts';
import type { ImportReport, NotImportedRow } from './types.ts';

interface CandidateImportReportProps {
  report: ImportReport;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onStartOver: () => void;
  onGoToList: () => void;
}

// A plain `<a>` (not `Link`): it opens another tab and the report stays here (CA-18). Only the ID, nothing of the
// existing candidate (EC-33).
function ExistingLink({ id }: { id: number }) {
  return (
    <a href={candidatePaths.detail(id)} target="_blank" rel="noopener noreferrer">
      Ver candidato <span className="visually-hidden">(se abre en una pestaña nueva)</span>
    </a>
  );
}

// One table row per error of each row, in the order received (EC-43); every text comes from the API as JSX text.
function NotImportedTable({ rows }: { rows: NotImportedRow[] }) {
  return (
    <table>
      <caption>Filas no importadas</caption>
      <thead>
        <tr>
          <th scope="col">Fila</th>
          <th scope="col">Columna</th>
          <th scope="col">Motivo</th>
        </tr>
      </thead>
      <tbody>
        {rows.flatMap((item) =>
          item.errors.map((error, index) => (
            <tr key={`${item.row}-${index}`}>
              <td>{item.row}</td>
              <td>{columnLabel(error.field)}</td>
              <td>
                {error.message}
                {item.reason === 'duplicate' && item.existingId !== undefined ? (
                  <>
                    {' '}
                    <ExistingLink id={item.existingId} />
                  </>
                ) : null}
              </td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

export function CandidateImportReport({
  report,
  headingRef,
  onStartOver,
  onGoToList,
}: CandidateImportReportProps) {
  return (
    <section aria-labelledby="candidate-import-result">
      <h2 id="candidate-import-result" ref={headingRef} tabIndex={-1}>
        Resultado de la importación
      </h2>
      <p role="status">{reportSummary(report)}</p>
      {report.notImported.length === 0 ? (
        <p>Se han importado todas las filas.</p>
      ) : (
        <NotImportedTable rows={report.notImported} />
      )}
      <p>
        <button type="button" onClick={onStartOver}>
          Importar otro fichero
        </button>{' '}
        <Link to={candidatePaths.list} onClick={onGoToList}>
          Ir al listado
        </Link>
      </p>
    </section>
  );
}
