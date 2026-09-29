import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { useViewerConfig } from './config';
import { Content } from './Content';
import { ViewerContext } from './context';
import { ViewerController } from './controller';
import { isEditableTarget, matchesShortcut, resolveShortcuts } from './shortcuts';
import type {
  CapabilityName,
  RendererDefinition,
  ShortcutAction,
  UseFileViewerOptions,
  ViewerActions,
  ViewerState,
} from './types';
import { cx } from './utils';
import { SheetTabs } from '../ui/SheetTabs';

export interface FileViewerInstance {
  state: ViewerState;
  actions: ViewerActions;
  /** @internal */
  controller: ViewerController;
}

export interface RootProps extends Omit<UseFileViewerOptions, 'file'> {
  file?: UseFileViewerOptions['file'];
  /** A viewer created with `useFileViewer`, to control it from outside the root. */
  viewer?: FileViewerInstance;
  className?: string;
  style?: CSSProperties;
  height?: number | string;
  children?: ReactNode;
}

const SHORTCUT_CAPABILITY: Record<ShortcutAction, CapabilityName> = {
  zoomIn: 'zoom',
  zoomOut: 'zoom',
  resetZoom: 'zoom',
  nextPage: 'paging',
  prevPage: 'paging',
  download: 'download',
  print: 'print',
};

function useShortcutHandler(controller: ViewerController) {
  return (event: KeyboardEvent | ReactKeyboardEvent) => {
    const native = 'nativeEvent' in event ? event.nativeEvent : event;
    const state = controller.getState();
    if (state.status !== 'ready' && state.status !== 'unsupported') return;
    const shortcuts = resolveShortcuts(controller.config.shortcuts);
    const editable = isEditableTarget(native.target);
    for (const action of Object.keys(shortcuts) as ShortcutAction[]) {
      if (!state.capabilities[SHORTCUT_CAPABILITY[action]]) continue;
      const combo = shortcuts[action].find((c) => matchesShortcut(native, c));
      if (!combo) continue;
      // Plain keys (arrows) belong to inputs while typing.
      if (editable && !/(mod|ctrl|meta|cmd|alt)\+/i.test(combo)) continue;
      event.preventDefault();
      controller.actions[action]();
      return;
    }
  };
}

/**
 * Builds the stateful entry points around a fallback renderer list, so the
 * main entry ships every built-in renderer and `/core` ships none.
 */
export function createViewer(fallbackRenderers: RendererDefinition[]) {
  function useFileViewer(options: UseFileViewerOptions): FileViewerInstance {
    const provider = useViewerConfig();
    const [controller] = useState(() => new ViewerController());
    controller.update(options, provider, fallbackRenderers);

    useEffect(() => {
      void controller.load(options.file);
    }, [controller, options.file, options.fileName, options.type]);

    useEffect(() => {
      controller.syncControlled();
    }, [controller, options.zoom, options.page, options.rotation, options.activeSheet]);

    useEffect(() => () => controller.destroy(), [controller]);

    const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
    return useMemo(() => ({ state, actions: controller.actions, controller }), [state, controller]);
  }

  function Root({ viewer, className, style, height, children, ...options }: RootProps) {
    const own = useFileViewer(viewer ? { file: null } : { ...options, file: options.file ?? null });
    const { controller } = viewer ?? own;
    const status = useSyncExternalStore(controller.subscribe, () => controller.getState().status);
    const renderer = useSyncExternalStore(controller.subscribe, () => controller.getState().renderer);
    const handleShortcut = useShortcutHandler(controller);
    const rootRef = useRef<HTMLDivElement>(null);

    const { config } = controller;
    const global = config.shortcutScope === 'global';

    useEffect(() => {
      if (!global) return;
      const listener = (e: KeyboardEvent) => handleShortcut(e);
      window.addEventListener('keydown', listener);
      return () => window.removeEventListener('keydown', listener);
    });

    return (
      <ViewerContext.Provider value={controller}>
        <div
          ref={rootRef}
          className={cx('fp-root', className)}
          style={height !== undefined ? { height, ...style } : style}
          data-theme={config.theme ?? 'light'}
          data-status={status}
          data-format={renderer ?? undefined}
          data-unstyled={config.unstyled ? '' : undefined}
          tabIndex={-1}
          onKeyDown={global ? undefined : handleShortcut}
        >
          {children ?? <Content />}
        </div>
      </ViewerContext.Provider>
    );
  }

  /** Just the file: content area plus sheet tabs for spreadsheets. No toolbar. */
  function FileViewer(props: RootProps) {
    return (
      <Root {...props}>
        <Content />
        <SheetTabs />
      </Root>
    );
  }

  return { useFileViewer, Root, FileViewer };
}
