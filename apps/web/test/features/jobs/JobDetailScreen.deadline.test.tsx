import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobDetailScreen } from '../../../src/features/jobs/JobDetailScreen.tsx';
import type { Job } from '../../../src/features/jobs/types.ts';
import { mockFetch, type MockRoute } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import { makeJob } from './fixtures.ts';

// Invented data only.
const ROW = 'Fecha límite de inscripción';
const EXPIRED_TEXT = 'La fecha límite de inscripción ya ha pasado.';

function failure(details: unknown): MockRoute {
  return {
    status: 400,
    json: { error: { code: 'VALIDATION_ERROR', message: 'Datos no válidos.', details } },
  };
}

async function renderJob(job: Job, routes: Record<string, MockRoute> = {}): Promise<void> {
  mockFetch({ 'GET /api/jobs/7': { status: 200, json: job }, ...routes });
  render(<JobDetailScreen />);
  await screen.findByRole('heading', { level: 1, name: job.title });
}

function publish(): HTMLButtonElement {
  const button = screen.getByRole('button', { name: 'Publicar' }) as HTMLButtonElement;
  button.focus();
  fireEvent.click(button);
  return button;
}

describe('JobDetailScreen · fecha límite de inscripción', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/7');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('RF-06 la ficha muestra «Fecha límite de inscripción» 13/10/2026 sin aviso', async () => {
    await renderJob(makeJob({ status: 'published', enrollmentDeadline: '2026-10-13' }));

    const term = screen.getByText(ROW, { selector: 'dt' });
    const value = term.nextElementSibling;
    expect(value?.tagName).toBe('DD');
    expect(value?.textContent).toBe('13/10/2026');
    expect(value?.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-13');
    expect(screen.queryByText(/vencid|ya ha pasado/i)).toBeNull();
  });

  it('RF-06 una fecha ya pasada se pinta igual, sin aviso de vencida', async () => {
    await renderJob(makeJob({ status: 'published', enrollmentDeadline: '2020-01-01' }));

    const value = screen.getByText(ROW, { selector: 'dt' }).nextElementSibling;
    expect(value?.textContent).toBe('01/01/2020');
    expect(screen.queryByText(/vencid|ya ha pasado/i)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('RF-06 sin fecha, sin fila (CA-08 web: el borrador duplicado llega con null)', async () => {
    await renderJob(makeJob({ enrollmentDeadline: null }));

    expect(screen.queryByText(ROW, { selector: 'dt' })).toBeNull();
    expect(screen.queryByText(ROW)).toBeNull();
  });

  it('RF-06 la fila va justo después de «Banda salarial»', async () => {
    await renderJob(makeJob({ enrollmentDeadline: '2026-10-13' }));

    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    expect(terms.indexOf(ROW)).toBe(terms.indexOf('Banda salarial') + 1);
  });

  it('CA-07 publicar con el plazo vencido muestra «La fecha límite de inscripción ya ha pasado.»; foco de vuelta a «Publicar»', async () => {
    await renderJob(makeJob({ enrollmentDeadline: '2020-01-01' }), {
      'POST /api/jobs/7/publish': failure([{ field: 'enrollmentDeadline', message: EXPIRED_TEXT }]),
    });

    const button = publish();

    expect((await screen.findByRole('alert')).textContent).toBe(EXPIRED_TEXT);
    expect(screen.getByText('Borrador')).toBeDefined();
    expect(button.disabled).toBe(false);
    await expectFocusOn(() => screen.getByRole('button', { name: 'Publicar' }));
  });

  it('CA-07 con obligatorios que faltan, la alerta lleva las dos frases', async () => {
    await renderJob(
      makeJob({ description: null, workMode: null, enrollmentDeadline: '2020-01-01' }),
      {
        'POST /api/jobs/7/publish': failure([
          { field: 'description', message: 'Obligatorio.' },
          { field: 'workMode', message: 'Obligatorio.' },
          { field: 'enrollmentDeadline', message: EXPIRED_TEXT },
        ]),
      },
    );

    publish();

    expect((await screen.findByRole('alert')).textContent).toBe(
      `Para publicar falta: Descripción, Modalidad. ${EXPIRED_TEXT}`,
    );
    await expectFocusOn(() => screen.getByRole('button', { name: 'Publicar' }));
  });

  it('un 400 con el plazo y otro campo que no es obligatorio sigue cayendo en el message', async () => {
    await renderJob(makeJob({ enrollmentDeadline: '2020-01-01' }), {
      'POST /api/jobs/7/publish': failure([
        { field: 'id', message: 'Debe ser un entero.' },
        { field: 'enrollmentDeadline', message: EXPIRED_TEXT },
      ]),
    });

    publish();

    expect((await screen.findByRole('alert')).textContent).toBe('Datos no válidos.');
    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
  });
});
