import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BAD_RESPONSE_MESSAGE, CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import type { MockReply, MockRoute } from '../../helpers/fetch.ts';
import {
  CLOSED_PIPELINE,
  DRAFT_PIPELINE,
  EMPTY_PUBLISHED_PIPELINE,
  NOT_FOUND_HEADING,
  PUBLISHED_PIPELINE,
  renderPipeline,
} from './fixtures.ts';

const KEY = 'GET /api/jobs/7/applications';
const PATH = '/jobs/7/pipeline';
const DRAFT_TEXT = 'Esta oferta es un borrador: publícala para inscribir candidatos.';
const EMPTY_TEXT = 'Todavía no hay candidatos inscritos en esta oferta.';
const SERVER_MESSAGE = 'No se ha podido completar la operación.';
const ENVELOPE = { error: { code: 'INTERNAL_ERROR', message: SERVER_MESSAGE } };
const BUTTON = { name: 'Inscribir candidato' };

function ok(json: unknown): MockRoute {
  return { status: 200, json };
}

describe('PipelineScreen: estados', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('cargando: «Cargando el pipeline…» como status, con el h1 y el enlace de vuelta', () => {
    renderPipeline(PATH, { [KEY]: { hang: true } });

    expect(screen.getByRole('status').textContent).toBe('Cargando el pipeline…');
    expect(screen.getByRole('heading', { level: 1, name: 'Pipeline de la oferta' })).toBeDefined();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('button', BUTTON)).toBeNull();
  });

  it('CA-14: una oferta published vacía muestra el mensaje y el botón, sin columnas', async () => {
    renderPipeline(PATH, { [KEY]: ok(EMPTY_PUBLISHED_PIPELINE) });

    expect(await screen.findByText(EMPTY_TEXT)).toBeDefined();
    const button = screen.getByRole('button', BUTTON);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('CA-26: una published con datos muestra las 6 columnas y el botón encima', async () => {
    renderPipeline(PATH, { [KEY]: ok(PUBLISHED_PIPELINE) });

    expect(await screen.findAllByRole('region')).toHaveLength(6);
    const button = screen.getByRole('button', BUTTON);
    const firstRegion = screen.getAllByRole('region')[0] as HTMLElement;
    expect(button.compareDocumentPosition(firstRegion) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
  });

  it('CA-26: un borrador muestra el mensaje, sin region ni botón', async () => {
    renderPipeline(PATH, { [KEY]: ok(DRAFT_PIPELINE) });

    expect(await screen.findByText(DRAFT_TEXT)).toBeDefined();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
  });

  it('CA-26: una cerrada muestra las columnas y ningún botón', async () => {
    renderPipeline(PATH, { [KEY]: ok(CLOSED_PIPELINE) });

    expect(await screen.findAllByRole('region')).toHaveLength(6);
    expect(screen.getByText('Elena Mora Lara')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('CA-26: una cerrada vacía muestra el mensaje de vacío y ningún botón', async () => {
    renderPipeline(PATH, { [KEY]: ok({ job: { id: 7, status: 'closed' }, items: [] }) });

    expect(await screen.findByText(EMPTY_TEXT)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it.each([
    [404, 'NOT_FOUND', 'La oferta no existe.'],
    [400, 'VALIDATION_ERROR', 'Datos no válidos.'],
  ])('CA-15: un %i del GET muestra «Página no encontrada»', async (status, code, message) => {
    renderPipeline(PATH, { [KEY]: { status, json: { error: { code, message } } } });

    expect(await screen.findByRole('heading', { name: NOT_FOUND_HEADING })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Pipeline de la oferta' })).toBeNull();
  });

  it('EC-35: /jobs/abc/pipeline muestra «Página no encontrada» sin ninguna petición', () => {
    const mock = renderPipeline('/jobs/abc/pipeline', {});

    expect(screen.getByRole('heading', { name: NOT_FOUND_HEADING })).toBeDefined();
    expect(mock.calls).toHaveLength(0);
  });

  it.each<[string, MockReply, string]>([
    ['red', { networkError: true }, CONNECTION_MESSAGE],
    ['500', { status: 500, json: ENVELOPE }, SERVER_MESSAGE],
    ['respuesta no válida', { status: 200, json: { items: 'no' } }, BAD_RESPONSE_MESSAGE],
  ])(
    'CA-16/EC-37: %s → alerta útil sin stack y «Reintentar» repite el GET',
    async (_t, bad, text) => {
      let attempts = 0;
      const mock = renderPipeline(PATH, {
        [KEY]: () => (++attempts === 1 ? bad : { status: 200, json: EMPTY_PUBLISHED_PIPELINE }),
      });

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe(text);
      expect(alert.textContent).not.toMatch(/\bat\s|Error:|\.tsx?:\d/);
      expect(screen.queryByRole('region')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByText(EMPTY_TEXT)).toBeDefined();
      expect(mock.calls.filter((call) => call.url === '/api/jobs/7/applications')).toHaveLength(2);
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );
});
