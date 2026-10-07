import { fireEvent, screen, within } from '@testing-library/react';
import type { FetchMock, MockReply } from '../../helpers/fetch.ts';
import type { Pipeline } from '../../../src/features/applications/types.ts';
import { ok, sequence } from './enroll-fixtures.ts';
import { PUBLISHED_PIPELINE, renderPipeline } from './fixtures.ts';

/** Shared by the reject tests: Oriol (application 28, in `interview`) is the card that gets rejected. */

export const PIPELINE = 'GET /api/jobs/7/applications';
export const REJECT = 'POST /api/applications/28/reject';
export const TRIGGER = 'Rechazar: Oriol Mas Puig';
export const DIALOG = 'Rechazar la inscripción';
export const SERVER_TEXT = 'No se ha podido completar la operación.';

/** The published pipeline with Oriol in `rejected`, as the reload after the reject would bring it. */
export const ORIOL_REJECTED: Pipeline = {
  job: PUBLISHED_PIPELINE.job,
  items: PUBLISHED_PIPELINE.items.map((item) =>
    item.id === 28
      ? { ...item, stage: 'rejected' as const, rejectionReason: 'not_a_fit' as const }
      : item,
  ),
};

export function renderReject(post: MockReply, reload: MockReply = ok(ORIOL_REJECTED)): FetchMock {
  return renderPipeline('/jobs/7/pipeline', {
    [PIPELINE]: sequence(ok(PUBLISHED_PIPELINE), reload),
    [REJECT]: post,
  });
}

// `fireEvent.click` does not move the focus, so focus the trigger first, as a person would.
export async function openRejectDialog(): Promise<{
  trigger: HTMLElement;
  dialog: HTMLDialogElement;
}> {
  const trigger = await screen.findByRole('button', { name: TRIGGER });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = (await screen.findByRole('dialog', { name: DIALOG })) as HTMLDialogElement;
  return { trigger, dialog };
}

export function pickReason(dialog: HTMLElement, label: string): void {
  fireEvent.click(within(dialog).getByRole('radio', { name: label }));
}

export function typeNote(dialog: HTMLElement, text: string): void {
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nota (opcional)' }), {
    target: { value: text },
  });
}

export function clickReject(dialog: HTMLElement): void {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }));
}

export function posts(mock: FetchMock): number {
  return mock.calls.filter((call) => call.method === 'POST').length;
}

export function gets(mock: FetchMock): number {
  return mock.calls.filter((call) => call.method === 'GET').length;
}

/** Parsed body of the only `POST` sent. */
export function postedBody(mock: FetchMock): unknown {
  const post = mock.calls.find((call) => call.method === 'POST');
  return post?.body === undefined ? undefined : JSON.parse(post.body);
}
