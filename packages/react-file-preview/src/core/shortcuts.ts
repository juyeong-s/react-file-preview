import type { ShortcutAction, Shortcuts } from './types';

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string[]> = {
  zoomIn: ['mod+=', 'mod++'],
  zoomOut: ['mod+-'],
  resetZoom: ['mod+0'],
  nextPage: ['ArrowRight'],
  prevPage: ['ArrowLeft'],
  download: ['mod+s'],
  print: ['mod+p'],
};

export function resolveShortcuts(shortcuts: Shortcuts | false | undefined): Record<ShortcutAction, string[]> {
  const out = {} as Record<ShortcutAction, string[]>;
  for (const action of Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]) {
    const value = shortcuts === false ? false : shortcuts?.[action];
    out[action] =
      value === false ? [] : value === undefined ? DEFAULT_SHORTCUTS[action] : [value].flat();
  }
  return out;
}

const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** Matches combos like `mod+=`, `shift+ArrowRight`, `alt+p`. `mod` is ⌘ on macOS, Ctrl elsewhere. */
export function matchesShortcut(event: KeyboardEvent, combo: string): boolean {
  // Split on '+' but keep a trailing '+' as the key itself ("mod++").
  const parts = combo.endsWith('++') ? [...combo.slice(0, -2).split('+'), '+'] : combo.split('+');
  const key = parts.pop()!.toLowerCase();
  const mods = new Set(parts.map((p) => p.toLowerCase()));

  const wantMod = mods.has('mod');
  const mac = isMac();
  const ctrl = mods.has('ctrl') || (wantMod && !mac);
  const meta = mods.has('meta') || mods.has('cmd') || (wantMod && mac);
  if (event.ctrlKey !== ctrl || event.metaKey !== meta) return false;
  if (event.altKey !== mods.has('alt')) return false;
  // Shift is implied by some keys ('+'), so only enforce it when asked for.
  if (mods.has('shift') && !event.shiftKey) return false;

  return event.key.toLowerCase() === key;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}
