import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { useController, useViewerIcons, useViewerSelector } from '../core/context';
import type { Messages } from '../core/i18n';
import type { CapabilityName, ViewerActions, ViewerState, Zoom } from '../core/types';
import { cx } from '../core/utils';
import { formatZoom, isZoomMode } from '../core/zoom';
import type { IconName } from './icons';
import { Slot } from './Slot';

export type StateClassName<S> = string | ((state: S) => string | undefined);

function resolveClassName<S>(value: StateClassName<S> | undefined, state: S): string | undefined {
  return typeof value === 'function' ? value(state) : value;
}

export interface ActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  /** Merge behaviour into your own element instead of rendering a `<button>`. */
  asChild?: boolean;
  className?: StateClassName<{ disabled: boolean }>;
  children?: ReactNode;
  /** Keep the button in the DOM (disabled) when the current file does not support it. */
  forceMount?: boolean;
}

interface ActionSpec<P> {
  name: string;
  capability: CapabilityName;
  icon: (props: P) => IconName;
  label: (props: P) => keyof Messages;
  run: (actions: ViewerActions, props: P) => void;
  enabled?: (state: ViewerState, controller: ReturnType<typeof useController>) => boolean;
  allowWhenUnsupported?: boolean;
}

function createActionButton<P extends object = {}>(spec: ActionSpec<P>) {
  function ActionButton(props: ActionButtonProps & P) {
    const { asChild, className, children, forceMount, onClick, ...rest } = props;
    const controller = useController();
    const icons = useViewerIcons();
    const messages = controller.messages;
    const supported = useViewerSelector((s) => s.capabilities[spec.capability]);
    const disabled = useViewerSelector((s) => {
      const usable = s.status === 'ready' || (spec.allowWhenUnsupported && s.status === 'unsupported');
      return !usable || (spec.enabled ? !spec.enabled(s, controller) : false);
    });

    if (!supported && !forceMount) return null;
    const isDisabled = disabled || !supported || !!rest.disabled;
    const Comp = asChild ? Slot : 'button';
    const label = messages[spec.label(props)];

    return (
      <Comp
        type={asChild ? undefined : 'button'}
        aria-label={label}
        title={label}
        {...rest}
        className={cx('fp-button', resolveClassName(className, { disabled: isDisabled }))}
        disabled={isDisabled}
        data-disabled={isDisabled ? '' : undefined}
        data-action={spec.name}
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          onClick?.(event);
          if (!event.defaultPrevented && !isDisabled) spec.run(controller.actions, props);
        }}
      >
        {asChild ? children : (children ?? icons[spec.icon(props)])}
      </Comp>
    );
  }
  ActionButton.displayName = `Viewer.${spec.name}`;
  return ActionButton;
}

const EPSILON = 0.001;

export const ZoomIn = createActionButton({
  name: 'ZoomIn',
  capability: 'zoom',
  icon: () => 'zoomIn',
  label: () => 'zoomIn',
  run: (a) => a.zoomIn(),
  enabled: (s, c) => s.zoom < c.formatOptions.zoomOptions.max - EPSILON,
});

export const ZoomOut = createActionButton({
  name: 'ZoomOut',
  capability: 'zoom',
  icon: () => 'zoomOut',
  label: () => 'zoomOut',
  run: (a) => a.zoomOut(),
  enabled: (s, c) => s.zoom > c.formatOptions.zoomOptions.min + EPSILON,
});

export const PrevPage = createActionButton({
  name: 'PrevPage',
  capability: 'paging',
  icon: () => 'prevPage',
  label: () => 'prevPage',
  run: (a) => a.prevPage(),
  enabled: (s) => s.page > 1,
});

export const NextPage = createActionButton({
  name: 'NextPage',
  capability: 'paging',
  icon: () => 'nextPage',
  label: () => 'nextPage',
  run: (a) => a.nextPage(),
  enabled: (s) => s.page < s.pageCount,
});

export const Rotate = createActionButton<{ direction?: 'cw' | 'ccw' }>({
  name: 'Rotate',
  capability: 'rotate',
  icon: (p) => (p.direction === 'ccw' ? 'rotateCcw' : 'rotateCw'),
  label: (p) => (p.direction === 'ccw' ? 'rotateCcw' : 'rotateCw'),
  run: (a, p) => a.rotate(p.direction ?? 'cw'),
});

export const Download = createActionButton({
  name: 'Download',
  capability: 'download',
  icon: () => 'download',
  label: () => 'download',
  run: (a) => a.download(),
  allowWhenUnsupported: true,
});

export const Print = createActionButton({
  name: 'Print',
  capability: 'print',
  icon: () => 'print',
  label: () => 'print',
  run: (a) => a.print(),
});

// ---------------------------------------------------------------------------

export interface ZoomLevelProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  children?: (state: { zoom: number; zoomRequest: Zoom }) => ReactNode;
}

export function ZoomLevel({ children, className, ...rest }: ZoomLevelProps) {
  const zoom = useViewerSelector((s) => s.zoom);
  const zoomRequest = useViewerSelector((s) => s.zoomRequest);
  const supported = useViewerSelector((s) => s.capabilities.zoom);
  if (!supported) return null;
  return (
    <span className={cx('fp-zoom-level', className)} aria-live="polite" {...rest}>
      {children ? children({ zoom, zoomRequest }) : formatZoom(zoom)}
    </span>
  );
}

export const DEFAULT_ZOOM_SELECT_OPTIONS: Zoom[] = ['page-fit', 'page-width', 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export interface ZoomSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  options?: Zoom[];
  /** Label for each option; defaults to "Fit page", "Fit width" and percentages. */
  formatOption?: (zoom: Zoom, messages: Messages) => string;
}

export function ZoomSelect({ options = DEFAULT_ZOOM_SELECT_OPTIONS, formatOption, className, ...rest }: ZoomSelectProps) {
  const controller = useController();
  const zoom = useViewerSelector((s) => s.zoom);
  const zoomRequest = useViewerSelector((s) => s.zoomRequest);
  const supported = useViewerSelector((s) => s.capabilities.zoom);
  const ready = useViewerSelector((s) => s.status === 'ready');
  if (!supported) return null;

  const { messages } = controller;
  const { min, max } = controller.formatOptions.zoomOptions;
  const label = (z: Zoom) =>
    formatOption
      ? formatOption(z, messages)
      : z === 'page-fit'
        ? messages.fitPage
        : z === 'page-width'
          ? messages.fitWidth
          : formatZoom(z);
  const fits = controller.renderer?.fit !== false;
  const visible = options.filter((o) => (isZoomMode(o) ? fits : o >= min - EPSILON && o <= max + EPSILON));
  const current = String(zoomRequest);
  const known = visible.some((o) => String(o) === current);

  return (
    <select
      aria-label={messages.zoomLevel}
      {...rest}
      className={cx('fp-select', className)}
      disabled={!ready || rest.disabled}
      value={known ? current : 'custom'}
      onChange={(e) => {
        const value = e.target.value;
        if (value === 'custom') return;
        controller.actions.setZoom(isZoomMode(value as Zoom) ? (value as Zoom) : Number(value));
      }}
    >
      {!known && (
        <option value="custom" hidden>
          {formatZoom(zoom)}
        </option>
      )}
      {visible.map((o) => (
        <option key={String(o)} value={String(o)}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}

export interface PageIndicatorProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  children?: (state: { page: number; pageCount: number; goToPage(page: number): void }) => ReactNode;
}

export function PageIndicator({ children, className, ...rest }: PageIndicatorProps) {
  const controller = useController();
  const page = useViewerSelector((s) => s.page);
  const pageCount = useViewerSelector((s) => s.pageCount);
  const supported = useViewerSelector((s) => s.capabilities.paging);
  const ready = useViewerSelector((s) => s.status === 'ready');
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => setDraft(null), [page]);
  if (!supported) return null;

  if (children) {
    return (
      <span className={cx('fp-page-indicator', className)} {...rest}>
        {children({ page, pageCount, goToPage: controller.actions.goToPage })}
      </span>
    );
  }

  const commit = () => {
    if (draft !== null) {
      const n = Number(draft);
      if (Number.isFinite(n)) controller.actions.goToPage(n);
    }
    setDraft(null);
  };

  return (
    <span className={cx('fp-page-indicator', className)} {...rest}>
      <input
        className="fp-page-input"
        inputMode="numeric"
        aria-label={controller.messages.page}
        disabled={!ready}
        value={draft ?? String(page)}
        size={Math.max(2, String(pageCount).length)}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(null);
        }}
      />
      <span className="fp-page-total">/ {pageCount || '–'}</span>
    </span>
  );
}

export function PageNav({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const supported = useViewerSelector((s) => s.capabilities.paging);
  if (!supported) return null;
  return (
    <div className={cx('fp-page-nav', className)} {...rest}>
      <PrevPage />
      <PageIndicator />
      <NextPage />
    </div>
  );
}

export function FileName({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  const file = useViewerSelector((s) => s.file);
  if (!file) return null;
  return (
    <span className={cx('fp-file-name', className)} title={file.name} {...rest}>
      {file.name}
    </span>
  );
}

export function Toolbar({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div role="toolbar" aria-orientation="horizontal" className={cx('fp-toolbar', className)} {...rest} />;
}

export function Separator({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" aria-orientation="vertical" className={cx('fp-separator', className)} {...rest} />;
}

export function Spacer({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fp-spacer', className)} {...rest} />;
}

export interface IfProps {
  capability?: CapabilityName;
  status?: ViewerState['status'] | ViewerState['status'][];
  children?: ReactNode;
}

/** Renders children only when the current file has the capability / status. */
export function If({ capability, status, children }: IfProps) {
  const ok = useViewerSelector(
    (s) => (!capability || s.capabilities[capability]) && (!status || [status].flat().includes(s.status)),
  );
  return ok ? <>{children}</> : null;
}
