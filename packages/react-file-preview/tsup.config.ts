import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/core.ts',
    renderers: 'src/renderers.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  treeshake: true,
  sourcemap: false,
  clean: true,
  target: 'es2022',
  // Engines stay separate packages so the app's bundler can dedupe and split them.
  external: ['react', 'react-dom', 'react/jsx-runtime', 'pdfjs-dist', 'docx-preview', 'xlsx', 'marked', 'dompurify', '@tanstack/react-virtual'],
});
