// Records the README demo: drives the playground with a visible cursor and
// writes docs/demo.gif (README / npm) and docs/demo.mp4 (higher quality).
//
//   pnpm fixtures && pnpm demo
//
// Needs ffmpeg on PATH and `npx playwright install chromium`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const playground = join(root, 'apps/playground');
const outDir = join(root, 'docs');
const WIDTH = 1280;
const HEIGHT = 800;
const GIF_WIDTH = 880;

// --- dev server -------------------------------------------------------------
const requireFromPlayground = createRequire(join(playground, 'package.json'));
const { createServer } = await import(pathToFileURL(requireFromPlayground.resolve('vite')).href);
const server = await createServer({
  root: playground,
  configFile: join(playground, 'vite.config.ts'),
  server: { port: 5199, strictPort: true },
  logLevel: 'error',
});
await server.listen();
const url = 'http://localhost:5199/?locale=en';

// --- browser ----------------------------------------------------------------
const videoDir = mkdtempSync(join(tmpdir(), 'fp-demo-'));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  recordVideo: { dir: videoDir, size: { width: WIDTH, height: HEIGHT } },
});
const recordingStarted = Date.now();

// A fake cursor, click ripple and caption: headless recordings show neither
// the real pointer nor what is going on.
await context.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
      #demo-cursor{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;
        transform:translate(-3px,-2px);filter:drop-shadow(0 1px 2px rgb(0 0 0/.45))}
      .demo-ripple{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;z-index:2147483646;
        pointer-events:none;background:rgb(59 91 219/.35);animation:demo-ripple .5s ease-out forwards}
      @keyframes demo-ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}
      #demo-caption{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483645;pointer-events:none;
        padding:10px 18px;border-radius:999px;background:rgb(17 24 39/.88);color:#fff;
        font:600 17px/1.2 system-ui,-apple-system,sans-serif;letter-spacing:.01em;transition:opacity .25s;opacity:0}`;
    document.head.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2l15 11.5-6.6 1 3.9 7.3-2.7 1.4-3.9-7.3L4 20z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cursor);
    const caption = document.createElement('div');
    caption.id = 'demo-caption';
    document.body.appendChild(caption);
    addEventListener('mousemove', (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    }, true);
    addEventListener('mousedown', (e) => {
      const ripple = document.createElement('div');
      ripple.className = 'demo-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    }, true);
    window.__caption = (text) => {
      caption.textContent = text;
      caption.style.opacity = text ? '1' : '0';
    };
  });
});

const page = await context.newPage();
await page.goto(url);

// --- helpers ------------------------------------------------------------------
let pointer = { x: WIDTH / 2, y: HEIGHT / 2 };
const wait = (ms) => page.waitForTimeout(ms);

async function moveTo(x, y) {
  const distance = Math.hypot(x - pointer.x, y - pointer.y);
  await page.mouse.move(x, y, { steps: Math.max(8, Math.round(distance / 18)) });
  pointer = { x, y };
}

async function center(locator) {
  await locator.waitFor({ state: 'visible' });
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function click(locator, pause = 450) {
  const { x, y } = await center(locator);
  await moveTo(x, y);
  await wait(120);
  await page.mouse.down();
  await wait(70);
  await page.mouse.up();
  await wait(pause);
}

async function wheel(locator, deltaY, times = 1, gap = 60) {
  const { x, y } = await center(locator);
  await moveTo(x, y);
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, deltaY);
    await wait(gap);
  }
}

const caption = (text) => page.evaluate((t) => window.__caption?.(t), text);
const ready = () => page.locator('.fp-root[data-status="ready"]').first().waitFor();
const sample = (name) => page.locator('.samples button', { hasText: name }).first();
const action = (name) => page.locator(`.stage [data-action="${name}"]`).first();
const content = () => page.locator('.stage .fp-scroll').first();

// --- the tour -----------------------------------------------------------------
await ready();
await wait(600);
const tourStarted = Date.now();

await caption('PDF — thumbnails, paging, zoom');
await wait(900);
await click(page.locator('.fp-thumbnail').nth(2), 900);
await click(action('ZoomIn'), 500);
await click(action('ZoomIn'), 700);
await wheel(content(), 120, 4, 90);
await click(page.locator('.stage [data-action="Rotate"]').last(), 1100);

await caption('Word (.docx)');
await click(sample('sample.docx'));
await ready();
await wait(900);
await click(action('NextPage'), 700);
await click(action('NextPage'), 800);

await caption('Excel — 5,000 rows, virtualized');
await click(sample('sample.xlsx'));
await ready();
await wait(1000);
await click(page.locator('.fp-sheet-tab').nth(1), 600);
await wheel(content(), 400, 10, 70);
await wait(500);
await click(page.locator('.fp-sheet-tab').nth(0), 1000);

await caption('Images — wheel zoom & rotate');
await click(sample('sample.png'));
await ready();
await wait(700);
await wheel(content(), -100, 3, 160);
await wait(400);
await click(page.locator('.stage [data-action="Rotate"]').last(), 1000);

await caption('Markdown, JSON, logs…');
await click(sample('sample.md'));
await ready();
await wait(1000);

await caption('Compose your own toolbar');
await click(page.locator('.tabs button', { hasText: 'Compound' }));
await click(sample('sample.pdf'));
await ready();
await wait(1400);

await caption('Dark theme');
const theme = page.locator('.controls select').first();
await moveTo(...Object.values(await center(theme)));
await theme.selectOption('dark');
await wait(1300);
await caption('');
await wait(400);

const tourSeconds = (Date.now() - tourStarted) / 1000;
const skipSeconds = (tourStarted - recordingStarted) / 1000;

await context.close(); // flushes the video
await browser.close();
await server.close();

// --- encode ---------------------------------------------------------------------
const webm = join(videoDir, readdirSync(videoDir).find((f) => f.endsWith('.webm')));
mkdirSync(outDir, { recursive: true });
const gif = join(outDir, 'demo.gif');
const mp4 = join(outDir, 'demo.mp4');
const trim = ['-ss', skipSeconds.toFixed(2), '-t', tourSeconds.toFixed(2)];

execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...trim, '-i', webm,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', mp4]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...trim, '-i', webm, '-vf',
  `fps=10,scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
  gif]);
rmSync(videoDir, { recursive: true, force: true });

const size = (f) => `${(statSync(f).size / 1024 / 1024).toFixed(1)} MB`;
console.log(`demo: ${tourSeconds.toFixed(1)}s → ${gif} (${size(gif)}), ${mp4} (${size(mp4)})`);
