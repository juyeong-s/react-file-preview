import type { HTMLAttributes, ReactNode } from 'react';
import { useController, useViewerSelector } from '../core/context';
import { cx } from '../core/utils';
import type { StateClassName } from './parts';

export interface SheetTabRenderProps {
  name: string;
  index: number;
  active: boolean;
  select(): void;
}

export interface SheetTabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  renderTab?: (props: SheetTabRenderProps) => ReactNode;
  tabClassName?: StateClassName<{ active: boolean }>;
}

/** Tabs for switching spreadsheet sheets. Renders nothing for other formats. */
export function SheetTabs({ renderTab, tabClassName, className, ...rest }: SheetTabsProps) {
  const controller = useController();
  const sheets = useViewerSelector((s) => s.sheets);
  const active = useViewerSelector((s) => s.activeSheet);
  const supported = useViewerSelector((s) => s.capabilities.sheets);
  if (!supported || sheets.length === 0) return null;

  return (
    <div role="tablist" aria-label={controller.messages.sheets} className={cx('fp-sheet-tabs', className)} {...rest}>
      {sheets.map((name, index) => {
        const isActive = index === active;
        const select = () => controller.actions.setSheet(index);
        if (renderTab) return <span key={index}>{renderTab({ name, index, active: isActive, select })}</span>;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? '' : undefined}
            className={cx(
              'fp-sheet-tab',
              typeof tabClassName === 'function' ? tabClassName({ active: isActive }) : tabClassName,
            )}
            onClick={select}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
