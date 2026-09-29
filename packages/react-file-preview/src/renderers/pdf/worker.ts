import { GlobalWorkerOptions, version } from 'pdfjs-dist';
import type { PdfOptions } from './index';

let inlineWorkerUrl: string | null = null;

/**
 * Makes sure pdf.js has a worker. Respects anything the app configured itself
 * (`GlobalWorkerOptions.workerSrc` / `workerPort`), then the `workerSrc`
 * option, and otherwise starts the bundled worker from a blob: URL.
 */
export async function ensureWorker(options: PdfOptions): Promise<void> {
  if (options.workerSrc) {
    GlobalWorkerOptions.workerSrc = options.workerSrc;
    return;
  }
  if (GlobalWorkerOptions.workerPort) return;
  if (GlobalWorkerOptions.workerSrc && GlobalWorkerOptions.workerSrc !== inlineWorkerUrl) return;
  if (inlineWorkerUrl) return;
  const { default: source } = await import('./worker-source.gen.js');
  inlineWorkerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  GlobalWorkerOptions.workerSrc = inlineWorkerUrl;
}

export function assetParams(options: PdfOptions) {
  const base =
    options.assetsUrl === undefined ? `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/` : options.assetsUrl;
  if (!base) return {};
  const root = base.endsWith('/') ? base : `${base}/`;
  return {
    cMapUrl: `${root}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${root}standard_fonts/`,
    wasmUrl: `${root}wasm/`,
    iccUrl: `${root}iccs/`,
  };
}
