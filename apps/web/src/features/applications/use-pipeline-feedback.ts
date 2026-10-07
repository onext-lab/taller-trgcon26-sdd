import { useEffect, useRef, useState, type RefObject } from 'react';

/** Message of the page after enrolling: a notice (`status`) or an alert (DD-10). */
export type PageFeedback = { kind: 'notice' | 'alert'; text: string };

export interface PipelineFeedback {
  feedback: PageFeedback | null;
  /** The paragraph that paints `feedback`: it takes the focus when the message appears. */
  messageRef: RefObject<HTMLParagraphElement | null>;
  show: (kind: PageFeedback['kind'], text: string) => void;
  clear: () => void;
}

/**
 * Notice or alert of the page and its focus. The button that was pressed is disabled or gone by then, so the
 * focus goes to the message (DD-10). Each `show` is a new object: the same text twice moves the focus twice.
 */
export function usePipelineFeedback(): PipelineFeedback {
  const [feedback, setFeedback] = useState<PageFeedback | null>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (feedback !== null) messageRef.current?.focus();
  }, [feedback]);

  return {
    feedback,
    messageRef,
    show: (kind, text) => setFeedback({ kind, text }),
    clear: () => setFeedback(null),
  };
}
