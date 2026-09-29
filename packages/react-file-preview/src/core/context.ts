import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { defaultIcons, type Icons } from '../ui/icons';
import type { ViewerController } from './controller';
import type { Messages } from './i18n';
import type { ViewerActions, ViewerState } from './types';

export const ViewerContext = createContext<ViewerController | null>(null);

export function useController(): ViewerController {
  const controller = useContext(ViewerContext);
  if (!controller) {
    throw new Error('react-file-preview: viewer parts must be rendered inside <Viewer.Root>.');
  }
  return controller;
}

/** Subscribes to one slice of the viewer state; re-renders only when it changes. */
export function useViewerSelector<T>(selector: (state: ViewerState) => T): T {
  const controller = useController();
  return useSyncExternalStore(
    controller.subscribe,
    () => selector(controller.getState()),
    () => selector(controller.getState()),
  );
}

export type ViewerApi = ViewerState &
  ViewerActions & {
    messages: Messages;
    icons: Icons;
  };

/** Full viewer state and actions, for building custom UI inside `<Viewer.Root>`. */
export function useViewer(): ViewerApi {
  const controller = useController();
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const { messages } = controller;
  const icons = useViewerIcons();
  return useMemo(
    () => ({ ...state, ...controller.actions, messages, icons }),
    [state, controller, messages, icons],
  );
}

export function useViewerMessages(): Messages {
  return useController().messages;
}

export function useViewerIcons(): Icons {
  const custom = useController().config.icons;
  return useMemo(() => ({ ...defaultIcons, ...custom }) as Icons, [custom]);
}
