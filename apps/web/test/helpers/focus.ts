import { waitFor } from '@testing-library/react';
import { expect } from 'vitest';

// Some screens move the focus in an effect that runs after the commit that paints the new content, so a
// `findBy*` can resolve before it. Wait for the final state (the focus on the target) instead of asserting it at once.
export async function expectFocusOn(target: () => HTMLElement): Promise<void> {
  await waitFor(() => expect(document.activeElement).toBe(target()));
}
