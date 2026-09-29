import { useVirtualizer } from '@tanstack/react-virtual';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useViewerSelector } from '../../core/context';
import type { RendererProps } from '../../core/types';
import { decodeText } from '../../core/utils';
import type { TextOptions } from './index';

// Links in rendered Markdown must never navigate the host app.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

type Parsed = { kind: 'markdown'; html: string } | { kind: 'plain'; lines: string[]; longest: number };

const BASE_FONT = 13;
const LINE_HEIGHT = 1.6;

function PlainText({
  lines,
  longest,
  options,
  scrollEl,
}: {
  lines: string[];
  longest: number;
  options: TextOptions;
  scrollEl: HTMLElement | null;
}) {
  const zoom = useViewerSelector((s) => s.zoom);
  const listRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const rowHeight = BASE_FONT * zoom * LINE_HEIGHT;

  useLayoutEffect(() => setOffset(listRef.current?.offsetTop ?? 0), []);

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => rowHeight,
    overscan: 30,
    scrollMargin: offset,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [zoom, options.wrap, virtualizer]);

  const digits = String(lines.length).length;
  const style = {
    '--fp-text-size': `${BASE_FONT * zoom}px`,
    '--fp-text-digits': digits,
    height: virtualizer.getTotalSize(),
    minWidth: options.wrap ? undefined : `calc(${longest + digits + 4}ch + 2 * var(--fp-page-gap))`,
  } as CSSProperties;

  return (
    <div className="fp-text-wrap">
      <div ref={listRef} className="fp-text" data-wrap={options.wrap ? '' : undefined} style={style}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={options.wrap ? virtualizer.measureElement : undefined}
            className="fp-text-line"
            style={{
              transform: `translateY(${item.start - offset}px)`,
              minHeight: rowHeight,
            }}
          >
            {options.lineNumbers && <span className="fp-text-number">{item.index + 1}</span>}
            <span className="fp-text-code">{lines[item.index] || '​'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TextView({ file, getArrayBuffer, options, bridge }: RendererProps<TextOptions>) {
  const zoom = useViewerSelector((s) => s.zoom);
  const [parsed, setParsed] = useState<Parsed | null>(null);

  useEffect(() => {
    let cancelled = false;
    getArrayBuffer()
      .then((buffer) => {
        if (cancelled) return;
        let text = decodeText(buffer, options.encoding);
        const isMarkdown = file.ext === 'md' || file.ext === 'markdown';
        if (isMarkdown && options.renderMarkdown) {
          const html = DOMPurify.sanitize(marked.parse(text, { async: false }) as string);
          setParsed({ kind: 'markdown', html });
          return;
        }
        if (file.ext === 'json' && options.formatJson) {
          try {
            text = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            /* show invalid JSON as-is */
          }
        }
        const lines = text.split(/\r\n|\r|\n/);
        let longest = 0;
        for (const line of lines) if (line.length > longest) longest = line.length;
        setParsed({ kind: 'plain', lines, longest: Math.min(longest, 5000) });
      })
      .catch((error) => !cancelled && bridge.fail(error));
    return () => {
      cancelled = true;
    };
  }, [file, getArrayBuffer, options.encoding, options.renderMarkdown, options.formatJson, bridge]);

  useEffect(() => {
    if (!parsed) return;
    const unregister = bridge.register({ getFitScale: () => 1 });
    requestAnimationFrame(() => bridge.ready());
    return unregister;
  }, [parsed, bridge]);

  if (!parsed) return null;
  if (parsed.kind === 'markdown') {
    return (
      <div className="fp-center">
        <article
          className="fp-markdown"
          style={{ '--fp-zoom': zoom } as CSSProperties}
          dangerouslySetInnerHTML={{ __html: parsed.html }}
        />
      </div>
    );
  }
  return (
    <PlainText
      lines={parsed.lines}
      longest={parsed.longest}
      options={options}
      scrollEl={bridge.getScrollElement()}
    />
  );
}
