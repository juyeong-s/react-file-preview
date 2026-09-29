// The package README (shown on npm) is the source of truth; the root README
// (shown on GitHub) is a copy. `--check` fails when they differ (used in CI).
import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../packages/react-file-preview/README.md', import.meta.url);
const target = new URL('../README.md', import.meta.url);
const content = readFileSync(source, 'utf8');

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {}
  if (current !== content) {
    console.error('README.md is out of date. Run `pnpm readme:sync`.');
    process.exit(1);
  }
  console.log('README.md is in sync.');
} else {
  writeFileSync(target, content);
  console.log('README.md synced from packages/react-file-preview/README.md');
}
