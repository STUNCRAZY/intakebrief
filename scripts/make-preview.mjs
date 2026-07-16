/**
 * make-preview.mjs — render key IntakeBrief pages from a running production
 * server and save SELF-CONTAINED HTML files (CSS + JS inlined) under preview/.
 * Usage:
 *   DEMO_MODE=true npm start -- -p 3110 &
 *   node scripts/make-preview.mjs
 * The output files open straight from disk (double-click) — no server needed
 * for the visual preview. Interactive form calls (/api/*) require the live server.
 */
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:3110';
const OUT = new URL('../preview/', import.meta.url);

const PAGES = {
  'index': '/',
  'status': '/status',
  'firm-youngberg-law': '/firms/youngberg-law',
  'firm-peugh-law': '/firms/peugh-law',
  'capture-sarah-roland-law': '/capture/sarah-roland-law',
  'capture-kelsey-law': '/capture/kelsey-law',
  'capture-alagood-cartwright-burke': '/capture/alagood-cartwright-burke',
};

const get = async (url, retries = 3) => {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      lastErr = new Error(`${url} → HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  throw lastErr;
};

const waitForServer = async () => {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server did not become healthy');
};

async function inlineAssets(html) {
  // Inline stylesheets: <link ... rel="stylesheet" ... href="/_next/..." />
  const linkRe = /<link\b[^>]*rel="stylesheet"[^>]*>/g;
  const tags = html.match(linkRe) ?? [];
  for (const tag of tags) {
    const href = tag.match(/href="([^"]+)"/)?.[1];
    if (!href) continue;
    const css = await get(BASE + href);
    html = html.replace(tag, `<style data-inlined="${href}">\n${css}\n</style>`);
  }
  // Inline scripts: <script ... src="/_next/..." ...></script>
  const scriptRe = /<script\b[^>]*src="([^"]+)"[^>]*>\s*<\/script>/g;
  const scripts = [...html.matchAll(scriptRe)];
  for (const [tag, src] of scripts) {
    const js = await get(BASE + src);
    const safe = js.replace(/<\/script/gi, '<\\/script');
    html = html.replace(tag, `<script data-inlined="${src}">\n${safe}\n</script>`);
  }
  return html;
}

await mkdir(OUT, { recursive: true });
await waitForServer();
for (const [name, path] of Object.entries(PAGES)) {
  const html = await inlineAssets(await get(BASE + path));
  const file = new URL(`${name}.html`, OUT);
  await writeFile(file, html);
  console.log(`preview/${name}.html  ${(html.length / 1024).toFixed(0)} KB  ← ${path}`);
}
console.log('done');
