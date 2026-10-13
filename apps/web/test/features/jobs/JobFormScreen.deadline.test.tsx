import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App.tsx';
import { JobFormScreen } from '../../../src/features/jobs/JobFormScreen.tsx';
import type { Job } from '../../../src/features/jobs/types.ts';
import { mockFetch, type FetchMock, type MockRoute } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import { makeJob } from './fixtures.ts';

// Invented data only.
const LABEL = 'Fecha límite de inscripción';
const HEALTH: MockRoute = { status: 200, json: { status: 'ok' } };
const PAST_MESSAGE = 'La fecha límite no puede ser anterior a hoy.';

function rejection(message: string): MockRoute {
  return {
    status: 400,
    json: {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos.',
        details: [{ field: 'enrollmentDeadline', message }],
      },
    },
  };
}

function deadlineField(): HTMLInputElement {
  return screen.getByLabelText(LABEL) as HTMLInputElement;
}

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function save(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

function errorOfDeadline(): string | null {
  const id = deadlineField().getAttribute('aria-describedby');
  return id ? (document.getElementById(id)?.textContent ?? null) : null;
}

function bodies(mock: FetchMock, method: string): unknown[] {
  return mock.calls
    .filter((call) => call.method === method)
    .map((call) => JSON.parse(call.body ?? 'null') as unknown);
}

async function openEditor(job: Job, routes: Record<string, MockRoute> = {}): Promise<FetchMock> {
  const mock = mockFetch({
    'GET /api/health': HEALTH,
    'GET /api/jobs/7': { status: 200, json: job },
    ...routes,
  });
  render(<App />);
  await screen.findByRole('heading', { name: 'Editar oferta' });
  return mock;
}

describe('JobFormScreen · fecha límite de inscripción (alta)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/new');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-01 el campo tiene su label; con fecha viaja en el POST y vacío no viaja', async () => {
    const mock = mockFetch({
      'POST /api/jobs': { status: 201, json: makeJob({ enrollmentDeadline: '2026-12-31' }) },
    });
    render(<JobFormScreen mode="create" />);

    const field = deadlineField();
    expect(field.type).toBe('date');
    expect(field.required).toBe(false);
    expect(field.getAttribute('min')).toBeNull();
    expect(field.getAttribute('max')).toBeNull();
    expect(field.value).toBe('');
    type('Título (obligatorio)', 'Técnica/o de selección');
    type(LABEL, '2026-12-31');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
    expect(bodies(mock, 'POST')).toEqual([
      { title: 'Técnica/o de selección', enrollmentDeadline: '2026-12-31' },
    ]);
  });

  it('CA-01 sin escribir la fecha, o tras borrarla, el POST no lleva enrollmentDeadline', async () => {
    const mock = mockFetch({ 'POST /api/jobs': { status: 201, json: makeJob() } });
    render(<JobFormScreen mode="create" />);

    type('Título (obligatorio)', 'Técnica/o de selección');
    type(LABEL, '2026-12-31');
    type(LABEL, '');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
    expect(bodies(mock, 'POST')).toEqual([{ title: 'Técnica/o de selección' }]);
  });

  it('CA-02 un 400 de la API pone «La fecha límite no puede ser anterior a hoy.» junto al campo, con foco, y conserva lo escrito', async () => {
    mockFetch({ 'POST /api/jobs': rejection(PAST_MESSAGE) });
    render(<JobFormScreen mode="create" />);
    type('Título (obligatorio)', 'Técnica/o de selección');
    type(LABEL, '2020-01-01');

    save();

    await waitFor(() => expect(errorOfDeadline()).toBe(PAST_MESSAGE));
    expect(deadlineField().getAttribute('aria-invalid')).toBe('true');
    expect(deadlineField().getAttribute('aria-describedby')).toContain('enrollmentDeadline-error');
    await expectFocusOn(deadlineField);
    expect(deadlineField().value).toBe('2020-01-01');
    expect((screen.getByLabelText('Título (obligatorio)') as HTMLInputElement).value).toBe(
      'Técnica/o de selección',
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(window.location.pathname).toBe('/jobs/new');
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

describe('JobFormScreen · fecha límite de inscripción (edición)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/7/edit');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-03 en una publicada, cambiar la fecha envía solo enrollmentDeadline (EC-18)', async () => {
    const job = makeJob({ status: 'published', enrollmentDeadline: '2026-12-31' });
    const mock = await openEditor(job, {
      'PATCH /api/jobs/7': {
        status: 200,
        json: { ...job, enrollmentDeadline: '2027-01-15' },
      },
    });
    expect(deadlineField().value).toBe('2026-12-31');

    type(LABEL, '2027-01-15');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
    expect(bodies(mock, 'PATCH')).toEqual([{ enrollmentDeadline: '2027-01-15' }]);
  });

  it('CA-03 en una publicada, vaciar la fecha envía null (EC-18)', async () => {
    const job = makeJob({ status: 'published', enrollmentDeadline: '2026-12-31' });
    const mock = await openEditor(job, {
      'PATCH /api/jobs/7': { status: 200, json: { ...job, enrollmentDeadline: null } },
    });

    type(LABEL, '');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
    expect(bodies(mock, 'PATCH')).toEqual([{ enrollmentDeadline: null }]);
  });

  it('CA-04 un 400 de la API en la edición queda junto al campo y no navega (EC-17)', async () => {
    const mock = await openEditor(makeJob({ enrollmentDeadline: '2026-12-31' }), {
      'PATCH /api/jobs/7': rejection(PAST_MESSAGE),
    });

    type(LABEL, '2020-01-01');
    save();

    await waitFor(() => expect(errorOfDeadline()).toBe(PAST_MESSAGE));
    expect(deadlineField().value).toBe('2020-01-01');
    await expectFocusOn(deadlineField);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(window.location.pathname).toBe('/jobs/7/edit');
    expect(bodies(mock, 'PATCH')).toHaveLength(1);
  });

  it('CA-05 editar la descripción de una oferta vencida no reenvía la fecha', async () => {
    const job = makeJob({ status: 'published', enrollmentDeadline: '2020-01-01' });
    const mock = await openEditor(job, {
      'PATCH /api/jobs/7': { status: 200, json: { ...job, description: 'Nueva.' } },
    });
    expect(deadlineField().value).toBe('2020-01-01');

    type('Descripción (obligatorio)', 'Nueva.');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
    expect(bodies(mock, 'PATCH')).toEqual([{ description: 'Nueva.' }]);
  });

  it('EC-21 una oferta sin plazo abre el campo vacío', async () => {
    await openEditor(makeJob({ enrollmentDeadline: null }));

    expect(deadlineField().value).toBe('');
  });

  it('EC-23 guardar sin cambios no envía PATCH', async () => {
    const mock = await openEditor(makeJob({ enrollmentDeadline: '2020-01-01' }));

    save();

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/7'));
    expect(bodies(mock, 'PATCH')).toEqual([]);
  });
});
