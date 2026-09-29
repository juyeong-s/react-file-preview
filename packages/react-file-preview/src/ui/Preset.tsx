import { useState, type ComponentType, type ReactNode } from 'react';
import { Content } from '../core/Content';
import { useViewerIcons, useViewerMessages, useViewerSelector } from '../core/context';
import type { RootProps } from '../core/createViewer';
import {
  Download,
  FileName,
  PageNav,
  Print,
  Rotate,
  Separator,
  Spacer,
  Toolbar,
  ZoomIn,
  ZoomOut,
  ZoomSelect,
} from './parts';
import { SheetTabs } from './SheetTabs';
import { Thumbnails } from './Thumbnails';

export interface PresetToolbarItems {
  fileName?: boolean;
  pageNav?: boolean;
  zoom?: boolean;
  rotate?: boolean;
  print?: boolean;
  download?: boolean;
}

export interface FileViewerPresetProps extends Omit<RootProps, 'children'> {
  /** `false` hides the toolbar; an object hides individual groups. */
  toolbar?: false | PresetToolbarItems;
  /** Extra content at the start / end of the toolbar. */
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  /** Thumbnail sidebar for paged formats. */
  sidebar?: boolean;
  defaultSidebarOpen?: boolean;
  thumbnailWidth?: number;
}

function SidebarToggle({ open, onToggle }: { open: boolean; onToggle(): void }) {
  const supported = useViewerSelector((s) => s.capabilities.thumbnails);
  const icons = useViewerIcons();
  const messages = useViewerMessages();
  if (!supported) return null;
  return (
    <button
      type="button"
      className="fp-button"
      aria-label={messages.toggleSidebar}
      title={messages.toggleSidebar}
      aria-pressed={open}
      data-active={open ? '' : undefined}
      data-action="ToggleSidebar"
      onClick={onToggle}
    >
      {icons.sidebar}
    </button>
  );
}

function PresetBody({
  toolbar,
  toolbarStart,
  toolbarEnd,
  sidebar,
  defaultSidebarOpen,
  thumbnailWidth,
}: Pick<
  FileViewerPresetProps,
  'toolbar' | 'toolbarStart' | 'toolbarEnd' | 'sidebar' | 'defaultSidebarOpen' | 'thumbnailWidth'
>) {
  const [open, setOpen] = useState(defaultSidebarOpen ?? true);
  const hasThumbnails = useViewerSelector((s) => s.capabilities.thumbnails);
  const items: PresetToolbarItems = toolbar === false ? {} : { ...toolbar };
  const show = (key: keyof PresetToolbarItems) => items[key] !== false;

  return (
    <>
      {toolbar !== false && (
        <Toolbar className="fp-preset-toolbar">
          {sidebar !== false && <SidebarToggle open={open} onToggle={() => setOpen((o) => !o)} />}
          {toolbarStart}
          {show('fileName') && <FileName />}
          <Spacer />
          {show('pageNav') && <PageNav data-preset-group="page" />}
          {show('zoom') && (
            <div className="fp-group" data-preset-group="zoom">
              <ZoomOut />
              <ZoomSelect />
              <ZoomIn />
            </div>
          )}
          {show('rotate') && (
            <div className="fp-group" data-preset-group="rotate">
              <Rotate direction="ccw" />
              <Rotate direction="cw" />
            </div>
          )}
          <Separator />
          {show('print') && <Print />}
          {show('download') && <Download />}
          {toolbarEnd}
        </Toolbar>
      )}
      <div className="fp-preset-body">
        {sidebar !== false && hasThumbnails && open && (
          <aside className="fp-preset-sidebar">
            <Thumbnails width={thumbnailWidth} />
          </aside>
        )}
        <Content />
      </div>
      <SheetTabs />
    </>
  );
}

export function createPreset(Root: ComponentType<RootProps>) {
  /** A complete viewer: toolbar, thumbnail sidebar, content and sheet tabs. */
  function FileViewerPreset({
    toolbar,
    toolbarStart,
    toolbarEnd,
    sidebar,
    defaultSidebarOpen,
    thumbnailWidth,
    className,
    ...rootProps
  }: FileViewerPresetProps) {
    return (
      <Root {...rootProps} className={['fp-preset', className].filter(Boolean).join(' ')}>
        <PresetBody
          toolbar={toolbar}
          toolbarStart={toolbarStart}
          toolbarEnd={toolbarEnd}
          sidebar={sidebar}
          defaultSidebarOpen={defaultSidebarOpen}
          thumbnailWidth={thumbnailWidth}
        />
      </Root>
    );
  }
  return FileViewerPreset;
}
