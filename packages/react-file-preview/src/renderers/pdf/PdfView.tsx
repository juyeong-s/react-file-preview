import {
  getDocument,
  TextLayer,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useViewerSelector } from '../../core/context';
import type { Messages } from '../../core/i18n';
import type { RendererProps } from '../../core/types';
import { printInIframe } from '../../core/utils';
import { defaultIcons } from '../../ui/icons';
import { pageGap, useVisiblePageReporter } from '../shared';
import type { PdfOptions } from './index';
import { assetParams, ensureWorker } from './worker';

/** Page size at scale 1, including the page's own /Rotate. */
interface PageSize {
  width: number;
  height: number;
}

const PASSWORD_NEEDED = 1;

function displaySize(size: PageSize, rotation: number): PageSize {
  return rotation % 180 === 0 ? size : { width: size.height, height: size.width };
}

function PdfPage({
  doc,
  index,
  size,
  zoom,
  rotation,
  root,
  options,
  onRendered,
  setRef,
}: {
  doc: PDFDocumentProxy;
  index: number;
  size: PageSize;
  zoom: number;
  rotation: number;
  root: HTMLElement | null;
  options: PdfOptions;
  onRendered(): void;
  setRef(index: number, el: HTMLDivElement | null): void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const textHost = useRef<HTMLDivElement>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const renderedAt = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);
  const shown = displaySize(size, rotation);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting), {
      root,
      rootMargin: '100% 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  const getPage = async () => (pageRef.current ??= await doc.getPage(index + 1));

  // Canvas: re-rendered when zoom settles. The previous canvas stays, stretched,
  // until the sharp one is ready, so zooming never flashes blank.
  useEffect(() => {
    const host = canvasHost.current;
    if (!host) return;
    if (!visible) {
      host.replaceChildren();
      renderedAt.current = null;
      return;
    }
    const key = `${zoom}:${rotation}`;
    if (renderedAt.current === key) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        try {
          const page = await getPage();
          if (cancelled) return;
          const viewport = page.getViewport({ scale: zoom, rotation: (page.rotate + rotation) % 360 });
          const maxRatio = Math.sqrt(options.maxCanvasPixels! / (viewport.width * viewport.height));
          const ratio = Math.max(0.5, Math.min(window.devicePixelRatio || 1, maxRatio));
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width * ratio);
          canvas.height = Math.floor(viewport.height * ratio);
          canvas.className = 'fp-pdf-canvas';
          task = page.render({
            canvas,
            viewport,
            transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
          });
          await task.promise;
          if (cancelled) return;
          host.replaceChildren(canvas);
          renderedAt.current = key;
          onRendered();
        } catch (error) {
          if ((error as Error)?.name !== 'RenderingCancelledException' && !cancelled) console.error(error);
        }
      },
      renderedAt.current ? 150 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, zoom, rotation]);

  // Text layer: laid out at scale 1 and scaled through --total-scale-factor,
  // so zooming does not need to rebuild it.
  useEffect(() => {
    const host = textHost.current;
    if (!host || !visible || !options.textLayer) return;
    let layer: TextLayer | null = null;
    let cancelled = false;
    (async () => {
      const page = await getPage();
      if (cancelled) return;
      host.replaceChildren();
      layer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container: host,
        viewport: page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 }),
      });
      await layer.render();
    })().catch(() => {});
    return () => {
      cancelled = true;
      layer?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, rotation, options.textLayer]);

  return (
    <div
      ref={(el) => {
        ref.current = el;
        setRef(index, el);
      }}
      className="fp-pdf-page"
      data-page={index + 1}
      style={
        {
          width: shown.width * zoom,
          height: shown.height * zoom,
          '--total-scale-factor': zoom,
        } as CSSProperties
      }
    >
      <div ref={canvasHost} className="fp-pdf-canvas-host" />
      {options.textLayer && <div ref={textHost} className="fp-pdf-text" />}
    </div>
  );
}

function PasswordForm({
  incorrect,
  messages,
  onSubmit,
}: {
  incorrect: boolean;
  messages: Messages;
  onSubmit(password: string): void;
}) {
  const [value, setValue] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(value);
  };
  return (
    <div className="fp-status">
      <div className="fp-status-icon">{defaultIcons.lock}</div>
      <div className="fp-status-title">{messages.passwordTitle}</div>
      <div className="fp-status-text">{incorrect ? messages.passwordIncorrect : messages.passwordDescription}</div>
      <form className="fp-password-form" onSubmit={submit}>
        <input
          type="password"
          className="fp-input"
          autoFocus
          autoComplete="off"
          placeholder={messages.passwordPlaceholder}
          aria-invalid={incorrect || undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="fp-status-button" disabled={!value}>
          {messages.passwordSubmit}
        </button>
      </form>
    </div>
  );
}

export default function PdfView({ file, getArrayBuffer, options, bridge, messages }: RendererProps<PdfOptions>) {
  const zoom = useViewerSelector((s) => s.zoom);
  const rotation = useViewerSelector((s) => s.rotation);
  const page = useViewerSelector((s) => s.page);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [password, setPassword] = useState<{ value: string } | undefined>(undefined);
  const [needsPassword, setNeedsPassword] = useState<{ incorrect: boolean } | null>(null);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);
  const readyOnce = useRef(false);
  const scrollEl = bridge.getScrollElement();

  // Load the document (again after a password is entered).
  useEffect(() => {
    let task: PDFDocumentLoadingTask | null = null;
    let cancelled = false;
    (async () => {
      await ensureWorker(options);
      // pdf.js transfers the buffer to its worker; hand it a copy.
      const data = new Uint8Array(await getArrayBuffer());
      if (cancelled) return;
      task = getDocument({ data, password: password?.value, ...assetParams(options) });
      let pdf: PDFDocumentProxy;
      try {
        pdf = await task.promise;
      } catch (error) {
        if ((error as Error)?.name === 'PasswordException' && !cancelled) {
          setNeedsPassword({ incorrect: (error as { code?: number }).code !== PASSWORD_NEEDED });
          bridge.ready();
          return;
        }
        throw error;
      }
      if (cancelled) return;
      const first = await pdf.getPage(1);
      const { width, height } = first.getViewport({ scale: 1 });
      const initial = Array.from({ length: pdf.numPages }, () => ({ width, height }));
      setNeedsPassword(null);
      setDoc(pdf);
      setSizes(initial);
      bridge.setPageCount(pdf.numPages);

      // Real sizes for mixed-size documents, filled in the background.
      const all = [...initial];
      for (let i = 2; i <= pdf.numPages && !cancelled; i++) {
        const p = await pdf.getPage(i);
        const vp = p.getViewport({ scale: 1 });
        if (vp.width !== width || vp.height !== height) {
          all[i - 1] = { width: vp.width, height: vp.height };
          if (i % 50 === 0 || i === pdf.numPages) setSizes([...all]);
        }
      }
      if (!cancelled) setSizes([...all]);
    })().catch((error) => !cancelled && bridge.fail(error));
    return () => {
      cancelled = true;
      void task?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  const scrollToPage = useVisiblePageReporter(
    scrollEl,
    () => pageEls.current,
    (p) => bridge.reportPage(p),
    !!doc,
  );

  const latest = useRef({ sizes, rotation, page, scrollToPage });
  latest.current = { sizes, rotation, page, scrollToPage };

  useEffect(() => {
    if (!doc) return;
    return bridge.register({
      getFitScale: (mode, box) => {
        const { sizes, rotation, page } = latest.current;
        const size = sizes[page - 1] ?? sizes[0];
        if (!size) return 1;
        const shown = displaySize(size, rotation);
        const gap = pageGap(bridge.getScrollElement());
        const byWidth = (box.width - gap * 2) / shown.width;
        return mode === 'page-width' ? byWidth : Math.min(byWidth, (box.height - gap * 2) / shown.height);
      },
      goToPage: (n) => latest.current.scrollToPage(pageEls.current[n - 1]),
      getThumbnail: async (n, width) => {
        const p = await doc.getPage(n);
        const total = (p.rotate + latest.current.rotation) % 360;
        const base = p.getViewport({ scale: 1, rotation: total });
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const viewport = p.getViewport({ scale: (width / base.width) * ratio, rotation: total });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await p.render({ canvas, viewport }).promise;
        return canvas.toDataURL('image/png');
      },
      print: () => printInIframe({ url: file.url }),
    });
  }, [doc, bridge, file.url]);

  // Rotating changes every page's proportions; stay on the same page.
  const prevRotation = useRef(rotation);
  useLayoutEffect(() => {
    if (prevRotation.current === rotation) return;
    prevRotation.current = rotation;
    const { page, scrollToPage } = latest.current;
    scrollToPage(pageEls.current[page - 1]);
  }, [rotation]);

  // Rotation and mixed page sizes change what "fit" means.
  useEffect(() => {
    bridge.invalidateFit();
  }, [rotation, sizes, bridge]);

  // Ready as soon as any page is painted: the user may have scrolled past page 1.
  const onRendered = () => {
    if (!readyOnce.current) {
      readyOnce.current = true;
      bridge.ready();
    }
  };

  if (needsPassword) {
    return (
      <PasswordForm
        incorrect={needsPassword.incorrect}
        messages={messages}
        onSubmit={(value) => {
          setNeedsPassword(null);
          setPassword({ value });
        }}
      />
    );
  }
  if (!doc) return null;

  return (
    <div className="fp-pages">
      {sizes.map((size, i) => (
        <PdfPage
          key={i}
          doc={doc}
          index={i}
          size={size}
          zoom={zoom}
          rotation={rotation}
          root={scrollEl}
          options={options}
          onRendered={onRendered}
          setRef={(index, el) => {
            pageEls.current[index] = el;
          }}
        />
      ))}
    </div>
  );
}
