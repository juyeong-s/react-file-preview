import { renderAsync } from 'docx-preview';
import { useEffect, useRef, useState } from 'react';
import { useViewerSelector } from '../../core/context';
import type { RendererProps } from '../../core/types';
import { pageGap, useVisiblePageReporter } from '../shared';
import type { DocxOptions } from './index';

export default function DocxView({ getArrayBuffer, options, bridge }: RendererProps<DocxOptions>) {
  const zoom = useViewerSelector((s) => s.zoom);
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<HTMLElement[]>([]);
  const pageWidth = useRef(0);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const scrollEl = bridge.getScrollElement();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const buffer = await getArrayBuffer();
      const body = bodyRef.current;
      const style = styleRef.current;
      if (cancelled || !body || !style) return;
      await renderAsync(buffer, body, style, {
        className: 'docx',
        inWrapper: true,
        breakPages: true,
        // Use Word's own last-rendered page breaks for closer pagination.
        ignoreLastRenderedPageBreak: false,
        useBase64URL: true,
        renderHeaders: options.renderHeaders,
        renderFooters: options.renderFooters,
        renderFootnotes: options.renderFootnotes,
        renderEndnotes: options.renderEndnotes,
        renderChanges: options.renderChanges,
        renderComments: options.renderComments,
      });
      if (cancelled) return;
      // Documents are untrusted: drop script URLs from links.
      body.querySelectorAll('a[href]').forEach((a) => {
        if (/^\s*(javascript|vbscript|data):/i.test(a.getAttribute('href') ?? '')) a.removeAttribute('href');
      });
      const sections = Array.from(body.querySelectorAll<HTMLElement>('section.docx'));
      const first = sections[0];
      pageWidth.current = first ? first.getBoundingClientRect().width / (zoomRef.current || 1) : 0;
      setPages(sections);
      bridge.setPageCount(Math.max(1, sections.length));
      requestAnimationFrame(() => bridge.ready());
    })().catch((error) => !cancelled && bridge.fail(error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToPage = useVisiblePageReporter(
    scrollEl,
    () => pages,
    (p) => bridge.reportPage(p),
    pages.length > 0,
  );
  const scrollRef = useRef(scrollToPage);
  scrollRef.current = scrollToPage;

  useEffect(() => {
    if (pages.length === 0) return;
    return bridge.register({
      getFitScale: (mode, box) => {
        if (!pageWidth.current) return 1;
        const gap = pageGap(bridge.getScrollElement());
        const byWidth = (box.width - gap * 2) / pageWidth.current;
        if (mode === 'page-width') return byWidth;
        const height = (pages[0]?.getBoundingClientRect().height ?? 0) / (zoomRef.current || 1);
        return height ? Math.min(byWidth, (box.height - gap * 2) / height) : byWidth;
      },
      goToPage: (n) => scrollRef.current(pages[n - 1]),
    });
  }, [pages, bridge]);

  return (
    <div className="fp-docx">
      <div ref={styleRef} hidden />
      <div ref={bodyRef} className="fp-docx-body" style={{ zoom }} />
    </div>
  );
}
