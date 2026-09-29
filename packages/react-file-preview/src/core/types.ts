import type { ComponentType, ReactNode } from 'react';
import type { Messages } from './i18n';
import type { Icons } from '../ui/icons';

/** Anything the viewer can open. */
export type FileSource = string | URL | File | Blob | ArrayBuffer | Uint8Array;

export type ZoomMode = 'page-fit' | 'page-width';
/** A zoom value: a scale factor (1 = 100%) or a fit mode. */
export type Zoom = number | ZoomMode;
export type Rotation = 0 | 90 | 180 | 270;

export type ViewerStatus =
  | 'idle'
  | 'loading'
  | 'rendering'
  | 'ready'
  | 'error'
  | 'unsupported';

export interface Capabilities {
  zoom: boolean;
  paging: boolean;
  rotate: boolean;
  thumbnails: boolean;
  sheets: boolean;
  print: boolean;
  download: boolean;
}

export type CapabilityName = keyof Capabilities;

export interface FileInfo {
  name: string;
  /** Lower-case extension without the dot, e.g. `pdf`. Empty when unknown. */
  ext: string;
  mime: string;
  /** Size in bytes, `null` when not known (e.g. streamed media). */
  size: number | null;
}

export interface LoadedFile extends FileInfo {
  /** The file bytes. `null` for renderers that stream straight from the URL. */
  blob: Blob | null;
  /** A URL the browser can load directly (the original URL or an object URL). */
  url: string;
}

export interface DetectInput {
  ext: string;
  mime: string;
  /** Extension guessed from the file's magic bytes, when the bytes are available. */
  sniffed: string | null;
}

export interface ViewerState {
  status: ViewerStatus;
  /** Download progress between 0 and 1, `null` when unknown. */
  progress: number | null;
  error: Error | null;
  file: LoadedFile | null;
  /** Name of the renderer that displays the current file. */
  renderer: string | null;
  capabilities: Capabilities;
  /** Effective scale factor currently rendered (1 = 100%). */
  zoom: number;
  /** What was asked for: a number or a fit mode that is re-computed on resize. */
  zoomRequest: Zoom;
  /** 1-based current page. */
  page: number;
  pageCount: number;
  rotation: Rotation;
  sheets: string[];
  activeSheet: number;
}

export interface ViewerActions {
  zoomIn(): void;
  zoomOut(): void;
  setZoom(zoom: Zoom): void;
  /** Back to the format's initial zoom. */
  resetZoom(): void;
  goToPage(page: number): void;
  nextPage(): void;
  prevPage(): void;
  rotate(direction?: 'cw' | 'ccw'): void;
  setRotation(rotation: Rotation): void;
  setSheet(index: number): void;
  download(): void;
  print(): void;
  retry(): void;
  /** Resolves to an image URL for a page thumbnail (renderers with `thumbnails`). */
  getThumbnail(page: number, width: number): Promise<string>;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

export interface ViewportSize {
  width: number;
  height: number;
}

/** Hooks a renderer view registers so the core can drive it. */
export interface RendererHandlers {
  /** Scale that makes the content fit the given box for the given mode. */
  getFitScale?(mode: ZoomMode, box: ViewportSize): number;
  goToPage?(page: number): void;
  getThumbnail?(page: number, width: number): Promise<string>;
  print?(): void;
}

/** The channel a renderer view uses to talk to the viewer core. */
export interface RendererBridge {
  /** Call once the first meaningful paint is on screen. */
  ready(): void;
  fail(error: unknown): void;
  setPageCount(count: number): void;
  /** Report the page currently in view (does not scroll). */
  reportPage(page: number): void;
  setSheets(sheets: string[]): void;
  register(handlers: RendererHandlers): () => void;
  /** Ask the core to recompute fit-mode zoom (e.g. intrinsic size became known). */
  invalidateFit(): void;
  getScrollElement(): HTMLElement | null;
}

export interface RendererProps<O = Record<string, unknown>> {
  file: LoadedFile;
  /** Loads (or reuses) the file bytes. */
  getArrayBuffer(): Promise<ArrayBuffer>;
  options: ResolvedFormatOptions & O;
  bridge: RendererBridge;
  messages: Messages;
}

export interface RendererDefinition<O = any> {
  /** Unique name, also used as the key in `formats` options. */
  name: string;
  test(input: DetectInput): boolean;
  capabilities: Partial<Capabilities>;
  /**
   * `url` renderers (image, media) can display straight from a URL without
   * downloading the bytes first. Defaults to `buffer`.
   */
  source?: 'buffer' | 'url';
  /**
   * Whether the fit modes ('page-fit' / 'page-width') mean anything for this
   * format. `false` hides them from zoom menus. Defaults to `true`.
   */
  fit?: boolean;
  /** Built-in option defaults for this format. */
  defaults?: FormatOptions & O;
  load(): Promise<{ default: ComponentType<RendererProps<O>> }>;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ZoomOptions {
  initial?: Zoom;
  min?: number;
  max?: number;
  /** zoomIn/zoomOut move to the next step. */
  steps?: number[];
  /** Mouse wheel zoom: with Ctrl/⌘ held, always, or never. */
  wheel?: 'ctrl' | 'always' | false;
  /** Touch pinch and trackpad pinch. */
  pinch?: boolean;
  /** `toggle-fit` switches between the initial fit mode and 100%. */
  doubleClick?: 'toggle-fit' | 'zoom-in' | false;
}

export type ShortcutAction =
  | 'zoomIn'
  | 'zoomOut'
  | 'resetZoom'
  | 'nextPage'
  | 'prevPage'
  | 'download'
  | 'print';

export type Shortcuts = Partial<Record<ShortcutAction, string | string[] | false>>;

/** Options that can be set per format under `formats[rendererName]`. */
export interface FormatOptions {
  zoomOptions?: ZoomOptions;
  [key: string]: unknown;
}

export interface ResolvedFormatOptions extends FormatOptions {
  zoomOptions: Required<ZoomOptions>;
}

export interface LoadingSlotProps {
  progress: number | null;
  messages: Messages;
}
export interface ErrorSlotProps {
  error: Error;
  retry(): void;
  /** Present when the file itself was loaded (e.g. a video the browser cannot play). */
  download?: () => void;
  messages: Messages;
}
export interface UnsupportedSlotProps {
  file: LoadedFile | null;
  download(): void;
  messages: Messages;
}

export type ConvertResult = FileSource | { source: FileSource; fileName?: string } | null | undefined;

export interface ViewerConfig {
  theme?: 'light' | 'dark' | 'system';
  locale?: 'ko' | 'en';
  messages?: Partial<Messages>;
  icons?: Partial<Icons>;
  zoomOptions?: ZoomOptions;
  shortcuts?: Shortcuts | false;
  /** `viewer`: only while focus is inside the viewer. `global`: anywhere on the page. */
  shortcutScope?: 'viewer' | 'global';
  fetchOptions?: RequestInit;
  renderers?: RendererDefinition[];
  formats?: Record<string, FormatOptions>;
  /** Called for files no renderer supports, e.g. to convert them to PDF on a server. */
  convert?: (file: LoadedFile) => Promise<ConvertResult>;
  unstyled?: boolean;
  renderLoading?: (props: LoadingSlotProps) => ReactNode;
  renderError?: (props: ErrorSlotProps) => ReactNode;
  renderUnsupported?: (props: UnsupportedSlotProps) => ReactNode;
}

export interface ViewerEvents {
  onLoad?(info: { file: LoadedFile; renderer: string; pageCount: number }): void;
  onError?(error: Error): void;
  onZoomChange?(zoom: Zoom): void;
  onPageChange?(page: number): void;
  onRotationChange?(rotation: Rotation): void;
  onSheetChange?(index: number): void;
  /** Return `false` to cancel the download (e.g. after a permission check). */
  onDownload?(file: LoadedFile): boolean | void;
  onRendererResolved?(renderer: string | null): void;
}

export interface UseFileViewerOptions extends ViewerConfig, ViewerEvents {
  file: FileSource | null | undefined;
  /** Display / detection name, e.g. when a URL has no extension. */
  fileName?: string;
  /** Force a format by extension, e.g. `pdf` or `xlsx`. */
  type?: string;

  /** Controlled zoom. */
  zoom?: Zoom;
  defaultZoom?: Zoom;
  /** Controlled page (1-based). */
  page?: number;
  defaultPage?: number;
  rotation?: Rotation;
  activeSheet?: number;
}
