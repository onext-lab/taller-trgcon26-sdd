import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobDetailScreen } from '../../../src/features/jobs/JobDetailScreen.tsx';
import type { Job } from '../../../src/features/jobs/types.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import { mockFetch, type MockRoute } from '../../helpers/fetch.ts';
import { makeJob } from './fixtures.ts';

// Invented data only.
const DRAFT: Job = makeJob();

const PUBLISHED: Job = { ...DRAFT, status: 'published', publishedAt: '2026-10-06T09:00:00.000Z' };
const PUBLISHED_CONTROLS = ['Ver pipeline', 'Editar', 'Cerrar', 'Duplicar'];
// The copy keeps the title exactly as the API returns it (EC-26).
const COPY: Job = { ...DRAFT, id: 8, title: 'Técnica/o de selección (copia) <b>' };

function failure(status: number, code: string, message: string, details?: unknown): MockRoute {
  return { status, json: { error: { code, message, details } } };
}

async function renderDraft(routes: Record<string, MockRoute> = {}) {
  const mock = mockFetch({ 'GET /api/jobs/7': { status: 200, json: DRAFT }, ...routes });
  render(<JobDetailScreen />);
  await screen.findByRole('heading', { level: 1, name: DRAFT.title });
  return mock;
}

// A real click gives the button the focus before it fires; `fireEvent` does not, so it is done here.
function click(name: string): void {
  const button = screen.getByRole('button', { name });
  button.focus();
  fireEvent.click(button);
}
function controls(): string[] {
  return [...document.querySelectorAll('a, button')]
    .filter((control) => control.closest('dialog') === null)
    .map((control) => control.textContent ?? '');
}

describe('JobDetailScreen: publicar y duplicar', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/jobs/7');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-01: publicar → ficha publicada con fecha, 3 acciones, aviso y foco en el h1', async () => {
    const mock = await renderDraft({
      'POST /api/jobs/7/publish': { status: 200, json: PUBLISHED },
    });

    click('Publicar');

    expect((await screen.findByRole('status')).textContent).toBe('Oferta publicada.');
    const publish = mock.calls.filter((call) => call.method === 'POST');
    expect(publish).toHaveLength(1);
    expect(publish[0]?.url).toBe('/api/jobs/7/publish');
    expect(publish[0]?.body).toBeUndefined();
    expect(screen.getByText('Publicada')).toBeDefined();
    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    expect(terms).toContain('Fecha de publicación');
    expect(document.querySelectorAll('dd time')[1]?.textContent).toBe('06/10/2026');
    expect(controls()).toEqual(PUBLISHED_CONTROLS);
    await expectFocusOn(() => screen.getByRole('heading', { level: 1 }));
    expect(mock.calls.filter((call) => call.method === 'GET')).toHaveLength(1);
  });

  it('CA-03/EC-02: campos pendientes → alerta con las etiquetas en orden y «Editar»', async () => {
    await renderDraft({
      'POST /api/jobs/7/publish': failure(400, 'VALIDATION_ERROR', 'Datos no válidos.', [
        { field: 'description', message: 'Obligatorio.' },
        { field: 'workMode', message: 'Obligatorio.' },
      ]),
    });

    click('Publicar');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Para publicar falta: Descripción, Modalidad.');
    expect(screen.getByRole('link', { name: 'Editar' }).getAttribute('href')).toBe('/jobs/7/edit');
    expect(screen.getByText('Borrador')).toBeDefined();
    const button = screen.getByRole('button', { name: 'Publicar' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await expectFocusOn(() => button);
  });

  it('un 400 sin lista de campos muestra su message', async () => {
    await renderDraft({
      'POST /api/jobs/7/publish': failure(400, 'VALIDATION_ERROR', 'Petición no válida.', [
        { field: 'id', message: 'Debe ser un entero.' },
      ]),
    });

    click('Publicar');

    expect((await screen.findByRole('alert')).textContent).toBe('Petición no válida.');
  });

  it('CA-14/CA-15/EC-26: duplicar → ficha nueva con «Oferta duplicada.» y la original intacta', async () => {
    const mock = await renderDraft({
      'POST /api/jobs/7/duplicate': { status: 201, json: COPY },
      'GET /api/jobs/8': { status: 200, json: COPY },
    });

    click('Duplicar');

    await waitFor(() => expect(window.location.pathname).toBe('/jobs/8'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Técnica/o de selección (copia) <b>' }),
    ).toBeDefined();
    expect(screen.getAllByRole('status').map((status) => status.textContent)).toEqual([
      'Oferta duplicada.',
    ]);
    expect(screen.getByText('Borrador')).toBeDefined();
    expect(document.querySelectorAll('b')).toHaveLength(0);
    const writes = mock.calls.filter((call) => call.method !== 'GET');
    expect(writes.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /api/jobs/7/duplicate',
    ]);
    expect(mock.unmatched).toEqual([]);
  });

  it('acciones deshabilitadas mientras publica, con «Publicando…»', async () => {
    await renderDraft({ 'POST /api/jobs/7/publish': { hang: true } });

    click('Publicar');

    const publishing = (await screen.findByRole('button', {
      name: 'Publicando…',
    })) as HTMLButtonElement;
    expect(publishing.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Duplicar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: 'Borrar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('acciones deshabilitadas mientras duplica, con «Duplicando…»', async () => {
    await renderDraft({ 'POST /api/jobs/7/duplicate': { hang: true } });

    click('Duplicar');

    const duplicating = (await screen.findByRole('button', {
      name: 'Duplicando…',
    })) as HTMLButtonElement;
    expect(duplicating.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Publicar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('EC-05: un 500 al publicar muestra el message, sigue «Borrador» y el botón vuelve con el foco', async () => {
    await renderDraft({
      'POST /api/jobs/7/publish': failure(500, 'INTERNAL_ERROR', 'Error interno del servidor.'),
    });

    click('Publicar');

    expect((await screen.findByRole('alert')).textContent).toBe('Error interno del servidor.');
    const button = screen.getByRole('button', { name: 'Publicar' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await expectFocusOn(() => button);
    expect(screen.getByText('Borrador')).toBeDefined();
  });

  it('EC-43/EC-27: sin red al duplicar → alerta, sigue en la ficha y «Duplicar» habilitado', async () => {
    await renderDraft({ 'POST /api/jobs/7/duplicate': { networkError: true } });

    click('Duplicar');

    expect((await screen.findByRole('alert')).textContent).toContain('No se ha podido conectar');
    expect(window.location.pathname).toBe('/jobs/7');
    const button = screen.getByRole('button', { name: 'Duplicar' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await expectFocusOn(() => button);
  });

  it('EC-06/EC-25: un 404 al publicar o duplicar muestra «Esta oferta ya no existe.» sin acciones', async () => {
    await renderDraft({
      'POST /api/jobs/7/duplicate': failure(404, 'JOB_NOT_FOUND', 'Oferta no encontrada.'),
    });

    click('Duplicar');

    expect((await screen.findByRole('alert')).textContent).toBe('Esta oferta ya no existe.');
    expect(screen.getByRole('link', { name: 'Volver a las ofertas' })).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('409 al publicar: muestra el message de la API, recarga la oferta y devuelve el foco al h1', async () => {
    let reads = 0;
    await renderDraft({
      'GET /api/jobs/7': () => ({ status: 200, json: ++reads === 1 ? DRAFT : PUBLISHED }),
      'POST /api/jobs/7/publish': failure(409, 'JOB_NOT_DRAFT', 'La oferta ya no es un borrador.'),
    });

    click('Publicar');

    await waitFor(() => expect(controls()).toEqual(PUBLISHED_CONTROLS));
    expect(screen.getByRole('alert').textContent).toBe('La oferta ya no es un borrador.');
    await expectFocusOn(() => screen.getByRole('heading', { level: 1 }));
  });

  it('EC-06 [adversarial] un 404 al publicar muestra «Esta oferta ya no existe.» y «Volver a las ofertas», sin acciones', async () => {
    await renderDraft({
      'POST /api/jobs/7/publish': failure(404, 'JOB_NOT_FOUND', 'Oferta no encontrada.'),
    });

    click('Publicar');

    expect((await screen.findByRole('alert')).textContent).toBe('Esta oferta ya no existe.');
    expect(screen.getByRole('link', { name: 'Volver a las ofertas' }).getAttribute('href')).toBe(
      '/jobs',
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();
  });

  it('EC-25 [adversarial] un 404 al duplicar muestra «Esta oferta ya no existe.» y no navega', async () => {
    await renderDraft({
      'POST /api/jobs/7/duplicate': failure(404, 'JOB_NOT_FOUND', 'Oferta no encontrada.'),
    });

    click('Duplicar');

    expect((await screen.findByRole('alert')).textContent).toBe('Esta oferta ya no existe.');
    expect(window.location.pathname).toBe('/jobs/7');
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull();
  });

  it('EC-43/EC-05 [adversarial] sin red al publicar → alerta, sigue «Borrador» y «Publicar» habilitado con el foco', async () => {
    await renderDraft({ 'POST /api/jobs/7/publish': { networkError: true } });

    click('Publicar');

    expect((await screen.findByRole('alert')).textContent).toContain('No se ha podido conectar');
    expect(screen.getByText('Borrador')).toBeDefined();
    const button = screen.getByRole('button', { name: 'Publicar' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await expectFocusOn(() => button);
  });

  it('EC-27 [adversarial] un 500 al duplicar → alerta, sigue en la ficha original y «Duplicar» habilitado con el foco', async () => {
    await renderDraft({
      'POST /api/jobs/7/duplicate': failure(500, 'INTERNAL_ERROR', 'Error interno del servidor.'),
    });

    click('Duplicar');

    expect((await screen.findByRole('alert')).textContent).toBe('Error interno del servidor.');
    expect(window.location.pathname).toBe('/jobs/7');
    expect(screen.getByRole('heading', { level: 1, name: DRAFT.title })).toBeDefined();
    const button = screen.getByRole('button', { name: 'Duplicar' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await expectFocusOn(() => button);
  });

  it('EC-09 [adversarial] doble clic en Publicar = 1 POST', async () => {
    const mock = await renderDraft({ 'POST /api/jobs/7/publish': { hang: true } });
    const button = screen.getByRole('button', { name: 'Publicar' });

    button.focus();
    fireEvent.click(button);
    fireEvent.click(button);

    await screen.findByRole('button', { name: 'Publicando…' });
    const posts = mock.calls.filter((call) => call.method === 'POST');
    expect(posts.map((call) => call.url)).toEqual(['/api/jobs/7/publish']);
  });

  it('EC-31 [adversarial] doble clic en Duplicar = 1 POST y «Duplicando…»', async () => {
    const mock = await renderDraft({ 'POST /api/jobs/7/duplicate': { hang: true } });
    const button = screen.getByRole('button', { name: 'Duplicar' });

    button.focus();
    fireEvent.click(button);
    fireEvent.click(button);

    expect(await screen.findByRole('button', { name: 'Duplicando…' })).toBeDefined();
    const posts = mock.calls.filter((call) => call.method === 'POST');
    expect(posts.map((call) => call.url)).toEqual(['/api/jobs/7/duplicate']);
    expect(window.location.pathname).toBe('/jobs/7');
  });
});
