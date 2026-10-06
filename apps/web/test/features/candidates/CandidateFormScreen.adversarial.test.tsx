import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App.tsx';
import { CandidateFormScreen } from '../../../src/features/candidates/CandidateFormScreen.tsx';
import { mockFetch, type FetchMock, type MockRoute } from '../../helpers/fetch.ts';

// Adversarial tests of the candidate form (TASK-13), apart from the happy path. Invented data only.
const NAME = 'Lucía Ferrer Soler';
const EMAIL = 'lucia.ferrer@example.com';
const CANDIDATE = {
  id: 7,
  fullName: NAME,
  email: EMAIL,
  phone: '+34 600 000 001',
  summary: 'Backend con Node.',
  skills: ['typescript', 'sql'],
  createdAt: '2026-10-06T09:30:00.000Z',
  consentGivenAt: '2026-10-06T09:30:00.000Z',
  consentVersion: 'v1',
  consentWithdrawnAt: null,
  retentionEndsAt: '2028-10-06',
};
const NAME_LABEL = 'Nombre y apellidos (obligatorio)';
const EMAIL_LABEL = 'Email (obligatorio)';
const DUPLICATE_MESSAGE = 'Ya existe un candidato con este email.';
const SUMMARY_MESSAGE = 'El resumen no puede pasar de 2 000 caracteres.';
const KEPT = 'Texto que no se debe perder';
const REJECTIONS: [number, string, string][] = [
  [403, 'CROSS_SITE_REQUEST', 'Petición no permitida desde otro sitio.'],
  [413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la petición es demasiado grande.'],
];

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function save(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

// Two clicks and a direct submit while the request is still pending (the button changes its name).
function saveThreeTimes(): void {
  const form = screen.getByRole('button', { name: 'Guardar' }).closest('form') as HTMLFormElement;
  save();
  fireEvent.click(screen.getByRole('button', { name: 'Guardando…' }));
  fireEvent.submit(form);
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function errorOf(label: string): string | null {
  const id = field(label)
    .getAttribute('aria-describedby')
    ?.split(' ')
    .find((part) => part.endsWith('-error'));
  return id ? (document.getElementById(id)?.textContent ?? null) : null;
}

function fillRequired(): void {
  type(NAME_LABEL, NAME);
  type(EMAIL_LABEL, EMAIL);
}

function envelope(status: number, code: string, message: string, details?: unknown[]): MockRoute {
  return { status, json: { error: { code, message, ...(details ? { details } : {}) } } };
}

function bodies(mock: FetchMock, method: string): Record<string, unknown>[] {
  return mock.calls
    .filter((call) => call.method === method)
    .map((call) => JSON.parse(call.body ?? 'null') as Record<string, unknown>);
}

function duplicate(existingId: unknown): MockRoute {
  const detail = { field: 'email', message: DUPLICATE_MESSAGE, existingId };
  return envelope(409, 'DUPLICATE', DUPLICATE_MESSAGE, [detail]);
}

async function openEditor(extra: Record<string, MockRoute> = {}): Promise<FetchMock> {
  const mock = mockFetch({
    'GET /api/health': { status: 200, json: { status: 'ok' } },
    'GET /api/candidates/7': { status: 200, json: CANDIDATE },
    ...extra,
  });
  render(<App />);
  await screen.findByRole('heading', { name: 'Editar candidato' });
  return mock;
}

describe('CandidateFormScreen · alta · adversarial', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/candidates/new');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('CA-05 / EC-07: un 409 pone el message junto al email y el enlace, sin pedir el existente ni pintar sus datos', async () => {
    const mock = mockFetch({ 'POST /api/candidates': duplicate(42) });
    render(<CandidateFormScreen mode="create" />);
    fillRequired();
    save();

    await waitFor(() => expect(errorOf(EMAIL_LABEL)).toBe(DUPLICATE_MESSAGE));
    const link = screen.getByRole('link', { name: 'Ver el candidato existente' });
    expect(link.getAttribute('href')).toBe('/candidates/42');
    expect(mock.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /api/candidates',
    ]);
    expect(mock.unmatched).toEqual([]);
    expect(document.body.textContent).not.toContain('Backend con Node.');
  });

  it.each([
    ['ausente', undefined],
    ['0', 0],
    ['una cadena', '42'],
  ])('CA-05 / EC-07: un 409 con existingId %s muestra el mensaje sin enlace', async (_n, id) => {
    mockFetch({ 'POST /api/candidates': duplicate(id) });
    render(<CandidateFormScreen mode="create" />);
    fillRequired();
    save();

    await waitFor(() => expect(errorOf(EMAIL_LABEL)).toBe(DUPLICATE_MESSAGE));
    expect(screen.queryByRole('link', { name: 'Ver el candidato existente' })).toBeNull();
  });

  it('EC-08: doble clic en «Guardar» con el POST pendiente = un solo POST', async () => {
    const mock = mockFetch({ 'POST /api/candidates': { hang: true } });
    render(<CandidateFormScreen mode="create" />);
    fillRequired();

    saveThreeTimes();

    const busy = await screen.findByRole('button', { name: 'Guardando…' });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(bodies(mock, 'POST')).toHaveLength(1);
  });

  it.each([
    ['NUL en el nombre', NAME_LABEL, 'Lucía\u0000 Ferrer'],
    ['tabulador en una skill', 'Skills', 'sql, no\tde'],
    ['DEL en el email', EMAIL_LABEL, 'lucia\u007f.ferrer@example.com'],
    ['DEL en el teléfono', 'Teléfono', '600\u007f000 001'],
    ['2 001 caracteres en el resumen (EC-17)', 'Resumen', 'a'.repeat(2001)],
  ])('EC-58: %s = error junto al campo y ninguna petición', (_n, label, value) => {
    const mock = mockFetch({});
    render(<CandidateFormScreen mode="create" />);
    fillRequired();
    type(label, value);
    save();

    expect(field(label).getAttribute('aria-invalid')).toBe('true');
    expect(errorOf(label)).not.toBeNull();
    expect(field(label).value).toBe(value);
    expect(mock.calls).toEqual([]);
  });

  it('EC-58 / EC-02 / EC-19 / EC-59: un resumen con saltos de línea pasa y el cuerpo del alta solo lleva claves de S2', async () => {
    const mock = mockFetch({ 'POST /api/candidates': { status: 201, json: CANDIDATE } });
    render(<CandidateFormScreen mode="create" />);
    fillRequired();
    type('Teléfono', '600 000 001');
    type('Resumen', 'Primera línea.\nSegunda línea.\n\nTercera.');
    type('Skills', 'sql');
    fireEvent.click(screen.getByRole('checkbox', { name: 'El candidato da su consentimiento' }));
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/candidates/7'));
    const body = bodies(mock, 'POST')[0] ?? {};
    expect(Object.keys(body).sort()).toEqual([
      'consent',
      'email',
      'fullName',
      'phone',
      'skills',
      'summary',
    ]);
    expect(body.summary).toBe('Primera línea.\nSegunda línea.\n\nTercera.');
  });

  it('EC-02 / EC-19 / EC-59: un 400 con field «body» (no del formulario) va a la alerta y no marca campos', async () => {
    const details = [{ field: 'body', message: 'Problema en el cuerpo.' }];
    mockFetch({ 'POST /api/candidates': envelope(400, 'VALIDATION_ERROR', 'No válido.', details) });
    render(<CandidateFormScreen mode="create" />);
    fillRequired();
    save();

    expect((await screen.findByRole('alert')).textContent).toBe('Problema en el cuerpo.');
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
    expect(field(EMAIL_LABEL).value).toBe(EMAIL);
  });

  it.each(REJECTIONS)(
    'DEC-12: un %i %s = alerta con su message y lo escrito conservado',
    async (status, code, message) => {
      mockFetch({ 'POST /api/candidates': envelope(status, code, message) });
      render(<CandidateFormScreen mode="create" />);
      fillRequired();
      type('Skills', 'sql, node');
      save();

      expect((await screen.findByRole('alert')).textContent).toBe(message);
      expect(field(NAME_LABEL).value).toBe(NAME);
      expect(field(EMAIL_LABEL).value).toBe(EMAIL);
      expect(field('Skills').value).toBe('sql, node');
      expect(window.location.pathname).toBe('/candidates/new');
    },
  );
});

describe('CandidateFormScreen · edición · adversarial', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/candidates/7/edit');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('EC-08: doble clic en «Guardar» con el PATCH pendiente = un solo PATCH', async () => {
    const mock = await openEditor({ 'PATCH /api/candidates/7': { hang: true } });
    type('Teléfono', '600 000 002');
    saveThreeTimes();

    await screen.findByRole('button', { name: 'Guardando…' });
    expect(bodies(mock, 'PATCH')).toHaveLength(1);
  });

  it('EC-58 / EC-17: NUL en el nombre, DEL en el teléfono y 2 001 en el resumen = errores junto al campo y ningún PATCH', async () => {
    const mock = await openEditor({});
    type(NAME_LABEL, 'Lucía\u0000 Ferrer');
    type('Teléfono', '600\u007f000 001');
    type('Resumen', 'a'.repeat(2001));
    save();

    expect(errorOf(NAME_LABEL)).toBe('No puede tener caracteres de control.');
    expect(errorOf('Teléfono')).not.toBeNull();
    expect(errorOf('Resumen')).toBe(SUMMARY_MESSAGE);
    expect(bodies(mock, 'PATCH')).toEqual([]);
  });

  it('EC-02 / EC-19 / EC-59: el PATCH solo lleva claves de S4 y nunca el consentimiento', async () => {
    const mock = await openEditor({ 'PATCH /api/candidates/7': { status: 200, json: CANDIDATE } });
    type(NAME_LABEL, 'Lucía Ferrer');
    type(EMAIL_LABEL, 'otra.lucia@example.com');
    type('Teléfono', '600 000 002');
    type('Resumen', 'Otro resumen.');
    type('Skills', 'node');
    save();

    await waitFor(() => expect(window.location.pathname).toBe('/candidates/7'));
    const patch = bodies(mock, 'PATCH')[0] ?? {};
    expect(Object.keys(patch).sort()).toEqual(['email', 'fullName', 'phone', 'skills', 'summary']);
    expect(JSON.stringify(patch)).not.toMatch(/consent|retentionEndsAt|createdAt|"id"|version/i);
  });

  it('EC-02 / EC-19 / EC-59: un 400 con field «retentionEndsAt» va a la alerta y conserva lo escrito', async () => {
    await openEditor({
      'PATCH /api/candidates/7': envelope(400, 'VALIDATION_ERROR', 'Datos no válidos.', [
        { field: 'retentionEndsAt', message: 'No se puede cambiar la retención.' },
      ]),
    });
    type('Resumen', KEPT);
    save();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('No se puede cambiar la retención.');
    expect(field('Resumen').value).toBe(KEPT);
  });

  it.each(REJECTIONS)(
    'DEC-12: un %i %s al guardar = alerta con su message y lo escrito conservado',
    async (status, code, message) => {
      await openEditor({ 'PATCH /api/candidates/7': envelope(status, code, message) });
      type('Resumen', KEPT);
      save();

      expect((await screen.findByRole('alert')).textContent).toBe(message);
      expect(field('Resumen').value).toBe(KEPT);
      expect(window.location.pathname).toBe('/candidates/7/edit');
    },
  );

  it('EC-25 / RNF-09: el título es «Editar candidato · ATS» sin el nombre y la URL solo lleva el ID', async () => {
    await openEditor({});

    await waitFor(() => expect(document.title).toBe('Editar candidato · ATS'));
    expect(document.title).not.toContain('Lucía');
    const { pathname, search, hash } = window.location;
    expect(`${pathname}${search}${hash}`).toBe('/candidates/7/edit');
  });
});
