// esbuild drops module-level directives, so add 'use client' to the entries
// that export components (for React Server Components / Next.js app router).
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
for (const entry of ['index.js', 'core.js']) {
  const file = new URL(entry, dist);
  const code = readFileSync(file, 'utf8');
  if (!code.startsWith("'use client'")) writeFileSync(file, `'use client';\n${code}`);
}
copyFileSync(new URL('../src/styles.css', import.meta.url), new URL('styles.css', dist));
console.log('postbuild: use client + styles.css');
