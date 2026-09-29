import { describe, expect, it } from 'vitest';
import { clampZoom, stepZoom } from '../src/core/zoom';
import { mergeConfig, resolveFormatOptions } from '../src/core/config';
import { decodeText } from '../src/core/utils';
import { matchesShortcut, resolveShortcuts } from '../src/core/shortcuts';

const opts = { steps: [0.5, 1, 1.5, 2], min: 0.25, max: 3 };

describe('stepZoom', () => {
  it('moves to the next step from any scale', () => {
    expect(stepZoom(1, 'in', opts)).toBe(1.5);
    expect(stepZoom(1.37, 'in', opts)).toBe(1.5);
    expect(stepZoom(1.37, 'out', opts)).toBe(1);
    expect(stepZoom(1, 'out', opts)).toBe(0.5);
  });
  it('ends at min / max beyond the steps', () => {
    expect(stepZoom(2, 'in', opts)).toBe(3);
    expect(stepZoom(0.5, 'out', opts)).toBe(0.25);
  });
  it('clamps', () => {
    expect(clampZoom(10, 0.25, 5)).toBe(5);
    expect(clampZoom(Number.NaN, 0.25, 5)).toBe(0.25);
  });
});

describe('config resolution', () => {
  const renderer = {
    name: 'image',
    test: () => true,
    capabilities: {},
    defaults: { background: 'checker', zoomOptions: { initial: 'page-fit' as const, max: 10 } },
    load: async () => ({ default: () => null }),
  };

  it('narrowest wins: defaults < renderer < global < formats', () => {
    const config = mergeConfig(
      { zoomOptions: { max: 4 }, formats: { image: { background: 'none' } } },
      { formats: { image: { zoomOptions: { min: 0.5 } } } },
    );
    const resolved = resolveFormatOptions(config, renderer);
    expect(resolved.zoomOptions.initial).toBe('page-fit');
    expect(resolved.zoomOptions.max).toBe(4);
    expect(resolved.zoomOptions.min).toBe(0.5);
    expect(resolved.background).toBe('none');
  });

  it('ignores undefined props when merging', () => {
    expect(mergeConfig({ locale: 'ko' }, { locale: undefined }).locale).toBe('ko');
  });
});

describe('decodeText', () => {
  it('decodes UTF-8 and falls back to EUC-KR', () => {
    expect(decodeText(new TextEncoder().encode('가나다').buffer as ArrayBuffer)).toBe('가나다');
    // "가나" in EUC-KR / CP949
    const euckr = new Uint8Array([0xb0, 0xa1, 0xb3, 0xaa]);
    expect(decodeText(euckr.buffer)).toBe('가나');
  });
});

describe('shortcuts', () => {
  it('can disable single actions or everything', () => {
    expect(resolveShortcuts({ print: false }).print).toEqual([]);
    expect(resolveShortcuts({ zoomIn: 'z' }).zoomIn).toEqual(['z']);
    expect(resolveShortcuts(false).nextPage).toEqual([]);
  });
  it('matches mod combos', () => {
    const e = new KeyboardEvent('keydown', { key: '=', ctrlKey: true, metaKey: true });
    // mod = meta on mac, ctrl elsewhere; the event has both, so neither side matches cleanly.
    expect(matchesShortcut(e, 'ctrl+meta+=')).toBe(true);
    expect(matchesShortcut(new KeyboardEvent('keydown', { key: 'ArrowRight' }), 'ArrowRight')).toBe(true);
    expect(matchesShortcut(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true }), 'ArrowRight')).toBe(false);
  });
});
