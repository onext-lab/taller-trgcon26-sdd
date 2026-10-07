import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobDetailScreen } from '../../../src/features/jobs/JobDetailScreen.tsx';
import type { Job } from '../../../src/features/jobs/types.ts';
import { mockFetch } from '../../helpers/fetch.ts';

// Invented data only.
const DRAFT: Job = {
  id: 7,
  title: 'Desarrollador/a backend (Node.js)',
  description: 'Equipo pequeño.',
  location: 'Valencia',
  workMode: 'híbrida',
  salaryMin: 40000,
  salaryMax: 48000,
  status: 'draft',
  createdAt: '2026-09-30T09:00:00.000Z',
  publishedAt: null,
  closedAt: null,
};

const PUBLISHED: Job = { ...DRAFT, status: 'published', publishedAt: '2026-10-01T09:00:00.000Z' };

const CLOSED: Job = { ...PUBLISHED, status: 'closed', closedAt: '2026-10-06T09:00:00.000Z' };

const CLOSED_TEXT =
  'Esta oferta está cerrada y no se puede modificar. Para volver a publicarla, duplícala.';

async function renderDetail(job: Job): Promise<void> {
  mockFetch({ 'GET /api/jobs/7': { status: 200, json: job } });
  render(<JobDetailScreen />);
  await screen.findByRole('heading', { level: 1, name: job.title });
}

function terms(): string[] {
  return screen.getAllByRole('term').map((term) => term.textContent ?? '');
}

function dateValues(): string[] {
  return [...document.querySelectorAll('dd time')].map((time) => time.textContent ?? '');
}

function controls(): string[] {
  // Page controls in DOM order; the buttons of the (closed) confirmation dialogs do not count.
  return [...document.querySelectorAll('a, button')]
    .filter((control) => control.closest('dialog') === null)
    .map((control) => control.textContent ?? '');
}

describe('JobDetailScreen por estado', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/7');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-23: un borrador muestra solo «Fecha de creación» y 4 controles en orden', async () => {
    await renderDetail(DRAFT);

    expect(terms()).toContain('Fecha de creación');
    expect(terms()).not.toContain('Fecha de publicación');
    expect(terms()).not.toContain('Fecha de cierre');
    expect(dateValues()).toEqual(['30/09/2026']);
    expect(controls()).toEqual(['Editar', 'Publicar', 'Borrar', 'Duplicar']);
    expect(screen.queryByText(CLOSED_TEXT)).toBeNull();
  });

  it('una publicada muestra creación y publicación, y solo «Editar», «Cerrar» y «Duplicar»', async () => {
    await renderDetail(PUBLISHED);

    expect(terms().slice(-2)).toEqual(['Fecha de creación', 'Fecha de publicación']);
    expect(terms()).not.toContain('Fecha de cierre');
    expect(dateValues()).toEqual(['30/09/2026', '01/10/2026']);
    expect(controls()).toEqual(['Ver pipeline', 'Editar', 'Cerrar', 'Duplicar']);
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull();
    expect(screen.queryByText(CLOSED_TEXT)).toBeNull();
  });

  it('RF-07: «Ver pipeline» con href="/jobs/7/pipeline" en published; ausente solo en draft', async () => {
    await renderDetail(PUBLISHED);
    expect(screen.getByRole('link', { name: 'Ver pipeline' }).getAttribute('href')).toBe(
      '/jobs/7/pipeline',
    );
    cleanup();
    await renderDetail(DRAFT);
    expect(screen.queryByRole('link', { name: 'Ver pipeline' })).toBeNull();
  });

  it('CA-22, EC-42, CA-10, CA-13, EC-24: una cerrada muestra 3 fechas, el aviso, «Ver pipeline» y «Duplicar»', async () => {
    await renderDetail(CLOSED);

    expect(terms().slice(-3)).toEqual([
      'Fecha de creación',
      'Fecha de publicación',
      'Fecha de cierre',
    ]);
    expect(dateValues()).toEqual(['30/09/2026', '01/10/2026', '06/10/2026']);
    expect(screen.getByText(CLOSED_TEXT)).toBeDefined();
    expect(controls()).toEqual(['Ver pipeline', 'Duplicar']);
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull();
  });

  it('EC-04, EC-11: las 22:30Z se muestran como el día siguiente en Europe/Madrid', async () => {
    await renderDetail({
      ...CLOSED,
      publishedAt: '2026-10-06T22:30:00Z',
      closedAt: '2026-10-06T22:30:00Z',
    });

    expect(dateValues()).toEqual(['30/09/2026', '07/10/2026', '07/10/2026']);
  });

  it('una fecha nula no se pinta, ni siquiera como «Sin indicar»', async () => {
    await renderDetail(PUBLISHED);

    expect(screen.queryAllByText('Sin indicar')).toHaveLength(0);
    expect(terms()).toHaveLength(7);
  });

  it('el h1 es enfocable por código (tabIndex -1) para devolverle el foco', async () => {
    await renderDetail(PUBLISHED);

    expect(screen.getByRole('heading', { level: 1 }).getAttribute('tabindex')).toBe('-1');
  });

  it('EC-46 HTML en una cerrada: el título sale como texto literal y no crea elementos', async () => {
    const title = 'Oferta <b>X</b>';
    await renderDetail({ ...CLOSED, title });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title);
    expect(document.querySelector('h1 b')).toBeNull();
    expect(document.querySelectorAll('b')).toHaveLength(0);
    expect(document.title).toBe(`${title} · ATS`);
    expect(controls()).toEqual(['Ver pipeline', 'Duplicar']);
  });
});
