import { expect, type Page } from '@playwright/test';

// Shared helpers of the e2e specs that need a job, a candidate and an application of their own (HU-04, HU-05):
// they are created through the API with a unique token and an `@example.com` email, so no ID of the seed is
// relied on. This file is not a `*.spec.ts`: Playwright does not run it.

export type JobStatus = 'draft' | 'published';
export type ApiJob = { id: number; title: string };
export type ApiCandidate = { id: number; fullName: string; email: string };

let counter = 0;

/** A lowercase letters-and-digits token that does not repeat between tests, runs or specs of the same database. */
export function uniqueToken(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter}`;
}

/** Creates a job through the API and takes it to the status (the actions are sent without a body). */
export async function createJobByApi(page: Page, status: JobStatus): Promise<ApiJob> {
  const title = `Oferta inscripcion ${uniqueToken()}`;
  const created = await page.request.post('/api/jobs', {
    data: {
      title,
      description: 'Oferta preparada para comprobar el pipeline.',
      location: 'Madrid',
      workMode: 'presencial',
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: number };
  if (status === 'published') {
    expect((await page.request.post(`/api/jobs/${id}/publish`)).ok()).toBe(true);
  }
  return { id, title };
}

/** Creates a candidate without phone; the surname is a single word that no other name or email contains. */
export async function createCandidateByApi(page: Page): Promise<ApiCandidate> {
  const token = uniqueToken();
  const response = await page.request.post('/api/candidates', {
    data: {
      fullName: `Inscribe Apellido${token}`,
      email: `inscribe.${token}@example.com`,
      consent: false,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ApiCandidate;
}

/** Enrolls the candidate in the job through the API and returns the ID of the application. */
export async function enrollByApi(
  page: Page,
  jobId: number,
  candidateId: number,
): Promise<{ id: number }> {
  const enrolled = await page.request.post('/api/applications', { data: { jobId, candidateId } });
  expect(enrolled.status()).toBe(201);
  return (await enrolled.json()) as { id: number };
}

export function pipelinePath(job: ApiJob): string {
  return `/jobs/${job.id}/pipeline`;
}

export function stageRegion(page: Page, stage: string) {
  return page.getByRole('region', { name: stage, exact: true });
}
