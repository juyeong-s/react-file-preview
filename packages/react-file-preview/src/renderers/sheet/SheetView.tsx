import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { read, utils, type CellObject, type WorkBook, type WorkSheet } from 'xlsx';
import { useViewerSelector } from '../../core/context';
import type { RendererProps } from '../../core/types';
import { decodeText } from '../../core/utils';
import type { SheetOptions } from './index';

interface Grid {
  rows: number;
  cols: number;
  colWidths: number[];
  rowHeights: number[];
  cell(r: number, c: number): CellObject | undefined;
  merges: Map<string, { rows: number; cols: number }>;
  covered: Set<string>;
}

const BASE_FONT = 13;

function buildGrid(ws: WorkSheet, options: SheetOptions): Grid {
  const range = ws['!ref'] ? utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  const rows = range.e.r + 1;
  const cols = range.e.c + 1;
  const dense = (ws as { '!data'?: CellObject[][] })['!data'];

  const colWidths = Array.from({ length: cols }, (_, c) => {
    const info = ws['!cols']?.[c];
    if (info?.hidden) return 0;
    if (info?.wpx) return info.wpx;
    if (info?.wch) return Math.round(info.wch * 7 + 5);
    if (info?.width) return Math.round(info.width * 7);
    return options.defaultColumnWidth!;
  });
  const rowHeights = Array.from({ length: rows }, (_, r) => {
    const info = ws['!rows']?.[r];
    if (info?.hidden) return 0;
    if (info?.hpx) return Math.max(info.hpx, 16);
    if (info?.hpt) return Math.max(Math.round((info.hpt * 4) / 3), 16);
    return options.defaultRowHeight!;
  });

  const merges = new Map<string, { rows: number; cols: number }>();
  const covered = new Set<string>();
  for (const m of ws['!merges'] ?? []) {
    merges.set(`${m.s.r}:${m.s.c}`, { rows: m.e.r - m.s.r + 1, cols: m.e.c - m.s.c + 1 });
    for (let r = m.s.r; r <= m.e.r; r++)
      for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) covered.add(`${r}:${c}`);
  }

  return {
    rows,
    cols,
    colWidths,
    rowHeights,
    merges,
    covered,
    cell: dense
      ? (r, c) => dense[r]?.[c]
      : (r, c) => ws[utils.encode_cell({ r, c })] as CellObject | undefined,
  };
}

function cellText(cell: CellObject | undefined): string {
  if (!cell) return '';
  if (cell.w != null) return cell.w;
  if (cell.v == null) return '';
  return cell.v instanceof Date ? cell.v.toLocaleString() : String(cell.v);
}

function SheetGrid({ grid, options, scrollEl }: { grid: Grid; options: SheetOptions; scrollEl: HTMLElement | null }) {
  const zoom = useViewerSelector((s) => s.zoom);
  const headerHeight = options.showHeaders ? Math.round(24 * zoom) : 0;
  const rowHeaderWidth = options.showHeaders ? Math.round((String(grid.rows).length * 8 + 20) * zoom) : 0;

  const rowV = useVirtualizer({
    count: grid.rows,
    getScrollElement: () => scrollEl,
    estimateSize: (i) => grid.rowHeights[i]! * zoom,
    overscan: 10,
    scrollMargin: headerHeight,
  });
  const colV = useVirtualizer({
    horizontal: true,
    count: grid.cols,
    getScrollElement: () => scrollEl,
    estimateSize: (i) => grid.colWidths[i]! * zoom,
    overscan: 4,
    scrollMargin: rowHeaderWidth,
  });

  useEffect(() => {
    rowV.measure();
    colV.measure();
  }, [zoom, rowV, colV]);

  const rows = rowV.getVirtualItems();
  const cols = colV.getVirtualItems();
  const width = rowHeaderWidth + colV.getTotalSize();
  const height = rowV.getTotalSize();

  const sizeOf = (sizes: number[], start: number, count: number) => {
    let total = 0;
    for (let i = start; i < start + count; i++) total += sizes[i] ?? 0;
    return total * zoom;
  };

  return (
    <div
      className="fp-sheet"
      data-gridlines={options.showGridlines ? '' : undefined}
      style={{ width, height: headerHeight + height, fontSize: BASE_FONT * zoom } as CSSProperties}
    >
      {options.showHeaders && (
        <div className="fp-sheet-head" style={{ height: headerHeight, width }}>
          <div className="fp-sheet-corner" style={{ width: rowHeaderWidth, height: headerHeight }} />
          {cols.map((col) => (
            <div
              key={col.key}
              className="fp-sheet-colhead"
              style={{ left: col.start, width: col.size, height: headerHeight }}
            >
              {utils.encode_col(col.index)}
            </div>
          ))}
        </div>
      )}
      <div className="fp-sheet-body" style={{ height, width }}>
        {options.showHeaders && (
          <div className="fp-sheet-rownums" style={{ width: rowHeaderWidth }}>
            {rows.map((row) => (
              <div
                key={row.key}
                className="fp-sheet-rowhead"
                style={{ top: row.start - headerHeight, height: row.size, width: rowHeaderWidth }}
              >
                {row.size > 0 ? row.index + 1 : null}
              </div>
            ))}
          </div>
        )}
        {rows.map((row) =>
          cols.map((col) => {
            const key = `${row.index}:${col.index}`;
            if (grid.covered.has(key) || row.size === 0 || col.size === 0) return null;
            const cell = grid.cell(row.index, col.index);
            const merge = grid.merges.get(key);
            const text = cellText(cell);
            if (!text && !merge && !options.showGridlines) return null;
            return (
              <div
                key={key}
                className="fp-sheet-cell"
                data-type={cell?.t}
                data-merged={merge ? '' : undefined}
                title={text.length > 40 ? text : undefined}
                style={{
                  top: row.start - headerHeight,
                  left: col.start,
                  width: merge ? sizeOf(grid.colWidths, col.index, merge.cols) : col.size,
                  height: merge ? sizeOf(grid.rowHeights, row.index, merge.rows) : row.size,
                }}
              >
                {text}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

export default function SheetView({ file, getArrayBuffer, options, bridge }: RendererProps<SheetOptions>) {
  const activeSheet = useViewerSelector((s) => s.activeSheet);
  const [workbook, setWorkbook] = useState<WorkBook | null>(null);
  const scrollEl = bridge.getScrollElement();

  useEffect(() => {
    let cancelled = false;
    getArrayBuffer()
      .then((buffer) => {
        if (cancelled) return;
        const wb =
          file.ext === 'csv'
            ? // raw keeps CSV values as written (no "001" → 1 or date guessing).
              read(decodeText(buffer, options.encoding), { type: 'string', dense: true, raw: true })
            : read(new Uint8Array(buffer), { type: 'array', dense: true });
        setWorkbook(wb);
        bridge.setSheets(wb.SheetNames);
      })
      .catch((error) => !cancelled && bridge.fail(error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = workbook?.SheetNames[activeSheet] ?? workbook?.SheetNames[0];
  const grid = useMemo(
    () => (workbook && name ? buildGrid(workbook.Sheets[name]!, options) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workbook, name, options.defaultColumnWidth, options.defaultRowHeight],
  );

  useEffect(() => {
    if (!grid) return;
    scrollEl?.scrollTo(0, 0);
    const unregister = bridge.register({ getFitScale: () => 1 });
    requestAnimationFrame(() => bridge.ready());
    return unregister;
  }, [grid, bridge, scrollEl]);

  if (!grid) return null;
  return <SheetGrid key={name} grid={grid} options={options} scrollEl={scrollEl} />;
}
