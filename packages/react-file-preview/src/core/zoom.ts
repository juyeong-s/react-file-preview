import type { Zoom, ZoomMode, ZoomOptions } from './types';

export const DEFAULT_ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5];

export const DEFAULT_ZOOM_OPTIONS: Required<ZoomOptions> = {
  initial: 'page-width',
  min: 0.25,
  max: 5,
  steps: DEFAULT_ZOOM_STEPS,
  wheel: 'ctrl',
  pinch: true,
  doubleClick: false,
};

const EPSILON = 0.001;

export function isZoomMode(zoom: Zoom): zoom is ZoomMode {
  return zoom === 'page-fit' || zoom === 'page-width';
}

export function clampZoom(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Next step above (`in`) or below (`out`) the current effective scale.
 * From a fit mode at 137% this goes to 150% / 125%, never back to the same value.
 */
export function stepZoom(
  current: number,
  direction: 'in' | 'out',
  { steps, min, max }: Pick<Required<ZoomOptions>, 'steps' | 'min' | 'max'>,
): number {
  const sorted = [...steps].filter((s) => s >= min && s <= max).sort((a, b) => a - b);
  if (direction === 'in') {
    const next = sorted.find((s) => s > current + EPSILON);
    return next ?? max;
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i]! < current - EPSILON) return sorted[i]!;
  }
  return min;
}

export function zoomEquals(a: Zoom, b: Zoom): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < EPSILON;
  return a === b;
}

export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
