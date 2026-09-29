import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ViewerController } from '../src/core/controller';
import type { RendererDefinition, UseFileViewerOptions } from '../src/core/types';

beforeAll(() => {
  let n = 0;
  URL.createObjectURL = () => `blob:test/${n++}`;
  URL.revokeObjectURL = () => {};
});

const fakePdf: RendererDefinition = {
  name: 'pdf',
  test: ({ ext }) => ext === 'pdf',
  capabilities: { zoom: true, paging: true },
  defaults: { zoomOptions: { initial: 'page-width' } },
  load: async () => ({ default: () => null }),
};

function setup(options: Partial<UseFileViewerOptions> = {}, renderers = [fakePdf]) {
  const controller = new ViewerController();
  const opts = { file: null, ...options } as UseFileViewerOptions;
  controller.update(opts, {}, renderers);
  return controller;
}

const pdfBlob = () => new Blob(['%PDF-1.7 fake']);

describe('ViewerController', () => {
  it('detects the format from bytes and waits for the renderer', async () => {
    const c = setup();
    await c.load(pdfBlob());
    const s = c.getState();
    expect(s.status).toBe('rendering');
    expect(s.renderer).toBe('pdf');
    expect(s.file?.ext).toBe('pdf');
    expect(s.file?.name).toBe('file.pdf');
    expect(s.capabilities).toMatchObject({ zoom: true, paging: true, download: true, rotate: false });

    const onLoad = vi.fn();
    c.options.onLoad = onLoad;
    c.bridge.setPageCount(3);
    c.bridge.ready();
    expect(c.getState().status).toBe('ready');
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it('resolves fit modes through the renderer', async () => {
    const c = setup();
    await c.load(pdfBlob());
    c.setViewport({ width: 1000, height: 800 });
    c.bridge.register({ getFitScale: (mode, box) => (mode === 'page-width' ? box.width / 500 : 1.1) });
    expect(c.getState().zoom).toBe(2);
    c.setViewport({ width: 750, height: 800 });
    expect(c.getState().zoom).toBe(1.5);
    c.actions.setZoom('page-fit');
    expect(c.getState().zoom).toBe(1.1);
  });

  it('steps zoom and respects controlled mode', async () => {
    const onZoomChange = vi.fn();
    const c = setup({ zoom: 1, onZoomChange });
    await c.load(pdfBlob());
    c.bridge.ready();
    c.actions.zoomIn();
    // Controlled: reports the request, does not apply it.
    expect(onZoomChange).toHaveBeenCalledWith(1.25);
    expect(c.getState().zoom).toBe(1);
    c.options.zoom = 1.25;
    c.syncControlled();
    expect(c.getState().zoom).toBe(1.25);
  });

  it('pages: clamps, calls the renderer, reports changes', async () => {
    const onPageChange = vi.fn();
    const goToPage = vi.fn();
    const c = setup({ onPageChange });
    await c.load(pdfBlob());
    c.bridge.setPageCount(5);
    c.bridge.register({ goToPage });
    c.bridge.ready();
    c.actions.goToPage(9);
    expect(goToPage).toHaveBeenCalledWith(5);
    expect(c.getState().page).toBe(5);
    c.actions.prevPage();
    expect(c.getState().page).toBe(4);
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });

  it('ignores actions the format does not support', async () => {
    const c = setup();
    await c.load(pdfBlob());
    c.bridge.ready();
    c.actions.rotate();
    expect(c.getState().rotation).toBe(0);
  });

  it('marks unknown files unsupported, or converts them', async () => {
    const c = setup({ fileName: 'old.doc' });
    await c.load(new Blob([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])]));
    expect(c.getState().status).toBe('unsupported');
    expect(c.getState().capabilities.download).toBe(true);

    const convert = vi.fn(async () => ({ source: pdfBlob(), fileName: 'old.pdf' }));
    const c2 = setup({ fileName: 'old.doc', convert });
    await c2.load(new Blob(['not really a doc']));
    expect(convert).toHaveBeenCalledOnce();
    expect(c2.getState().renderer).toBe('pdf');
    expect(c2.getState().file?.name).toBe('old.pdf');
  });

  it('honours the type option over detection', async () => {
    const text: RendererDefinition = { ...fakePdf, name: 'text', test: ({ ext }) => ext === 'txt' };
    const c = setup({ type: 'txt' }, [fakePdf, text]);
    await c.load(pdfBlob());
    expect(c.getState().renderer).toBe('text');
  });

  it('streams url renderers without downloading', async () => {
    const image: RendererDefinition = { ...fakePdf, name: 'image', test: ({ ext }) => ext === 'png', source: 'url' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const c = setup({}, [image]);
    await c.load('https://example.com/a/photo.png');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(c.getState().file).toMatchObject({ url: 'https://example.com/a/photo.png', blob: null, ext: 'png' });
    fetchSpy.mockRestore();
  });

  it('reports errors and drops stale loads', async () => {
    const onError = vi.fn();
    const c = setup({ onError });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 404 }));
    await c.load('https://example.com/missing.pdf');
    expect(c.getState().status).toBe('error');
    expect(c.getState().error?.message).toContain('404');
    expect(onError).toHaveBeenCalledOnce();

    const staleBridge = c.bridge;
    await c.load(pdfBlob());
    staleBridge.ready();
    expect(c.getState().status).toBe('rendering');
    fetchSpy.mockRestore();
  });
});
