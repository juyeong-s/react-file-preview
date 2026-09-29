import { extFromName, nameFromContentDisposition, nameFromUrl } from './detect';
import type { FileInfo, FileSource } from './types';

export interface SourceInfo extends FileInfo {
  /** Set when the source is a URL. */
  url: string | null;
  /** Set when the bytes are already in memory. */
  blob: Blob | null;
}

/** Everything we can learn about a source without downloading it. */
export function describeSource(source: FileSource, fileName?: string): SourceInfo {
  if (typeof source === 'string' || source instanceof URL) {
    const url = source.toString();
    const name = fileName || nameFromUrl(url);
    return { name, ext: extFromName(name), mime: '', size: null, url, blob: null };
  }
  if (source instanceof Blob) {
    const name = fileName || (source instanceof File ? source.name : '');
    return { name, ext: extFromName(name), mime: source.type, size: source.size, url: null, blob: source };
  }
  const blob = new Blob([source instanceof Uint8Array ? copyBytes(source) : source]);
  const name = fileName || '';
  return { name, ext: extFromName(name), mime: '', size: blob.size, url: null, blob };
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export interface FetchResult {
  blob: Blob;
  mime: string;
  name: string;
}

/** Downloads a URL, reporting progress when the server sends a length. */
export async function fetchSource(
  url: string,
  init: RequestInit | undefined,
  signal: AbortSignal,
  onProgress: (progress: number | null) => void,
): Promise<FetchResult> {
  const response = await fetch(url, { ...init, signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`);
  }
  const mime = response.headers.get('content-type') ?? '';
  const name = nameFromContentDisposition(response.headers.get('content-disposition'));
  const total = Number(response.headers.get('content-length')) || 0;

  if (!response.body || !total) {
    onProgress(null);
    const blob = await response.blob();
    return { blob, mime, name };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array<ArrayBuffer>);
    received += value.byteLength;
    onProgress(Math.min(1, received / total));
  }
  return { blob: new Blob(chunks, { type: mime }), mime, name };
}

export async function readHead(blob: Blob, bytes = 512 * 1024): Promise<Uint8Array> {
  // Zip-based formats keep their entry list at the end, so read both ends.
  if (blob.size <= bytes * 2) return new Uint8Array(await blob.arrayBuffer());
  const [head, tail] = await Promise.all([
    blob.slice(0, bytes).arrayBuffer(),
    blob.slice(blob.size - bytes).arrayBuffer(),
  ]);
  const out = new Uint8Array(bytes * 2);
  out.set(new Uint8Array(head), 0);
  out.set(new Uint8Array(tail), bytes);
  return out;
}
