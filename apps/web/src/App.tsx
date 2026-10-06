import { useEffect, useRef, type ReactElement, type RefObject } from 'react';
import { ApiHealth } from './components/ApiHealth.tsx';
import { Link, matchPath, navigate, usePath } from './components/router.tsx';
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

// Route table. `null` means «redirect to the list» (`/`).
function resolveScreen(path: string): Screen | null {
  if (matchPath('/', path)) return null;
  if (matchPath(jobPaths.list, path)) return { title: 'Ofertas', element: <JobListScreen /> };
  return { title: NOT_FOUND_TITLE, element: <NotFoundScreen /> };
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

  return (
    <>
      <header>
        <p>{APP_NAME}</p>
        <nav aria-label="Principal">
          <Link to={jobPaths.list} aria-current={onList ? 'page' : undefined}>
            Ofertas
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
