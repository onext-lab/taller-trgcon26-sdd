import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationDetail } from '../../../src/features/applications/types.ts';
import {
  APPLICATION_ID,
  DETAIL_REJECTED_WITH_NOTE,
  DETAIL_THREE_CHANGES,
  renderDetail,
} from './stage-fixtures.ts';

// Adversarial tests of the application detail (TASK-14): hostile text and fields it must not paint. Invented data only.
const KEY = `GET /api/applications/${APPLICATION_ID}`;
const PATH = `/applications/${APPLICATION_ID}`;
const HOSTILE = '<img src=x onerror=alert(1)>';
const EMAIL = 'oriol.mas@example.com';
const PHONE = '+34 600 000 000';

function hostileDetail(): ApplicationDetail {
  const history = DETAIL_REJECTED_WITH_NOTE.history.map((entry) =>
    entry.note === null ? entry : { ...entry, note: HOSTILE },
  );
  return {
    ...DETAIL_REJECTED_WITH_NOTE,
    candidate: { ...DETAIL_REJECTED_WITH_NOTE.candidate, fullName: HOSTILE },
    history,
  };
}

// The same detail with `email` and `phone` added at every level where the API could drag them along.
function detailWithPersonalData(): unknown {
  const extra = { email: EMAIL, phone: PHONE };
  const detail = DETAIL_THREE_CHANGES;
  return {
    ...detail,
    ...extra,
    candidate: { ...detail.candidate, ...extra },
    job: { ...detail.job, ...extra },
    history: detail.history.map((entry) => ({ ...entry, ...extra })),
  };
}

describe('ApplicationDetailScreen: hostiles y datos de más (RF-07)', () => {
  beforeEach(() => {
    document.title = 'ATS';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('EC-46 nombre y nota con HTML como texto, título Inscripción · ATS', async () => {
    renderDetail(PATH, { [KEY]: { status: 200, json: hostileDetail() } });

    const link = await screen.findByRole('link', { name: HOSTILE });
    expect(link.getAttribute('href')).toBe('/candidates/12');
    const history = screen.getByRole('list', { name: 'Historial' });
    const note = within(history).getByText(HOSTILE);
    expect(note.textContent).toBe(HOSTILE);
    expect(note.classList.contains('pre-wrap')).toBe(true);
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('[onerror]')).toBeNull();
    expect(document.body.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
    await waitFor(() => expect(document.title).toBe('Inscripción · ATS'));
    await waitFor(() => expect(document.title).not.toContain('Oriol'));
    await waitFor(() => expect(document.title).not.toContain(HOSTILE));
    expect(window.location.href).not.toContain('img');
  });

  it('EC-23 email y phone de más no se pintan', async () => {
    renderDetail(PATH, { [KEY]: { status: 200, json: detailWithPersonalData() } });

    await screen.findByRole('heading', { level: 2, name: 'Historial' });

    expect(screen.getByRole('link', { name: 'Oriol Mas Puig' })).toBeDefined();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3);
    expect(document.body.textContent).not.toContain('@');
    expect(document.body.textContent).not.toContain(EMAIL);
    expect(document.body.textContent).not.toContain(PHONE);
    expect(document.body.innerHTML).not.toContain('@');
    expect(document.body.innerHTML).not.toContain('600 000');
    expect(screen.queryByText(/email|teléfono|phone/i)).toBeNull();
  });
});
