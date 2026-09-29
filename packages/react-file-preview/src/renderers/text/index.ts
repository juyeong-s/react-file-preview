import type { FormatOptions, RendererDefinition } from '../../core/types';

export const TEXT_EXTENSIONS = ['txt', 'log', 'json', 'xml', 'md', 'markdown'];

export interface TextOptions extends FormatOptions {
  /** `auto` detects UTF-8 / UTF-16 and falls back to EUC-KR (CP949). */
  encoding?: string;
  /** Render Markdown as HTML (sanitised). `false` shows the source. */
  renderMarkdown?: boolean;
  /** Pretty-print JSON. */
  formatJson?: boolean;
  lineNumbers?: boolean;
  wrap?: boolean;
}

export function textRenderer(options: TextOptions = {}): RendererDefinition<TextOptions> {
  return {
    name: 'text',
    test: ({ ext }) => TEXT_EXTENSIONS.includes(ext),
    capabilities: { zoom: true },
    fit: false,
    defaults: {
      encoding: 'auto',
      renderMarkdown: true,
      formatJson: true,
      lineNumbers: true,
      wrap: false,
      ...options,
      zoomOptions: { initial: 1, min: 0.5, max: 3, steps: [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2, 2.5, 3], ...options.zoomOptions },
    },
    load: () => import('./TextView'),
  };
}
