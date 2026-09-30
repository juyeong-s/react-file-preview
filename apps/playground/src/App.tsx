import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import {
  FileViewer,
  FileViewerPreset,
  useFileViewer,
  Viewer,
  ViewerConfigProvider,
  createViewerConfig,
  formatZoom,
  type FileSource,
  type Zoom,
} from '@ruby-s/react-file-preview';

const SAMPLES = [
  { name: 'sample.pdf', label: 'PDF · 12 pages, mixed sizes' },
  { name: 'sample.docx', label: 'Word · 한글, table, page breaks' },
  { name: 'sample.xlsx', label: 'Excel · 3 sheets, 5000 rows' },
  { name: 'sample-legacy.xls', label: 'Excel 97 (.xls)' },
  { name: 'sample.csv', label: 'CSV · UTF-8' },
  { name: 'sample-euckr.csv', label: 'CSV · EUC-KR (Excel KR)' },
  { name: 'sample.png', label: 'PNG · transparent' },
  { name: 'sample.svg', label: 'SVG' },
  { name: 'sample.wav', label: 'Audio · WAV' },
  { name: 'sample.md', label: 'Markdown' },
  { name: 'sample.json', label: 'JSON (minified → pretty)' },
  { name: 'sample.xml', label: 'XML' },
  { name: 'sample.log', label: 'Log · 20,000 lines' },
  { name: 'sample.txt', label: 'Plain text' },
  { name: 'unsupported.hwp', label: 'Unsupported (.hwp)' },
];

type Demo = 'preset' | 'basic' | 'compound' | 'headless';

const DEMOS: { id: Demo; label: string; hint: string }[] = [
  { id: 'preset', label: 'Preset', hint: '<FileViewerPreset /> — toolbar, thumbnails, sheet tabs' },
  { id: 'basic', label: 'Basic', hint: '<FileViewer /> — content only' },
  { id: 'compound', label: 'Compound', hint: '<Viewer.*> parts, asChild, render props, CSS variables' },
  { id: 'headless', label: 'Headless', hint: 'useFileViewer() outside the root + controlled zoom' },
];

interface Selected {
  source: FileSource;
  name: string;
}

const params = new URLSearchParams(window.location.search);

// App-wide defaults; props on each viewer still win.
const appConfig = createViewerConfig({
  formats: { image: { zoomOptions: { max: 8 } } },
});

export function App() {
  const [selected, setSelected] = useState<Selected>({ source: '/samples/sample.pdf', name: 'sample.pdf' });
  const [demo, setDemo] = useState<Demo>('preset');
  // `?locale=en&theme=dark` presets the controls (used by scripts/record-demo.mjs).
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => (params.get('theme') as 'dark') ?? 'light');
  const [locale, setLocale] = useState<'ko' | 'en'>(() => (params.get('locale') === 'en' ? 'en' : 'ko'));
  const [url, setUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [events, setEvents] = useState<string[]>([]);

  const log = (message: string) => setEvents((e) => [`${new Date().toLocaleTimeString()} ${message}`, ...e].slice(0, 6));

  const openFile = (file: File | undefined) => file && setSelected({ source: file, name: file.name });

  const common = {
    file: selected.source,
    theme,
    locale,
    onLoad: ({ renderer, pageCount }: { renderer: string; pageCount: number }) =>
      log(`onLoad · ${renderer}${pageCount ? ` · ${pageCount} pages` : ''}`),
    onError: (error: Error) => log(`onError · ${error.message}`),
  };

  return (
    <ViewerConfigProvider config={appConfig}>
      <div className="app" data-theme={theme}>
        <aside className="side">
          <h1>
            react-file-preview <small>playground</small>
          </h1>

          <label
            className="drop"
            data-dragging={dragging || undefined}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              openFile(e.dataTransfer.files[0]);
            }}
          >
            <input type="file" hidden onChange={(e) => openFile(e.target.files?.[0])} />
            Drop a file or <u>browse</u>
          </label>

          <form
            className="url"
            onSubmit={(e) => {
              e.preventDefault();
              if (url) setSelected({ source: url, name: url });
            }}
          >
            <input placeholder="https://… file URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button type="submit">Open</button>
          </form>

          <nav className="samples">
            {SAMPLES.map((s) => (
              <button
                key={s.name}
                data-active={selected.name === s.name || undefined}
                onClick={() => setSelected({ source: `/samples/${s.name}`, name: s.name })}
              >
                <span>{s.name}</span>
                <small>{s.label}</small>
              </button>
            ))}
          </nav>

          <div className="events">
            <strong>Events</strong>
            {events.length === 0 ? <div>—</div> : events.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        </aside>

        <main className="main">
          <header className="bar">
            <div className="tabs" role="tablist">
              {DEMOS.map((d) => (
                <button key={d.id} role="tab" aria-selected={demo === d.id} onClick={() => setDemo(d.id)}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className="controls">
              <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)} aria-label="Theme">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
              <select value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)} aria-label="Locale">
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </div>
          </header>
          <p className="hint">{DEMOS.find((d) => d.id === demo)!.hint}</p>

          <section className="stage">
            {demo === 'preset' && <FileViewerPreset {...common} />}
            {demo === 'basic' && <FileViewer {...common} />}
            {demo === 'compound' && <CompoundDemo {...common} />}
            {demo === 'headless' && <HeadlessDemo {...common} />}
          </section>
        </main>
      </div>
    </ViewerConfigProvider>
  );
}

/** A stand-in for your design system's button. */
function MyButton({ children, ...props }: { children?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={['my-button', props.className].filter(Boolean).join(' ')}>
      {children}
    </button>
  );
}

function CompoundDemo(props: Parameters<typeof FileViewer>[0]) {
  return (
    <Viewer.Root {...props} className="brand-viewer" zoomOptions={{ steps: [0.5, 1, 1.5, 2, 3] }}>
      <Viewer.Toolbar className="brand-toolbar">
        <Viewer.FileName />
        <Viewer.Spacer />
        <Viewer.ZoomOut asChild>
          <MyButton>−</MyButton>
        </Viewer.ZoomOut>
        <Viewer.ZoomLevel>{({ zoom, zoomRequest }) => (typeof zoomRequest === 'string' ? `Fit · ${formatZoom(zoom)}` : formatZoom(zoom))}</Viewer.ZoomLevel>
        <Viewer.ZoomIn asChild>
          <MyButton>+</MyButton>
        </Viewer.ZoomIn>
        <Viewer.Download asChild>
          <MyButton className="primary">Download</MyButton>
        </Viewer.Download>
      </Viewer.Toolbar>
      <Viewer.Content />
      <Viewer.If capability="paging">
        <footer className="brand-footer">
          <Viewer.PrevPage className={({ disabled }) => (disabled ? 'dim' : undefined)} />
          <Viewer.PageIndicator>{({ page, pageCount }) => <span>Page {page} of {pageCount}</span>}</Viewer.PageIndicator>
          <Viewer.NextPage className={({ disabled }) => (disabled ? 'dim' : undefined)} />
        </footer>
      </Viewer.If>
      <Viewer.SheetTabs tabClassName={({ active }) => (active ? 'brand-tab active' : 'brand-tab')} />
    </Viewer.Root>
  );
}

function HeadlessDemo(props: Parameters<typeof FileViewer>[0]) {
  const [zoom, setZoom] = useState<Zoom>('page-width');
  const viewer = useFileViewer({ ...props, file: props.file ?? null, zoom, onZoomChange: setZoom });
  const { state, actions } = viewer;

  return (
    <div className="headless">
      <div className="headless-panel">
        <div>
          <b>status</b> {state.status} · <b>renderer</b> {state.renderer ?? '—'}
        </div>
        <div>
          <b>zoom</b> {String(zoom)} ({formatZoom(state.zoom)}) · <b>page</b> {state.page}/{state.pageCount} ·{' '}
          <b>rotation</b> {state.rotation}°
        </div>
        <div className="headless-actions">
          <button disabled={!state.capabilities.zoom} onClick={actions.zoomOut}>
            Zoom out
          </button>
          <button disabled={!state.capabilities.zoom} onClick={actions.zoomIn}>
            Zoom in
          </button>
          <button disabled={!state.capabilities.zoom} onClick={() => setZoom('page-fit')}>
            Fit page (controlled)
          </button>
          <button disabled={!state.capabilities.paging} onClick={() => actions.goToPage(state.pageCount)}>
            Last page
          </button>
          <button disabled={!state.capabilities.rotate} onClick={() => actions.rotate()}>
            Rotate
          </button>
          <button disabled={!state.capabilities.download} onClick={actions.download}>
            Download
          </button>
        </div>
      </div>
      <Viewer.Root viewer={viewer} className="headless-root">
        <Viewer.Content />
        <Viewer.SheetTabs />
      </Viewer.Root>
    </div>
  );
}
