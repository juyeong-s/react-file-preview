import type { FormatOptions, RendererDefinition } from '../../core/types';

export const SHEET_EXTENSIONS = ['xlsx', 'xls', 'csv'];

export interface SheetOptions extends FormatOptions {
  showGridlines?: boolean;
  /** Column letters and row numbers. */
  showHeaders?: boolean;
  /** CSV text encoding; `auto` falls back to EUC-KR (CP949) for non-UTF-8 files. */
  encoding?: string;
  defaultColumnWidth?: number;
  defaultRowHeight?: number;
}

export function sheetRenderer(options: SheetOptions = {}): RendererDefinition<SheetOptions> {
  return {
    name: 'sheet',
    test: ({ ext }) => SHEET_EXTENSIONS.includes(ext),
    capabilities: { zoom: true, sheets: true },
    fit: false,
    defaults: {
      showGridlines: true,
      showHeaders: true,
      encoding: 'auto',
      defaultColumnWidth: 88,
      defaultRowHeight: 24,
      ...options,
      zoomOptions: { initial: 1, min: 0.5, max: 2, steps: [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2], ...options.zoomOptions },
    },
    load: () => import('./SheetView'),
  };
}
