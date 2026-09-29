import { buildApi } from './build-api';
import { defaultRenderers } from './renderers';

export * from './shared-exports';
export * from './renderers';

const api = buildApi(defaultRenderers);

/** Content only (plus sheet tabs for spreadsheets). Style and extend it with `Viewer.*`. */
export const FileViewer = api.FileViewer;
/** Toolbar, thumbnails, content and sheet tabs, ready to use. */
export const FileViewerPreset = api.FileViewerPreset;
/** Compound parts for building a custom layout. */
export const Viewer = api.Viewer;
/** Headless viewer state and actions; pass the result to `<Viewer.Root viewer={…}>`. */
export const useFileViewer = api.useFileViewer;
