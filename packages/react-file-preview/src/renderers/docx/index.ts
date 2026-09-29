import type { FormatOptions, RendererDefinition } from '../../core/types';

export interface DocxOptions extends FormatOptions {
  renderHeaders?: boolean;
  renderFooters?: boolean;
  renderFootnotes?: boolean;
  renderEndnotes?: boolean;
  /** Show tracked changes (insertions / deletions). */
  renderChanges?: boolean;
  renderComments?: boolean;
}

export function docxRenderer(options: DocxOptions = {}): RendererDefinition<DocxOptions> {
  return {
    name: 'docx',
    test: ({ ext }) => ext === 'docx',
    capabilities: { zoom: true, paging: true },
    defaults: {
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      renderChanges: false,
      renderComments: false,
      ...options,
      zoomOptions: { initial: 'page-width', max: 3, ...options.zoomOptions },
    },
    load: () => import('./DocxView'),
  };
}
