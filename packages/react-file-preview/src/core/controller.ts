import { mergeConfig, resolveFormatOptions } from './config';
import { extFromMime, extFromName, resolveExt, sniff } from './detect';
import { locales, type Messages } from './i18n';
import { describeSource, fetchSource, readHead } from './source';
import type {
  Capabilities,
  DetectInput,
  FileSource,
  LoadedFile,
  RendererBridge,
  RendererDefinition,
  RendererHandlers,
  ResolvedFormatOptions,
  Rotation,
  UseFileViewerOptions,
  ViewerActions,
  ViewerConfig,
  ViewerState,
  ViewportSize,
  Zoom,
} from './types';
import { downloadFile } from './utils';
import { clampZoom, isZoomMode, stepZoom, zoomEquals } from './zoom';

export const NO_CAPABILITIES: Capabilities = {
  zoom: false,
  paging: false,
  rotate: false,
  thumbnails: false,
  sheets: false,
  print: false,
  download: false,
};

const INITIAL_STATE: ViewerState = {
  status: 'idle',
  progress: null,
  error: null,
  file: null,
  renderer: null,
  capabilities: NO_CAPABILITIES,
  zoom: 1,
  zoomRequest: 1,
  page: 1,
  pageCount: 0,
  rotation: 0,
  sheets: [],
  activeSheet: 0,
};

export type ZoomAnchor = { x: number; y: number } | 'center';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

interface Resolved {
  file: LoadedFile;
  detect: DetectInput;
}

/**
 * Owns the viewer state and talks to the active renderer. One instance per
 * `useFileViewer` call; React subscribes with `useSyncExternalStore`.
 */
export class ViewerController {
  private state: ViewerState = INITIAL_STATE;
  private listeners = new Set<() => void>();

  options: UseFileViewerOptions = { file: null };
  config: ViewerConfig = {};
  renderers: RendererDefinition[] = [];
  renderer: RendererDefinition | null = null;
  formatOptions: ResolvedFormatOptions = resolveFormatOptions({}, null);
  messages: Messages = locales.en;
  bridge: RendererBridge;
  /** Changes on every load; renderer views are keyed by it. */
  loadId = 0;

  private handlers: RendererHandlers = {};
  private viewport: ViewportSize | null = null;
  private scrollElement: HTMLElement | null = null;
  private abort: AbortController | null = null;
  private objectUrls: string[] = [];
  private originalFile: LoadedFile | null = null;
  private lastSource: FileSource | null | undefined = null;
  private pendingAnchor: ZoomAnchor | null = null;
  private thumbnails = new Map<string, Promise<string>>();
  private pendingPage: number | null = null;

  readonly actions: ViewerActions;

  constructor() {
    this.bridge = this.createBridge(0);
    this.actions = {
      zoomIn: () => this.stepZoom('in'),
      zoomOut: () => this.stepZoom('out'),
      setZoom: (zoom) => this.requestZoom(zoom),
      resetZoom: () => this.requestZoom(this.initialZoom()),
      goToPage: (page) => this.requestPage(page),
      nextPage: () => this.requestPage(this.state.page + 1),
      prevPage: () => this.requestPage(this.state.page - 1),
      rotate: (direction = 'cw') => {
        const delta = direction === 'cw' ? 90 : 270;
        this.requestRotation(((this.state.rotation + delta) % 360) as Rotation);
      },
      setRotation: (rotation) => this.requestRotation(rotation),
      setSheet: (index) => this.requestSheet(index),
      download: () => this.download(),
      print: () => {
        if (this.state.capabilities.print && this.state.status === 'ready') this.handlers.print?.();
      },
      retry: () => void this.load(this.lastSource),
      getThumbnail: (page, width) => this.getThumbnail(page, width),
    };
  }

  // -- store ---------------------------------------------------------------

  getState = (): ViewerState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<ViewerState>) {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    this.listeners.forEach((l) => l());
    if (patch.page !== undefined && patch.page !== prev.page) this.options.onPageChange?.(patch.page);
  }

  /** Called on every render of the owning hook with the latest props. */
  update(options: UseFileViewerOptions, providerConfig: ViewerConfig, fallbackRenderers: RendererDefinition[]) {
    this.options = options;
    this.config = mergeConfig(providerConfig, options);
    this.renderers = this.config.renderers ?? fallbackRenderers;
    this.formatOptions = resolveFormatOptions(this.config, this.renderer);
    this.messages = { ...locales[this.config.locale ?? 'en'], ...this.config.messages };
  }

  // -- loading -------------------------------------------------------------

  async load(source: FileSource | null | undefined) {
    this.cancel();
    this.lastSource = source;
    const id = ++this.loadId;
    this.bridge = this.createBridge(id);
    this.renderer = null;
    this.handlers = {};
    this.thumbnails.clear();
    this.originalFile = null;

    if (!source) {
      this.set({ ...INITIAL_STATE });
      return;
    }

    const abort = new AbortController();
    this.abort = abort;
    this.set({ ...INITIAL_STATE, status: 'loading' });

    try {
      let resolved = await this.resolve(source, this.options.fileName, abort.signal);
      if (id !== this.loadId) return;
      this.originalFile = resolved.file;
      let renderer = this.pick(resolved.detect);

      if (!renderer && this.config.convert) {
        const converted = await this.config.convert(resolved.file);
        if (id !== this.loadId) return;
        if (converted) {
          const isWrapped = typeof converted === 'object' && converted !== null && 'source' in converted;
          const next = isWrapped ? converted.source : (converted as FileSource);
          const name = isWrapped ? converted.fileName : undefined;
          resolved = await this.resolve(next, name, abort.signal, true);
          if (id !== this.loadId) return;
          renderer = this.pick(resolved.detect);
        }
      }
      this.activate(resolved.file, renderer);
    } catch (error) {
      if (id !== this.loadId || isAbort(error)) return;
      this.fail(error);
    }
  }

  private async resolve(
    source: FileSource,
    fileName: string | undefined,
    signal: AbortSignal,
    ignoreType = false,
  ): Promise<Resolved> {
    const info = describeSource(source, fileName);
    const forced = ignoreType ? '' : (this.options.type ?? '').toLowerCase().replace(/^\./, '');

    // Streamable formats (image, media) can load straight from the URL, unless
    // custom headers are required, which <img>/<video> cannot send.
    if (info.url && !this.config.fetchOptions?.headers) {
      const ext = forced || info.ext;
      const candidate = ext ? this.pick({ ext, mime: '', sniffed: null }) : null;
      if (candidate?.source === 'url') {
        return {
          file: { name: info.name, ext, mime: '', size: null, blob: null, url: info.url },
          detect: { ext, mime: '', sniffed: null },
        };
      }
    }

    let { blob, mime, name } = info;
    if (!blob) {
      const fetched = await fetchSource(info.url!, this.config.fetchOptions, signal, (progress) =>
        this.set({ progress }),
      );
      blob = fetched.blob;
      mime = mime || fetched.mime;
      if (!fileName && fetched.name) name = fetched.name;
    }

    const sniffed = sniff(await readHead(blob));
    const ext = forced || resolveExt(extFromName(name), mime, sniffed);
    if (!name) name = ext ? `file.${ext}` : 'file';
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);

    return {
      file: { name, ext, mime: mime || blob.type, size: blob.size, blob, url },
      detect: { ext, mime: mime || blob.type, sniffed },
    };
  }

  private pick(input: DetectInput): RendererDefinition | null {
    const withMimeExt = input.ext ? input : { ...input, ext: extFromMime(input.mime) };
    return this.renderers.find((r) => r.test(withMimeExt)) ?? null;
  }

  private activate(file: LoadedFile, renderer: RendererDefinition | null) {
    this.renderer = renderer;
    this.formatOptions = resolveFormatOptions(this.config, renderer);
    this.options.onRendererResolved?.(renderer?.name ?? null);

    if (!renderer) {
      this.set({
        status: 'unsupported',
        file,
        renderer: null,
        progress: null,
        capabilities: { ...NO_CAPABILITIES, download: true },
      });
      return;
    }

    const { zoomOptions } = this.formatOptions;
    const zoomRequest = this.options.zoom ?? this.initialZoom();
    this.pendingPage = this.options.page ?? this.options.defaultPage ?? null;
    this.set({
      status: 'rendering',
      progress: null,
      file,
      renderer: renderer.name,
      capabilities: { ...NO_CAPABILITIES, download: true, ...renderer.capabilities },
      zoomRequest,
      zoom: typeof zoomRequest === 'number' ? clampZoom(zoomRequest, zoomOptions.min, zoomOptions.max) : 1,
      page: 1,
      pageCount: 0,
      rotation: renderer.capabilities.rotate ? (this.options.rotation ?? 0) : 0,
      sheets: [],
      activeSheet: this.options.activeSheet ?? 0,
    });
  }

  private fail(error: unknown) {
    const err = toError(error);
    this.set({ status: 'error', error: err, progress: null });
    this.options.onError?.(err);
  }

  private cancel() {
    this.abort?.abort();
    this.abort = null;
    this.objectUrls.forEach((u) => URL.revokeObjectURL(u));
    this.objectUrls = [];
  }

  destroy() {
    this.cancel();
    this.loadId++;
  }

  /** Bytes of the current file, fetched on demand for URL-streamed files. */
  getArrayBuffer = async (): Promise<ArrayBuffer> => {
    const file = this.state.file;
    if (!file) throw new Error('No file loaded');
    if (file.blob) return file.blob.arrayBuffer();
    const response = await fetch(file.url, this.config.fetchOptions);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  };

  // -- renderer bridge -----------------------------------------------------

  private createBridge(id: number): RendererBridge {
    const live = () => id === this.loadId;
    return {
      ready: () => {
        if (!live() || this.state.status !== 'rendering') return;
        this.set({ status: 'ready' });
        const { file, renderer, pageCount } = this.state;
        if (file && renderer) this.options.onLoad?.({ file, renderer, pageCount });
        if (this.pendingPage && this.pendingPage > 1) this.navigate(this.pendingPage);
        this.pendingPage = null;
      },
      fail: (error) => live() && this.fail(error),
      setPageCount: (count) => {
        if (!live()) return;
        this.set({ pageCount: count, page: Math.min(Math.max(1, this.state.page), Math.max(1, count)) });
      },
      reportPage: (page) => {
        if (live() && page !== this.state.page) this.set({ page });
      },
      setSheets: (sheets) => {
        if (!live()) return;
        const activeSheet = Math.min(this.state.activeSheet, Math.max(0, sheets.length - 1));
        this.set({ sheets, activeSheet });
      },
      register: (handlers) => {
        if (!live()) return () => {};
        this.handlers = { ...this.handlers, ...handlers };
        this.refit();
        return () => {
          if (!live()) return;
          for (const key of Object.keys(handlers) as (keyof RendererHandlers)[]) {
            if (this.handlers[key] === handlers[key]) delete this.handlers[key];
          }
        };
      },
      invalidateFit: () => live() && this.refit(),
      getScrollElement: () => this.scrollElement,
    };
  }

  setScrollElement(el: HTMLElement | null) {
    this.scrollElement = el;
  }

  setViewport(size: ViewportSize) {
    const prev = this.viewport;
    this.viewport = size;
    if (!prev || prev.width !== size.width || prev.height !== size.height) this.refit();
  }

  /** The anchor for the zoom change that is about to be painted. */
  consumeAnchor(): ZoomAnchor | null {
    const anchor = this.pendingAnchor;
    this.pendingAnchor = null;
    return anchor;
  }

  // -- zoom ----------------------------------------------------------------

  private initialZoom(): Zoom {
    return this.options.defaultZoom ?? this.formatOptions.zoomOptions.initial;
  }

  private refit() {
    const { zoomRequest, zoom } = this.state;
    const fit = this.handlers.getFitScale;
    if (!isZoomMode(zoomRequest) || !fit || !this.viewport) return;
    const { min, max } = this.formatOptions.zoomOptions;
    const next = clampZoom(fit(zoomRequest, this.viewport), min, max);
    if (Math.abs(next - zoom) > 0.0005) this.set({ zoom: next });
  }

  private stepZoom(direction: 'in' | 'out') {
    this.requestZoom(stepZoom(this.state.zoom, direction, this.formatOptions.zoomOptions));
  }

  requestZoom(zoom: Zoom, anchor: ZoomAnchor = 'center') {
    if (!this.state.capabilities.zoom) return;
    const { min, max } = this.formatOptions.zoomOptions;
    const next = typeof zoom === 'number' ? clampZoom(zoom, min, max) : zoom;
    if (zoomEquals(next, this.state.zoomRequest) && typeof next === 'number') return;
    this.pendingAnchor = anchor;
    if (this.options.zoom === undefined) this.applyZoom(next);
    this.options.onZoomChange?.(next);
  }

  private applyZoom(zoom: Zoom) {
    if (typeof zoom === 'number') {
      this.set({ zoomRequest: zoom, zoom });
    } else {
      this.set({ zoomRequest: zoom });
      this.refit();
    }
  }

  // -- pages, rotation, sheets --------------------------------------------

  private requestPage(page: number) {
    const { capabilities, pageCount } = this.state;
    if (!capabilities.paging || pageCount === 0) return;
    const next = Math.min(Math.max(1, Math.round(page)), pageCount);
    if (this.options.page !== undefined) {
      this.options.onPageChange?.(next);
      return;
    }
    this.navigate(next);
  }

  private navigate(page: number) {
    const next = Math.min(Math.max(1, page), Math.max(1, this.state.pageCount));
    this.handlers.goToPage?.(next);
    this.set({ page: next });
  }

  private requestRotation(rotation: Rotation) {
    if (!this.state.capabilities.rotate) return;
    if (this.options.rotation === undefined) this.applyRotation(rotation);
    this.options.onRotationChange?.(rotation);
  }

  private applyRotation(rotation: Rotation) {
    this.thumbnails.clear();
    this.set({ rotation });
    this.refit();
  }

  private requestSheet(index: number) {
    const { capabilities, sheets } = this.state;
    if (!capabilities.sheets || index < 0 || index >= sheets.length) return;
    if (this.options.activeSheet === undefined) this.set({ activeSheet: index });
    this.options.onSheetChange?.(index);
  }

  /** Applies controlled props (`zoom`, `page`, `rotation`, `activeSheet`) after they change. */
  syncControlled() {
    const { zoom, page, rotation, activeSheet } = this.options;
    const s = this.state;
    if (s.status !== 'rendering' && s.status !== 'ready') return;
    if (zoom !== undefined && !zoomEquals(zoom, s.zoomRequest)) this.applyZoom(zoom);
    if (rotation !== undefined && rotation !== s.rotation && s.capabilities.rotate) this.applyRotation(rotation);
    if (activeSheet !== undefined && activeSheet !== s.activeSheet) this.set({ activeSheet });
    if (page !== undefined && page !== s.page && s.status === 'ready') this.navigate(page);
  }

  // -- misc actions --------------------------------------------------------

  private download() {
    const file = this.originalFile ?? this.state.file;
    if (!file || !this.state.capabilities.download) return;
    if (this.options.onDownload?.(file) === false) return;
    downloadFile(file);
  }

  private getThumbnail(page: number, width: number): Promise<string> {
    const make = this.handlers.getThumbnail;
    if (!make) return Promise.reject(new Error('Thumbnails are not supported for this file'));
    const key = `${page}:${width}:${this.state.rotation}`;
    let cached = this.thumbnails.get(key);
    if (!cached) {
      cached = make(page, width);
      cached.catch(() => this.thumbnails.delete(key));
      this.thumbnails.set(key, cached);
    }
    return cached;
  }
}
