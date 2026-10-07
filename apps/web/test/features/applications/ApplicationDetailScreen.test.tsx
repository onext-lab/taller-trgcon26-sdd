import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BAD_RESPONSE_MESSAGE, CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import type { ApplicationDetail } from '../../../src/features/applications/types.ts';
import type { MockRoute } from '../../helpers/fetch.ts';
import { NOT_FOUND_HEADING } from './fixtures.ts';
import {
  APPLICATION_ID,
  DETAIL_FIVE_CHANGES,
  DETAIL_ONE_CHANGE,
  DETAIL_REJECTED_JOB_CLOSED,
  DETAIL_REJECTED_WITH_NOTE,
  DETAIL_THREE_CHANGES,
  MULTILINE_NOTE,
  renderDetail,
} from './stage-fixtures.ts';

const KEY = `GET /api/applications/${APPLICATION_ID}`;
const PATH = `/applications/${APPLICATION_ID}`;
const SERVER_MESSAGE = 'No se ha podido completar la operación.';
const ENVELOPE = { error: { code: 'INTERNAL_ERROR', message: SERVER_MESSAGE } };

function ok(json: unknown): MockRoute {
  return { status: 200, json };
}

function listItems(): HTMLElement[] {
  return within(screen.getByRole('list')).getAllByRole('listitem');
}

function paragraphs(item: HTMLElement): (string | null)[] {
  return Array.from(item.querySelectorAll('p'), (paragraph) => paragraph.textContent);
}

describe('ApplicationDetailScreen', () => {
  beforeEach(() => {
    document.title = 'ATS';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-24 cabecera con link al candidato (/candidates/40) y a la oferta (/jobs/7/pipeline), Etapa actual Entrevista y 3 listitem en orden con dd/mm/aaaa', async () => {
    const detail: ApplicationDetail = {
      ...DETAIL_THREE_CHANGES,
      candidate: { id: 40, fullName: 'Oriol Mas Puig' },
    };
    renderDetail(PATH, { [KEY]: ok(detail) });

    const heading = await screen.findByRole('heading', { level: 1, name: 'Inscripción' });
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('link', { name: 'Oriol Mas Puig' }).getAttribute('href')).toBe(
      '/candidates/40',
    );
    expect(
      screen.getByRole('link', { name: 'Desarrolladora de frontend' }).getAttribute('href'),
    ).toBe('/jobs/7/pipeline');
    const stage = screen.getByText('Etapa actual');
    expect(stage.nextElementSibling?.textContent).toBe('Entrevista');
    expect(screen.getByRole('heading', { level: 2, name: 'Historial' })).toBeDefined();
    expect(screen.getByRole('list', { name: 'Historial' })).toBeDefined();
    const items = listItems();
    expect(items).toHaveLength(3);
    expect(paragraphs(items[0] as HTMLElement)).toEqual(['— → Recibida', 'Fecha: 01/10/2026']);
    expect(paragraphs(items[1] as HTMLElement)).toEqual([
      'Recibida → Cribado',
      'Fecha: 02/10/2026',
    ]);
    expect(paragraphs(items[2] as HTMLElement)).toEqual([
      'Cribado → Entrevista',
      'Fecha: 04/10/2026',
    ]);
    expect(screen.queryByText(/Publicada|published/)).toBeNull();
  });

  it('CA-25 recién creada: — → Recibida', async () => {
    renderDetail(PATH, { [KEY]: ok(DETAIL_ONE_CHANGE) });

    await screen.findByRole('heading', { level: 1, name: 'Inscripción' });
    const items = listItems();
    expect(items).toHaveLength(1);
    expect(within(items[0] as HTMLElement).getByText('— → Recibida')).toBeDefined();
    expect(screen.getByText('Etapa actual').nextElementSibling?.textContent).toBe('Recibida');
    expect(screen.queryByText(/Motivo:/)).toBeNull();
    expect(screen.queryByText('Nota:')).toBeNull();
  });

  it('CA-26 rechazo con motivo y nota multilínea', async () => {
    renderDetail(PATH, { [KEY]: ok(DETAIL_REJECTED_WITH_NOTE) });

    await screen.findByRole('heading', { level: 1, name: 'Inscripción' });
    const items = listItems();
    expect(items).toHaveLength(3);
    const last = items[2] as HTMLElement;
    expect(paragraphs(last)).toEqual([
      'Cribado → Rechazado',
      'Fecha: 03/10/2026',
      'Motivo: Retirada del candidato',
      'Nota:',
      MULTILINE_NOTE,
    ]);
    const note = last.querySelector('.pre-wrap');
    expect(note?.textContent).toBe(MULTILINE_NOTE);
    expect(note?.classList.contains('long-text')).toBe(true);
    expect(screen.getByText('Etapa actual').nextElementSibling?.textContent).toBe('Rechazado');
  });

  it('CA-26 job_closed con Motivo: Oferta cerrada y sin Nota', async () => {
    renderDetail(PATH, { [KEY]: ok(DETAIL_REJECTED_JOB_CLOSED) });

    await screen.findByRole('heading', { level: 1, name: 'Inscripción' });
    const last = listItems()[1] as HTMLElement;
    expect(paragraphs(last)).toEqual([
      'Recibida → Rechazado',
      'Fecha: 03/10/2026',
      'Motivo: Oferta cerrada',
    ]);
    expect(screen.queryByText('Nota:')).toBeNull();
  });

  it.each([404, 400])('CA-27 %i → Página no encontrada', async (status) => {
    renderDetail(PATH, { [KEY]: { status, json: ENVELOPE } });

    expect(await screen.findByRole('heading', { name: NOT_FOUND_HEADING })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Inscripción' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('EC-42 /applications/abc → Página no encontrada sin petición', async () => {
    const mock = renderDetail('/applications/abc', {});

    expect(screen.getByRole('heading', { name: NOT_FOUND_HEADING })).toBeDefined();
    await waitFor(() => expect(document.title).toBe('Inscripción · ATS'));
    expect(mock.calls).toEqual([]);
  });

  it('CA-28/EC-44 red → mensaje útil y Reintentar que repite el GET', async () => {
    let attempts = 0;
    const mock = renderDetail(PATH, {
      [KEY]: () => {
        attempts += 1;
        return attempts === 1 ? { networkError: true } : { status: 200, json: DETAIL_ONE_CHANGE };
      },
    });

    expect((await screen.findByRole('alert')).textContent).toBe(CONNECTION_MESSAGE);
    expect(screen.getByRole('heading', { level: 1, name: 'Inscripción' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Historial' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mock.calls.map((call) => `${call.method} ${call.url}`)).toEqual([KEY, KEY]);
  });

  it('CA-28 5xx → el mensaje del servidor y Reintentar', async () => {
    renderDetail(PATH, { [KEY]: { status: 500, json: ENVELOPE } });

    expect((await screen.findByRole('alert')).textContent).toBe(SERVER_MESSAGE);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
  });

  it('EC-45 forma no válida → error con Reintentar', async () => {
    renderDetail(PATH, { [KEY]: ok({ ...DETAIL_ONE_CHANGE, history: [] }) });

    expect((await screen.findByRole('alert')).textContent).toBe(BAD_RESPONSE_MESSAGE);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('EC-45 la respuesta de otra inscripción → error con Reintentar', async () => {
    renderDetail(PATH, { [KEY]: ok({ ...DETAIL_ONE_CHANGE, id: APPLICATION_ID + 1 }) });

    expect((await screen.findByRole('alert')).textContent).toBe(BAD_RESPONSE_MESSAGE);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
  });

  it('EC-43 2026-12-31T23:30:00.000Z → 01/01/2027', async () => {
    const detail: ApplicationDetail = {
      ...DETAIL_ONE_CHANGE,
      history: [
        { ...(DETAIL_ONE_CHANGE.history[0] as object), changedAt: '2026-12-31T23:30:00.000Z' },
      ],
    } as ApplicationDetail;
    renderDetail(PATH, { [KEY]: ok(detail) });

    const time = await screen.findByText('01/01/2027');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('datetime')).toBe('2026-12-31T23:30:00.000Z');
  });

  it('EC-20 5 cambios en orden', async () => {
    renderDetail(PATH, { [KEY]: ok(DETAIL_FIVE_CHANGES) });

    await screen.findByRole('heading', { level: 1, name: 'Inscripción' });
    expect(listItems().map((item) => paragraphs(item)[0])).toEqual([
      '— → Recibida',
      'Recibida → Cribado',
      'Cribado → Entrevista',
      'Entrevista → Oferta',
      'Oferta → Contratado',
    ]);
    expect(screen.getByText('Etapa actual').nextElementSibling?.textContent).toBe('Contratado');
  });

  it('cargando: «Cargando la inscripción…» como status, con el h1 y el título', async () => {
    renderDetail(PATH, { [KEY]: { hang: true } });

    expect(screen.getByRole('status').textContent).toBe('Cargando la inscripción…');
    expect(screen.getByRole('heading', { level: 1, name: 'Inscripción' })).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
    await waitFor(() => expect(document.title).toBe('Inscripción · ATS'));
  });

  it('título Inscripción · ATS en error y con datos', async () => {
    let attempts = 0;
    renderDetail(PATH, {
      [KEY]: () => {
        attempts += 1;
        return attempts === 1 ? { networkError: true } : { status: 200, json: DETAIL_ONE_CHANGE };
      },
    });

    await screen.findByRole('alert');
    await waitFor(() => expect(document.title).toBe('Inscripción · ATS'));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('heading', { level: 2, name: 'Historial' });
    await waitFor(() => expect(document.title).toBe('Inscripción · ATS'));
  });
});
