import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobDetailScreen } from '../../../src/features/jobs/JobDetailScreen.tsx';
import type { Job } from '../../../src/features/jobs/types.ts';
import { mockFetch } from '../../helpers/fetch.ts';

// Invented data only.
const CLOSED: Job = {
  id: 7,
  title: 'Técnica/o de selección',
  description: 'Gestión de procesos de selección.',
  location: 'Valencia',
  workMode: 'híbrida',
  salaryMin: 30000,
  salaryMax: 36000,
  status: 'closed',
  createdAt: '2026-09-30T09:00:00.000Z',
  publishedAt: '2026-10-01T09:00:00.000Z',
  closedAt: '2026-10-06T09:00:00.000Z',
};

function controls(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('a, button')].filter(
    (control) => control.closest('dialog') === null,
  );
}

describe('JobDetailScreen: oferta cerrada', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/7');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("CA-23 closed → controles ['Ver pipeline', 'Duplicar'] con href /jobs/7/pipeline", async () => {
    mockFetch({ 'GET /api/jobs/7': { status: 200, json: CLOSED } });
    render(<JobDetailScreen />);
    await screen.findByRole('heading', { level: 1, name: CLOSED.title });

    expect(controls().map((control) => control.textContent)).toEqual(['Ver pipeline', 'Duplicar']);
    const [pipeline, duplicate] = controls();
    expect(pipeline?.tagName).toBe('A');
    expect(pipeline?.getAttribute('href')).toBe('/jobs/7/pipeline');
    expect(duplicate?.tagName).toBe('BUTTON');
  });
});
