import type { FormatOptions, RendererDefinition } from '../../core/types';

export interface PdfOptions extends FormatOptions {
  /**
   * Worker script URL. By default the worker is bundled with the renderer and
   * started from a blob: URL (needs `worker-src blob:` under a strict CSP).
   */
  workerSrc?: string;
  /**
   * Base URL of the pdfjs-dist package assets (cmaps/, standard_fonts/, wasm/,
   * iccs/), needed for some CJK fonts and JPEG2000 images. Defaults to jsDelivr
   * for the bundled version; set your own host for intranets, or `false`.
   */
  assetsUrl?: string | false;
  /** Selectable text over the canvas. */
  textLayer?: boolean;
  /** Maximum canvas size in pixels per page (memory guard for mobile). */
  maxCanvasPixels?: number;
}

export function pdfRenderer(options: PdfOptions = {}): RendererDefinition<PdfOptions> {
  return {
    name: 'pdf',
    test: ({ ext }) => ext === 'pdf',
    capabilities: { zoom: true, paging: true, rotate: true, thumbnails: true, print: true },
    defaults: {
      textLayer: true,
      maxCanvasPixels: 16_777_216,
      ...options,
      zoomOptions: { initial: 'page-width', ...options.zoomOptions },
    },
    load: () => import('./PdfView'),
  };
}
