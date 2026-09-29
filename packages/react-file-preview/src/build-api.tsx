import { Content } from './core/Content';
import { createViewer } from './core/createViewer';
import type { RendererDefinition } from './core/types';
import * as parts from './ui/parts';
import { createPreset } from './ui/Preset';
import { SheetTabs } from './ui/SheetTabs';
import { Thumbnails } from './ui/Thumbnails';

export function buildApi(renderers: RendererDefinition[]) {
  const { Root, FileViewer, useFileViewer } = createViewer(renderers);
  const FileViewerPreset = createPreset(Root);

  /** Compound parts: compose your own viewer layout. */
  const Viewer = {
    Root,
    Content,
    Toolbar: parts.Toolbar,
    Separator: parts.Separator,
    Spacer: parts.Spacer,
    FileName: parts.FileName,
    ZoomIn: parts.ZoomIn,
    ZoomOut: parts.ZoomOut,
    ZoomLevel: parts.ZoomLevel,
    ZoomSelect: parts.ZoomSelect,
    PrevPage: parts.PrevPage,
    NextPage: parts.NextPage,
    PageIndicator: parts.PageIndicator,
    PageNav: parts.PageNav,
    Rotate: parts.Rotate,
    Download: parts.Download,
    Print: parts.Print,
    Thumbnails,
    SheetTabs,
    If: parts.If,
  };

  return { Viewer, FileViewer, FileViewerPreset, useFileViewer };
}
