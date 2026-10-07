import { matchPath, parseRouteId } from '../../components/router.tsx';

/** Web route of the pipeline of a job: only the job ID travels in the URL, never personal data. */
export const PIPELINE_ROUTE = '/jobs/:id/pipeline';

export function pipelinePath(jobId: number): string {
  return `/jobs/${jobId}/pipeline`;
}

/** Returns the job ID of a pipeline path, or `null` if the path is not one or the ID is not valid. */
export function parsePipelineJobId(path: string): number | null {
  const params = matchPath(PIPELINE_ROUTE, path);
  return params === null ? null : parseRouteId(params.id ?? '');
}

/** Web route of the detail of an application: only its ID travels in the URL (RNF-08). */
export const APPLICATION_ROUTE = '/applications/:id';

export function applicationPath(id: number): string {
  return `/applications/${id}`;
}

/** Returns the application ID of a detail path, or `null` if the path is not one or the ID is not valid. */
export function parseApplicationId(path: string): number | null {
  const params = matchPath(APPLICATION_ROUTE, path);
  return params === null ? null : parseRouteId(params.id ?? '');
}
