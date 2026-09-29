// The viewer without any bundled renderer. Register the ones you need:
//   import { FileViewer } from '@ruby-s/react-file-preview/core';
//   import { pdfRenderer } from '@ruby-s/react-file-preview/renderers';
//   <FileViewer renderers={[pdfRenderer()]} file={file} />
import { buildApi } from './build-api';

export * from './shared-exports';

const api = buildApi([]);

export const FileViewer = api.FileViewer;
export const FileViewerPreset = api.FileViewerPreset;
export const Viewer = api.Viewer;
export const useFileViewer = api.useFileViewer;
