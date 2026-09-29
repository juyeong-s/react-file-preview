const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'text/plain': 'txt',
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/markdown': 'md',
};

export function extFromMime(mime: string): string {
  return MIME_TO_EXT[mime.split(';')[0]!.trim().toLowerCase()] ?? '';
}

export function extFromName(name: string): string {
  const clean = name.split(/[?#]/)[0]!;
  const base = clean.slice(clean.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function nameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url, 'http://localhost');
    return decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1));
  } catch {
    return '';
  }
}

/** Reads `filename*=` / `filename=` from a Content-Disposition header. */
export function nameFromContentDisposition(header: string | null): string {
  if (!header) return '';
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1]!.trim().replace(/^"|"$/g, ''));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*("?)([^";]+)\1/i.exec(header);
  return plain ? plain[2]!.trim() : '';
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < Math.min(end, bytes.length); i++) out += String.fromCharCode(bytes[i]!);
  return out;
}

function includesAscii(bytes: Uint8Array, needle: string): boolean {
  // Zip entry names live in the local headers and the central directory at the
  // end, so scanning the head and tail is enough and keeps big files cheap.
  const window = 256 * 1024;
  if (bytes.length <= window * 2) return ascii(bytes, 0, bytes.length).includes(needle);
  return (
    ascii(bytes, 0, window).includes(needle) ||
    ascii(bytes, bytes.length - window, bytes.length).includes(needle)
  );
}

function includesUtf16(bytes: Uint8Array, needle: string): boolean {
  const utf16 = needle
    .split('')
    .map((c) => c + '\0')
    .join('');
  return ascii(bytes, 0, Math.min(bytes.length, 512 * 1024)).includes(utf16);
}

/**
 * Guesses an extension from the leading bytes of a file. Returns `null` when
 * the bytes are not recognised; plain text is reported as `txt`.
 */
export function sniff(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return null;

  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (includesAscii(bytes, 'word/')) return 'docx';
    if (includesAscii(bytes, 'xl/')) return 'xlsx';
    if (includesAscii(bytes, 'ppt/')) return 'pptx';
    return 'zip';
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    // OLE compound file: legacy Office / HWP. Only xls is renderable.
    if (includesUtf16(bytes, 'Workbook') || includesUtf16(bytes, 'Book')) return 'xls';
    if (includesUtf16(bytes, 'WordDocument')) return 'doc';
    if (includesUtf16(bytes, 'PowerPoint')) return 'ppt';
    if (ascii(bytes, 0, 4096).includes('HWP Document File') || includesUtf16(bytes, 'FileHeader'))
      return 'hwp';
    return 'ole';
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (startsWith(bytes, [0x42, 0x4d]) && bytes.length > 14) return 'bmp';
  if (ascii(bytes, 0, 4) === 'RIFF') {
    const kind = ascii(bytes, 8, 12);
    if (kind === 'WEBP') return 'webp';
    if (kind === 'WAVE') return 'wav';
  }
  if (ascii(bytes, 0, 4) === 'OggS') return 'ogg';
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm';
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (brand.startsWith('M4A')) return 'm4a';
    if (brand === 'qt  ') return 'mov';
    return 'mp4';
  }
  if (ascii(bytes, 0, 3) === 'ID3' || startsWith(bytes, [0xff, 0xfb]) || startsWith(bytes, [0xff, 0xf3]))
    return 'mp3';

  if (looksLikeText(bytes)) {
    const head = ascii(bytes, 0, 1024).replace(/^﻿|^\xEF\xBB\xBF/, '').trimStart();
    if (/^<svg[\s>]/i.test(head) || (/^<\?xml/i.test(head) && /<svg[\s>]/i.test(head))) return 'svg';
    if (/^<\?xml/i.test(head)) return 'xml';
    if (/^[[{]/.test(head)) return 'json';
    return 'txt';
  }
  return null;
}

function looksLikeText(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 4096);
  // UTF-16 BOM
  if (startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff])) return true;
  let suspicious = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i]!;
    if (b === 0) return false;
    if (b < 7 || (b > 13 && b < 32 && b !== 27)) suspicious++;
  }
  return suspicious / n < 0.02;
}

// Extensions where the name is more specific than the bytes: a CSV or a
// Markdown file sniffs as plain text, an ogg can be audio or video, …
const NAME_WINS_OVER_SNIFF: Record<string, string[]> = {
  txt: ['csv', 'md', 'log', 'txt', 'json', 'xml'],
  json: ['json', 'txt', 'log', 'md'],
  xml: ['xml', 'svg', 'txt'],
  mp4: ['m4a', 'mp4', 'mov'],
  mov: ['mp4', 'mov'],
  zip: ['docx', 'xlsx', 'pptx', 'zip'],
};

/**
 * Combines the three signals. Magic bytes win, except where the name is a
 * more specific flavour of the same bytes (csv vs txt).
 */
export function resolveExt(nameExt: string, mime: string, sniffed: string | null): string {
  if (sniffed) {
    if (nameExt && NAME_WINS_OVER_SNIFF[sniffed]?.includes(nameExt)) return nameExt;
    return sniffed;
  }
  return nameExt || extFromMime(mime);
}
