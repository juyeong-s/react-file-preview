import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const lib = (p: string) => fileURLToPath(new URL(`../../packages/react-file-preview/${p}`, import.meta.url));

// By default the playground runs against the library source (instant HMR).
// `USE_DIST=1 pnpm dev` runs it against the built package instead.
const useDist = process.env.USE_DIST === '1';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: useDist
      ? []
      : [
          { find: /^@ruby-s\/react-file-preview\/styles\.css$/, replacement: lib('src/styles.css') },
          { find: /^@ruby-s\/react-file-preview\/core$/, replacement: lib('src/core.ts') },
          { find: /^@ruby-s\/react-file-preview\/renderers$/, replacement: lib('src/renderers.ts') },
          { find: /^@ruby-s\/react-file-preview$/, replacement: lib('src/index.ts') },
        ],
  },
  server: { port: 5178 },
});
