import { useEffect, useRef, type ReactElement, type RefObject } from 'react';
import { ApiHealth } from './components/ApiHealth.tsx';
import { Link, matchPath, navigate, usePath } from './components/router.tsx';
import { PIPELINE_ROUTE } from './features/applications/paths.ts';
import { PipelineScreen } from './features/applications/PipelineScreen.tsx';
import { CandidateDetailScreen } from './features/candidates/CandidateDetailScreen.tsx';
import { CandidateFormScreen } from './features/candidates/CandidateFormScreen.tsx';
import { CandidateListScreen } from './features/candidates/CandidateListScreen.tsx';
import { candidatePaths } from './features/candidates/paths.ts';
import { JobDetailScreen } from './features/jobs/JobDetailScreen.tsx';
import { JobFormScreen } from './features/jobs/JobFormScreen.tsx';
import { JobListScreen } from './features/jobs/JobListScreen.tsx';
import { jobPaths } from './features/jobs/paths.ts';

const APP_NAME = 'ATS';
const NOT_FOUND_TITLE = 'Página no encontrada';

interface Screen {
  title: string;
  element: ReactElement;
}

function NotFoundScreen() {
  return (
    <>
      <h1>{NOT_FOUND_TITLE}</h1>
      <p>
        <Link to={jobPaths.list}>Ir a las ofertas</Link>
      </p>
    </>
  );
}

interface Route extends Screen {
  pattern: string;
}

// Route table, in match order: `/jobs/new` and `/candidates/new` also match their `/:id` and must go first.
const ROUTES: readonly Route[] = [
  { pattern: jobPaths.list, title: 'Ofertas', element: <JobListScreen /> },
  { pattern: jobPaths.create, title: 'Nueva oferta', element: <JobFormScreen mode="create" /> },
  { pattern: '/jobs/:id/edit', title: 'Editar oferta', element: <JobFormScreen mode="edit" /> },
  {
    pattern: PIPELINE_ROUTE,
    title: 'Pipeline de la oferta',
    element: <PipelineScreen jobPath={jobPaths.detail} notFound={<NotFoundScreen />} />,
  },
  { pattern: '/jobs/:id', title: 'Oferta', element: <JobDetailScreen /> },
  { pattern: candidatePaths.list, title: 'Candidatos', element: <CandidateListScreen /> },
  {
    pattern: candidatePaths.create,
    title: 'Nuevo candidato',
    element: <CandidateFormScreen mode="create" />,
  },
  {
    pattern: '/candidates/:id/edit',
    title: 'Editar candidato',
    element: <CandidateFormScreen mode="edit" />,
  },
  { pattern: '/candidates/:id', title: 'Ficha de candidato', element: <CandidateDetailScreen /> },
];

// `null` means «redirect to the list» (`/`).
function resolveScreen(path: string): Screen | null {
  if (matchPath('/', path)) return null;
  const route = ROUTES.find(({ pattern }) => matchPath(pattern, path));
  return route ?? { title: NOT_FOUND_TITLE, element: <NotFoundScreen /> };
}

function RedirectToList() {
  useEffect(() => {
    navigate(jobPaths.list, { replace: true });
  }, []);
  return null;
}

// On navigation (not on the first load, which includes the `/` redirect) focus goes to <main> and the
// document title names the screen.
function useNavigationFocus(
  path: string,
  title: string | null,
  mainRef: RefObject<HTMLElement | null>,
) {
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = path;
    if (title === null || previous === null || previous === '/' || previous === path) return;
    document.title = `${title} · ${APP_NAME}`;
    mainRef.current?.focus();
  }, [path, title, mainRef]);
}

export function App() {
  const path = usePath();
  const screen = resolveScreen(path);
  const mainRef = useRef<HTMLElement>(null);
  useNavigationFocus(path, screen?.title ?? null, mainRef);
  const onList = matchPath(jobPaths.list, path) !== null;
  const onCandidates = matchPath(candidatePaths.list, path) !== null;

  return (
    <>
      <header>
        <p>{APP_NAME}</p>
        <nav aria-label="Principal">
          <Link to={jobPaths.list} aria-current={onList ? 'page' : undefined}>
            Ofertas
          </Link>
          <Link to={candidatePaths.list} aria-current={onCandidates ? 'page' : undefined}>
            Candidatos
          </Link>
        </nav>
      </header>
      <main ref={mainRef} tabIndex={-1}>
        {screen ? screen.element : <RedirectToList />}
      </main>
      <footer>
        <ApiHealth />
      </footer>
    </>
  );
}
