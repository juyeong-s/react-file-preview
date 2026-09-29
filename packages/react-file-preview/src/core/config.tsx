import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_ZOOM_OPTIONS } from './zoom';
import type {
  FormatOptions,
  RendererDefinition,
  ResolvedFormatOptions,
  ViewerConfig,
} from './types';

/** Identity helper that gives full type inference for a shared config object. */
export function createViewerConfig(config: ViewerConfig): ViewerConfig {
  return config;
}

function mergeFormats(
  a: Record<string, FormatOptions> | undefined,
  b: Record<string, FormatOptions> | undefined,
): Record<string, FormatOptions> | undefined {
  if (!a) return b;
  if (!b) return a;
  const out: Record<string, FormatOptions> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const prev = out[key];
    out[key] = prev
      ? { ...prev, ...value, zoomOptions: { ...prev.zoomOptions, ...value.zoomOptions } }
      : value;
  }
  return out;
}

function definedOnly<T extends object>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] !== undefined) out[key] = value[key];
  }
  return out;
}

/** Merges two configs; `b` wins. Nested option groups are merged, not replaced. */
export function mergeConfig(a: ViewerConfig, b: ViewerConfig): ViewerConfig {
  const bb = definedOnly(b);
  return {
    ...a,
    ...bb,
    messages: { ...a.messages, ...bb.messages },
    icons: { ...a.icons, ...bb.icons },
    zoomOptions: { ...a.zoomOptions, ...bb.zoomOptions },
    shortcuts:
      bb.shortcuts === false || a.shortcuts === false && bb.shortcuts === undefined
        ? false
        : { ...(a.shortcuts || {}), ...(bb.shortcuts || {}) },
    formats: mergeFormats(a.formats, bb.formats),
    fetchOptions: a.fetchOptions || bb.fetchOptions ? { ...a.fetchOptions, ...bb.fetchOptions } : undefined,
  };
}

const ConfigContext = createContext<ViewerConfig>({});

export function ViewerConfigProvider({
  config,
  children,
}: {
  config: ViewerConfig;
  children?: ReactNode;
}) {
  const parent = useContext(ConfigContext);
  const merged = useMemo(() => mergeConfig(parent, config), [parent, config]);
  return <ConfigContext.Provider value={merged}>{children}</ConfigContext.Provider>;
}

export function useViewerConfig(): ViewerConfig {
  return useContext(ConfigContext);
}

/**
 * Options for one renderer, narrowest wins:
 * built-in defaults < renderer defaults < global config < `formats[name]`.
 */
export function resolveFormatOptions(
  config: ViewerConfig,
  renderer: RendererDefinition | null,
): ResolvedFormatOptions {
  const name = renderer?.name ?? '';
  const rendererDefaults = renderer?.defaults ?? {};
  const format = config.formats?.[name] ?? {};
  return {
    ...rendererDefaults,
    ...format,
    zoomOptions: {
      ...DEFAULT_ZOOM_OPTIONS,
      ...definedOnly(rendererDefaults.zoomOptions ?? {}),
      ...definedOnly(config.zoomOptions ?? {}),
      ...definedOnly(format.zoomOptions ?? {}),
    },
  };
}
