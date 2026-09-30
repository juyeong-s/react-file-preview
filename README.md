# @ruby-s/react-file-preview

One React component to preview **PDF, Word, Excel, images, video, audio and text**, entirely in the browser.

![react-file-preview demo: PDF, Word, Excel, images and Markdown in one viewer](https://raw.githubusercontent.com/juyeong-s/react-file-preview/main/docs/demo.gif)

- **One install.** No pdf.js worker setup, no separate Excel/Word libraries to wire up.
- **Fully client-side.** Files are never sent to Office Online or Google Docs viewers, so it works on intranets and with private files.
- **Lazy per format.** The core is ~12 KB gzip. pdf.js, SheetJS and docx-preview load only when a file of that type is opened.
- **Use it your way.** Drop in a complete viewer, compose your own from parts, or go fully headless.

```bash
npm install @ruby-s/react-file-preview
```

```tsx
import { FileViewerPreset } from '@ruby-s/react-file-preview';
import '@ruby-s/react-file-preview/styles.css';

<FileViewerPreset file={fileOrUrl} height="80vh" locale="ko" />;
```

## Supported formats

| Kind  | Extensions                                    | Engine                     |
| ----- | --------------------------------------------- | -------------------------- |
| PDF   | `pdf`                                         | pdf.js                     |
| Word  | `docx`                                        | docx-preview               |
| Excel | `xlsx` `xls` `csv`                            | SheetJS + virtualized grid |
| Image | `jpg` `jpeg` `png` `gif` `webp` `svg` `bmp`   | browser                    |
| Video | `mp4` `webm` (`mov` when the browser can)     | browser                    |
| Audio | `mp3` `wav` `m4a` `ogg`                       | browser                    |
| Text  | `txt` `log` `json` `xml` `md`                 | built in (+ marked)        |

The format is detected from **magic bytes**, then the MIME type, then the name, so URLs without an extension and `application/octet-stream` responses work too. Anything else shows an "unsupported" screen with a download button, or goes through your [`convert`](#server-side-conversion) hook.

## Three ways to use it

### 1. Preset: everything included

```tsx
<FileViewerPreset
  file={file}
  toolbar={{ print: false }}   // hide groups, or `false` for no toolbar
  toolbarEnd={<ShareButton />}  // add your own
  sidebar                       // thumbnail sidebar for PDFs
/>
```

### 2. Basic plus compound parts

`<FileViewer>` renders only the file, plus sheet tabs for spreadsheets. Build any layout around it with `Viewer.*` parts:

```tsx
import { Viewer } from '@ruby-s/react-file-preview';

<Viewer.Root file={file}>
  <Viewer.Toolbar>
    <Viewer.FileName />
    <Viewer.Spacer />
    <Viewer.PageNav />
    <Viewer.ZoomOut /> <Viewer.ZoomSelect /> <Viewer.ZoomIn />
    <Viewer.Rotate direction="cw" />
    <Viewer.Download />
  </Viewer.Toolbar>
  <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
    <Viewer.Thumbnails />   {/* renders nothing for formats without pages */}
    <Viewer.Content />
  </div>
  <Viewer.SheetTabs />
</Viewer.Root>
```

Parts hide themselves when the current file can't use them. For example, `PageNav` doesn't appear for an image. Pass `forceMount` to keep a button (disabled) instead.

| Part | |
| --- | --- |
| `Root`, `Content` | Provider + root element, scrollable file area |
| `Toolbar`, `Separator`, `Spacer`, `FileName` | Layout helpers |
| `ZoomIn`, `ZoomOut`, `ZoomLevel`, `ZoomSelect` | Zoom |
| `PrevPage`, `NextPage`, `PageIndicator`, `PageNav` | Paging (PDF, DOCX) |
| `Rotate`, `Download`, `Print` | Actions |
| `Thumbnails`, `SheetTabs` | Page thumbnails, spreadsheet tabs |
| `If` | `<Viewer.If capability="paging">…</Viewer.If>` |

### 3. Headless

```tsx
import { useFileViewer, Viewer } from '@ruby-s/react-file-preview';

const viewer = useFileViewer({ file });
const { state, actions } = viewer;
// state: status, zoom, page, pageCount, rotation, sheets, capabilities, file, …
// actions: zoomIn, zoomOut, setZoom, goToPage, rotate, setSheet, download, print, …

<MyToolbar zoom={state.zoom} onZoomIn={actions.zoomIn} />
<Viewer.Root viewer={viewer}>
  <Viewer.Content />
</Viewer.Root>
```

Inside a `Viewer.Root`, `useViewer()` returns the same state and actions, and `useViewerSelector(s => s.page)` subscribes to a single value.

## Styling

The stylesheet uses CSS cascade layers, so **your own CSS always wins without `!important`**.

**Design tokens.** Override any `--fp-*` variable:

```css
.my-viewer {
  --fp-color-primary: #0ca678;
  --fp-radius: 12px;
  --fp-font-family: 'Pretendard', sans-serif;
  --fp-canvas-bg: #f1f3f5;   /* behind the pages */
  --fp-page-gap: 24px;
  --fp-page-shadow: none;
  --fp-toolbar-height: 56px;
}
```

`theme="light" | "dark" | "system"` switches between the built-in token sets.

**className and data attributes.** Every part accepts `className`. State is exposed as data attributes (`data-disabled`, `data-active`, `data-status`, `data-format`), and buttons also accept a function:

```tsx
<Viewer.ZoomIn className="p-2 rounded data-[disabled]:opacity-40" />
<Viewer.SheetTabs tabClassName={({ active }) => (active ? 'tab on' : 'tab')} />
```

**Your own components (`asChild`).** Behaviour, disabled state and aria labels are merged into your element:

```tsx
<Viewer.ZoomIn asChild>
  <Button variant="ghost" size="icon"><PlusIcon /></Button>
</Viewer.ZoomIn>
```

**Render props.**

```tsx
<Viewer.ZoomLevel>{({ zoom }) => `${Math.round(zoom * 100)} %`}</Viewer.ZoomLevel>
<Viewer.PageIndicator>{({ page, pageCount }) => `${page} / ${pageCount}`}</Viewer.PageIndicator>
<Viewer.Thumbnails renderItem={({ page, src, active, select }) => …} />
```

**Icons, text and status screens.**

```tsx
<Viewer.Root
  icons={{ zoomIn: <LuPlus />, download: <LuDownload /> }}
  locale="ko"                       // 'ko' | 'en'
  messages={{ unsupportedTitle: '미리보기를 지원하지 않습니다' }}
  renderLoading={({ progress }) => <Spinner value={progress} />}
  renderError={({ error, retry }) => <MyError onRetry={retry} />}
  renderUnsupported={({ file, download }) => <MyFallback />}
  unstyled                          // drop the theme, keep layout rules
/>
```

## Behaviour options

### Zoom

```tsx
<FileViewer
  file={file}
  zoomOptions={{
    initial: 'page-width',        // number | 'page-fit' | 'page-width'
    min: 0.25,
    max: 5,
    steps: [0.5, 0.75, 1, 1.25, 1.5, 2, 3],  // zoomIn/zoomOut snap to these
    wheel: 'ctrl',                // 'ctrl' | 'always' | false
    pinch: true,                  // trackpad + touch
    doubleClick: false,           // 'toggle-fit' | 'zoom-in' | false
  }}
/>
```

Rules:

- `zoomIn` from a fit mode goes to the next step above the current scale and leaves fit mode.
- In a fit mode, zoom is recomputed when the viewer is resized.
- Wheel and pinch zoom keep the point under the cursor in place.

### Per-format options

Anything can be overridden per renderer. The narrowest setting wins: built-in defaults, then renderer defaults, then global options, then `formats[name]`.

```tsx
<FileViewer
  file={file}
  zoomOptions={{ max: 4 }}
  formats={{
    image: { zoomOptions: { max: 10, wheel: 'always' }, background: 'none' },
    sheet: { showGridlines: false, encoding: 'euc-kr' },
    pdf: { textLayer: false, assetsUrl: '/pdfjs/' },
    text: { wrap: true, lineNumbers: false },
    media: { autoPlay: true, muted: true },
  }}
/>
```

| Renderer | Options |
| --- | --- |
| `pdf` | `textLayer`, `workerSrc`, `assetsUrl`, `maxCanvasPixels` |
| `docx` | `renderHeaders`, `renderFooters`, `renderFootnotes`, `renderEndnotes`, `renderChanges`, `renderComments` |
| `sheet` | `showGridlines`, `showHeaders`, `encoding`, `defaultColumnWidth`, `defaultRowHeight` |
| `image` | `upscale`, `background` (`'checker' \| 'none'`), `pan` |
| `media` | `autoPlay`, `loop`, `muted`, `poster` |
| `text` | `encoding`, `renderMarkdown`, `formatJson`, `lineNumbers`, `wrap` |

### Controlled state

`zoom`, `page`, `rotation` and `activeSheet` can be controlled, for example to sync them to the URL:

```tsx
const [zoom, setZoom] = useState<Zoom>('page-width');
<FileViewer file={file} zoom={zoom} onZoomChange={setZoom} />
```

Uncontrolled starting values: `defaultZoom`, `defaultPage`.

### Keyboard shortcuts

These are active while focus is inside the viewer (`shortcutScope="global"` makes them page-wide):

| Action | Default |
| --- | --- |
| zoomIn / zoomOut / resetZoom | `mod+=` / `mod+-` / `mod+0` |
| nextPage / prevPage | `ArrowRight` / `ArrowLeft` |
| download / print | `mod+s` / `mod+p` |

```tsx
<FileViewer shortcuts={{ print: false, nextPage: ['ArrowRight', 'j'] }} />  // or shortcuts={false}
```

### Events

`onLoad`, `onError`, `onZoomChange`, `onPageChange`, `onRotationChange`, `onSheetChange`, `onRendererResolved`, and `onDownload` (return `false` to cancel, e.g. after a permission check).

### Sources and auth

`file` accepts a URL string, `URL`, `File`, `Blob`, `ArrayBuffer` or `Uint8Array`. Use `fileName` when a URL has no useful name, and `type="pdf"` to force a format.

```tsx
<FileViewer file="/api/files/123" fetchOptions={{ headers: { Authorization: `Bearer ${token}` } }} />
```

Images and media stream straight from the URL (no full download), unless `fetchOptions.headers` is set.

> Keep `file` referentially stable. Creating a `new Uint8Array(...)` on every render reloads the file each time.

## App-wide defaults

```tsx
const config = createViewerConfig({ locale: 'ko', theme: 'system', zoomOptions: { max: 4 }, icons: myIcons });

<ViewerConfigProvider config={config}>
  <App />
</ViewerConfigProvider>
```

Props on each viewer override the provider.

## Only the renderers you need

The main entry registers every built-in renderer, each lazy-loaded. To make it explicit (or smaller in `node_modules` terms for your bundler's graph), use `/core`:

```tsx
import { FileViewer } from '@ruby-s/react-file-preview/core';
import { pdfRenderer, imageRenderer } from '@ruby-s/react-file-preview/renderers';

<FileViewer file={file} renderers={[pdfRenderer({ textLayer: false }), imageRenderer()]} />
```

## Custom renderers

```tsx
import { useViewerSelector, type RendererDefinition, type RendererProps } from '@ruby-s/react-file-preview';

const hwpRenderer: RendererDefinition = {
  name: 'hwp',
  test: ({ ext }) => ext === 'hwp',
  capabilities: { zoom: true },
  load: () => import('./HwpView'),   // default export: (props: RendererProps) => JSX
};

<FileViewer renderers={[...defaultRenderers, hwpRenderer]} />
```

A renderer view receives `file`, `getArrayBuffer()`, `options` and a `bridge`. Call `bridge.ready()` once painted, `bridge.fail(err)` on errors, `bridge.setPageCount(n)` / `bridge.reportPage(n)` for paging. Register `getFitScale`, `goToPage`, `getThumbnail` and `print` with `bridge.register({...})`. Read `zoom` and `rotation` with `useViewerSelector`.

## Server-side conversion

For formats that can't be rendered in the browser (`.doc`, `.ppt`, `.hwp`, …):

```tsx
<FileViewer
  file={file}
  convert={async (file) => {
    if (!['doc', 'ppt', 'hwp'].includes(file.ext)) return null;
    const res = await fetch('/api/convert-to-pdf', { method: 'POST', body: file.blob });
    return { source: await res.blob(), fileName: file.name.replace(/\.\w+$/, '.pdf') };
  }}
/>
```

Download still delivers the original file.

## Notes

- **Next.js / RSC**: entries are marked `'use client'`. Nothing touches `window` at import time.
- **PDF worker**: bundled and started from a `blob:` URL, so no configuration is needed. Under a strict CSP, allow `worker-src blob:` or set `formats.pdf.workerSrc`.
- **PDF assets**: CJK fonts without embedded glyphs and JPEG 2000 images need pdf.js cmaps / wasm files. By default these load from jsDelivr (the file itself is never sent). For intranets, copy `node_modules/pdfjs-dist/{cmaps,standard_fonts,wasm,iccs}` to your server and set `formats.pdf.assetsUrl`, or set it to `false`.
- **Korean CSV / text**: non-UTF-8 files fall back to EUC-KR (CP949), which is what Excel on Korean Windows writes.
- **Security**: Markdown and DOCX output is sanitized, SVG is rendered through `<img>`, and links in documents open in a new tab.

### Known limitations

- DOCX layout is an approximation of Word. Pagination follows Word's last rendered page breaks.
- Spreadsheet cell styles (fonts, fills, borders) and charts are not rendered. Values, number formats, merges, column widths and hidden rows/columns are.
- PDF links, forms and annotations are not interactive yet. There is no text search yet.

## License

MIT. Bundled engines: pdf.js (Apache-2.0), docx-preview (Apache-2.0), SheetJS Community Edition (Apache-2.0), marked (MIT), DOMPurify (Apache-2.0 / MPL-2.0).
