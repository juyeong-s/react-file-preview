import { docxRenderer } from './renderers/docx';
import { imageRenderer } from './renderers/image';
import { mediaRenderer } from './renderers/media';
import { pdfRenderer } from './renderers/pdf';
import { sheetRenderer } from './renderers/sheet';
import { textRenderer } from './renderers/text';
import type { RendererDefinition } from './core/types';

export { pdfRenderer, type PdfOptions } from './renderers/pdf';
export { docxRenderer, type DocxOptions } from './renderers/docx';
export { sheetRenderer, type SheetOptions, SHEET_EXTENSIONS } from './renderers/sheet';
export { imageRenderer, type ImageOptions, IMAGE_EXTENSIONS } from './renderers/image';
export { mediaRenderer, type MediaOptions, VIDEO_EXTENSIONS, AUDIO_EXTENSIONS } from './renderers/media';
export { textRenderer, type TextOptions, TEXT_EXTENSIONS } from './renderers/text';

/**
 * Every built-in renderer. Each one only loads its code (pdf.js, SheetJS, …)
 * when a file of its type is opened.
 */
export const defaultRenderers: RendererDefinition[] = [
  /* @__PURE__ */ pdfRenderer(),
  /* @__PURE__ */ docxRenderer(),
  /* @__PURE__ */ sheetRenderer(),
  /* @__PURE__ */ imageRenderer(),
  /* @__PURE__ */ mediaRenderer(),
  /* @__PURE__ */ textRenderer(),
];
