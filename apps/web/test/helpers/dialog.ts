// jsdom does not implement HTMLDialogElement.showModal/close. This polyfill toggles the `open` attribute and
// fires `close`, and simulateCancel() mimics Escape. The real focus trap and Escape are covered by Playwright.

type DialogMethods = Pick<HTMLDialogElement, 'showModal' | 'close'>;

export function installDialogPolyfill(): () => void {
  const proto = HTMLDialogElement.prototype;
  const original: Partial<DialogMethods> = {
    showModal: Object.getOwnPropertyDescriptor(proto, 'showModal')?.value,
    close: Object.getOwnPropertyDescriptor(proto, 'close')?.value,
  };

  proto.showModal = function showModal(this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement): void {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };

  return () => {
    for (const name of ['showModal', 'close'] as const) {
      const method = original[name];
      if (method) proto[name] = method;
      else Reflect.deleteProperty(proto, name);
    }
  };
}

// Like the browser on Escape: fire a cancelable `cancel`; close only if nobody prevented it.
export function simulateCancel(dialog: HTMLDialogElement): void {
  const notPrevented = dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
  if (notPrevented) dialog.close();
}
