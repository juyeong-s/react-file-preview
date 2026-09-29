import { useEffect, useRef, type RefObject } from 'react';
import { readPxVar } from '../core/utils';

export function pageGap(el: Element | null): number {
  return readPxVar(el, '--fp-page-gap', 16);
}

/**
 * Tracks which of `elements` is most visible in the scroll element and reports
 * it. Scroll events caused by our own navigation are ignored once, so jumping to
 * the last page does not bounce back to the page above it.
 */
export function useVisiblePageReporter(
  scrollEl: HTMLElement | null,
  getElements: () => (HTMLElement | null | undefined)[],
  report: (page: number) => void,
  enabled: boolean,
) {
  const skipNext = useRef(false);
  const latest = useRef({ getElements, report });
  latest.current = { getElements, report };

  useEffect(() => {
    if (!scrollEl || !enabled) return;
    let frame = 0;
    const onScroll = () => {
      if (skipNext.current) {
        skipNext.current = false;
        return;
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const view = scrollEl.getBoundingClientRect();
        const elements = latest.current.getElements();
        let best = -1;
        let bestArea = 0;
        for (let i = 0; i < elements.length; i++) {
          const rect = elements[i]?.getBoundingClientRect();
          if (!rect) continue;
          if (rect.top > view.bottom) break;
          const visible = Math.min(rect.bottom, view.bottom) - Math.max(rect.top, view.top);
          if (visible > bestArea + 1) {
            bestArea = visible;
            best = i;
          }
        }
        if (best >= 0) latest.current.report(best + 1);
      });
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scrollEl.removeEventListener('scroll', onScroll);
    };
  }, [scrollEl, enabled]);

  /** Scrolls so `el` sits at the top, without the scroll event reporting a page. */
  return (el: HTMLElement | null | undefined) => {
    if (!scrollEl || !el) return;
    const top = el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    const next = Math.max(0, top - pageGap(scrollEl) / 2);
    if (Math.abs(next - scrollEl.scrollTop) > 1) skipNext.current = true;
    scrollEl.scrollTop = next;
  };
}

export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
