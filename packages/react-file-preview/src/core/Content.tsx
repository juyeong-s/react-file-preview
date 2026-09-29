import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentType,
  type CSSProperties,
  type ErrorInfo,
  type LazyExoticComponent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { useController, useViewerSelector } from './context';
import type { ViewerController } from './controller';
import { ErrorView, LoadingView, UnsupportedView } from './StatusViews';
import type { RendererDefinition, RendererProps } from './types';
import { cx } from './utils';
import { isZoomMode, stepZoom } from './zoom';

const lazyViews = new WeakMap<RendererDefinition, LazyExoticComponent<ComponentType<RendererProps>>>();

function getLazyView(def: RendererDefinition) {
  let view = lazyViews.get(def);
  if (!view) {
    view = lazy(def.load);
    lazyViews.set(def, view);
  }
  return view;
}

class RendererBoundary extends Component<
  { controller: ViewerController; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.controller.bridge.fail(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface ContentProps {
  className?: string;
  style?: CSSProperties;
}

/** The scrollable area where the active renderer draws the file. */
export function Content({ className, style }: ContentProps) {
  const controller = useController();
  const status = useViewerSelector((s) => s.status);
  const progress = useViewerSelector((s) => s.progress);
  const error = useViewerSelector((s) => s.error);
  const file = useViewerSelector((s) => s.file);
  const zoom = useViewerSelector((s) => s.zoom);
  const canZoom = useViewerSelector((s) => s.capabilities.zoom);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { config, messages } = controller;
  const zoomOptions = controller.formatOptions.zoomOptions;

  // Scroll element + viewport size, used for fit modes and virtualisation.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    controller.setScrollElement(el);
    const measure = () => controller.setViewport({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      controller.setScrollElement(null);
    };
  }, [controller]);

  // A new file starts at the top-left.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo(0, 0);
  }, [file]);

  // Keep the point under the cursor (or the centre) still while zooming.
  const prevZoom = useRef(zoom);
  useLayoutEffect(() => {
    const prev = prevZoom.current;
    prevZoom.current = zoom;
    const el = scrollRef.current;
    const anchor = controller.consumeAnchor();
    if (!el || prev === zoom || prev <= 0) return;
    const point = anchor === 'center' ? { x: el.clientWidth / 2, y: el.clientHeight / 2 } : (anchor ?? { x: 0, y: 0 });
    const ratio = zoom / prev;
    el.scrollLeft = (el.scrollLeft + point.x) * ratio - point.x;
    el.scrollTop = (el.scrollTop + point.y) * ratio - point.y;
  }, [zoom, controller]);

  // Wheel / trackpad-pinch zoom. Needs a non-passive listener to stop page zoom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const state = controller.getState();
      if (!state.capabilities.zoom || state.status !== 'ready') return;
      const { wheel, pinch } = controller.formatOptions.zoomOptions;
      const modifier = event.ctrlKey || event.metaKey;
      if (!(wheel === 'always' || (modifier && (wheel === 'ctrl' || pinch)))) return;
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const speed = event.ctrlKey && Math.abs(delta) < 50 ? 0.01 : 0.002;
      const rect = el.getBoundingClientRect();
      controller.requestZoom(state.zoom * Math.exp(-delta * speed), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [controller]);

  // Two-finger touch pinch.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const touches = new Map<number, { x: number; y: number }>();
    let start: { distance: number; zoom: number } | null = null;
    const distance = () => {
      const [a, b] = [...touches.values()];
      return Math.hypot(a!.x - b!.x, a!.y - b!.y);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) start = { distance: distance(), zoom: controller.getState().zoom };
    };
    const onMove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2 || !start || !controller.formatOptions.zoomOptions.pinch) return;
      const [a, b] = [...touches.values()];
      const rect = el.getBoundingClientRect();
      controller.requestZoom(start.zoom * (distance() / start.distance), {
        x: (a!.x + b!.x) / 2 - rect.left,
        y: (a!.y + b!.y) / 2 - rect.top,
      });
    };
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) start = null;
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [controller]);

  const onDoubleClick = (event: ReactMouseEvent) => {
    const state = controller.getState();
    const { doubleClick } = zoomOptions;
    if (!doubleClick || !state.capabilities.zoom || state.status !== 'ready') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (doubleClick === 'zoom-in') {
      controller.requestZoom(stepZoom(state.zoom, 'in', zoomOptions), anchor);
      return;
    }
    const initial = controller.options.defaultZoom ?? zoomOptions.initial;
    const fitMode = isZoomMode(initial) ? initial : 'page-fit';
    controller.requestZoom(isZoomMode(state.zoomRequest) ? 1 : fitMode, anchor);
  };

  const loading = (config.renderLoading ?? LoadingView)({ progress, messages });
  const def = controller.renderer;
  let body: ReactNode = null;

  if (status === 'loading') body = loading;
  else if (status === 'error' && error) {
    body = (config.renderError ?? ErrorView)({
      error,
      retry: controller.actions.retry,
      download: file ? controller.actions.download : undefined,
      messages,
    });
  } else if (status === 'unsupported') {
    body = (config.renderUnsupported ?? UnsupportedView)({
      file,
      download: controller.actions.download,
      messages,
    });
  } else if ((status === 'rendering' || status === 'ready') && def && file) {
    const View = getLazyView(def);
    body = (
      <RendererBoundary key={controller.loadId} controller={controller}>
        <Suspense fallback={null}>
          <View
            file={file}
            getArrayBuffer={controller.getArrayBuffer}
            options={controller.formatOptions}
            bridge={controller.bridge}
            messages={messages}
          />
        </Suspense>
      </RendererBoundary>
    );
  }

  const pinchable = canZoom && zoomOptions.pinch;

  return (
    <div className={cx('fp-content', className)} style={style} data-status={status}>
      <div
        ref={scrollRef}
        className="fp-scroll"
        data-renderer={def?.name}
        style={pinchable ? { touchAction: 'pan-x pan-y' } : undefined}
        onDoubleClick={onDoubleClick}
      >
        {body}
      </div>
      {status === 'rendering' && <div className="fp-overlay">{loading}</div>}
    </div>
  );
}
