import type { LoadedFile } from './types';

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function downloadFile(file: LoadedFile) {
  const a = document.createElement('a');
  a.href = file.url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Prints a document (e.g. a PDF object URL) or an HTML string through a hidden iframe. */
export function printInIframe(source: { url: string } | { html: string }) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  });
  const cleanup = () => setTimeout(() => iframe.remove(), 60_000);
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return;
    // Give embedded viewers (the browser's PDF plugin) a moment to lay out.
    setTimeout(() => {
      win.focus();
      win.print();
      cleanup();
    }, 250);
  };
  if ('url' in source) iframe.src = source.url;
  else iframe.srcdoc = source.html;
  document.body.appendChild(iframe);
}

/** Reads a px CSS custom property from an element, e.g. `--fp-page-gap`. */
export function readPxVar(el: Element | null, name: string, fallback: number): number {
  if (!el) return fallback;
  const value = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

/** Decodes text, honouring BOMs and falling back to EUC-KR (CP949) for non-UTF-8 files. */
export function decodeText(buffer: ArrayBuffer, encoding: string = 'auto'): string {
  const bytes = new Uint8Array(buffer);
  if (encoding !== 'auto') return new TextDecoder(encoding).decode(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Excel on Korean Windows saves CSV as CP949, which browsers expose as euc-kr.
    return new TextDecoder('euc-kr').decode(bytes);
  }
}

export function formatBytes(size: number | null): string {
  if (size == null) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
